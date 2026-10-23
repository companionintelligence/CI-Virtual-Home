# The Athlete (`athlete`)

Draft deep dive for a new archetype, written on 2026-10-20 for the front page's Play category ("Play and explore"). It is a proposal, not yet part of the contract: `personas.md`, `content/story/personas.json`, the schema, `assets/story/types.ts`, `scripts/story/build-casting.mts`, `scripts/story/cast-lint.mts` and `scripts/portal-front.mts` do not know it until the owner adds it (the checklist is at the end).

Shape and depth follow the Gamer chapter of [persona-bible.md](../persona-bible.md) (3.3), the Gamer table of [persona-apps.md](../persona-apps.md) and the sibling drafts in this folder. Nobody here is a customer. Ages, homes, jobs and lines are design choices for fictional characters. Every statement about how athletes live is an editorial synthesis, tagged [?] in the bible's evidence key; no statistic is quoted and none is needed. Home ids are crew-only; print display names.

**One line.** Logs runs, rides and sessions, keeps the routes and the daily habits, and the music, on the Core.

**Why a new one.** Play today has one kind of person, the gamer, and the gamer file is a sixteen-year-old with a screen. Training is a far more common way to spend free time, it leaves a record that people care about (the route, the session, the streak), and the rented services that hold those records are on the registry. The honest part: this is the thinnest of the candidate archetypes. Five apps have a store "replaces" name, but SparkyFitness is blocked by the validator today (not boot-tested), Navidrome is at the fleet cap and Immich is past it. The headroom apps are Endurain and Habitica (one family each), and Wanderer and Wingfit, which have no replaces name and so no chip. The persona leads with those four and uses the capped two once each.

## 1. Who

Light comes in at the hall window while the shoes are already on. One member of the house is out of the front door for a run before anyone else is up. Another wheels a bicycle out of the garage for the ride to work. Another has a towel over one shoulder and a lane at the pool; another is in the garage with a bar and a bench and the door open to the morning. Afterwards there is one line to write: where they went, or what they lifted, or only that they did it. It goes into a log. The shoes are rinsed at the kitchen sink and the bottle is filled for tomorrow. On Saturday the long one needs a route, and the route needs a playlist, and the photo from the top of the hill is on a phone that is nearly full. Nothing in the day is dramatic. It is a run of small ordinary habits done in daylight, and what the athlete keeps is the record of them.

Athletes come at every age. A sixteen-year-old on the school swim squad with a bag by the door and a chain of days. A woman in her thirties who commutes by bicycle because it is the quickest way across town. A man in his fifties who took up running after a long time of not and cares about the loop more than the clock. A retired pair who swim together in the late morning. A lifter in her seventies whose gym is a corner of the garage. A hill walker who keeps a log of every summit, a parent who rides to work and swims on Saturdays. They live in flats with a bicycle hung in the hall and in houses with a garage, a pool or a hill behind the garden, in cities, suburbs and small towns, alone, as couples, with flatmates, with children or with grandparents. In a household of four there is often one athlete and three people who live with the kit by the door; sometimes the whole family trains and the log is a shared joke. Some train for an event, some for a standing habit, some because the body likes to move. None of that is a claim about health, and the athlete is not the household's coach, doctor or the person who tells anyone else what to do.

## 2. What they are responsible for

- The log: every run, ride, swim or session, in the order it happened, with the route where there is one.
- The routes: the loops they reuse, the hill they do on Thursdays, the new route planned on a map before Saturday.
- The gear: shoes, a chain, tyres, a bag; the things that wear out and need a note against a date.
- The habit chain: the daily or weekly habits that make the training possible (the stretch, the early alarm, the bag packed the night before).
- The playlist: the mix for the long one or the cool-down, which is a small piece of the session and is taken seriously.
- The photos from events and trailheads: a finish line, a summit, the club day.
- Getting the household's morning to work around the kit by the door; in a family, the school athlete's practice times and the lift to the pool.
- Staying honest about what a log is: a record of what was done, not a measure of anyone's health and not advice.

## 3. What they rent today

From the registry (`content/story/services.json`). All eight carry no flag, `alternativeToForm: ok` and `storyStatus: ok`. The "Fleet" column is how many current families already use the service in `fleetHomes`; the cap is 12 of 30 homes (14 of 36).

