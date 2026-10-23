# The personas, by category

Every archetype a family member can have (`content/story/personas.json`), the front-page category it is in (`content/story/categories.json`)
and where its write-ups are. Twenty-six archetypes in eight categories; each archetype is in exactly one. The contract (rooms, anchors,
app pools, the rules a beat must follow) is [personas.md](../personas.md); the research book for the first fourteen is
[persona-bible.md](../persona-bible.md).

Nobody here is a customer. Ages, households, names and lines are design choices for fictional characters. The regulated domains (a carer's post, a researcher's sources, a club's member list, a lawyer's client file)
are told as record keeping only: what the app does and where the files live, with no advice and no compliance, certification, safety or
security claim. Nobody under 16 uses a chat model or an agent. A household has one Core: no persona has a separate account, a private space
or a multi-user promise, and none has a remote-access promise.

**How the files are named.** The first fourteen have a chapter in the bible (chapter 3) and a file of ten more user stories,
`<archetype>-stories.md`. The twelve added later have one deep dive each, `<archetype>.md`, which holds the user stories, beat seeds and
checks in one file; its last JSON block is the `personas.json` row. Both kinds are drafts for the owner.

**Where they show today.** The 30 families are cast with the original six archetypes only, so the front page draws the chips of the
categories that hold those six (Run the household, Code and tinker, Study and research, Make and keep, Play and explore, Host and care) and
none for Work from home or Run a business. A chip with no family is not drawn. The re-cast (`content/story/cast-plan.json`) is a later
package; the apartments (36 homes) and the offices (a separate type of place) come after it.

## The categories

