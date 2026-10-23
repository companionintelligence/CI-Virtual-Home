# Community lead (`community-lead`)

Deep dive for one proposed archetype. Draft for the repo, written 2026-10-20. Category: Host and care (`care`). Nearest existing archetype: `host`.

Nobody here is a customer. Ages, groups, homes and lines are design choices for fictional characters. Statements about how people live are editorial synthesis, tagged [?] when a reader could take them for a fact; nothing below is a statistic. Read this with [personas.md](../personas.md), [persona-apps.md](../persona-apps.md) and [persona-bible.md](../persona-bible.md), which win wherever they disagree.

## 1. Who

The community lead is the person a group of about twenty people turn to when something needs doing and nobody is paid to do it. It is a choir's secretary, a junior football club's coach and registrar, the chair of a tenants' group, the treasurer of an allotment society, the booking clerk of a village hall, the organiser of a repair café or a film society. The morning looks ordinary. A kettle, a folder, a laptop pushed to the end of the kitchen table, and the light coming in from the garden side while the lead copies last night's apologies into the roll. The work is small and constant: who is in, who is owed, which Tuesday is the hall free, what was agreed and who said they would do it. Some leads do this in the gaps of a paid job, some after a paid career, some alongside a degree or looking after a relative. Many of them took the role because the last person left, not because they wanted it. [?]

The group meets in person, in a hall, a pub back room, a pitch, a stairwell or the lead's own dining room, and the lead's home is where the paperwork lives between meetings. Some work from a small shared office the group rents, with one desk, a kettle and a filing cabinet. The lead is usually between eighteen and eighty, lives alone, with a partner, with a teenager who plays or studies down the hall, or in a shared house, and holds the role for a year or for twenty. The members are not Core users. They hear about the work on a printed rota, a group chat or at the end of a rehearsal; they never sign in to anything the lead runs. [?]

## 2. What they are responsible for

- The roll: who belongs, how to reach them, who has paid their subs, who has gone quiet. A roll that includes children is a list of names and a contact number kept in a file, and nothing more is claimed about it.
- The calendar: rehearsals, fixtures, the hall booking, the meeting dates and the one clash everybody forgets.
- The minutes and the handbook: what was decided, the constitution or house rules, the list of who holds the keys.
- The small money: subs, a float, receipts in an envelope, the treasurer's report for the yearly meeting. Any sum is small and the group's own.
- The job list: after a meeting, who does what by when; before an event, the chores that make it happen.
- The paper trail: hall hire agreements, insurance letters, warranties for the urn and the speakers.
- The handover: when the lead steps down, the next one needs the whole folder, not a forwarded email.

## 3. What they rent today

Registry ids are in `content/story/services.json`. All twelve below exist with no `stale` or `story-excluded` flag and `alternativeToForm` ok.

| Registry id | Service | What it holds for this person today |
|---|---|---|
| `airtable` | Airtable | The roll and the fixture list, built once by whoever liked spreadsheets. |
| `notion` | Notion | Handover notes, a to-do page and the group's "how we do things" page. |
| `confluence` | Confluence | A committee wiki that one member set up at work and carried home. |
| `google-calendar` | Google Calendar | The rota and the hall booking, shared by link. |
| `icloud-calendar` | iCloud Calendar | The rehearsal dates on the phone of whoever is on Apple. |
| `quickbooks` | QuickBooks | The treasurer's books, when the treasurer already knew it from a job. |
| `xero` | Xero | The same, in the other common choice. |
| `todoist` | Todoist | The lead's own list of what they promised on the way out of the hall. |
| `asana` | Asana | A shared job board, usually left over from someone's workplace. |
| `trello` | Trello | The board for the summer fair or the end-of-season show. |
| `google-drive` | Google Drive | The constitution, the forms, the photos and the minutes, in one folder owned by one person. |
| `evernote` | Evernote | Scans of receipts and letters kept "somewhere I can find them". |

The group chat on a messenger is also where the group lives, and it stays there. A message sent through a messenger passes through that service (`cap-messaging-private`), and no beat claims otherwise. No price, plan name or storage limit is mentioned for any service.

## 4. What the Hub offers them

All eight are in `content/story/catalog-apps.json`, `storySafe: yes`, in the live store. Names are exact: BookStack, Grist, Radicale, Akaunting, Vikunja, Planka, Nextcloud, Papra.

