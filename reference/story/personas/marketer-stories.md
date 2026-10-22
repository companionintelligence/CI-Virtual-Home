# Marketer (`marketer`): ten more user stories

Draft written 2026-10-20 for the owner. It widens the stories of an archetype that already exists (`marketer`, bible chapter 3.11, `personas.json`, `persona-apps.md`); it changes no source file. Nobody here is a customer: ages, jobs, rooms and lines are design choices for fictional characters. The wording law is `content/story/claims.json`; the catalog (`catalog-apps.json`) and the service registry (`services.json`) decide what may be named.

**One line.** A freelance or in-house digital marketer: the client's list, files and briefs sit at home. This file adds the marketer's other hours: the wall of cards on Monday, the pitch the evening before, the quarterly review of what is rented, a project write-up read by a partner, the first coffee with the feeds, a launch tag tested at home, a client leaving, an event kit in a cupboard, a guest list for a breakfast and a day plan in a bedroom corner.

---

## 1. What the chapter and the stories already show

**The chapter (3.11).** The seven Hub replacements it ranks: Open WebUI (the brief read back by the model on the Core), Companion Memory, Nextcloud (the client's files), Ghost (the client's list, with the outside mailer caveat), Penpot, Mixpost (a limit card) and Twenty. Its shots are a wall of paper cards used as a content calendar and a hand with a red pen on a printed proof. Its triggers are a vendor shift, a client clause on AI and offboarding a client. Its limits: the platforms, sending reputation, SEO suites, the Canva library, live co-editing with a client and HubSpot automation stay out there.

**The pool** (`personas.json`, 16 apps) and `persona-apps.md` add Listmonk, Plausible Analytics, n8n, Inkscape, FreeCut, Solidtime, Grist, VaultWarden and Whisper-WebUI. Beats that name each pool app in the 30 family files today (a count of beats, not of homes): Nextcloud 13, VaultWarden 12, Open WebUI 8, Twenty 7, n8n 5, Companion Memory 3, Penpot 2, Inkscape 2, Listmonk 1, Grist 1, and none for Ghost, Whisper-WebUI, Plausible, FreeCut, Mixpost and Solidtime.

**The cast.** No member of the 30 family files carries `marketer` (`cast-plan.json` and `casting.json` have none); the nearest are organisers with a small practice of one, who use Twenty, n8n and Listmonk. The six apartments are cast later. Every story below is a candidate for the next recast.

**What this file avoids on purpose.** The chapter's pairs (Open WebUI with ChatGPT, Nextcloud with Google Drive, Ghost with Mailchimp, Penpot with Figma, Mixpost with Buffer, Twenty with Salesforce) are not repeated, and neither is the AI headline: no story here uses a chat model or an agent. Only one pool app appears below (VaultWarden), with a service the chapter does not name.

## 2. How the ten were chosen

- Each differs in kind: a different room or place (the kitchen wall, the bedroom corner, the living-room cupboard), a different moment of the week or the year (Monday morning, a quarterly review, the week before a launch), a different person who acts or is helped (a partner, a sibling, a client who is leaving), a different app and service.
- Each is one catalog app (`app.id`, `storySafe` yes or with-caveat, never `avoid`) with one registry service (no flag `stale` or `story-excluded`, `alternativeToForm` not `blocked`). Eight of the ten services have no family using them today (`fleetHomes` is empty); Rocket Money (five families) and Todoist (three) do.
- The chip pair for every story is the app's display name, then `alternative to <Service>`. The first sentence names what a rented tool held or changed and what the Core does instead; it never says what a company does to anyone.
- The marketer's rules hold: nothing is a result, a reach, a time saved or a money saved; no better-copy claim; no promise that mail lands or a post publishes; the client's list and files are the client's; no compliance wording (the Plausible and Umami manifests say compliant; the story never repeats it).
- Remote access is not claimed: a public site, a booking page or a social callback needs outside reach, and three stories (1, 6 and 9) are written as limit cards that say so.

## 3. Ten user stories

