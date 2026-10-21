# Stage 2 review: brennan (house seraphine)

> **Status: historical review of a draft.** A stage-2 review of the first Brennan story (house `seraphine`) as drafted on 2026-10-20, before the fixes it lists. The replacement text it proposes was applied to a scratch copy only; check `content/families/brennan.json` on main for what is there now. The conventions it applies are `reference/story/personas.md`, `validator.md` and `story-v3.md`.

**Verdict: SHIP AFTER FIXES.** 0 BLOCKER, 3 MAJOR, 10 MINOR. `pnpm run story:validate -- brennan` is clean (0 errors, 0 review, 0 warnings, one allow-listed suite-code finding; `content/story/reviewed.json` still lists `brennan / suite-code / app-qa-screenshot`, so the beat id is kept). Every replacement below was applied to a scratch copy and that copy validates clean (0/0/0).

## Writer's doubtful claims, checked

| Beat | Claim | Result |
|---|---|---|
| office-draft | "Juniper drafts on the Core's local model" | Supported. Hermes catalog caveat: "The default backend is the Hub local model"; claims.json `cap-cloud-model` fix text says to write "the agent runs on the Core's local model". The channel note is present. No defect. |
| living-sign | "stays in Docuseal on the Core" | Supported. Docuseal listing: "from your own Core"; caveat "Signers outside your home network need access to your Core" is respected because the client signs in person on the home network. No legal-validity wording. No defect. |
| jean-aloud | Kokoro reads an essay aloud | Supported for story use: catalog "Turn text into natural speech on your own Core"; `personas.md` itself says "Kokoro reads them aloud" for the learner. The listing is a speech API, so the story names no screen. Non-chat tool, so Jean (14) may use it. No defect. |
| jean-reader | "covers and details added from the internet" | Correct and honest: BookLore caveat is "Fetches metadata and covers from outside". Good beat. |
| garden-pump | Quill drafts text only, plug on the home network | Supported: the beat says Quill drafts, John reads and saves; claims `cap-autonomy`, `cap-cloud-model` respected; HA caveat "claim local only for network-local devices" respected; no energy claim. One clarity defect (Quill is never introduced), below. |
| office-tuning | Paperless-ngx "reads and tags each page" | Supported by the Paperless listing ("It reads every page, tags it") and its note "OCR and archiving of PDFs and scans works". The `f-box-to-box` OCR line is about the platform roadmap, not this app. Only "as it is scanned" goes beyond the listing; trim it (below). |
| steve-photos | thin Immich beat | Confirmed weak (MAJOR below). Also the Immich caveat "phone backup needs the phone app on the home network" is not visible in the popup. |

No capability, speed, price, saving, uptime, compliance or security-guarantee claim found. All 16 pairs match the catalog `replaces` and the registry. No "replaces" wording, no allegation about what a service did. Jean is never the actor of a chat or agent beat (LibreTranslate, BookLore, Linkwarden, Kokoro are tools). No dash, exclamation mark, price, "assistant" or ad-speak. Daylight only. Sentence limits hold.

## Defects

