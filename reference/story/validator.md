# Story validator

`pnpm run story:validate` is the gate for the family stories (`content/families/<slug>.json`). One authored file per
family is the single source of the text on the family page, in the popups, in the voice-over and in the film, so
this is where the voice, the claims, the app facts and the house facts are enforced. It needs no GPU and no network.
Contract: the schema (`content/story/schema/family.schema.json`), `assets/story/types.ts`, and the shared inputs in
`content/story/`. The persona model (members with an `archetype`, the rooms and apps each one tells) is
[personas.md](personas.md); this file is how it is enforced.

```bash
pnpm run story:validate                          # every content/families/<slug>.json (zero files is a pass, with a note)
pnpm run story:validate -- vance-takahashi       # one family by slug
pnpm run story:validate -- path/to/family.json   # one file by path (fixtures, work in progress)
pnpm run story:validate -- --fleet               # also the cross-family metrics
pnpm run story:validate -- --complete            # every casting slug has a family file and the fleet counts gate (implies --fleet)
pnpm run story:validate -- --strict-families     # a casting family without a file is an error (CI_STORY_STRICT=1 too); without it, a note
pnpm run story:validate -- <slug> --json         # the same result as JSON on stdout
pnpm run story:validate -- --world <dir> <file>  # casting.json and houses/ from <dir> instead of content/story and content/houses
pnpm run test                                    # scripts/test-stories.mts runs the validator over the exemplar and the fixtures
pnpm run story:services                          # recompute the derived columns of content/story/services.json (story v3)
pnpm run story:services:check                    # exit 1 when services.json is out of date or breaks an invariant (also run by pnpm run test)
```

The tests never depend on a shipped family, the shipped casting or how the shipped houses are laid out today. They run the
exemplar (`test/fixtures/stories/exemplar.json`, the old Vance-Takahashi family) and every `bad-*` and `ok-*` fixture against
a **test world**, `test/fixtures/stories/world/`: a `casting.json` (two real-shaped entries, the rest bare stubs, three
flagship stubs) and a `houses/` folder holding only the facts `house.mts` reads (item types per room, site types, plan item
names). The world also holds a trimmed copy of the Brennan casting entry and its house (`houses/seraphine*.json`) for the standalone sample
`ok-6-story-v2.json` (story v2, below). A file validated from `test/fixtures/stories/` picks that world by itself, so
`story:validate -- test/fixtures/stories/exemplar.json` is 0 errors and 0 review whatever the shipped casting says; its only warnings are the story v3 phase-in rules (`PHASED_RULES` in `lib/v3.mts`: it is a family written before v3). `ok-9-story-v3.json`, a whole v3 family, reports nothing at all.
Everything else (schema, claims, catalog, roles, voices, personas) is the shipped file.

Exit code 1 on any `error`, and on any `review` finding that is not on the allow-list. Warnings print and never fail.
A writer's loop is: run it for your slug, fix every error, read every warning, then read the file aloud at 150 words a minute.

## Where the checks get their facts

| Input | Used for | Owner |
|---|---|---|
| `content/story/schema/family.schema.json` | shape, enums, lengths | story-validator |
| `content/story/claims.json` | the 72 banned phrases, the sanctioned claims, the disclosures | contract |
| `content/story/catalog-apps.json` | which apps exist, their caveats, QA status, agent link, `replaces` | story-validator (re-check: `scripts/story/build-catalog-snapshot.mts`) |
| `content/story/casting.json` | DERIVED from `cast-plan.json` by `pnpm run story:cast`: slug, house, household, business and narrator per family; surname, address place; the members (id, name, age, role, archetype, room, `roomRoles`, anchors, companion); signature apps; `homeFlags`; `flagship: true` on the three flagship homes (the fleet-unique name exemption). Read by `casting`, `casting-apps`, `persona-cover`, the fleet rules | cast plan (casting) |
| `content/story/services.json` | the registry of replaced services (story v3): id, name and aliases, flags, the "alternative to" form, the mark; read by `service-*`, `chips` and `detail-replaces`. Facts are authored; `apps`, `storyApps`, `storyStatus`, `fleetHomes`, `rank` and `top80` are derived by `scripts/story/build-services.mts`, which `pnpm run story:services:check` and the tests verify. [story-v3.md](story-v3.md) | story-validator |
| `content/story/personas.json` | the archetype table of [personas.md](personas.md): per archetype its rooms, fallback rooms, anchor roles and app pool; read by `persona-cover`. A test keeps its keys equal to the schema enum and `ARCHETYPES` in `assets/story/types.ts`, and every pool id must be in the catalog | story-validator |
| `content/story/roles.json` | which item and site types each anchor role resolves to; the universal roles | story-bake |
| `content/story/voices.json` | voice keys, status, how many families each narrates | voiceover-tool |
| `content/houses/<id>.json` and `<id>.plan.json` | what the beat's own house has (see below) | the house pipeline |
| `content/story/reviewed.json` | the allow-list for `review` findings | story-validator |

**The house is re-derived, never trusted from casting.** `casting.json` role counts were generated once and go stale
when a spec changes. `scripts/story/lib/house.mts` reads the HouseSpec (typed items per room, site entries) and the plan
(`shots.world` item names, `site.instances`), applies `roles.json`, and reports which roles resolve. A role in casting
that the house files no longer have is a `casting` warning. Room presence (living, office, kids ...) comes from casting's
room list read through `roles.json` (`kinds` and `names`). Site types that `roles.json` does not list (the specs write
`driveway`, `loungers`, `garden-beds`) are covered by a small alias table in `house.mts`; when story-bake fixes the lists
in `roles.json` the aliases become redundant and harmless.

