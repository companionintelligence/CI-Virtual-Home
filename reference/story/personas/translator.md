# The Translator (`translator`)

Deep dive for one proposed persona, the fifteenth archetype. Draft for the owner; nothing here is wired yet (the schema enum, `ARCHETYPES`, `content/story/personas.json`, `PERSONAS` in `scripts/portal-front.mts` and `content/story/cast-plan.json` are unchanged). Written on 2026-10-20 against `content/story/catalog-apps.json`, `services.json`, `claims.json` and `roles.json` as they stand in this tree. Companion OS, Companion Agents and Companion Memory are in beta.

Home chip: **Work from home**. Nobody here is a customer. Ages, homes, jobs and lines are design choices for fictional characters; the only tagged statements describe the world, and none was read from a page for this chapter, so every one carries **[?]** (inference or lived-experience generalisation). Do not present a [?] line as a fact. The example name is a placeholder (`Noa`, unused in the cast, the retired families and the avoid list); a household's real translator gets a name from the cast step.

**Why this persona.** The Work from home chip is today the organiser, who is a household manager first. A translator is a person whose trade is language, not homework (the learner) and not a byline (the journalist): the same desk, a different noun. The job has real files going in and out, an invoice at the end of every project and a pile of reference material, so five apps in the Hub tell it honestly. It also gives the lander a person who works with their hands on paper and in a text editor, not a manager of a household.

---

## 1. Who

A freelance translator or subtitler for one or two language pairs, working from a desk in a flat, a corner of the dining room or a rented desk in a small shared office. Some grew up speaking more than one language at home; some learned a second or third language at school or after moving; some came to translation from another trade, such as teaching, publishing or engineering [?]. None of that is read off a name, a face or a home's look: the language pair is the person's training and their work, and the story never says where anyone "is from". The design range is 26 to 68; the middle of the cast, 34 to 55, is a design choice, not a finding. A translator who is retired from full-time work and still takes a few jobs a year is as natural as a mid-career freelancer with a regular agency client.

A day in daylight. The morning begins at a desk by a window with a printed source text, a pencil and a paper dictionary open on a shelf within reach. The translator reads the whole source before a line is typed [?], has a rough draft made on the Core for the dull paragraphs, and then rewrites each sentence by hand, deleting more than they keep. Midday is the part that is not translation: splitting a client's long PDF into the chapters due on different days, merging three corrected files into one, checking a term against last year's notes. Late afternoon, with the light low, is the invoice and the hours for the project that went out that day. A household is around the edges: a partner who works in a different trade, an older relative who visits, a child doing homework at the dining table. The Core sits on a shelf in the same room as the work, a stylised drawing as always, and nobody in the family uses it as the translator does.

## 2. What they are responsible for

- **The words that go out under their name.** Every line a client reads was chosen by the translator. The tools offer a first pass; the person owns the rest.
- **The client's source files.** A manual, a catalogue, a script, a leaflet, a set of subtitles: the translator is trusted with files that are not theirs, and a client may say so in a contract. The persona does not promise what the contract promises; the story only says where the files sit.
- **Consistency across a job.** The same term the same way in chapter one and chapter twelve, and the same way next year for the same client. This is why notes and a searchable archive matter more here than in most trades.
- **The deadline, per project.** A project is a unit with a due date, a client and a rate agreed outside the Hub.
- **The invoice and the year's books.** Invoices go out when a project is done; expenses (a dictionary, a monitor, a conference ticket) are kept to be shown to a bookkeeper. The Hub app keeps the record; advice about tax belongs to someone else.

## 3. What they rent today

Registry ids are from `content/story/services.json` (241 rows). Every row below has `storyStatus: ok`, `alternativeToForm: ok` and no `stale` or `story-excluded` flag. Chips read `alternative to <Service>`, never `replaces <Service>` (chips-legacy); a service name is used only in a chip, a `detail.before` or `detail.after`, or the comparative form "<App> is an alternative to <Service>", and never in a sentence about what the company does to you (`incumbent-attack`).

