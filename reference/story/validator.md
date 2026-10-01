# Story validator

`pnpm run story:validate` is the gate for the family stories (`content/families/<slug>.json`). One authored file per
family is the single source of the text on the family page, in the popups, in the voice-over and in the film, so
this is where the voice, the claims, the app facts and the house facts are enforced. It needs no GPU and no network.
Contract: the schema (`content/story/schema/family.schema.json`), `assets/story/types.ts`, and the shared inputs in
`content/story/`.

```bash
pnpm run story:validate                          # every content/families/<slug>.json (zero files is a pass, with a note)
pnpm run story:validate -- vance-takahashi       # one family by slug
pnpm run story:validate -- path/to/family.json   # one file by path (fixtures, work in progress)
pnpm run story:validate -- --fleet               # also the cross-family metrics
pnpm run story:validate -- --complete            # all 30 casting slugs present and the fleet counts gate (implies --fleet)
pnpm run story:validate -- <slug> --json         # the same result as JSON on stdout
pnpm run test                                    # scripts/test-stories.mts runs the validator over the exemplar and the fixtures
```

Exit code 1 on any `error`, and on any `review` finding that is not on the allow-list. Warnings print and never fail.
A writer's loop is: run it for your slug, fix every error, read every warning, then read the file aloud at 150 words a minute.

## Where the checks get their facts