Each is tied to one catalog app (`app.id`) and one registry service (`service`), with the caveat that must ride along, a one-line story moment (room, anchor role, what happens first) and the first sentence a visitor reads (25 words or fewer, sentence case, no dash, no exclamation, no figure, no company named in it).

**1. Postiz, alternative to Hootsuite.** As a marketer, I want the week's posts as drafts on one calendar so that the client approves them before anything is published.
- App `postiz`, service `hootsuite`. Caveat: Postiz publishes to outside social platforms by design, so say scheduling happens here and never that posting is private; connecting a platform account is an outside step; no reach, no best-time or "posts for you" wording. A limit card, not a hero. Overlaps Mixpost, so name one scheduler.
- Moment: `kitchen`, anchor `kitchen-island` (fallback `counter`). Monday at eight, the wall of paper cards by the fridge. First: the first card becomes a draft with a date.
- Who: the marketer (mid thirties) and a sibling who holds the tape for the cards.
- First sentence: "The posting calendar lived in a rented scheduler; Postiz keeps the drafts and the week's plan on the Core, from the wall of cards."
- Different in kind: the bible's wall-of-cards shot made into a story, a scheduler shown as a limit, a sibling in the room.

**2. ArchiveBox, alternative to Instapaper.** As a marketer, I want a whole-page copy of the campaign the client took down so that the portfolio can still show what I made.
- App `archivebox`, service `instapaper`. Caveat: ArchiveBox fetches a page from the internet when it saves it (an internet step), then keeps its own searchable copy; save only pages the marketer made or may keep; no rights, legal or "proof" wording; not a backup.
- Moment: `office`, anchor `bookshelf` (fallback `desk`, `couch`). The afternoon before a pitch, the portfolio binder open. First: the dead link is pasted and the saved copy opens.
- Who: the marketer.
- First sentence: "Saved pages sat in a rented read-later app; ArchiveBox keeps whole pages on the Core, like the campaign page the client took down."
- Different in kind: the evening before a pitch, the work the client has since removed, a portfolio rather than a brief.

**3. Wallos, alternative to Rocket Money.** As a marketer, I want every tool I rent for the studio on one list with its renewal date so that I choose on purpose which to keep.
- App `wallos`, service `rocket-money`. Caveat: Wallos tracks the subscriptions only; it does not cancel anything and no saving is promised; it fetches logos from outside, so leave logos off the screen (no third-party logos on the site); no figure and no price in the story.
- Moment: `dining`, anchor `dining-table` (fallback `couch`). The first week of the quarter, a printed list of logins beside the laptop. First: the first tool is added with its renewal date.
- Who: the marketer; the partner reads the list over their shoulder and asks about one name.
- First sentence: "The list of rented tools lived in a rented tracker; Wallos keeps the list on the Core, renewal dates included."
- Different in kind: a quarterly review rather than a campaign, a partner asking a question; this pair is the only one with a service in five families, kept because the moment is new.

**4. Collabora Online, alternative to Google Workspace.** As a marketer, I want a second pair of eyes in the project write-up with me so that we edit the same page at the same time.
- App `collabora-online`, service `google-workspace`. Caveat: co-editing stays between the two people on the home Wi-Fi; it is not live co-editing with a client outside the house, and the client's own Google documents are not moved; no outside accounts, no multi-user promise.
- Moment: `living`, anchor `couch` (fallback `room`). Thursday evening, two laptops on the cushions. First: the project write-up opens on both screens and the partner's cursor appears on the second paragraph.
- Who: the partner, who is the second reader, edits alongside the marketer.
- First sentence: "The project write-up was co-edited in a rented suite; Collabora Online does it on the Core, with the second reader on the couch."
- Different in kind: a living room, a partner as the actor, a limit that is honest (co-editing with a client stays out there).

