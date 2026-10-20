# The Persona Bible

Reference book for improving the shots and scripts of the 36 virtual homes. Fourteen personas, researched read-only on 2026-10-19 for Companion Intelligence. Companion OS, Companion Agents and Companion Memory are in beta. Data twin: `persona-bible.json`.

## 0. How to use this book

**Who reads what.** Writers: chapter 3 (Talk, Scripts) and section 4. Cinematographers: chapter 3 (Home fit, Shots), table 2.3 and section 4. Casting and schema: section 5. The owner: sections 1, 5.3 and 6. Everyone: this section and Appendix B first.

**Evidence key.** Every real-world claim carries a tag; sources, with read date 2026-10-19, are in Appendix A. **[V]** verified in a page we read. **[S]** secondary source, survey summary or aggregator. **[?]** inference or lived-experience generalisation: never present it as fact. Vendors survey their own customers, so read their totals as upper bounds. How a persona talks, what they own and what they roll their eyes at are editorial syntheses of the communities and media they read [?] unless tagged.

**Skeptic pass (2026-10-19).** An independent check of 62 factual claims against the pages, the Hub app tables against the live store, and every sample line against `claims.json` changed this book: the changes are listed in the skeptic file `skeptic.md`. In short: one statistic that no cited page carries was removed (partners and children using Home Assistant directly), eight readings or dates were corrected, the 26 cited addresses that do not answer 200 today are counted in Appendix A and listed in `skeptic.md`, five sample lines that implied a gender, a speed, pupil data on a home Core or pupils reaching the Core from outside were rewritten, and gendered or age-based generalisations were replaced by ranges.

**Archetype versus fact.** Nobody here is a customer. Ages, names, homes, jobs and sample lines are design choices for fictional characters; only tagged statements describe the world. Attitudes are ranges and each chapter says what varies (age, country, firm size). Nothing is medical, legal or financial advice, and no app is claimed to make anyone compliant with any rule.

**Lanes of copy.** Popup title: six words or fewer, no digits. Popup body: 30 words or fewer, ends with a full stop. Agent `say` line: 16 words or fewer, spoken only by a member with a companion, never a child (and, in this book, never a teen). Silent ad cuts burn the body in as captions at 150 words a minute. Appendix B tags each line as caption (third person) or quote (first person, an adult character, a disclosed synthetic voice).

**Fixed by the contract.** "Fictional family. Real software." in the first two seconds and on the end card; the beta line beside any software claim; no app screens, no prices; the call to action is See Companion Core at ci.computer/core; the chip row is the app name, then "replaces <X>" from the app's own list; one household, one Core; remote access is not claimed.

**Where the researchers disagreed, this book rules.** Precedence: the contract and validator over a researcher's preference, a primary source over a summary. Open items are in section 6.

| Topic | Ruling |
|---|---|
| Minors speaking. | The gamer file voices Steve (16); three files say children never speak. The contract (rule 6) and the validator (`say`) side with the three. Steve's lines are now third-person captions. |
| VaultWarden naming. | Two files say "never say Bitwarden"; the validator allows exactly "the Bitwarden apps" and "Bitwarden-compatible". Use those phrases. |
| Docuseal spelling. | Files write DocuSeal; the store and catalog name is Docuseal. On-screen text follows the catalog. |
| Open WebUI chip versus cap-parity. | The validator skips chips that start with "replaces ", so "replaces ChatGPT" is allowed as a chip and still fails in a sentence. Creative's "keep it off the chip" is a taste rule, kept for Creative, Maker and Journalist. |
| Pace. | Bands run 125 to 165 wpm, none measured on the audience [?]. The house voice is fixed at 150 wpm (claims.json); pace is therefore sentence length and pauses. |
| Word budgets. | Researchers allowed 24 to 37 words for 15 seconds. After a 2-second label and 3.5-second end card, 27 words fit (20 s: 40; 30 s: 62). Over-budget lines were trimmed. |
| Store size. | Disk store 579 apps, live store 580 on 2026-10-19. All 89 persona app ids are live; four are not in the story catalog (Hoppscotch, IT-Tools, Woodpecker CI, Fireshare). |
| Screenshot flags. | The per-app flags in the twin (`hasLogo`, `hasRealScreenshot`) read `app-media.json`, the file the engine renders from: 54 of the 89 apps have a logo there and 13 a cleared screenshot. The marketplace review (`w7/market-m1..m7`) is recorded beside them as `marketReview`: it holds a logo file for 86 and vets the QA screenshot of 29. The two sources differ because app-media is rewritten as apps are cleared; re-read it at shoot time. |
| Placeholder names. | Maya, Imani, Dara, Marek, Odile and Hana are placeholders; Maya is on the avoid list and Hana is cast. The book uses recast members' names and proposes fresh ones for the apartments. |
| Reddit counts. | r/smallbusiness is 1.8M in one file and 2.6M in another; both come from aggregators because Reddit refused every read. Not quoted as fact. |
| Maker versus Creative. | Ravi, Kian, Malia and Valeria are working sellers. Maker stays the hobbyist keeper (Bruk, Haruo, the children). |
| Organiser, Business Owner, Host. | Organiser: household records and a practice of one. Business Owner: premises, staff, books. Host: the family's logistics. Sally's desk, the Host's fridge door. |
| Chip grammar. | The contract says "replaces <X>"; the bring-home map and story v3 D5 say "alternative to <X>". Chips here use today's form; prose says "an alternative to". |

## 1. The fourteen at a glance

Comfort runs 1 (needs everything set up) to 5 (runs servers). Pace is editorial, scripted to the 150 wpm house voice. Home ids are crew-only; print display names (5.2).

**1.1 Who they are**

| # | Persona | What they do | Comfort | AI stance; pride | Pace | Top three Hub apps | Best homes |
|---|---|---|---|---|---|---|---|
| 1 | The Organiser `organiser` | Household records and a practice of one | 3 (2 to 4) | pragmatic; quiet, not proud in public | 140 to 150 wpm | Paperless-ngx, Nextcloud, Companion Planning | bgfamily, familyhouse-nora, seraphine |
| 2 | The Builder `builder` | Software engineer; brings home his own repositories | 4 (3 to 5) | pragmatic; conflicted | 150 to 165 wpm | Forgejo, Code Server, Ollama | aurora, seraphine, palms |
| 3 | The Gamer `gamer` | Teen who plays most days with school friends | 3 (2 to 4) | split; quiet | 150 to 165 wpm | Steam Headless, Jellyfin, Immich | familyhouse-nora, bgfamily, mediterranean |
| 4 | The Learner `learner` | Student on a school login; study chores at home | 2 (2 to 4) | split; proud of the right use, not of the tool | 150 to 165 wpm in an adult voice | Open WebUI, Kiwix, LibreTranslate | seraphine, familyhouse-nora, epiphany |
| 5 | The Maker `maker` | Hobbyist who makes and keeps the family archive | 3 (2 to 4) | split; conflicted about being seen to want it | 125 to 145 wpm | Immich, Obsidian, Navidrome | mirage, riverbend |
| 6 | The Host `host` | Runs the house: meals, plants, calendar, guests | 2 (1 to 4) | split; conflicted, quiet; a kitchen tool she does not announce | 140 to 155 wpm | KitchenOwl, Mealie, Immich | vanilla, riverbend, garden-flat |
| 7 | The Tech Family `tech-family` (new) | Household lead who runs the network; the family is the test | 4 (lead 4 to 5; partner 2 to 3; teen 3 to 5) | split; proud only of a model they host and can switch off | 150 wpm house narrator | Home Assistant, Pi-hole, Forgejo | cocoon, epiphany, neweco |
| 8 | The Business Owner `business-owner` (new) | Runs a shop, studio or practice of up to fifteen | 2 (1 to 4) | pragmatic; conflicted | 150 wpm | Nextcloud, Invoice Ninja, Paperless-ngx | corner-penthouse, city-one-bed, sunnyhome |
| 9 | The Creative `creative` (new) | Working designer, photographer, filmmaker or musician | 3 (2 to 4) | split; conflicted | 135 to 145 wpm | Immich, Nextcloud, Penpot | payorote, flowerycottage, studio-loft |
| 10 | The Contractor `contractor` (new) | Self-employed tradesperson, firm run from the garage | 3 (2 to 4) | pragmatic; not proud, not hiding | 135 to 145 wpm | Invoice Ninja, Immich, HomeBox | riverbend, flowerycottage, asymmetry |
| 11 | The Marketer `marketer` (new) | Digital marketer holding a client's list and briefs | 3 (2 to 4) | pragmatic; pleased in private, wary of the tell | 150 wpm | Open WebUI, Companion Memory, Nextcloud | studio-loft, two-bed-flat, newcrest |
| 12 | The Lawyer `lawyer` (new) | Solo or small-firm attorney guarding client files | 3 (2 to 4) | split; conflicted | 140 to 150 wpm | Paperless-ngx, Nextcloud, Docuseal | aurora, corner-penthouse, garden-flat |
| 13 | The Journalist `journalist` (new) | Reporter holding tapes, notes and records | 3 (2 to 4) | split; conflicted | 145 to 155 wpm | Whisper-WebUI, Paperless-ngx, Obsidian | lakecabin, city-one-bed, two-bed-flat |
| 14 | The Educator `educator` (new) | Teacher, tutor or homeschooling parent | 3 (2 to 4) | pragmatic; conflicted | 140 to 150 wpm | Open WebUI, Paperless-ngx, Nextcloud | mediterranean, bghouse-olcia, walkup-duplex |

**1.2 How each talks**

| Persona | Tone | Pace feel | Sentence length (words) | Humour | Owns (jargon) | Eye-rolls |
|---|---|---|---|---|---|---|
| Organiser | brisk, practical, a little dry | even; a pause at each full stop | 8 to 14, then a fragment | dry, about paper | deliverable, scope, retainer, net 30 | self-hosted, container, LLM |
| Builder | deadpan, exact, like a bug report | quick; a beat after each | 5 to 12, fragments | aimed at himself (YAML) | repo, diff, rebase, compose file | AI-powered, supercharge, 10x |
| Gamer | dry, quick, hates being sold to | clipped; half a second after the limit | 5 to 12 | deadpan about his habits | session, queue, lobby, patch, clip | homelab, frame rate, level up |
| Learner | fast, dry, sarcastic; polite to teachers | adult voice at 150 | 3 to 9 peer; 8 to 14 explaining | self-mocking about stress | revision, mark scheme, set text | edtech, ace your exams |
| Maker | modest, process-first | slow; a full beat between thoughts | 6 to 14 | light, rarely about themselves | RAW, XMP, stems, gesso, cull | content creator, unlock, NAS |
| Host | warm, brisk, dry, list rhythm | steady list beats | 6 to 12 | domestic, self-aware | meal plan, batch cooking, carpool | self-hosted, SSO, LLM |
| Tech Family | dry, specific, understated | 150; hold on each proper noun | 8 to 14, one fact each | deadpan, in-group | DNS, allow list, commit, scene, restore | AI-powered, plug and play |
| Business Owner | short dry bursts; warm with clients | 150; half a second after each | 10 to 12, ceiling 20 | half-smile at renewal day | cash flow, margin, net 30, no-show | stack, SaaS, data sovereignty |
| Creative | dry, specific, a little wary | unhurried; pause after each sentence | 9 to 12, none over 20 | self-deprecating about clients | brief, proof, NDA, embargoed | private, secure, easy |
| Contractor | plain, dry, unhurried | slow; 0.4 s after each key noun | 6 to 12, average nine | wry about paperwork | quote, change order, snag list | workflow, ecosystem, stack |
| Marketer | shorthand, dry one-beat jokes | 150; leave silence | 6 to 12 | one beat, about the job | CTR, deliverability, UTM, flows | synergy, thought leader, 10x |
| Lawyer | precise, dry, guarded | 140 to 150; silence before the limit | 8 to 16, none over 20 | understated; allergic to promises | matter, engagement letter, redline | game-changer, supercharge, disrupt |
| Journalist | dry, plain, evidence first | newsreader; pause before a number | 8 to 14, cap 20 | an understated aside; no puns | source, on the record, tape, verify | game-changer, unlock, bulletproof |
| Educator | dry, practical; humour dark about workload | 140 to 150; a beat after each | 8 to 14, never past 20 | gallows; protective of children | scheme of work, rubric, exit ticket | digital natives, saves you hours |

## 2. Cross-persona tables

**2.1 Technology comfort, ranked**

| Persona | Score | Range | Evidence basis | Who they call |
|---|---|---|---|---|
| Builder | 4 | 3 to 5 | 71.1% run a VPN, 66.6% a reverse proxy, 86.2% avoid a mail server [V, selfh.st 2025] | No one; the family calls him |
| Tech Family | 4 | lead 4 to 5 | Setup person 94.4% men; partners and children mostly use the devices, not Home Assistant itself [V, HA survey post] | The forum; the partner calls the lead |
| Organiser | 3 | 2 to 4 | About half rely on the owner or an untrained staff member for IT security: a vendor study (Guardz and Techaisle 2025) read only as a search summary, no page [?] | Partner, vendor chat, IT contractor |
| Gamer | 3 | 2 to 4 | 73% console, 70% phone, 49% computer [V, Pew]; skill [?] | The household builder, a video |
| Maker | 3 | 2 to 4 | Selfh.st crowd is 3,227 of 4,005 in technology: not this person [V] | A friend, the club, a forum |
| Creative | 3 | 2 to 4 | Colourist hardware forums show a gear culture [V]; the rest [?] | A forum thread, the partner |
| Contractor | 3 | 2 to 4 | Smaller firms adopt new technology less [V, HIRI] | Partner, nephew, vendor phone line |
| Marketer | 3 | 2 to 4 | No survey on admin skill [?] | Vendor chat, a peer Slack |
| Lawyer | 3 | 2 to 4 | 65% of solos use cloud tools, 94% of firms of 50 or more [S] | Vendor support, managed IT |
| Journalist | 3 | 2 to 4 | About 4% of newsroom staff are tech professionals [V, ICFJ 2019 global survey] | Newsroom IT, a colleague |
| Educator | 3 | 2 to 4 | Moves with subject more than age [?] | School IT ticket, the colleague |
| Learner | 2 | 2 to 4 | Installs from a tile; judging a model's answer is a skill taught, not assumed [?] | A parent, a friend, YouTube |
| Host | 2 | 1 to 4 | No survey of household managers [?]; for scale, 97% of adults 18 to 29 and 79% of those 65 and over own a smartphone [V, Pew 2026] | The household tech person |
| Business Owner | 2 | 1 to 4 | 99% use a platform at work, yet use is not admin skill [V, Chamber] | Partner, IT contractor, bookkeeper |

Only the builder and tech-family scores rest on survey data about the audience; the rest are editorial judgements anchored on the capability lists in each chapter. The selfh.st and Home Assistant surveys describe who answers surveys, not the population.

**2.2 AI stance, ranked from most to least forward in a story**

No survey measures pride in wanting AI for any of the fourteen, so every pride label here is a design choice [?], not a finding. Use is high in most groups and trust is conditional; inside every group opinion runs from open enthusiasm to refusal, and the ranges below say what varies. The stance is shown through the ceiling for how far a story may go.

| Persona | Label | Story ceiling | Evidence |
|---|---|---|---|
| Builder | pragmatic | Named, checkable chore; reads the diff | JetBrains 2025: 85% use AI regularly; Stack Overflow 2025: 2.7% highly trust, 46% distrust [V] |
| Tech Family | split | Optional third beat; not the partner's | Jellyfin bans LLM-written text in its issues, pull requests and forum posts; Home Assistant ships an Ollama agent, optional [V] |
| Contractor | pragmatic | One admin chore from site notes | Housecall Pro 2026: 48% of 248 pros [V, vendor]; UK trades: 4.8% [V] |
| Marketer | pragmatic | One chore on the client's material | HubSpot 2026: 86.4% of teams [V]; Klaviyo: 31% always tell colleagues [V] |
| Business Owner | pragmatic | Second beat, never the hook | Chamber 66% vs Census 17 to 20%: a sampling artefact [V] |
| Organiser | pragmatic | Chore she approves; beta in the scene | Pew 2026: 50% of men, 47% of women have ever used a chatbot (the gap has closed); HBS found a 25% adoption gap in earlier studies [V] |
| Lawyer | split | One checkable chore; never the headline | ABA solos 18% vs Clio solos 71% [S]; 2,202 hallucination decisions, 872 with lawyers [V] |
| Host | split | One household chore; she approves | 79% of parents use AI [V, Menlo]; 81% for parenting tasks [V, Lurie] |
| Educator | pragmatic | Own materials, rewritten; never push | Gallup 2025: 60% used AI, 40% favour, 28% oppose [V] |
| Journalist | split | Bounded chore on own material, verified | Muck Rack 2026: 82% [S]; Reuters Institute 2026: 97% of news leaders rate back-end automation (transcription, copyediting aids, metadata) important [V] |
| Learner | split | Study chore the school accepts | Pew: 54% of teens for schoolwork; HEPI 2026: 94% of UK undergraduates use it for assessed work [V] |
| Gamer | split | One homework chore; never in a game | Pew: 54% for schoolwork [V]; Steam poll 31% negative on AI disclosure [S] |
| Creative | split | Chore only; may be absent | 99% of 378 visual artists dislike generative AI [V]; Adobe: 40% embarrassed [S, vendor] |
| Maker | split | Chore-doer only; lead with files | Same 99% [V]; 82% of producers oppose full-song generation [S] |

**2.2b What varies, by persona**

Ranges the stance labels above rest on. Vendors survey their own customers: read their totals as upper bounds.

| Persona | Range and what varies |
|---|---|
| Organiser | Pew 2026: 49% of US adults have ever used a chatbot (50% of men, 47% of women); HBS: a 25% adoption gap across 18 earlier studies. Varies with gender less than it used to, with client confidentiality rules and with age [V]. |
| Builder | 85% regularly use AI tools (JetBrains 2025) yet 46% distrust their accuracy and 33% trust it (Stack Overflow 2025); experienced developers show the lowest "highly trust" rate, 2.6%. Pride runs from advocate to refuser; varies with seniority and employer policy [V]. |
| Gamer | Pew 2026: 54% of US teens used a chatbot for schoolwork. A Steam poll found 31% negative on AI disclosure in games [S]. Varies with age and school rules. |
| Learner | Pew 2026: 54% of teens for schoolwork; HEPI 2026: 94% of UK undergraduates use it for assessed work, and 53% (HEPI 2025) are put off by the risk of an accusation. Varies with age, school and exam-board rules [V]. |
| Maker | 99% of 378 verified visual artists dislike generative AI and 85% never use it in their work (skews against AI by design); 82% of producers oppose full-song generation [V, S]. Varies by discipline: musicians and producers use it more. |
| Host | Menlo 2025: 79% of parents have used AI against 54% of non-parents [V]. Varies with whether there are children at home and with age. |
| Tech Family | Home Assistant ships an optional Ollama agent; Jellyfin bans LLM-written text in its issues and forum posts [V]. The same household can hold both views. Varies by member: lead, partner, teen. |
| Business Owner | US Chamber 2026: 66% of small businesses use AI; Census: 17 to 20% of all firms [V]. The spread is who is counted, not a stance. Varies with firm size and sector. |
| Creative | 99% of 378 visual artists dislike generative AI (skews against); Adobe's own survey: 99% use it somewhere and 40% feel embarrassed [S, vendor]. Varies by discipline and by client contract. |
| Contractor | Housecall Pro 2026: 48% of 248 customers use AI [V, vendor]; a UK trades survey: 4.8% [V, sample not stated]. A tenfold spread, so neither is a norm. Varies with firm size and country. |
| Marketer | HubSpot 2026: 86.4% of teams use AI; Klaviyo: 31% always tell colleagues, 43% often, 22% sometimes, 3% never [V]. Varies with client contracts and agency or in-house. |
| Lawyer | ABA: 18% of solos use AI, Clio: 71% [S]: a spread of surveys, not a stance. Clio UK and Ireland 2026: 7% of clients recall being told [V, vendor]. Varies with firm size, jurisdiction and client clauses. |
| Journalist | Muck Rack 2026: 82% use at least one AI tool [S]; Reuters Institute: 89% of 1,004 UK journalists use one monthly [V]; a NewsGuild arbitration found AI tools launched without notice breached a contract [V]. Varies with newsroom policy. |
| Educator | Gallup 2025: 60% of US teachers have used AI for work, 40% favour AI in schools, 28% oppose, 19% work in a school with a policy [V]. Varies with subject, school policy and country. |

**2.3 Where they hang out: the twenty places that matter**