| Input | Used for | Owner |
|---|---|---|
| `content/story/schema/family.schema.json` | shape, enums, lengths | story-validator |
| `content/story/claims.json` | the 69 banned phrases, the sanctioned claims, the disclosures | contract |
| `content/story/catalog-apps.json` | which apps exist, their caveats, QA status, agent link, `replaces` | story-validator (re-check: `scripts/story/build-catalog-snapshot.mts`) |
| `content/story/casting.json` | slug, house, household, business and narrator per family; `homeFlags` | story-validator |
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
closing. Code identifiers (slug, house, ids, URLs), `notes` and `capability` are never scanned. HTML is stripped and curly
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
| `num-silent` | error | The Core has a Noctua fan. The measured fact is 19 dB at idle; there is no load figure. |
| `num-app-counts` | error | The only app count is "300+ apps and agents available in the Companion Hub store." (owner ruling 22 Sep 2026). 84 integrations, 250+, 200+, 1,296 and 814 are all banned (cautions: 84 has no source; 1,296 is a directory count). |
| `num-field-units` | review | Founder-letter number, not yet on the fact sheet (COPY.md 12.9). |
| `num-minutes` | error | No measured setup or install time exists. "Installs in minutes" is a house pitch line but not on the campaign sheet. |
| `num-model-names` | error | Fabrication-guard model names (HUB-MODELS cautions). |
| `campaign-terms` | review | Campaign economics are not retail facts and moved weekly. Terms belong on the Kickstarter page. Stories name no tier, price, ship date, warranty or backer perk. |
| `no-subscription` | review | A year of Hub Pro (Companion Memory included) ships with a Core and renewal exists after it. "No cloud, no telemetry, no subscription" is a verbatim hero line on the sheet; in a story it needs the qualifier. "No API bill" is the safe line. |
| `sec-absolute` | error | No security or privacy guarantee. The sheet supports "Full-disk encryption is supported. Your keys." (supported, not default) and "Local by default". Absolute wording needs legal review (MEMORY-PAGE cautions). |
| `sec-never-leaves` | error | Not supportable: Hub is Portal-connected by default, store browsing and installs use the internet, crash reporting has been opt-out (PLATFORM-VISION cautions). The sheet's FAQ line is narrower: "No usage data is collected from your machine." |
| `sec-offline` | error | The Companion Hub store, app installs, the alternatives view and any messaging or web agent need the internet. The sheet claims only that no internet connection is required to use the machine you bought. |
| `sec-compliance` | error | No compliance, certification or audit claim is supportable. OpenEMR in the catalogue is not HIPAA; Plausible's own listing says "GDPR" and we do not repeat it. |
| `sec-medical` | error | No medical claim. Fitness and recipe apps are record-keeping apps. |
| `sec-safety-people` | error | No safety guarantee. Pi-hole blocks ad and tracker domains; it is not parental control. Frigate records and detects objects; it does not guarantee a break-in is caught. |
| `legal-claims` | error | No legal, tax or financial claim. DocuSeal and Documenso sign documents; whether a signature is valid is not our statement. |
| `sec-fear` | review | Empower, do not frighten. Name the mechanism calmly; do not threaten the reader or show a family in danger. |
| `incumbent-attack` | error | No unsourced factual claim about a named company. The CI-Common matrix of such judgements is uncited. A Kickstarter-adjacent page is commercial speech; escalate comparative use to counsel. |
| `logo-trademark` | error | Third-party software is named in text only, never as a logo (CAMPAIGN.md 6c). |
| `cap-parity` | error | The sheet concedes this: a Core runs a very good open-weight model, not the best model in the world this month. Never imply parity. |
| `cap-omniscient` | error | Companion Memory is in beta. Proactive forecasting cards ("Your week, taking shape", "It notices what you've dropped") carry a Rolling out pill upstream. Today it supplies individual context to OpenClaw and Hermes. |
| `cap-autonomy` | review | Agents act inside permissions the family sets. No story may show an agent spending money, contacting a third party or cancelling something without the person approving. |
| `cap-cloud-model` | review | OpenClaw and Hermes can be pointed at cloud model providers. A "private agent" scene is private only on the Core's local model; never show or mention a cloud key. |
| `cap-messaging-private` | error | Hermes reaches you through messengers that are someone else's servers. The message travels through them. |
| `cap-remote-access` | error | CAMPAIGN.md 13: remote access is NOT finalised ([x]). Docs describe Tailscale and Cloudflare, the sheet does not, and whether a relay or account is involved is unanswered. Keep every scene inside the home network. |
| `cap-mobile-app` | error | Mobile is closed preview; no store listing exists. In the FTUE the phone uses its browser/Wi-Fi settings only. (Third-party apps such as Immich have their own phone apps; do not show store badges.) |
| `cap-multi-user` | error | Founder letter: "Multi-user operation is on the roadmap, but not on the box." Per-app multi-user (Immich, Nextcloud, Vaultwarden) is that app's feature; platform-level separation of one person's memory or agent from another's is not claimed. (CI-Docs says each person uses their own Companion account via Organizations; that conflicts, hold.) |
| `cap-open-source-companion` | error | The open-source position is [x] unanswered (CAMPAIGN.md 16). No Companion component may be called open-source or inspectable until the component-by-component answer is published. The third-party apps in the catalogue may be called open-source (their manifests say so). |
| `cap-own-apps` | error | Owner ruling 22 Sep 2026: "Own outright" is retired. Users do not own the apps. "No API bill" is the accurate line. ("The AI That You Own" is the sanctioned tagline, used verbatim only.) |
| `cap-made-in` | error | Owner ruling 22 Sep 2026: only "Assembled, configured and burn-in tested in California; mainboards from Framework." "Designed" is nowhere on the sheet and country-of-origin wording is regulated. |
| `cap-uptime` | error | Unmeasured reliability claims. The sheet says "without you babysitting it" and "walk away" and discloses beta. |
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
| `casting` | error | slug, house, household, business or narrator differs from `casting.json`; (warning) casting lists a role the house files no longer have |
| `members` | error | duplicate ids or names; 1 to 3 companions; no companion for a child, baby or visitor; per-member beat minimums (adults and teens 3, children 1) |
| `voices` | error | a companion voice equals the narrator or another companion; a voice key missing from `voices.json` or not `ready` |
| `chapters` | error / warn | first is ftue, last is outro; living, kitchen and garden present; two further rooms; room chapters have `room`; (warning) the house has no such room |
| `order` | error | beats do not follow chapter order |
| `beats` | error | unknown or duplicate ids; a chapter with no beat; exactly one outro beat; 15 to 24 room beats; a couch beat; a TV beat (or a media beat at the couch in the ten homes without a TV); two kitchen beats; a garden beat |
| `refs` | error | `member`, `agent` or `approval` is not a member |
| `ftue` | error / warn | five or six beats; the six ids in fixed order (`ftue-unbox` optional); `wake` only on `ftue-plug-in`; phone popups only in the ftue; `ftue-hello` has a `say`; (warning) the anchors the bible fixes |
| `ftue-claims` | error | the ftue text shows an SSID, pairing code, QR, account step or an offline claim |
| `disclosure` | error | `ftue-plug-in` note "Companion OS is in beta."; `ftue-pick` note "Installing apps uses the internet."; the first Hermes beat carries "Messages pass through the chat service you choose."; an OpenClaw beat that opens a website carries "OpenClaw reaches websites over your home internet."; the first mention of Companion Memory reads "Companion Memory (beta)" |
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
| `app-avoid` | error | the catalog marks the app `avoid` |
| `app-qa` | error | the app's own listing says it was not boot-tested on a live Hub device |
| `app-qa-screenshot` | review | the app has no QA screenshot; the owner lists the beat in `reviewed.json` |
| `app-caveat` | warn | the app carries a `public-access` or `hardware` caveat and the beat has no `capability` |
| `app-not-in-store` | error | the text names an app that is not in the production store (794 dev-only manifests: Actual Budget, Baby Buddy, MotionEye ...), or the snapshot says the app left the store. "The Bitwarden apps" and "Bitwarden-compatible" are the allowed phrases for VaultWarden |
| `app-name` | error | bare "Paperless"; write Paperless-ngx |
| `app-undeclared` | error | the text names a Hub app that is not `app.id` or in `with`; the first-party trio (Companion Memory, Hermes, OpenClaw) is exempt. Also checks the tagline, story, closing, work, chapter titles and companion job: a name there must be shown by some beat |
| `app-replaces` | error | `app.replaces` names something the catalog entry does not replace |
| `chips` | error / warn | the first chip is not the app name; other chips are not "replaces X"; a chip names something not in `app.replaces` |
| `capability` | warn | the one thing the app does is missing, or shares no word with the catalog description |

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
| `fleet-count` | complete | all 30 casting slugs present; a slug not in casting or in two files always fails |
| `fleet-topics` | complete | each of the ten topics (categories except setup) in at least ten families |
| `fleet-apps` | complete | at least 70 distinct apps; no third-party app in more than 40% of families (from ten families on); the 15 story-rich apps (catalog `meta.top15`) each in at least three |
| `fleet-segments` | complete | small-business beats at least 18% of all beats |
| `fleet-unique` | always | no repeated surname, address place, companion name, beat title outside the ftue, or beat body; a first name used at most twice |
| `fleet-voices` | complete | narrator counts equal `voices.json` `narratorFor` (never above it, even before complete) |

## Adding a rule

1. Put the check in the module that owns its kind (`text`, `shape`, `structure`, `apps`, `anchors`, `quotas` or `fleet`
   under `scripts/story/lib/`). Report through the `Report` methods (`E`, `R`, `W`, or `add` for a data-driven severity) with
   a rule id, the place (`at`), a message that says what is wrong, and a `fix`.
2. A new banned phrase is a row in `content/story/claims.json` `bannedPhrases` (`id`, `pattern`, `flags`, `severity`, `why`,
   `fix`), nothing else; the test checks it compiles and is not global.
3. Add a case to `scripts/story/lib/bad-cases.mts` (`expect` the rule ids), then
   `node --experimental-strip-types scripts/story/make-bad-fixtures.mts` to write the fixture. `scripts/test-stories.mts`
   fails when a fixture is not exactly the exemplar plus its mutation.
4. Found a false positive in a writer's text? Fix the rule, and add an `ok-*` case with `absent: [rule]` so it cannot return.
   The two so far: "nursery" in a grower's plant nursery, and "island" in a lake.
5. Add the rule to the catalogue above. The exemplar must still pass with 0 errors, 0 review, 0 warnings.

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