| Registry id | Name | What it holds for them | Fleet | Notes for the writer |
|---|---|---|---|---|
| `strava` | Strava | The log of runs and rides, with the route and the gear | 1 | Headroom, and outside the top 80 by rank. The two Hub apps with a replaces name for it are Endurain (usable) and SparkyFitness (blocked). The chip reads "alternative to Strava". |
| `myfitnesspal` | MyFitnessPal | A food and activity diary | 0 | Headroom, but the only Hub app for it is SparkyFitness, which the validator refuses today. A held story only. |
| `habitify` | Habitify | The habit chain and its streak | 0 | Headroom. Habitica is the app. |
| `todoist` | Todoist | The list of chores, kit and practice times | 3 | Headroom. Habitica is the app. |
| `spotify` | Spotify | The music catalogue and the playlist built inside it | 12 | At the cap. Prefer `apple-music` for a new Navidrome chip. |
| `apple-music` | Apple Music | The music catalogue and the playlists | 1 | Headroom. |
| `google-photos` | Google Photos | The phone's photos, including the finish line | 20 | Past the cap by a wide margin. Use Immich with `icloud-photos` first. |
| `icloud-photos` | iCloud Photos | The phone's photos on an Apple phone | 1 | Headroom. |

**Not in the registry, so never named as replaced.** Garmin Connect appears only inside Endurain's own caveat ("Optional sync with Strava and Garmin Connect"). It is not a registry service: it gets no "alternative to" chip and no story. A watch maker's app, a gym's booking app and a race-entry site are also unlisted and are not claimed. Wanderer and Wingfit have no replaces name in the catalog at all.

The rented pattern the story names is the same in every row: the service holds a record the athlete made (a run, a streak, a playlist, a picture), and the record lives where the service puts it. The villain is the pattern. A sentence never accuses a company (`f-incumbent-claims`) and no beat says what a company does with the data; it says where the athlete's copy sits now.

## 4. What the Hub offers them

Seven apps, all in the live store (`inLiveStore: true`) and none tagged `ai: "chat"`, so the age rule 16 never bites and an athlete of any age can be the subject. Two are lead apps with a chip, two are lead apps with no chip, two are capped and one is held.

| Catalog id | Display name | What it does for this person | Replaces (store table) | Honest caveat from the catalog | QA | Fleet today | Role |
|---|---|---|---|---|---|---|---|
| `endurain` | Endurain | Keeps the runs, rides and gear on the Core and draws the log and its stats. The athlete's main app. | Strava | `storySafe: with-caveat`. "Optional sync with Strava and Garmin Connect. Bulk GPX and FIT upload is local." "Logging only. No health outcomes." | screenshot | 1 (brennan-hollin) | Lead |
| `habitica` | Habitica | Turns habits and chores into a game with levels and quests: the daily habits and the kit list as chores. | Todoist, Habitify | None in the catalog. Tags include `kids` and `health-adjacent`: logging only. | screenshot | 1 (brennan) | Lead |
| `wingfit` | Wingfit | Logs workouts: sets, reps, weights, distances and personal records. The lifter's log. | none | "Logging only. No health outcomes." | screenshot | 1 (adeniran) | Lead, no chip |
| `wanderer` | Wanderer | Plans and maps hiking and biking routes from GPX files. | none | None in the catalog. The listing says "share": see below. | screenshot | 1 (salazar) | Lead, no chip |
| `navidrome` | Navidrome | Serves the athlete's own music files to a device on the home network: the long-run mix, the cool-down set. | Spotify, Apple Music | None in the catalog; `claims.json`: "Your own collection only." | screenshot | 12 | Capped. Once. |
| `immich` | Immich | Backs up, searches and organises the phone's photos, with the finish-line picture in the family's library. | Google Photos, iCloud Photos | Catalog: "Bundles its own database and a machine-learning service, so first start takes a while." `claims.json`: phone backup needs the Immich phone app on the home network; no away-from-home claim; no store badge; no face-recognition or "AI sorts your photos" claim. | screenshot | 18 | Capped. Once. |
| `sparkyfitness` | SparkyFitness | Logs meals, workouts and activity. The food and activity diary. | MyFitnessPal, Strava | `storySafe: with-caveat`, `qa: not-boot-tested`. "Logging only. No health outcomes." "Its own listing notes say it has not been boot-tested on a live Hub device." | not boot-tested | 0 | HELD |

**SparkyFitness is held, not just in the background.** The validator raises `app-qa` as an error for any beat that names an app whose QA is `not-boot-tested`, as the beat's app or in a `with`, and `cast-lint` errors if it is a signature app. So it cannot appear in a shipped family today and the `personas.json` row below leaves it out of the pool. Story 7 is written so it is ready the day the Marketplace boot-tests the listing.

