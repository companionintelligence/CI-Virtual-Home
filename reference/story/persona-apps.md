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
- **Honest edges that ride along (every family).** Installing apps uses the internet. Crash
  reports go to Companion Intelligence from the first-party apps unless switched off (see the first-party row in the
  maker and host table). Remote access is not claimed: set every scene on the home network. A coding or chat agent is
  private only on the Core's local model, so never mention a cloud key.
- **Age rule 16.** An app the catalog tags `ai: "chat"` (a chat model or an agent: Open WebUI, Ollama, AnythingLLM, Companion Memory, Hermes, OpenClaw,
  OpenCode, Aider and the like) is used in a beat only by a `member` aged 16 or older, an agent's owner is 16 or older and the person who approves is an
  adult. A child may be named in the body of a parent-led beat as the one being helped. Tools such as LibreTranslate, Whisper-WebUI, Kokoro and
  Stirling-PDF OCR are allowed for younger members. The validator rules are `age-chat` and `age-companion` (validator.md, Story v3).
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
| `ci-openclaw` | OpenClaw WebCLI | none | Errands and browser automation, not a coder. Cloud provider keys saved in Hub can reach it: say "the model on your Core" only when none are saved, and never mention a key. Phone use away from home is not claimed. | shot |
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

Homework, reading, languages and exams. A child's questions are the privacy stake, told without fear. The pool is Open WebUI, Calibre-Web, LibreTranslate,
Obsidian, JupyterLab, Spellbook, Koodo Reader, BookLore, Kokoro, Razzia, Readeck and Linkwarden (Kiwix left it: see the end of this file).

| Store id | Display name | Replaces | Caveats the text must carry | QA |
|---|---|---|---|---|
| `open-webui` | Open WebUI | ChatGPT, Claude | See the builder table. | shot |
| `calibre-web` | Calibre-Web | Kindle, Apple Books | Your own books only. | none |
| `libretranslate` | LibreTranslate | Google Translate, DeepL | Language models are downloaded once. | shot |
| `obsidian` | Obsidian | Notion, Evernote | Not open source: never say so. Notes are Markdown files. | shot |
| `jupyterlab` | JupyterLab | none | See the builder table. | shot |
| `ci-spellbook` | Spellbook | none | A catalog of local-AI and self-hosting tools. Crash reports on by default. | shot |
| `koodo-reader` | Koodo Reader | Amazon Kindle, Apple Books | An ebook reader in the browser with notes, highlights and text-to-speech; the library is on the Core. Your own books only. Instead of Kindle or Apple Books per the catalog: do not say it imports a Kindle library. | shot |
| `booklore` | BookLore | Kindle, Apple Books | Manage and read books, comics and PDFs with automatic covers and metadata. Fetches metadata and covers from outside. Your own files only. | shot |
| `kokoro` | Kokoro | none | Text to speech on the Core, through an OpenAI-compatible speech API. A tool, not a chat model: allowed for younger members. Say nothing about the voice's quality. | shot |
| `razzia` | Razzia | none | Run a quiz night for a small group on the Core. Set a manager password at install: the upstream default blocks access. No question bank comes with it: the teacher types the questions. | shot |
| `readeck` | Readeck | Pocket, Instapaper | Save articles to read later. Your own saved pages only. | shot |
| `linkwarden` | Linkwarden | Raindrop.io, Pocket | Saves a page with a screenshot and a PDF so it survives link rot. A screenshot kept by the app is a feature, not a description of a screen. | shot |

**Open WebUI** (learner)
- Say: "Jean asks a model on the Core to explain the proof, and the question stays on the Core by default."
- Say: "Her homework chat sits on the Core."
- Never: "Open WebUI is as smart as ChatGPT."

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

**Koodo Reader**
- Say: "Jean reads her set text in Koodo Reader, and her notes sit on the Core."
- Never: "Koodo Reader opens your Kindle books."

**BookLore**
- Say: "BookLore holds the family's own books and comics on the Core."
- Never: "BookLore gets you any book you want."

**Kokoro**
- Say: "Kokoro reads the chapter aloud on the Core."
- Never: "Kokoro sounds like a person."

**Razzia**
- Say: "Razzia runs the Friday quiz from the Core."
- Never: "Razzia grades the class."

**Readeck**
- Say: "Readeck keeps the articles Jean saved for her essay on the Core."
- Never: "Readeck finds the article for you."