| Service | Registry id | Rank | What the translator uses it for | Hub app that can sit in its place (registry `storyApps`) |
|---|---|---|---|---|
| Google Translate | `google-translate` | 92 | A quick look-up, or a rough first pass of a long paragraph | `libretranslate` |
| DeepL | `deepl` | 130 | The same, for the pairs a translator prefers it for [?] | `libretranslate` |
| Adobe Acrobat | `adobe-acrobat` | 65 | Receiving, reading and merging PDFs from a client | `stirling-pdf`, `bentopdf` |
| Smallpdf | `smallpdf` | 82 | The one-off split, merge or compress in a browser | `stirling-pdf`, `bentopdf` |
| Toggl Track | `toggl-track` | 168 | A timer per project | `solidtime` |
| Harvest | `harvest` | 144 | Hours per client (flag `ordinary-word`: write it capitalised, never at the start of a sentence, and prefer the chip) | `solidtime` |
| FreshBooks | `freshbooks` | 30 | Invoices and a client list | `akaunting`, `invio`, `invoice-ninja` |
| QuickBooks | `quickbooks` | 35 | Invoices, expenses, the year's books | `akaunting`, `invio`, `invoice-ninja` |
| Xero | `xero` | 176 | The same, for a bookkeeper's preference | `akaunting` |
| Evernote | `evernote` | 12 | Term lists, notes on a client's style, a notebook per project | `joplin`, `obsidian`, `paperless`, `papra`, `standard-notes` |
| Google Drive | `google-drive` | 4 | Client folders, received style guides, the archive | `paperless`, `nextcloud`, `papra` and others |

Beside these, a translator also keeps accounts on agencies' own vendor portals and may be required to use an agency's translation-memory software on the agency's server [?]. None of that is in the Hub and none is claimed to move (see section 8).

## 4. What the Hub offers them

Every id below is in `catalog-apps.json`, `inLiveStore: true`, `storySafe` not `avoid`. The first-chip name is the display name, character for character. "Caveat" is the catalog entry's own, plus the persona-apps wording. A beat names one app (`app`) and puts any other in `with`.

| App (display name, catalog id) | What it does for this person | Honest caveat | QA |
|---|---|---|---|
| **LibreTranslate** (`libretranslate`), alternative to Google Translate, DeepL | A first-pass draft or a phrase look-up that happens on the Core, which the translator then rewrites or ignores. Not a chat model; no age gate on the tool (the person is an adult in any case). | Language models are downloaded once, then used from the Core. Say nothing about quality, speed, which pairs it covers, or "works offline" (`sec-offline`). Never "translates perfectly". It does not know the client's glossary. | screenshot |
| **Stirling-PDF** (`stirling-pdf`), alternative to Adobe Acrobat, Smallpdf | Merge a client's chapters into one review copy; split a long manual into the files due on different days; compress a file; convert. | The listing says merge, split, compress and convert; claim nothing else. It does not edit the words in a PDF, redact, or sign. Never "redaction is complete". A scanned PDF needs its text read by another app. | screenshot |
| **Solidtime** (`solidtime`), alternative to Toggl Track, Harvest | A timer per project and client, then the hours beside the invoice. | Time tracking only: it does not count words and does not bill anyone ("Solidtime bills the client for you" is the stock never-line). No QA screenshot on origin/main, so a beat that names it needs an entry in `reviewed.json` (rule `app-qa-screenshot`). | none |
| **Invio** (`invio`), alternative to FreshBooks, QuickBooks | Create the invoice for a finished project on the Core. The listing says nothing more than creating and sharing invoices. | The listing says "secure client links" and "in seconds": use neither phrase. Client links only work for people who can reach the Core, and remote access is not claimed, so a client outside the home network cannot open one (`cap-remote-access`, `share a link`). The story ends with the invoice made at the desk, not opened by the client. | screenshot |
| **Joplin Server** (`joplin`), alternative to Evernote | Notes: term lists, a note per client for style decisions, a note per project, synced across the translator's own devices through the Core. | Always "Joplin Server": the server only, the Joplin apps are separate and the person installs one. Web interface only for an agent, so no agent beat. The listing does not mention importing old notes: claim nothing about moving them over. | screenshot |
| **Akaunting** (`akaunting`), alternative to QuickBooks, Xero, FreshBooks | Invoices, expenses, customers and profit and loss for a practice of one. | "Bookkeeping tool. No accounting, tax or legal advice." No payroll, no bank feeds. Do not claim currencies, VAT or sales tax handling: the listing does not. | screenshot |
| **Paperless-ngx** (`paperless`), alternative to Evernote, Google Drive | Scanned style guides, brochures to be translated, received briefs, an archive of finished work, read, tagged and searchable. | Never bare "Paperless". AI features off by default; office document conversion is not wired up, so it holds scans and PDFs, not a translator's `.docx` workspace. | screenshot |
| **Whisper-WebUI** (`whisper-webui`), no registry pairing | A subtitler's first timed text file from a client's audio or video, which the person corrects line by line. The listing also mentions translation and speaker labels: repeat that, not more. | `replaces` is empty, so it carries no `service` and no "alternative to" chip: a pair-less beat (counts against the 20 percent pair-less budget). Model weights download first; CPU unless the host passes a GPU in. Say nothing about speed or accuracy. No QA screenshot, so it needs a `reviewed.json` entry. Only the client's own recording; never covert recording of a person (`cap-camera-capture`). | none |