**Say and never, per app.** Names are exact: Endurain, Habitica, Wingfit, Wanderer, Navidrome, Immich, SparkyFitness.

- **Endurain.** Say: "Endurain keeps the runs on the Core." "A GPX file uploads locally." Never: a sync to anything, a watch feeding the Core, a segment, a leaderboard, a kudos count, a stat read aloud, "your fitness improves".
- **Habitica.** Say: "Habitica turns the kit list into quests, and the game runs on the Core." Never: a mechanic the listing does not state (only levels and quests are listed, so no streak counter, chain or schedule as a Habitica feature), a habit presented as a health outcome, a streak as a moral measure.
- **Wingfit.** Say: "Wingfit logs the sets, the reps and the weights." Never: a number, a "personal best" as a boast, "stronger", "progress" as an outcome. A personal record is an entry in a log.
- **Wanderer.** Say: "Wanderer plans and maps the route from a GPX file." Never: "share" (the listing says it; in copy it is a public link or a shared link, which `cap-remote-access` bans), a map that works without the internet (the catalog says nothing either way), a route at a place the athlete is away from.
- **Navidrome.** Say: "Navidrome plays the music files the family keeps." Never: a catalogue, "any song", a playlist moving from a service, a recommendation.
- **Immich.** Say: "The photos back up to Immich on the Core, over the home network. The first start takes a while." Never: faces, "sorted for you", a backup promise, a trailhead upload.

## 5. Where they spend time

Kinds of places and media, not named sites; all [?].

- Streets, towpaths, parks, hills and the same loop at the same hour; the pool lane; the garage with a bar; the hall with a bicycle hung on the wall.
- Clubs and the small fixed rituals around them: a running club's Tuesday, a masters swim session, a cycling club's Sunday ride, a weekly timed run in the local park with a volunteer and a stopwatch.
- Events in a field or a car park: a fun run, a sportive, a swim meet, a lifting meet. The queue for the toilets, the bag drop, the photographer by the finish.
- The café or the kitchen afterwards, which is where the route gets talked through.
- Route planners and trail guides, forums for a single sport, bike repair videos, long-running podcasts and newsletters about training, race reports written by people who were there. Read for facts and ideas, not for opinions about services.
- The shoe shop, the bike shop and the person at the counter who knows the gear.
- At home: the hall, the garage, the washing line, the kitchen counter with the bottle, the sofa with the long-run playlist.

The athlete trusts a training partner and a club member over any ranking or app review, and trusts their own log over both.

## 6. How they talk