**Linkwarden**
- Say: "Linkwarden keeps a copy of each page, so the source is still there next year."
- Never: "Linkwarden keeps every page forever."

Kiwix is not a learner app (it ships with an empty library; see the list of apps that must not be named). Open WebUI is a chat app: the member in a
learner beat is 16 or older, so a younger learner's beat uses a tool (LibreTranslate, Kokoro, Koodo Reader), or is parent-led.

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

The eight archetypes of story v3 follow (`tech-family`, `business-owner`, `creative`, `contractor`, `marketer`, `lawyer`, `journalist`, `educator`). Their pools are
the `personas.json` rows of [persona-bible.md](persona-bible.md) section 5.3, minus Kiwix. An app already tabled above is referred back to its table.

## Tech family (Andres)

The household lead of a family that already runs its own network, lamp rules and a few apps. The rest of the family is the acceptance test: pair every tinkerer scene with a reaction from someone who does not tinker. Call the person the household lead, not admin or owner. Never open on a breach and never call an install easy. AI is the third beat, with its limit said once ("it can be wrong, so the household lead checks").

| Store id | Display name | Replaces | Caveats the text must carry | QA |
|---|---|---|---|---|
| `home-assistant` | Home Assistant | Google Home, Amazon Alexa, Apple HomeKit | See the maker and host table. | shot |
| `pi-hole` | Pi-hole | AdGuard, NextDNS | Network-wide blocking at DNS: not parental control, not a security guarantee, never "stops tracking". The router must send DNS to it. Lookups it does not block still go to the upstream resolver the family chose. | shot |
| `forgejo` | Forgejo | GitHub, GitLab (SaaS) | See the builder table. | shot |
| `ntfy` | ntfy | none | iOS push goes through an upstream relay setting; Android and the browser can stay on the Core. Scripts point at the Core's address on the home network. | shot |
| `uptime-kuma` | Uptime Kuma | Datadog, New Relic | A simple monitor that checks a page or a port answers: not Datadog. No SLA or dashboard-on-the-wall scene. | shot |
| `open-webui` | Open WebUI | ChatGPT, Claude | See the builder table. | shot |
| `ollama` | Ollama | OpenAI, ChatGPT | See the builder table. | none |
| `vaultwarden` | VaultWarden | LastPass, 1Password | See the organiser table. | shot |
| `n8n` | n8n | Zapier, Make | See the organiser table. | shot |
| `syncthing` | Syncthing | Dropbox, Resilio Sync | Listed and installable, no recorded QA run: the beat needs an owner entry. Keep to devices on the home network (sync across the internet is a remote-access claim). Sync is not a backup: it copies a deletion too. | none |

**Pi-hole**
- Say: "Pi-hole answers the house's DNS from the Core."
- Say: "Andres reads the query list on Sunday, and one allow-list entry brings the homework site back."
- Never: "Pi-hole is parental control."

**ntfy**
- Say: "ntfy tells Andres when the nightly script has finished."
- Say: "The Core sends the message; the phone on the home network shows it."
- Never: "ntfy alerts you from anywhere."

**Uptime Kuma**
- Say: "Uptime Kuma checks the apps on the Core and shows Andres which one stopped."
- Never: "Uptime Kuma is a full monitoring platform."

**Syncthing**
- Say: "Syncthing keeps the workshop folder the same on the laptop and the Core."
- Never: "Syncthing is the family's backup."

Honest edges for this archetype:

- Remote access is not claimed: no VPN, Tailscale, tunnel or "remote" in the copy.
- There is no Zigbee stick by default; Pi-hole is not parental control; no backup story is told.
- Open WebUI and Ollama are chat apps: the household lead is 16 or older (age rule).

## Business owner (Ruth)

Runs a shop, studio, agency or practice of one to fifteen people: quotes, invoices, contracts and the customer list. Not the organiser (household records and a practice of one): a business owner has premises, staff and books. A bounded chore by the model on the Core on the owner's files, which the owner reads and approves before anything reaches a client; nothing emails, pays or books alone.

