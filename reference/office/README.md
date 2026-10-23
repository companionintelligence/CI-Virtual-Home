# /office: the parked design

> **Status: M0 is being built on a branch, off by default and nothing public; the design below is stale versus main.** The one file here that is a contract for the tree is [`office-contract-m0.md`](office-contract-m0.md) (2026-10-23: the four gating decisions answered, what changed on main, what M0 is and how it stays off the public site). The other files are the design record of 2026-10-19 and 2026-10-20. Main still has no `/office` page, no company stories and no office building. Counsel has cleared none of the company names, licence readings or naming of rented services.

## What it was

A second page of the portal, `homes.ci.computer/office`: eight fictional companies in eight 3D offices (three startups, three small businesses, two medium ones told as one site or one department), each told as a tour by role, with a page per company at `/company/<slug>`. The argument is the homes' argument at work: one Companion Core in the back room, each job done by a Companion Hub store app that is an alternative to a rented service, and what comes along when you bring your data home (and what does not). The label on every surface was to be "Fictional company. Real software."

The design was written on 2026-10-19 by a team of agents against PR #35's head (`a431fe6`), attacked by a skeptic pass the same day, and summarised in a brief on 2026-10-20. The build was paused on purpose (the account's weekly usage limit); later build attempts may exist on branches named `feat/office-*` in the owner's clone, and this folder does not describe them.

## The files, in reading order

| File | What it is |
|---|---|
| [`office-contract-m0.md`](office-contract-m0.md) | **The contract for the tree, refreshed 2026-10-23.** Decisions O1 to O15 with their date and source, what changed on main since the design, the M0 scope, the "nothing public" mechanics, the invariants, the open items. Read it first; it wins over everything below where it speaks. |
| [`OFFICE-BRIEF.md`](OFFICE-BRIEF.md) | One page: what it is, the eight companies, what the skeptic pass fixed, the owner decisions, the milestones, the next step. Start here. |
| [`office-plan.md`](office-plan.md) | The plan: the skeptic pass up top, the product on one page, the eight offices (cast, stack by function, bring-your-data-home beats, beat outline, honest edge, counts), the fleet checks, work packages WP0 to WP7, risks and the owner decisions O1 to O15, the schedule, and Appendix C (the skeptic change log). |
| [`office-build-contract.md`](office-build-contract.md) | The exact delta the work packages were to build from: invariants I1 to I9, the `company/v1` schema, roles and rooms, the buildings, claims, the validator, the cast, the pipeline, the site, tour/film/ads, tests, owned files per package. **Section 16 (the skeptic amendments) wins** over anything older in this folder. |
| [`skeptic.md`](skeptic.md) | The attack on the plan: every Hub app against the live store and its package and licence, every sentence against the claims canon, the engine plan, the site plan, feasibility, and what could not be verified from where it was written. |

Where two of these disagree, the order of precedence is the one the contract states in section 16.1: the skeptic amendments, then the briefs as amended, then everything older.

## The four decisions that gate a first public showing

Answered by the user in chat on 2026-10-23 with the defaults below ([`office-contract-m0.md`](office-contract-m0.md) section 1 records them). Counsel has still cleared none of them.

| # | Decision | Default if nobody answers |
|---|---|---|
| O2 | Per-person Companion accounts: the docs' Organizations page says each person signs in with their own CI Account; the fact sheet and the claims canon say multi-user is not on the box. | The canon wins. Offices say only "each app keeps its own sign-ins". |
| O4 | The label "Fictional company. Real software." and fictional staff with job titles (ADS.md 9.1 read as about Companion's own team). | Approve the label and the long line "The people in it are characters, not customers." |
| O6 | The eight company names. | Use them as proposals; counsel clears each. |
| O7 | Naming real services beyond the chips. | Only the services the store's own `replaces` rows name, in chips and "Rented before" panels; no text-only mention of services the store does not pair. |

The other decisions (O1, O3, O5, O8 to O15) have defaults in `office-plan.md` section 5.1.

## What was left out, and why

The design lived in a scratch folder with much more than these four documents. Not kept here (all of it stays in the author's scratch archive):

- the eight **company briefs** and their index (`company-briefs/<slug>.json`, about 45 KB each; the writers' input, data not prose);
- the **proposed data files** (`company.schema.proposed.json`, `functions.proposed.json`, `roles-office.proposed.json`, `claims-office.proposed.json`, `office-cast-plan.proposed.json`), which the contract says are stale where the briefs and section 16 differ;
- the **specialist reports** the contract reconciles (`office-bible.md`, `engine.md`, `site.md`, `office-contract.md`, `claims.md`) and the market and persona research behind them;
- the **spikes** (an engine prototype patch, the loft and shop-front building specs and their generators) and their logs and renders;
- a **snapshot of the Hub store** (4 MB of JSON), upstream licence files, and the generators and checkers (`gen/`, `skeptic/`), which the plan itself says are stale and must not be re-run;
- a file of account or personal data, which does not belong in a repository and was not copied.

So the documents refer to files that are not in the tree: `company-briefs/`, `$W20`, `gen/`, `skeptic/`, the `*.proposed.json` files, `reference/story/office-briefs/` and `reference/OFFICES.md` (the last two were to be written by work packages WP1.1 and WP3.0; neither is on main). If the work restarts, the first job is to rebuild those from the plan, not to look for them here.

Directories in angle brackets (`<scratch>`, `<repo>`, `<office-worktree>`) replace the author's local paths.