| Place | Who is there | What it is like | How to speak there |
|---|---|---|---|
| r/selfhosted, Lemmy c/selfhosted, awesome-selfhosted | Bld, TF, Mkr, BO | Civil; Lemmy needs a 30-day-old account to promote [V]; Reddit unread [S] | Nouns, a table of limits; disclose we are the vendor |
| Hacker News, Lobsters | Bld | Kindness rule, no sneering; Show HN rejects landing pages [V] | One falsifiable sentence; no superlatives |
| Home Assistant Community, Pi-hole Discourse | TF, Hst | Patient, with unsupported-use disclaimers; spouse approval a theme [V] | State the limit as plainly as the claim |
| r/smallbusiness, Alignable, Shopify Community | BO, Org, Con | Blunt, anecdotal; r/smallbusiness bans promotion [S] | Name the job, skip the pitch; never post as a user |
| Trade subreddits, Mike Holt's Forum | Con | Candid, funny, safety-aware [S/V] | Short, sayable at the tailgate |
| LinkedIn | Org, Mkt, Jou | Expertise performed [?]; most trusted by 58% of journalists [S] | The one place a calm adult ad is normal |
| Mumsnet, Fairygodboss, Fair Play | Org, Hst | UK casual, supportive [V] | Warm, brisk; no mum guilt |
| School and family group chats; ParentSquare | Org, Hst, Lrn | School-chosen; logistics [V/?] | Not ours; assume muted video |
| YouTube | Gmr, Lrn, Con, Cre, Mkr, Bld, TF | Creator-led, ad-aware; about 9 in 10 US teens [V] | Hook inside two seconds; captions on |
| Discord (friend, study, Ollama, LinuxServer rooms) | Gmr, Lrn, Bld, TF | Fast, loose; support rooms paste logs [S/?] | Do not brand there; adults only |
| TikTok and Snapchat | Gmr, Lrn | Clipped, deadpan; Snapchat 55% of US teens [V] | Check under-18 targeting policy first [?] |
| Lawyerist, Legal Talk Network, Above the Law | Law | Practical, irreverent, measured [V] | Exact; no promises; file location first |
| IRE and NICAR-L, ONA, Freedom of the Press Foundation | Jou | Grassroots tool-sharing; not alarmist [V] | Plain; no source-protection claim |
| r/Teachers, Truth for Teachers, Tes, Teacher Tapp | Edu | Candid, no hype [S/V] | The school keeps the gradebook; never push AI |
| Lift Gamma Gain, Fstoppers, Graphic Artists Guild, Cara | Cre, Mkr | Critique and advocacy; Cara refuses AI portfolios [V] | Files first, model last; no vendor-bashing |
| Superpath, Measure, Demand Curve, Marketing Brew | Mkt | Professional, joking [V] | Craft before product; no tricks |
| The kitchen table, counter and dining table | Org, Hst, Edu, Lrn, Jou, Mkt, Law | Where the paper lives [?] | Our stage: hands, paper, window light |
| The garage bench and the hall shelf | Con, TF | Where the day ends [?] | Our stage: labels, tools on hooks, router beside the Core |
| The accountant's or bookkeeper's office | Org, BO, Con | Source of "my accountant uses QuickBooks" [?] | Answer in the film: one job at a time |
| Trade shows: FOSDEM, NAB, ABA TECHSHOW, NICAR, Bett, BrightonSEO, IBS, BNI | Bld, TF, Cre, Law, Jou, Edu, Mkt, Con, BO | Dates read from event pages [V] | A demo and a limit, not a slogan |

**2.4 The Hub app matrix**

Rows are the apps useful to three or more personas; cells name the persona's job. `Now` is homes using the app in the 30 families today (cap 12). PARTIAL marks a partial replacement. The service replaced is the store's own `replaces` list.

| App | Replaces | Now | Org | Bld | Gmr | Lrn | Mkr | Hst | TF | BO | Cre | Con | Mkt | Law | Jou | Edu | Flag |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| VaultWarden | LastPass, 1Password | 12 at cap | household | keys | Valve login |  |  | Wi-Fi | house vault | shared logins | licence keys | shared logins | client logins | firm logins | accounts | edtech logins | Say "the Bitwarden apps" |
| Open WebUI | ChatGPT, Claude | 17 over | own documents | chat | homework step | explain a step | chores |  | ask the house |  | brief read-back | site notes | client brief | first summary | which page | report comments | Never parity or a key |
| Nextcloud | Google Drive, Dropbox | 12 at cap | client files |  |  |  |  |  | family files | client folders | studio folders | job folders | deliverables | client folders | drafts | lesson folders | PARTIAL: no outside sharing |
| Paperless-ngx | Evernote, Google Drive | 17 over | receipts, forms |  |  |  |  | school forms | paperwork | receipts |  | permits |  | file archive | records | handouts, blank forms | PARTIAL: scans and PDFs |
| Whisper-WebUI | none listed | 0 | call notes |  |  | lectures | memos |  |  | minutes | subtitles |  | call text | dictation | interview tape |  | No alternative listed; CPU |
| Stirling-PDF | Adobe Acrobat, Smallpdf | 7 | merge, shrink |  |  | merge |  |  |  | tidy |  | permit packs |  | exhibits | received PDFs | redact | Never "redaction is complete" |
| LibreOffice | Microsoft Office, Google Workspace | 7 | client .docx |  |  | essay |  |  |  | price lists |  |  |  | drafting | drafts | worksheets | PARTIAL: layout, macros |
| Twenty | Salesforce | 4 | prospects |  |  |  |  |  |  | customer list | pipeline | leads | leads | referrers |  |  | PARTIAL: Salesforce only |
| Companion Memory | none listed | 5 (first party) | her context |  |  | own notes |  |  |  | context |  |  | client context | across files | search by meaning |  | Beta; first party |
| Immich | Google Photos, iCloud Photos | 19 over |  |  | phone full |  | archive | family album | photos |  | shoots | site photos |  |  |  |  | PARTIAL: not a backup |
| Docuseal | DocuSign | 1 | contracts |  |  |  |  |  |  | agreements | releases | change orders |  | engagement letters |  |  | Never "legally binding" |
| Invoice Ninja | FreshBooks, QuickBooks | 0 | invoices |  |  |  |  |  |  | quotes, invoices | invoices | quotes |  | invoices |  |  | PARTIAL: no ledger |
| Companion Planning | none listed | 12 at cap | the week |  |  | revision blocks | shows, fairs |  |  |  |  |  |  |  |  | week plan | First party |
| Jellyfin | Plex, Netflix | 15 over |  |  | film night |  | home movies | family films | media |  |  |  |  |  |  |  | PARTIAL: own files |
| FreeCut | none listed | 0 |  |  | clip |  | process film |  |  |  | rough cuts |  | short cuts |  |  |  | Footage stays on the laptop |
| Navidrome | Spotify, Apple Music | 11 |  |  | own music |  | records, demos | kitchen music |  |  | reference |  |  |  |  |  | PARTIAL: files you hold |
| Radicale | Google Calendar, iCloud Calendar | 0 |  |  |  |  |  | family calendar |  |  |  | calendar |  | hearings |  | timetable | PARTIAL: no sharing |
| Solidtime | Harvest, Toggl Track | 0 |  |  |  |  |  |  |  | hours per client |  | site hours | hours | matter hours |  |  | Say nothing of billing |
| Akaunting | QuickBooks, Xero | 4 | practice books |  |  |  |  |  |  | books |  | small-firm books |  |  |  |  | PARTIAL: no tax claim |
| Joplin Server | Evernote | 5 | call notes |  |  |  |  |  |  |  |  |  |  |  | notes | reflections | Server only |
| Ollama | OpenAI, ChatGPT | 0 |  | model server |  |  |  |  | engine |  |  |  |  | engine |  |  | Engine, no chat window |
| n8n | Zapier, Make | 5 |  | glue |  |  |  |  | glue |  |  |  | forms to list |  |  |  | Source-available |
| Syncthing | Dropbox, Resilio Sync | 0 |  | laptop sync |  |  |  |  | folder sync |  | studio sync |  |  |  |  |  | Not a backup |
| LibreTranslate | Google Translate, DeepL | 14 over |  |  |  | own French |  |  |  |  |  |  |  |  | foreign documents | parent notes | Say nothing of quality |
| Obsidian | Notion, Evernote | 14 over |  |  |  | study notes | drafts |  |  |  |  |  |  |  | story files |  | Not open source |
| Inkscape | Adobe Illustrator | 2 |  |  |  |  | line art |  |  |  | logos |  | brand sheets |  |  |  | Vector only |
| Penpot | Figma, Sketch | 1 |  |  |  |  | portfolio |  |  |  | layout |  | design |  |  |  | No Figma importer |

**2.5 Services replaced, by persona, with the bring-your-data-home path**

Paths marked [V] were read in the vendor or importer documentation (bring-home map, 2026-10-18, re-checked 2026-10-19). Efforts are rough bands from that map, never promises. Imports lose things (comments, history, sharing, watched flags): name what carried over.

| Persona | Service to Hub app (path read) | No verified path |
|---|---|---|
| Organiser | Google Drive, Dropbox to Nextcloud [V]; Evernote to Joplin (ENEX) [V]; LastPass, 1Password to VaultWarden [V]; QuickBooks to Invoice Ninja (CSV) [V]; Salesforce to Twenty [V] | Cozi, DocuSign templates, HubSpot |
| Builder | GitHub to Gitea (migration form) [V]; 1Password, LastPass to VaultWarden [V]; Zapier to n8n (rebuild) [V]; ChatGPT, Claude exports to LibreChat [V] | Forgejo, an Open WebUI importer, CircleCI to Woodpecker |
| Gamer | Google, iCloud Photos to Immich (immich-go) [V]; Plex to Jellyfin (scan) [V]; Spotify to Navidrome (files only) [V] | Steam (sign in again), Discord (bridge only), YouTube, CapCut |
| Learner | Notion, Evernote, Keep, Apple Notes to Obsidian (Importer) [V]; Raindrop to Linkwarden [V]; Todoist to Vikunja [V]; Word, Docs to LibreOffice [V] | Quizlet, Anki, the school platform, Kindle purchases, ChatGPT history to Open WebUI |
| Maker | Google, iCloud Photos to Immich [V]; Notion, Evernote, Keep to Obsidian [V]; Spotify, Apple Music to Navidrome (own files) [V]; Medium, Squarespace, Mailchimp to Ghost [V] | Figma, Illustrator, CapCut, Lightroom, Procreate |
| Host | Paprika to Mealie [V]; Google, iCloud Calendar to Radicale (.ics) [V]; Google, iCloud Photos to Immich [V]; LastPass, 1Password to VaultWarden [V] | AnyList, Cozi, Alexa, HomeKit, Splitwise |
| Tech Family | GitHub to Gitea [V]; Google Photos to Immich [V]; 1Password to VaultWarden [V]; Plex to Jellyfin [V]; Dropbox, Drive to Nextcloud [V]; Zapier to n8n (rebuild) | NextDNS to Pi-hole, Google Home to Home Assistant (re-add devices), Tailscale |
| Business Owner | Google, Dropbox to Nextcloud [V]; QuickBooks, FreshBooks to Invoice Ninja [V]; Toggl, Clockify, Harvest to Solidtime [V]; Salesforce to Twenty [V]; Google Calendar to Baikal or Radicale [V] | DocuSign, HubSpot, Calendly, Zapier flows |
| Creative | Dropbox, Drive to Nextcloud (share links lost) [V]; Google, iCloud Photos to Immich (keeps RAW and JPEG pairs; early version) [V]; QuickBooks, FreshBooks to Invoice Ninja [V]; 1Password to VaultWarden [V] | Figma, Lightroom catalogues, Premiere projects, Frame.io |
| Contractor | QuickBooks, FreshBooks to Invoice Ninja [V]; Google, iCloud Photos to Immich [V]; Toggl, Clockify to Solidtime [V]; Trello to Planka (JSON) [V] | CompanyCam, Jobber, Housecall Pro, ServiceTitan, Sortly, Fuelly, DocuSign |
| Marketer | Mailchimp, Squarespace, Medium to Ghost (subscribers only) [V]; Google Analytics to Plausible [V]; Google, Dropbox to Nextcloud [V]; Salesforce to Twenty [V] | Figma and Canva libraries, Buffer to Mixpost (rebuild), Semrush |
| Lawyer | Dropbox, Google, personal OneDrive to Nextcloud [V]; 1Password, LastPass to VaultWarden [V]; QuickBooks to Invoice Ninja [V]; Google Calendar to Radicale [V] | Clio, Westlaw, Lexis, DocuSign templates, Acrobat |
| Journalist | Evernote (ENEX) to Joplin or Obsidian [V]; Google, Dropbox to Nextcloud [V]; Raindrop to Linkwarden [V]; 1Password to VaultWarden [V] | Otter, Trint, Rev (re-transcribe), Pocket (closed), Signal, the outlet's CMS |
| Educator | Drive, Dropbox to Nextcloud [V]; Word, Docs to LibreOffice [V]; Evernote to Joplin [V]; LastPass to VaultWarden [V]; Google Calendar to Radicale [V] | Google Classroom, the gradebook, ClassDojo, Google Forms |

## 3. The fourteen chapters

Fixed template: Who, Responsible for, Uses now, Hub replacements, Hangouts, How they talk, Comfort, AI stance, Triggers and objections, Honest limits, Home fit, Shots, Scripts. Caveat and import cells are the short form; the full text is in the data twin.

### 3.1 The Organiser (`organiser`)

*Sally (43). Comfort 3/5; AI pragmatic.*

**Who.** The records office of a household and the back office of a practice of one, from one desk. A parent of roughly 35 to 50; the fleet reuses the job for 24 people aged 33 to 71. The US had 29.8 million nonemployer businesses in 2022 [V, Census]; on the days they did household activities, women spent 2.8 hours and men 2.1, and 87% of women and 75% of men did some [V, BLS 2025]. The job is not a gender: the cast gives it to men too (Willem, 71).

**Responsible for.** Clients (deliverables, confidentiality); the bookkeeper and tax office; the school; household paper.

**Uses now.** Google Drive, Microsoft 365, Cozi, Evernote, LastPass, QuickBooks, DocuSign, ChatGPT [? typical]. Evernote capped free accounts at 50 notes in December 2023 [V].

**Hub replacements** (ranked by story strength)

| App | Replaces | Caveat | Import path | Now |
|---|---|---|---|---|
| Paperless-ngx | Evernote, Google Drive | Scans and PDFs only; not a DMS | Drop scans in the consume folder | 17 over |
| Nextcloud | Google Drive, Dropbox | Home network only; share links do not carry | Google and Dropbox integration apps | 12 at cap |
| Companion Planning | first party | Beta; Google sync off by default | Start fresh | 12 at cap |
| Hermes | first party | Beta; messages pass through the chat service | None (agent) | 24 (first party) |
| VaultWarden | LastPass, 1Password | Say "the Bitwarden apps"; attachments stay | Export CSV or 1pux, Bitwarden client | 12 at cap |
| Akaunting | QuickBooks, Xero | Bookkeeping only; no tax claim | CSV or Excel import | 4 |
| Docuseal | DocuSign | Outsiders need reach; never legally binding | Rebuild templates | 1 |

**Hangouts.** SBA business guide with SCORE, Mumsnet Work board, Fairygodboss, Fair Play, Ellevate [V]; r/smallbusiness, LinkedIn, school chats [?]. Four of these are women-focused or parent-focused; the cast gives the job to men too, so pair them with the neutral ones. Not the self-hosting scene: the 2025 selfh.st respondents were 94% male, which says who answers surveys, not who keeps records [V].

**How they talk.** Pace 140 to 150 wpm; 8 to 14 words, then a fragment. Brisk, practical, a little dry; exact with clients, warm with family, impatient with salespeople [?]. Owns: deliverable, scope, net 30. Eye-rolls: self-hosted, container, LLM. Dry humour, about paper.

- "Last year's invoice comes up from one word on it. Paperless-ngx reads each page and indexes it, so I search instead of filing by hand." (quote)

**Comfort.** Runs a dozen cloud accounts and exports a CSV; cannot use a terminal or restore a backup. Calls her partner, vendor chat, a local IT contractor.

**AI stance.** Pragmatic; pride conflicted [?]. Range: Pew 2026 finds 50% of men and 47% of women have ever used a chatbot, while the HBS aggregate of 18 earlier studies put women's adoption about 25% lower [V]; the story does not write that gap into a character. Rule: a local model does one named chore on her own documents and she approves last; the chore is the hero; say beta in the same scene.

**Triggers and objections.** Triggers: a client clause on where documents sit; a vendor changing terms; the spring renewal list. Objections: "I am not the IT person"; "What about my email?"

**Honest limits.** Email stays. Away from home is not claimed. Client folders, booking pages and outside signers need outside reach. No tax, compliance or signature-validity claim.

**Home fit.** Stone Gable House Front Study, Split-Level Family House Craft Room, Yellow Family Home Dining Room. Anchors: desk, bookshelf, kitchen-island, dining-table. Only 16 of 165 organiser beats reach a desk today; 42 land on the Core. Missing props: scanner, receipt shoebox.

**Shots.** A pile of paper beside a closed laptop, then the desk with the pile gone; a hand moving a document into a client's folder. Never: an app screen, a legible client name, a chatbot window, the frazzled-mother trope.

**Scripts.** Hooks: Sally finds last year's invoice by one word. / Three piles on the desk. One place on the Core. Titles: Sally finds last year's invoice; Three piles become one search.

- 15 s (24 words): "Receipts and school forms go into Paperless-ngx on the Core. Every page is read and indexed. Last year's invoice comes up from one word." Chip: Paperless-ngx | replaces Google Drive.
- 30 s (54 words, full text in the twin): Counter, Companion Planning; desk, the signed contract into Nextcloud; a Hermes draft she reads and sends (beta caption).

### 3.2 The Builder (`builder`)

*John (45). Comfort 4/5; AI pragmatic.*

**Who.** John, 45, writes code at a desk in his house. Most of it belongs to an employer on their GitHub, so what comes home is his own: side projects, the family's scripts, notes, secrets. Talks like a bug report. Today's files say his repositories sit in the house; employer code does not move, and he says so in the first comment.

**Responsible for.** The work he ships; reviewing pull requests; keeping employer code and tokens out of forbidden places; the household's network and backups.

**Uses now.** GitHub (80.5% of professionals), VS Code, Jira, 1Password, Zapier, Copilot [V, Stack Overflow 2025]. GitHub began training on Copilot interaction data for personal plans from 24 April 2026 [V].

**Hub replacements** (ranked by story strength)

| App | Replaces | Caveat | Import path | Now |
|---|---|---|---|---|
| Forgejo | GitHub, GitLab (SaaS) | No CI runner; code, issues, pull requests | Not verified; use Gitea's form | 12 at cap |
| Gitea | GitHub, GitLab (SaaS) | Actions do not carry; one forge per household | New Migration form, token for issues | 9 |
| Code Server | VS Code (Proprietary), Cursor | Outside extension registry; not "from anywhere" | Nothing to move | 3 |
| Ollama | OpenAI, ChatGPT | Engine only; CPU unless a GPU is passed in | None | 0 |
| Open WebUI | ChatGPT, Claude | No parity, speed or key | No importer; LibreChat reads exports | 17 over |
| VaultWarden | LastPass, 1Password | Say "the Bitwarden apps"; attachments stay | Export CSV or 1pux, Bitwarden client | 12 at cap |

**Hangouts.** Hacker News, Lobsters [V]; r/selfhosted, r/LocalLLaMA [S]; awesome-selfhosted, FOSDEM [V]; Self-Hosted podcast, Changelog. Trust comes from independence and disclosed limits, not promotion.

**How they talk.** Pace 150 to 165 wpm; short declaratives with a beat after each. Fragments and jargon with peers; plain with clients; a sceptic toward an ad that must be falsifiable in one sentence. Deadpan, aimed at himself. Eye-rolls: AI-powered, supercharge, seamless, 10x.

- "The model on the Core proposes a fix. John reads the diff, then decides." (caption)

**Comfort.** Installs from a compose file, migrates repositories, runs a VPN or reverse proxy (71.1% and 66.6% of self-hosters [V]); avoids a mail server. A hidden wizard makes him suspicious.

**AI stance.** Pragmatic; pride conflicted. Stack Overflow 2025: 2.7% highly trust AI, 46% distrust [V]; Ollama appears only among the lower-profile tools in the Pragmatic Engineer 2025 survey of 2,997 responses (the mention count sits in a chart the skeptic could not machine-read) [V]. Rule: one named, checkable chore, then John reads the diff and approves; "the model on the Core"; no hosted-model name, key, parity or speed.

**Triggers and objections.** Triggers: a client clause forbidding hosted AI; a secret rotation after a vendor breach; a subscription audit. Objections: "My employer's code is not mine to move"; "I lose Actions and extensions."

**Honest limits.** Work repositories, Actions workflows and employer chat do not move. The model is capable, not the best this month. Hoppscotch, IT-Tools and Woodpecker CI are live but not in the story catalog.

**Home fit.** Aurora (two Studies), Seraphine, The Palms, Walk-up Duplex. Anchors: desk, core, bookshelf, couch. Props: laptop, dual-monitor-arm, standing-desk. Avoid Stone Gable's toddler-dressed Core room.

**Shots.** Behind or beside the screen, never over the shoulder; hold on the approval gesture; a wide of desk and Core, a close of hands. Never: legible code, a terminal, a key field, a speed meter, RGB.

**Scripts.** Hooks: John's repositories live on a shelf in his house. / The model on the Core drafts. John decides. Titles: John's repositories live on a shelf; The model drafts, John decides.

- 15 s (21 words): "John keeps his repositories in Forgejo on the Core. A model on the Core drafts the commit message. John rewrites it." Chip: Forgejo | replaces GitHub.
- 30 s (59 words, full text in the twin): The employer's day against his own; Forgejo; the model proposes, he reads the diff; the not-the-best-model line; pauses after "employer" and "decides".

### 3.3 The Gamer (`gamer`)