| Store id | Display name | Replaces | Caveats the text must carry | QA |
|---|---|---|---|---|
| `nextcloud` | Nextcloud | Google Drive, Dropbox, OneDrive, iCloud | See the organiser table. | shot |
| `invoice-ninja` | Invoice Ninja | FreshBooks, QuickBooks | Invoices, quotes, expenses and time tracking: not a ledger, payroll or tax filing. Cards need a payment provider: say invoicing, not payment processing. Never "tax ready". | shot |
| `paperless` | Paperless-ngx | Evernote, Google Drive | See the organiser table. | shot |
| `docuseal` | Docuseal | DocuSign | Fill and sign PDF forms. Never say a signature is legally binding or valid. Signers outside the home network need to reach the Core: show signing at the desk. | shot |
| `akaunting` | Akaunting | QuickBooks, Xero, FreshBooks | Bookkeeping only: no tax, accounting or legal advice, no payroll, no bank feeds. | shot |
| `twenty` | Twenty | Salesforce | A customer list and pipeline: not HubSpot-style automation. | shot |
| `vaultwarden` | VaultWarden | LastPass, 1Password | See the organiser table. | shot |
| `anything-llm` | AnythingLLM | ChatGPT, Claude | Chat with your own documents using a local model. It can also connect to cloud models: show only the local path and never mention a key. A chat app: the member in the beat is 16 or older (age rule). | shot |
| `solidtime` | Solidtime | Harvest, Toggl Track | Listed and installable, no recorded QA run: the beat needs an owner entry. Time tracking only. | none |
| `grist` | Grist | Airtable | A spreadsheet with tables that link, for the stock list or the rota. Not a bank feed or a payroll system. | shot |
| `bookstack` | BookStack | Confluence, Notion | See the organiser table. | shot |
| `baikal` | Baikal | Google Calendar, iCloud Calendar | Overlaps Radicale: one calendar server per household, not both. No sharing carries over from Google Calendar. | shot |
| `libreoffice` | LibreOffice | Microsoft Office, Google Workspace | See the organiser table. | shot |
| `stirling-pdf` | Stirling-PDF | Adobe Acrobat, Smallpdf | See the organiser table. | shot |
| `whisper-webui` | Whisper-WebUI | none | Listed and installable, no recorded QA run: the beat needs an owner entry. Model weights are downloaded first; it runs on the CPU unless the host passes a GPU in. Say nothing about speed or accuracy. Subtitles and transcripts only. | none |
| `ci-memory` | Companion Memory | none | Imports are opt-in and revocable, nothing connected by default. First-party crash-report caveat below. A chat and agent app: the member in the beat is 16 or older. | shot |

**Invoice Ninja**
- Say: "Ruth's quotes and invoices go through Invoice Ninja on the Core."
- Say: "The client, the line items and last spring's job sit together in Invoice Ninja."
- Never: "Invoice Ninja takes card payments."

**Docuseal**
- Say: "The engagement letter is signed at the desk in Docuseal, and the PDF sits on the Core."
- Never: "Docuseal signatures are legally binding."

**Akaunting**
- Say: "Akaunting keeps the shop's books on the Core."
- Never: "Akaunting files your taxes."

**Twenty**
- Say: "The customer list sits in Twenty on the Core, not in a rented CRM."
- Never: "Twenty emails your customers for you."

**AnythingLLM**
- Say: "Ruth asks a model on the Core about her own folder of contracts, and reads the answer before anything goes to a client."
- Never: "AnythingLLM answers your customers."

**Solidtime**
- Say: "Solidtime keeps the hours for each client on the Core."
- Never: "Solidtime bills the client for you."

**Grist**
- Say: "The stock list is a Grist table on the Core."
- Never: "Grist replaces your accountant."

**Baikal**
- Say: "The shop's calendar is served from Baikal on the Core."
- Never: "Baikal shares your calendar with every customer."

**Whisper-WebUI**
- Say: "Whisper-WebUI turns the recording into text on the Core."
- Say: "Noor checks every quote against the audio."
- Never: "Whisper-WebUI transcribes every word correctly."

**Companion Memory**
- Say: "Companion Memory keeps the client file on the Core, so the agent has the context."
- Never: "Companion Memory remembers everything."

Honest edges for this archetype:

- No payroll, point of sale, card processing or bank feeds; no tax or accounting advice; never "legally binding".
- Staff, clients and signers outside the home network are out, and so are web shops: one household lead, one machine.
- AnythingLLM and Companion Memory are chat or agent apps: the member in the beat is 16 or older.

## Creative (Dalia)

A working designer, photographer, filmmaker, illustrator or musician: client work, an archive that outlives the job, and a brief that is confidential. They talk about the brief, the proof and the round of changes, and say "under NDA" or "embargoed", not "privacy". One named chore, then the creative decides; never a generative image or music hero, and never AI pushed at someone who rejects it.

