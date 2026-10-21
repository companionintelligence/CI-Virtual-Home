# Story v3: fields, files, rules

The contract for the story-v3 phase of CI-Virtual-Home, as implemented. It extends story v2 ([story-v2.md](story-v2.md)) and replaces none of it. The rule
table is [validator.md](validator.md) ("Story v3"); the archetypes and their app pools are [personas.md](personas.md), [persona-apps.md](persona-apps.md) and
[persona-bible.md](persona-bible.md); the way a beat is written and shot is [shots-and-scripts-playbook.md](shots-and-scripts-playbook.md); the law for any
wording is `content/story/claims.json`.

**What v3 is.** CI-Virtual-Home is a story-driven interactive ad lander. Every home is lived in by a fictional family, and each room tells one member's story: an
ordinary moment, the open-source app from the Companion Hub store that does it, and the cloud service that app is the alternative to. The argument is privacy,
uncloud and bringing your data home. Story v3 makes that pair (the app and the service) a first-class field, a registry and a set of rules, so that the
argument is the same in every home and checked by machine.

## Decisions folded in (the owner's, 2026-10-19)

These win over any older document.

1. **Rewrite the stories**, every home, not patch them, to tell more varied and pointed stories about the open software that runs the family's private virtual lives.
2. **Rework the casting skew.** Fourteen archetypes: organiser, builder, gamer, learner, maker, host, then tech-family, business-owner, creative, contractor,
   marketer, lawyer, journalist, educator. Age, role and household shape of a recast member are kept unless the home forces a change; names are invented,
   varied in heritage and never tied to the architecture; a first name is used at most twice in the fleet, no surname or companion name repeats (the flagship
   family is exempt, as today). No archetype with three or more members may be more than 65 percent one gender-coded name set, judged by the name and the
   pronouns used (the cast has no gender field): rename to rebalance. A girl or a boy is never put in a role by reflex. Every family keeps two or more archetypes;
   a business home keeps at least one organiser, builder or business-owner.
3. **Age 16.** No member under 16 uses a chat model or an agent in their own beat, and no member under 16 has an agent companion. A chat app is a catalog entry
   tagged `ai: "chat"`. A child may appear in a parent-led beat: the beat's `member` is the adult, the child is named in the body as the one being helped, and
   the child is never the actor. Non-chat AI tools (LibreTranslate, Whisper-WebUI, Kokoro, Stirling-PDF OCR) are tools, not chat models, and stay open to younger
   members. The rules are `age-chat` and `age-companion`.
4. **Unreadable (bot-walled) sources** stay marked unread: no story line, claim or caption may depend on one, and nothing is cited as verified that was not read.

**Dropped from the first v3 design:** `member.lens` and `lenses.json` (the fourteen archetypes replace them), `beat.also` (unused), the `app-media.json` v2 tiers and
`media-review.json` (the pages stage), and the `portal/services/` icon files (owner-supplied, may stay empty).

**Staging.** Stage 1 (foundation): the archetypes, the age rule, the Kiwix tooling, the `service` pairs and the registry, the household, persona-band and pair
rules (this document), then the 30-home recast and the app rotation. Stage 2 (pilot): the three flagship homes (`seraphine`, `bgfamily`, `familyhouse-nora`)
rewritten end to end, reviewed and fleet-checked. Stage 3: the other 27 homes in batches, then the six apartments once they are folded in, then the page
builders for the pair component (the apartments are cast in a separate file and applied only then).

**What "varied and pointed" means for the writers.**

- *Pointed:* each beat argues one specific thing, named in its first sentence: what the rented service held, learned, charged or changed, and what the family's
  own copy does instead. No generic "your data stays home". The `detail.before` and `detail.after` fields carry that contrast, and `detail.fact` carries one
  checkable fact from the app's own docs or listing.