Two apps beyond the judge's list are proposed for the pool because the job uses them every week. Both are `storySafe: yes` with a screenshot.

| App | Why it belongs | Caveat |
|---|---|---|
| **LibreOffice** (`libreoffice`), alternative to Microsoft Office, Google Workspace | The work is done in a word processor, and the Hub lists the suite. | The listing is generic: name the suite, not features. Do not claim `.docx` or tracked-changes support, which the listing does not make; a client's review cycle often runs on tracked changes in another word processor (persona-bible 3.14), and this is the single most likely objection. One suite per household (LibreOffice or ONLYOFFICE Desktop Editors, not both). |
| **Kokoro** (`kokoro`), no registry pairing | The translator reads a finished translation aloud to hear its rhythm. A tool, not a chat model. | Say nothing about the quality of the voice. Pair-less. |

Considered and left out. **Nextcloud** and **VaultWarden** are at or over the 40 percent cap (12 of 30) and add nothing a translator needs that the pool lacks. **Lingva Translate** scrapes Google Translate, is not local and is `excluded`; **PDFMathTranslate** has Google and Bing backends; **BentoPDF** duplicates Stirling-PDF (one PDF app per home). **Open WebUI** and the other chat apps are not needed; leaving them out also means the age rule 16 never has to be argued for this persona. No translation-memory, terminology, subtitle-editor or CAT-tool app is in the catalog (216 apps checked by keyword; the live store of 579 was not re-read for this chapter).

## 5. Where they spend time

No quotes and no statistics. Kinds of places, all [?].

- **Their own professional bodies.** National and regional translators' associations and their local groups; the members' forums and mailing lists those run; a yearly conference with a hallway of colleagues. Some members are the only translator in their city, so the online room is the office.
- **Freelancer marketplaces and agency vendor portals.** Where jobs are offered and rates are discussed, which they dislike, and where terms such as "who owns the translation memory" are argued over.
- **Subtitlers' and localisation communities.** Forums for people who time subtitles and for people who localise software and games, plus the open-source subtitle tools they share.
- **Terminology and language lovers.** Dictionaries in print, dictionary sites, a linguist's blog, a language-learning forum, an etymology podcast. A good chunk of the media diet is the languages themselves: novels in two languages, films with subtitles on.
- **Offline.** A local library and its reference shelf; a co-working desk or a shared studio with other freelancers; book fairs and festivals of literature in translation; the kitchen table with a printed proof.
- **Platforms where the work gets talked about** include professional-network feeds and a few subreddits for translators, tone mixed [?]. Treat the community as people who trust a peer more than a brand.