| Store id | Display name | Replaces | Caveats the text must carry | QA |
|---|---|---|---|---|
| `immich` | Immich | Google Photos, iCloud Photos | See the gamer table. | shot |
| `nextcloud` | Nextcloud | Google Drive, Dropbox, OneDrive, iCloud | See the organiser table. | shot |
| `penpot` | Penpot | Figma, Sketch | Design and prototyping in the browser. No Figma importer: say "export and rebuild", never "imports Figma". | shot |
| `inkscape` | Inkscape | Adobe Illustrator | Vector drawing only, in a browser session. Opens SVG and PDF. | shot |
| `open-webui` | Open WebUI | ChatGPT, Claude | See the builder table. | shot |
| `invoice-ninja` | Invoice Ninja | FreshBooks, QuickBooks | See the business owner table. | shot |
| `vaultwarden` | VaultWarden | LastPass, 1Password | See the organiser table. | shot |
| `whisper-webui` | Whisper-WebUI | none | See the business owner table. | none |
| `docuseal` | Docuseal | DocuSign | See the business owner table. | shot |
| `freecut` | FreeCut | none | A browser video editor that uses WebGPU in Chromium on the device you edit on. Not Premiere or Resolve: say nothing about formats or speed. | shot |
| `audiomass` | AudioMass | Adobe Audition, TwistedWave | A browser audio editor. It saves where the person chooses. Not Audition or Logic. | shot |
| `photoview` | Photoview | Google Photos | Listed and installable, no recorded QA run: the beat needs an owner entry. The map view uses a Mapbox token you can add: leave it off for a gallery that stays on the Core. | none |
| `pingvin-share` | Pingvin Share | WeTransfer | Share links for people outside the home network need to reach the Core, which is not claimed: show the handover at the table. | shot |
| `syncthing` | Syncthing | Dropbox, Resilio Sync | See the tech family table. | none |
| `navidrome` | Navidrome | Spotify, Apple Music | Plays your own music files. Not a streaming service. | shot |

**Penpot**
- Say: "Dalia lays out the poster in Penpot on the Core."
- Never: "Penpot opens your Figma files."

**Inkscape**
- Say: "The logo is drawn in Inkscape and the file sits on the Core."
- Never: "Inkscape replaces the whole Adobe suite."

**FreeCut**
- Say: "Dalia cuts the short film in FreeCut, and the project files sit on the Core."
- Never: "FreeCut opens your Premiere projects."

**AudioMass**
- Say: "Dalia trims the voice-over in AudioMass and saves it to the Core."
- Never: "AudioMass opens your Ableton sessions."

**Photoview**
- Say: "Photoview shows the shoot folders on the Core as a gallery."
- Never: "Photoview is a RAW developer."

**Pingvin Share**
- Say: "Pingvin Share makes the link for the proof on the Core."
- Never: "Pingvin Share sends files to clients anywhere."

**Navidrome**
- Say: "Navidrome plays the studio's own music from the Core."
- Never: "Navidrome streams any song you ask for."

Honest edges for this archetype:

- Cannot move Lightroom, Photoshop, Premiere, Resolve, Ableton or Logic; no Figma or Lightroom import; no link for clients outside the house.
- The Core is not a backup. No story may imply a company trains on customer content.
- Open WebUI is a chat app: the member in the beat is 16 or older.

## Contractor (Kunle)

A self-employed tradesperson or small building contractor: the quote, the site photos, the tools and the warranty cards, run from the garage bench. A trade is two jobs, on site with the hands and then the firm at the end of the day. The anchor is `room` set to the garage (roles.json has no workbench), then `desk`, `driveway` and `laundry`. Dry and short: "Quote done. Photos in. Home by six."

