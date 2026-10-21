# Story v3: decisions of 2026-10-19 (owner answers and my judgment calls)

> **Status: decision record of 2026-10-19.** The owner's answers and the judgment calls that sat on top of the story-v3 contract; `reference/story/story-v3.md` and `persona-bible.md` are the contracts on main, and the age-16 rule and the casting rules below are in them. The `w7/story-v3-contract.md` and `w7/story-v3-plan.md` it cites are not kept. See [`README.md`](README.md).

Authority: these decisions sit on top of `w7/story-v3-contract.md` and `w7/story-v3-plan.md` (written 2026-10-18) and the persona bible (`reference/story/persona-bible.md`, `reference/story/shots-and-scripts-playbook.md`). Where this file and the older v3 documents disagree, this file wins.

## Owner answers (Liam Broza, 2026-10-19)

1. **Rewrite the stories**, using best judgment, to tell more varied and pointed stories about the open software that runs the family's private virtual lives. Every home is rewritten, not patched.
2. **Rework the casting skew** with best judgment (see "Casting rules").
3. **Age 16.** No member under 16 uses a chat model or an agent in their own beat, and no member under 16 gets an agent companion. (The bible's open question was 13; the owner chose 16.)
4. **Unreadable (bot-walled) sources:** best judgment. They stay marked unread; no story line, claim or caption may depend on one; nothing is cited as verified that was not read.

## Scope and staging (my call, forced by the account's weekly allowance)

- Stage 1 (foundation): 8 new archetypes, age-16 rule, Kiwix-removal tooling port, `service` pairs and registry, household/persona-band/pair rules, 30-home recast and app rotation.
- Stage 2 (pilot): the three flagship homes (`seraphine`, `bgfamily`, `familyhouse-nora`) rewritten end to end, reviewed, fleet-checked.
- Stage 3 (after the weekly reset on 2026-10-23): the other 27 homes in batches; then the six apartments once they are folded in (owner has not decided whether they stack on PR #35); then page builders for the pair component.
- Dropped from the older v3 contract: `member.lens` and `lenses.json` (the 14 archetypes replace them), `beat.also` (unused), `app-media.json` v2 tiers (pages stage). Everything else in the contract stands, including `beat.service`, `services.json`, the "alternative to X" chip, household beats, persona bands and pair share.

## Archetypes

Fourteen: organiser, builder, gamer, learner, maker, host (existing) plus tech-family, business-owner, creative, contractor, marketer, lawyer, journalist, educator (kebab-case, in the owner's order). Persona facts come from the bible chapters; the `personas.json` rows are in bible section 5.3.

## Age rule (16)

- `member.companion` (an agent companion) requires age >= 16 (schema/validator today says under 13 is forbidden; raise to 16).
- A beat whose app is a chat-model app (catalog tag `ai: "chat"`: open-webui, ollama, anything-llm, ci-hermes, ci-openclaw, ci-memory and any other app whose catalog entry is a chat or agent app) needs `member` age >= 16. A beat that has `agent` needs the agent's owner age >= 16 and the approving member an adult.
- A child may appear in a parent-led beat: the beat's `member` is the adult, the child is named in the body as the one being helped, and the child is never the actor.
- Non-chat AI-adjacent apps (LibreTranslate, Whisper-WebUI, Kokoro, Stirling-PDF OCR) are allowed for younger members; they are tools, not chat models.
- Severity: error in a v3 family (a family with at least one `beat.service`), warning otherwise (same device as the other v3 rules).

## Casting rules

- Age, role and household shape of a recast member are kept unless the home forces a change. Names are invented, varied in heritage, never tied to the architecture; first name at most twice in the fleet, no repeated surname or companion name (flagship family exempt, as today).
- No archetype with three or more members may be more than 65% one gender-coded name set (the cast has no gender field: judge by the name and pronouns used in the old stories; rename to rebalance). Specific skews to fix: all gamers read male, all tech-family leads read male, all lawyers and marketers read female, 12 of 14 organisers read female. A girl or a boy is never put in a role by reflex (the bible's own warning).
- Archetype totals after recasting follow bible 5.1 for the 30 homes; every family keeps two or more archetypes; business homes keep at least one organiser, builder or business-owner (cast-lint rule).
- App rotation: no third-party app in more than 40% of the families (12 of 30 now, 14 of 36 later); the same card is not reused across homes with the same title or body (fleet-unique); a persona's pool apps rotate per home so the fleet shows many apps, each with a different human reason.
- The six apartments are cast in a separate file and applied only when the apartments are folded in.

## What "varied and pointed" means for the writers (Stage 2)

- Pointed: each beat argues one specific thing, named in the first sentence: what the rented service held, learned, charged or changed, and what the family's own copy does instead. No generic "your data stays home". The `detail.before` and `detail.after` fields carry that contrast, and `detail.fact` carries one checkable fact from the app's own docs or listing.
- Varied: across a family, at most one beat per app; across the fleet, no repeated title or body; the moments differ in kind (a Monday admin hour, a mistake caught, a hand-off to a neighbour, a dated file found years later, a person leaving a service, a child learning something, a hobby, an evening-less daylight scene). Mix household beats and personal beats per the contract bands.
- Honest: claims.json is law; unverified or bot-walled sources never support a line; apps with no vetted QA screenshot stay behind `reviewed.json`; nothing is promised that the Hub listing does not do (AudioMass saves where the person chooses, Steam needs a Valve account, a speed is never stated, a class list or grade never lives on a home Core).
- Voice: the bible's 12 writer rules and 12 cinematographer rules; sentence case; no em or en dashes, no exclamation marks; "Companion Core / Hub / Memory / OS", "agent" not assistant; beta line where software is claimed; no prices; daylight only.
