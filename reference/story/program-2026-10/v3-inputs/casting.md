# Casting review: the 30 homes recast for story v3

> **Status: input to a recast that main did not adopt as written.** The review of `cast-plan.v3.json` and `apartments-cast.json` (2026-10-19). The cast plan on main is `content/story/cast-plan.json`, and `reference/story/cast.md` is its derived table; they differ from this recast in 22 of the 30 families. The scripts it names (`apply-cast.mjs`, `verify.mjs`, `build-v3.mjs` and the rest) are not kept. See [`README.md`](README.md).

Generated 2026-10-19 for task C1 from `cast-plan.v3.json` (the 30 homes), `apartments-cast.json` (the six apartments) and the live `content/story/cast-plan.json` (read only). Nothing in the repo was changed: the live plan, `casting.json`, `cast.md` and `content/families` are as they were, and `apply-cast.mjs` moves a home across when its story is rewritten.

## Files

| File | What it is |
|---|---|
| `cast-plan.v3.json` | The 30 homes: people, workrooms, signature apps, beat apps and reviewNeeded, in the layout of `content/story/cast-plan.json`. 0 cast-lint errors in a scratch copy. |
| `apply-cast.mjs` | `node apply-cast.mjs <slug>... [--dry-run] [--lint] [--repo <path>]`: copies those homes' blocks into `content/story/cast-plan.json` and nothing else, then runs `pnpm run story:cast`. Refuses a slug that is not in the v3 file. Tested only on `test-repo/`. |
| `apartments-cast.json` | The six apartments, cast and with apps; applied nowhere. `apartments-gender.json` holds their readings for the skew check. |
| `casting.md` | This file. |
| `verify.mjs`, `lint-v3.sh`, `partial-test.sh` | The checks: skew (all four views), names, ages, apps; the real cast-lint on the v3 plan in `test-repo/`; each home applied alone. |
| `build-v3.mjs`, `build-apt.mjs`, `locks.mjs`, `v3-spec.mjs`, `alloc-lib.mjs`, `make-md.mjs` | The generators (the recast data, the hand-picked core apps, the rotation search); rerun them to change a decision. |

## 1. Method and rules