*Steve (16). Comfort 3/5; AI split.*

**Who.** Pew 2024 (1,453 US teens): 85% play video games, 97% of boys and 75% of girls; 89% of players play with others [V]. Steve does not wake up wanting privacy; the honest hook is permanence of a Friday night. Today's files carry seven near-identical Steam beats, only boys, and a service (GeForce Now) he rarely uses.

**Responsible for.** Schoolwork, chores and the fridge rota, his own accounts, and getting the session going.

**Uses now.** Steam, consoles, Roblox, Discord, YouTube, a photo cloud, a chatbot for homework [? typical]. NVIDIA's FAQ gives paid members 100 hours a month and requires owning the game [V].

**Hub replacements** (ranked by story strength)

| App | Replaces | Caveat | Import path | Now |
|---|---|---|---|---|
| Steam Headless | GeForce Now, Xbox Cloud Gaming | Valve keeps the account; no GPU declared | Sign in to Valve, reinstall | 7 |
| Jellyfin | Plex, Netflix | Files the family holds; Netflix cannot move | Scan the same folders | 15 over |
| Immich | Google Photos, iCloud Photos | Slow first start; not a backup | Takeout or iCloud via immich-go | 19 over |
| PairDrop | AirDrop | Same Wi-Fi only | None | 1 |
| FreeCut | none listed | Footage stays on the laptop | None | 0 |
| Open WebUI | ChatGPT, Claude | One homework step; no cloud key | No importer; LibreChat reads exports | 17 over |

**Hangouts.** Discord friend servers [S]; YouTube, about 90% of US teens, Twitch, Snapchat [V]; GamingOnLinux, ProtonDB, Stop Killing Games [V]. Offline: school, a cousin's house, the family living room.

**How they talk.** Pace 150 to 165 wpm; 5 to 12 words, a half-second after the limit. Dry, quick, allergic to being sold to. Owns: session, queue, lobby, patch, clip. Eye-rolls: self-hosted, frame rate, "gaming PC", "level up". A subscription is a limit (a queue, an hour cap) [?].

- "His library is still on his Valve account. What changed is where the session runs: on the Core, not on a rented server." (caption)

**Comfort.** Installs a launcher or mod and follows a video guide; cannot SSH or set up a VPN. Asks the household builder first; wants one line.

**AI stance.** Split, quiet. Pew 2026: 57% of US teens use chatbots to find information, 54% for schoolwork [V]. Rule: a model on the Core does one named homework chore and Steve writes the answer; no AI in a game, art or voice step, no AI companion.

**Triggers and objections.** Triggers: cloud gaming changing terms; a closing service; a full phone; cousins coming Saturday. Objections: "Will it run the game I play?"; "My friends are on Discord."

**Honest limits.** The Valve account and library stay Valve's. Kernel anti-cheat games do not run (Fortnite, Valorant, Apex listed Denied [V]). No GPU is declared. It streams a desktop in a browser on the home network.

**Home fit.** Split-Level Family House (Den 60 m2), Stone Gable House Living Room, Mediterranean Villa TV Room, Corner Penthouse. Anchors: tv, couch, bed, desk. Under-18s never speak: the researcher's first-person lines are now captions.

**Shots.** Medium from behind or beside, screen never readable; one cut to the Core on its shelf; a held still on the limit line. Never: RGB, a game title, a console box, a teen talking to an AI companion.

**Scripts.** Hooks: Steve's game runs downstairs, on the Core. / Friday film night, from the family's own files. Titles: Steve's session runs downstairs; Film night from the family's files.

- 15 s (26 words): "Steve signs in to his own Valve account. Steam Headless runs the session on the Core downstairs. A Core may lack the graphics a game wants." Chip: Steam Headless | replaces GeForce Now.
- 30 s (58 words, full text in the twin): Valve sign-in; the cousins join his world; a clip sent with PairDrop; film night in Jellyfin; the graphics limit; half a second of quiet.

### 3.4 The Learner (`learner`)

*Jean (14). Comfort 2/5; AI split.*

**Who.** A student of 12 to 22: 12 to 14 (school and parent decide; the ad speaks to the adult), 15 to 18 (exam years), 18 to 22 (the student decides). The cast uses the job for 18 members aged 6 to 20, ten under 12, told as parent-led reading, not chat. In England, JCQ rules require AI use in coursework to be acknowledged [V].

**Responsible for.** Teachers (deadlines); the exam board; parents (grades, devices).

**Uses now.** Google Classroom, Docs, Notion, Quizlet, YouTube, TikTok, a chat model: ChatGPT 59% of US teens [V, Pew December 2025]. A December 2024 PowerSchool breach was reported at 62 million students, unconfirmed [V].

**Hub replacements** (ranked by story strength)

| App | Replaces | Caveat | Import path | Now |
|---|---|---|---|---|
| Open WebUI | ChatGPT, Claude | Not frontier; can be wrong; 13 plus | No importer; LibreChat reads exports | 17 over |
| Kiwix | Google Search, Bing | Empty until content is downloaded | None | 18 over |
| LibreTranslate | Google Translate, DeepL | Say nothing of quality | None | 14 over |
| Obsidian | Notion, Evernote | Notes are files; not open source | Importer plugin | 14 over |
| LibreOffice | Microsoft Office, Google Workspace | Tracked changes and macros can differ | Opens .docx directly | 7 |
| JupyterLab | none listed | Better for ages 15 plus | None | 13 over |

**Hangouts.** YouTube study channels, TikTok [V]; Snapchat and WhatsApp group chats [S]; Anki and Obsidian forums [V]; r/GCSE [?]. Film at the kitchen or dining table, adults near.

**How they talk.** Pace 150 to 165 wpm in an adult voice; peers 3 to 9 words. Fast, dry, sarcastic to peers; polite to teachers; quick to feel talked down to. Owns: revision, mark scheme, set text. Eye-rolls: edtech, "ace your exams", "homework helper".

- "Jean asks the model to explain the proof, not to write it. She still writes it herself." (caption)

**Comfort.** Installs from a tile; cannot administer a server or judge a model. Asks a parent first, then a friend, then YouTube. Any password field is the household lead's job.

**AI stance.** Split, honest. Pew: 54% of US teens used a chatbot for schoolwork [V]; HEPI 2025: 53% are put off AI by the risk of being accused of cheating [V]. Rule: a named study chore the school accepts; never writes the learner's work; always "a study helper, not a teacher, and it can be wrong"; no chat model under 13 [S].

**Triggers and objections.** Triggers: a school-system breach in the news; Pocket closed 8 July 2025; a stricter AI rule. Objections: "Is that cheating?"; "Do my parents see everything?" (the household lead runs the Core; school rules decide).

**Honest limits.** The school platform, flashcard schedulers (no Anki or Quizlet in the store), co-writing in other houses and anything on the move cannot move. Kiwix installs empty until content is downloaded.

**Home fit.** Seraphine, Split-Level Family House, Stone Gable House, Palm Knoll; 18 to 22: Epiphany, City One-Bedroom. Anchors: desk, bookshelf, dining-table. Put the closed school laptop on the desk; no bed anchors for a minor. Jean never speaks.

**Shots.** Hands, not faces; seated eye level; window light; one tight shot on a printed page. Never: a close face, a child alone at night, a school or exam-board mark, a child speaking.

**Scripts.** Hooks: Where do her homework questions actually go? / She writes the French first, then checks it. Titles: Jean writes the French first; A lookup no search engine sees.

- 15 s (27 words): "Jean is stuck on a proof. A model on the Core explains the first step, and her question stays there by default. She writes the answer herself." Chip: Open WebUI | replaces ChatGPT.
- 30 s (52 words, full text in the twin): A proof and a model explaining step one; a Kiwix date; French checked in LibreTranslate; the study-helper limit. Parent-facing.

### 3.5 The Maker (`maker`)

*Bruk (19), Haruo (70). Comfort 3/5; AI split.*

**Who.** A person with a day job who photographs, paints, writes or plays in the evenings and keeps the archive: family pictures, a grandparent's scans, a bandmate's stems. Ruling: tell Bruk and Haruo as hobbyists; the working sellers (Ravi, Kian, Malia, Valeria) move to Creative or Educator.

**Responsible for.** The work and its archive; family photographs they cannot re-shoot; other people's files; small audiences.

**Uses now.** Google Photos, Lightroom, Canva, Spotify, Plex, Evernote, Etsy [? typical]. New uploads counted against a shared 15 GB from 1 June 2021 [V]; SoundCloud terms allow content use for AI development [S].

**Hub replacements** (ranked by story strength)

| App | Replaces | Caveat | Import path | Now |
|---|---|---|---|---|
| Immich | Google Photos, iCloud Photos | Keep the originals; not a backup | Takeout or iCloud via immich-go | 19 over |
| Obsidian | Notion, Evernote | Notes are files; not open source | Importer plugin | 14 over |
| Navidrome | Spotify, Apple Music | Files you hold only | Point at a music folder | 11 |
| Inkscape | Adobe Illustrator | Vector only; browser session | Open SVG and PDF | 2 |
| AudioMass | Adobe Audition, TwistedWave | Edits stay in the browser until saved | Open audio files | 2 |
| Penpot | Figma, Sketch | No Figma importer found | Export and rebuild | 1 |

**Hangouts.** Obsidian Forum, FM Forums, KVR Audio, Cara (refuses AI portfolios), Hackaday.io [V]. Offline: makerspaces, Men's Sheds, Repair Cafes [V].

**How they talk.** Pace 125 to 145 wpm; 6 to 14 words, a full beat between thoughts. Dry, modest, process-first; they describe the light and the take and underplay pride. Own: RAW, XMP, stems, cull. Eye-rolls: content creator, unlock, NAS. Say "the renewals", never a figure.

- "I do not want the painting done for me. I want the folders sorted. That is the part I put off." (quote)

**Comfort.** Installs desktop apps and plug-ins; cannot run Docker or read a log. Expect an import step and a list of what did not come across.

**AI stance.** Split; conflicted. 378 professional visual artists: 99% dislike generative AI [V]; 82% of producers oppose full-song generation [S]. Rule: AI is a chore-doer, never a maker; originals untouched; lead with files; never "generate", "prompt" or "AI art"; keep ComfyUI out.

**Triggers and objections.** Triggers: a storage-plan change; a training notice (Adobe, SoundCloud [S]); a dying laptop [?]. Objections: "Does it keep my dates and albums?"; "I still need Photoshop"; "Is this my backup?"

**Honest limits.** No replacement for Photoshop, Lightroom, Procreate or any DAW. The Core is not a backup. No public portfolio. AudioMass and FreeCut hold work in the browser until saved.

**Home fit.** Mirage (upright piano in the 44 m2 Living Salon, no desk to compete), Riverbend (record player). Anchors: easel, music, desk, couch. Today's pool makes nothing: add Inkscape, AudioMass, Penpot; rotate Navidrome (11 homes) and Immich (19).

**Shots.** Hands at work before any app appears: prints on a drying line, a record sleeve in window light, a crossed-out line in a notebook. Never: a prompt box, AI versus human comparisons, real artworks.

**Scripts.** Hooks: Photos in a photo cloud. Photos on a shelf. / The sorting is done for you. The painting is not. Titles: Bruk's weekend lives on the Core; Sorted by place, not by cloud.

- 15 s (23 words): "Bruk shoots on weekends. His pictures sit in Immich on the Core, not in a photo cloud. The first sort takes a while." Chip: Immich | replaces Google Photos.
- 30 s (45 words, full text in the twin): A take trimmed in AudioMass; the shoot in Immich; portfolio pages in Penpot; the beta line; "Your weekend can come home too."

### 3.6 The Host (`host`)

*Juma (36), Yoshiko (67). Comfort 2/5; AI split.*

**Who.** The person who knows where the passports are and that Thursday is bin day. The cast has 10 hosts among 94 members, aged 35 to 70, nobody between 45 and 60. BLS 2025: 87% of women and 75% of men did household activities on an average day [V]. The working parent of school-age children is the commonest case and missing.

**Responsible for.** Everyone eats what they can eat and is where they should be; the calendar, paperwork and plants; guests.

**Uses now.** Google Calendar, Cozi, AnyList, Paprika, Google Photos, WhatsApp, Alexa, Splitwise, ChatGPT [mixed]. Amazon removed local voice processing on three Echo models from 28 March 2025 [V].

**Hub replacements** (ranked by story strength)

| App | Replaces | Caveat | Import path | Now |
|---|---|---|---|---|
| KitchenOwl | none listed | Aisle list needs remote reach | Fresh start | 10 |
| Mealie | Paprika, AnyList | AnyList has no export | Paprika migration; URL or paste | 0 |
| Immich | Google Photos, iCloud Photos | Slow first start; not a backup | Takeout or iCloud via immich-go | 19 over |
| Yuvomi | none listed | One household, not an account each | .ics events | 14 over |
| Radicale | Google Calendar, iCloud Calendar | No sharing carries over | .ics into a CalDAV client | 0 |
| Home Assistant | Google Home, Amazon Alexa | No Zigbee stick; cloud devices keep their cloud | Re-add devices | 14 over |