## 6. How they talk

Pace 140 to 155 words a minute; sentences of 8 to 16 words, none over 20. Precise and a little dry. They use the nouns of the trade: source text, target text, draft, glossary, term, proof, deadline, style guide, brief, review copy, the chapter. A translator is exact about the difference between "translate" and "interpret" (interpreting is live speech, a different job; it is out of scope here). They enjoy a good word and dislike a loose one.

What turns them off, most to least: any claim that a machine "translates perfectly" or "understands context"; "AI-powered"; "game-changer", "unlock", "effortless"; a promise of time saved; a stock photo of a globe, flags, a speech bubble or a person with a headset; being called a "linguist" when they mean a person who speaks several languages, or the reverse. A pun on "lost in translation" is the one joke the ad never makes.

- "I rewrite every line. The draft only tells me what the first sentence is not." (quote, adult character, disclosed synthetic voice; no claim about the product)

## 7. Comfort with technology and attitude to AI

**Comfort 3 of 5, range 2 to 4** [?, editorial]. Daily user of a word processor with tracked changes, a PDF reader, a spreadsheet for the rate card and file naming that is almost a religion. Many have used a desktop translation-memory program for years, so they understand terms such as segment, match and glossary. Does not edit configuration files. Calls the agency's tech contact, a colleague on the forum, or the partner who set up the router.

**AI stance: the honest range.** The sample is not read, so this is a design range, not a finding.

- **Refuses.** Machine output is what clients use to push rates down [?]; will not touch it, and the story never makes them. The household can still use the Core for the invoice and the archive.
- **Wary and bounded.** Uses a draft for the dull paragraphs of some jobs and not for a literary text; checks every sentence; knows a draft can be wrong in ways a tired eye misses. This is the default voice of the persona.
- **Curious.** Likes to see what a different engine does with a hard sentence, as a prompt for their own version.
- **Openly keen.** Some translators and subtitlers like automation and say so, usually the ones who work in localisation or on subtitle files [?]. The story may cast one, with the same ceiling: a bounded chore, rewritten by hand, and no claim about quality. Nobody in the persona is ashamed of wanting a draft, and nobody is made to defend it.

**Story ceiling.** A draft is one chore, on the translator's own material, rewritten by hand. LibreTranslate is a tool, not a chat model and not an agent. The agent apps (Hermes, OpenClaw) are not part of this persona; if a household's translator has a companion at all, the companion is a separate decision and never the translator's translation. No agent drafts, sends or invoices (`cap-autonomy`). Never "better", "faster", "accurate", "as good as" or "replaces" in a sentence (`cap-parity`). Never AI as the first beat.

## 8. Objections and the honest limits

| Objection a translator would raise | Honest answer |
|---|---|
| "My agency makes me use its own tools on its own server." | Then the Hub is not in that job. The Hub holds the work that is the translator's own: notes, the archive, the invoice, the hours. |
| "Where is my translation memory and my terminology database?" | Not in the Hub. No CAT-tool or translation-memory app is in the catalog. Joplin Server holds notes, Paperless-ngx holds documents; neither is a segment-by-segment tool. |
| "Does it do my language pair?" | Say nothing about which pairs or how well. Language models are downloaded once. The person judges. |
| "Does it keep the layout when it handles a PDF?" | Claim nothing beyond merge, split, compress and convert. |
| "Clients review in tracked changes in Word." | The Hub lists the LibreOffice suite and nothing about file formats or tracked changes. The person tests a client file first, and the story says so. |
| "Can I send the client a link to my invoice?" | Invio's client links only work for people who can reach the Core. Remote access is not claimed. The invoice is made on the Core; how it reaches the client is the translator's own affair. |
| "I bill per word, not per hour." | Solidtime tracks time, not words. A per-word rate stays in the person's own rate card; the hours are for the person's own sense of a project. |
| "A client's contract says the files are confidential." | The story says where the files sit (on the Core, not in a rented drive) and nothing about whether any contract or rule is met. No promise of confidentiality, privilege, secrecy or compliance. |
| "Can I work from a café?" | Remote access is not claimed. Every scene is at home on the home network. |
| "Is the Core my backup?" | No. The Core is not a backup. |
| "Does the subtitler's tool time the lines?" | Whisper-WebUI turns audio or video into subtitles and transcripts; nothing about timing, quality or speed. Weights download first; CPU unless the host passes a GPU in. |

