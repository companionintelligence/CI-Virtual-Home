# /office: design brief (2026-10-20)

> **Status: design only, stale versus main, not shipped.** Written 2026-10-19 and 2026-10-20 against PR #35's head (`a431fe6`), before the apartments, pass 2 and the lander reached main.
> Main has no `/office` page, no `company/v1` schema, no `use: "office"` spec field and none of the files this document calls new. Owner decisions **O2** (per-person accounts), **O4** (the label and fictional staff), **O6** (company names) and **O7** (naming services) gate any public showing, and counsel has cleared none of the company names or licence readings.
> Read it as the record of a design and its skeptic review, not as a contract for the tree. Directories in angle brackets (`<scratch>`, `<repo>`, `<office-worktree>`) stand for the author's local ones. See [`README.md`](README.md) in this folder for what was left out.

Status: design finished and skeptic-reviewed. Build paused on purpose (account weekly usage is at 94%, resets 2026-10-23 17:00Z). Nothing is committed on `feat/office-page` and nothing is pushed.

Build tree: `<office-worktree>`, branch `feat/office-page`, stacked on PR #35's head (a431fe6).
Full design files: `<scratch>/w20/` (`office-plan.md`, `office-build-contract.md`, `skeptic.md`, `company-briefs/`).

## What it is

A second page of the portal, `homes.ci.computer/office`: eight fictional companies in eight 3D offices (3 startups, 3 small businesses, 2 medium), told as tours by role. Company pages live at `/company/<slug>`. The argument is the homes' argument at work: one Companion Core in the back room, each job done by a Companion Hub store app that replaces a rented service, and what comes along when you bring your data home (and what does not).

Label on every surface: "Fictional company. Real software."

## The eight companies (all names invented, not cleared by counsel)

| Company | Size | Building | Core owner |
|---|---|---|---|
| Reelwick | startup, 6 | brick loft (96 m2) | engineering |
| Pannierwell | startup, 5 | garage lab (90 m2) | owner |
| Curatory | startup, 11 | business-park unit (260 m2) | support |
| Gutterfold | small, 14 | printworks with mezzanine (290 m2) | operations |
| Lintel & Sill | small, 11 | Georgian townhouse (215 m2) | finance |
| Posy & Pail | small, 10 | florist shop with back office (125 m2) | marketing |
| Hartnoll Joinery | medium, one site of about 90 | joinery yard (310 m2) | IT |
| Loamfield | medium, one department of about 100 | timber courtyard building (380 m2) | engineering |

46 distinct Hub apps, none in more than 3 of 8 companies, every one in the store today with a QA screenshot. 54 bring-your-data-home beats, each with a "does not come along" line.

## What the skeptic pass fixed

False or unsupported product claims in the briefs: Excalidraw "saved on the Core" (no storage volume), Pi-hole as the office name server (publishes DNS on 8053 only), Hermes "reading" commits, an accountant reaching the Core, an uptime monitor checking the machine it runs on, Akaunting's two-user free-use cap missing, two taglines putting a head count beside "one Core". Effort corrected from 420 to about 575 agent-hours with rework.

## Owner decisions (defaults apply if you say nothing)

Four gate the first public showing:

1. **O2 Per-person accounts.** CI-Docs says each person in an organization signs in with their own CI Account; the fact sheet and claims canon say multi-user is not on the box. Default: the canon wins. Offices say only "each app keeps its own sign-ins".
2. **O4 Label and fictional staff.** Approve "Fictional company. Real software." and fictional people with job titles (ADS 9.1 read as about Companion's own team).
3. **O6 Company names.** Use the eight as proposals; counsel clears each.
4. **O7 Naming services.** Only the services the store's own `replaces` rows name, in chips and "Rented before" panels. No text-only mention of HubSpot, Gusto, Teams and the like.

Others with defaults: medium business told only as a site or department with a floor of at most 25 (O3); everything stays on the office network, no remote or hybrid scenes (O5); same sitemap and nav as homes (O9); backups not printed (O11); build on PR #35's head without waiting for apartments or pass 2 (O12); keep the store's Evernote/Google Drive pairs on Paperless-ngx and Papra (O13); keep Akaunting with its cap (O14); stories avoid five package gaps until the Hub team confirms them (O15).

Questions for you or the Hub team: do you have a capacity statement for one Core and a 22-person floor (none exists, so nothing may be printed); does Hub's per-app backup deserve one sentence in the fact sheet.

## Milestones

| | What you can look at | Agent-hours (cumulative, before rework) |
|---|---|---|
| M0 | `/office` with two cards on fixtures, header switcher, filters | about 40 |
| M1 | loft and townhouse built for real, two stories, two tours, company pages | about 200 |
| M2 | six offices | about 350 |
| M3 | all eight, fleet gate green, 24 role cuts planned | about 420 |

Owner-gated, not agent-gated: macOS goldens for each milestone's buildings, counsel on names and licences, the Kokoro install (voiced tours and films wait for it; silent ad cuts do not), any preview deploy or PR.

## Next step

Resume the foundation build (contract commit, `/office` page on fixtures, engine field and index, validator, roles and bake, company page, player and film changes, composer programs and P0 props, then an independent verify and an engine-inertness review). It starts when you say go, or after the weekly reset.