| Sev | Beat id | Quote | What is wrong | Exact replacement |
|---|---|---|---|---|
| MAJOR | steve-photos | "Steve’s lake pictures used to sit on his phone and in a photo cloud." | Thin and generic: "a photo cloud" names nothing the service held (the service only appears in the detail), and the popup drops the Immich home-network caveat. It is also the third beat built on the lake (living-film, jean-french). | popup.body: "Steve’s phone sent every picture to Google Photos. Now, on the home Wi-Fi, they back up to Immich on the Core, beside everyone else’s." and detail.before: "Steve’s phone uploaded every picture to Google Photos, and the whole summer sat in that account." |
| MAJOR | ftue-pick | title "Picking the first agent and apps" | Near duplicate (0.94 similarity) of brennan-merrow ftue-pick "Pick the first agents and apps". | popup.title: "Hermes first, then two apps" |
| MAJOR | ftue-hello | detail.before "Without an agent, Sally wrote every reply and every reminder herself, one app at a time." | Near duplicate (0.96) of brennan-merrow ftue-hello detail.before ("...every reply and reminder herself, one app at a time"). | detail.before: "Sally typed each reply to a client herself, and kept the reminders in her head." |
| MINOR | office-split | "Stirling-PDF does it on the Core, not on a PDF website." | One of four bodies that close on a "not on a X" contrast (also suite-ask, steve-session, jean-french). The strongest beat should end on its pointed fact, not a formula. | popup.body: "One scan holds two clients’ papers. Sally splits it in Stirling-PDF on the Core, so each client gets only their own pages." |
| MINOR | suite-ask | "goes to a model on the Core, not a hosted chat." | Same "not a X" shape; the title already says where the trace goes. | popup.body: "A test fails in John’s book catalogue, so he pastes the trace into Open WebUI. The model on the Core answers, and he reads it before changing a line." |
| MINOR | steve-session | "runs Steve’s session on the Core in the library, not on a cloud server." | Same shape; opens on the app instead of the person. | popup.body: "Upstairs, Steve signs in to his own Valve account. The session itself runs on the Core in the library, and he plays it in a browser." |
| MINOR | jean-french | "The translating happens on the Core, not on a translation website." | Same shape. | popup.body: "Jean writes the lake paragraph in French herself. Then she pastes it into LibreTranslate on the Core and compares the result with what she meant." |
| MINOR | living-film | "Steve picks Saturday’s film from the family’s own files: John’s lake video from four summers back." | Specific scene, but it argues nothing: Plex is itself a home media server and the beat says nothing about what it held. The Jellyfin fact that does hold ("your own files") is not stated as the point. | popup.body: "Saturday’s film is John’s lake video from four summers back. Steve picks it from a list of nothing but the family’s own files, and Jellyfin streams it from the Core." |
| MINOR | kitchen-quest | "Steve takes the bins out because bin day is a quest with a reward." | Reads as a parent bribing a 16 year old, and the body argues nothing about Todoist. Lets Steve own it. | popup.body: "Steve takes the bins out because bin day is a quest he set up himself. Habitica, running on the Core, turns the chore list into a game." |
| MINOR | office-tuning | "reads and tags each page as it is scanned" | "As it is scanned" claims an automatic step the listing does not state. | popup.body: "One word, tuning, brings up the grand piano’s receipts. Paperless-ngx reads and tags each page, so the whole lot is searchable." |
| MINOR | garden-pump | "Now Quill drafts one rule" | A stranger meets Quill cold: the first-run chapter names one agent (Juniper) and never says John has one. | popup.body: "The pool pump’s plug had two timers, in two apps. John’s agent, Quill, drafts one rule, and John reads and saves it in Home Assistant on the Core." |
| MINOR | outro-street | "One Companion Core holds the plans, folders, photos, code and homework, in a house still lined with books." | Says the same list as closing.body ("plans, folders and homework"); two end screens argue one point. | popup.body: "From the library to the pool, one Companion Core serves the house, and the shelves are still lined with books." |
| MINOR | closing | "Your plans, folders and homework can sit on a Companion Core at home." | Generic list; it does not carry the tour's one argument (whose things, where they sit). Link and CTA are clean (`See Companion Core` to `https://ci.computer/core`). | closing.body: "Sally’s client folders, John’s code and Jean’s sources sit on a Companion Core at home. Browse the Companion Hub store and choose your first apps." |

## Pointedness count

3 of 27 beats are generic or argue nothing specific: **steve-photos, living-film, kitchen-quest** (the outro/closing list is a fourth borderline case, listed as MINOR). The other 24 name one specific thing in the first sentence. The strongest: office-split (the other client's pages), garden-pump (two timers in two apps), jean-sources (the page as she read it), suite-manual (what only John knows), office-week (Monday's admin hour), kitchen-board (four people, three stools).

Variety: openings differ well; moments differ in kind (a mistake caught, a dated file, a hand-off, a hobby, a child learning). The one pattern is the closing clause: 19 of 21 room-beat bodies end on "on the Core" and four use "not on a X". Fixed above for the four. Mild: jean-french and jean-aloud both proof her own writing; the lake appears in living-film, steve-photos and jean-french (fixed to two by the steve-photos rewrite).

## The house

Good use: three bar stools at the breakfast bar, the library clock, grand piano and vanity stool ("piano stool"), the Chess Hall bistro table, the master suite loveseat and writing desk, two chesterfields, the pool with loungers, the steps up to the porch, Steve's and Jean's rooms upstairs (kids-room anchors resolve to Boy's and Girl's Room by area; the Nursery is not used). It could not be set in another house. Casting matches (Sally library, John primary suite, Steve upstairs, Jean Girl's Room).

Pipeline note, not a file defect: `content/families/brennan.bake.json` is stale (its poses still carry old beat ids such as office-plan and office-paper), so `story:bake`, `story:voice --stale` and `portal:og` must be run after the fixes.

## Duplicate check (brennan vs brennan-hollin and brennan-merrow)

No fleet-gate repeat: no non-first-run title or body is shared. Near duplicates are in the first-run chapter only (ftue-pick title, ftue-hello detail.before, both against merrow; both fixed above). The first-run bodies of all three tours share one skeleton (parcel, unbox, plug in, join, pick, hello); brennan's is the most house-specific.

Trio overlap worth knowing: all three tours give Steve Steam Headless against GeForce Now, give John Code Server (Cursor in brennan and merrow, VS Code in hollin), and run Yuvomi as a kitchen household beat. Notion is shared with hollin (kids-notes), Evernote with merrow (office-notes). Sentence skeletons for Steve's session now differ after the steve-session rewrite. If the owner wants the trio to feel more varied, the cheapest swap is one of Yuvomi or Steam Headless in brennan, but both are the signature apps in casting, so left as is.

## The one change that would most raise the tour's pull

Put office-split straight after ftue-hello, ahead of office-week. Today the first six beats are setup, and the first room beat (Companion Planning) has no "alternative to" chip, so the uncloud argument first lands at the second room beat. office-split ("the pages that belonged to the other client") is the tour's sharpest, most visual, film-flagged beat and should be the first thing a stranger sees the Core do. Second place: the closing body fix above, so the last line says whose things now sit at home.