| Store id | Display name | Replaces | Caveats the text must carry | QA |
|---|---|---|---|---|
| `invoice-ninja` | Invoice Ninja | FreshBooks, QuickBooks | See the business owner table. | shot |
| `immich` | Immich | Google Photos, iCloud Photos | See the gamer table. | shot |
| `homebox` | HomeBox | Sortly | Listed and installable, no recorded QA run: the beat needs an owner entry. A one-household inventory: items, locations, photos. Barcode and Open Food Facts lookups call outside services. No warranty tracking claim. | none |
| `lubelogger` | LubeLogger | Fuelly, Drivvo | Service and fuel records for a vehicle: no fleet telematics. | shot |
| `paperless` | Paperless-ngx | Evernote, Google Drive | See the organiser table. | shot |
| `docuseal` | Docuseal | DocuSign | See the business owner table. | shot |
| `solidtime` | Solidtime | Harvest, Toggl Track | See the business owner table. | none |
| `vaultwarden` | VaultWarden | LastPass, 1Password | See the organiser table. | shot |
| `nextcloud` | Nextcloud | Google Drive, Dropbox, OneDrive, iCloud | See the organiser table. | shot |
| `radicale` | Radicale | Google Calendar, iCloud Calendar | Listed and installable, no recorded QA run: the beat needs an owner entry. Calendars and contacts. No sharing carries over from Google Calendar. | none |
| `stirling-pdf` | Stirling-PDF | Adobe Acrobat, Smallpdf | See the organiser table. | shot |
| `open-webui` | Open WebUI | ChatGPT, Claude | See the builder table. | shot |
| `planka` | Planka | Trello | Boards and cards for jobs. Name one board tool per household. | shot |
| `akaunting` | Akaunting | QuickBooks, Xero, FreshBooks | See the business owner table. | shot |

**HomeBox**
- Say: "HomeBox lists the tools on the wall, with a photo and a place for each."
- Never: "HomeBox tracks every warranty."

**LubeLogger**
- Say: "LubeLogger keeps the van's service history on the Core."
- Never: "LubeLogger tracks your whole fleet live."

**Radicale**
- Say: "The job calendar is served from Radicale on the Core."
- Never: "Radicale shares your calendar with your crew on site."

**Planka**
- Say: "The week's jobs are cards on a Planka board on the Core."
- Never: "Planka dispatches the crew."

Honest edges for this archetype:

- Remote access is not claimed: a crew on site or a quote sent from the van cannot be shown.
- Never "tax ready" (Making Tax Digital needs recognised software). No payments, no dispatch, no one-click move from CompanyCam or Jobber.
- Open WebUI is a chat app: the member in the beat is 16 or older.

## Marketer (Elena)

A freelance or in-house digital marketer. The story is not cheaper tools: the client's list, files and briefs sit in the house, and the model that drafts from them runs on the Core. She edits and approves; no better-copy claim, no time or money saved, no cloud key.

| Store id | Display name | Replaces | Caveats the text must carry | QA |
|---|---|---|---|---|
| `open-webui` | Open WebUI | ChatGPT, Claude | See the builder table. | shot |
| `ci-memory` | Companion Memory | none | See the business owner table. | shot |
| `nextcloud` | Nextcloud | Google Drive, Dropbox, OneDrive, iCloud | See the organiser table. | shot |
| `ghost` | Ghost | Squarespace, Wix, Medium, Mailchimp, ConvertKit | Publishing and newsletters. A public site needs the Core reachable from outside, which is not claimed: use it for drafting and the list. Sending needs an outside mailer. | shot |
| `penpot` | Penpot | Figma, Sketch | See the creative table. | shot |
| `vaultwarden` | VaultWarden | LastPass, 1Password | See the organiser table. | shot |
| `twenty` | Twenty | Salesforce | See the business owner table. | shot |
| `whisper-webui` | Whisper-WebUI | none | See the business owner table. | none |
| `listmonk` | Listmonk | Mailchimp, ConvertKit | Sending at volume needs an SMTP provider or mail server: do not promise delivery. | shot |
| `plausible` | Plausible Analytics | Google Analytics | To count visits it must be exposed to the web: not claimed. The manifest says GDPR, CCPA and PECR compliant: do not repeat any compliance claim. | shot |
| `n8n` | n8n | Zapier, Make | See the organiser table. | shot |
| `inkscape` | Inkscape | Adobe Illustrator | See the creative table. | shot |
| `freecut` | FreeCut | none | See the creative table. | shot |
| `mixpost` | Mixpost | Buffer, Hootsuite | Publishes to outside social platforms and needs a public callback URL: a limit card, not a hero. Overlaps Postiz: name one. | shot |
| `solidtime` | Solidtime | Harvest, Toggl Track | See the business owner table. | none |
| `grist` | Grist | Airtable | See the business owner table. | shot |

**Ghost**
- Say: "The client's list sits in Ghost on the Core, not in a mailing service she rents."
- Never: "Ghost sends your newsletter to the world."