| Catalog id | What it does for this person | The honest caveat |
|---|---|---|
| `grist` | A spreadsheet-database for the roll, the fixtures and the key list, stored as one SQLite file the lead can copy. Alternative to Airtable. | No catalog caveat. The file is on the Core, which is not a backup. |
| `bookstack` | The handbook, the minutes and the handover notes in books, chapters and pages with search and history. Alternative to Confluence or Notion. | No catalog caveat. Members read it printed or on the lead's screen; they do not get an account (`cap-multi-user`). |
| `radicale` | The rota, the meeting dates and the hall booking as calendars that open in the lead's devices. Alternative to Google Calendar or iCloud Calendar. | No QA screenshot on `origin/main`: listed and installable, no verified run. Do not say the old calendar's shared links carry over; reaching it from a phone is a home-network scene, never "from anywhere" (`cap-remote-access`). |
| `akaunting` | Invoices, expenses, customers and profit and loss for a small business, used here for the group's subs, float and receipts. Alternative to QuickBooks or Xero. | Bookkeeping tool. No accounting, tax or legal advice. Not payments: do not claim card taking or a bank link. |
| `vikunja` | Lists, boards and calendars for tasks, with reminders and repeating jobs; the action points from a meeting. Alternative to Todoist or Asana. | Supports CalDAV sync. One household's Core, not an account for each committee member. |
| `planka` | A Kanban board for an event or a project, read at the table on one screen. Alternative to Trello. | No catalog caveat. Say "the board the committee reads together", not "everyone edits it". |
| `nextcloud` | The group's folder: constitution, forms, photos and the archive of minutes, on the Core. Alternative to Google Drive. | Web interface only for agent purposes. No away-from-home sync scenes. At the fleet cap (below): use sparingly. |
| `papra` | An archive for the receipts, warranties and contracts the lead rarely looks at until the day they must. Alternative to Evernote or Google Drive. | No catalog caveat. An archive, not a records system; no claim about what the group is required to keep. |

Considered and dropped, per the judge and the catalog caveats. OpnForm (a public form needs outside access to the Core), Hi.Events (public ticket pages need outside access), Rallly (guests vote through a link, which is remote access; `storySafe: with-caveat`) and Listmonk (sending needs an outside mailer; do not promise delivery). Docuseal and Invoice Ninja are also left out of this chapter: signers outside the home need access to the Core, and card payments need a provider. Kiwix is `avoid`. If a family file wants a signed form or a mailing, that is a limit to name, not a feature to show.

Headroom. Per the bible's 2026-10-19 count Nextcloud sits at 12, the fleet cap of 40 percent of 30 homes. Lead with Grist, Radicale, Planka, Vikunja, BookStack, Akaunting and Papra, and re-run the fleet count before a casting.

## 5. Where they spend time

Editorial synthesis, not researched sources [?]. No quotes and no figures.

- In person: the venue after the meeting (the hall kitchen, the pub back room, the touchline), the library and the community noticeboard, the shop where the poster goes up, the front-door table where the folder lives.
- Online, by kind: the group's own messenger chat; a local-area forum or neighbourhood page; the regional or national body the group belongs to, where leads trade handbooks; a volunteer-support or small-group-leaders community; community radio and the local paper's what's-on column.
- Media: the umbrella body's newsletter, a how-to from another club's website, a local radio slot, a council meeting agenda read to see what lands on the group.
- Not here: workplace productivity talk, startup media, "future of work" feeds. The lead's reference points are other leads.

## 6. How they talk

- Tone: practical, dry, a little formal when minuting and warm when it is not recorded. They thank people by name. They say "we", about the group.
- Pace: 140 to 155 words a minute; sentences of 8 to 14 words, in list rhythm: "Roll, rota, subs." [?]
- Vocabulary: agenda, minutes, rota, subs, float, apologies, any other business, the hall, the keys, stacking chairs, term, season, fixtures, the treasurer's report, the yearly meeting. Say "members", never "users", "customers" or "stakeholders".
- Turn-offs: volunteer-saint language (heart of the community, unsung hero, giving back); corporate words (workflow, stakeholders, productivity, onboarding); fear framing about members' data; any suggestion that the lead should be the IT department; being treated as a small business.
- Never: a martyr who is always last to leave, a gendered role (the cheerful older woman with the tea urn), a lead who needs rescuing by a younger relative.

## 7. Comfort with technology and attitude to AI

Comfort ranges from 1 (wants it set up and a printed sheet to keep) to 4 (keeps a spreadsheet with formulas and hates when the hall site changes). Most are 2 or 3: confident with a phone and a spreadsheet, wary of anything that needs an account for every member. Comfort does not follow age: a twenty-three-year-old treasurer may be a 1, a seventy-eight-year-old chair a 4.

AI stance is a real range; all three can be written without condescension.