## 9. Claims boundary (what must never be said for this persona)

Ids are `bannedPhrases` in `content/story/claims.json`, unless noted. This list adds to the global ones; it does not replace them.

1. **No certified, sworn, official or notarised translation, and no fitness for legal, medical, financial, immigration or school documents.** `sec-compliance` bans "certified", "compliant", "accredited", "audited"; `legal-claims` bans legal and tax advice and "legally valid". Regulated domains (health, legal, finance, children's data, education records) are written without any compliance, certification, safety or security-guarantee claim and without advice: say only what the app does and where the files live. Do not make the client's document one of those kinds. The stories translate a cookbook, a museum label text, a product manual, a leaflet, a film's subtitles or a novel chapter. A story never shows a contract, a medical report, a school record or an identity document, and never names a client.
2. **Never accuracy, quality, fluency, speed or "context".** `cap-parity`, `num-tokens`, `num-time-saved`: no "accurate translation", no "understands", no "faster than", no "saves hours". A translator's own sentence: "I rewrite every line."
3. **Never that the machine replaces the translator or that the Core translates for the family.** The person is the author of the text that leaves the house.
4. **Never "private", "secure", "safe", "confidential", "offline" or "never leaves" on their own** (`sec-absolute`, `sec-never-leaves`, `sec-offline`, persona-bible 4.1 rule 3). Use "stays on the Core by default", "sits on the Core", "runs on the Core". The LibreTranslate listing says "your words are not sent to a third party": do not repeat it, because it reads as an absolute. A story says only that the draft is made on the Core.
5. **Never remote access** (`cap-remote-access`): no café, train, hotel, airport, "from anywhere", no client opening a link, no phone translating in the street. All scenes are at home, on the home network.
6. **Never multi-user** (`cap-multi-user`): one Core, one household. A shared small office is a later place type; if one is cast, say nothing about separate access, accounts or isolation for the people in it.
7. **Never an agent that sends or bills** (`cap-autonomy`): no "invoices the client for you", no "emails the draft". A person sends their own invoice.
8. **Never a price, a rate per word, a saving or a payback** (`num-dollar`, `num-savings`). A rate card is the translator's own business and is never printed.
9. **Never covert recording** (`cap-camera-capture`): Whisper-WebUI works on a recording the client sent or the person made with consent.
10. **Never a named company doing something to the reader** (`incumbent-attack`). Say what the app does; "an alternative to <Service>" lives in the chip.
11. **Never a testimonial** (`fake-social-proof`): no "I trust it", no "customers", no "translators say". A quote above is a labelled scripted line from a fictional adult.
12. **Never the word "enterprise", and no SSO, team or multi-seat promise.** One household's Core.
13. **Beta line beside any software claim**; "Fictional family. Real software." where a family is; no exclamation mark; no em or en dash; sentence case; daylight only.
14. **Never a flag, a globe, a speech bubble, a national costume or a language shown by an accent.** No stereotype by gender, age, culture or disability; a person is not given this role by reflex.

## 10. Fit: homes, rooms, furniture and casting

**Rooms and anchors** (real ids from `roles.json`; room ids are the schema's `roomRole`).

| | Ids |
|---|---|
| Rooms, in preference order | `office`, `bedroom`, `dining`, `living` |
| Fallback rooms | `kitchen` |
| Anchor roles, in preference order | `desk`, `bookshelf`, `dining-table` |
| Fallback anchors | `couch`, `kitchen-island`, `room` |

`bedroom` is a preferred room because a flat's desk alcove is often in the bedroom; `persona-cover` then allows the beat in either. `desk` resolves to a `writing-desk`, `standing-desk`, `dual-monitor-arm` or `laptop`; `bookshelf` is the shelf of dictionaries; `dining-table` is where a printed proof is spread out; `couch` is where a draft is read aloud. Every chain ends in a universal role, so the validator's anchor check holds in any home. Overlay props to author (not in the 226 item types): paper dictionaries, a printed proof with pencil marks, headphones, a tray of loose pages. The Core appears once, on a shelf, last, as a stylised drawing.

**Homes that suit** (from the specs in `content/houses/`, desk or shelf in a room that can be a study; the casting is the owner's call, and a household still covers two or more archetypes):

- *Houses.* Aurora (Study with desk and shelf), Sunny Home (Upper Landing: desk and shelf), Palm Knoll (Study desk, Undercroft shelves), The Palms (Stair Study desk), Newcrest House (Loft: desk and couch), Lake Cabin (Study shelf), Vanilla House (a desk in Bedroom Three).
- *Apartments* (in the bible's casting, not yet in `content/houses/`): City One-Bedroom (Desk Nook), Two-Bedroom Flat (Study Alcove), Garden Flat (Study), Walk-up Duplex (Study Landing desk), Warehouse Loft (Desk and Workshop). These are the most natural: a translator's trade fits a nook.
- *Offices (later type).* A shared small office is plausible for a translator renting a desk. Treat it as one Core for one small team: no company, no "enterprise", no promise about who sees what.
- *Avoid.* Modern Pavilion, Grey Starter Cottage and Flowery Cottage (no desk or shelf item in any room) unless the dining table carries the beat; any beat set in a child's room.

**Households.** Solo, couple, a young family (baby asleep or a toddler out of shot), a family of older teens, grandparents. A translator is fine in all five; the retired translator with occasional jobs suits the grandparents household.

**Casting warning against stereotype.**

- The translator is never cast because of a name, an accent or a look. Do not tie the language pair to the person's name, the home's décor, a flag on the wall or a dish on the table. A person with a surname that signals one language can translate between two others, and a person with a common local surname can work in a language they learned as an adult.
- A child is never the family's translator or interpreter, and a bilingual teen is never made the household's go-between. No member under 16 uses a chat model or an agent, and none is needed here.
- No gender, age or disability makes the role. A man, a woman or a person the cast does not label can be the translator; a person of 62 or 26 can; a person who is deaf, blind or has a long-term condition is not "a translator because". Do not make a disability the occasion of a beat.
- Pair the translator with a different archetype (a builder, a host, a creative, a business-owner) and give the other person the beat that does not involve language. Never pair two translators in one household unless the home has two desks and the story needs it.
- An accent in the narration voice is never used to signal the language pair. The narrator is the house voice.

## 11. Ten user stories

Format: "As a translator, I want ... so that ..." (no name). Each is tied to one catalog app and one registry service, with the catalog caveat and a one-line story moment (room, anchor role, what happens first). Every moment is a house-beat seed for the writer; the beat's own member, title, body and chips come from the writer and the validator. All ten pass the app and service checks listed at the end of this file. Pair-less apps (Whisper-WebUI, Kokoro) are in section 4; the ten below are all pairs, which is the 80 percent rule's side of the budget.

| # | User story | App (id) | Service (id) | Caveat that rides along | Moment: room, anchor, what happens first |
|---|---|---|---|---|---|
| 1 | As a translator, I want a rough draft of a dull paragraph made on my own Core so that I can rewrite it by hand without pasting a client's text into a website. | LibreTranslate (`libretranslate`) | Google Translate (`google-translate`) | Models are downloaded once. Nothing about quality, speed or which pairs. The person rewrites every line. | `office`, `desk`: a printed source page beside the laptop; the first thing on screen is a draft, and the pencil crosses out its opening sentence. |
| 2 | As a translator, I want a second draft of one hard sentence, made on my own Core, so that I have another version in front of me before I write mine. | LibreTranslate (`libretranslate`) | DeepL (`deepl`) | Same caveat. A prompt for the person's own sentence, never a check of correctness or a claim about the result. | `dining`, `dining-table`: a printed proof spread across the table; a hand points at one hard sentence, the laptop open to a single line. |
| 3 | As a translator, I want to merge a client's corrected chapters into a single review copy so that one file goes out instead of five. | Stirling-PDF (`stirling-pdf`) | Adobe Acrobat (`adobe-acrobat`) | Merge, split, compress, convert only. No editing, redaction or signing. | `office`, `desk`: five loose PDFs become one; the first thing is the single file's name, typed by hand. |
| 4 | As a translator, I want to split a long manual into the chapters due on different days so that each chapter is a file named for its deadline. | Stirling-PDF (`stirling-pdf`) | Smallpdf (`smallpdf`) | Same. A scanned manual needs its text read first. | `bedroom`, `desk`: a flat's desk alcove; a calendar page and the manual side by side, then the first split file appears. |
| 5 | As a translator, I want a timer for each project so that I can see which kinds of job take most of my week. | Solidtime (`solidtime`) | Toggl Track (`toggl-track`) | Time only, not words; does not bill anyone. Needs a `reviewed.json` entry (no QA screenshot). | `office`, `desk`: the timer is started as the pencil comes down; the first thing is the project's name on a sticky note. |
| 6 | As a translator who also subtitles, I want the hours for each client kept beside the project so that I can plan the next project's week from what the last one took. | Solidtime (`solidtime`) | Harvest (`harvest`) | Same. Write Harvest in the chip, not at a sentence start. | `living`, `couch`: a draft of subtitles read aloud from the couch; the hours for the client's last job are on the laptop beside the cup. |
| 7 | As a translator, I want to write the invoice for a finished project at my desk so that it is made on my own Core and not in a rented account. | Invio (`invio`) | FreshBooks (`freshbooks`) | Client links only work for people who can reach the Core; the story ends with the invoice made, not opened. Do not say "in seconds". | `office`, `desk`: the project's last file is closed; the first thing is the client's name typed into the invoice, then the invoice saved. |
| 8 | As a translator with a handful of regular clients, I want invoices and expenses in one set of books so that I can see the year's money together on a Friday afternoon. | Akaunting (`akaunting`) | QuickBooks (`quickbooks`) | Bookkeeping only. No tax or accounting advice; no currency or tax-handling claim; no bank feeds. | `dining`, `dining-table`: receipts for a dictionary and a monitor beside the laptop; the first thing is the receipts, then the year's total. |
| 9 | As a translator, I want term lists and a note on each client's style in one place that follows me across my devices so that last year's decision is a search away. | Joplin Server (`joplin`) | Evernote (`evernote`) | Joplin Server only; the Joplin apps are separate. No agent. | `office`, `bookshelf`: a paper dictionary open on the shelf; the first thing is the person's own hand opening a note with a term and the reason beside it. |
| 10 | As a translator, I want scanned style guides and received briefs in one searchable archive so that I find a client's preferred spelling by a single word. | Paperless-ngx (`paperless`) | Google Drive (`google-drive`) | Never bare "Paperless". AI features off by default; scans and PDFs only. | `office`, `bookshelf` (fallback `desk`): a loose stack of scans on the shelf; the first thing is one page going into the tray. |

## 12. Six beat seeds

Each is the first sentence a visitor reads: one pointed line on what the rented service held or did to the workflow, and what the family's own copy does. Sentence case, no dash, no digits, at most 20 words, no company named in the sentence (the chip carries "alternative to <Service>"). `{name}` is the member's first name from the cast; pronouns are avoided so no gender is implied.

1. LibreTranslate, alternative to Google Translate. "{name} used to paste dull paragraphs into a web translator; LibreTranslate drafts them on the Core."
2. Stirling-PDF, alternative to Smallpdf. "The client's PDF went up to an online converter to be split; Stirling-PDF splits it on the Core."
3. Solidtime, alternative to Toggl Track. "A timer app kept every project's hours in a rented account; Solidtime keeps them on the Core, client by client."
4. Invio, alternative to FreshBooks. "Every invoice was made in a rented account; Invio makes them on the Core."
5. Joplin Server, alternative to Evernote. "Years of term notes sat in a rented notes account; Joplin Server keeps notes on the Core."
6. Paperless-ngx, alternative to Google Drive. "Client style guides piled up in a rented drive as scans; Paperless-ngx reads and tags every page on the Core."

Each seed is a single claim about the workflow, not about a company; the chip names the service. Seed 1 and seed 2 describe where the translator worked before; they say nothing about what any business does and accuse no one. Check seeds against `check-copy` and the validator's `detail-replaces` before they become a beat's `detail`.

## 13. Open items for the owner

- **Wiring.** Adding the persona means: a `translator` value in the schema enum and `ARCHETYPES` (a test keeps schema, constant and `personas.json` equal); the row below in `content/story/personas.json`; an entry in `PERSONAS` in `scripts/portal-front.mts` (`{ archetype: 'translator', filter: 'Work from home' }` would put it in the same chip as the organiser, or a new chip "Translate" if the owner prefers a distinct filter); a chapter in the persona bible and the app table in `persona-apps.md`; and a place in `cast-plan.json`. None was done here.
- **`reviewed.json`.** Solidtime and Whisper-WebUI have no QA screenshot; a beat that names either needs an owner entry.
- **Pair-less budget.** Whisper-WebUI and Kokoro have no `replaces`; use them sparingly, since pair-less room beats are capped at 20 percent (`pair-budget`).
- **Sources.** Section 5 to 7 are inference. Before a chapter in the persona bible, read the primary sources (a translators' association survey, a subtitlers' guide) and tag them [V] or [S].
- **Language pair.** Never fixed by this file. The cast step decides it, and the story does not name it.

---

## personas.json row

Same fields as the existing rows in `content/story/personas.json` (`label`, `description`, `example`, `rooms`, `fallbackRooms`, `anchorRoles`, `fallbackAnchorRoles`, `apps`), keyed by the archetype id. The app order puts the apps with a registry pair first and the pair-less apps last; `nextcloud` and `vaultwarden` are left out on purpose (at the 40 percent cap, section 4).

```json
{
  "translator": {
    "label": "Translator",
    "description": "A freelance translator or subtitler: the draft, the notes and the client's PDFs sit on the Core, and every line is rewritten by hand.",
    "example": "Noa",
    "rooms": ["office", "bedroom", "dining", "living"],
    "fallbackRooms": ["kitchen"],
    "anchorRoles": ["desk", "bookshelf", "dining-table"],
    "fallbackAnchorRoles": ["couch", "kitchen-island", "room"],
    "apps": [
      "libretranslate",
      "stirling-pdf",
      "solidtime",
      "invio",
      "joplin",
      "akaunting",
      "paperless",
      "libreoffice",
      "whisper-webui",
      "kokoro"
    ]
  }
}
```

## Verification run

A read-only script (kept in the session scratchpad, not in the repo) checked this file on 2026-10-20 and passed:

- All ten pool apps are in `catalog-apps.json`, `inLiveStore: true`, `storySafe` `yes` except Whisper-WebUI (`with-caveat`). None is `avoid`. Solidtime and Whisper-WebUI have `qa: no-screenshot`.
- All eleven services exist in `services.json` with no `stale` or `story-excluded` flag and `alternativeToForm: ok`. Harvest carries `ordinary-word`.
- All ten story pairs are valid: the app is in the service's `apps` and `storyApps`, and the service's name is in the app's catalog `replaces` (the `service-app` rule).
- Rooms are in the schema's `roomRole` enum and anchor roles in its `roleId` enum, both present in `roles.json`.
- Six seeds, each at most 20 words, no digit, and none matches an error pattern in `claims.json` `bannedPhrases`; the ten story rows match none either. No em or en dash, double hyphen, exclamation mark or emoji anywhere in this file.