**5. Miniflux, alternative to Feedly.** As a marketer, I want the trade feeds in one quiet reader so that I read the industry before the first call.
- App `miniflux`, service `feedly`. Caveat: fetching feeds uses the internet; it does not find stories for the marketer (never write "finds the story"); no QA screenshot, so it needs a `reviewed.json` line; overlaps FreshRSS, so name one feed reader.
- Moment: `kitchen`, anchor `counter` (fallback `kitchen-island`). Seven in the morning, the first coffee on the counter. First: the first unread item of the trade feed opens.
- Who: the marketer.
- First sentence: "The industry feeds were read in a rented reader; Miniflux gathers the same feeds on the Core, read over the first coffee."
- Different in kind: the first hour of the working day, a reading habit rather than a work file.

**6. Umami, alternative to Google Analytics.** As a marketer, I want to see the tag on the launch page count a test visit so that I know it fires before the client goes live.
- App `umami`, service `google-analytics`. Caveat: counting real visitors needs the Core reachable from outside, which is not claimed; the story counts a test visit from a laptop on the home Wi-Fi only; the live site's numbers stay wherever the client runs them; no compliance wording, no figure, no result. A limit card.
- Moment: `office`, anchor `desk` (fallback `couch`). The week before a launch, a copy of the page open in the browser. First: one test visit appears in the Umami view.
- Who: the marketer.
- First sentence: "The tag on the launch page was tested against a rented analytics tool; Umami counts the test visit on the Core, on the home network."
- Different in kind: pre-launch rather than results; a limit named in the sentence itself.

**7. VaultWarden, alternative to 1Password.** As a marketer, I want a leaving client's logins cleared from my vault so that nothing of theirs stays on my side after the contract ends.
- App `vaultwarden`, service `1password`. Caveat: an unofficial server that works with the Bitwarden apps (say exactly that); no security superlative; no phone use away from home; clearing entries is the marketer's act, never "guaranteed gone".
- Moment: `office`, anchor `desk` (fallback `bookshelf`). A Friday at the end of a contract, the handover note beside the keyboard. First: the client's folder in the vault is opened and the first entry is exported for the client.
- Who: the marketer.
- First sentence: "The client's logins sat in a rented vault after the contract ended; VaultWarden holds them on the Core, cleared at offboarding."
- Different in kind: the bible's offboarding trigger as a story, a pool app with a service the chapter does not name.

**8. HomeBox, alternative to Sortly.** As a marketer, I want the contents of the event kit written down so that I pack the right boxes for the conference.
- App `homebox`, service `sortly`. Caveat: no QA screenshot, so it needs a `reviewed.json` line; items, locations and photos only, with no warranty claim; barcode and Open Food Facts lookups call outside services, so leave them off.
- Moment: `living`, anchor `room` (fallback `bookshelf`, `couch`). The Monday of conference week, the cupboard doors open. First: the pop-up banner box gets a card with its shelf and a photo.
- Who: the marketer; the cousin who helps carry packs the boxes.
- First sentence: "The event kit's contents lived in a rented stock list; HomeBox keeps each box, its shelf and a photo on the Core."
- Different in kind: a physical kit, props the bible names (cards, swatch fans) as inventory, a cousin lifting boxes.

**9. Hi.Events, alternative to Eventbrite.** As a marketer, I want the RSVP list for the client's launch breakfast in one place so that the room is set for the right number of seats.
- App `hi-events`, service `eventbrite`. Caveat: a free event and an RSVP list only; public ticket pages need outside access, which is not claimed, and payments are left off; invitations go out the way the client already sends them; no check-in code or phone feature is shown.
- Moment: `dining`, anchor `dining-table` (fallback `desk`). The Wednesday before the breakfast, the printed replies in a pile. First: the first reply becomes a guest with a seat. A limit card.
- Who: the marketer and the client's coordinator on the phone.
- First sentence: "The RSVP list for the launch breakfast sat in a rented ticketing tool; Hi.Events keeps the list on the Core, typed in from the replies."
- Different in kind: a small live event, a list that is the whole story, a limit named plainly.