**Hangouts.** Mumsnet Talk, Home Assistant Community (where the household's tech person asks for help), Seed Savers Exchange, RHS advice [V]; ParentSquare is the school's choice [V]. Offline: the school gate, the kitchen table and fridge door.

**How they talk.** Pace 140 to 155 wpm; 6 to 12 words in list rhythm. Warm, brisk, dry; list rhythm ("lunchboxes, forms, bins"). Owns: meal plan, batch cooking, carpool, RSVP. Avoid "companion planting": gardeners' jargon that collides with the product name. Never mum guilt or "supermom".

- "Twelve for Sunday lunch. The list sits in KitchenOwl on the Core, and everyone at home adds to it." (caption)

**Comfort.** Usually phone-fluent; most have never edited a config file. Range 1 (needs everything set up) to 4 (a hobby tinkerer). Calls the household tech person.

**AI stance.** Split, quiet. 79% of parents use AI against 54% of non-parents [V, Menlo]. Rule: one named household chore in one sentence on the model on the Core, the Host approves; never books or pays, never a child's homework, never claim a recipe is safe.

**Triggers and objections.** Triggers: the photo library hits a plan limit; a device changes its rules; a grandparent's recipes need a home. Objections: "I do not want to be the IT department"; "I need the list in the shop."

**Honest limits.** Remote access is not claimed: the shop-aisle list and photos from the road are off the table. School channels stay with the school. AnyList and Cozi have no export we found.

**Home fit.** Vanilla House (Kitchen plus Greenhouse), Riverbend (Mudroom and Laundry for the school run), Lake Cabin and Newcrest Kitchens, Garden Flat Terrace. Anchors: kitchen-island, fridge, range, counter, dining-table, garden. Cap Hermes at one beat per host (9 today).

**Shots.** Waist height, hands and objects first; two people in frame; the paper list first, the app chip second. Never: any screen, a phone in a shop aisle, a Host who is always the mother in an apron.

**Scripts.** Hooks: Sunday lunch for twelve starts with one shared list. / Gran's recipe tin gets a second copy. Titles: Twelve for Sunday lunch; Gran's recipe tin gets a copy.

- 15 s (24 words): "Twelve for Sunday lunch. Gran's recipe cards are in Mealie now, on the Core. Typed once, searchable after. Mealie is an alternative to Paprika." Chip: Mealie | replaces Paprika.
- 30 s (47 words, full text in the twin): Recipe cards in Mealie; photos in Immich; the porch light in Home Assistant; the shop limit, said lightly.

### 3.7 The Tech Family (`tech-family`)

*Andres (40), Samir (48), Tomasz (44). Comfort 4/5; AI split.*

**Who.** The far end of the campaign's "Tech family" segment and its "self-hoster" angle: bored of being sold privacy, they will check the numbers. The data describes who answers surveys (selfh.st 2025 is 94% male [V]): vary who tinkers. They are half uncloud already; the story is consolidation plus backups and the partner.

**Responsible for.** A technical paid job plus an unpaid second one: the house online, lamps working, photos safe. Answers to the partner ("it has to work when I ask").

**Uses now.** NextDNS, Google Home, GitHub, ChatGPT, 1Password, Plex. Already running Home Assistant (588 favourite-app mentions), Jellyfin, Immich; 71% use a VPN [V, selfh.st 2025].

**Hub replacements** (ranked by story strength)

| App | Replaces | Caveat | Import path | Now |
|---|---|---|---|---|
| Home Assistant | Google Home, Amazon Alexa | No Zigbee stick; cloud devices keep their cloud | Re-add devices | 14 over |
| Pi-hole | AdGuard, NextDNS | Not parental control; router sends DNS to 8053 | By hand | 7 |
| Forgejo | GitHub, GitLab (SaaS) | No CI runner; code, issues, pull requests | Not verified; use Gitea's form | 12 at cap |
| ntfy | none listed | No sign-in by default | Re-point scripts | 5 |
| Uptime Kuma | Datadog, New Relic | A simple monitor, not Datadog | By hand | 3 |
| Open WebUI | ChatGPT, Claude | No parity, speed or key | No importer; LibreChat reads exports | 17 over |

**Hangouts.** Home Assistant Community (122,106 Configuration topics), Pi-hole Discourse, Lemmy c/selfhosted, LinuxServer.io, awesome-selfhosted [V]; r/selfhosted, r/homelab [?]. Offline: the hall cupboard, the garage workbench, FOSDEM.

**How they talk.** Pace 150 wpm house narrator; 8 to 14 words, a hold on each proper noun. Dry, specific, peer to peer; blunt in forums, warm at home. They accept a limit stated plainly and punish an unstated one. Never "wife acceptance factor". Call them the household lead, not admin or owner.

- "Pi-hole answers the house's DNS from the Core. Lookups it does not block still go to an upstream resolver the family chose." (caption)
- "I don't care what runs it. The lamp has to come on when I ask." (quote)

**Comfort.** Lead: Docker, router DNS, YAML, a restore. Partner 2 to 3; teen 3 to 5 (editorial [?]). Home Assistant's survey post says one person, 94.4% of them men, sets up and maintains the smart home while partners and children interact with the devices rather than through Home Assistant itself [V]. Never call install easy.

**AI stance.** Split; proud only of the local part. Jellyfin bans LLM-written text in its issues, pull requests and forum posts; Home Assistant ships an Ollama agent, optional [V]. Rule: lead with the chore, state the limit once ("it can be wrong, so the household lead checks"); AI is the third beat; never "AI-powered", parity, speed or a child with an AI.

**Triggers and objections.** Triggers: a vendor ending cloud support (Belkin Wemo, 31 January 2026 [V]). Never open on a breach. Objections: "I already run this"; "Can I reach it when I am away?" (not claimed); "Who backs it up?"

**Honest limits.** Remote access is not claimed (VPN, Tailscale, tunnel, remote are banned words). No Zigbee stick. Pi-hole is not parental control. No backup story: 13% of surveyed self-hosters have none [V].

**Home fit.** Split-Level Family House (native, flagship: do not recast), Cocoon, Epiphany, New Eco House. Anchors: core, desk, room (garage), tv, couch. Not in the schema yet. Avoid the emissive `server-rack` prop.

**Shots.** Hands taping a label on a cable at the hall shelf; the workbench with retired hardware; a lamp coming on within the partner's reach. Pair every tinkerer shot with a reaction from someone who does not tinker. Never: a readable screen, a hooded hacker, a benchmark.

**Scripts.** Hooks: The household lead reads the query list on Sunday. / Every family has one person who fixes the Wi-Fi. Titles: The Sunday list on the router; The lamp comes on.

- 15 s (27 words): "Every family has one person who fixes the Wi-Fi. Here, the router asks Pi-hole on the Core first. One allow-list entry, and the homework site loads again." Chip: Pi-hole | replaces NextDNS.
- 30 s (61 words, full text in the twin): Workbench, Forgejo; a lamp comes on, the partner line; Open WebUI on the hall sensor with its limit; the whiteboard; end card.

### 3.8 The Business Owner (`business-owner`)

*Ruth (39), Agnieszka (42). Comfort 2/5; AI pragmatic.*

**Who.** Aged roughly 30 to 65 [?]: a couple running a studio, a parent fitting the business round school hours, an owner above the shop, or a home office with one to three staff. 99% of US small businesses use at least one platform at work and 41% use six or more [V, US Chamber, 2026]. Not Sally: Organiser is household records and a practice of one; Business Owner has premises, staff and books.

**Responsible for.** Customers (the quote, the invoice); staff (pay, rota); the tax office through an accountant; suppliers and the landlord.

**Uses now.** Microsoft 365 or Google Workspace, QuickBooks, HubSpot or a spreadsheet, DocuSign, Calendly, LastPass, ChatGPT [? typical]. Microsoft announced on 10 December 2025 that most Business plans rise from 1 July 2026 [V].

**Hub replacements** (ranked by story strength)

| App | Replaces | Caveat | Import path | Now |
|---|---|---|---|---|
| Nextcloud | Google Drive, Dropbox | Home network only; share links do not carry | Google and Dropbox integration apps | 12 at cap |
| Invoice Ninja | FreshBooks, QuickBooks | Invoicing, no ledger; cards need a provider | QuickBooks CSV; FreshBooks importer | 0 |
| Paperless-ngx | Evernote, Google Drive | Scans and PDFs only; not a DMS | Drop scans in the consume folder | 17 over |
| Docuseal | DocuSign | Never legally binding; outsiders need reach | Rebuild templates | 1 |
| Akaunting | QuickBooks, Xero | Bookkeeping only; no tax claim | CSV or Excel import | 4 |
| Twenty | Salesforce | Not HubSpot automation | Salesforce CSV | 4 |
| AnythingLLM | ChatGPT, Claude | Chip is the name alone | Fresh history | 1 |

**Hangouts.** r/smallbusiness (1.8M to 2.6M members by two aggregators; bans promotion) [S]; Alignable, Shopify Community [V]. Offline: the counter, the accountant's office [?]; BNI breakfasts (355,000+ members) [V].

**How they talk.** Pace 150 wpm; 10 to 12 words, ceiling 20, fragments fine. Short dry bursts; warm with clients; a raised eyebrow for an ad: show me the job, skip the pitch. Open on a concrete noun. Owns: cash flow, margin, net 30, no-show. Eye-rolls: stack, SaaS, data sovereignty.

- "Quotes, invoices, signed contracts. They used to live in four places. Now they sit in one client folder on the Core." (caption)

**Comfort.** Runs a cloud suite's admin console and a card reader from a vendor guide; cannot edit a config file or test a restore. Calls a partner, an IT contractor, the bookkeeper.

**AI stance.** Pragmatic; pride conflicted. Adoption figures are sampling artefacts: US Chamber 66% [V], Census 17 to 20% of all firms [V]. Rule: a bounded chore by the model on the Core on the owner's files; the owner reads and approves before anything reaches a client; nothing emails, pays or books alone; no headcount story.

**Triggers and objections.** Triggers: a renewal with an AI add-on [V]; Dropbox Sign breach, April 2024 [V]. Objections: "Who fixes it when it breaks?"; "My accountant uses QuickBooks"; "Can clients sign from outside?"

**Honest limits.** No payroll, point of sale, card processing or bank feeds. No tax or accounting advice, no "legally binding". Staff, clients and signers outside the home network are out, and so are web shops. One household lead, one machine.

**Home fit.** Corner Penthouse (a Corner Shop unit in the building), City One-Bedroom (Shop West and East), Sunny Home Dining. Anchors: desk, dining-table, counter, core. Missing props: labelled folders, a quote on a clipboard.

**Shots.** The client folder on its shelf; hands on a printed quote; the Friday money hour at the dining table in golden hour. Never: an invoice mock-up, real company names or amounts on paper, work from the road.

**Scripts.** Hooks: Where does your customer list actually live? / Your client folder sits on a Core, not a rented drive. Titles: Friday is for the books; The client folder lives at home.

- 15 s (27 words): "Friday afternoon. Ruth closes the week at her desk. Quotes and invoices go through Invoice Ninja. Every contract sits in one folder in Nextcloud, on the Core." Chip: Invoice Ninja | replaces QuickBooks.
- 30 s (57 words, full text in the twin): Quote and invoice in Invoice Ninja; receipts in Paperless-ngx; contracts in Nextcloud; a model drafts a late-payer reminder she sends.

### 3.9 The Creative (`creative`)

*Dalia (46), Valeria (36), Malia (44). Comfort 3/5; AI split.*

**Who.** One character, four flavours: designer or illustrator (most guarded about AI), photographer (practical about retouching), filmmaker or editor (bound by clauses on unreleased footage), musician or producer (heaviest AI use, mostly stem separation). Core group 28 to 52 [?]. Unlike Maker, their data is clients' and buyers': the four sideline sellers in today's cast belong here.

**Responsible for.** Delivery on the agreed date; client confidentiality (NDAs, embargoes); rights and licences; an archive that outlives the job; getting paid.

**Uses now.** Adobe Creative Cloud, Figma, Lightroom, Premiere, Dropbox, HoneyBook, QuickBooks, ChatGPT. Designers under NDA threatened to cancel after an Adobe terms pop-up in June 2024 [S]; Adobe says it does not train generative AI on customer content except Adobe Stock submissions [V]; Figma content training is on by default for Starter and Professional since 15 August 2024 [V].

**Hub replacements** (ranked by story strength)

| App | Replaces | Caveat | Import path | Now |
|---|---|---|---|---|
| Immich | Google Photos, iCloud Photos | A library, not a RAW developer | Takeout or iCloud via immich-go | 19 over |
| Nextcloud | Dropbox, Google Drive | Home network only; share links do not carry | Google and Dropbox integration apps | 12 at cap |
| Penpot | Figma, Sketch | No Figma importer found | Export and rebuild | 1 |
| Inkscape | Adobe Illustrator | Vector only; browser session | Open SVG and PDF | 2 |
| Open WebUI | ChatGPT, Claude | No parity, speed or key | No importer; LibreChat reads exports | 17 over |
| Invoice Ninja | FreshBooks, QuickBooks | Invoicing, no ledger; cards need a provider | QuickBooks CSV; FreshBooks importer | 0 |
| Whisper-WebUI | none listed | Weights download first; CPU only | Drop audio files in | 0 |

**Hangouts.** Lift Gamma Gain (16,611 members), Blender Artists, Fstoppers, Freelancers Union, Graphic Artists Guild [V]; r/graphic_design [?]. Offline: home studio [?], co-working, NAB Show (New York 21 to 22 October 2026) [V].

**How they talk.** Pace 135 to 145 wpm; 9 to 12 words, none over 20, a pause after each sentence. Dry, specific, a little wary. They talk about the brief, the proof and the round of changes, not software; they say "under NDA", "embargoed", not "privacy". Some describe their tools as rent paid to stay employable [?]. Eye-rolls: private, secure, easy, AI-powered.

- "Terms change on a Tuesday. My files do not move unless I move them." (quote)

**Comfort.** Installs desktop software and plug-ins, restores from Time Machine; cannot edit a compose file or forward a port. Calls a forum thread or the partner who does computers.

**AI stance.** Split; conflicted. 378 professional visual artists: 99% dislike generative AI, 85% never use it [V, skews against AI]; Adobe's own survey: 99% use it somewhere, 40% feel embarrassed [S, vendor]. Rule: one named chore, then the creative decides; never a generative image or music hero; never pushed at someone who rejects it.

**Triggers and objections.** Triggers: a terms update; a client clause on unreleased material; a failed restore that exposes sync-as-backup. Objections: "My clients use Frame.io and Figma"; "Does it run Lightroom?"; "I do not want my work near a model."

**Honest limits.** Cannot move Lightroom, Photoshop, Premiere, Resolve, Ableton or Logic. No link for clients outside the house. No Figma or Lightroom import. The Core is not a backup. No story may imply Adobe trains on customer content.

**Home fit.** Payorote (Dressing Loft studio), Flowery Cottage (Sunroom easel), Epiphany (Den), Warehouse Loft. Anchors: easel, desk, music, dining-table (the client at the table), tv (the archive tiled on the wall), core.

**Shots.** An easel with a half-finished poster beside a closed laptop; proofs on a trestle table; a wall TV tiling a shoot folder; the Core on a studio shelf once. Never: client or software logos, real or AI-made art, screens.

**Scripts.** Hooks: Seven years of shoots. Where do they actually live? / The brief says confidential. Where does the draft sit? Titles: The brief says confidential; Seven years of shoots, one search.

- 15 s (27 words): "Seven years of shoots. Where do they live? In Immich, on the Core, sorted by place. The client brief sits in Nextcloud, not in a rented drive." Chip: Immich | replaces Google Photos.
- 30 s (50 words, full text in the twin): Posters in Penpot; the logo in Inkscape; the model reads the brief back; last year's shoot in Immich; the card-payments limit.

### 3.10 The Contractor (`contractor`)

*Kunle (49), Emi (38), Sione (46). Comfort 3/5; AI pragmatic.*

**Who.** A trade is two jobs: on site with the hands, then the firm at the end of the day. Self-employed are about 23% of US construction workers, roughly 2.6 million [V, NAHB], and 37% in UK construction [V, ONS]. Name caution: today's "firmware contractor" Kunle is a freelance engineer and must be re-worded.

**Responsible for.** The client (work, warranty, callbacks); the tax office; insurers and inspectors; the crew. No advice is given on any of these.

**Uses now.** Jobber, Housecall Pro or a spreadsheet; QuickBooks; CompanyCam; DocuSign; Sortly; ChatGPT. Jobber and CompanyCam price by seat [V vendors]. QuickBooks Online Plus rose 16.2% on 1 July 2025 [V].

**Hub replacements** (ranked by story strength)

| App | Replaces | Caveat | Import path | Now |
|---|---|---|---|---|
| Invoice Ninja | FreshBooks, QuickBooks | No ledger, payroll or filing | QuickBooks CSV; FreshBooks importer | 0 |
| Immich | Google Photos, iCloud Photos | Not CompanyCam; not a backup | Takeout or iCloud via immich-go | 19 over |
| HomeBox | Sortly | One-household inventory | No importer found | 0 |
| LubeLogger | Fuelly, Drivvo | No fleet telematics | Not verified | 0 |
| Docuseal | DocuSign | Never legally binding; outsiders need reach | Rebuild templates | 1 |
| Open WebUI | ChatGPT, Claude | No parity, speed or key | No importer; LibreChat reads exports | 17 over |
| Paperless-ngx | Evernote, Google Drive | Scans and PDFs only; not a DMS | Drop scans in the consume folder | 17 over |

**Hangouts.** r/Construction, r/electricians, r/Plumbing: Reddit unread, profiles from an aggregator [S]; Mike Holt's Forum [V]. Offline: the van cab at lunch [?], the trade counter at 6:30 [V].

**How they talk.** Pace 135 to 145 wpm; 6 to 12 words, average nine, fragments welcome. Plain, dry, unhurried; many are terse with a stranger on an ad and quick to smell a pitch [?]. Wry about paperwork and clients who remember the quote differently. Owns: quote, change order, snag list. Eye-rolls: workflow, ecosystem. "Quote done. Photos in. Home by six."

- "I write the quote at the bench, same evening. Invoice Ninja keeps the client, the line items and last spring's job together." (quote)

**Comfort.** Runs a job app and a bookkeeping package, scans with the phone; cannot edit a config file or restore an untested backup. Wants a person to call, not a forum thread [?].

**AI stance.** Pragmatic. Housecall Pro 2026: 48% of 248 pros use AI [V, vendor survey of its customers]; a UK trades survey found 4.8% [V, sample not stated]. Rule: a local model drafts a job summary from site notes and the contractor fixes it first; "no API bill"; never field work or pricing alone.

**Triggers and objections.** Triggers: a price rise; a helper turning a flat fee into a seat; a client asking where photos are kept [?]. Objections: "The accountant uses QuickBooks"; "What if the Core is stolen?"; "Can my crew use it from site?"

**Honest limits.** Remote access is not claimed: a crew on site or a quote sent from the van cannot be shown. Making Tax Digital needs recognised software [V HMRC]: never "tax ready". No payments, no dispatch. No one-click move from CompanyCam or Jobber.

**Home fit.** Riverbend (Two-Car Garage 53 m2, Mudroom and Laundry, driveway), Flowery Cottage, Modern Asymmetry House. Anchors: `room` set to the garage (roles.json has no workbench), desk, driveway, laundry. The prop library has no van, ladder or toolbox.

**Shots.** The bench and tool wall at 6:30; the quote at the desk in golden hour; the same wall photographed twice and pinned side by side. Bench height, eye level. Never: a van or ladder as hero, tool brands, a crew reaching the Core from a site.

**Scripts.** Hooks: A seat fee for every pair of hands. Count yours. / The quote is done by supper and sits on your Core. Titles: The quote is done by supper; The same wall, twice.

- 15 s (27 words): "A seat fee for every pair of hands. Kunle writes the quote at the bench. Invoice Ninja keeps the client and the line items on the Core." Chip: Invoice Ninja | replaces QuickBooks.
- 30 s (53 words, full text in the twin): Garage door up; the quote in Invoice Ninja; tools in HomeBox; site notes into a draft he fixes; the honest edge.

### 3.11 The Marketer (`marketer`)

*Elena (34). Comfort 3/5; AI pragmatic.*

**Who.** She runs campaigns, the list and the content calendar for a client or a company. MBO Partners counts 74.9 million US independent workers in 2026 without splitting by profession, so a freelance share is [?]. The strongest story is not cheaper tools but "the client's list, files and briefs sit in the house, and the model that drafts from them runs on the Core."

**Responsible for.** Results she can show; the subscriber list and consent records (the client's); the content calendar; confidential launch material.

**Uses now.** Google Docs, Notion, WeTransfer; Mailchimp (11 million users, stalled since mid 2024 [V]), HubSpot; Buffer; Google Analytics; Canva, Figma; ChatGPT, Claude; Slack, 1Password. 15,384 martech solutions, 8.6% removed in a year [V].

**Hub replacements** (ranked by story strength)

| App | Replaces | Caveat | Import path | Now |
|---|---|---|---|---|
| Open WebUI | ChatGPT, Claude | No parity, speed or key | No importer; LibreChat reads exports | 17 over |
| Companion Memory | first party | Beta; opt-in imports | Takeout and other exports | 5 (first party) |
| Nextcloud | Google Drive, Dropbox | Home network only; share links do not carry | Google and Dropbox integration apps | 12 at cap |
| Ghost | Mailchimp, ConvertKit | Public site needs outside reach | Mailchimp, Squarespace, Medium migrators | 0 |
| Penpot | Figma, Sketch | No Figma importer found | Export and rebuild | 1 |
| Mixpost | Buffer, Hootsuite | Lite only; needs a public callback URL | Rebuild by hand | 0 |
| Twenty | Salesforce | Not HubSpot automation | Salesforce CSV | 4 |

**Hangouts.** Superpath and Measure Slack, Demand Curve, Meetup groups (159,319 members) [V]; r/marketing, LinkedIn [?]. Marketing Brew, SparkToro. Offline: home desk, co-working, client offices; BrightonSEO (11,000+) [V].

**How they talk.** Pace 150 wpm; 6 to 12 words, leave silence. Shorthand and dry one-beat jokes with peers; warm with clients; she judges the craft of an ad before the product, so hooks must not be tricks. Owns: CTR, deliverability, UTM, flows. Eye-rolls: synergy, thought leader, game-changer, 10x.

- "The brief goes through Open WebUI. The model runs on the Core, so the launch plan stays on my desk." (quote)

**Comfort.** Connects apps, builds segments and flows, points a domain at a site; cannot fix a container or tune a mail server. Vendor chat first, then a peer Slack, then a developer friend.

**AI stance.** Pragmatic; pride conflicted. HubSpot 2026: 86.4% of teams use AI [V]; Klaviyo: only 31% always tell colleagues, from stigma [V]. Rule: a model on the Core does one named chore on the client's own material and she edits and approves; no better-copy claim, no time or money saved, no cloud key.

**Triggers and objections.** Triggers: a vendor shift (Intuit's Mailchimp cuts, May 2026 [V]); a client clause on AI [V]; offboarding a client. Objections: "Can I send from a home connection?"; "My clients live in Google Docs and Canva."

**Honest limits.** Cannot move the platforms, sending reputation, SEO suites, Canva's library, live co-editing with a client, HubSpot automation, or anyone outside the house. Ghost holds the list; sending needs an outside mailer [?]. Mixpost needs a public callback URL.

**Home fit.** Warehouse Loft (Desk & Workshop), Two-Bedroom Flat (proofs on the Dining Room table), Newcrest House (65 m2 Loft den). Alternates: City One-Bedroom Desk Nook, Walk-up Duplex Study Landing. Anchors: desk, kitchen-island, counter, dining-table, core. Props: cards, sticky notes, swatch fans.

**Shots.** A wall of paper cards used as a content calendar; a hand with a red pen on a printed proof; the Core on a shelf beside campaign books. Never: a readable screen or chart, real logos as decoration, growth-hacker clichés.

**Scripts.** Hooks: Where does your client's list actually live? / The brief is under NDA. Where did you paste it? Titles: Where does the client's list live; The brief stays on the desk.

- 15 s (21 words): "Elena sends three campaigns before lunch. The list sits in Ghost on the Core, not in a mailing service she rents." Chip: Ghost | replaces Mailchimp.
- 30 s (60 words, full text in the twin): Counter and numbers; the brief through Open WebUI; Penpot history; the Ghost list; a limit card: some of it stays out there.

### 3.12 The Lawyer (`lawyer`)

*Ingrid (38), Esperanza (47, proposed). Comfort 3/5; AI split.*

**Who.** Two to nine lawyers, one paralegal, one contested scanner; age about 30 to 68. She pays hosted tools to hold secrets and is starting to ask which could sit on a shelf in her own office. Not hostile to AI, not proud of it in public: she wants a mechanism she can explain to a client in two sentences. The campaign's audience angle names her [V, ADS.md].

**Responsible for.** Clients, for confidentiality; the profession, for technological competence [S]; the court, for every cite being real.

**Uses now.** Clio, MyCase; Microsoft 365, Dropbox; DocuSign; Westlaw, Lexis+; ChatGPT [S/?]. 65% of solos use cloud tools, 94% of firms of 50 or more [S]. LexisNexis legacy-data breach, 4 March 2026 [V].

**Hub replacements** (ranked by story strength)

| App | Replaces | Caveat | Import path | Now |
|---|---|---|---|---|
| Paperless-ngx | Evernote, Google Drive | An archive, not a matter DMS | Drop scans in the consume folder | 17 over |
| Nextcloud | Google Drive, Dropbox | Not a DMS; clients outside need reach | Google and Dropbox integration apps | 12 at cap |
| Docuseal | DocuSign | Never legally binding; outsiders need reach | Rebuild templates | 1 |
| Open WebUI | ChatGPT, Claude | No parity, speed or key | No importer; LibreChat reads exports | 17 over |
| LibreOffice | Microsoft Office, Google Workspace | Tracked changes and macros can differ | Opens .docx directly | 7 |
| VaultWarden | LastPass, 1Password | Say "the Bitwarden apps"; attachments stay | Export CSV or 1pux, Bitwarden client | 12 at cap |
| Radicale | Google Calendar, iCloud Calendar | No sharing carries over | .ics into a CalDAV client | 0 |

**Hangouts.** Lawyerist, Legal Talk Network, Above the Law, Attorney at Work, Law Society Gazette [V]; r/LawFirm [S]. Offline: CLE seminars [S], ABA TECHSHOW (Chicago, 3 to 6 March 2027) [V].

**How they talk.** Pace 140 to 150 wpm; 8 to 16 words, none over 20, silence before the limit. Precise, dry, guarded: she talks like someone who may be quoted; allergic to promises. Owns: matter, engagement letter, exhibit, cite, redline. Eye-rolls: game-changer, supercharge, disrupt. Court speech runs about 164 wpm [V]; script her lower.

- "Every page of the file is scanned and searchable. Paperless-ngx reads the stack, and I find the exhibit by a word on the page." (quote)

**Comfort.** An expert in Word, not an administrator; scans and files; cannot open a router port or restore a server. Show a named person she can call.

**AI stance.** Split; pride conflicted. Only 7% of UK and Irish clients recall being told of AI use [V]; ABA 2024 puts solos at 18%, Clio 2025 at 71% [S]. Rule: the model drafts, the person signs; one checkable chore with the lawyer reading the source; never accuracy, parity, speed or "privileged"; the headline is where the file lives.

**Triggers and objections.** Triggers: a client clause about where data goes [S]; Heppner (SDNY, February 2026: no privilege for a chatbot conversation [V]); the January subscription count [?]. Objections: "Will my redlines survive in Word?"; "What exactly can I tell a client?"

**Honest limits.** No Clio, Westlaw or Lexis replacement: no matter workspace, conflict checks, trust accounting, e-filing. Email is the hardest to move. Video with outside clients needs outside reach. Docuseal: never "legally binding". No compliance claim.

**Home fit.** Aurora (two Studies; write the desk as Study@l2), Corner Penthouse (Office and Library Nook), Garden Flat (Study). Anchors: desk, bookshelf, dining-table, core. Props: binders, legal pad, a tablet on a stand, a scanner.

**Shots.** Over the shoulder; hold on hands, paper and a pause; one cut every four to five seconds; the Core between two binders. Never: scales, gavel or marble, a readable client name or case number, an invented legal answer in a chat window.

**Scripts.** Hooks: Where does your client's file actually sit? / A signature at the desk, a PDF on the Core. Titles: A signature at the desk; Check every cite and the folder.

- 15 s (23 words): "Ingrid's question is where the client files sit. Paperless-ngx reads the stack, and she finds the exhibit by a word on the page." Chip: Paperless-ngx | replaces Google Drive.
- 30 s (53 words, full text in the twin): Scan and search; the engagement letter signed in Docuseal; folders in Nextcloud; a model draft with the original under her pencil.

### 3.13 The Journalist (`journalist`)

*Noor (36). Comfort 3/5; AI split.*

**Who.** Early 20s to late 60s; the 34 to 52 casting range is a design choice, no age split was sourced [?]. Pew (2022, 11,889 US journalists): 70% satisfied, 77% would choose journalism again [V]. She already asks "where does this file live?" before anyone else in the household, which makes the Hub argument natural.

**Responsible for.** Sources (a promise that outlives the story); the editor (accuracy, the file on time); the public (a defensible record).

**Uses now.** Google Drive, Trello, Scrivener, Evernote [V, The Open Notebook]; Otter, Trint, Rev; Pocket; ChatGPT. Muck Rack 2026: 82% use at least one AI tool, transcription tools 40% [S].

**Hub replacements** (ranked by story strength)

| App | Replaces | Caveat | Import path | Now |
|---|---|---|---|---|
| Whisper-WebUI | none listed | Weights download first; CPU only | Drop audio files in | 0 |
| Paperless-ngx | Evernote, Google Drive | Scans and PDFs only; not a DMS | Drop scans in the consume folder | 17 over |
| Obsidian | Notion, Evernote | Notes are files; not open source | Importer plugin | 14 over |
| Open WebUI | ChatGPT, Claude | No parity, speed or key | No importer; LibreChat reads exports | 17 over |
| Nextcloud | Google Drive, Dropbox | Editor sharing from outside needs reach | Google and Dropbox integration apps | 12 at cap |
| Stirling-PDF | Adobe Acrobat, Smallpdf | Never "redaction is complete" | Nothing to move | 7 |
| LibreTranslate | Google Translate, DeepL | Say nothing of quality | None | 14 over |

**Hangouts.** IRE and NICAR-L (NICAR 2027, Denver, 11 to 14 March), Online News Association, Freedom of the Press Foundation, The Open Notebook [V]; r/Journalism [?]. Offline: courthouses, libraries and archives [?].

**How they talk.** Pace 145 to 155 wpm; 8 to 14 words, cap 20, a pause before any number. Dry, plain, evidence first: "Show me." Sceptical of anyone selling, warm with sources [?]; a pun is unwelcome. Owns: source, on the record, tape, verify. Eye-rolls: game-changer, unlock, bulletproof.

- "I ask where a recording lives before I ask what it costs." (quote)

**Comfort.** Runs Signal, a password manager and a VPN app; does not edit compose files. About 4% of newsroom staff are tech professionals [V, ICFJ 2019 global survey]. Staff call newsroom IT.

**AI stance.** Split; conflicted. UK: 89% of 1,004 journalists use AI at least monthly [S]; a NewsGuild arbitration found AI tools launched without notice breached the contract [V]. Rule: one bounded chore on her own material, verified by hand; never AI writing or deciding anything with a byline; never accuracy, speed or parity.

**Triggers and objections.** Triggers: a transcription vendor's data-use terms; a press-freedom story; a source or editor asking where files sit [?]. Objections: "My sources are on Signal"; "A machine at home can be seized or fail"; "Will it invent quotes?"

**Honest limits.** Signal, WhatsApp and iMessage do not move; sources choose the channel. Remote access is not claimed. The Hub is not a source-protection tool: a device at home can be searched under a warrant [V, CPJ, January 2026]; never imply immunity.

**Home fit.** Lake Cabin (Study and Glass Prow), City One-Bedroom (Desk Nook), Two-Bedroom Flat (Study Alcove). Alternates: Warehouse Loft, Garden Flat Study. Anchors: desk, bookshelf, dining-table, core. Overlay props needed: handheld recorder, headphones, paper notebook, binder. The placeholder Maya is on the avoid list.

**Shots.** The tape beside a notebook with the laptop turned away; a hand on printed records; the Core on a shelf in daylight. Eye level, no whip pans. Never: outlet logos, press cards, hooded hackers, police or seizure drama, the Core as a vault.

**Scripts.** Hooks: Your source trusted you with a recording. Where does it sit tonight? / Transcribe the interview. Keep the interview. Titles: Transcribe the interview, keep it; Eighty pages, one question.

- 15 s (24 words): "Noor finishes an interview at the kitchen table. Whisper-WebUI turns the recording into text on the Core. She checks every quote against the audio." Chip: Whisper-WebUI (no replaces chip).
- 30 s (52 words, full text in the twin): The hook; notes in Obsidian; records in Paperless-ngx; the model finds the page and she reads it; some chores stay where sources are.

### 3.14 The Educator (`educator`)

*Eszter (49), Araxi (67). Comfort 3/5; AI pragmatic.*

**Who.** Aged 28 to 58: a couple where one adult teaches, a single teacher, a homeschool parent, a retired teacher who still tutors. US teachers say they work about 50 hours a week and only 45% are satisfied with pay [V, Gallup]. The week is six lessons a day, then the Sunday pile.

**Responsible for.** Marks someone can appeal; replies to parents in the right language; children's own work (English guidance: it must not train AI models without permission [V, DfE]).

**Uses now.** Google Docs, Drive, Google Classroom, PowerSchool, ClassDojo, ChatGPT, Google Translate. One compromised support credential at PowerSchool in December 2024 exposed names and contact details [V]; Google turned Jamboard boards into PDFs in 2025 [V].

**Hub replacements** (ranked by story strength)

| App | Replaces | Caveat | Import path | Now |
|---|---|---|---|---|
| Open WebUI | ChatGPT, Claude | Never grades; no parity or hours figure | No importer; LibreChat reads exports | 17 over |
| Paperless-ngx | Evernote, Google Drive | Scans and PDFs only; not a DMS | Drop scans in the consume folder | 17 over |
| Nextcloud | Google Drive, Dropbox | Home network only; share links do not carry | Google and Dropbox integration apps | 12 at cap |
| LibreOffice | Microsoft Office, Google Workspace | Tracked changes and macros can differ | Opens .docx directly | 7 |
| LibreTranslate | Google Translate, DeepL | Say nothing of quality | None | 14 over |
| Joplin Server | Evernote | Server only; licence not open source | ENEX import | 5 |
| Razzia | none listed | No question bank; home network only | Retype questions | 0 |

**Hangouts.** r/Teachers (about 2.4M, aggregator) [S]; Truth for Teachers, Tes community, Teacher Tapp, HSLDA, Edutopia [V]. Offline: staff room [?], Bett UK (20 to 22 January 2027) [V]. They trust peers, not brands.

**How they talk.** Pace 140 to 150 wpm; 8 to 14 words, never past 20. Dry and practical; humour often dark about workload [?]; protective of the children and their evenings. Owns: scheme of work, exit ticket, rubric. Eye-rolls: digital natives, AI-powered, "saves you hours". "I use it for the paperwork, not for the child."

- "Report comments are the worst of my week. The model on the Core drafts one from my rubric, and I rewrite it in my own words." (quote)

**Comfort.** Runs a class platform, exports a gradebook to CSV; cannot edit config files. Computing teachers are a 4, a humanities lecturer 2 to 3 [?]. Calls the school IT ticket.

**AI stance.** Pragmatic, quiet, split. Gallup 2025: 60% of US teachers used AI for work; 40% favour AI in schools, 28% oppose; 19% have a school policy [V]. Rule: a model on the Core does one named chore from the teacher's own materials, then she rewrites it; never grading or deciding about a child; never an hours figure.

**Triggers and objections.** Triggers: a breach in the news; a platform ending a feature (Jamboard); a closing school account [?]. Objections: "Does it work with Google Classroom?" (No. Say so.); "Is this allowed under our data policy?" (never claim compliance).

**Honest limits.** No learning platform, gradebook or student information system is in the store. Never a class list, a grade or a safeguarding note at a home Core. Remote access is not claimed. No FERPA or UK GDPR claim.

**Home fit.** Mediterranean Villa (Dining Room trestle table), Palm Knoll, Twin Gable House (Study), Walk-up Duplex, Modern Pavilion (lessons at home). Alternate: Yellow Family Home playroom for a homeschool home. Anchors: desk, bookshelf, dining-table, kitchen-island, core. The placeholder Hana is already cast.

**Shots.** The Sunday pile in low sun; a worksheet sliding into a scanner tray; the class set with one gap; a hand crossing out a draft sentence. Never: any screen, real children, school logos, class lists, pupil names or slips with names on a home Core, AI marking, the midnight martyr.

**Scripts.** Hooks: The Sunday pile goes to the Core, not the school bag. / Where does the Sunday pile end up? Titles: The pile goes to the Core; Report comments, rewritten by hand.

- 15 s (22 words): "Eszter marks at the dining table. A model on the Core drafts the report comments from her rubric. She rewrites every one." Chip: Open WebUI | replaces ChatGPT.
- 30 s (48 words, full text in the twin): Six lessons and the Sunday pile; handouts in Paperless-ngx; a parent's note in LibreTranslate; the school keeps the gradebook.

## 4. The story rules this book implies

**4.1 Twelve rules for writers**

1. **One chore, one app, one limit per beat.** The hero is the chore (the invoice found by one word, the diff read, the transcript checked), never the AI. The limit rides in the same beat, in the persona's voice: beta, home network, "it can be wrong".
2. **AI is never the hook or the first beat.** Keep to the ceilings in 2.2. Say "a model on the Core" or "agent"; never assistant, chatbot, "AI-powered", a hosted-model name, a key, parity, speed or accuracy. The human finishes: reads the diff, rewrites the comment, checks the quote, signs the letter.
3. **Say where the thing sits, not how safe it is.** Template: "<Person> keeps <thing> in <App> on the Core, not in <the rented place>." Private, secure, safe, offline, never leaves, 100% local, compliant, privileged and legally binding fail the lint; "stays on the Core by default" passes.
4. **Open on the persona's own noun inside three seconds.** Invoice, repository, brief, proof, quote, transcript, rota, recipe tin, handout. Not "Meet X". A video hook runs 6 to 12 words; a popup title is six words at most with no digits.
5. **Match the register in table 1.2.** A contractor averages nine words and speaks in fragments; a lawyer runs 8 to 16 and never promises; a builder is falsifiable in one sentence. Use trade words as nouns (diff, redline, snag list), never the eye-roll list.
6. **Write to 150 words a minute; let silence carry the persona.** One synthetic voice, so pace is sentence length and pauses. After a 2-second label and before a 3.5-second end card: 15 s up to 27 words, 20 s up to 40, 30 s up to 62. Half a second of quiet after each honest limit; bodies under 30 words, about 26 at 36 px.
7. **Children and teens never speak.** A `say` line needs a companion and no child is voiced (validator); teens have none in the cast and stay silent here too. Tell minors in third-person captions, address the adult for under-18 learners and gamers, never quote a child's question.
8. **Narration is third person, present tense; first person only in a labelled adult quote.** Second person only in the pivot ("Your side projects can come home too"). One quote per cut at most, 30 words or fewer, never praise for the product, never a customer or testimonial voice.
9. **Chips carry the comparison; sentences never attack.** First chip is the catalog name (Docuseal, VaultWarden, Paperless-ngx), then "replaces <X>" from the app's own list. The validator exempts a `replaces` chip from cap-parity, but "replaces ChatGPT" in a sentence fails: write "an alternative to". The villain is a pattern, never a company.
10. **Carry each persona's honest limits.** Always: remote access is not claimed, the Core is not a backup, Companion OS, Agents and Memory are beta. Then the persona's own: no Clio or gradebook or Lightroom, no source protection, no tax claim, Valve keeps the account. A limit said lightly beats a footnote.
11. **Lead with apps that have headroom.** The fleet cap is 40% of homes (12 of 30; 14 of 36). Paperless-ngx (17), Immich (19), Open WebUI (17), Kiwix (18) and HortusFox (18) are over it; Nextcloud, VaultWarden, Forgejo and Companion Planning sit at 12. Give each new persona its specific app: Whisper-WebUI, Invoice Ninja, Docuseal, HomeBox, Radicale, Solidtime, Ghost, Penpot, Pi-hole.
12. **Use the cast member's name, never a placeholder.** Maya, Imani, Dara, Marek, Odile and Hana are researchers' placeholders: Maya is on the avoid list (with Ben, Sarah, Dana, Alex, Sofia, Priya, Jordan, Lilia) and Hana is cast. A first name appears at most twice in the fleet, flagships excepted. No surnames in lines, no "Smith".

**4.2 Red lines by persona (never say)**

| Persona | Never say or imply |
|---|---|
| Organiser | private, secure, offline; a valid signature, compliance or tax readiness; files from the road; a client file in a chatbot |
| Builder | work code moving; a hosted-model name, key, parity or speed; "AI-powered"; explaining Git; a CI run on screen |
| Gamer | a game title, frame rate, "gaming PC"; Discord moving; a teen talking to an AI companion; "writes your essay" |
| Learner | grades, time saved, "kid-safe", hiding things from parents; a child speaking; slang; a student discount |
| Maker | generate, prompt, AI art; promising Photoshop or a DAW; a public portfolio; "creator" or "content" |
| Host | an assistant that books or pays; a child's homework; "this recipe is safe"; the shop-aisle list (remote) |
| Tech Family | VPN, NAS, home server, remote, tunnel; opening on a breach; "wife acceptance factor"; "easy"; parental control |
| Business Owner | payroll, tax or accounting advice; a testimonial; clients signing from outside; "leave your accountant" |
| Creative | trained on, makes the art, learns your style; vendor accusations; Lightroom or Premiere replacement; a backup claim |
| Contractor | "from site"; "tax ready"; "easy", "save"; a van or ladder as hero; mocking the trade; leading with AI |
| Marketer | better copy, results, time or money saved; "replaces the marketer"; sending reputation; an accusation beside a brand |
| Lawyer | privileged, compliant, legally binding, accurate; "replaces Clio"; scales and gavels; AI as the headline |
| Journalist | source protection or legal immunity; AI writing a byline; accuracy, speed or parity; vendor-bashing verbs |
| Educator | a model grading or ranking; hours saved; FERPA or GDPR compliance; Google Classroom named as replaced; pushing AI |

**4.3 Twelve rules for cinematographers**

1. **Hands and objects first; no screen is readable.** No app UI, mockup, recording, dashboard or chat window. The app appears only in the popup chips. Hold on the approval gesture, not on an interface.
2. **Daylight and golden hour only.** Warm window light, honest shadows, Braun and Muji, copper only on the Core. No night, neon, glow or RGB, including for the developer, teacher and lawyer after hours: shoot the hour before dusk.
3. **The Core appears once per cut, on a shelf, last where the script allows.** A stylised drawing, never a render that could pass for a photograph, never a hero. Pair a wide of desk and Core on one wall with a close of hands. Between two binders for the lawyer; beside the router for the tech family.
4. **Resolve every beat to a real anchor.** Use the chain in the chapter and fall back to the universal roles (street, front-door, core, room, couch, counter, garden). Today only 16 of 165 organiser beats reach a desk: shoot the person at work, not a box. The contractor needs `room` set to the garage.
5. **Frame by persona.** Medium at the desk (organiser); behind or beside the screen, never over the shoulder (builder); bench height (contractor); waist height (host); seated eye level (learner); over the shoulder, one cut every four to five seconds (lawyer); steady, no whip pans (journalist).
6. **Move slowly and hold the prop.** The engine cannot set a speed (the baked walk is 1.5 m/s indoors, `track.ts`): get the slow feel from anchors close together, a look locked on the prop and a hold of three to four seconds before the card [house]; the card covers no more than 2% of the subject. Still frames on the limit line.
7. **People are monogram discs, backs and hands.** No faces, no minors' faces, no child alone at night, no teen talking to an AI companion. Pair every tinkerer shot with a reaction from someone who does not tinker. "Fictional family. Real software." in the first two seconds and on the end card.
8. **Props come from the home's item list.** Available: desks, laptop, printer, bookshelf, easel, record-player, workbench, whiteboard (one home), trestle-table. To author: scanner, receipt shoebox, recorder, binder, legal pad, label maker. No van, ladder or toolbox among the 226 item types. The `server-rack` LEDs are emissive. Ask only for props the engine can seat without clipping walls or other props (z-fighting); wall items sit flush.
9. **Never show, for every persona.** Third-party logos alone; real client names, case numbers or amounts; app screens; a hooded hacker, padlock or shield; scales or gavel; an apple on a desk; the frazzled mother; the midnight martyr; an RGB gamer; breach imagery; real or AI-made art; before-and-after splits.
10. **Plan 9:16 as its own track, with type that fits.** Modal and caption text is 36 px or larger: shoot negative space. The member's name is a spaced capital kicker (S A L L Y); captions stay sentence case, two lines of 42 characters. Keep the lower third free for the popup card.
11. **Choose rooms the persona truly uses.** Contractor: garage, mudroom, driveway. Creative: studio and the client at the dining table. Educator: the dining table and the Sunday pile. Avoid rooms that fight the persona: the toddler bed in Stone Gable's Study, Palm Knoll's gaming chair, Seraphine's rocking horse.
12. **Show the limit as a held still, then the beta line.** Half a second of quiet and no camera move on the limit; the beta line beside any software claim; the end card holds 3.5 seconds with See Companion Core and ci.computer/core. Scripted scenes are never labelled recordings.

## 5. Casting recommendations

**5.1 Principles.** Flagship homes stay. 19 members in 16 homes are recast where a room, prop or job already fits, keeping name, age and role and changing archetype and work. The six apartments are cast afresh (18 proposed names, checked against 171 cast and retired names and the avoid list). Every family keeps two or more archetypes. After recasting, families per archetype: organiser 16, builder 16, gamer 9, learner 21 (gate: six), maker 5, host 11; business-owner 4, contractor 3, creative 5, educator 5, journalist 3, lawyer 3, marketer 3, tech-family 3. Households are the casting.json four: couple, young family, older kids, grandparents.

**5.2 The 36 homes**

| Home (id) | Slug | Household | Persona mix | Rooms that carry it |
|---|---|---|---|---|
| Seraphine (`seraphine`) | brennan | older kids (flagship) | Sally organiser, John builder, Steve gamer, Jean learner. Keep. | Master Suite desk, Library with the Core, two kids' desks. |
| Stone Gable House (`bgfamily`) | brennan-hollin | older kids (flagship) | Keep the four. | Front Study desk and shelf; the Study holds a toddler bed. |
| Split-Level Family House (`familyhouse-nora`) | brennan-merrow | older kids (flagship) | Keep the four; John is the native tech-family stage. | Garage workbench 47 m2, Craft Room desk, Den 60 m2, whiteboard. |
| Modern Asymmetry House (`asymmetry`) | adeniran | older kids, business | Folake organiser, Kunle contractor (was builder), Tobi gamer, Ife learner. | Garage 23 m2 workbench, Laundry 29 m2, Entry shoe-rack. |
| Mediterranean Villa (`mediterranean`) | kovacs | older kids | Eszter educator (was organiser), Gabor builder, Bence gamer, Reka learner. | Dining Room trestle table, grand piano, TV Room. |
| Epiphany (`epiphany`) | haddad | older kids, adult child, business | Dalia creative (was organiser), Samir tech-family (was builder), Yasmin learner. | Den 26 m2 as studio; Garage 42 m2 workbench. |
| Villa Mesa Mariposa (`mesamariposa`) | iyer | older kids, business | Meenakshi organiser, Ravi creative (was maker), Arjun gamer, Kavya learner. | Record player, Kids' Room easel, Garage, Conservatory Dining. |
| The Mirage (`mirage`) | tesfaye | older kids | Keep: Hana organiser, Dawit builder, Selam learner, Bruk maker. | No desk anywhere; upright piano in the Living Salon. |
| Modern Studio House (`modernhouse1`) | moreau | older kids | Keep. Alternate: Claire lawyer. | Library Lounge, Kitchen island, Kids Room. |
| Cocoon (`cocoon`) | quintero | young family | Marisol organiser, Andres tech-family (was builder), Camila learner, Mateo maker. | Garage 39 m2 workbench, Den, Foyer bench for the router. |
| Black Tower Modern (`modernhome-nora`) | nguyen | young family | Keep. Alternate: Duc tech-family. | Garage & Utility 15 m2; Kids' Room with desk and laptop. |
| Palm Knoll (`palnknoll`) | hwang | young family | Minjung educator (was organiser), Jiho builder, Yuna learner. | Undercroft 50 m2 with low shelves; avoid the gaming chair. |
| Garden Nook (`gardennook`) | kamau | young family | Keep: Wanjiru builder, Juma host, Zuri baby. | Garden Nook, Dining, Playroom. |
| Lake Cabin (`lakecabin`) | chaudhry | young family | Noor journalist (was builder), Imran host, Zara baby. | Study 19 m2 with shelf and easel: the book retreat. |
| Newcrest House (`newcrest`) | petrov | young family | Elena marketer (was organiser), Nikolai host, Mila baby. | Loft den 65 m2 with desk for the card wall; Kitchen island. |
| Grey Starter Cottage (`starter18k`) | cardoso | young family | Keep. | One bedroom, no desk; Kitchen and Dining. |
| Yellow Family Home (`familyhome`) | whitaker | young family, business | Keep: Hannah organiser (a practice of one), Callum host. | Playroom 20.7 m2 with easel, trestle Dining Room. |
| Twin Gable House (`bghouse-olcia`) | hovsepian | grandparents, business | Araxi educator (was organiser), Hagop builder, Nare learner. | Study 21 m2, Family Room TV, Garage workbench. |
| Cute Starter Cottage (`cutestarter`) | nwachukwu | grandparents | Keep. | 78 m2; Dining trestle table; Kids Corner. |
| Blue Dormer Cottage (`onestory`) | dekker | grandparents | Keep. | Fireside Nook shelf; Kitchen. |
| Riverbend Drive (`riverbend`) | watanabe | grandparents (three generations) | Yoshiko host, Haruo maker, Emi contractor (was builder), Kenji learner, Sora baby. | Two-Car Garage 53 m2, Mudroom & Laundry, driveway. |
| Aurora (`aurora`) | halvorsen | couple, business | Ingrid lawyer (was organiser), Mats builder. | Two Studies (write the desk as Study@l2), Kitchen 36 m2. |
| Modern Pavilion (`modernhouse-nora`) | rahimi | couple, business | Parisa organiser, Kian educator (was maker). | Primary Bedroom guitar stand, Living Room. No desk. |
| Payorote (`payorote`) | salazar | couple, business | Valeria creative (was maker), Rafael builder. | Dressing Loft studio 12 m2 with desk and easel. |
| Sunny Home (`sunnyhome`) | adler | couple, business | Ruth business-owner (was organiser), Noam builder. | Dining trestle table (Friday money hour), Upper Landing desk. |
| The Palms (`palms`) | banerjee | couple, business | Keep. | Stair Study with grand piano and desk. |
| New Eco House (`neweco`) | jankowski | couple, business | Agnieszka business-owner (was organiser), Tomasz tech-family (was builder). | Garage 33 m2 workbench, Breakfast Nook, Dining Room. |
| Flowery Cottage (`flowerycottage`) | tuala | couple, business | Malia creative (was maker), Sione contractor (was builder). | Sunroom 36 m2 easel, Study, Garage 33 m2, driveway. |
| Valley-View Villa (`valleyview`) | gill | couple | Keep. | Reading Lounge, Garden Room, Kitchen. |
| Vanilla House (`vanilla`) | mbatha | couple, business | Keep: Thandi host (sells plants), Sipho builder. | Library 36 m2, Greenhouse, Kitchen. |
| Warehouse Loft (`studio-loft`) | new family | couple | Zainab marketer (34), Joaquin creative (37). | Desk & Workshop with workbench, record player on the platform. |
| City One-Bedroom (`city-one-bed`) | new family | couple, business | Dara business-owner (41), Soraya journalist (37). | Shop West and East in the building, Desk Nook. |
| Two-Bedroom Flat (`two-bed-flat`) | new family | young family | Lindiwe marketer (36), Matthias journalist (38), Tomi maker (6). | Study Alcove, Dining Room, Kids' Room with easel. |
| Corner Penthouse (`corner-penthouse`) | new family | older kids, business | Esperanza lawyer (47), Takumi business-owner (45), Anselm gamer (16), Yara learner (14). | Office, Library Nook, Corner Shop in the building. |
| Garden Flat (`garden-flat`) | new family | grandparents | Winifred lawyer (67), Anwar host (65), Petra learner (9). | Study, Garden Terrace 16 m2, Grandchild's Bedroom. |
| Walk-up Duplex (`walkup-duplex`) | new family | older kids | Ferdinand educator (44), Chinwe builder (42), Ayaan learner (13), Dmitri gamer (16). | Kitchen & Dining 28 m2, Study Landing desk. |

**5.3 Schema impact**

New `member.archetype` values, kebab-case, in the owner's order: `tech-family`, `business-owner`, `creative`, `contractor`, `marketer`, `lawyer`, `journalist`, `educator` (existing: organiser, builder, gamer, learner, maker, host). Files to change:

| File | Change |
|---|---|
| family.schema.json | `member.archetype` enum: add the eight values. |
| assets/story/types.ts | `ARCHETYPES`; a test keeps schema, constant and personas.json equal. |
| content/story/personas.json | Eight new `archetypes` rows (below). No new role ids. |
| scripts/story/lib/persona.mts | The `persona-spread` message names six archetypes. |
| scripts/story/lib/fleet.mts | `CORE_ARCHETYPES` stays four, each above the gate of six after recasting (organiser 16, builder 16, gamer 9, learner 21). Restate `FLEET.families` and the app cap. |
| catalog-apps.json, reviewed.json | Missing entries; review entries for no-screenshot apps. |
| personas.md, persona-apps.md | Add the eight archetype sections from the chapters. |

Rows to paste into `archetypes` in `content/story/personas.json` (valid JSON; rooms are schema `roomRole` values, anchors are `roles.json` ids, apps are in the catalog). Needing a `reviewed.json` entry for lack of a QA screenshot: whisper-webui, solidtime, radicale, homebox, ollama, syncthing, photoview, calibre-web, miniflux.

```json
{
  "tech-family": {
    "label": "Tech family",
    "description": "The household lead of a family that already runs its own network, lamp rules and a few apps: the rest of the family is the acceptance test.",
    "example": "Andres",
    "rooms": ["garage", "office", "entry", "living"],
    "fallbackRooms": ["bedroom", "dining"],
    "anchorRoles": ["room", "desk", "core", "counter"],
    "fallbackAnchorRoles": ["couch", "tv", "kitchen-island", "bookshelf"],
    "apps": ["home-assistant", "pi-hole", "forgejo", "ntfy", "uptime-kuma", "open-webui", "ollama", "vaultwarden", "n8n", "syncthing"]
  },
  "business-owner": {
    "label": "Business owner",
    "description": "Runs a shop, studio, agency or practice of one to fifteen people: quotes, invoices, contracts and the customer list.",
    "example": "Ruth",
    "rooms": ["office", "dining", "living", "kitchen"],
    "fallbackRooms": ["bedroom", "entry"],
    "anchorRoles": ["desk", "dining-table", "counter", "bookshelf"],
    "fallbackAnchorRoles": ["kitchen-island", "couch", "room"],
    "apps": ["nextcloud", "invoice-ninja", "paperless", "docuseal", "akaunting", "twenty", "vaultwarden", "anything-llm", "solidtime", "grist", "bookstack", "baikal", "libreoffice", "stirling-pdf", "whisper-webui", "ci-memory"]
  },
  "creative": {
    "label": "Creative",
    "description": "A working designer, photographer, filmmaker, illustrator or musician: client work, an archive that outlives the job, and a brief that is confidential.",
    "example": "Dalia",
    "rooms": ["office", "living", "bedroom", "garage", "dining"],
    "fallbackRooms": ["kids"],
    "anchorRoles": ["easel", "desk", "music", "bookshelf"],
    "fallbackAnchorRoles": ["dining-table", "tv", "couch", "room"],
    "apps": ["immich", "nextcloud", "penpot", "inkscape", "open-webui", "invoice-ninja", "vaultwarden", "whisper-webui", "docuseal", "freecut", "audiomass", "photoview", "pingvin-share", "syncthing", "navidrome"]
  },
  "contractor": {
    "label": "Contractor",
    "description": "A self-employed tradesperson or small building contractor: the quote, the site photos, the tools and the warranty cards, run from the garage bench.",
    "example": "Kunle",
    "rooms": ["garage", "office", "entry", "laundry"],
    "fallbackRooms": ["dining", "kitchen", "living"],
    "anchorRoles": ["room", "desk", "driveway", "laundry"],
    "fallbackAnchorRoles": ["bookshelf", "kitchen-island", "dining-table", "core"],
    "apps": ["invoice-ninja", "immich", "homebox", "lubelogger", "paperless", "docuseal", "solidtime", "vaultwarden", "nextcloud", "radicale", "stirling-pdf", "open-webui", "planka", "akaunting"]
  },
  "marketer": {
    "label": "Marketer",
    "description": "A freelance or in-house digital marketer: the client's list, files and briefs sit at home and the drafting model runs on the Core.",
    "example": "Elena",
    "rooms": ["office", "living", "dining", "kitchen"],
    "fallbackRooms": ["bedroom"],
    "anchorRoles": ["desk", "kitchen-island", "counter", "dining-table"],
    "fallbackAnchorRoles": ["bookshelf", "couch", "room"],
    "apps": ["open-webui", "ci-memory", "nextcloud", "ghost", "penpot", "vaultwarden", "twenty", "whisper-webui", "listmonk", "plausible", "n8n", "inkscape", "freecut", "mixpost", "solidtime", "grist"]
  },
  "lawyer": {
    "label": "Lawyer",
    "description": "A solo or small-firm attorney: the client file, the engagement letter and a first-pass summary she checks line by line.",
    "example": "Ingrid",
    "rooms": ["office", "dining", "living"],
    "fallbackRooms": ["bedroom", "kitchen"],
    "anchorRoles": ["desk", "bookshelf", "dining-table"],
    "fallbackAnchorRoles": ["couch", "kitchen-island", "room"],
    "apps": ["paperless", "nextcloud", "docuseal", "open-webui", "libreoffice", "vaultwarden", "stirling-pdf", "cryptgeon", "ollama", "whisper-webui", "radicale", "solidtime", "invoice-ninja", "bookstack", "twenty", "ci-memory"]
  },
  "journalist": {
    "label": "Journalist",
    "description": "A reporter, writer or researcher: the tape, the notes and the records sit on the Core and every quote is checked against the audio.",
    "example": "Noor",
    "rooms": ["office", "dining", "kitchen", "living"],
    "fallbackRooms": ["bedroom"],
    "anchorRoles": ["desk", "bookshelf", "dining-table"],
    "fallbackAnchorRoles": ["couch", "kitchen-island", "room"],
    "apps": ["whisper-webui", "paperless", "obsidian", "open-webui", "nextcloud", "vaultwarden", "ci-memory", "stirling-pdf", "libretranslate", "linkwarden", "libreoffice", "cryptgeon", "joplin", "anything-llm", "miniflux", "element"]
  },
  "educator": {
    "label": "Educator",
    "description": "A teacher, tutor, lecturer or homeschooling parent: lesson folders, handouts and report comments the teacher rewrites by hand.",
    "example": "Eszter",
    "rooms": ["dining", "office", "living", "kitchen", "kids"],
    "fallbackRooms": ["bedroom"],
    "anchorRoles": ["dining-table", "desk", "bookshelf", "kitchen-island"],
    "fallbackAnchorRoles": ["easel", "couch", "room"],
    "apps": ["open-webui", "paperless", "nextcloud", "libreoffice", "libretranslate", "joplin", "stirling-pdf", "vaultwarden", "kiwix", "razzia", "excalidraw", "ci-planning", "radicale", "calibre-web"]
  }
}
```

Optional: add `inkscape`, `audiomass`, `penpot` to the `maker` pool. A `workbench` role is a showrunner decision; contractor and tech family use `room` with the garage.

**5.4 Which story files each new persona could replace a member in**

| Persona | Primary (recast) | Alternates |
|---|---|---|
| Tech Family | `quintero.json`: Andres (builder, 5 beats now); `haddad.json`: Samir (builder, 5 beats now); `jankowski.json`: Tomasz (builder, 8 beats now) | nguyen (Duc, cloud engineer); watanabe (Emi); hwang (Jiho); moreau (Etienne). Not brennan-merrow: flagship. |
| Business Owner | `adler.json`: Ruth (organiser, 11 beats now); `jankowski.json`: Agnieszka (organiser, 9 beats now) | whitaker (Hannah) stays an organiser while her practice is one person; mbatha (Thandi, plants) if a shop story is wanted; halvorsen (Ingrid) if the lawyer goes elsewhere. |
| Creative | `haddad.json`: Dalia (organiser, 6 beats now); `iyer.json`: Ravi (maker, 5 beats now); `salazar.json`: Valeria (maker, 9 beats now); `tuala.json`: Malia (maker, 8 beats now) | banerjee (Ananya, product design studio); adler (Ruth); rahimi (Kian, if not an educator). |
| Contractor | `adeniran.json`: Kunle (builder, 5 beats now); `watanabe.json`: Emi (builder, 3 beats now); `tuala.json`: Sione (builder, 8 beats now) | nguyen (Duc); quintero (Andres); hovsepian (Hagop is retired). Re-word Kunle's "firmware contractor" first. |
| Marketer | `petrov.json`: Elena (organiser, 9 beats now) | banerjee (Ananya); halvorsen (Ingrid); cardoso (Beatriz, charity coordinator). Apartments carry the rest. |
| Lawyer | `halvorsen.json`: Ingrid (organiser, 8 beats now) | moreau (Claire, hospital administrator); tesfaye (Hana); palms (Ananya). Apartments carry the rest. |
| Journalist | `chaudhry.json`: Noor (builder, 8 beats now) | kamau (Wanjiru, remote developer); mbatha (Sipho); tesfaye (Dawit). Apartments carry the rest. |
| Educator | `kovacs.json`: Eszter (organiser, 5 beats now); `hwang.json`: Minjung (organiser, 6 beats now); `hovsepian.json`: Araxi (organiser, 7 beats now); `rahimi.json`: Kian (maker, 7 beats now) | dekker (Willem, retired accountant, tutoring); nguyen (Linh); gill (Jaswinder, retired pharmacist). Apartment: Walk-up Duplex. |

The primary recasts rewrite about 132 beats. Each recast member needs three beats, one in a room and one with an app from the new pool (`persona-cover`); a business family keeps five small-business beats. No file was edited: `casting.json` is regenerated by `build-casting.mts`.

## 6. Open questions and evidence gaps

**Open questions for the owner**

1. **Archetype or lens?** Add eight values to `member.archetype` (5.3) or carry some as v3 `member.lens` values (tinkerer, shop-owner, freelance-creative and tradesperson are named in the v3 plan's lens seed, `w7/lenses.seed.json`; `member.lens` is not in the schema yet). Tech Family is a household, not a member.
2. **Recast or add?** The plan recasts 19 members in 16 homes and casts six apartments; flagships stay. It rewrites about 130 beats, and `casting.json` is regenerated by `build-casting.mts`, never by hand.
3. **Fleet gates at 36 homes.** `FLEET.families` is 30; the 40% app cap (12 of 30 becomes 14 of 36) and the uniqueness and count metrics need restating.
4. **Chip grammar.** Keep `replaces <X>` or adopt `alternative to <X>` fleet-wide (v3 D5).
5. **Quotes and the ad rule.** ads.md says silent cuts carry no customer quote. Adult quotes here are for voiced film narration in the disclosed synthetic voice. Confirm that a labelled fictional adult quote is acceptable.
6. **Remote access.** ADS.md 9.3 lists ten tunnels on Hub Pro while claims.json forbids remote claims. Contractor, lawyer, journalist, educator, creative and business owner hit this wall hardest.
7. **Catalog gaps.** Hoppscotch, IT-Tools, Woodpecker CI, Fireshare, Etherpad, Quarkdown, Beatsync, Dropgate and Mainsail are live but unnameable. `reviewed.json` entries are needed for no-screenshot apps (Whisper-WebUI, Solidtime, Radicale, HomeBox, Ollama, Syncthing, Photoview, Calibre-Web, Miniflux).
8. **Props to author.** Scanner, receipt shoebox, recorder, binder, legal pad, label maker, phone; optionally a workbench anchor role.
9. **Under-13 AI.** Nguyen's Mai (11) has a chat-model beat; UNESCO's 2023 guidance sets 13 [S]. Decide whether it survives.
10. **Kiwix.** It installs empty and the Hub cannot add a library (v3 D8): scripts say "downloaded once" until then.
11. **Apartment names.** Section 5.2 proposes 18 names and ages; confirm or replace. Companion names come from the cast step.
12. **Synthetic partner voice.** The tech-family 30-second cut gives the partner a disclosed synthetic voice and no face. Confirm.
13. **Casting skew.** By given name (a heuristic: names do not fix a gender), all seven cast gamers and all three tech-family leads read as male, all three lawyers and all three marketers as female, and 12 or 13 of 14 organisers as female, while this book asks writers to "vary who tinkers" and not to put a girl or a boy in the gamer role by reflex. Decide before casting whether to recast one lead per persona (candidates: Wanjiru or Chinwe as the tech-family lead, Selam or Yara as a gamer, a man as one of the three marketers).
14. **Uniqueness gate.** Beat titles outside the first-run chapter and beat bodies must be unique across the whole fleet (`fleet-unique`, an error in every run). The playbook's cards are patterns: 41 of the 54 shots its casting notes use appear in two or more homes with a title that carries no name, 221 beats in all. Each home needs its own title and body; see playbook section 4.
15. **Fleet app cap at 36 homes.** The cap is 14 homes (40%). Applied literally, the playbook's casting notes put Paperless-ngx in 26 homes, Nextcloud in 24, Gitea in 16, Open WebUI in 15 and LibreTranslate in 15. Rotate the first-choice shot with the persona's other app shots.
16. **Age fit.** Twelve learners (aged 6 to 12) and three makers (6 to 8) in the cast are under 13; no host is. Their shots must be parent-led and must not use the French paragraph, the proof or any chat model; the playbook now says so in section 4.

**Evidence gaps**

- Reddit refused every read in all fourteen files; subreddit tone, rules and sizes are [S] from aggregators or [?]. A human should read r/selfhosted, r/smallbusiness, r/Teachers, r/Construction and r/LawFirm before any rule is quoted.
- Speaking pace is unmeasured for every persona. Only benchmarks exist: audiobooks 150 to 160 wpm [S], court speech about 164 [V], US conversation 164 to 196 [V].
- No survey measures how any persona feels about a local model on a home machine. Pride is [?] for all fourteen; the numbers measure use.
- Muck Rack, GIJN, ABA, Clio, Quizlet, Khan Academy, ContractorTalk and the Paperless-ngx docs blocked reads; their figures come from trade press and are tagged [S].
- Age curves are missing for business owners, contractors, marketers and journalists; casting ages are design choices. No UK small-business AI survey for the organiser.
- No sourced example of a client clause driving a move for consultants, creatives or contractors.
- Nothing was run end to end: Steam Headless on a Hub Core GPU, Pi-hole's default upstream, Forgejo and Open WebUI importers, CircleCI to Woodpecker.
- Vendor surveys (Housecall Pro, ServiceTitan, Intuit, VSCO, Adobe, Qlik) survey their own customers: upper bounds.
- Two inputs moved during research: app-media.json clearance and per-app home counts (family files were being edited). Re-read before printing.
- Event dates, sizes and prices change; everything is dated 2026-10-19.
- Skeptic: 22 cited addresses answer 403 to a plain client (BLS ATUS and occupational pages, Adobe terms, LastPass blog, JCQ, Gartner, GIJN, Muck Rack, Ofcom and others); their [V] tags stand on the original read and were not re-checked. A BLS figure was re-read through a fetch tool.

## Appendix A. Sources and evidence grades, by persona

All read 2026-10-19. Skeptic status check of all 607 addresses cited in this book (sources, hangouts, import paths), 2026-10-19: 581 answer 200; 2 are dead (404, marked below); 22 refuse a plain client with a bot wall (403) and could not be re-read, so their [V] rests on the original read; 1 fails the certificate check and 1 answers 202 with no page. A URL shared by personas is listed once, under the first. Titles, kinds and every persona link are in the twin (`sources`).

**The Organiser**

- [V] https://www.pewresearch.org/internet/2026/06/17/the-gender-gap-in-ai/
- [V] https://www.pewresearch.org/social-trends/2025/02/25/u-s-workers-are-more-worried-than-hopeful-about-future-ai-use-in-the-workplace/
- [V] https://www.brookings.edu/articles/how-are-americans-using-ai-evidence-from-a-nationwide-survey/
- [V] https://www.library.hbs.edu/working-knowledge/women-are-avoiding-using-artificial-intelligence-can-that-hurt-their-careers
- [V] https://www.uschamber.com/technology/empowering-small-business-the-impact-of-technology-on-us-small-business
- [V] https://ec.europa.eu/eurostat/statistics-explained/index.php?title=Use_of_artificial_intelligence_in_enterprises
- [V] https://newsroom.cisco.com/c/r/newsroom/en/us/a/y2024/m01/organizations-ban-use-of-generative-ai-over-data-privacy-security-cisco-study.html
- [V] https://daily.jstor.org/the-gendered-labor-of-noticing-and-anticipating
- [V] https://www.bls.gov/news.release/atus.nr0.htm
- [V] https://www.census.gov/library/stories/2025/05/smallest-businesses.html
- [S] https://www.staffingindustry.com/news/global-daily-news/number-of-independent-workers-rises-again-mbo-partners
- [V] https://selfh.st/survey/2025-results/
- [V] https://raw.githubusercontent.com/selfhst/cdn/main/assets/surveys/annual/2025-results.json
- [V] https://9to5google.com/2025/01/15/google-workspace-price-increase-2025/
- [V] https://techcrunch.com/2023/11/29/its-official-evernote-will-restrict-free-users-to-50-notes
- [V] https://www.helpnetsecurity.com/2022/12/23/lastpass-breach-customer-vault/
- [V] https://www.cozi.com/
- [V] https://nextcloud.com/
- [S] https://www.pewresearch.org/short-reads/2023/10/18/key-findings-about-americans-and-data-privacy/
- [V] https://www.mumsnet.com/talk/work
- [V] https://fairygodboss.com/
- [V] https://www.fairplaylife.com/
- [V] https://ellevatenetwork.com/
- [V] https://www.sba.gov/business-guide
- [V] https://hbr.org/2018/01/podcast-women-at-work
- [V] https://cupofjo.com/
- [V] https://www.consultingsuccess.com/
- [V] https://help.nextcloud.com/
- [V] https://hub.ci.computer/api/store
- [?] https://www.reddit.com/r/smallbusiness/
- [?] https://www.reddit.com/r/consulting/

**The Builder**

- [V] https://survey.stackoverflow.co/2025/ai
- [V] https://survey.stackoverflow.co/2025/technology
- [V] https://survey.stackoverflow.co/2025/work
- [V] https://survey.stackoverflow.co/2026/
- [V] https://survey.stackoverflow.co/2026/ai
- [V] https://survey.stackoverflow.co/2026/work
- [V] https://blog.jetbrains.com/research/2025/10/state-of-developer-ecosystem-2025/
- [V] https://newsletter.pragmaticengineer.com/p/the-pragmatic-engineer-2025-survey
- [V] https://metr.org/blog/2025-07-10-early-2025-ai-experienced-os-dev-study/
- [V] https://github.blog/news-insights/company-news/updates-to-github-copilot-interaction-data-usage-policy/
- [V] https://github.com/features/copilot/plans
- [V] https://www.theregister.com/software/2025/12/17/github-walks-back-plan-to-charge-for-self-hosted-runners/2064954
- [V] https://circleci.com/blog/jan-4-2023-incident-report/
- [V] https://blog.lastpass.com/posts/notice-of-recent-security-incident
- [V] https://cursor.com/blog/june-2025-pricing
- [V] https://cursor.com/pricing
- [V] https://1password.com/pricing/password-manager
- [V] https://news.ycombinator.com/newsguidelines.html
- [V] https://news.ycombinator.com/showhn.html
- [V] https://lobste.rs/about
- [V] https://github.com/awesome-selfhosted/awesome-selfhosted
- [V] https://selfhosted.show/
- [V] https://selfh.st/weekly/
- [V] https://changelog.com/about
- [V] https://newsletter.pragmaticengineer.com/about
- [V] https://simonwillison.net/about/
- [V] https://www.latent.space/about
- [V] https://syntax.fm/
- [V] https://archive.fosdem.org/2026/
- [S] https://en.wikipedia.org/wiki/Words_per_minute
- [V] https://docs.gitea.com/usage/repository/migration/
- [V] https://forgejo.org/docs/latest/user/
- [V] https://bitwarden.com/help/import-from-1password/
- [V] https://docs.hoppscotch.io/documentation/features/collections
- [V] https://docs.ollama.com
- [V] https://woodpecker-ci.org/docs/intro
- [S] https://www.reddit.com/r/selfhosted/
- [S] https://www.reddit.com/r/LocalLLaMA/
- [S] https://itbrief.co.uk/story/stack-overflow-survey-shows-developers-trust-ai-with-caveats

**The Gamer**

- [V] https://www.pewresearch.org/internet/2024/05/09/teens-and-video-games-today/
- [V] https://www.pewresearch.org/chart/most-common-online-platforms-among-teens/
- [dead: 404 on 2026-10-19, was S; page was never opened] https://www.pewresearch.org/?p=238983
- [V] https://www.pewresearch.org/internet/2026/02/24/how-teens-use-and-view-ai/
- [S] https://www.eweek.com/news/teens-ai-chatbot-use-pew-survey/
- [V] https://www.commonsensemedia.org/research/talk-trust-and-trade-offs-how-and-why-teens-use-ai-companions
- [V] https://www.theesa.com/resources/essential-facts-about-the-us-video-game-industry/
- [S] https://www.techradar.com/gaming/gaming-industry/roblox-call-of-duty-and-fortnite-head-up-last-years-most-played-games-and-yes-thats-the-same-as-2024
- [S] https://www.mcvuk.com/business-news/ofcoms-online-nation-who-plays-what-and-how-much-and-what-we-need-to-change-to-cater-to-everyone
- [V] https://discord.com/press-releases/update-on-security-incident-involving-third-party-customer-service
- [V] https://www.stopkillinggames.com/
- [S] https://hitmarker.net/news/stop-killing-games-confirms-1-3-million-verified-signatures-eu-commission-submission-coming-next-month-1630315
- [V] https://github.com/Steam-Headless/docker-steam-headless
- [V] https://github.com/Steam-Headless/docker-steam-headless/blob/master/docs/docker-compose.md
- [V] https://store.steampowered.com/hwsurvey/
- [V] https://areweanticheatyet.com/
- [V] https://store.steampowered.com/remoteplay
- [V] https://www.nvidia.com/en-us/geforce-now/faq/
- [S] https://pureinfotech.com/xbox-cloud-gaming-monthly-limits/
- [S] https://en.wikipedia.org/wiki/Google_Stadia
- [V] https://arxiv.org/abs/2608.11539
- [S] https://www.pcguide.com/news/pc-gamers-remain-skeptical-of-steams-ai-disclaimers-poll-shows-many-believe-game-devs-are-hiding-it/
- [S] https://boingboing.net/2025/12/20/survey-finds-very-negative-attitude-toward-gen-ai-in-games.html
- [V] https://www.nasef.org/
- [V] https://www.gamingonlinux.com/

**The Learner**

- [V] https://www.pewresearch.org/internet/2025/12/09/teens-social-media-and-ai-chatbots-2025/
- [V] https://www.pewresearch.org/short-reads/2025/01/15/about-a-quarter-of-us-teens-have-used-chatgpt-for-schoolwork-double-the-share-in-2023/
- [V] https://www.hepi.ac.uk/reports/student-generative-ai-survey-2026/
- [V] https://www.hepi.ac.uk/reports/student-generative-ai-survey-2025/
- [S] https://campustechnology.com/articles/2024/08/28/survey-86-of-students-already-use-ai-in-their-studies.aspx
- [V] https://tytonpartners.com/time-for-class-2025/
- [S] https://stacker.com/stories/higher-ed/ai-hype-fades-students-still-want-smarter-study-tools
- [V] https://commonsensemedia.org/press-releases/nearly-3-in-4-teens-have-used-ai-companions-new-national-survey-finds
- [V] https://literacytrust.org.uk/research-services/research-reports/children-and-young-peoples-reading-in-2025/
- [V] https://www.jcq.org.uk/exams-office/malpractice/artificial-intelligence/
- [V] https://www.gov.uk/government/publications/generative-ai-product-safety-expectations/generative-ai-product-safety-expectations
- [V] https://www.hrw.org/report/2022/05/25/how-dare-they-peep-my-private-life/childrens-rights-violations-governments
- [V] https://techcrunch.com/2025/01/28/powerschool-begins-notifying-students-and-teachers-after-massive-data-breach
- [S] https://voxbooster.com/blog/chromebook-statistics-2026
- [S] https://www.ofcom.org.uk/media-use-and-attitudes/media-habits-children/children-and-parents-media-use-and-attitudes-report-2025
- [V] https://www.hepi.ac.uk/2026/03/12/new-hepi-and-kortext-report-student-generative-artificial-intelligence-survey-2026/
- [V] https://obsidian.md/pricing
- [V] https://obsidian.md/help/import
- [V] https://www.notion.com/product/notion-for-education
- [V] https://apps.ankiweb.net/
- [V] https://senecalearning.com/
- [V] https://www.mrbruff.com/
- [V] https://forums.ankiweb.net/
- [V] https://forum.obsidian.md/
- [V] https://www.kiwix.org/en/
- [S] https://en.wikipedia.org/wiki/Kiwix
- [V] https://languagelog.ldc.upenn.edu/~myl/languagelog/archives/003423.html
- [V] https://support.google.com/accounts/answer/3024190
- [S] https://docs.linkwarden.app/usage/import-and-export
- [S] https://vikunja.io/docs/migration-from-third-party-services
- [?] https://www.reddit.com/r/GCSE/

**The Maker**

- [V] https://blog.google/products/photos/storage-changes/
- [S] https://www.cgchannel.com/2024/06/adobe-updates-its-terms-of-use-following-artist-backlash
- [S] https://techcrunch.com/2024/08/19/procreate-takes-a-stand-against-generative-ai-vows-to-never-incorporate-the-tech-into-its-products
- [S] https://en.wikipedia.org/wiki/Cara_(app)
- [V] https://cara.app/about
- [S] https://techcrunch.com/2025/05/09/soundcloud-changes-policies-to-allow-ai-training-on-user-content/
- [S] https://www.3dnatives.com/en/bambu-lab-at-the-heart-of-a-controversy-an-update-that-divides-the-user-community-220120255/amp/
- [S] https://techcrunch.com/2025/09/09/plex-urges-users-to-change-passwords-after-data-breach/
- [S] https://nascompares.com/2025/04/18/plex-price-increases-the-rise-of-jellyfin-and-now-what/
- [S] https://europeanwriterscouncil.eu/soa-survey-uk-ai-2024/
- [S] https://www.musicbusinessworldwide.com/25-of-music-producers-are-now-using-ai-survey-says-but-a-majority-shows-strong-resistance/
- [S] https://musictech.com/news/industry/music-producers-are-rejecting-ai-study-reveals-over-80-of-producers-are-against-ai-generated-songs
- [S] https://press.dittomusic.com/almost-half-of-musicians-say-they-would-use-ai-to-write-songs
- [S] https://petapixel.com/2026/04/09/nearly-90-of-surveyed-working-photographers-are-using-ai
- [S] https://www.videomaker.com/news/survey-shows-that-58-of-photographers-have-lost-commissioned-work-to-generative-ai/
- [V] https://arxiv.org/html/2603.04537v2
- [V] https://www.pewresearch.org/science/2025/09/17/how-americans-view-ai-and-its-impact-on-people-and-society/
- [V] https://docs.immich.app/overview/introduction
- [V] https://www.navidrome.org/docs/
- [V] https://github.com/obsidianmd/obsidian-importer
- [V] https://github.com/simulot/immich-go
- [V] https://jellyfin.org/docs/general/server/libraries/
- [V] https://docs.ghost.org/migration/medium/
- [V] https://www.fredmiranda.com/forum/
- [V] https://www.kvraudio.com/forum/
- [V] https://forum.prusa3d.com/
- [V] https://hackaday.io/
- [V] https://www.scribophile.com/
- [V] https://hackaday.com/about/
- [V] https://hackerspaces.org/
- [V] https://menssheds.org.uk/
- [V] https://www.repaircafe.org/en/about/
- [V] https://makerfaire.com/
- [V] https://songexploder.net/about
- [V] https://writingexcuses.com/
- [S] https://en.wikipedia.org/wiki/Open_studio
- [?] https://www.reddit.com/r/photography/

**The Host**

- [V] https://arxiv.org/html/2505.11426v1
- [V] https://www.pewresearch.org/internet/fact-sheet/mobile/
- [V] https://www.pewresearch.org/internet/2023/10/18/how-americans-view-data-privacy/
- [V] https://www.luriechildrens.org/en/blog/ai-parenting-statistics/
- [V] https://www.menlovc.com/perspective/2025-the-state-of-consumer-ai/
- [V] https://www.deloitte.com/us/en/insights/industry/technology/digital-media-trends-consumption-habits-survey/2025/digital-media-monitor-dashboard.html
- [V] https://www.theregister.com/2025/03/17/amazon_kills_on_device_alexa/
- [S] https://www.itvoice.in/splitwise-has-introduced-restrictions-on-the-number-of-free-expenses-users-can-add
- [V] https://www.parentsquare.com/
- [V] https://www.classdojo.com/
- [V] https://www.pta.org/
- [V] https://www.home-assistant.io/blog/2025/04/16/state-of-the-open-home-recap/
- [V] https://community.home-assistant.io/
- [V] https://www.mumsnet.com/
- [V] https://fortune.com/2025/11/26/ai-slop-recipes-thanksgiving-food-blog-collapse-traffic
- [V] https://mealie.io/
- [V] https://kitchenowl.org/
- [V] https://seedsavers.org/
- [V] https://www.allotment-garden.org/
- [V] https://www.rhs.org.uk/
- [V] https://www.growveg.com/
- [V] https://smittenkitchen.com/
- [?] https://www.reddit.com/r/MealPrepSunday/

**The Tech Family**

- [V] https://github.com/selfhst/cdn/blob/main/assets/surveys/annual/2025-results.json
- [S] https://linuxiac.com/self-hosters-confirm-it-again-linux-dominates-the-homelab-os-space/
- [V] https://community.home-assistant.io/t/anonymous-and-open-to-all-the-home-assistant-survey-dataset-open-home-foundation/1022721
- [V] https://www.home-assistant.io/blog/2026/08/26/community-survey-2024-results/
- [V] https://home-assistant.io/blog/2025/04/16/state-of-the-open-home-recap/
- [V] https://analytics.home-assistant.io/
- [V] https://www.home-assistant.io/blog/2025/09/11/ai-in-home-assistant
- [V] https://www.home-assistant.io/blog/2026/10/02/big-tech-ruined-the-cloud-so-were-renaming-ours/
- [V] https://www.home-assistant.io/blog/2026/10/07/release-202610/
- [V] https://www.home-assistant.io/integrations/ollama/
- [V] https://www.home-assistant.io/voice-pe/
- [V] https://www.home-assistant.io/blog/2026/08/13/community-day-2026-save-the-date/
- [V] https://home-assistant.io/blog/2023/11/06/removal-of-myq-integration/
- [V] https://discourse.pi-hole.net/
- [V] https://pi-hole.net/
- [V] https://docs.pi-hole.net/main/post-install/
- [V] https://lemmy.world/c/selfhosted
- [V] https://www.linuxserver.io/
- [V] https://selfhosted.show/146
- [V] https://selfhosted.show/148
- [V] https://hasspodcast.io/
- [V] https://www.jeffgeerling.com/blog/2026/homelabfest-announcement/
- [V] https://fosdem.org/2027/
- [V] https://codeclub.org/en/coderdojo-community
- [V] https://jellyfin.org/docs/general/contributing/llm-policies
- [V] https://stackoverflow.co/company/press/archive/stack-overflow-2025-developer-survey/
- [V] https://www.belkin.com/support/wemo
- [V] https://support.google.com/googlenest/answer/16233096
- [V] https://www.bleepingcomputer.com/news/security/plex-tells-users-to-reset-passwords-after-new-data-breach/
- [S] https://en.wikipedia.org/wiki/Insteon
- [V] https://github.com/home-assistant/core
- [V] https://github.com/ollama/ollama
- [V] https://github.com/open-webui/open-webui
- [?] https://www.reddit.com/r/homelab/
- [?] https://www.reddit.com/r/homeassistant/
- [?] https://www.youtube.com/@HardwareHaven

**The Business Owner**

- [V] https://www.uschamber.com/assets/documents/Empowering-Small-Business-The-Impact-of-Technology-on-U.S.-Small-Business-Small-Business-Report-2026.pdf
- [V] https://census.gov/library/stories/2026/05/ai-use-businesses.html
- [V] https://www.census.gov/newsroom/press-releases/2026/btos-june-18.html
- [V] https://www.intuit.com/blog/global-stories/ai-impact-report/
- [V] https://www.nbcnewyork.com/news/business/money-report/ai-is-spreading-on-main-street-and-transforming-the-american-small-business/6344161/
- [S] https://itbrief.co.uk/story/uk-small-firms-ai-use-more-than-doubles-in-a-year
- [S] https://www.bluevine.com/blog/small-business-ai-trends-report-2026
- [V] https://www.verizon.com/about/news/2025-data-breach-investigations-report
- [V] https://www.theregister.com/2025/12/11/lastpass_ico_fine/
- [V] https://www.helpnetsecurity.com/2024/05/02/dropbox-sign-breached/
- [V] https://office-watch.com/2025/microsoft-365-price-increase-2026/
- [V] https://9to5google.com/2025/01/15/google-workspace-gemini-price-increase/
- [S] https://www.certumsolutions.com/library/quickbooks-price-increase-august-2026
- [V] https://digital-strategy.ec.europa.eu/en/factpages/data-act-explained
- [dead: 404 on 2026-10-19, was V] https://www.ftc.gov/business-guidance/resources/protecting-personal-information-guide-business
- [V] https://www.sba.gov/business-guide/manage-your-business/strengthen-your-cybersecurity
- [V] https://www.alignable.com
- [V] https://community.shopify.com
- [V] https://bni.com/
- [V] https://americassbdc.org
- [V] https://www.eonetwork.org
- [V] https://www.mfmpod.com
- [V] https://www.acquisition.com
- [V] https://smallbiztrends.com/
- [V] https://docs.solidtime.io/user-guide/import
- [V] https://akaunting.com/hc/docs/import-export/importing-data/

**The Creative**

- [S] https://blog.adobe.com/en/publish/2025/10/23/how-creative-pros-are-using-generative-ai-keep-up-with-unprecedented-content-demands
- [S] https://www.dezeen.com/2025/10/27/ai-dulls-creativity-design-survey/
- [S] https://moises.ai/insights/musician-ai-report-water-and-music
- [S] https://www.digitalmusicnews.com/2026/01/29/who-is-worried-about-ai-study/
- [S] https://adplist.substack.com/p/the-state-of-design-tools-2025
- [V] https://www.uxtools.co/survey/introduction/methodology
- [S] https://www.cmswire.com/digital-experience/how-a-creative-rebellion-forced-adobe-to-rethink-its-terms-of-use/
- [V] https://www.adobe.com/legal/terms.html
- [V] https://www.figma.com/ai/our-approach/
- [S] https://www.theregister.com/2025/07/18/llm_products_terms_of_service/
- [S] https://www.cined.com/netflix-publishes-generative-ai-guidelines-for-content-production/
- [S] https://www.tvbeurope.com/artificial-intelligence/netflix-publishes-genai-guidance-for-creators
- [V] https://graphicartistsguild.org/
- [V] https://www.asmp.org/
- [V] https://freelancersunion.org/
- [V] https://www.honeybook.com/
- [V] https://frame.io/
- [V] https://www.liftgammagain.com/forum/index.php
- [V] https://blenderartists.org/
- [V] https://fstoppers.com/
- [V] https://thefutur.com/
- [V] https://nofilmschool.com/
- [V] https://www.creativeboom.com/
- [V] https://www.itsnicethat.com/
- [V] https://sidebar.io/
- [V] https://www.densediscovery.com/
- [V] https://www.nabshow.com/
- [V] https://www.adobe.com/max.html
- [V] https://help.penpot.app/user-guide/import-export/
- [V] https://hub.ci.computer/store/immich
- [?] https://www.reddit.com/r/graphic_design/
- [?] https://www.reddit.com/r/editors/
- [?] https://www.reddit.com/r/WeAreTheMusicMakers/
- [?] https://www.reddit.com/r/freelance/

**The Contractor**

- [V] https://www.contractormag.com/technology/article/55294441/more-than-70-of-home-service-pros-use-ai-to-cut-admin-work-not-field-jobs
- [V] https://www.housecallpro.com/?p=56888
- [V] https://www.servicetitan.com/press/ai-in-the-skilled-trades-report-2025
- [V] https://www.logic4training.co.uk/insights/ai-in-the-trades/
- [V] https://hiri.org/blog/contractor-tech-adoption-trends
- [V] https://eyeonhousing.org/2025/02/construction-self-employment-stable-at-23/
- [V] https://www.specificationonline.co.uk/articles/2025-05-28/construction-workforce-increases-to-highest-level-since-2023
- [V] https://www.fmb.org.uk/resource/state-of-trade-survey-h2-2025.html
- [V] https://report.woodard.com/articles/intuit-announces-2025-quickbooks-price-increases-fpwr
- [S] https://www.workyard.com/blog-articles/is-quickbooks-desktop-being-phased-out
- [V] https://www.malwarebytes.com/blog/news/2024/05/dropbox-sign-customer-data-accessed-in-breach
- [S] https://en.wikipedia.org/wiki/2022_LastPass_data_breach
- [V] https://www.gov.uk/government/news/deadline-approaches-for-first-making-tax-digital-quarterly-update
- [V] https://www.gov.uk/guidance/find-software-thats-compatible-with-making-tax-digital-for-income-tax
- [V] https://www.getjobber.com/
- [V] https://www.getjobber.com/pricing/
- [V] https://companycam.com/
- [V] https://companycam.com/pricing
- [V] https://www.tradifyhq.com/
- [S] https://gummysearch.com/r/Construction
- [S] https://gummysearch.com/r/electricians
- [S] https://gummysearch.com/r/Plumbing
- [S] https://gummysearch.com/r/HVAC
- [S] https://gummysearch.com/r/Carpentry
- [S] https://gummysearch.com/r/ukelectricians
- [S] https://gummysearch.com/r/skilledtrades/
- [S] https://gummysearch.com/r/smallbusiness
- [V] https://forums.mikeholt.com/
- [V] https://www.protradecraft.com/
- [V] https://www.jlclive.com/
- [V] https://www.buildersshow.com/
- [V] https://www.fmb.org.uk/
- [V] https://www.screwfix.com/
- [V] https://www.youtube.com/@BuildShow
- [V] https://www.youtube.com/@EssentialCraftsman
- [V] https://www.youtube.com/@ElectricianU
- [V] https://raw.githubusercontent.com/solidtime-io/solidtime/main/README.md
- [V] https://raw.githubusercontent.com/sysadminsmedia/homebox/main/README.md
- [V] https://raw.githubusercontent.com/immich-app/immich/main/README.md
- [V] https://raw.githubusercontent.com/paperless-ngx/paperless-ngx/dev/README.md
- [V] https://raw.githubusercontent.com/invoiceninja/invoiceninja/master/README.md
- [V] https://hub.ci.computer/store/invoice-ninja
- [V] https://invoiceninja.github.io/docs/advanced-topics/import-and-export

**The Marketer**

- [V] https://sproutsocial.com/insights/index/
- [V] https://contentmarketinginstitute.com/b2b-research/b2b-content-marketing-trends-research
- [V] https://www.salesforce.com/resources/research-reports/state-of-marketing/
- [V] https://blog.hubspot.com/marketing/inbound-marketing-data
- [V] https://chiefmartec.com/2025/05/2025-marketing-technology-landscape/
- [V] https://klaviyo.com/blog/why-using-ai-in-the-workplace-can-be-valuable
- [V] https://www.marketingweek.com/brands-concerned-agencies-ai/
- [V] https://martech.org/what-intuits-layoffs-mean-for-mailchimp-customers/
- [V] https://tech.co/news/adobe-ai-training-backlash
- [V] https://redact.dev/blog/figma-ai-training-opt-out
- [V] https://www.bls.gov/ooh/management/advertising-promotions-and-marketing-managers.htm
- [V] https://www.bls.gov/ooh/business-and-financial/market-research-analysts.htm
- [V] https://www.mbopartners.com/state-of-independence/
- [S] https://www.gartner.com/en/newsroom/press-releases/2022-10-03-gartner-survey-finds-marketers-utilize-just-42-percent-of-their-martech-stack-capabilities
- [?] https://www.brevo.com/blog/mailchimp-price-increase/
- [V] https://superpath.co
- [V] https://measure.chat
- [V] https://www.demandcurve.com
- [V] https://www.meetup.com/topics/digital-marketing/
- [V] https://brightonseo.com
- [V] https://unbound.hubspot.com/
- [V] https://www.socialmediaexaminer.com
- [V] https://marketingbrew.com
- [V] https://www.marketingexamples.com
- [V] https://podcast.smarterx.ai/
- [V] https://www.marketingovercoffee.com
- [V] https://www.stfo.io/
- [V] https://listmonk.app/docs/
- [V] https://plausible.io/docs/self-hosting
- [V] https://docs.ghost.org/migration/mailchimp/
- [?] https://www.reddit.com/r/marketing/
- [?] https://onlinegeniuses.com

**The Lawyer**

- [S] https://www.lawnext.com/2025/03/aba-tech-survey-finds-growing-adoption-of-ai-in-legal-practice-with-efficiency-gains-as-primary-driver.html
- [S] https://www.2civility.org/2025-clio-legal-trends-report/
- [V] https://www.canadianlawyermag.com/news/general/many-legal-clients-have-asked-artificial-intelligence-legal-questions-clio-report/393228
- [S] https://www.ncbar.org/nc-lawyer/2026-05/by-the-numbers-what-surveys-show-about-law-firm-ai-adoption/
- [S] https://www.lawnext.com/2025/03/ai-adoption-nearly-doubles-among-small-law-firms-according-to-smokeballs-2025-state-of-law-report.html
- [S] https://legal.thomsonreuters.com/blog/genai-report-executive-summary-for-legal-professionals/
- [V] https://www.legalcheek.com/2026/04/lawyers-embracing-ai-but-leaving-clients-in-the-dark/
- [V] https://www.lawgazette.co.uk/news/ai-is-mainstream-in-law-but-clients-are-not-told/5126414.article
- [S] https://wislawjournal.com/2026/02/27/ai-adoption-surges-across-legal-industry-survey-finds/
- [S] https://www.abajournal.com/web/article/aba-tech-report-finds-that-ai-adoption-is-growing-but-some-are-hesitant
- [S] https://lawyersmutualnc.com/article/aba-technology-survey-shows-lawyers-as-cautious-adopters-of-generative-ai/
- [S] https://www.jdsupra.com/legalnews/aba-weighs-in-on-generative-ai-use-in-3097638
- [S] https://www.leanlaw.co/blog/aba-cloud-computing-ethics-guidelines/
- [S] https://www.stephenwalther.com/articles/can-texas-lawyers-upload-client-files-to-chatgpt
- [V] https://www.insurancejournal.com/news/national/2026/04/15/865963.htm
- [V] https://www.damiencharlotin.com/hallucinations/
- [V] https://www.lawnext.com/2026/03/lexisnexis-confirms-data-breach-reports-say-hackers-claim-access-to-government-and-law-firm-user-data.html
- [V] https://www.canadianlawyermag.com/resources/legal-technology/clio-acquires-vlex-for-us1-billion-closes-us500-million-funding-round-at-us5-billion-valuation/393346
- [S] https://www.toolsforhumans.ai/ai-tools/clio
- [S] https://www.okbar.org/cm_articles/the-good-and-the-bad-of-solo-practice-clios-latest-legal-trends-report-for-solos/
- [V] https://languagelog.ldc.upenn.edu/nll/?p=1255
- [V] https://lawyerist.com
- [V] https://www.legaltalknetwork.com
- [V] https://abovethelaw.com
- [V] https://www.attorneyatwork.com
- [V] https://www.lawsitesblog.com
- [V] https://www.techshow.com
- [V] https://www.solopracticeuniversity.com
- [V] https://www.legalfutures.co.uk
- [V] https://github.com/nextcloud/integration_onedrive
- [V] https://docs.stirlingpdf.com/
- [V] https://github.com/nextcloud/integration_dropbox
- [V] https://bitwarden.com/help/import-from-lastpass/
- [V] https://www.librechat.ai/docs/features/import_convos
- [V] https://radicale.org/v3.html
- [V] https://docs.twenty.com/user-guide/data-migration/overview
- [V] https://www.docuseal.com/docs
- [V] https://docs.ci.computer/docs/first-party-apps/companion-memory-server

**The Journalist**

- [S] https://muckrack.com/stateofjournalism/
- [S] https://www.matternow.com/blog/examining-muck-racks-state-of-journalism-in-2026-report/
- [V] https://reutersinstitute.politics.ox.ac.uk/journalism-media-and-technology-trends-and-predictions-2026
- [S] https://pressgazette.co.uk/news/gulf-between-ai-journalism-hype-and-concerns-at-the-coalface-revealed/
- [S] https://ijnet.org/en/story/how-ai-changing-journalism-global-south
- [V] https://freedom.press/digisec/blog/advice-column-should-i-be-concerned-about-ai-transcription-tools/
- [S] https://www.techpartner.news/news/how-private-are-transcription-apps-576204
- [S] https://reviewofjournalism.ca/whos-listening/
- [S] https://mediacopilot.ai/the-best-ai-transcription-tools-for-journalists-hands-on-review/
- [V] https://otter.ai/privacy-security
- [V] https://www.pewresearch.org/short-reads/2015/02/05/ire-takeaways/
- [V] https://www.pewresearch.org/journalism/2022/06/14/journalists-sense-turmoil-in-their-industry-amid-continued-passion-for-their-work/
- [V] https://www.icfj.org/our-work/2019-state-technology-global-newsrooms-survey
- [V] https://www.theopennotebook.com/2021/07/27/finding-the-right-tools-for-organizing-assignments-and-reporting/
- [V] https://cpj.org/2026/01/in-highly-unusual-move-fbi-searches-washington-post-reporter-hannah-natansons-home-seizes-devices/
- [V] https://pressfreedomtracker.us/all-incidents/washington-post-reporters-home-searched-by-fbi-devices-seized/
- [V] https://www.cjr.org/analysis/a-trauma-that-you-carry-washington-post-wapo-hannah-natanson-press-freedom-device-search-seizure-trump.php
- [V] https://newsguild.org/politico-journalists-win-landmark-arbitration-on-ai-protections/
- [V] https://reutersinstitute.politics.ox.ac.uk/digital-news-report/2025/dnr-executive-summary
- [S] https://www.journalismai.info/s/Generating-Change-_-The-Journalism-AI-report-_-English.pdf
- [V] https://www.ire.org/
- [V] https://www.ire.org/training/conferences/nicar-2027/
- [V] https://journalists.org/
- [V] https://www.spj.org/
- [V] https://www.poynter.org/
- [V] https://freedom.press/digisec/
- [V] https://www.journaliststoolbox.ai/
- [V] https://www.theopennotebook.com/
- [V] https://pressgazette.co.uk/
- [V] https://www.cjr.org/
- [V] https://longform.org/podcast
- [V] https://www.wnycstudios.org/podcasts/otm
- [?] https://www.reddit.com/r/Journalism/
- [?] https://www.nuj.org.uk/
- [S] https://gijn.org/

**The Educator**

- [V] https://news.gallup.com/poll/691967/three-teachers-weekly-saving-six-weeks-year.aspx
- [V] https://static.waltonfamilyfoundation.org/df/fb/eba12807470a9402d7433cc47dba/teaching-for-tomorrow-unlocking-six-weeks-a-year-with-ai-report.pdf
- [V] https://www.pewresearch.org/short-reads/2024/05/15/a-quarter-of-u-s-teachers-say-ai-tools-do-more-harm-than-good-in-k-12-education/
- [V] https://www.edweek.org/technology/should-teachers-disclose-when-they-use-ai/2024/04
- [V] https://my.chartered.college/?p=41701
- [V] https://www.elon.edu/u/news/?p=1037214
- [S] https://blog.csba.org/ai-cdt-survey/
- [S] https://www.infodocket.com/2025/10/08/report-from-cdt/
- [V] https://www.anthropic.com/news/anthropic-education-report-how-educators-use-claude
- [V] https://www.nea.org/nea-today/all-news-articles/nea-delegates-approve-new-ai-policy-statement
- [V] https://www.gov.uk/government/publications/generative-artificial-intelligence-in-education/generative-artificial-intelligence-ai-in-education
- [V] https://www.powerschool.com/security/sis-incident/
- [V] https://studentprivacy.ed.gov/ferpa
- [V] https://support.google.com/jamboard/answer/14211096
- [V] https://blog.google/outreach-initiatives/education/google-for-education-year-in-review-2025/
- [V] https://moodle.com/about/
- [V] https://www.teacherspayteachers.com/
- [V] https://www.wyzant.com/
- [V] https://www.educationnext.org/what-state-policymakers-should-know-about-homeschoolers-misconceptions-who-chooses-home-education/
- [S] https://blog.fetc.org/edtech-top-40-familiar-tools-remain-the-most-popular-in-schools
- [S] https://www.eschoolnews.com/live-iste-2024/2024/07/02/iste-live-news-instructure-releases-the-edtech-top-40/
- [V] https://marketbrief.edweek.org/marketplace-k-12/40-popular-ed-tech-tools-k-12-identified-new-analysis/
- [S] https://www.eschoolnews.com/digital-learning/2025/03/28/uneven-ai-use-teachers-principals/
- [S] https://www.edtechinnovationhub.com/news/englands-early-career-teachers-lead-experienced-peers-in-classroom-ai-use-teacher-tapp-data-shows
- [S] https://gummysearch.com/r/Teachers/
- [S] https://gummysearch.com/r/homeschool/
- [S] https://gummysearch.com/r/Professors/
- [V] https://teachertapp.com/
- [V] https://www.truthforteachers.com/
- [V] https://www.cultofpedagogy.com/
- [V] https://www.edutopia.org/
- [V] https://www.edsurge.com/
- [V] https://www.k12dive.com/
- [V] https://hslda.org/
- [V] https://www.bettshow.com/
- [V] https://www.nea.org/
- [V] https://www.tes.com/community
- [V] https://podcast.mrbartonmaths.com/
- [V] https://kiwix.org/en/

**Local inputs (not URLs).** `catalog-apps.json`, `app-media.json`, `claims.json`, `personas.md`, `content/families/*.json` (CI-Virtual-Home); the w7 marketplace reviews and story-v3 plan; `w8/bring-home.json`; the CI-Common `ADS.md`.

## Appendix B. Quotes and sample lines, checked against claims.json

Skeptic pass: five lines were rewritten on 2026-10-19 (gamer S6, journalist S1, educator S2, S5 and S6) because they implied a gender, a speed, pupil data on a home Core or pupils reaching the Core from outside; the educator hooks and titles follow. Every line passed all 72 `bannedPhrases` patterns of `claims.json`, the UI-description pattern, the 30-word and 20-word-sentence limits, the no-digit rule and the app-name casing check (`lintlines.mjs`; the 15 s and 30 s texts, titles and hooks too). Caption is third person; quote is an adult character in first person. Names are the recast examples.

**The Organiser**

- S1 (quote) Client folder, school forms, tax receipts. Three piles, one Core. I know where each one is, and that is the whole point.
- S2 (caption) The contract is signed and filed before the kettle boils. It sits on the Core in the client's folder, not in a rented drive.
- S3 (quote) Companion Agents are in beta, so I read every draft. It is my name on the reply, so I would read it anyway.
- S4 (quote) Last year's invoice comes up from one word on it. Paperless-ngx reads each page and indexes it, so I search instead of filing by hand.
- S5 (quote) My week has two columns. Client calls first, then school pickups. Companion Planning keeps both in one file on the Core.
- S6 (quote) Every spring I list what renews. Some stay. The documents I would rather keep in the house move home first.

**The Builder**

- S1 (quote) Repo's on the Core. Editor's on the Core. I open a tab and I'm working.
- S2 (caption) The model on the Core proposes a fix. John reads the diff, then decides.
- S3 (quote) I list what I pay for and what I actually open. The two lists do not match.
- S4 (caption) Work code stays where work keeps it. The side projects come home to Forgejo.
- S5 (caption) A capable model on the Core drafts the commit message. John rewrites it anyway.
- S6 (caption) Companion Agents are in beta. John's agent proposes, and he approves every change.

**The Gamer**

- S1 (caption) Steve signs in to Steam himself, then plays from his bed. The Companion Core runs the session downstairs, and a browser tab shows it.
- S2 (caption) Cousins come Saturday, so Steve starts their world on the Core first. Everyone joins from their own copy of the game.
- S3 (caption) His library is still on his Valve account. What changed is where the session runs: on the Core, not on a rented server.
- S4 (caption) Steve cuts the best bit of the match in FreeCut, then sends it to the sofa with PairDrop. No chat app in the middle.
- S5 (caption) For homework, Steve asks the model on the Core to explain one step. Then he writes the answer himself.
- S6 (caption) Some cloud gaming plans count hours. Steve's session runs on the Core, so the only one counting is a parent.

**The Learner**

- S1 (caption) Jean writes her French paragraph herself, then checks it in LibreTranslate on the Core. The words are translated at home, not sent to a translation website.
- S2 (caption) For her history essay, Jean looks up a date in Kiwix. The Wikipedia file was downloaded once and is served from the Core, so no search engine is asked.
- S3 (caption) Jean asks the model to explain the proof, not to write it. She still writes it herself.
- S4 (quote (Yasmin, 20, adult)) My lecture notes are plain Markdown files. If I change tools next year, I take the folder with me.
- S5 (quote (Jean's mother, adult)) Her questions go to a model on the Core. I can point to the machine. It sits on the shelf by the door.
- S6 (caption) It is a study helper, not her teacher, and it can be wrong. Jean checks the answer against her textbook before it goes in her notes.

**The Maker**

- S1 (caption) The whole weekend of RAW files sits on the Core, sorted by place and date in Immich. Not in a photo cloud.
- S2 (quote) I trim the take in AudioMass, then save the file where I choose. Nobody asks me to upload it first.
- S3 (quote) My drafts are plain Markdown files in Obsidian. If I ever switch apps, the pages come with me.
- S4 (quote) I do not want the painting done for me. I want the folders sorted. That is the part I put off.
- S5 (quote) Records, rips and my own demos play from Navidrome in the kitchen. It plays files I hold, nothing else.
- S6 (quote) It says beta on the page. Fine. I would rather read the limits first than find them on a Saturday.

**The Host**

- S1 (caption) Twelve for Sunday lunch. The list sits in KitchenOwl on the Core, and everyone at home adds to it.
- S2 (quote) Gran's recipe cards are in Mealie now. I typed them once, and the tin can finally rest.
- S3 (quote) The Wi-Fi password lives in VaultWarden on the Core. When my aunt asks at the door, I find it at the table.
- S4 (caption) The family's photos sit in Immich on the Core, not in a photo cloud. The first start takes a while, because it sorts everything.
- S5 (quote) I ask the model on the Core what to cook with leeks and the end of the cheese. It suggests, I decide.
- S6 (quote) That is one fewer renewal date in my head. I have enough dates already.

**The Tech Family**

- S1 (caption) Pi-hole answers the house's DNS from the Core. Lookups it does not block still go to an upstream resolver the family chose.
- S2 (caption) The porch rule lives in Home Assistant on the Core. Devices that need their own cloud still use it.
- S3 (quote) I don't care what runs it. The lamp has to come on when I ask.
- S4 (caption) The homework site stops loading. The household lead adds one domain to the Pi-hole allow list and the page opens.
- S5 (caption) The household lead keeps the house config in Forgejo on the Core, with a commit for every change. Forgejo replaces GitHub here.
- S6 (caption) The household lead asks Open WebUI why the hall sensor dropped out. A model on the Core answers; the prompt goes to the Core, not to an API.

**The Business Owner**

- S1 (caption) Quotes, invoices, signed contracts. They used to live in four places. Now they sit in one client folder on the Core.
- S2 (caption) Ruth closes the week at the desk. Invoice Ninja has the quotes, Paperless-ngx has the receipts, Nextcloud has the contracts.
- S3 (quote) The model on the Core drafts the reminder to a late payer. I read it, change a line, and I press send.
- S4 (quote) Every renewal email feels like a small vote. I would like fewer of them.
- S5 (quote) I am not the IT department. If it needs a terminal window, I am calling someone.
- S6 (quote) Client details stay on the Core by default. That is the sentence I give anyone who asks where their file is.

**The Creative**

- S1 (quote) The brief is confidential, so the drafts stay on the Core in the studio. I know which folder, and I can point to it.
- S2 (quote) Seven years of shoots sit in Immich on the Core. I search by place and by client, not by whatever a folder was called years ago.
- S3 (quote) Terms change on a Tuesday. My files do not move unless I move them.
- S4 (quote) I do not need a model to make the picture. I ask the one on the Core to read the brief back and list what I missed.
- S5 (caption) Penpot for the layout, Inkscape for the logo. Both open in a browser tab, served from the Core.
- S6 (quote) The client sits at my table and we review the proofs from the Core. I send the final once she says yes.

**The Contractor**

- S1 (quote) I write the quote at the bench, same evening. Invoice Ninja keeps the client, the line items and last spring's job together.
- S2 (quote) The van photos go into Immich when I get in. The wall before the plaster, the wall after, and the date on both.
- S3 (quote) HomeBox lists where the drill is and when its warranty ends. I stop guessing at the counter.
- S4 (quote) A seat fee for every pair of hands, and a credit meter on the clever bits. I would rather run my own jobs from the Core.
- S5 (quote) I paste my site notes into Open WebUI and the local model drafts the job summary. I read it before anything goes to the client.
- S6 (quote) Quote and change order sit together in Docuseal on the Core. What we agreed in March is in one place.

**The Marketer**

- S1 (caption) Elena sends the client's newsletter from a list in Ghost on the Core, not from a mailing service she rents.
- S2 (quote) The brief goes through Open WebUI. The model runs on the Core, so the launch plan stays on my desk.
- S3 (caption) Mixpost holds the week's drafts and pictures on the Core. Only the finished post goes out to the platforms.
- S4 (caption) Penpot keeps the campaign files and their history on the Core, instead of a hosted design tool.
- S5 (quote) I run the client call through Whisper-WebUI. The audio goes to the Core, not to a transcription site.
- S6 (caption) Nobody asked where the draft lived until the NDA arrived. Now the answer is a disk in the house.

**The Lawyer**

- S1 (quote) The engagement letter is signed at my desk. Docuseal holds the PDF on the Core, in my office, next to the client's folder.
- S2 (quote) Every page of the file is scanned and searchable. Paperless-ngx reads the stack, and I find the exhibit by a word on the page.
- S3 (quote) The model on the Core drafts the first summary. I read the transcript myself, line by line, before anything goes into a letter.
- S4 (quote) My folders sit in Nextcloud on the Core, on a shelf in my office. When a client asks where the file is, I can point to it.
- S5 (quote) I count my subscriptions every January and I am tired of the number. The calendar is a file I can export. Radicale holds mine.
- S6 (quote) Ask the model on the Core, then check every cite yourself. The answer is a draft. The signature on the letter is still mine.

**The Journalist**

- S1 (caption) Noor records the interview on a handheld recorder. At the kitchen table she adds the file to Whisper-WebUI, and the Core turns it into text.
- S2 (caption) Companion OS is in beta. Whisper-WebUI turns the tape into text, and Noor still checks every quote against the audio.
- S3 (caption) The records release arrives as eighty pages. Paperless-ngx makes them searchable by name, date and word.
- S4 (caption) She asks the local model in Open WebUI which page mentions the contract. Then she reads that page herself.
- S5 (quote) I ask where a recording lives before I ask what it costs.
- S6 (quote) The draft sits on my Core until I send it to my editor.

**The Educator**

- S1 (quote) Report comments are the worst of my week. The model on the Core drafts one from my rubric, and I rewrite it in my own words.
- S2 (quote) My handouts and blank forms used to live in my school bag. Now they sit in Paperless-ngx on the Core, and I find one by a word on it.
- S3 (quote) Parents write in four languages. LibreTranslate runs on the Core, so I paste the note in, read it back, and check it with the family.
- S4 (quote) My account at school closes the day I leave. My lesson folders in Nextcloud do not. They sit on the Core at home.
- S5 (quote) Before any tool, I ask where school paperwork ends up. The school keeps its records. My lesson files sit on the Core, in one folder.
- S6 (quote) Friday quiz, ten questions, in Razzia on the Core. Everyone at my table joins with a PIN on their own phone, on the home Wi-Fi.