**Listmonk**
- Say: "Listmonk holds the subscriber list and the campaign drafts on the Core."
- Never: "Listmonk lands every email in the inbox."

**Plausible Analytics**
- Say: "Plausible keeps the traffic numbers on the Core."
- Never: "Plausible makes you GDPR compliant."

**Mixpost**
- Say: "Mixpost holds the week's posts as drafts on the Core."
- Never: "Mixpost posts for you at the best time."

Honest edges for this archetype:

- Cannot move the platforms, sending reputation, SEO suites, Canva's library, live co-editing with a client or HubSpot automation.
- Ghost holds the list; sending needs an outside mailer. Mixpost needs a public callback URL.
- Open WebUI and Companion Memory are chat or agent apps: the member in the beat is 16 or older.

## Lawyer (Ingrid)

A solo or small-firm attorney: the client file, the engagement letter and a first-pass summary she checks line by line. Precise, dry, guarded, allergic to promises. The model drafts, the person signs; one checkable chore with the lawyer reading the source. The headline is where the file lives, never accuracy, parity, speed or "privileged".

| Store id | Display name | Replaces | Caveats the text must carry | QA |
|---|---|---|---|---|
| `paperless` | Paperless-ngx | Evernote, Google Drive | See the organiser table. | shot |
| `nextcloud` | Nextcloud | Google Drive, Dropbox, OneDrive, iCloud | See the organiser table. | shot |
| `docuseal` | Docuseal | DocuSign | See the business owner table. | shot |
| `open-webui` | Open WebUI | ChatGPT, Claude | See the builder table. | shot |
| `libreoffice` | LibreOffice | Microsoft Office, Google Workspace | See the organiser table. | shot |
| `vaultwarden` | VaultWarden | LastPass, 1Password | See the organiser table. | shot |
| `stirling-pdf` | Stirling-PDF | Adobe Acrobat, Smallpdf | See the organiser table. | shot |
| `cryptgeon` | Cryptgeon | Privnote, WeTransfer | Sends a note that can be opened once. A recipient outside the home network needs to reach the Core: show the handover in the room. | shot |
| `ollama` | Ollama | OpenAI, ChatGPT | See the builder table. | none |
| `whisper-webui` | Whisper-WebUI | none | See the business owner table. | none |
| `radicale` | Radicale | Google Calendar, iCloud Calendar | See the contractor table. | none |
| `solidtime` | Solidtime | Harvest, Toggl Track | See the business owner table. | none |
| `invoice-ninja` | Invoice Ninja | FreshBooks, QuickBooks | See the business owner table. | shot |
| `bookstack` | BookStack | Confluence, Notion | See the organiser table. | shot |
| `twenty` | Twenty | Salesforce | See the business owner table. | shot |
| `ci-memory` | Companion Memory | none | See the business owner table. | shot |

**Cryptgeon**
- Say: "Ingrid hands the one-time note across the desk through Cryptgeon."
- Never: "Cryptgeon makes the note privileged."

Honest edges for this archetype:

- No Clio, Westlaw or Lexis replacement: no matter workspace, conflict checks, trust accounting or e-filing. No compliance claim. Docuseal: never "legally binding".
- Email is the hardest thing to move; video with outside clients needs outside reach.
- Open WebUI, Ollama and Companion Memory are chat apps: the member in the beat is 16 or older.

## Journalist (Noor)

A reporter, writer or researcher: the tape, the notes and the records sit on the Core, and every quote is checked against the audio. Evidence first; a pun is unwelcome. One bounded chore on her own material, verified by hand; never AI writing or deciding anything with a byline.