**10. Super Productivity, alternative to Todoist.** As an in-house marketer, I want one task for each client on the day's plan so that I work through them in order.
- App `super-productivity`, service `todoist`. Caveat: a day planner with a timer; no productivity, time-saved or "hours back" claim and no figure; nothing is claimed about results.
- Moment: `bedroom`, anchor `desk` (fallback `room`). Monday morning in a flat where the desk is in the bedroom corner; bedroom counts as a primary room only when the home has no office. First: three client names become three tasks.
- Who: the in-house marketer (late twenties).
- First sentence: "The day plan lived in a rented to-do app; Super Productivity keeps it on the Core, one task for each client."
- Different in kind: a small flat, an in-house marketer rather than a freelance one, a plan rather than a deliverable.

## 4. At a glance

| # | App | Alternative to | Room, anchor | Moment | Actor | Beats naming the app today | Family fleet for the service |
|---|---|---|---|---|---|---|---|
| 1 | `postiz` | Hootsuite | kitchen, kitchen-island | Monday 8 | marketer, sibling | 0 | 0 |
| 2 | `archivebox` | Instapaper | office, bookshelf | afternoon before a pitch | marketer | 0 | 0 |
| 3 | `wallos` | Rocket Money | dining, dining-table | first week of the quarter | marketer, partner | 5 | 5 |
| 4 | `collabora-online` | Google Workspace | living, couch | Thursday evening | partner | 0 | 0 |
| 5 | `miniflux` | Feedly | kitchen, counter | 7 a.m. | marketer | 0 | 0 |
| 6 | `umami` | Google Analytics | office, desk | week before a launch | marketer | 0 | 0 |
| 7 | `vaultwarden` | 1Password | office, desk | end of a contract | marketer | 12 | 0 |
| 8 | `homebox` | Sortly | living, room | Monday of conference week | marketer, cousin | 0 | 0 |
| 9 | `hi-events` | Eventbrite | dining, dining-table | Wednesday before a breakfast | marketer | 0 | 0 |
| 10 | `super-productivity` | Todoist | bedroom, desk | Monday morning | in-house marketer | 0 | 3 |

## 5. For the owner

- **No recorded QA screenshot** for `miniflux` and `homebox`: each needs a `reviewed.json` line (the `app-qa-screenshot` rule) before a beat shows it. The other eight each have one.
- **The pool gate.** `persona-cover` asks every `marketer` member for one beat in a pool app. Only story 7 (VaultWarden) is in the pool; the rest need a pool beat beside them (Open WebUI, Ghost, Penpot and the like). Widening the pool in `personas.json` is the owner's call; this file does not make it.
- **One per household** where the catalog says they overlap: Postiz with Mixpost (story 1), Miniflux with FreshRSS (5).
- **Three limit cards** (1, 6, 9): each app needs outside reach for its real job. They are written so that the Core's part is true on its own (the drafts, the test visit, the list) and the limit is said in the sentence or the caveat.
- **Two services already used by families:** Rocket Money (five) and Todoist (three). Both stories keep a new moment; if the owner wants services nobody uses, swap story 3 for Metabase with Tableau (the listing says only "ask questions of your business data", so how a file gets in would need an owner entry) and story 10 for Planka with Trello.
- **Rooms.** The marketer's primary rooms are office, living, dining and kitchen; the bedroom in story 10 counts only when the home has no office.
- **Left out on purpose:** Linkwarden (Raindrop.io is already in a family story), Listmonk and Ghost (the chapter's pair), Activepieces with Zapier (already used), SearXNG (it asks other search engines, so it is not local), ComfyUI (generative pictures), Cal.diy and Rallly (booking pages need outside reach), a social callback for Mixpost (needs a public address).

## 6. What was checked

- Every app id is in `catalog-apps.json`, in the live store, `storySafe` yes or with-caveat, none `avoid`, none `ai: chat`.
- Every service id is in `services.json` with `storyStatus` ok, no `stale` or `story-excluded` flag and `alternativeToForm` ok, and the app is listed under that service's `apps`.
- Counts of beats and the fleet are from `content/families/*.json` and `services.json` on 2026-10-20 and exclude `.bake.json`, `.voice.json` and `films.json`.
- The ten first sentences are 25 words or fewer, with no digit, no dash, no exclamation, no company name and no "replaces". No story names a price, a speed, a compliance word or a remote-access promise.