- Wary and proud of it: the roll is people, and a name list is not something to feed to a model. Their beat has no AI.
- Curious, with a limit: one chore, on the Core's local model, on the lead's own agenda or notice, read and corrected by the lead before it goes anywhere.
- Interested for the paper: tidying a long minute into action points, which the lead checks against the room.

Rules. AI is never the hook or the first beat. A model beat needs a lead aged 16 or older (age rule 16) and in this archetype the lead is an adult. A model never reads a list of children, never decides who is in or out, never contacts a member, never spends money or posts to a group chat; the lead approves every send (`cap-autonomy`). Say "a model on the Core"; never a hosted-model name, key or parity (`cap-parity`, `cap-cloud-model`). At most one model beat per family; a family with a wary lead has none.

## 8. Objections and the honest limits

Objections to expect: "My group is on a messenger and will not move." "I am not going to be the IT department." "Members need to see the rota." "Who has the password when I step down?"

What the Core and the apps cannot do for them.

- The members cannot sign in. A Core is one household's machine (`cap-multi-user`): no account for each member, no per-person folders, no committee sign-in. The rota reaches members printed, pasted into the group chat by the lead, or read aloud.
- Nothing is shared by a link. No public sign-up form, no online RSVP, no ticket page, no voting page: all need outside access (`cap-remote-access`).
- No mailing list is sent from the Core without an outside mailer; the group's newsletter stays an email the lead sends by hand.
- The roll and the books are not backed up by the Core. The Core is not a backup.
- No payments: subs are collected the way the group collects them today (cash, a bank transfer, a tin). Akaunting records; it does not take a card or give advice on money.
- No compliance, charity, safeguarding, data-protection or insurance statement. The apps keep files where the lead put them.
- The handover is a human job: the next lead needs someone to show them where the Core is and how to sign in. Say it as a limit the family handles (a printed card in the folder), not a feature.
- installing apps uses the internet; remote access is not claimed.

## 9. Claims boundary

Never say or imply, for this persona. Ids are from `content/story/claims.json`.

| Never | Because |
|---|---|
| Members sign in, share a folder, vote online, join through a page, get the rota from anywhere, "while you travel" | `cap-remote-access`, `cap-multi-user`, `f-remote-access`, `f-multi-user` |
| The roll, the minutes or the books are private, secure, safe, protected, offline, "never leave", "nobody can see" | `sec-absolute`, `sec-never-leaves`, `sec-offline`, `f-security-guarantee`, `f-never-leaves`; say "sits on the Core" |
| Compliant, certified, audit-ready, data-protection ready, a safeguarding record, a charity filing | `sec-compliance`, `f-compliance` and the regulated-domain rule |
| Anything about children's welfare, consent, attendance or health; a model that reads a child list; "kid-safe" | `sec-safety-people`, `sec-medical`, `f-medical-care`; a roll with children is only files and where they live |
| Tax, gift-aid, accounting, legal or financial advice; a figure of subs, a surplus or a saving; "saves the treasurer hours"; "legally binding" minutes or signatures | `legal-claims`, `f-legal-tax-fin`, `num-dollar`, `num-savings`, `num-time-saved`, `f-savings` |
| A price, a plan, a storage limit, "free" for any service | `num-dollar`, `f-prices` |
| An accusation against a named service, a service failing or changing its terms, a service logo | `incumbent-attack`, `f-incumbent-claims`, `logo-trademark`; chips carry "alternative to <Service>", prose says "a rented calendar" |
| An agent that posts to the group chat, books the hall, pays a bill or messages a member without approval; a chat message called local | `cap-autonomy`, `cap-messaging-private`, `f-agent-autonomy`, `f-messenger-private` |
| A model as smart as, faster than or as good as a hosted one; a key; a hosted-model name | `cap-parity`, `cap-cloud-model`, `f-parity`, `f-cloud-model` |
| A real club, a real person, a testimonial, "a real committee"; a home's house id | `fake-social-proof`, `f-testimonial`, `f-real-person`, `internal-ids` |
| Voice: em or en dashes, exclamation marks, emoji, "easy", "simple", "seamless", "empower", "home server", "app store" | `dash-em-en`, `exclamation`, `emoji`, `buzz-core`, `buzz-simple-claims`, `vocab-home-server`, `vocab-app-store` |

Ride-along lines for every family: Fictional family. Real software. Installing apps uses the internet. Remote access is not claimed.

## 10. Fit

Rooms and anchors, from `content/story/roles.json`. All room ids are in the schema's room roles.