- **Tone.** Plain, dry, practical, a little self-mocking. States what happened and stops. Modest about results and exact about routes.
- **Pace.** 135 to 150 wpm in the house voice; in sentence terms, even, a short pause after a place or a time of day. Sentences of 6 to 13 words, a fragment for a route.
- **Vocabulary (owns).** Run, ride, swim, session, route, loop, long one, rest day, kit, bag, chain, tyres, lane, set, rep, bar, bench, streak, log, club, start line, finish, GPX, hill, towpath, playlist. Units follow the home's place; copy mixes none and prints none.
- **Humour.** Dry and about themselves and the weather: the alarm, the state of the shoes, a route that goes uphill both ways.
- **What turns them off.** "Crush it", "beast mode", "no excuses", "hustle", "grind", "level up" (the gamer's eye-roll, and a trap beside Habitica), "optimise", "unlock your potential", "biohack", "your best self", "transform", any before-and-after body picture, calorie guilt, a leaderboard used as pressure, a streak used as shame, and anyone who tells them how hard they should train. Also "the cloud knows your routes" as a scare line (`sec-fear`).
- **What lands.** Naming the thing: the loop, the lane, the chain, the playlist. Saying where it sits ("on the Core, not in the training app"). Saying plainly what the app does not do.

## 7. Comfort with technology and attitude to AI

**Comfort 3 of 5, range 2 to 4.** Athletes are often fluent with apps and files in one narrow way: they upload a file, read a map, set a playlist, and many already know what a GPX file is. Few have run a server. The person who sets up the Core in an athlete's household is usually someone else, which is why the stories show both a person with the log and someone who lives with the kit.

**Attitude to AI, the honest range.**

- Proud of their own data: the log is theirs and nobody should read it back to them as advice. Some are proud of wanting the Core for exactly that reason.
- Wary: a coach on a screen that tells them to rest or push is a real turn-off, and the claims file agrees (no medical claim, no advice, no proactive agent).
- Curious: a few would like a model to help them plan a route or tidy notes. That is a minority view and the lead is never AI.
- Indifferent: most athletes never touch a chat model for the log. That is fine and it is the default.

**Rule for the writer.** None of the seven apps is a chat or agent app. An athlete beat has no AI in it. No model reads a body log, writes a training plan, picks a rest day, scores effort or explains a result. No Companion Memory beat for body data. If a household has a builder or organiser who runs a model, it is theirs and it is in their beat. A member under 16 never has a companion and is never voiced.

## 8. Objections and the honest limits

- "Will it sync with my watch?" Not as a story. Endurain's listing has an optional sync with outside services and bulk GPX and FIT upload that is local; the beat shows files, never a sync, and never a watch feeding the Core (`f-devices` is the nearest rule). Whether a given watch can export a file is not in the catalog and is not promised.
- "Where are my segments and my friends?" Not here. The apps log the athlete's own record. No segment, leaderboard, kudos, follower or club feed is claimed (the nearest rules are `cap-multi-user` and `cap-remote-access`).
- "Can I log it from the trailhead?" No. Remote access is not claimed. The log is written at home, on the home network, and Immich's phone backup needs the home network.
- "Will it tell me how I am doing?" No. The apps log; they do not interpret, coach or advise. No health outcome is claimed for any of them.
- "Can I track what I eat?" The only app for it is SparkyFitness, which has not been boot-tested, so it is held. Food logging is also not for everyone: no story makes it a duty or a target.
- "My whole music library is on a streaming service." Navidrome plays the music files the family keeps; nothing from a catalogue moves. A Core is a place for what the household holds.
- "My photos are on my phone's cloud." Immich takes the photos the phone sends it on the home network; it is slow on first start, and it is not a promise that everything already in a cloud arrives.
- "Is the Core my backup?" Not claimed. The story says where the files sit and that Immich backs the phone's photos up to the Core over the home network; it says nothing about protection or about losing a file, and gives no advice about copies.
- "Are the maps local?" The catalog is silent. Never "works offline" (`sec-offline`), never "nothing leaves" (`sec-never-leaves`).
- "How fast, how far, how accurate?" No number: no pace, distance, time, heart rate, sample rate, GPS accuracy or start-up time.

## 9. Claims boundary

What must never be said for this persona. Ids are from `content/story/claims.json`.

| Never say or imply | Rule |
|---|---|
| Any health outcome: fitter, stronger, healthier, "burns", weight loss, recovery, injury, heart or blood pressure, "good for you" | `f-medical-care`, banned `sec-medical`; the catalog caveat "Logging only. No health outcomes." on Endurain, SparkyFitness and Wingfit |
| Advice or coaching: a plan, a rest day, "you should", "your effort", "insights", an agent that "notices you are tired" | `f-medical-care`, `f-proactive`, banned `cap-omniscient`, `cap-autonomy` |
| A number about the athlete: pace, distance, time, a personal best figure, a heart rate, a streak length, a count of runs | `f-unmeasured`, the banned `num-*` family; no screen is ever readable (bible 4.3-1) |
| A sync to or from a service; a watch, band or strap feeding the Core or Companion Memory | the Endurain cloud-link caveat; `f-devices`; `f-never-leaves` |
| Segments, leaderboards, kudos, followers, a public profile, "share your route", "share a link", a club feed | banned `cap-remote-access` (public link, share a link), `cap-multi-user`, `f-multi-user` |
| Logging, uploading or planning from outside the house: the trailhead, the car park, a hotel, "after the race", "while travelling" | `f-remote-access`, banned `cap-remote-access`; Immich's phone-backup caveat |
| "Backed up", "never lose a run", "safe", "secure", "private" on their own, "nothing leaves", "offline" | `f-security-guarantee`, `f-never-leaves`, banned `sec-absolute`, `sec-never-leaves`, `sec-offline`; the Core is never described as a backup or a guarantee |
| Food, calories, macros, weight, body fat, a diet, "fuel", "eat for", body image, a body picture | `f-medical-care`, banned `sec-medical`; SparkyFitness `app-qa` |
| A price, a saving, "cancel the subscription", "stop paying", "cheaper than" | `f-prices`, `f-savings`, banned `num-dollar`, `num-savings` |
| A catalogue or library moving from a service ("your playlists come with you", "your photo cloud moves across") | the Navidrome and Immich caveats; `f-incumbent-claims` |
| A named service beside a verb of spying, selling, lying or harvesting; a sentence that says what a company does with the data | `f-incumbent-claims`, banned `incumbent-attack`; Strava is not on that list, but the same rule applies |
| An agent that books a pool lane, buys a race entry, posts a result or cancels a membership | `f-agent-autonomy`, banned `cap-autonomy` |
| A Companion app, a store badge or a QR code on the phone | `f-mobile-app`, banned `cap-mobile-app`; the Immich app is Immich's, on the home network |
| Blanket capture of other people: photos or video of teammates, children or strangers without their consent | `f-surveillance`, banned `cap-camera-capture` |
| "Gaming PC", a game title, "level up", RGB, a console in shot | banned `cap-gaming`; keep the gamer boundary: Habitica is a game for habits, Steam Headless is the gamer's app |
| A testimonial, a review, a rating, a count of athletes, "real runners", "athletes like you" | `f-testimonial`, banned `fake-social-proof` |
| "Your own apps", "own outright", the Core as a photograph or a product hero | `f-own-apps`, banned `cap-own-apps`; `f-photoreal-core` |
| Any "easy", "simple", "effortless" ease claim, any "set up in minutes" | banned `buzz-simple-claims` (review), `buzz-core`, `f-duration`, `num-minutes` |

**The regulated-domain rule.** Health, and a young person's training log, are regulated domains. Write only what the app does (logs a run, a ride, a set, a habit, a meal; plans and maps a route) and where the files live (on the Core). Say nothing of health outcomes, nothing of advice, nothing of protection, safety, privacy law, certification or compliance, no security guarantee, and nothing about how a log is "used" by anyone else. A log kept by a member under 18 is children's data: same rule, and the member is shown in third-person captions, never voiced.

**Standing lines that ride along.** Fictional family, real software. Installing apps uses the internet. Remote access is not claimed. Daylight and warm light only. One household, one Core.

## 10. Fit

**Rooms and anchors (from `roles.json`).**

| Room id | Anchor role (preference) | What it resolves to | Why it fits |
|---|---|---|---|
| `garage` | `bicycle` | the `bicycle` item; the `home` table lists it in `garage` and `entry` | The commuter's bicycle on the wall and the Monday look at the chain. The athlete's home room. |
| `entry` | `front-door` (always resolves), `bicycle` | the front door; a bicycle in a hall | The run starts here and the shoes are by the door. Flats, which have no garage, use this. |
| `bedroom` | `bed`, `desk` | bed items; desk items | The alarm, the bag packed the night before, the log written at the desk. |
| `living` | `couch` | sofas and sectionals | The long-run mix on the sofa afterwards. |
| `patio` | `pool`, `patio-seat` | the `pool` zone; patio sets, loungers, benches | The lap swimmer's morning; the photo from the day on the bench. |
| `garden` (fallback) | `patio-seat`, `garden` | seating; the garden zone | A bench to write the log on. |
| `laundry` (fallback) | `laundry` | washing-machine, dryer | The kit in the wash. |
| `dining` (fallback) | `dining-table` | tables | The photo from the first race, looked at with a friend. |

The row below uses `garage`, `entry`, `bedroom`, `living` and `patio` as primary rooms and `garden`, `laundry`, `dining` as fallbacks. The anchors are `bicycle`, `pool`, `front-door`, `bed`; the fallbacks are `desk`, `couch`, `patio-seat`, `room`, and `room` always resolves. `front-door` is a built-in anchor that resolves in every home. Stories 5 and 7 are set in the kitchen (anchor `fridge`, `counter`) and story 10 in `dining`; the kitchen is not in the row because the persona-cover rule only asks for one beat in an own room.

**Homes whose spec already gives the athlete a real prop (read from `content/houses/*.json` on 2026-10-20, 30 homes; the six apartments are not in that folder and were not checked).**

- A bicycle, always in the Garage: asymmetry, bghouse-olcia, cocoon, epiphany, familyhouse-nora, flowerycottage, mesamariposa, modernhome-nora, neweco, palnknoll, riverbend (11 homes). Where the home has none, the chain falls back to `room` garage and then `front-door`.
- A lap pool (zone `pool`): asymmetry, aurora, bgfamily, cocoon, flowerycottage, mesamariposa, mirage, modernhome-nora, modernhouse-nora, modernhouse1, newcrest, onestory, palms, palnknoll, seraphine, sunnyhome, valleyview, vanilla (18 homes). The hot tub at gardennook and the turtle pool at mediterranean are not a lap pool; do not write a swimmer there.
- Gym equipment, which has no role id, so it is reachable only through `room`: asymmetry (a "Spa & Gym" room with an exercise bike, a weight bench and a yoga mat, no room role) and riverbend (an exercise bike and a weight bench in the Two-Car Garage).
- Best all-round: asymmetry (Garage bicycle, Spa & Gym, pool, a Living room) and riverbend (Garage with bicycle, bike and bench, plus a driveway). The best swim homes with a bicycle too: cocoon, flowerycottage, mesamariposa, modernhome-nora, palnknoll.
- Homes with a pool and no bicycle (a swimmer, not a cyclist): aurora, bgfamily, mirage, modernhouse-nora, modernhouse1, newcrest, onestory, palms, seraphine, sunnyhome, valleyview, vanilla. Homes with neither: cutestarter, familyhome, gardennook, lakecabin, mediterranean, payorote, starter18k. An athlete there is told at the front door, the bed and the sofa, which always resolve, or at a bench in the garden.
- Flats and the apartments: the commuter cyclist suits a flat best, with the bicycle in the hall (`entry`) and no garage. Not verified until the six are folded in.

**Existing athlete-like beats.** Three families already carry one: brennan-hollin (Sally runs from the front door, with Endurain), adeniran (Kunle logs a ride in the Garage, with Wingfit) and salazar (Valeria plans a ride with Wanderer). In all three the athlete is a side of an organiser, contractor or maker. Story 1 would duplicate brennan-hollin's front-run if it were set in that family; the athlete archetype is for a member whose training is the main thing they do on the Core.

**Candidate members (the cast plan decides; nothing here edits `cast-plan.json`).** A family keeps two or more archetypes, a business home keeps at least one organiser, builder or business-owner, and no archetype with three or more members may be more than 65 percent one gender-coded name set.

| Home | Possible member | Why it fits |
|---|---|---|
| riverbend (watanabe) | Haruo (70, maker) or Yoshiko (67, host) | The garage has a bicycle, an exercise bike and a weight bench. An older lifter or rider is the strongest counter to the teenage default. |
| onestory (dekker) | Greet (69) or Willem (71) | A pool and a Deck; no desk and no living-room television, so the beats are at the pool and the sofa. |
| valleyview (gill) | Harpreet (61) or Jaswinder (63) | A pool and a Roof Deck; a couple with no children at home. |
| asymmetry (adeniran) | Ife (15) or Tobi (17) | A Garage bicycle, a Spa & Gym and a pool. Moving Tobi from gamer would thin the gamer skew; Ife as a school swimmer is the Habitica story. |
| cocoon (quintero) | Marisol (38) or Andres (40) | A Garage bicycle and a pool in a young family. |
| flowerycottage (tuala) | Malia (44) or Sione (46) | A Garage bicycle and a pool for a couple. |

**Ages and household shapes to cast.** One athlete in a household of two to six, occasionally two. Any age from a school athlete of fourteen to the oldest member of the house. Single adult; a couple; two generations; flatmates; a family where one parent rides to work. The athlete is rarely the household's builder, organiser or business owner and is never a gamer by another name. Pair the athlete with someone who does not train and give that person a reaction shot (bible 4.3-7).

**Casting warning against stereotype.** The athlete is not a teenage boy, not a young man, not a thin person, not a person with a fit-looking body, not a hero and not a customer. A girl, a grandmother, a man in his sixties, a parent with a pram and a person in a wheelchair are as likely to be the athlete as a nineteen-year-old on a track. A role is never given by reflex: a swim is not for girls, a bench press is not for men, a bicycle commute is not for the young, and a person who trains in a racing chair or on a handcycle is an athlete in the same sentence as everyone else. A disability is never the reason the role is given or the arc of the story. No prop in the engine is a racing chair; do not invent one. Name the person for the household, with heritage varied and first names at most twice in the fleet, never for the sport. A member under 16 is a minor for the age rule: no companion, third-person captions, never voiced. Such a member may be the actor of a Habitica beat, because Habitica is not a chat app; anything that asks for an account or a decision is parent-led, with the adult as the beat's member and the young person named in the body.

## 11. Ten user stories

Each is "As a <person who trains>, I want <job> so that <outcome>", tied to one catalog app and one registry service, with the caveat and a one-line story moment. An athlete is shown with no name here. In every moment the shoes, the bicycle, the towel or the bench is the hero and the screen is never readable (bible rule 4.3-1). Services at or past the fleet cap (`spotify`, `google-photos`) are used once each; prefer the headroom services in new casts. Story 7 is held.

1. **As a club runner, I want every run and its route kept in one place at home so that the years of training are a log I keep.**
   App: `endurain`. Service: `strava`. Caveat: optional sync with outside services is not shown; a GPX or FIT file uploads locally; logging only, no health outcome.
   Moment: `entry`, `front-door` (fallback `street`). First: a pair of shoes is untied by the door, and the camera holds on the shoes, not the screen.

2. **As a commuter cyclist, I want the bicycle's chain and tyres counted by the ride so that Monday's check is a look at a log and not a guess.**
   App: `endurain`. Service: `strava`. Caveat: the same Endurain caveat; gear is a list, not advice about when to replace anything.
   Moment: `garage`, `bicycle` (fallbacks `room` garage, `front-door`). First: a hand turns the pedal and lifts the chain with a rag; Monday morning light on the wall.

3. **As a trail runner who has changed devices, I want to bring years of old watch files home in one folder so that the history I already have sits in the log.**
   App: `endurain`. Service: `strava`. Caveat: bulk GPX and FIT upload is local; whether a given watch can export a file is not in the catalog and is not promised; no sync, no watch feeding the Core.
   Moment: `bedroom`, `desk` (fallback `couch`). First: a hand copies a folder of old files across; the camera holds on the hand, then on the Core on its shelf.

4. **As a lifter, I want my sessions and my stretching to be daily habits in a game on the Core so that a skipped day is mine to know and is nobody's business.**
   App: `habitica`. Service: `habitify`. Caveat: levels and quests only are listed; no outcome, no health claim; no streak counter is claimed; a skipped day is a record, not a measure of anyone.
   Moment: `bedroom`, `bed` (fallback `desk`). First: a hand pulls on a sock, the bag is already by the bed, and a tick goes against the morning.

5. **As a school athlete, I want the kit list and the chores turned into quests so that nothing is left behind in the bag.**
   App: `habitica`. Service: `todoist`. Caveat: the same Habitica caveat; the actor may be a member of 14 or older; no companion under 16; the log is children's data, so the beat says only what the app does and that it sits on the Core.
   Moment: `kitchen`, `fridge` (fallback `counter`). First: a list on the fridge door gains a line, and a bag is zipped; third-person caption, nobody speaks.

6. **As a long-distance runner, I want the long-run mix played from my own music files so that the music is a folder I keep and not a list inside a service.**
   App: `navidrome`. Service: `spotify`. Caveat: your own collection only; no recommendation; no sound-quality claim; spotify is at the cap.
   Moment: `living`, `couch` (fallback `music`). First: a runner sits with feet up and a cold drink, and the same files play from the Core to the room.

7. **HELD. As an endurance cyclist, I want to note what I ate and drank on long rides so that the notes for the next long ride are mine.**
   App: `sparkyfitness`. Service: `myfitnesspal`. Caveat: not boot-tested, so the validator refuses it (`app-qa`); logging only; no calories, targets, weight or goals; food logging does not suit every person.
   Moment: `kitchen`, `counter` (fallback `fridge`). First: a bottle and a paper bag on the counter after the ride; the camera leaves before any list is shown.

8. **As a lap swimmer, I want the cool-down music played from my own files by the pool so that it is the same music on the deck as in the kitchen.**
   App: `navidrome`. Service: `apple-music`. Caveat: your own collection only; the phone or speaker is on the home network; no sound-quality claim.
   Moment: `patio`, `pool` (fallbacks `patio-seat`, `garden`). First: a wet towel is hung on a chair and music starts from a phone on the lounger; no screen is shown.

9. **As a race-day regular, I want the finish-line photos to back up to the Core when I am home so that the day's pictures sit with the family's own library.**
   App: `immich`. Service: `google-photos`. Caveat: the first start takes a while; phone backup needs the Immich phone app on the home network; no away-from-home backup; no store badge; no face or "sorted for you" claim; google-photos is past the cap.
   Moment: `patio`, `patio-seat` (fallback `garden`). First: a phone is placed on a bench beside a water bottle; the Wi-Fi is the house's, the light is late morning.

10. **As a masters athlete, I want to find the photo from my first race so that I can show a friend where it started.**
    App: `immich`. Service: `icloud-photos`. Caveat: the same Immich caveats; search is as the listing says (the listing names no date search); no face recognition.
    Moment: `dining`, `dining-table` (fallback `couch`). First: a friend leans over a tablet at the table and a hand points at a corner of a picture; the photo itself is not readable.

**Companion moments, no service.** Two lead apps have no replaces name, so no chip and no "alternative to" line, and they do not count toward the ten. Wanderer: a hand traces a loop on a printed map at the dining table while the Core sits on its shelf; `dining`, `dining-table` or `patio-seat`. Wingfit: a bar is racked in the garage and a hand writes the last set on a pad, the log being the app; `garage`, `room` or `bicycle`. Both are the same shape as the existing salazar and adeniran beats.

Coverage check: Endurain leads three stories (strava three times), Habitica two (habitify, todoist), Navidrome two (spotify, apple-music), Immich two (google-photos, icloud-photos), SparkyFitness one (myfitnesspal, held). All eight registry services are used. Nine stories are shippable now (1 to 6 and 8 to 10); story 7 is held. The capped apps Navidrome (12 of 30) and Immich (18 of 30) count toward the fleet cap with every athlete beat, so use each once, last, and in an apartment before a house.

## 12. Six beat seeds

Each is the first sentence a visitor reads. They say what the rented service held or changed and what the family's own copy does instead. Sentence case, no dash, no digit, no exclamation mark, 20 words or fewer. The villain is a pattern; no company is named in a sentence and no attack verb is used. Chips carry the comparison. Each is a seed for the writer, not shipped copy, and each is held to the incumbent rules.

| # | Seed | Angle | Chip | App | Story |
|---|---|---|---|---|---|
| 1 | Years of runs and routes sat in an activity service, and Endurain now keeps the same files on the Core. | held | Endurain, alternative to Strava | `endurain` | 1 |
| 2 | The chain and tyres of a commuter bicycle sat in a rented log, and Endurain counts them on the Core. | held | Endurain, alternative to Strava | `endurain` | 2 |
| 3 | A habit list lived in another app, and Habitica now turns the habits into a game on the Core. | held | Habitica, alternative to Habitify | `habitica` | 4 |
| 4 | The cool-down playlist lived inside a music service, and Navidrome now plays the swimmer's own files from the Core. | held | Navidrome, alternative to Apple Music | `navidrome` | 8 |
| 5 | Finish-line photos sat in a photo cloud, and Immich now backs them up to the Core over the home network. | held | Immich, alternative to Google Photos | `immich` | 9 |
| 6 | The kit list sat in a to-do app nobody opened, and Habitica turns it into a game on the Core. | changed | Habitica, alternative to Todoist | `habitica` | 5 |

Notes on the six. Seeds 1 to 5 say where a record sat, never what a company did with it; seed 6 only says the list sat unused. Seeds 1 and 2 hold an object (shoes, a chain) and are the strongest open on camera. No seed names a number, a result, a body or a goal.

## Appendix: the `personas.json` row

To be added under `archetypes` in `content/story/personas.json`. The row carries an example name the cast plan may replace (`Ilse` is not in any story, cast or avoid list read on 2026-10-20). Every room is in the schema's `roomRole` enum, every anchor role is in `roles.json` (`items`, `zones` or the built-ins, and in the schema's `roleId` enum), every app is a catalog id in the live store with `storySafe` other than `avoid`, and no room is both preferred and a fallback. SparkyFitness is left out of the pool because the validator refuses it (see section 4). The apps are listed headroom first.