| Category | Id | What it holds | Archetypes |
|---|---|---|---|
| Work from home | `work-from-home` | Desk work done from a spare room or kitchen table: briefs, clients, sources and deadlines. | [`marketer`](#marketer), [`journalist`](#journalist), [`lawyer`](#lawyer), [`translator`](#translator) |
| Run a business | `run-a-business` | Shops, trades and stalls run from a garage, a back room or a small office. | [`business-owner`](#business-owner), [`contractor`](#contractor), [`seller`](#seller) |
| Code and tinker | `code` | Writing software and running the house network, with the local model on the Core. | [`builder`](#builder), [`tech-family`](#tech-family) |
| Study and research | `study` | Homework, lesson plans, papers and sources, for pupils, teachers and anyone chasing a question. | [`learner`](#learner), [`educator`](#educator), [`researcher`](#researcher) |
| Make and keep | `make` | Painting, design, music and photographs, and the family archive that outlives the project. | [`maker`](#maker), [`creative`](#creative), [`archivist`](#archivist) |
| Play and explore | `play` | Games, collections, training logs and trips: the hours kept for fun, and the record of them. | [`gamer`](#gamer), [`collector`](#collector), [`athlete`](#athlete), [`traveller`](#traveller) |
| Run the household | `household` | Paperwork, shared costs and a week that different people live on different clocks. | [`organiser`](#organiser), [`money-keeper`](#money-keeper), [`housemate`](#housemate), [`shift-worker`](#shift-worker) |
| Host and care | `care` | Feeding the house, looking after a relative, and keeping a club or committee going. | [`host`](#host), [`carer`](#carer), [`community-lead`](#community-lead) |

The second filter is the kind of place: Homes, Apartments, Offices. No persona is tied to one.

## Work from home (`work-from-home`)

Desk work done from a spare room or kitchen table: briefs, clients, sources and deadlines.

| Archetype | One line | Deep dive | User stories |
|---|---|---|---|
| <a id="marketer"></a>Marketer (`marketer`) | A freelance or in-house digital marketer: the client's files and briefs sit at home and the drafting model runs on the Core. | [bible, chapter 3.11](../persona-bible.md#311-the-marketer-marketer) | [marketer-stories.md](marketer-stories.md) |
| <a id="journalist"></a>Journalist (`journalist`) | A reporter, writer or researcher: the tape, the notes and the records, with every quote checked against the audio. | [bible, chapter 3.13](../persona-bible.md#313-the-journalist-journalist) | [journalist-stories.md](journalist-stories.md) |
| <a id="lawyer"></a>Lawyer (`lawyer`) | A solo or small-firm attorney: the client file and the engagement letter, with a first-pass summary checked line by line. | [bible, chapter 3.12](../persona-bible.md#312-the-lawyer-lawyer) | [lawyer-stories.md](lawyer-stories.md) |
| <a id="translator"></a>Translator (`translator`) | Works between languages: drafts a translation, rewrites it by hand, edits the PDFs and bills by the project. | [translator.md](translator.md) | [translator.md, section 11](translator.md#11-ten-user-stories) |

## Run a business (`run-a-business`)

Shops, trades and stalls run from a garage, a back room or a small office.

| Archetype | One line | Deep dive | User stories |
|---|---|---|---|
| <a id="business-owner"></a>Business owner (`business-owner`) | Runs a shop, studio, agency or practice of one to fifteen people: quotes, invoices, contracts and the customer list. | [bible, chapter 3.8](../persona-bible.md#38-the-business-owner-business-owner) | [business-owner-stories.md](business-owner-stories.md) |
| <a id="contractor"></a>Contractor (`contractor`) | A self-employed tradesperson: the quote, the site photos, the tools and the warranty cards, from the garage bench. | [bible, chapter 3.10](../persona-bible.md#310-the-contractor-contractor) | [contractor-stories.md](contractor-stories.md) |
| <a id="seller"></a>Seller (`seller`) | Sells what they make or find at a stall and by message, and keeps the stock, photos and invoices at home. | [seller.md](seller.md) | [seller.md, section 11](seller.md#11-ten-user-stories) |

## Code and tinker (`code`)

Writing software and running the house network, with the local model on the Core.

| Archetype | One line | Deep dive | User stories |
|---|---|---|---|
| <a id="builder"></a>Builder (`builder`) | Writes software for a living; the code and a local model both live on the Core. | [bible, chapter 3.2](../persona-bible.md#32-the-builder-builder) | [builder-stories.md](builder-stories.md) |
| <a id="tech-family"></a>Tech family (`tech-family`) | Leads a family that already runs its own network and lamp rules; the rest of the family is the acceptance test. | [bible, chapter 3.7](../persona-bible.md#37-the-tech-family-tech-family) | [tech-family-stories.md](tech-family-stories.md) |

## Study and research (`study`)

Homework, lesson plans, papers and sources, for pupils, teachers and anyone chasing a question.

| Archetype | One line | Deep dive | User stories |
|---|---|---|---|
| <a id="learner"></a>Learner (`learner`) | Studies and reads: homework, languages and exams with local tools. | [bible, chapter 3.4](../persona-bible.md#34-the-learner-learner) | [learner-stories.md](learner-stories.md) |
| <a id="educator"></a>Educator (`educator`) | A teacher, tutor, lecturer or homeschooling parent: lesson folders and handouts, with the report comments rewritten by hand. | [bible, chapter 3.14](../persona-bible.md#314-the-educator-educator) | [educator-stories.md](educator-stories.md) |
| <a id="researcher"></a>Researcher (`researcher`) | Reads, cites and writes up: papers, archives, notes and translated sources, kept on the Core. | [researcher.md](researcher.md) | [researcher.md, section 11](researcher.md#11-ten-user-stories) |

## Make and keep (`make`)

Painting, design, music and photographs, and the family archive that outlives the project.

| Archetype | One line | Deep dive | User stories |
|---|---|---|---|
| <a id="maker"></a>Maker (`maker`) | Paints, photographs, writes or plays; the household's creative work lives on the Core. | [bible, chapter 3.5](../persona-bible.md#35-the-maker-maker) | [maker-stories.md](maker-stories.md) |
| <a id="creative"></a>Creative (`creative`) | A working designer, photographer, filmmaker, illustrator or musician: client work and an archive that outlives the job. | [bible, chapter 3.9](../persona-bible.md#39-the-creative-creative) | [creative-stories.md](creative-stories.md) |
| <a id="archivist"></a>Archivist (`archivist`) | Scans the family's slides, letters and home films and files them where the next generation can find them. | [archivist.md](archivist.md) | [archivist.md, section 11](archivist.md#11-ten-user-stories) |

## Play and explore (`play`)

Games, collections, training logs and trips: the hours kept for fun, and the record of them.

| Archetype | One line | Deep dive | User stories |
|---|---|---|---|
| <a id="gamer"></a>Gamer (`gamer`) | Plays on the Core from the couch or the bedroom, on a screen in the house. | [bible, chapter 3.3](../persona-bible.md#33-the-gamer-gamer) | [gamer-stories.md](gamer-stories.md) |
| <a id="collector"></a>Collector (`collector`) | Keeps a library of records, books, comics and films and knows where every one is. | [collector.md](collector.md) | [collector.md, section 11](collector.md#11-ten-user-stories) |
| <a id="athlete"></a>Athlete (`athlete`) | Logs runs, rides and sessions, keeps the routes and the habits, and the playlist, on the Core. | [athlete.md](athlete.md) | [athlete.md, section 11](athlete.md#11-ten-user-stories) |
| <a id="traveller"></a>Traveller (`traveller`) | Plans trips at the table and files the itinerary, the flight log and the photos once home. | [traveller.md](traveller.md) | [traveller.md, section 11](traveller.md#11-ten-user-stories) |

## Run the household (`household`)

Paperwork, shared costs and a week that different people live on different clocks.

| Archetype | One line | Deep dive | User stories |
|---|---|---|---|
| <a id="organiser"></a>Organiser (`organiser`) | Plans the week, files the paperwork and often runs a small business from a home office. | [bible, chapter 3.1](../persona-bible.md#31-the-organiser-organiser) | [organiser-stories.md](organiser-stories.md) |
| <a id="money-keeper"></a>Money keeper (`money-keeper`) | Owns the household ledger: bills, subscriptions, shared costs and the receipts behind them. | [money-keeper.md](money-keeper.md) | [money-keeper.md, section 11](money-keeper.md#11-ten-user-stories) |
| <a id="housemate"></a>Housemate (`housemate`) | Shares a rented flat with friends or a partner: the bills, the chores, the shelf and the telly. | [housemate.md](housemate.md) | [housemate.md, section 11](housemate.md#11-ten-user-stories) |
| <a id="shift-worker"></a>Shift worker (`shift-worker`) | Works a rota that does not match the household's day, and keeps one shared week across different clocks. | [shift-worker.md](shift-worker.md) | [shift-worker.md, section 11](shift-worker.md#11-ten-user-stories) |

## Host and care (`care`)

Feeding the house, looking after a relative, and keeping a club or committee going.

| Archetype | One line | Deep dive | User stories |
|---|---|---|---|
| <a id="host"></a>Host (`host`) | Feeds, ferries, waters and tidies the house: the household's shared beats. | [bible, chapter 3.6](../persona-bible.md#36-the-host-host) | [host-stories.md](host-stories.md) |
| <a id="carer"></a>Carer (`carer`) | Looks after a parent, partner or relative and keeps the letters, the calendar and the notes in one place. | [carer.md](carer.md) | [carer.md, section 11](carer.md#11-ten-user-stories) |
| <a id="community-lead"></a>Community lead (`community-lead`) | Runs a club, choir, tenants' group or committee from the kitchen table: roll, minutes, rota and small budget. | [community-lead.md](community-lead.md) | [community-lead.md, section 11](community-lead.md#11-ten-user-stories) |