| Room | Why | Anchor role, in preference order |
|---|---|---|
| `dining` | The kitchen table is the committee's table. The default place for a lead. | `dining-table`, then `counter`, `room` |
| `kitchen` | Where the rota goes on the fridge door and the float tin sits. | `counter`, `fridge`, `kitchen-island` |
| `office` | The folder, the filing cabinet and the lead's desk, in a home or in a small shared office. | `desk`, `bookshelf` |
| `living` | The choir sings through here; the minutes are read on the couch. | `bookshelf`, `music`, `couch` |
| `entry` | The noticeboard by the front door, the keys on their hook. | `front-door` (builtin), then `room` |

Every beat's anchor needs a fallback that ends in a universal role (`counter`, `couch`, `room`, `garden`, `core`, `front-door`, `street`); `music`, `fridge`, `desk` and `bookshelf` are not universal, so each carries its chain.

Homes. Any of the 30 homes with a dining room and either a study or a living room with a bookshelf; the six apartments suit a lead whose whole committee fits around a table for four; a family file can put the lead at a dining room or an office. The eight offices to come are a good place for a different kind of lead: a small shared office a group rents, with a desk and a shelf for the folder. One Core per office, no multi-user promise, members still not Core users.

How this differs from the neighbours. Host: the household's own logistics (the shop, the school run). Organiser: the household's records and a practice of one. Business owner: premises, staff and books for money. The community lead's work is unpaid and for a group outside the household, with no staff and no customers. A family file never gives all of these to one person.

Cast. Ages 18 to 80 and over, at any point: a nineteen-year-old treasurer, a forty-year-old coach, a seventy-eight-year-old chair. Household shapes: one adult in a flat, a couple where only one leads, a parent with a teenager who is a gamer or a learner, a shared house of adults, three generations where the lead is the middle one or the eldest. A lead is never under 16. A child may be named in a parent-led beat only as someone the group serves, never as the one acting and never as a roll entry beyond "the junior team".

Casting warning. A role is never given by reflex. The secretary is not the older woman, the treasurer is not the retired man, the coach is not the athletic young man, the tenants' chair is not the angry neighbour. Alternate gender, age, culture and disability across the fleet; do not make accessibility the plot. One group per family and no two families in the fleet running the same kind of group in the same year of their story. The lead is not the household's IT person, and the family's tech member (builder or tech family) is not the lead's rescuer.

## 11. Ten user stories

Format: "As a <role>, I want <job> so that <outcome>". Each story has one app, one service, the caveat that rides with it, and a moment: a room, an anchor role with its fallback, and what happens first. Hands and objects come first; no screen is readable.

**US1. Grist, alternative to Airtable (`grist`, `airtable`).**
As a junior football club registrar, I want the new term's team sheet and kit list in one table so that I stop rebuilding it from paper forms each autumn.
Caveat: Grist keeps the table as a file on the Core that can be copied. The Core is not a backup, and nothing is said about the safety of the names. Moment: `dining`, anchor `dining-table` (fallback `counter`, `room`). The pile of paper registration forms comes out of a folder first; the registrar types the names in once.

**US2. BookStack, alternative to Confluence (`bookstack`, `confluence`).**
As a sailing club secretary, I want the minutes and the club rules in books and pages with search so that nobody asks me again what was agreed in March.
Caveat: members read it printed or on the lead's screen; they do not get an account. Moment: `office`, anchor `bookshelf` (fallback `desk`, `room`). A ring binder of printed minutes sits on the shelf; the lead takes it down first and then searches for one word.

**US3. Radicale, alternative to Google Calendar (`radicale`, `google-calendar`).**
As a choir secretary, I want the rehearsal and concert dates in one calendar so that the printed rota on the fridge door matches the one in my devices.
Caveat: no QA screenshot; reached from the devices at home only; no claim that the old calendar's shared links carry over, so the rota is printed and handed round. Moment: `kitchen`, anchor `fridge` (fallback `counter`, `room`). The printed rota is held to the fridge door with a magnet first; a phone on the counter is the second shot.

**US4. Akaunting, alternative to QuickBooks (`akaunting`, `quickbooks`).**
As an allotment society treasurer, I want the subs and the receipts recorded in one place so that the yearly report is a page I can read out, not an envelope I tip out.
Caveat: bookkeeping tool; no accounting, tax or legal advice; no card taking. Moment: `office`, anchor `desk` (fallback `dining-table`, `room`). The tin and a paper receipt are first; the treasurer matches the two before the meeting.