| Store id | Display name | Replaces | Caveats the text must carry | QA |
|---|---|---|---|---|
| `whisper-webui` | Whisper-WebUI | none | See the business owner table. | none |
| `paperless` | Paperless-ngx | Evernote, Google Drive | See the organiser table. | shot |
| `obsidian` | Obsidian | Notion, Evernote | See the learner table. | shot |
| `open-webui` | Open WebUI | ChatGPT, Claude | See the builder table. | shot |
| `nextcloud` | Nextcloud | Google Drive, Dropbox, OneDrive, iCloud | See the organiser table. | shot |
| `vaultwarden` | VaultWarden | LastPass, 1Password | See the organiser table. | shot |
| `ci-memory` | Companion Memory | none | See the business owner table. | shot |
| `stirling-pdf` | Stirling-PDF | Adobe Acrobat, Smallpdf | See the organiser table. | shot |
| `libretranslate` | LibreTranslate | Google Translate, DeepL | See the learner table. | shot |
| `linkwarden` | Linkwarden | Raindrop.io, Pocket | See the learner table. | shot |
| `libreoffice` | LibreOffice | Microsoft Office, Google Workspace | See the organiser table. | shot |
| `cryptgeon` | Cryptgeon | Privnote, WeTransfer | See the lawyer table. | shot |
| `joplin` | Joplin Server | Evernote | See the organiser table. | shot |
| `anything-llm` | AnythingLLM | ChatGPT, Claude | See the business owner table. | shot |
| `miniflux` | Miniflux | Feedly, Inoreader | Listed and installable, no recorded QA run: the beat needs an owner entry. Overlaps FreshRSS: name one feed reader. | none |
| `element` | Element | Slack, Discord | A Matrix chat app that connects to a homeserver you run. Sources choose their own channel: Signal, WhatsApp and iMessage do not move. | shot |

**Miniflux**
- Say: "Miniflux gathers the feeds Noor follows on the Core."
- Never: "Miniflux finds the story for you."

**Element**
- Say: "Element connects the household to the chat server on the Core."
- Never: "Element replaces Signal for sources."

Honest edges for this archetype:

- Signal, WhatsApp and iMessage do not move: sources choose the channel. Remote access is not claimed.
- The Hub is not a source-protection tool and the Core is not a vault: never imply immunity from a search or a seizure.
- Open WebUI, AnythingLLM and Companion Memory are chat or agent apps: the member in the beat is 16 or older.

## Educator (Eszter)

A teacher, tutor, lecturer or homeschooling parent: lesson folders, handouts and report comments the teacher rewrites by hand. "I use it for the paperwork, not for the child." A model on the Core does one named chore from the teacher's own materials, then she rewrites it; never grading or deciding about a child; never an hours figure.

| Store id | Display name | Replaces | Caveats the text must carry | QA |
|---|---|---|---|---|
| `open-webui` | Open WebUI | ChatGPT, Claude | See the builder table. | shot |
| `paperless` | Paperless-ngx | Evernote, Google Drive | See the organiser table. | shot |
| `nextcloud` | Nextcloud | Google Drive, Dropbox, OneDrive, iCloud | See the organiser table. | shot |
| `libreoffice` | LibreOffice | Microsoft Office, Google Workspace | See the organiser table. | shot |
| `libretranslate` | LibreTranslate | Google Translate, DeepL | See the learner table. | shot |
| `joplin` | Joplin Server | Evernote | See the organiser table. | shot |
| `stirling-pdf` | Stirling-PDF | Adobe Acrobat, Smallpdf | See the organiser table. | shot |
| `vaultwarden` | VaultWarden | LastPass, 1Password | See the organiser table. | shot |
| `razzia` | Razzia | none | See the learner table. | shot |
| `excalidraw` | Excalidraw | Miro, Mural | A whiteboard in the browser; amd64 only. The lesson sketch is a file on the Core. | shot |
| `ci-planning` | Companion Planning | none | See the organiser table. | shot |
| `radicale` | Radicale | Google Calendar, iCloud Calendar | See the contractor table. | none |
| `calibre-web` | Calibre-Web | Kindle, Apple Books | See the learner table. | none |

**Excalidraw**
- Say: "Eszter sketches the lesson on an Excalidraw board on the Core."
- Never: "Excalidraw runs a live class."

Honest edges for this archetype:

- No learning platform, gradebook or student information system is in the store; it does not work with Google Classroom (say so). Never a class list, a grade or a safeguarding note at a home Core.
- No FERPA or UK GDPR claim; remote access is not claimed. Kiwix is not used (it ships an empty library).
- Open WebUI is a chat app: the member in the beat is 16 or older.

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
| `kiwix` Kiwix | It installs with an EMPTY library and the Hub has no way to add one (its own QA capture shows "No result"), so no story may show a look-up, a Wikipedia file or an answer from it; "replaces Google Search" is also stretched (it serves a snapshot, not a search engine). Catalog `storySafe` is `avoid`. Revisit when the Marketplace ships a starter library. |
| `lingva-translate` Lingva Translate | It scrapes Google Translate, so it is not local. Use LibreTranslate. (SearXNG, which queries other search engines, is in the catalog with a cloud-link caveat; it is not a substitute for a look-up app.) |
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
