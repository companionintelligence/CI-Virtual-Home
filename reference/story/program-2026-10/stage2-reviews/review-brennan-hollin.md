# Review: brennan-hollin (house bgfamily)

> **Status: historical review of a draft.** A stage-2 review of the second Brennan story (house `bgfamily`) as drafted on 2026-10-20, before the fixes it lists. The replacement text it proposes was applied to a scratch copy only; check `content/families/brennan-hollin.json` on main for what is there now. The conventions it applies are `reference/story/personas.md`, `validator.md` and `story-v3.md`.

**Verdict: SHIP AFTER FIXES** (0 BLOCKER, 6 MAJOR, 14 MINOR)

Validation: `pnpm run story:validate -- brennan-hollin` gives 0 errors, 0 review, 0 warnings, 1 allow-listed (code-server, `study-code`). The beat id `study-code` is kept, and `content/story/reviewed.json` has the matching owner entry (`LB`). The fleet run (`--fleet`) reports no title or body clash. Jean (14) is never the actor of a chat or agent beat, and she has no companion. Her beats are Penpot, Razzia, Obsidian and Mazanoke. Both agents are OpenClaw, they act only in web apps on the Core, and every agent beat carries "Companion Agents are in beta."

No dash, exclamation mark, emoji, price, "assistant" or ad-speak word anywhere in the file. Daylight only ("quiz night" is the event, not a time of day).

## Defects

All limits below were checked against the schema: body at most 30 words and 20 per sentence, title at most 6 words, `before`/`after` at most 28 words, and no digits.