- *Varied:* across a family at most one beat per app; across the fleet no repeated title or body; the moments differ in kind (a Monday admin hour, a mistake
  caught, a hand-off to a neighbour, a dated file found years later, a person leaving a service, a child learning something, a hobby, a daylight scene). Mix
  household beats and personal beats within the bands below. App rotation: no third-party app in more than 40 percent of the families (12 of 30 now, 14 of 36
  later); a persona's pool apps rotate per home, so the fleet shows many apps, each for a different human reason.
- *Honest:* `claims.json` is law; unverified or bot-walled sources never support a line; an app with no vetted QA screenshot stays behind `reviewed.json` (owner
  only); nothing is promised that the Hub listing does not do (AudioMass saves where the person chooses, Steam needs a Valve account, a speed is never
  stated, a class list or a grade never lives on a home Core).
- *Voice:* the bible's twelve writer rules and twelve cinematographer rules; sentence case; no em or en dash, no exclamation mark; "Companion Core / Hub /
  Memory / OS", "agent" not assistant; the beta line wherever software is claimed; no price; daylight only.

## Compatibility and the v3 family

Every field below is optional on `family/v1` (the schema id stays `https://homes.ci.computer/schema/family-v1.json`). A family file with none of them
validates as before. A family with at least one `beat.service` is a **v3 family** (`isV3Story`, `scripts/story/lib/v3.mts`) and is held to the v3 rules at full
severity; every other family meets them as warnings, the device `detail-missing` uses for v2. So `story:validate` on the thirty families written before v3
stays at exit 0 (with warnings) until each home is rewritten. When all thirty are v3 families, `fleet-v3` turns the warnings into errors fleet-wide (the
constant `FLEET_V3.v3Required`, off today).

Where this differs from story v2's text: a persona's "3 to 7 beats of its own" was a writing guide that nothing enforced; in a v3 family the bands below replace it.

## Files

| Path | Change | Authored or generated |
|---|---|---|
| `content/story/schema/family.schema.json` | `beat.service`; `popup.chips` items `maxLength` 28 to 48 | authored |
| `assets/story/types.ts` | `Beat.service?`; `SERVICE_ID_PATTERN`, `CHIP_MAX_LENGTH`, `ALTERNATIVE_CHIP_PREFIX`, mirrored by the schema and kept equal by a test (`keys.ts` mirrors nothing: it holds the keyboard actions) | authored |
| `content/story/services.json` | **new**: the registry of replaced services | facts authored; derived columns by `scripts/story/build-services.mts` |
| `scripts/story/build-services.mts` | **new**: recompute the derived columns, `--check` | authored |
| `scripts/story/lib/services.mts` | **new**: `service-*`, `household-*`, `persona-band`, `pair-*` | authored |
| `scripts/story/lib/apps.mts`, `v2.mts`, `persona.mts`, `fleet.mts`, `context.mts`, `validate.mts`, `bad-cases.mts` | `chips` and `chips-legacy`; `detail-replaces`; `persona-replaces`; the v3 fleet constants; the registry in `Ctx`; the wiring; the cases | authored |
| `content/story/claims.json` | `names-logos-owners`; the `logo-trademark` scope; the "alternative to" fix text; `third-party-apps` reworded | authored |
| `test/fixtures/stories/bad-48` to `bad-61`, `ok-9-story-v3` | **new**: one case per rule, and a whole valid v3 family | authored |
| `content/families/<slug>.json` | per home, in stages 2 and 3 | authored by the home's writer |

## `beat.service`

```json
"service": { "type": "string", "pattern": "^[a-z0-9][a-z0-9-]{1,38}$" }
```