## Severities and the allow-list

| Severity | Meaning |
|---|---|
| `error` | fails the gate |
| `review` | fails unless the exact finding is listed in `content/story/reviewed.json` |
| `warn` | printed, never fails |

`content/story/reviewed.json` is `[{ "slug": "...", "at": "...", "rule": "...", "by": "LB" }]`. `at` is the place the finding
points at (a beat id for beat-level rules such as `app-qa-screenshot`, a location such as `kitchen-wallos.body` for text rules)
and `by` is the owner's initials: an entry without `by` is rejected. An entry that matches nothing (the text moved on) is
reported as a `reviewed` warning so the list does not rot. Allowed findings are still printed, marked `(reviewed)`.

## Rule catalogue

The ids are the reference validator's (`reference/story/ref/ref-validate.mjs`, the seed this was ported from). Each finding
prints `rule at: message` and, where there is one, a `fix:` line.

### Text rules (claims.json `bannedPhrases`, every user-facing string)

A user-facing string is anything a visitor reads or hears: tagline, story, address, surname, member names, work, chapter
titles, the companion's name, job, personality and limits, popup title, body, chips, note and phone rows, `say` lines, the
closing. Story v2 adds a beat's `detail` (before, after, steps, fact), the house lede and spot lines, the day lines and the member bios. Code identifiers (slug, house, ids, URLs), `notes` and `capability` are never scanned. HTML is stripped and curly
quotes are folded first.