| Sev | Beat | Quote | What is wrong | Exact replacement |
|---|---|---|---|---|
| MAJOR | living-blocks | "Blockbench runs in a browser tab from the Core, on any laptop in the house." | The listing says only "in your browser". "On any laptop in the house" is an extension the catalog does not give. The pair also argues nothing: MagicaVoxel is an offline desktop program, so no service held anything, and the beat never says where the models sit.. | `popup.body`: "Steve's model of the wisteria porch sat in a MagicaVoxel file on one PC. Now he builds it block by block in Blockbench, in a browser tab." `detail.after`: "Blockbench opens in a browser tab served from the Core, so there is nothing to install on the PC." |
| MAJOR | dining-quiz | "because writing a question is revising the answer" | The beat argues a study habit, not where anything sits (writer's own flag). The aside is also a small study-tip lecture aimed at a 14-year-old, which reads as mildly condescending.  | `popup.body`: "Jean writes the family quiz herself, one question per fact she keeps missing. Razzia hosts it on the Core, and everyone plays at the dining table." |
| MAJOR | study-board | "House jobs lived as sticky notes on a pin-board that only John walked past" (before) | The chip says "alternative to Trello", but Trello appears nowhere in the argument. The contrast is sticky notes against Planka, so the pair is decorative. A visitor sees "Trello" and never learns what Trello did. | `popup.body`: "House jobs, from the wisteria prune to the fence paint, sat on a Trello board only John opened. One Planka board on the Core holds them now." `detail.before`: "House jobs lived on a Trello board that only John opened, so nobody else knew which were done." step 1: "Copy each job to a card" |
| MAJOR | ftue-unbox | "Inside: the Companion Core, a power cable, a quick-start guide and a recovery USB drive." | Marketing. At no point does the tour say what a Core is. A stranger meets "Companion Core", "Hub store" and "its own Wi-Fi", and by the outro still has not been told it is a small computer that runs the family's apps at home. The first sentence also repeats the Merrow tour's `ftue-unbox` verbatim. `claims.json` `core-size` and `hub-what` allow the definition. | `popup.body`: "The Companion Core is a small computer for the home. In the box: the Core, a power cable, a quick-start guide and a recovery USB drive." |
| MAJOR | office-desks, office-renewals, front-car, back-tracker | 15 of 26 bodies end on a clause naming the Core: "it sits on the Core", "The record sits on the Core", "on the Core, and she can copy it" | Repeated structure. Nearly every body is "Situation. App does X on the Core." Three use "sits", five end "...on the Core." in a row of the tour's second half. The Core is the product, but the cadence flattens the moments. | office-desks `popup.body`: "A proposal lived on two machines, and Sally mailed herself the newer copy. Now both desks open one LibreOffice file, so there is one version to edit." office-renewals second sentence: "Wallos holds the list and reminds her before each renewal." front-car second sentence: "LubeLogger keeps every service, fuel stop and reminder where John can read them too." back-tracker `popup.body`: "In Grist on the Core, Sally reviews the quarter by the pool, with a Python formula John wrote. The database is one file, and she can copy it." |
| MAJOR | kids-notes (and kids-photos) | `camera`: `{"framing":"medium","side":"right","from":"front"}` | The Kids Room is 2.5 m wide. The only desk, the anchor of both Jean beats, is about 1.3 m from the crib, and the rocking horse is in the same room. I baked the family in memory (`bakeFamily`, no file written) and projected the crib and horse boxes through each solved pose. Frustum only, no occlusion. For kids-notes both appear at 16:9, 1:1 and 9:16. For kids-photos the crib reaches the frame edge at 16:9 and 1:1. This contradicts the casting reason ("the beats never frame a crib") and the writer's own note, which says the hints were tuned but also says to re-check by eye. Of 12 hint variants tried, `close` + `side:left` was the best (crib only at the 16:9 and 1:1 edge). | kids-notes `camera`: `{"framing":"close","side":"left"}`. Then run `pnpm run story:bake -- brennan-hollin --stills <scratch dir>` and look at the Kids Room frames at all three aspects. If a crib edge still shows, move kids-photos to the lounge: `"anchor":{"role":"room","room":"living","nth":1,"fallback":[{"role":"couch"}]}` (and re-run validate). |
| MINOR | ftue-join | title "Join it from a phone"; body "At the Core, Sally joins its own network on her phone, then picks the home network." | The title is identical to `brennan-merrow`'s `ftue-join`, and the body is a near-copy of both siblings. The fleet gate exempts the ftue, so this does not fail, but the front page has one button for three tours. | title: "Sally's phone finds the Core". body: "Sally opens her phone's Wi-Fi settings and joins the network the Core opened. Then she picks the home network." |
| MINOR | ftue-pick | title "Pick your first agents and apps" | Near-identical to Merrow's "Pick the first agents and apps". | title: "Two agents and two apps to start" |
| MINOR | ftue-plug-in | "The Core wakes and opens its own Wi-Fi network." | The sentence is word-for-word Merrow's second sentence. | body: "John plugs it in, and Steve presses the button. The Core wakes and opens a Wi-Fi network of its own." |
| MINOR | study-code | "John wrote code in VS Code on one laptop" | Code Server is VS Code in a browser, per its listing, so VS Code held nothing and the "alternative to" is nominal. The beat's real argument is the dead laptop. Say that the editor is the same one. | body: "John's last laptop died with a side project's only copy on it. Code Server puts VS Code in a browser tab, and the files sit on the Core." |
| MINOR | office-follow | title "Follow-ups land in the client's record"; "Juniper adds three follow-ups ... not in a rented CRM." | The title and body say the entries land, but Juniper's limit is "Drafts only" and the steps say "Read every entry before it stands". Landing before Sally reads weakens the approval point. "Rented CRM" is the persona-apps.md phrase, not a `claims.json` one. "Hosted" says the same thing neutrally. | title: "Juniper drafts the client's follow-ups". body: "Juniper drafts three follow-ups in the client's record in Twenty, and Sally reads each one. The record sits on the Core, not in a hosted CRM." `detail.after`: "Juniper opens Twenty in its own browser and drafts the follow-ups from Sally's list. Sally reads each before it stands, and the record stays on the Core." |
| MINOR | study-quill | "issues on a rented code host" | Same wording note: "rented" is house voice from persona-apps.md, not `claims.json`. | body: "John's bug list once became issues on a hosted code service; now Quill files them in Forgejo on the Core. John fixes the second title before it stands." |
| MINOR | office-intake | "so client details do not pass through a connector service" | The n8n caveat in `claims.json` says many integrations call cloud services, so a workflow that calls one still reaches it. The sentence is from persona-apps.md and is narrowly true, but it reads as a data guarantee. Narrow it to the structural fact. The same beat makes John build the thing Sally asks for (see the people note below). | body: "The new-client checklist taped to Sally's writing desk is now one n8n workflow Sally built. No connector service sits between its steps, because it runs on the Core." step 1: "Sally builds the workflow once". Also change the cast text in John's bio to "...and Quill files the issues he lists." (drop "he builds the workflows and formulas Sally asks for"). |
| MINOR | back-tracker | "Ask John for the day-rate formula"; "with data on the vendor's servers" | (a) Second gendered hand-off: the consultant asks her husband for the technical part. (b) "With the data on the vendor's servers" is an unsourced statement of how Airtable works (`f-incumbent-claims`). It is harmless but not in `claims.json`. | `detail.before`: "Sally kept the tracker as a base in Airtable." step 2: "Write the day-rate formula in Python". Drop "John wrote" from the body as in the main fix above, replace with "a Python formula she wrote". |
| MINOR | lounge-poster | title "Jean designs the fair poster"; "so the design file lives at home" | "The fair" is unexplained to a stranger. "Lives at home" is the one generic closer in the file. The Figma before-line also states how Figma stores files. | title: "Jean designs the school fair poster". body: "Jean is on her third poster draft, made in Penpot at the glass lounge's nesting tables. The family hosts Penpot on the Core, so the poster file sits there." `detail.before`: "Jean's first posters were Figma files." |
| MINOR | office-desks | step "Price the fees in Calc" | "Price" on a site with a no-price rule; it is a verb here but reads oddly in a lint. | step 2: "Set the fees in Calc" |
| MINOR | kitchen-demo | "Steve finds a demo ... a file no streaming catalogue ever carried." | `detail.before` says the demo was a disc in a drawer and step 1 is "Rip the demo disc", so "finds ... a file" contradicts it. "No streaming catalogue ever" is a sweeping claim about all catalogues. | body: "Steve finds a demo disc from John's college band, music no streaming catalogue carried. Ripped, it plays through mStream in the kitchen, and John hears it from the Study." |
| MINOR | front-car | title "Steve logs the first oil check" | "First" clashes with `detail.before` ("service dates and fuel stops lived in Drivvo"). Father and son over a car is also the one stereotyped pairing in the file. | title: "Steve logs the oil check" |
| MINOR | outro-street | "behind the picket fence and the wisteria" | Wisteria is already in the tagline, `ftue-delivery`, the day lines and the Blockbench beat; the outro repeats it again. | body: "Client records, code, music and homework run on one Companion Core, in a cottage with two studies and a glass lounge." |
| MINOR | front-camera | "A neighbour's parcel turns up behind the hydrangea" | A second parcel moment, mirroring `ftue-delivery` (parcel on the porch under the wisteria). Same motif twice in 26 beats. | Keep the camera beat and cut the repeat in the opening: `ftue-delivery` body: "The courier leaves the box on the porch. Jean holds the front door, and John carries it past the living room to the Study." (title "A box on the porch") |

## Pointedness (first sentence of each beat)

"Generic" means the first sentence names nothing specific that the service held, learned, charged or changed, and nothing specific the family's own copy now does.

| Beat | First sentence | Specific? |
|---|---|---|
| ftue (6) | setup beats | n/a |
| study-code | John's last laptop died with a side project's only copy on it. | yes (pair nominal) |
| study-quill | John's bug list once became issues on a rented code host | yes |
| study-board | From the wisteria prune to the fence paint, John's pin-board of house jobs becomes one Planka board | yes (pair nominal) |
| office-desks | A proposal used to live on two machines at once, and Sally mailed herself the newer copy. | yes (pair nominal) |
| office-follow | Juniper adds three follow-ups to the client's record in Twenty | yes |
| office-intake | The new-client checklist taped to Sally's writing desk is now one n8n workflow | yes |
| office-renewals | A domain renewal nearly slips past Sally | yes |
| living-session | When Steve cancelled his cloud gaming plan, his library stayed put on his Valve account. | yes, strong |
| living-blocks | Steve builds a low-poly model of the wisteria porch, block by block. | **generic** (no argument) |
| lounge-poster | Jean is on her third poster draft | partly |
| kitchen-calendar | Yuvomi puts both studies' calls on one calendar, so the whole house can see when to keep quiet. | yes |
| kitchen-demo | Steve finds a demo from John's college band | yes, strong |
| dining-quiz | Jean types every question for the family quiz | **generic** (off-argument) |
| kids-notes | Three years of Jean's school notes leave a hosted notes app for Obsidian. | yes |
| kids-photos | The school portal rejects Jean's art-project photos as too large | yes |
| front-run | Every run of Sally's starts at her front door, so each route is a map of home. | yes, strong |
| front-camera | A neighbour's parcel turns up behind the hydrangea | yes |
| front-car | Steve checks the car's oil on the gravel drive | yes (pair nominal) |
| back-tracker | By the pool, Sally reviews the quarter in a Grist tracker | yes |

**Generic beats: 2 of 26** (living-blocks, dining-quiz). A further four pair beats name a service the story never uses: study-code, study-board, office-desks and front-car. Together with the two generic ones, that is 6 of 19 room beats where the pair is thin.

## Claims check (the writer's flagged lines)

- "a rented code host", "a rented CRM": from persona-apps.md, not `claims.json`. No `claims.json` rule bans it, but "hosted" is safer. MINOR.
- "do not pass through a connector service": narrowly true and sanctioned by persona-apps.md. It is narrowed above because of the n8n cloud-call caveat.
- Ring, GeForce Now, Airtable and Figma before-lines: they state the product's category (cloud camera, cloud gaming, hosted base, online workspace), not an allegation. Airtable and Figma are the only ones that read as an architecture claim, so those two are softened above. GeForce Now ("ran each of Steve's sessions on its own servers") is cloud gaming's definition. Leave it.
- Blockbench "on any laptop in the house": not supported. MAJOR above.
- Endurain "syncing out is optional": supported (the catalog caveat says "Optional sync with Strava and Garmin Connect. Bulk GPX and FIT upload is local"). "A GPX file uploads locally" is slightly narrower than "bulk", but fine.
- Steam Headless: the Valve account, the home network and no game title or frame rate all match the catalog caveats. "A plan ends, the library stays" is a family fact, not a claim about GeForce Now.
- `detail.fact` for every app is true to the catalog description. Obsidian, n8n and the Frigate camera caveats are respected: Obsidian and n8n are never called open source, and "Cameras are not part of the Core." is carried. The Wallos logo-fetch note and the code-server extension note are there.
- No speed, price, saving, uptime, compliance or security guarantee found. No "replaces", no attack on a service. Chips are all "alternative to ...". Nothing is shown as a recording.

## Variety and duplicate check

- Against `brennan` and `brennan-merrow`: no non-ftue title or body clashes (Jaccard on titles above 0.5 or bodies above 0.4: none outside the ftue). Three apps overlap, `code-server`, `steam-headless` and `yuvomi`, plus the GeForce Now pair in all three. These are the casting signature apps, and Hollin's angle on each is its own (a dead laptop, a cancelled plan, two studies' calls).
- Ftue duplicates: `ftue-join` title identical to Merrow's; `ftue-unbox` first sentence identical to Merrow's; `ftue-plug-in` second sentence identical to Merrow's; `ftue-pick` title near-identical to Merrow's. Listed as MINOR because `fleet-unique` exempts the ftue, one MAJOR (the Core definition) rewrites `ftue-unbox`.
- Moments differ in kind: a dead laptop, a bug triage, a recurring renewal, a cancelled plan, a found demo disc, a found parcel, a dated archive, a route that starts at the door. Good spread. Weak spots are the shape repeat above and four thin pairs.