The id of the replaced service this beat's app is the alternative to, from `content/story/services.json`. At most one. It is present exactly when `app.replaces` is
not empty. `app.replaces` keeps its pass 1 shape (up to three names of the catalog entry's `replaces`, each at most 32 characters); under v3 its **first** name is the
service's name or one of its aliases, and the other names are not shown.

| Rule | Severity | Fires when |
|---|---|---|
| `service-unknown` | error | `service` is not an id in `services.json` |
| `service-app` | error | `app.replaces[0]` is not the service's name or an alias; or the catalog entry does not list that name in `replaces`; or the registry does not list the app under the service; or the beat has a `service` and no app |
| `service-status` | error | the service carries the flag `stale` or `story-excluded`, or its `alternativeToForm` is `blocked` |
| `service-missing` | error (warning in a family that is not v3) | `app.replaces` is not empty and `service` is absent, or `service` is present and `app.replaces` is empty |

## `popup.chips`

`items.maxLength` is 48. For a beat with `service`, `chips` is exactly two items: the app's display name, then `alternative to ` followed by the service's registry
`name` (or the alias that `app.replaces[0]` uses, such as `GitLab (SaaS)`; write the registry name). A beat without a `service` has one chip, the app name.

| Rule | Severity | Fires when |
|---|---|---|
| `chips` | error | the first chip is not the app name; in a pair beat there are not exactly two chips, or the second is not `alternative to <Name>`; in a beat without a `service` a second chip is not the pass 1 form |
| `chips-legacy` | error in a v3 family, warning otherwise | the second chip reads `replaces <X>`, the pass 1 form. One warning with the count in a family that is not v3. Removed with `fleet-v3` |

## Household beats

A room beat (any beat outside the first-run and outro chapters) with no `member` is a **household beat**. It has no `agent`, names no member as the doer anywhere in
its `title` or `body`, and may be pointed at by `day`. Its subject is the household, the business or the thing ("The practice logs the week's hours", "A Cryptgeon
note holds the gate code"). A beat about one person's work is that person's: it has a `member`. A member's name may appear as a possessor ("Samir's van"), or after
"of", never as the subject.

| Rule | Severity | Fires when |
|---|---|---|
| `household-beats` | error (warning in a family that is not v3) | more than 6 room beats without a `member`; 8 when the family has two members |
| `household-kind` | warning | two household beats of one kind in one family: one calendar, one notes app, one burn-after-reading note, one reader, one DNS filter, one list (`HOUSEHOLD_KINDS` in `lib/services.mts`) |
| `household-doer` | error (warning in a family that is not v3) | a beat without a `member` has a member's first name as the subject of its `title` or `body`, or has an `agent`. Without it a person's beat can be labelled shared to keep the persona bands |

## Persona bands and the pair share

| Rule | Severity | Fires when |
|---|---|---|
| `persona-band` | error (warning in a family that is not v3) | a member's own beats (`member` only; an `agent` does not count) fall outside the band: a baby 1 to 3; a child under 13 3 to 7; an adult or teen 4 to 7 in a family of four or more (8 for the organiser of a business family), 8 to 11 in a family of three, 10 to 12 in a family of two |
| `pair-share` | error (warning in a family that is not v3) | room beats with a `service` are under 80 percent, or the third-party persona beats (a `member`, an app that is not `ci-memory`, `ci-hermes` or `ci-openclaw`) with a `service` are under 80 percent |
| `pair-budget` | error (warning in a family that is not v3) | room beats without a `service` exceed 20 percent: the pair-less budget. First-party agents and games are pair-less by nature |

## `beat.detail` (story v2 shape, unchanged)

`detail-replaces` now reads the beat's `service` and the registry. In a beat with a `service`, a `before` or `after` may name only that service (its name or an alias),
and every other service of the registry (and every company stem such as Google) is refused; a bare company name is allowed where an allowed name starts with it
("Google" beside Google Photos). In a beat with no `service` (a pair-less beat, or any beat of a family that is not v3) the story v2 rule stands: the beat's
`app.replaces` and the catalog entry's `replaces`. The four-field shape, the word limits and the copy rules do not change.

## The registry: `content/story/services.json`

```json
{ "v": 1, "generated": "2026-10-19", "checked": "2026-10-18", "services": [ {
  "id": "google-photos", "name": "Google Photos", "aliases": [], "category": "photos",
  "homepage": "https://www.google.com/photos/about/", "homepageChecked": "ok", "link": "yes",
  "flags": [], "alternativeToForm": "ok", "storyStatus": "ok",
  "mark": { "mode": "badge", "glyph": "image", "logoAllowed": true, "cleared": false, "ownedFile": "CI-Public-Website:src/public/icon-pack/service-logos/google_photos.svg", "ownedKind": "exact" },
  "incumbentNameList": true,
  "apps": ["immich", "librephotos", "photoprism", "photoview"], "storyApps": ["immich", "librephotos", "photoprism", "photoview"],
  "fleetHomes": ["adeniran", "adler"], "rank": 18, "top80": true } ] }
```

241 services: every service the Companion Hub store's `replaces` field names, merged with the Portal alternatives file, homepages checked on `checked`. Authored facts
come first in a row, derived columns last.

| Field | Meaning and rule |
|---|---|
| `id` | Kebab-case, stable, unique, matches `SERVICE_ID_PATTERN`. Referenced by `beat.service` |
| `name` | Exactly as the second chip prints it. Unique, case-insensitively, across names and aliases of different services |
| `aliases` | Other spellings the store or the catalog uses ("Amazon Kindle", "GitLab (SaaS)", "VS Code (Proprietary)"). An alias that differs from its own service's name only by case is allowed |
| `category` | One of the registry categories (`REGISTRY_CATEGORIES` in `build-services.mts`: ai, utilities, data, development, productivity, communication, creative, finance, notes, media, documents, identity, marketing, publishing, home, monitoring, network, travel, health, security, gaming, photos, books, food, commerce, automation) |
| `homepage`, `homepageChecked` | The service's own page; the result of the check on the file's `checked` date (`ok`, or the reason) |
| `link` | `yes` when the check is `ok` (the page may be linked); `text-only` for a bot-blocked, rate-limited, unverified or renamed page; `never` for a dead one |
| `flags` | `stale` (Mint, Pocket, App in the Air, OurHome), `story-excluded` (30), `ordinary-word` (Make, Harvest, Ring, Sketch, Clerk, Distill, Glean, Sanity: matched capitalised and not at the start of a sentence), `renamed` (NotebookLM: the homepage moved to another name; it stays `text-only` until the owner decides). A flagged service stays in the file with its flag; `service-status` refuses it |
| `alternativeToForm` | `ok`, `review` (Duo: a campaign-terms review hit), `blocked` (Tailscale, and CloudConvert, Zamzar and Convertio, whose only app is Convert to it!, a name the copy rules ban). A blocked form may never be the second chip |
| `mark` | `mode` is `badge` (default) or `logo`; `glyph` a neutral icon id; `logoAllowed` is false when the service is stale, blocked or story-excluded; `cleared` is set only by the owner; `ownedFile` is the file CI already holds (provenance, not permission); `ownedKind` is exact, listing-logo, parent or none |
| `incumbentNameList` | Derived: the name or an alias holds a word of the `incumbent-attack` list of `claims.json` (only the neutral form "alternative to" may use it) |
| `storyStatus` | Derived: `ok` when a story-safe catalog app replaces it; `excluded-only` when every app is a catalog exclusion; else `uncurated-only` |
| `apps` | Store apps that list the service in `replaces`. The catalog (apps and exclusions) is the source for every app it knows; the apps of the 2026-10-18 store scan that the catalog does not know are carried as they are, because the live store cannot be reached offline. The union, sorted |
| `storyApps` | The catalog apps in `apps` that are not marked `avoid` (Kiwix, marked avoid, is not one) |
| `fleetHomes` | Derived: homes whose ledger names the service. A beat's `service` if it has one, else the names in its `app.replaces` |
| `rank`, `top80` | Derived: order by distinct apps (a duplicate listing counts once), then story apps, then a usable service before a stale, story-excluded or blocked one, then name; `top80` is rank 80 or better. The research seed also broke ties by the Portal alternatives file, which this repository does not hold, so four of the 80 differ from the seed |

**Build and check.** `pnpm run story:services` recomputes the derived columns and writes the file (deterministic: the same inputs give the same bytes; no clock in the
output). `pnpm run story:services:check` exits 1 when the file differs from what the catalog and the families give, or an invariant fails; the test suite
(`pnpm run test`) runs the same check. Because `fleetHomes` reads the families, **run `pnpm run story:services` after editing a family file** (or the catalog) and commit the result with it. Invariants:

- ids match the pattern and are unique; names and aliases are unique case-insensitively across different services;
- every `category`, `link`, `alternativeToForm` and flag is a known value; the homepage is an `https` URL;
- every `replaces` name of every live catalog app (and exclusion) is a name or alias of a service, so the registry is regenerated from the store's `replaces`, never the other way round;
- every `beat.service` of every family file resolves;
- `link: yes` needs a `homepageChecked` of `ok`, and a `renamed` service is never `yes`; a `yes` needs a `checked` date under 90 days old (a warning from 30);
- `logoAllowed` is false for a stale, story-excluded or blocked service; `mark.mode: logo` needs `logoAllowed`, `cleared` and an existing `portal/services/<id>.svg|png`; `cleared` needs `logoAllowed`.

Two facts differ from the research seed the file was built from, both corrections: `mark.cleared` (false everywhere; only the owner sets it) was added, and
`logoAllowed` was set to false for Morningstar and Personal Capital (story-excluded services the seed had marked allowed).

## Marks and links (what the registry holds; the pages come with the pair component)

Every service is shown by its name as text. The registry only carries the mark policy: a neutral badge glyph by default, a logo only when the owner clears it
(`mark.cleared`) and supplies the file under `portal/services/`, with the `names-logos-owners` line on the page. A service link is made only for `link: yes`, with
`rel="noopener noreferrer"` and `referrerpolicy="no-referrer"`; an app link is `https://hub.ci.computer/store/<id>`. The page builders do not read the registry yet, and
they do not break on a family that carries `service` fields (they print the chips as written); the pair component (two columns, the app with its logo and
screenshot, "alternative to", the service badge and name) is built in stage 3.

## `claims.json` (story v3)

- **`names-logos-owners`** (new disclosure): "Product names, logos and brands are the property of their owners. Naming them does not imply endorsement." Required on any page that shows a service logo or an app logo; it supersedes `names-owners` once the pages say "alternative to" instead of "replaces". Both stand until then.
- **`logo-trademark`**: the `<img>` pattern still bans a third-party mark in authored text; its `scope` says that in page output an `<img>` under `portal/services/` is allowed only for a service whose registry mark is `logo`, allowed and cleared. The page test applies the exception; the pattern does not.
- **`incumbent-attack`**: the fix text names the sanctioned form, "<App> is an alternative to <Service>", the second chip of a pair.
- **`third-party-apps`**: "The other apps in these stories are made by other people, most of them open-source projects. Companion Intelligence did not make them." The earlier text was false for Obsidian (not open source), n8n (fair-code), and the apps whose licences carry limits (Joplin Server, Invoice Ninja, Akaunting, monetr).

## Fleet constants (`scripts/story/lib/fleet.mts`, `FLEET_V3`)

| Constant | Value | Gate |
|---|---|---|
| `FLEET.appShareMax` | 0.4 | no third-party app in more than 40 percent of the families present (`appCap(n)`: 12 of 30, 14 of 36); never a fixed number |
| `FLEET.smallBusinessShare` | 0.18 | small-business beats at least 18 percent of all beats (unchanged) |
| `FLEET.appsMin` / `FLEET_V3.appsMin` | 70 / 100 | distinct apps; 100 once every family is v3 |
| `FLEET_V3.pairShareMin` | 0.8 | room beats with a service, in each v3 home |
| `FLEET_V3.servicesMin`, `servicesPerHomeMin` | 70, 14 | distinct services in the fleet, and in each v3 home |
| `FLEET_V3.kiwixMax` | 6 | families naming Kiwix (moot while Kiwix is `avoid`) |
| `FLEET_V3.rareHomes`, `rareShare` | 8, 0.4 | information: the share of room beats on an app in at most 8 homes, 40 percent or more wanted in each home |
| `FLEET_V3.v3Required` | false | `fleet-v3`: every family is a v3 family. Set in the last PR |

The v3 counts are reported always and gate only when every family is a v3 family, so a fleet in the middle of the rewrite is held to nothing it is not held to today.

## Validator rules and fixtures

| Rule | Severity (v3 family / other) | Fixture |
|---|---|---|
| `age-chat`, `age-companion`, `app-avoid` | error / warning | `bad-46-age-chat`, `bad-47-age-companion`, guard `ok-9-v3-adults` |
| `service-unknown` | error / error | `bad-48-service-unknown` |
| `service-app` | error / error | `bad-49-service-app` |
| `service-status` | error / error | `bad-50-service-stale` (Pocket), `bad-51-service-blocked` (Tailscale) |
| `service-missing` | error / warning | `bad-52-service-missing`, `bad-53-service-no-replaces` |
| `chips` | error / error | `bad-54-chips-alternative` |
| `chips-legacy` | error / warning | `bad-55-chips-legacy` |
| `persona-band` | error / warning | `bad-56-persona-band` |
| `household-beats` | error / warning | `bad-57-household-beats` |
| `household-kind` | warning / warning | `bad-58-household-kind` |
| `household-doer` | error / warning | `bad-59-household-doer` |
| `pair-share`, `pair-budget` | error / warning | `bad-60-pair-share` |
| `detail-replaces` (changed) | error / error | `bad-61-detail-service` |

`service-unknown`, `service-app` and `service-status` read a beat's `service`, so they can only fire in a v3 family. `ok-9-story-v3.json` is the Brennan family (the flagship
cast of the test world) told in the v3 shape: sixteen pair beats, four pair-less (two Hermes drafts, JupyterLab, HortusFox), every member inside the band, Jean at
fourteen with no chat model; it reports nothing. The story v3 cases start from it (`base: V3_BASE`); `bad-55` and `bad-58` start from the exemplar, because they are
warnings of a family that is not v3.

## Commands

| Command | Does |
|---|---|
| `pnpm run story:validate [<slug>] [-- --fleet --complete]` | Schema, rules, fleet |
| `pnpm run story:cast`, `story:cast-lint` | `casting.json` and the cast plan checks |
| `pnpm run story:services`, `story:services:check` | Recompute the registry's derived columns; verify them and the invariants |
| `node --experimental-strip-types scripts/story/make-bad-fixtures.mts` | Write the fixtures from `bad-cases.mts` |
| `pnpm run test`, `pnpm run test:node` | The validator, the registry check and the page builders |

## Migration

1. The foundation lands with every v3 rule: no family is v3, so every rule is a warning or silent, and the thirty shipped files validate with 0 errors.
2. Each home's writer flips its family to v3 by adding `beat.service` to every pair beat (and the `alternative to` chips); its file is then held to the full rules.
3. `fleet-v3` stays off until the thirtieth home has migrated, then goes on in the last PR with `FLEET_V3.v3Required`.
4. `chips-legacy` stays a warning until then and is removed with `fleet-v3`.

## Not built yet

The pair component and the page changes (stage 3); `app-media.json` v2 tiers and `media-review.json`; the `portal/services/` icon files (owner-supplied); the Kiwix
library rule (Kiwix is `avoid`, so a beat naming it already fails `app-avoid`). The family pages and the ads kit print the chips as written: the pages set the pass 1
`replaces` chip in a quiet style that an `alternative to` chip does not get yet, and the ad end card adds `names-owners` whenever `app.replaces` is set (so it still
does for a pair beat). Both take the pair component in the page stage.