| Rule | Severity | Why |
|---|---|---|
| `dash-em-en` | error | Voice rule: never an em or en dash in user-facing copy. Use a comma, semicolon or period. |
| `dash-double-hyphen` | error | A typed double hyphen is an em dash in disguise. |
| `dash-spaced-hyphen` | warn | A spaced hyphen reads as a dash. |
| `exclamation` | error | MESSAGING.md: no exclamation marks. Success is grounded, not gushing. |
| `emoji` | error | No emoji in product copy. |
| `ellipsis-hype` | warn | Trailing ellipsis is suspense, not the Uncloud voice. |
| `buzz-core` | error | Banned buzzword list (brand-voice.md Part I, uncloud-voice SKILL, COPY.md section 0, MESSAGING.md). |
| `buzz-ai-powered` | error | "AI-powered solution" is the corporate SaaS framing CI opposes. |
| `buzz-for-everyone` | error | Platitude. This stack is not for everyone and saying so is a landmine. |
| `buzz-unlimited` | warn | Vocabulary: "no rate limits", not "unlimited" (sounds like a SaaS upsell). |
| `buzz-simple-claims` | review | Ease claims are unmeasured. The only sanctioned ease line is "Plug it in, pair it over Wi-Fi, and walk away." |
| `vocab-log-in` | error | Vocabulary: "sign in", not "log in". |
| `vocab-chatbot` | error | Vocabulary: OpenClaw and Hermes are agents, never chatbots. |
| `vocab-assistant` | error | Vocabulary: agent, not assistant. (Marketplace manifests say "assistant"; our copy does not.) |
| `vocab-home-server` | error | Vocabulary: say Companion Core, not home server, NAS, box or appliance. |
| `vocab-box` | warn | "Box" is allowed only to mean the Core ("One box. No subscription."). |
| `vocab-app-store` | error | Vocabulary: "the Companion Hub store" (the sheet's phrase). Not app store or marketplace. |
| `vocab-knowledge-base` | error | Vocabulary: Companion Memory. |
| `vocab-digital-memory` | error | The Kickstarter draft says Digital Memory; the product name is Companion Memory. |
| `vocab-portal` | error | User-facing name is "Companion account", never Portal or CI Account. |
| `vocab-repo-names` | error | Repo and wizard-label names are engineering surfaces. Use product names. (The Hub wizard labels Companion Memory "CI Memory"; do not copy that.) |
| `vocab-degoogle` | error | Vocabulary: uncloud, local-first. |
| `vocab-casing` | error | Product nouns are Title Case: Companion Core, Companion Hub, Companion Memory, Companion OS. Only "account" stays lower case: Companion account. |
| `vocab-casing-account` | error | "Companion account" has a lower-case a. |
| `vocab-casing-agents` | error | Spell OpenClaw and Hermes exactly. |
| `vocab-retired-names` | error | Retired or mistitled names (CAMPAIGN.md 2c, PLATFORM-VISION cautions). Import is built into Companion Memory. |
| `vocab-sign-off` | warn | Sign-off is exactly "UnCloud your life." with that capitalisation. |
| `num-dollar` | error | No prices anywhere on the site. The Kickstarter ladder was re-priced repeatedly between 8 and 23 Sep (CAMPAIGN.md 2b to 2e), the shop and the campaign disagree, and copy.json holds a third set. Link to the campaign page instead. |
| `num-savings` | error | No savings or payback figures. They depend on the rented-stack table and its caveat; the sheet (about ten months) and copy.json (about 26 months) disagree; the 75% and 95% figures are marketing math. |
| `num-time-saved` | error | No productivity or time-saved figure exists. "Get more done" must be shown as a concrete task, never as a number. |
| `num-tokens` | error | Companion has published no tok/s for any model on any tier (CAMPAIGN.md 4). Geerling figures are third-party and not ours. |
| `num-db-unqualified` | error | Only "19 dB at idle" is measured. An unqualified acoustic number is what Design and Technology review picks at. |
| `num-unmeasured-hw` | error | Not measured or not confirmed (CAMPAIGN.md 4, 6): power draw, load noise, temperature, weight, voltage, certifications, PSU form factor, ROCm version. |
| `num-fps` | error | No frame-rate, fps or refresh figure exists for Steam Headless on a Core: it depends on the GPU the Core has, the game and the network. Same footing as `num-tokens`. |
| `cap-lag-free` | error | "Lag-free", "zero lag", "no delay": an unmeasured performance claim. ("Zero latency" is `num-tokens`' catch; the word latency is banned outright.) |
| `num-silent` | error | The Core has a Noctua fan. The measured fact is 19 dB at idle; there is no load figure. |
| `num-app-counts` | error | The only app count is "300+ apps and agents available in the Companion Hub store." (owner ruling 22 Sep 2026). 84 integrations, 250+, 200+, 1,296 and 814 are all banned (cautions: 84 has no source; 1,296 is a directory count). |
| `num-field-units` | review | Founder-letter number, not yet on the fact sheet (COPY.md 12.9). |
| `num-minutes` | error | No measured setup or install time exists. "Installs in minutes" is a house pitch line but not on the campaign sheet. |
| `num-model-names` | error | Fabrication-guard model names (HUB-MODELS cautions). |
| `campaign-terms` | review | Campaign economics are not retail facts and moved weekly. Terms belong on the Kickstarter page. Stories name no tier, price, ship date, warranty or backer perk. |
| `no-subscription` | review | A year of Hub Pro (Companion Memory included) ships with a Core and renewal exists after it. "No cloud, no telemetry, no subscription" is a verbatim hero line on the sheet; in a story it needs the qualifier. "No API bill" is the safe line. |
| `sec-absolute` | error | No security or privacy guarantee. The sheet supports "Full-disk encryption is supported. Your keys." (supported, not default) and "Local by default". Absolute wording needs legal review (MEMORY-PAGE cautions). |
| `sec-never-leaves` | error | (Also "your code, questions or homework do not leave the Core".) Not supportable: Hub is Portal-connected by default, store browsing and installs use the internet, crash reporting has been opt-out (PLATFORM-VISION cautions). The sheet's FAQ line is narrower: "No usage data is collected from your machine." |
| `sec-offline` | error | (Also "codes offline", "studies without the internet", "offline tutor", "offline coding agent".) The Companion Hub store, app installs, the alternatives view and any messaging or web agent need the internet. The sheet claims only that no internet connection is required to use the machine you bought. |
| `sec-compliance` | error | No compliance, certification or audit claim is supportable. OpenEMR in the catalogue is not HIPAA; Plausible's own listing says "GDPR" and we do not repeat it. |
| `sec-medical` | error | No medical claim. Fitness and recipe apps are record-keeping apps. |
| `sec-safety-people` | error | No safety guarantee. Pi-hole blocks ad and tracker domains; it is not parental control. Frigate records and detects objects; it does not guarantee a break-in is caught. |
| `legal-claims` | error | No legal, tax or financial claim. DocuSeal and Documenso sign documents; whether a signature is valid is not our statement. |
| `sec-fear` | review | Empower, do not frighten. Name the mechanism calmly; do not threaten the reader or show a family in danger. |
| `incumbent-attack` | error | (Names GeForce Now, Xbox Cloud and Stadia as well as the companies of the first list.) No unsourced factual claim about a named company. The CI-Common matrix of such judgements is uncited. A Kickstarter-adjacent page is commercial speech; escalate comparative use to counsel. |
| `logo-trademark` | error | The logo of a service the Core replaces (Google, Apple, Amazon, Microsoft and the like) is never shown (CAMPAIGN.md 6c). An app's own real logo, from the app media manifest, stands beside its name (`story-v2.md`, App media). |
| `cap-parity` | error | (Also "ChatGPT-level", "Claude-grade" and a bare "as smart as".) The sheet concedes this: a Core runs a very good open-weight model, not the best model in the world this month. Never imply parity. |
| `cap-omniscient` | error | Proactive forecasting cards ("Your week, taking shape", "It notices what you've dropped") carry a Rolling out pill upstream. Today Companion Memory supplies individual context to OpenClaw and Hermes. |
| `cap-autonomy` | review | Agents act inside permissions the family sets. No story may show an agent spending money, contacting a third party or cancelling something without the person approving. |
| `cap-cloud-model` | review | OpenClaw and Hermes can be pointed at cloud model providers. A "private agent" scene is private only on the Core's local model; never show or mention a cloud key. |
| `cap-messaging-private` | error | Hermes reaches you through messengers that are someone else's servers. The message travels through them. |
| `cap-remote-access` | error | CAMPAIGN.md 13: remote access is NOT finalised ([x]). Docs describe Tailscale and Cloudflare, the sheet does not, and whether a relay or account is involved is unanswered. Keep every scene inside the home network. |
| `cap-mobile-app` | error | Mobile is closed preview; no store listing exists. In the FTUE the phone uses its browser/Wi-Fi settings only. (Third-party apps such as Immich have their own phone apps; do not show store badges.) |
| `cap-multi-user` | error | Founder letter: "Multi-user operation is on the roadmap, but not on the box." Per-app multi-user (Immich, Nextcloud, Vaultwarden) is that app's feature; platform-level separation of one person's memory or agent from another's is not claimed. (CI-Docs says each person uses their own Companion account via Organizations; that conflicts, hold.) |
| `cap-open-source-companion` | error | The open-source position is [x] unanswered (CAMPAIGN.md 16). No Companion component may be called open-source or inspectable until the component-by-component answer is published. The third-party apps in the catalogue may be called open-source (their manifests say so). |
| `cap-gaming` | error | "Gaming PC", "console replacement", "replaces your console", "play anywhere", "no Steam account": Steam Headless needs the family's own Valve account and a GPU the Core may not have, streams inside the home network only, and is none of those things. |
| `cap-own-apps` | error | Owner ruling 22 Sep 2026: "Own outright" is retired. Users do not own the apps. "No API bill" is the accurate line. ("The AI That You Own" is the sanctioned tagline, used verbatim only.) |
| `cap-made-in` | error | Owner ruling 22 Sep 2026: only "Assembled, configured and burn-in tested in California; mainboards from Framework." "Designed" is nowhere on the sheet and country-of-origin wording is regulated. |
| `cap-uptime` | error | Unmeasured reliability claims. The sheet says "without you babysitting it" and "walk away". |
| `cap-camera-capture` | error | Never present covert or blanket recording of family members or guests. Companion Capture records the user's own machine; Frigate records the family's own cameras on their own property. Neither is for monitoring people who have not agreed. |
| `fake-social-proof` | error | The families are fiction (see disclosures). Nothing may read as a testimonial, review, case study or usage count. CAMPAIGN.md 17: never present any person as a customer or team member. |
| `fake-photo` | review | No simulated capability. A scripted scene is not a recording. Only say "photograph" or "recording" for a real photograph or session on real hardware. |
| `fake-render` | review | Kickstarter forbids photoreal renders of the product. The Core is drawn stylised, line-drawing style, never as a finished-product render. |
| `fake-address-real` | review | A fictional address must not be a real person's address. A street number plus a real ZIP is exactly that. Use invented street names, no ZIP, or a place that cannot resolve. |
| `internal-ids` | error | Internal house ids, Sims-creator names and the ?house= URL form must not appear on any public surface, link or displayed string (old ?house=<id> keeps working but is never displayed or linked). |
| `internal-ids-ordinary` | review | Ordinary words that are also internal house ids. Fine in prose; never in a URL, slug, file name, data attribute, og:image path or alt text that names the house. |

### Shape

| Rule | Severity | Meaning |
|---|---|---|
| `schema` | error | the file does not match the schema; every other rule is skipped until it does |
| `len-title` | error | popup title over six words |
| `len-body` | error | popup body over thirty words (it is the narration and the caption) |
| `len-sentence` | error | a sentence over twenty words (bodies, closing, family story) |
| `len-say` | error | an agent line over sixteen words |
| `len-closing` | error | closing body over thirty words |
| `digits` | error | a digit in a title, body, say line or closing body, except inside an app name such as n8n |
| `body-end` | error | a body or closing that does not end with a full stop (the tagline: warning) |
| `title-case` | error / warn | a title that starts lower case (error); a capital after the first word that is not a product noun, app word or name (warn) |
| `closing` | error | the closing body contains the sign-off "UnCloud your life."; the site and the film add it |

### Structure

| Rule | Severity | Meaning |
|---|---|---|
| `casting` | error | slug, house, household, business or narrator differs from `casting.json`; the surname or the address place differs from the cast plan; a member of the plan (matched by `id`) is missing from the story or differs in name, age, role, archetype or companion's name, or the story has a member the plan does not; (warning) casting lists a role the house files no longer have. The member and surname checks apply only to a casting entry whose members carry ids (the re-cast; the older shape had none) | `bad-32-casting-member-name`, `bad-33-casting-extra-member` |
| `casting-apps` | warn | the plan's `signatureApps` for this home include an app no beat uses (as `app.id` or in `with`); the fleet metrics are counted from the plan | unit test `casting: a family file tells the cast plan's people...` |
| `members` | error | duplicate ids or names; 1 to 3 companions; no companion for a child, baby or visitor (the role part; the age part is `age-companion` below); per-member beat minimums (adults and teens 3, children 1) |
| `voices` | error | a companion voice equals the narrator or another companion; a voice key missing from `voices.json` or not `ready` |
| `chapters` | error / warn | first is ftue, last is outro; living, kitchen and garden present; two further rooms; room chapters have `room`; (warning) the house has no such room |
| `order` | error | beats do not follow chapter order |
| `beats` | error | unknown or duplicate ids; a chapter with no beat; exactly one outro beat; 15 to 34 room beats (the schema holds 22 to 40 beats in all and 7 to 12 chapters; with five ftue beats and the outro, 34 room beats make 40); a couch beat; a TV beat (or a media beat at the couch in the ten homes without a TV); two kitchen beats; a garden beat |
| `refs` | error | `member`, `agent` or `approval` is not a member |
| `ftue` | error / warn | five or six beats; the six ids in fixed order (`ftue-unbox` optional); `wake` only on `ftue-plug-in`; phone popups only in the ftue; `ftue-hello` has a `say`; (warning) the anchors the bible fixes |
| `ftue-claims` | error | the ftue text shows an SSID, pairing code, QR, account step or an offline claim |
| `disclosure` | error | `ftue-pick` note "Installing apps uses the internet."; the first Hermes beat carries "Messages pass through the chat service you choose."; an OpenClaw beat that opens a website carries "OpenClaw reaches websites over your home internet." |
| `agent` | error | an agent without a companion; an agent without `approval` (an agent prepares, a person approves) |
| `agent-app` | error | Hermes on an app whose agent link is not `wired` or `mcp`; OpenClaw on an app with no web interface |
| `say` | error | more than six; a speaker without a companion; a child voiced; a claim in the line ("I can", "everything", "for you") |
| `segment` | error | category small-business with another segment; a business family with fewer than five small-business beats or more than 45%; any other family with more than two |
| `categories` | error | missing setup, home, food, iot, productivity or privacy; fewer than eight of the eleven; children and no kids beat |
| `film` | error | not 8 to 12 film beats; fewer than three ftue beats, no outro beat, fewer than five chapters, fewer than two members, no small-business beat for a business family; more than 215 spoken words; estimated length outside 75 to 115 s |

### Apps

| Rule | Severity | Meaning |
|---|---|---|
| `app-unknown` | error | `app.id` or a `with` id is not in `catalog-apps.json` (the id is the catalog id: `paperless`, not `paperless-ngx`) |
| `app-avoid` | error (warn in a family that is not v3) | the catalog marks the app `avoid` (Kiwix: it ships an empty library). A beat on an avoid app that was in the member's archetype pool also makes `persona-cover` (apps) a warning in a family that is not v3, so the thirty families written before v3 stay valid until each is rewritten. See Story v3 below |
| `app-qa` | error | the app's own listing says it was not boot-tested on a live Hub device |
| `app-qa-screenshot` | review | the app has no QA screenshot; the owner lists the beat in `reviewed.json` |
| `app-caveat` | warn | the app carries a `public-access` or `hardware` caveat and the beat has no `capability` |
| `app-not-in-store` | error | the text names an app that is not in the production store (794 dev-only manifests: Actual Budget, Baby Buddy, MotionEye ...), or the snapshot says the app left the store. "The Bitwarden apps" and "Bitwarden-compatible" are the allowed phrases for VaultWarden. A not-in-store name that is also an ordinary word (`ORDINARY_WORDS` in `lib/context.mts`: Sunshine, Onyx, Lychee) counts only when capitalised in the middle of a sentence, so daylight copy ("Sunshine fills the room", "the sunshine") is clean. The catalog name "Code Server" is matched case-sensitively (`AMBIGUOUS`), so "a code server" is not the app |
| `app-name` | error | bare "Paperless"; write Paperless-ngx |
| `app-undeclared` | error | the text names a Hub app that is not `app.id` or in `with`; the first-party trio (Companion Memory, Hermes, OpenClaw) is exempt. Also checks the tagline, story, closing, work, chapter titles and companion job: a name there must be shown by some beat |
| `app-replaces` | error | `app.replaces` names something the catalog entry does not replace |
| `chips` | error / warn | the first chip is not the app name. In a beat with a `service` (story v3): not exactly two chips, or the second is not `alternative to <Name>` with the registry name of the service (or the alias `app.replaces[0]` uses). In a beat without one: a second chip that is neither `alternative to <Service>` (it needs a `service`) nor the pass 1 form `replaces <X>` (which is `chips-legacy`), or `replaces X` where X is not in `app.replaces`. Warning: `app.replaces` is set and no chip shows it | `bad-54-chips-alternative` |
| `chips-legacy` | error (warn if not v3) | the second chip reads `replaces <X>`, the pass 1 form. In a family that is not v3 it is one warning with the count; in a v3 family it is an error beat by beat. Removed with `fleet-v3` | `bad-55-chips-legacy` |
| `capability` | warn | the one thing the app does is missing, or shares no word with the catalog description |

### Persona (members with an `archetype`; [personas.md](personas.md))

A member without `archetype` is not held to the persona rules, and a family where no member has one skips them (the old
exemplar). `persona-no-ui` is the exception: it reads every beat, because the film and the lander show the same words.

| Rule | Severity | Meaning | Bad case |
|---|---|---|---|
| `persona-cover` | error | a member with an archetype has (a) at least one beat (`beat.member`) in a room of the archetype's `rooms` in `personas.json` (the beat's `anchor.room`, else its chapter's room; the `fallbackRooms` count only when the house has none of the preferred rooms, as a studio flat has no office; the room roles of the member's own cast room, `casting.json` `members[].roomRoles`, always count: the cast plan puts a builder in the garage workshop or an organiser at the dining table, and that room is theirs) and (b) at least one beat whose `app.id` or `with` is in the archetype's app pool. The three-beat minimum is the `members` rule. `at` is `<member>.rooms` or `<member>.apps` | `bad-23-persona-cover-room`, `bad-24-persona-cover-apps` |
| `persona-spread` | error | the members that have an archetype cover at least two distinct ones | `bad-25-persona-spread` |
| `persona-replaces` | warn | a persona beat whose app has catalog `replaces` but whose chips have no `replaces <X>` or `alternative to <Service>` chip: the uncloud argument is missing | `bad-26-persona-replaces` |
| `persona-no-ui` | review | a title, body or `say` line (and, story v2, any `detail` string: `<beat>.detail.before`, `.after`, `.step<n>`, `.fact`) that describes an app's screen ("the screen shows", "on the screen she sees", "the dashboard lists", "the interface", "a notification pops up", "a screenshot of the app"). ADS.md: no UI mockups, no faked app screens, the story is told. `review` because a television in the room or an app that keeps "a screenshot and a PDF of the page" is fine; the owner clears a real exception in `reviewed.json` | `bad-27-persona-no-ui` (guard: `ok-5-archived-screenshot`) |

### Story v3 (decisions of 2026-10-19; `scripts/story/lib/v3.mts`)

Fourteen archetypes (the six above and `tech-family`, `business-owner`, `creative`, `contractor`, `marketer`, `lawyer`, `journalist`, `educator`; the tables
are [personas.md](personas.md) and [persona-apps.md](persona-apps.md)), and **age rule 16**: no member under 16 uses a chat model or an agent in their own beat,
and no member under 16 has an agent companion. A child may appear in a parent-led beat: the beat's `member` is the adult, the child is named in the body as
the one being helped, and the child is never the actor. Non-chat AI tools (LibreTranslate, Whisper-WebUI, Kokoro, Stirling-PDF OCR, Paperless-GPT) carry no tag
and stay open to younger members.

A **chat or agent app** is a catalog entry tagged `"ai": "chat"` in `catalog-apps.json` (`meta.legend.ai`): Companion Memory, Hermes, OpenClaw, Home Assistant
Voice, Spatial Companion, Open WebUI, Ollama, AnythingLLM, Open Notebook, SurfSense, Vane, Project N.O.M.A.D., OpenCode, Aider and the four MCP servers. Add the
tag to any new chat or agent app; the owner can lift it from an app that is not one.

**Which families.** `isV3Story(story)` is true when some beat has a `service` key (`beat.service`, an optional string in the schema: the id of a service of
`content/story/services.json`). The v3 rules below are errors in a v3 family and warnings in every other, the device `detail-missing` uses for v2; when every
family is v3 they can become errors fleet-wide. In a family that is not v3 a rule that would fire on many beats (`service-missing`, `chips-legacy`,
`household-doer`) reports **once**, with the count and the first beat ids, so the thirty families stay readable; in a v3 family each beat is its own error.
The rules that are warnings in a family that is not v3 are listed in `PHASED_RULES` (`lib/v3.mts`), which the tests use to tell a clean sample from one that
only warns for the phase-in. The contract, the registry and the owner's decisions: [story-v3.md](story-v3.md).

| Rule | Severity | Meaning | Bad case |
|---|---|---|---|
| `age-companion` | error (warn if not v3) | a member with a `companion` is under 16. Replaces the old under-13 test of `members`, which keeps the child, baby and visitor role part | `bad-47-age-companion` |
| `age-chat` | error (warn if not v3) | a beat whose `app` or `with` is tagged `ai: "chat"` has a `member` under 16; a beat with an `agent` whose owner is under 16, or whose `approval` member is under 18. A beat with no `member` (a household beat) has no one to hold to it | `bad-46-age-chat`; guard `ok-9-v3-adults` |
| `app-avoid` | error (warn if not v3) | see Apps | unit test `age rule 16...` |
| `service-unknown` | error | the beat's `service` is not an id of `content/story/services.json` | `bad-48-service-unknown` |
| `service-app` | error | `app.replaces[0]` is not the service's name or one of its aliases; or the catalog entry of the app does not list that name in `replaces`; or the registry does not list the app under the service (run `story:services`); or the beat has a `service` and no app | `bad-49-service-app` |
| `service-status` | error | the service carries the flag `stale` or `story-excluded` in the registry, or its `alternativeToForm` is `blocked` (Tailscale, and the three converters whose only app is Convert to it!) | `bad-50-service-stale`, `bad-51-service-blocked` |
| `service-missing` | error (warn if not v3) | `app.replaces` is not empty and the beat has no `service`; or the beat has a `service` and `app.replaces` is empty (a pair-less beat has an empty `app.replaces` and no `service`) | `bad-52-service-missing`, `bad-53-service-no-replaces` |
| `chips`, `chips-legacy` | see Apps | the pair chips: exactly `[App, "alternative to <Service>"]`; the pass 1 form is accepted with a warning until `fleet-v3` | `bad-54-chips-alternative`, `bad-55-chips-legacy` |
| `persona-band` | error (warn if not v3) | a member's own beats (`beat.member`; an agent's `agent` does not count) are outside the band: a baby 1 to 3; a child under 13 3 to 7; an adult or teen 4 to 7 in a family of four or more (8 for the organiser of a business family), 8 to 11 in a family of three, 10 to 12 in a family of two. `at` is `member.<id>` | `bad-56-persona-band` |
| `household-beats` | error (warn if not v3) | more than 6 room beats without a `member` (outside the ftue and outro chapters); 8 when the family has two members | `bad-57-household-beats` |
| `household-kind` | warn | two household beats about one kind of app: one calendar, one notes app, one burn-after-reading note, one reader, one DNS filter, one list ... (`HOUSEHOLD_KINDS` in `lib/services.mts`; an app may belong to several kinds, HomeHub is a calendar, tasks, chores and a list) | `bad-58-household-kind` |
| `household-doer` | error (warn if not v3) | a room beat without a `member` whose `title` or `body` has a member's first name as its subject (the name is not preceded by "of" and not followed by "'s": "Samir's van" and "the plan of Jean" are fine), or that has an `agent`. A person's beat is that person's; without this rule a beat can be labelled shared to keep the persona bands | `bad-59-household-doer` |
| `pair-share` | error (warn if not v3) | fewer than 80 percent of the room beats carry a `service`, or fewer than 80 percent of the third-party persona beats (a `member`, an app that is not `ci-memory`, `ci-hermes` or `ci-openclaw`) do | `bad-60-pair-share` |
| `pair-budget` | error (warn if not v3) | more than 20 percent of the room beats carry no `service`. The same 20 percent as `pair-share`, seen from the pair-less side (first-party agents and games are pair-less by nature) | `bad-60-pair-share` |
| `detail-replaces` (changed) | error | see Story v2: in a beat with a `service` a `before` or `after` may name only that service (its name or an alias) | `bad-61-detail-service` |

`ok-9-story-v3.json` is the Brennan family told in the v3 shape (sixteen pair beats, four pair-less, every member inside the band, Jean at fourteen with no chat
model): a standalone fixture that reports nothing, and the base the story v3 cases `bad-48` to `bad-61` start from (`base: V3_BASE` in `bad-cases.mts`; the
exemplar is the base of every other case). `bad-55` and `bad-58` start from the exemplar because they are warnings of a family that is not v3.

### Story v2 (optional fields; [story-v2.md](story-v2.md))

`beat.detail`, `family.home`, `family.day` and `member.profile` are optional on `family/v1`: a family without them is held to none of these rules
(the 30 shipped families validate exactly as before). The schema holds the shapes and the item counts (detail.steps 2 to 4, home.spots 2 to 5,
day 5 to 10, all four detail fields present together, no unknown keys); the validator counts words, because the narration limits of a popup do not
change. Fixtures: `ok-7-story-v2` is the exemplar with every v2 field valid (the base the cases below break); `ok-6-story-v2.json` is the Brennan family
with every v2 field, validated against the test world's copy of its house (a standalone fixture: `make-bad-fixtures.mts` leaves it alone,
`STANDALONE` in `bad-cases.mts`).

| Rule | Severity | Meaning | Fixture |
|---|---|---|---|
| `detail-len` | error | `before`, `after` or `fact` over 28 words; a step over 12 words; fewer than 2 or more than 4 steps (the schema stops the count first) | `bad-34-detail-len` |
| *(detail copy)* | as the rule | every detail string goes through the text rules like a body: `dash-em-en`, `exclamation`, `emoji`, the banned phrases (`vocab-*`, `num-*`, `sec-*`, `cap-*`, `incumbent-attack`, `internal-ids`), `digits` (none, except inside an app name such as n8n), the app-name rules (`app-undeclared`, `app-not-in-store`, `app-name`: an app named in a detail is `app.id` or in `with`), `text-role` and `persona-no-ui` | `bad-35-detail-copy`, `bad-39-detail-apps-and-ui` |
| `detail-replaces` | error | a `before` or `after` that names a rented service (any `replaces` name in the catalog, or a company such as Google, Apple, Amazon, Microsoft, Adobe) that is in neither the beat's `app.replaces` nor the catalog entry's `replaces`. A bare company name is covered by an allowed name that starts with it ("Google" beside Google Photos); a family or companion name and an ordinary word that is also a service (Make, Mint, Ring ...) never count (those are matched capitalised, not at the start of a sentence). The uncloud argument must not attack a company the chip does not name. **Story v3:** in a beat with a `service` the allowed names are that service's name and aliases and nothing else, and every service of the registry (241) is checked, not only the catalog's `replaces` names; the registry's ordinary-word services (Clerk, Sanity, Glean, Distill, Make, Ring ...) are matched capitalised, not at the start of a sentence. A beat without a `service` keeps the rule above unchanged | `bad-36-detail-replaces`, `bad-61-detail-service`, guard `ok-8-detail-services-allowed` |
| `detail-fact` | warn | the `fact` shares no word of five letters or more with the app's catalog description (the same test as `capability`) | `bad-37-detail-fact` |
| `detail-missing` | warn | a beat of an adult or teen (13 or older) with an `archetype` has no `detail`. Applies only once the story has at least one `detail`, so a story that has not started on details is not warned beat by beat | `bad-38-detail-missing` |
| `home-lede` | error / warn | the lede over 50 words, or a sentence over 22 words; names the house id or its display name, or a builder or game word (Sims, Base Game); `text-role` (no fireplace, TV, crib or kitchen island the house lacks). Warning: not two or three sentences; not ending in a full stop | `bad-40-home-lede`, `bad-41-home-lede-furniture` |
| `home-spots` | error | 2 to 5 spots; `room` is not an exact room name of the house (the spec's, or casting's); a room twice; a line over 16 words; `text-role` on the line | `bad-42-home-spots` |
| `day` | error / warn | a `beat` id that is not in the story; `at` not in morning, midday, afternoon, after-school, weekend; the order goes back; a line over 14 words, or equal to the beat's own title or body; fewer than 5 or more than 10 entries. Warning: an adult or teen member (13 or older) who is in no entry | `bad-43-day`, `bad-44-day-member` |
| `profile` | error | a bio over 45 words; the text rules and `digits` (no age: the page shows it) apply | `bad-45-profile` |

`body-end` warns when a detail `before`, `after` or `fact`, a lede, a spot or day line or a bio does not end with a full stop.

### House

| Rule | Severity | Meaning |
|---|---|---|
| `anchor` | error / warn | neither the anchor role nor any fallback resolves in the beat's own house; a role not in every house whose fallback chain does not end in a universal role (street, front-door, core, room, couch, counter, garden); (warning) `nth` beyond what the house has |
| `text-role` | error | the text says TV, fireplace, crib or a kitchen island and the house has none (or `casting.homeFlags` says so). "Nursery" counts only for a baby's room, never a plant nursery |

### Fleet (`--fleet`; `--complete` makes the count metrics gate)

Uniqueness metrics always gate, because a clash between two families is true for any subset. Count metrics are reported as
`partial` until `--complete`.

| Rule | Gate | Metric |
|---|---|---|
| `fleet-count` | complete | every casting slug has a family file (36 with the six apartments, whose stories are still to be written: on a whole-set run a casting family without a file is a note, an error under `--strict-families`); a slug not in casting or in two files always fails |
| `fleet-topics` | complete | each of the ten topics (categories except setup) in at least ten families |
| `fleet-apps` | complete | at least 70 distinct apps; no third-party app in more than 40% of families (from ten families on; a flagship family is three homes and counts once per home, so Steam Headless in all three flagship homes is three of the twelve it may have in 30 families (fourteen in 36)); the story-rich apps (catalog `meta.top15`) each in at least three; an app with no QA screenshot (`mealie` today) is left out of that list, because placing it needs an owner entry in `reviewed.json` and the catalog names a screenshot-backed fallback (`kitchenowl`), so 14 of the 15 count |
| `fleet-segments` | complete | small-business beats at least 18% of all beats |
| `fleet-unique` | always | no repeated surname, address place, companion name, beat title outside the ftue, or beat body; a first name used at most twice. **Flagship exemption:** families marked `flagship: true` in `casting.json` (Sally, John, Steve and Jean in three homes) do not clash with each other on surname, companion name or first name (the three homes are one use of a first name); a flagship name against any other family, and every other check (address place, beat titles, beat bodies), still fails |
| `fleet-archetypes` | complete | how many families show each archetype (a family counts once per archetype; always reported). Gate: organiser, builder, gamer and learner each in at least 6 families, gamer in at most 12 (the 40% cap on Steam Headless). Maker and host are reported, not gated |
| `fleet-voices` | complete | narrator counts equal `voices.json` `narratorFor` (never above it, even before complete) |
| `fleet-v3` and the story v3 counts | every family v3 | `FLEET_V3` in `lib/fleet.mts`. Reported always, gated only once **every** family is a v3 family (`isV3Story`), so a fleet in the middle of the rewrite is held to nothing new: distinct apps 100 instead of 70 (`fleet-apps`); at least 70 distinct services in the fleet and 14 in each v3 home (`fleet-services`); each v3 home's room beats at least 80 percent paired (`fleet-pairs`); families naming Kiwix at most 6 (moot while Kiwix is `avoid`); the share of room beats on an app in at most 8 homes is information only (`fleet-rare`, 40 percent or more wanted). `fleet-v3` (every family is v3) gates only when `FLEET_V3.v3Required` is set, in the last PR. The app cap is `FLEET.appShareMax` of the families present (`appCap(n)`: 12 of 30, 14 of 36), never a fixed number |

## Adding a rule

1. Put the check in the module that owns its kind (`text`, `shape`, `structure`, `apps`, `anchors`, `quotas` or `fleet`
   under `scripts/story/lib/`). Report through the `Report` methods (`E`, `R`, `W`, or `add` for a data-driven severity) with
   a rule id, the place (`at`), a message that says what is wrong, and a `fix`.
2. A new banned phrase is a row in `content/story/claims.json` `bannedPhrases` (`id`, `pattern`, `flags`, `severity`, `why`,
   `fix`), nothing else; the test checks it compiles and is not global.
3. Add a case to `scripts/story/lib/bad-cases.mts` (`expect` the error or review rule ids, `warn` the warning ids of a
   case that still passes the gate), then `node --experimental-strip-types scripts/story/make-bad-fixtures.mts` to write the
   fixture. `scripts/test-stories.mts` fails when a fixture is not exactly the exemplar plus its mutation (or, for a story v3 case,
   `base: V3_BASE` plus its mutation: the whole v3 family `ok-9-story-v3.json`). A persona rule's
   case starts from `persona(s)` (the exemplar told as an organiser and a maker, which passes everything) and breaks one thing.
   A clean case that must ignore a family of phase-in rules says which in `tolerate`.
4. Found a false positive in a writer's text? Fix the rule, and add an `ok-*` case with `absent: [rule]` so it cannot return.
   The two so far: "nursery" in a grower's plant nursery, and "island" in a lake.
5. Add the rule to the catalogue above. The exemplar must still pass with 0 errors, 0 review, 0 warnings.
6. A fixture that is not the exemplar plus a mutation (a sample copied from a family file) goes in `STANDALONE` in `bad-cases.mts`, or `make-bad-fixtures.mts`
   deletes it (the script owns every `bad-*.json` and `ok-*.json`). A story v2 case starts from `v2(s)` (the exemplar with every v2 field valid), a persona
   case from `persona(s)`, a story v3 case from `v3(s)` (the exemplar with one `service` key, so the v3 rules are errors).

## Publish-day catalog re-check

The catalog is a curated snapshot (2026-10-01) of the live store and the manifests on main. Re-check it by hand before a
story goes live; this is never part of CI and the network step is explicit:

```bash
git -C ../HUB/CI-Marketplace fetch origin
node --experimental-strip-types scripts/story/build-catalog-snapshot.mts --fetch            # report only
node --experimental-strip-types scripts/story/build-catalog-snapshot.mts --fetch --write    # refresh inLiveStore and the date
pnpm run story:validate -- --complete
```

It compares `GET https://hub.ci.computer/api/store` and the manifests at `origin/main` (read with `git cat-file`, so the clone's
checked-out branch does not matter; `--repo`, `--ref`, `--manifests-dir` and `--live <saved response>` override the defaults)
with the catalog and reports apps that left the store, `replaces` names a manifest dropped, renames, and new store apps that
nobody has curated yet. It exits 1 if a story could be wrong. `--write` changes only `inLiveStore` and the snapshot date: the
judgements (`storySafe`, caveats, agent link, QA status) are curated by reading manifests and are never regenerated.

## What it does not check

Whether a sentence is true to the product beyond the claims in `claims.json`, whether a fictional name and town resolve to a
real household (read it against a map), how the voices sound, whether an anchor has a good camera pose (story-bake reports that),
or the `HOLD` claims in the bible, which have no regex because the owner has not ruled. Those stay with the human reviewer.