```json
"athlete": {
  "label": "Athlete",
  "description": "Trains most days, as a runner, a cyclist, a swimmer or a lifter: the runs, rides and sessions, the routes, the daily habits and the music sit on the Core.",
  "example": "Ilse",
  "rooms": ["garage", "entry", "bedroom", "living", "patio"],
  "fallbackRooms": ["garden", "laundry", "dining"],
  "anchorRoles": ["bicycle", "pool", "front-door", "bed"],
  "fallbackAnchorRoles": ["desk", "couch", "patio-seat", "room"],
  "apps": ["endurain", "wingfit", "wanderer", "habitica", "navidrome", "immich"]
}
```

**Checklist when the owner adopts it (this file touches none of these).** Add `athlete` to `member.archetype` in `content/story/schema/family.schema.json` and to `ARCHETYPES` in `assets/story/types.ts` (a test keeps the three equal); add the row to `content/story/personas.json`; add a POOLS entry in `scripts/story/cast-lint.mts` and the `PREFS` and `ROOM_PREF` entries in `scripts/story/build-casting.mts` (suggested: PREFS `bicycle`, `bed`, `desk`, `couch`; ROOM_PREF `entry`, `garage`, `bedroom`, `living`, `patio`); the athlete is not a `JOBS` archetype, as gamer is not; add a row to the table in `personas.md` and a section to `persona-apps.md`; add `athlete` to `PERSONAS` in `scripts/portal-front.mts` with category `play`; add rows to `claims.json` `apps` for `endurain`, `habitica`, `wingfit` and `wanderer` (only `immich` and `navidrome` are there today, so the `mayDescribeAs` and caveat text above has no home); add lexicon pins if a name reads wrong aloud; run `pnpm run story:cast` and `pnpm run story:validate`.