**US5. Vikunja, alternative to Todoist (`vikunja`, `todoist`).**
As a village hall booking clerk, I want what I promised on the way out of a meeting in a list with reminders so that nothing is left in my coat pocket.
Caveat: supports CalDAV sync; one household's Core, not an account per committee member. Moment: `entry`, anchor `front-door` (fallback `room`). Keys come off the hook and a scrap of paper out of a coat first; later the same task sits in the list.

**US6. Planka, alternative to Trello (`planka`, `trello`).**
As a summer fair organiser, I want one board of jobs the whole committee reads together so that stalls, chairs and cake are covered before the day.
Caveat: the committee reads one board at the table; do not say members edit it from home. Moment: `dining`, anchor `dining-table` (fallback `counter`, `room`). A stack of index cards with jobs on them is spread across the table first; the board holds the same jobs afterwards.

**US7. Nextcloud, alternative to Google Drive (`nextcloud`, `google-drive`).**
As a repair café coordinator, I want the volunteer list, the tool checklist and the photos in one folder so that the next coordinator is shown a folder, not told a story.
Caveat: web interface only; no away-from-home scenes; the Core stays in the coordinator's household, so the handover is a person showing the next one; at the fleet cap, use sparingly. Moment: `office`, anchor `desk` (fallback `bookshelf`, `room`). A shoebox of labelled printouts comes out first; the folder on the Core is the second shot.

**US8. Papra, alternative to Evernote (`papra`, `evernote`).**
As a film society chair, I want the hall hire letter and the projector warranty kept in one archive so that I can find them on the day the projector stops.
Caveat: an archive, not a records system; no claim about what the society must keep. Moment: `living`, anchor `bookshelf` (fallback `couch`, `room`). A projector box with its receipt taped to the lid is first.

**US9. BookStack, alternative to Notion (`bookstack`, `notion`).**
As a book club organiser who is stepping down, I want my handover notes written in pages so that the next organiser opens one place and finds the whole year.
Caveat: members and the next organiser read it printed or on the lead's screen; the Core stays in the lead's household. Moment: `dining`, anchor `dining-table` (fallback `counter`, `room`). Two mugs and a notebook are on the table first: the incoming organiser reads the pages beside the old one.

**US10. Vikunja, alternative to Asana (`vikunja`, `asana`).**
As a tenants' group chair, I want the list of jobs to raise with the building's managing agent so that we send one clear list after each meeting.
Caveat: same as US5. No advice about tenants' rights and no claim about what the agent must do. Moment: `dining`, anchor `dining-table` (fallback `counter`, `room`). A hand-drawn floor plan with jobs ticked on it is first; the list is the second shot.

The stories use ten different group kinds, no role more than twice (secretary, chair, organiser), and all eight apps. A family file picks one or two and invents its own group.

## 12. Six beat seeds

Each is the first sentence a visitor reads. Each is 20 words or fewer, in sentence case, with no dash, digit or exclamation mark. Chips follow the grammar "<App> | alternative to <Service>". The seeds say where the thing sits; they accuse nobody.

1. The choir's roll sat in a rented database; now it is one file on the Core.
   Chip: Grist | alternative to Airtable.
2. Years of minutes sat in a rented wiki under one volunteer's name.
   Chip: BookStack | alternative to Confluence.
3. The rota sat in a calendar one volunteer made on a phone.
   Chip: Radicale | alternative to Google Calendar.
4. The year's dues and receipts lived in two places, a shoebox and a rented ledger.
   Chip: Akaunting | alternative to QuickBooks.
5. The group's folder lived in a drive the old secretary owned, and the new one could not open it.
   Chip: Nextcloud | alternative to Google Drive.
6. Every job for the summer fair sat on a rented board that the committee shared over one laptop.
   Chip: Planka | alternative to Trello.

## 13. The personas.json row

Add under `archetypes` in `content/story/personas.json`, then mirror `community-lead` in `schema/family.schema.json` (`member.archetype`) and `ARCHETYPES` in `assets/story/types.ts` (a test keeps all three equal), in `scripts/story/build-casting.mts` and the pools in `scripts/story/cast-lint.mts`. No `example` name: the cast plan picks the names.

```json
"community-lead": {
  "label": "Community lead",
  "description": "Runs a club, choir, tenants' group or committee from the kitchen table: roll, minutes, rota and small budget.",
  "rooms": ["dining", "kitchen", "office", "living"],
  "fallbackRooms": ["entry", "bedroom"],
  "anchorRoles": ["dining-table", "desk", "bookshelf", "counter", "fridge"],
  "fallbackAnchorRoles": ["kitchen-island", "couch", "room"],
  "apps": ["grist", "radicale", "bookstack", "vikunja", "planka", "akaunting", "papra", "nextcloud"]
}
```