## The house

Strong. The tour uses this house as a character: two studies, the pin-board that exists in the Study, the Study's curved monitor and Core desk, the Kitchen sharing a wall with the Study (the guitar through the wall is real geometry), the glass lounge's nesting tables, the gravel drive, the hydrangea beside the picket-fence end, the lap pool and brick patio. All nineteen room anchors resolve (checked with the in-memory bake): `front-camera` lands on the hydrangea shrub, `front-car` on the gravel drive, `back-tracker` on the patio, `lounge-poster` in the Sunroom Lounge. Casting is respected: Sally in the Front Study, John in the Study, Steve in the Living Room, Jean in the Kids Room. Sleeping is never told and no frame should show the Study toddler bed (no pose does, checked). The one exposure is the crib and rocking horse in the Kids Room (MAJOR above).

## People

Four distinct relationships to the software: Sally records and renewals, John builds and hosts, Steve plays and tinkers, Jean studies and designs. Two gendered hand-offs are noted above (Sally asks John for the workflow and the formula; father and son over the car), both MINOR and with a rewrite. Teens are not condescended to except in the quiz line. John's bio sentence "builds the workflows and formulas Sally asks for" should go.

## Marketing value

A stranger gets the shape (a small family-run computer, apps from a store, your things on it) but is never told what a Core is. The first-run chapter earns its place: it is the only part that shows plug-in, pair and walk away. The outro hands off cleanly to `https://ci.computer/core` with "See Companion Core".

## One change that would most raise the pull

Reorder the room chapters so the tour does not open on three developer beats. Today, after the unbox, a non-technical visitor goes straight into John's study for study-code, study-quill and study-board, which are the least human beats in the file. Put `living` first (the cancelled plan and the library that stayed is the strongest hook), then `kitchen` (the demo disc found), then `front-study`, with `study` mid-tour. No beat id or text changes.