- **People.** Age, role and household shape are kept for every member. Where an archetype moved between the two adults of a home, the people keep their names, ages, roles, companions and bedrooms and swap jobs and workrooms. The five first names that changed are listed in section 4.
- **Gender reading.** The cast has no gender field. Each name is read the way the old stories used it (their pronouns), and the table of readings is section 6. An archetype of three or more members is measured with every member counted, flagship members once per home (Sally, John, Steve and Jean appear in three homes), and also with the flagship family counted once; both views pass. The 36-home view (30 homes plus the six apartments) passes too.
- **Business homes** keep an organiser, builder or business owner (cast-lint). That rule, decided after bible 5.2, changes two of its recasts: haddad and tuala (section 7).
- **Age rule 16.** No companion under 16 (none exists; the only 16 and 17 year olds have none). Every member under 16 has a signature app from their archetype pool that is not a chat model, and no archetype pool is chat-only. A chat-model app is also never a beat app in a home with a child under 16.
- **Apps.** Every home keeps its agent app (the companions' runtime in the live stories). The rest was found by a seeded search with the persona's bible hubStack and playbook apps as the strongest fit, the older v3 allocation as a small bonus, a cap of 12 for any third-party app, at least 110 distinct apps (the search aimed higher), no Kiwix and no avoid app. The core of each home (the agent app and the persona-defining app of each member, in `locks.mjs`) is hand-picked; the search fills the remaining signature slots and the beat apps for the required topics (home, food, iot, privacy) the signature apps do not cover.

## 2. Old cast to new cast, home by home

Format: name age archetype. A home with "unchanged" keeps its people exactly; the apps still rotate (section 5).

| Home (house) | Old cast | New cast | Why |
|---|---|---|---|
| brennan (`seraphine`) flagship, business | Sally 43 organiser; John 45 builder; Steve 16 gamer; Jean 14 learner | unchanged | Flagship cast kept. Kiwix (storySafe avoid) is replaced by LibreTranslate, a learner-pool app that is not a chat model, so Jean (14) has a signature app of her own under the age rule. |
| brennan-hollin (`bgfamily`) flagship, business | Sally 43 organiser; John 45 builder; Steve 16 gamer; Jean 14 learner | unchanged | Flagship cast and apps kept as they are (no Kiwix here). |
| brennan-merrow (`familyhouse-nora`) flagship, business | Sally 43 organiser; John 45 builder; Steve 16 gamer; Jean 14 learner | unchanged | Flagship cast and apps kept as they are (no Kiwix here). |
| adeniran (`asymmetry`), business | Folake 47 organiser; Kunle 49 builder; Tobi 17 gamer; Ife 15 learner | Folake 47 organiser; Kunle 49 contractor; Adunni 15 gamer; Tobi 17 learner | Kunle becomes an electrician (contractor): the garage bench was already his stage, and "firmware contractor" was a developer under another name (bible 5.4). The teens swap roles: Adunni (15) is the gamer in the big Loft Bedroom and Tobi (17) the learner at the Green Bedroom desk. Adunni is the old Ife, renamed because Ife reads either way and the gamer group needed a clear reading. Fixes: gamers all male. |
| kovacs (`mediterranean`) | Eszter 49 organiser; Gabor 51 builder; Bence 16 gamer; Reka 13 learner | Eszter 49 tech-family; Gabor 51 educator; Bence 16 learner; Reka 13 gamer | Eszter and Gabor swap jobs: Eszter runs the house network (tech-family, "school IT manager"), Gabor teaches computing (educator). The teens swap roles: Reka (13) is the gamer in the TV Room, Bence (16) the learner at the West Bedroom bookshelf. Fixes: tech-family leads, educators and gamers all skewed one way. |
| haddad (`epiphany`), business | Dalia 46 organiser; Samir 48 builder; Yasmin 20 learner | Dalia 46 builder; Samir 48 creative; Yasmin 20 learner | The cast-lint rule keeps one organiser, builder or business owner in a business home, so Dalia becomes the studio's technical director (builder) and Samir its artist (creative, was tech-family in bible 5.2). Fixes: before the recast builders were 19 of 22 male. |
| iyer (`mesamariposa`), business | Meenakshi 45 organiser; Ravi 47 maker; Arjun 15 gamer; Kavya 10 learner | Meenakshi 45 organiser; Ravi 47 creative; Arjun 15 gamer; Kavya 10 learner | Ravi, the sound designer, is a creative (was maker). Everyone else stays. |
| tesfaye (`mirage`) | Hana 49 organiser; Dawit 51 builder; Selam 15 learner; Bruk 19 maker | Hana 49 builder; Dawit 51 organiser; Selam 15 learner; Bruk 19 maker | Hana and Dawit swap jobs: Hana is the systems engineer (builder, at the Den), Dawit runs hospital operations (organiser, at the Loggia Dining table). Fixes: before the recast organisers were 23 of 24 female and builders 19 of 22 male. |
| moreau (`modernhouse1`) | Claire 46 organiser; Etienne 48 builder; Hugo 17 gamer; Lea 12 learner | Claire 46 lawyer; Etienne 48 tech-family; Manon 17 gamer; Lea 12 learner | Claire becomes a health-law attorney (lawyer, the bible alternate) and Etienne the tech-family lead. Hugo (17) becomes Manon: gamers were all male. |
| quintero (`cocoon`) | Marisol 38 organiser; Andres 40 builder; Camila 10 learner; Mateo 7 maker | Marisol 38 tech-family; Andres 40 organiser; Camila 10 maker; Mateo 7 learner | Marisol is the tech-family lead (devops engineer, Garage bench), Andres runs the clinic office (organiser, Den). The children swap roles: Camila (10) is the maker with the easel, Mateo (7) the learner at the desk. |
| nguyen (`modernhome-nora`) | Linh 39 organiser; Duc 41 builder; Mai 11 learner; Bao 8 maker | Thuy 39 contractor; Duc 41 organiser; Mai 11 maker; Bao 8 learner | Linh becomes Thuy, a kitchen and bathroom fitter (contractor, Garage); Duc is the hospital scheduler (organiser). Mai (11) is the maker and Bao (8) the learner. Thuy is renamed because Linh reads either way and the contractor group is split two and two. |
| hwang (`palnknoll`) | Minjung 40 organiser; Jiho 42 builder; Yuna 8 learner | Soyeon 40 educator; Hyunwoo 42 contractor; Yuna 8 learner | Minjung becomes Soyeon (educator, primary school teacher at the Dining table) and Jiho becomes Hyunwoo (contractor, carpenter at the Garage bench). Both are renamed because the Korean names read either way and the educator and contractor groups are split two and two. |
| kamau (`gardennook`) | Wanjiru 34 builder; Juma 36 host; Zuri 0 baby | Wanjiru 34 journalist; Juma 36 host; Zuri 0 baby | Wanjiru becomes a freelance science writer (journalist, the bible alternate); Juma stays the host. |
| chaudhry (`lakecabin`) | Noor 36 builder; Imran 38 host; Zara 1 baby | Noor 36 journalist; Imran 38 host; Zara 1 baby | Noor becomes a reporter and editor (journalist, bible 5.2 primary); Imran stays the host. |
| petrov (`newcrest`) | Elena 34 organiser; Nikolai 36 host; Mila 1 baby | Elena 34 host; Nikolai 36 marketer; Mila 1 baby | Elena is at home with Mila (host) and Nikolai is the marketing manager (marketer): bible 5.2 gave Elena the marketer role, which would have made every marketer female. |
| cardoso (`starter18k`) | Beatriz 33 organiser; Tiago 35 host; Leo 6 learner | Beatriz 33 marketer; Tiago 35 host; Leo 6 learner | Beatriz becomes the charity's communications officer (marketer, the bible alternate); Tiago stays the host. |
| whitaker (`familyhome`), business | Hannah 35 organiser; Callum 37 host; Nell 7 learner; Alfie 1 baby | unchanged | Cast unchanged. Hannah is the business lead (self-employed bookkeeper), Callum the host. |
| hovsepian (`bghouse-olcia`), business | Araxi 67 organiser; Hagop 70 builder; Nare 11 learner | Araxi 67 educator; Hagop 70 builder; Nare 11 learner | Araxi, a retired teacher who tutors, is the educator and moves to the long table in Living and Dining; Hagop keeps the Study with the Core (builder). |
| nwachukwu (`cutestarter`) | Ngozi 67 organiser; Emeka 70 host; Chidi 8 learner | unchanged | Cast unchanged. |
| dekker (`onestory`) | Willem 71 organiser; Greet 69 host; Joris 10 learner | unchanged | Cast unchanged. |
| watanabe (`riverbend`) | Yoshiko 67 host; Haruo 70 maker; Emi 38 builder; Kenji 9 learner; Sora 0 baby | Yoshiko 67 host; Haruo 70 maker; Emi 38 contractor; Kenji 9 learner; Sora 0 baby | Emi becomes a painter and decorator who works from the Two-Car Garage (contractor, bible 5.2 primary). |
| halvorsen (`aurora`), business | Ingrid 38 organiser; Mats 41 builder | Ingrid 38 builder; Mats 41 lawyer | Mats is the solicitor (lawyer) and Ingrid the freelance developer (builder), so the lawyers are not all female; Ingrid is the business lead. businessText now reads "law practice and freelance development". |
| rahimi (`modernhouse-nora`), business | Parisa 41 organiser; Kian 43 maker | Parisa 41 organiser; Kian 43 educator | Kian becomes an educator (guitar teacher); Parisa stays the organiser who runs the school and is the business lead. |
| salazar (`payorote`), business | Valeria 36 maker; Rafael 38 builder | Valeria 36 creative; Rafael 38 builder | Valeria is a creative (painter who sells prints, was maker); Rafael stays the builder and business lead. |
| adler (`sunnyhome`), business | Ruth 39 organiser; Noam 41 builder | Ruth 39 builder; Noam 41 business-owner | Noam runs the design agency (business-owner, at the Dining table for the Friday money hour) and Ruth is the robotics software engineer (builder, Library Lounge). Fixes: business owners, builders and the missing room role of the Upper Landing. |
| banerjee (`palms`), business | Ananya 40 organiser; Rohan 42 builder | Ananya 40 builder; Rohan 42 organiser | Rohan runs the studio's planning and paperwork (organiser) and Ananya is the lead developer (builder, Stair Study). Fixes: before the recast organisers were 23 of 24 female and builders 19 of 22 male. |
| jankowski (`neweco`), business | Agnieszka 42 organiser; Tomasz 44 builder | Agnieszka 42 business-owner; Tomasz 44 tech-family | Agnieszka is the business owner (bible 5.2); Tomasz the tech-family lead (IoT consultant). |
| tuala (`flowerycottage`), business | Malia 44 maker; Sione 46 builder | Malia 44 creative; Sione 46 builder | Malia is a creative (was maker). Sione stays a builder and the business lead: bible 5.2 made him a contractor, which would leave a business home without an organiser, builder or business owner. |
| gill (`valleyview`) | Harpreet 61 host; Jaswinder 63 organiser | unchanged | Cast unchanged. |
| mbatha (`vanilla`), business | Thandi 44 host; Sipho 46 builder | unchanged | Cast unchanged. |

## 3. Archetypes: members, families and name-coded gender, before and after

Members count every person with an archetype (a baby has none); the flagship family counts three times. F and M are the readings of section 6. The rule is: no archetype of three or more members is more than 65 percent one reading.

| Archetype | Families before | Members before (F/M, larger share) | Families after | Members after (F/M, larger share) | Families, 36 homes | Members, 36 homes (F/M, larger share) | Bible 5.1 (36 homes) |
|---|---|---|---|---|---|---|---|
| organiser | 24 | 24 (23/1, 95.8%) | 14 | 14 (9/5, 64.3%) | 14 | 14 (9/5, 64.3%) | 16 |
| builder | 22 | 22 (3/19, 86.4%) | 12 | 12 (5/7, 58.3%) | 13 | 13 (5/8, 61.5%) | 16 |
| gamer | 7 | 7 (0/7, 100%) | 7 | 7 (3/4, 57.1%) | 9 | 9 (4/5, 55.6%) | 9 |
| learner | 18 | 18 (14/4, 77.8%) | 18 | 18 (10/8, 55.6%) | 21 | 21 (12/9, 57.1%) | 21 |
| maker | 8 | 8 (2/6, 75%) | 4 | 4 (2/2, 50%) | 5 | 5 (3/2, 60%) | 5 |
| host | 10 | 10 (3/7, 70%) | 10 | 10 (4/6, 60%) | 11 | 11 (5/6, 54.5%) | 11 |
| tech-family | 0 | 0 | 4 | 4 (2/2, 50%) | 4 | 4 (2/2, 50%) | 3 |
| business-owner | 0 | 0 | 2 | 2 (1/1, n<3) | 4 | 4 (2/2, 50%) | 4 |
| creative | 0 | 0 | 4 | 4 (2/2, 50%) | 5 | 5 (3/2, 60%) | 5 |
| contractor | 0 | 0 | 4 | 4 (2/2, 50%) | 4 | 4 (2/2, 50%) | 3 |
| marketer | 0 | 0 | 2 | 2 (1/1, n<3) | 4 | 4 (2/2, 50%) | 3 |
| lawyer | 0 | 0 | 2 | 2 (1/1, n<3) | 4 | 4 (2/2, 50%) | 3 |
| journalist | 0 | 0 | 2 | 2 (2/0, n<3) | 4 | 4 (2/2, 50%) | 3 |
| educator | 0 | 0 | 4 | 4 (2/2, 50%) | 5 | 5 (3/2, 60%) | 5 |

Archetypes over 65 percent after the recast: none. Before the recast the skews were: organiser 23F/1M, builder 3F/19M, gamer 0F/7M, learner 14F/4M, maker 2F/6M, host 3F/7M.

Totals against bible 5.1 (36 homes) are in the last column; the 30-home counts differ where the bible's own alternates, the business-lead rule and the three-member problem apply (section 7, points 1 to 3).

## 4. First-name reuse

Distinct first names in the 36 homes: 104. The flagship names (Sally, John, Steve, Jean) are exempt. Names used twice outside the flagship: none. No name is used three times. Surnames and companion names are all unique (cast-lint and verify.mjs check this on the 30; verify.mjs checks the 36).

| Home | Old name | New name | Why |
|---|---|---|---|
| adeniran | Ife | Adunni | reads either way; the gamer group needed a clear reading |
| moreau | Hugo | Manon | gamers were all male; a girl gamer, French first name for the Moreau family |
| nguyen | Linh | Thuy | reads either way; contractors split two and two |
| hwang | Minjung | Soyeon | reads either way; educators split two and two |
| hwang | Jiho | Hyunwoo | reads either way; contractors split two and two |

Every new name is invented, was never a cast, retired (98 first names from the 30 retired families, read from git) or avoid-list name (Maya, Ben, Sarah, Dana, Alex, Sofia, Priya, Jordan, Lilia and the researchers' placeholders), and is used once. The companion names did not change (companions belong to the person).

The six apartments are new people: Zaid, Ximena, Nasrin, Saeed, Lindiwe, Matthias, Tamsin, Esperanza, Takumi, Anouk, Yara, Wilfred, Anwen, Petra, Fernanda, Chike, Ayaan, Dmitri. None repeats a cast, retired or avoid-list name; Dara, a researcher's placeholder in the bible, is not used.

## 5. App rotation

- Distinct apps across the 30 homes (signature plus beat apps): **128** (before: 76); with the apartments: 136.
- Most-used third-party app: yuvomi in 8 of 30 homes (cap 12; the old plan peaked at home-assistant in 10). Apps over 12 homes: 0. With the apartments no third-party app is in more than 9 of 36 homes (cap 14).
- The old plan was under the cap too (it counts signature and beat apps only); the over-cap apps in the bible and in E1's `--complete` run (Paperless-ngx 17, Immich 19, Open WebUI 17, HortusFox 18 and Kiwix 18 homes, 11 apps in all) come from the written stories. The plan now gives each of them room: paperless 4, immich 3, open-webui 4, hortusfox 3, home-assistant 5, vaultwarden 3, nextcloud 4 homes, so the writers have headroom to the cap of 12.
- First-party agent apps (exempt from the cap): ci-hermes 15, ci-openclaw 10, ci-memory 5 homes (every home keeps the one its companions already use).
- Kiwix: 0 homes (before: 6). Avoid apps: 0. Apps outside the catalog: 0.
- The 14 story-rich apps each appear in at least three homes: ci-memory 5, ci-hermes 15, ci-openclaw 10, home-assistant 5, immich 3, frigate 3, paperless 4, vaultwarden 3, nextcloud 4, jellyfin 3, hortusfox 3, wallos 3, twenty 3, yuvomi 8.
- Fit to the personas: 149 of 210 signature slots are an app in the hubStack of the bible chapter or the playbook shots of at least one member's archetype (the rest are rotation fillers that cover a topic or a pool).

Top 25 apps by homes (signature plus beat), before and after. "*" is a first-party agent app, exempt from the cap.

| App | Before (of 30) | After (of 30) | After, with apartments (of 36) |
|---|---|---|---|
| ci-hermes* | 15 | 15 | 17 |
| ci-openclaw* | 10 | 10 | 12 |
| grocy | 4 | 8 | 9 |
| yuvomi | 10 | 8 | 9 |
| homehub | 7 | 7 | 9 |
| kitchenowl | 10 | 7 | 9 |
| steam-headless | 7 | 7 | 9 |
| ci-memory* | 5 | 5 | 7 |
| forgejo | 8 | 5 | 6 |
| gitea | 8 | 5 | 5 |
| home-assistant | 10 | 5 | 6 |
| ci-planning | 4 | 4 | 4 |
| glasshome | 1 | 4 | 5 |
| koodo-reader | 2 | 4 | 5 |
| libreoffice | 2 | 4 | 5 |
| nextcloud | 4 | 4 | 6 |
| ntfy | 5 | 4 | 4 |
| open-webui | 5 | 4 | 4 |
| paperless | 4 | 4 | 6 |
| pi-hole | 6 | 4 | 4 |
| uptime-kuma | 3 | 4 | 4 |
| vikunja | 1 | 4 | 4 |
| akaunting | 3 | 3 | 3 |
| bookstack | 1 | 3 | 4 |
| code-server | 3 | 3 | 3 |

### Apps without a QA screenshot (owner entries in reviewed.json, per beat)

brennan: code-server; brennan-hollin: code-server; brennan-merrow: code-server; kovacs: syncthing; moreau: radicale; nguyen: calibre-web; hwang: homebox; chaudhry: whisper-webui; petrov: mealie; mbatha: ollama. The flagship `code-server` entries exist already. Nothing else is shown with a screenshot-less app: beat apps all have one.

### Gaps the writers will hit

- No `app-media.json` entry yet (run `pnpm run story:media` after the pools settle) for 52 of the 128 apps: invoice-ninja, readeck, homarr, syncthing, habitica, pingvin-share, mstream, logseq, collabora-online, invio, freshrss, radicale, super-productivity, cryptgeon, kokoro, razzia, lubelogger, homebox, skybro, element, trip, music-assistant, privatebin, whisper-webui, reitti, ghost, plausible, keila, mixpost, affine, simplelogin, appflowy, endurain, yamtrack, heimdall, netbird, nocodb, linkwarden, searxng, documenso, jitsi, docmost, copyparty, medusa, prestashop, standard-notes, mattermost, passbolt, freecut, baserow, jotty, memos.
- No `claims.json` app entry for 75 of the 128 apps: code-server, steam-headless, libretranslate, yuvomi, forgejo, obsidian, gitea, ci-spellbook, paperless, blockbench, readeck, homehub, homarr, jupyterlab, habitica, pingvin-share, mstream, ntfy, audiomass, duplicati, invio, freshrss, radicale, super-productivity, cryptgeon, inkscape, kokoro, kitchenowl, razzia, pairdrop, calibre-web, lubelogger, glasshome, donetick, hortusfox, skybro, trip, music-assistant, privatebin, whisper-webui, reitti, wingfit, mixpost, affine, simplelogin, appflowy, endurain, yamtrack, heimdall, netbird, booklore, drawio, nocodb, firefly-iii, monetr, linkwarden, bentopdf, planka, baikal, opnform, mazanoke, activepieces, copyparty, grist, prestashop, tldraw, standard-notes, cryptpad, passbolt, freecut, baserow, jotty, airtrail, wanderer, memos. The validator does not require one (it adds the entry's `mayDescribeAs` to the catalog description as the source for a beat's capability), so the writers describe these apps from the catalog description only; a claims pass would give them sanctioned wording.

### Every home's apps

| Home | Signature apps (agent first) | Beat apps | Review needed |
|---|---|---|---|
| brennan | ci-hermes, ci-planning, nextcloud, code-server, open-webui, steam-headless, libretranslate | iot: home-assistant, food: yuvomi | code-server |
| brennan-hollin | ci-openclaw, yuvomi, libreoffice, forgejo, code-server, steam-headless, obsidian | iot: frigate | code-server |
| brennan-merrow | ci-memory, joplin, vaultwarden, gitea, code-server, steam-headless, ci-spellbook | iot: pi-hole, food: yuvomi | code-server |
| adeniran | ci-hermes, paperless, invoice-ninja, steam-headless, koodo-reader, blockbench, readeck | food: homehub, iot: homarr | none |
| kovacs | ci-hermes, home-assistant, libreoffice, jupyterlab, steam-headless, syncthing, habitica | home: ci-planning, food: homehub | syncthing |
| haddad | ci-openclaw, open-webui, penpot, obsidian, forgejo, pingvin-share, mstream | home: vikunja, food: homehub, iot: ntfy | none |
| iyer | ci-hermes, twenty, audiomass, steam-headless, libretranslate, logseq, collabora-online | home: vikunja, food: yuvomi, iot: ntfy, privacy: duplicati | none |
| tesfaye | ci-memory, gitea, invio, jupyterlab, photoprism, uptime-kuma, freshrss | home: vikunja, food: yuvomi | none |
| moreau | ci-hermes, radicale, home-assistant, steam-headless, koodo-reader, docuseal, super-productivity | home: vikunja, food: grocy, privacy: cryptgeon | radicale |
| quintero | ci-hermes, pi-hole, ci-planning, inkscape, kokoro, uptime-kuma, jellyfin | food: kitchenowl | none |
| nguyen | ci-openclaw, invoice-ninja, stirling-pdf, excalidraw, razzia, pairdrop, calibre-web | home: lubelogger, food: homehub, iot: glasshome, privacy: paperless | calibre-web |
| hwang | ci-hermes, libreoffice, invoice-ninja, razzia, homebox, kokoro, donetick | food: grocy, iot: glasshome, privacy: nextcloud | homebox |
| kamau | ci-hermes, obsidian, hortusfox, immich, skybro, element, trip | food: kitchenowl, iot: music-assistant, privacy: privatebin | none |
| chaudhry | ci-openclaw, whisper-webui, kitchenowl, joplin, anything-llm, reitti, wingfit | iot: frigate, privacy: cryptgeon | whisper-webui |
| petrov | ci-memory, mealie, ghost, plausible, donetick, wallos, keila | iot: glasshome | mealie |
| cardoso | ci-hermes, penpot, homehub, ci-spellbook, mixpost, affine, spliit | iot: pi-hole, privacy: simplelogin | none |
| whitaker | ci-hermes, akaunting, kitchenowl, razzia, appflowy, endurain, yamtrack | iot: heimdall, privacy: netbird | none |
| hovsepian | ci-hermes, libreoffice, forgejo, booklore, kimai, drawio, nocodb | home: ci-planning, food: grocy, iot: music-assistant | none |
| nwachukwu | ci-hermes, stirling-pdf, hortusfox, audiobookshelf, firefly-iii, jellyfin, photoprism | food: yuvomi, iot: music-assistant, privacy: nextcloud | none |
| dekker | ci-memory, yuvomi, koodo-reader, monetr, grocy, twenty, onlyoffice | iot: ntfy | none |
| watanabe | ci-hermes, immich, navidrome, docuseal, linkwarden, koodo-reader, bentopdf | home: planka, food: kitchenowl, iot: heimdall, privacy: searxng | none |
| halvorsen | ci-openclaw, open-webui, paperless, forgejo, cryptgeon, kimai, documenso | food: grocy, iot: heimdall | none |
| rahimi | ci-hermes, vaultwarden, baikal, jitsi, opnform, espocrm, docmost | home: lubelogger, food: yuvomi, iot: ntfy | none |
| salazar | ci-openclaw, immich, gitea, wordpress, mazanoke, activepieces, copyparty | home: planka, food: grocy, iot: uptime-kuma | none |
| adler | ci-openclaw, forgejo, akaunting, penpot, medusa, grist, prestashop | home: bookstack, food: homehub, iot: uptime-kuma | none |
| banerjee | ci-openclaw, gitea, vaultwarden, tldraw, standard-notes, mattermost, nextcloud | home: bookstack, food: homehub, iot: homarr | none |
| jankowski | ci-openclaw, twenty, home-assistant, docuseal, cryptpad, frigate, passbolt | home: bookstack, food: grocy, privacy: pi-hole | none |
| tuala | ci-memory, open-webui, n8n, inkscape, wordpress, freecut, baserow | home: jotty, food: grocy, iot: glasshome | none |
| gill | ci-hermes, home-assistant, paperless, airtrail, wallos, wanderer, jellyfin | food: kitchenowl | none |
| mbatha | ci-openclaw, hortusfox, gitea, akaunting, memos, wallos, ollama | food: kitchenowl, iot: homarr | ollama |

## 6. How each name reads (for the writers' pronouns)

The pronouns of the old stories decided the reading of the existing names; the stories are rewritten, so use these. A name marked "either" is one the old story gave a pronoun to and that reads either way: keep that pronoun, or the 65 percent rule shifts.

| Name | Reading | Home | Archetype | Note |
|---|---|---|---|---|
| Sally | she | brennan | organiser |  |
| John | he | brennan | builder |  |
| Steve | he | brennan | gamer |  |
| Jean | she | brennan | learner |  |
| Folake | she | adeniran | organiser |  |
| Kunle | he | adeniran | contractor |  |
| Adunni | she | adeniran | gamer |  |
| Tobi | he | adeniran | learner | either; the old story used "he" |
| Eszter | she | kovacs | tech-family |  |
| Gabor | he | kovacs | educator |  |
| Bence | he | kovacs | learner |  |
| Reka | she | kovacs | gamer |  |
| Dalia | she | haddad | builder |  |
| Samir | he | haddad | creative |  |
| Yasmin | she | haddad | learner |  |
| Meenakshi | she | iyer | organiser |  |
| Ravi | he | iyer | creative |  |
| Arjun | he | iyer | gamer |  |
| Kavya | she | iyer | learner |  |
| Hana | she | tesfaye | builder |  |
| Dawit | he | tesfaye | organiser |  |
| Selam | she | tesfaye | learner | either; the old story used "she" |
| Bruk | he | tesfaye | maker |  |
| Claire | she | moreau | lawyer |  |
| Etienne | he | moreau | tech-family |  |
| Manon | she | moreau | gamer |  |
| Lea | she | moreau | learner |  |
| Marisol | she | quintero | tech-family |  |
| Andres | he | quintero | organiser |  |
| Camila | she | quintero | maker |  |
| Mateo | he | quintero | learner |  |
| Thuy | she | nguyen | contractor |  |
| Duc | he | nguyen | organiser |  |
| Mai | she | nguyen | maker |  |
| Bao | he | nguyen | learner | either; the old story used "he" |
| Soyeon | she | hwang | educator |  |
| Hyunwoo | he | hwang | contractor |  |
| Yuna | she | hwang | learner |  |
| Wanjiru | she | kamau | journalist |  |
| Juma | he | kamau | host |  |
| Noor | she | chaudhry | journalist | either; the old story used "she" |
| Imran | he | chaudhry | host |  |
| Elena | she | petrov | host |  |
| Nikolai | he | petrov | marketer |  |
| Beatriz | she | cardoso | marketer |  |
| Tiago | he | cardoso | host |  |
| Leo | he | cardoso | learner |  |
| Hannah | she | whitaker | organiser |  |
| Callum | he | whitaker | host |  |
| Nell | she | whitaker | learner |  |
| Araxi | she | hovsepian | educator |  |
| Hagop | he | hovsepian | builder |  |
| Nare | she | hovsepian | learner |  |
| Ngozi | she | nwachukwu | organiser |  |
| Emeka | he | nwachukwu | host |  |
| Chidi | he | nwachukwu | learner |  |
| Willem | he | dekker | organiser |  |
| Greet | she | dekker | host |  |
| Joris | he | dekker | learner |  |
| Yoshiko | she | watanabe | host |  |
| Haruo | he | watanabe | maker |  |
| Emi | she | watanabe | contractor |  |
| Kenji | he | watanabe | learner |  |
| Ingrid | she | halvorsen | builder |  |
| Mats | he | halvorsen | lawyer |  |
| Parisa | she | rahimi | organiser |  |
| Kian | he | rahimi | educator |  |
| Valeria | she | salazar | creative |  |
| Rafael | he | salazar | builder |  |
| Ruth | she | adler | builder |  |
| Noam | he | adler | business-owner |  |
| Ananya | she | banerjee | builder |  |
| Rohan | he | banerjee | organiser |  |
| Agnieszka | she | jankowski | business-owner |  |
| Tomasz | he | jankowski | tech-family |  |
| Malia | she | tuala | creative |  |
| Sione | he | tuala | builder |  |
| Harpreet | he | gill | host | either; the old story used "he" |
| Jaswinder | she | gill | organiser | either; the old story used "she" |
| Thandi | she | mbatha | host |  |
| Sipho | he | mbatha | builder |  |
| Zaid | he | valdivia | marketer |  |
| Ximena | she | valdivia | creative |  |
| Nasrin | she | tehrani | business-owner |  |
| Saeed | he | tehrani | journalist |  |
| Lindiwe | she | steyn | marketer |  |
| Matthias | he | steyn | journalist |  |
| Tamsin | she | steyn | maker |  |
| Esperanza | she | voss | lawyer |  |
| Takumi | he | voss | business-owner |  |
| Anouk | she | voss | gamer |  |
| Yara | she | voss | learner |  |
| Wilfred | he | penhallow | lawyer |  |
| Anwen | she | penhallow | host |  |
| Petra | she | penhallow | learner |  |
| Fernanda | she | rademaker | educator |  |
| Chike | he | rademaker | builder |  |
| Ayaan | he | rademaker | learner |  |
| Dmitri | he | rademaker | gamer |  |

The only reading that matters to the rule when changed is Noor in the 36-home view (journalists: Wanjiru she, Noor she, Saeed he, Matthias he). In the 30 homes no single name read the other way breaks any archetype (checked by `verify.mjs`).

## 7. Unresolved points and decisions that need the owner

1. **Three-member archetypes cannot pass the 65 percent rule.** Two of three is 66.7 percent. Contractor, tech-family (30 homes), and lawyer, marketer, journalist (36 homes) would each have been three members in bible 5.1. I made each four, split two and two, with the bible's own alternates (Claire lawyer, Beatriz marketer, Wanjiru journalist, Eszter and Etienne tech-family, Thuy and Hyunwoo contractor). The alternative is a gender-neutral name for one member of each; I chose not to, because the writer would then pick the pronoun and the balance would drift. Say if you prefer the bible totals with neutral names.
2. **Totals differ from bible 5.1.** In the 30 homes: organiser 14 (bible 16), builder 12 (15), tech-family 4 (3), contractor 4 (3), marketer 2 (1), lawyer 2 (1), journalist 2 (1), business owner 2, creative 4, educator 4, host 10, gamer 7, learner 18, maker 4. All gates hold (organiser, builder and learner each in at least 8 families; gamers in 7, cap 12).
3. **Business-lead rule changed two bible recasts.** haddad (Dalia creative, Samir tech-family in bible 5.2) and tuala (Sione contractor) would have no organiser, builder or business owner, which cast-lint errors on. Dalia is the builder and Samir the creative; Sione stays a builder.
4. **Reka (13) is the gamer in kovacs.** It is the only way to put a girl in the gamer role there without renaming Bence. The catalog caveat is that Steam needs a Valve account (no game titles, no frame rates), and at 13 she is the youngest gamer; the story must not show her buying anything. Alternative: rename Bence to a girl and leave Reka the learner.
5. **Noor** (journalist, in the 36-home view) is the one name whose other reading breaks the rule; she is the example name in personas.json. Rename her if you want the rule safe against a different reader.
6. **`reviewed.json` entries (owner only), per beat:** brennan code-server; brennan-hollin code-server; brennan-merrow code-server; kovacs syncthing; moreau radicale; nguyen calibre-web; hwang homebox; chaudhry whisper-webui; petrov mealie; mbatha ollama. Of the nine E1 listed (whisper-webui, solidtime, radicale, homebox, ollama, syncthing, photoview, calibre-web, miniflux) this plan uses syncthing, radicale, calibre-web, homebox, whisper-webui, ollama; mealie is new to the list.
7. **Cleanup after the last home is applied:** remove the `UNTIL_RECAST` kiwix allowance in `scripts/story/cast-lint.mts` and the kiwix exception in `scripts/test-stories.mts`, and drop kiwix from `meta.honourableMentions` in the catalog. I did not touch them.
8. **Partial application.** `cast-lint` stays at 0 errors for each of the 30 homes applied alone onto the live plan, and for all 30 applied together in random order (final plan equal to `cast-plan.v3.json`). The story files in `content/families` keep the old cast until each home is rewritten, so `story:validate` will report the mismatch for an applied home until then.
9. **Apartments** (`apartments-cast.json`) are cast but applied nowhere. Folding them in needs their house files in `content/houses` (they live in the PR #35 branch), `voices.json` `narratorFor` raised to 36 (v-bright-f 3, v-young-f 3, v-steady-m 6, v-storyteller-m 5, v-deep-m 4, v-light-m 3, v-clear-f 6, v-warm-f 6) and the cast-lint constants N (30) and the fleet cap (14 of 36). The combined 36-home plan passes cast-lint except those counts (36 families, narrator totals); no third-party app is in more than 9 of the 36 homes.
10. **Not done here (later stages):** the front-page persona filters in `scripts/portal-front.mts` still know six archetypes; `claims.json` and `app-media.json` gaps above; story rewrites for the 27 non-pilot homes.

## 8. The six apartments

Cast per bible 5.2 with the same skew and age rules; the bible's ages and households are kept, the first names are changed where the 65 percent rule needed a different reading. Rooms are exact spec names (checked with the real `build-casting` against the apartment house files); sleeping capacity, household type and companion rules pass cast-lint.

| Apartment (house) | Household | People | Why |
|---|---|---|---|
| valdivia (`studio-loft`) | solo-or-couple | Zaid 34 marketer (he, Living Loft); Ximena 37 creative (she, Desk & Workshop) | Warehouse Loft: Zainab becomes Zaid (marketer, 34) and Joaquin becomes Ximena (creative, 37); bible 5.2 had a female marketer and a male creative, which would have left marketers all female. |
| tehrani (`city-one-bed`), business | solo-or-couple | Nasrin 41 business-owner (she, Living Room); Saeed 37 journalist (he, Desk Nook) | City One-Bedroom: Dara (a researcher placeholder) becomes Nasrin, business owner (41) with a stationery shop below; Soraya becomes Saeed, journalist (37). |
| steyn (`two-bed-flat`) | young-family | Lindiwe 36 marketer (she, Study Alcove); Matthias 38 journalist (he, Dining Room); Tamsin 6 maker (she, Kids' Room) | Two-Bedroom Flat: Lindiwe marketer (36) and Matthias journalist (38) as in bible 5.2; Tomi (6, maker) becomes Tamsin, a clear reading. |
| voss (`corner-penthouse`), business | older-kids | Esperanza 47 lawyer (she, Office); Takumi 45 business-owner (he, Library Nook); Anouk 16 gamer (she, Living Room); Yara 14 learner (she, Bedroom Three) | Corner Penthouse: Esperanza lawyer (47), Takumi business owner (45, bike shop in the building), Anselm becomes Anouk the gamer (16, a girl in the gamer role), Yara learner (14). |
| penhallow (`garden-flat`) | grandparents | Wilfred 67 lawyer (he, Study); Anwen 65 host (she, Kitchen); Petra 9 learner (she, Grandchild's Bedroom) | Garden Flat: Winifred becomes Wilfred, retired solicitor (67), and Anwar becomes Anwen, the host (65), so the lawyers are not all female; Petra learner (9). |
| rademaker (`walkup-duplex`) | older-kids | Fernanda 44 educator (she, Kitchen & Dining); Chike 42 builder (he, Study Landing); Ayaan 13 learner (he, Bedroom Two); Dmitri 16 gamer (he, Living Room) | Walk-up Duplex: Ferdinand becomes Fernanda, educator (44), and Chinwe becomes Chike, builder (42); Ayaan learner (13), Dmitri gamer (16). |

| Apartment | Signature apps | Beat apps | Review needed |
|---|---|---|---|
| valdivia | ci-memory, penpot, immich, ghost, grist, invoice-ninja, postiz | home: jotty, food: kitchenowl, iot: glasshome | none |
| tehrani | ci-hermes, invoice-ninja, obsidian, umami, hi-events, paperless, archivebox | food: homehub, iot: homarr | none |
| steyn | ci-openclaw, inkscape, linkwarden, foldergram, listmonk, linkstack, paperless | food: homehub, iot: frigate | none |
| voss | ci-hermes, nextcloud, docuseal, steam-headless, libretranslate, papra, stirling-pdf | home: bookstack, food: grocy, iot: heimdall | none |
| penhallow | ci-memory, stirling-pdf, home-assistant, koodo-reader, hortusfox, kitchenowl, nextcloud | none | none |
| rademaker | ci-openclaw, libretranslate, n8n, linkwarden, steam-headless, forgejo, libreoffice | home: donetick, food: yuvomi, iot: music-assistant | none |

