// Negative cases (and false-positive guards): each mutates the exemplar (test/fixtures/stories/exemplar.json) and says which rule ids must (or must not) fire.
// The first ten are ported from reference/story/ref/bad-cases.mjs; the rest cover rules the TypeScript port added and
// every false positive found while running it over writers' text. `scripts/story/make-bad-fixtures.mts` writes them to
// test/fixtures/stories/bad-*.json; scripts/test-stories.mts asserts the fixtures still equal exemplar + mutation, so a
// change to the exemplar cannot leave a fixture silently stale.
import type { Story } from '../../../assets/story/types.ts';

export interface BadCase {
  name: string;
  /** rule ids that must fire (error or review) */
  expect: string[];
  /** rule ids that must fire as warnings (a case with only these still passes the gate) */
  warn?: string[];
  /** rule ids that must NOT fire: a false-positive guard */
  absent?: string[];
  /**
   * The file in test/fixtures/stories that the mutation starts from. Default: exemplar.json (a family written before story v3). The story v3 cases start
   * from V3_BASE, a whole family that passes every rule, so each of them breaks one thing in a v3 family and the rest stays valid.
   */
  base?: string;
  /** rules of the story v3 phase-in that a clean case ignores (errors as well as warnings): a false-positive guard for one family of rules, not for the others */
  tolerate?: string[];
  mutate: (s: Story) => void;
}

const beat = (s: Story, id: string) => s.beats.find((b) => b.id === id)!;
const member = (s: Story, id: string) => s.members.find((m) => m.id === id)!;

/**
 * The exemplar told as a persona family: Mika is the organiser (her office beats: Paperless-ngx, VaultWarden, Nextcloud) and
 * Elias is the maker (a photographer: Immich on the couch, the studio desk). Nextcloud's chip row gains "replaces Google Drive"
 * so every persona beat that replaces something says what. It passes every rule with nothing to report; the persona cases
 * below each break one thing in it.
 */
const persona = (s: Story): void => {
  member(s, 'mika').archetype = 'organiser';
  member(s, 'elias').archetype = 'maker';
  const b = beat(s, 'office-calendar');
  b.app!.replaces = ['Google Drive'];
  b.popup.chips = ['Nextcloud', 'replaces Google Drive'];
};

/**
 * The exemplar with every story v2 field, all valid (reference/story/story-v2.md): a detail on two beats (Immich and Paperless-ngx), a house
 * lede with three spots, a day of five entries that shows both members, and a profile for each. No archetypes, so `detail-missing` stays quiet.
 * It passes every rule with nothing to report; the v2 cases below each break one thing in it.
 */
const v2 = (s: Story): void => {
  beat(s, 'living-photos').detail = {
    before: 'Weekend photos went to Google Photos and sat in a company cloud, searched by that company.',
    after: 'Immich backs them up to the Core, where Elias searches them by what is in the picture.',
    steps: ['Open Immich on the phone', 'Start the backup', 'Search by one word'],
    fact: 'Immich backs up, organises and searches your family photos and videos on your own Core.',
  };
  beat(s, 'office-paper').detail = {
    before: 'Receipts sat in a shoebox, then as photos in Evernote.',
    after: 'Paperless-ngx reads each page on the Core, tags it and files it, so Mika finds an invoice by one word.',
    steps: ['Scan the stack', 'Check the tags', 'Search by one word'],
    fact: 'Paperless-ngx reads every page, tags it and makes the whole archive searchable.',
  };
  s.family.home = {
    lede: 'A white house of three storeys by the canal, with a covered patio and a pool at the back. Studios on the ground and first floors share one Companion Core.',
    spots: [
      { room: 'Study', line: 'Two desks, a shelf and the Core on the desk by the window.' },
      { room: 'Living', line: 'A sofa, a television and Friday film night.' },
      { room: 'Covered Patio', line: 'Loungers by the pool, with music across the water.' },
    ],
  };
  s.family.day = [
    { at: 'morning', beat: 'office-paper', line: 'Mika files the invoices before her first call.' },
    { at: 'morning', beat: 'studio-edit', line: 'Elias lays out the album at the desk.' },
    { at: 'midday', beat: 'kitchen-list', line: 'Lunch, and the shopping list gets one more item.' },
    { at: 'afternoon', beat: 'living-photos', line: 'Elias backs up the weekend photos from the couch.' },
    { at: 'weekend', beat: 'garden-music', line: 'Music by the pool on Saturday.' },
  ];
  member(s, 'elias').profile = { bio: 'Elias photographs portraits and runs his studio from the house. His client albums and his photo library sit on the Core.' };
  member(s, 'mika').profile = { bio: 'Mika is an operations consultant. Her invoices, her passwords and the shared calendar all live on the Core.' };
};

/**
 * The exemplar told as a v3 family: one beat carries a `service` key, so the v3 rules (age-chat, age-companion, app-avoid) are errors, not warnings
 * (scripts/story/lib/v3.mts isV3Story). The registry rules come with the registry; here the key only phases the age rules in at full severity.
 */
const v3 = (s: Story): void => { beat(s, 'living-photos').service = 'google-photos'; };

/** A nine-year-old (the casting of the test world does not list him: the `casting` rule fires too, which the age cases do not care about). */
const otto = (s: Story): void => { s.members.push({ id: 'otto', name: 'Otto', age: 9, role: 'child', colour: 'chart-3' }); };

/**
 * Fixtures in test/fixtures/stories that are NOT exemplar + a mutation and that make-bad-fixtures.mts must leave alone.
 * ok-6-story-v2.json is the Brennan family (content/families/brennan.json, validated against the test world's copy of its house) with every
 * story v2 field present and valid: the sample the family page, the front page and the persona map are built against.
 */
export const STANDALONE = ['ok-6-story-v2.json', 'ok-9-story-v3.json'] as const;
/**
 * ok-9-story-v3.json is the Brennan family (the flagship cast of the test world) told in the story v3 shape: sixteen pair beats name a service of
 * content/story/services.json with the chip "alternative to <Service>", the four pair-less beats are two Hermes drafts, JupyterLab and HortusFox, every
 * member is inside the persona band, nobody under 16 uses a chat model, and no rule reports anything (one beat is allow-listed in reviewed.json, as in ok-6).
 * It is written by hand, not by a mutation; the story v3 cases below start from it.
 */
export const V3_BASE = 'ok-9-story-v3.json';

export const CASES: BadCase[] = [
  // ---- ported from the reference validator
  { name: 'bad-1-hype', expect: ['buzz-core', 'vocab-home-server', 'num-dollar', 'exclamation', 'dash-em-en'], mutate: (s) => { beat(s, 'living-photos').popup.body = 'Seamlessly manage your photos with our revolutionary home server — save $500 a year!'; } },
  { name: 'bad-2-absolute', expect: ['sec-never-leaves', 'fake-social-proof'], mutate: (s) => { beat(s, 'office-vault').popup.body = 'Our customer Mika says nothing ever leaves the house, so the family never worries again. Five stars.'; } },
  { name: 'bad-3-remote', expect: ['cap-remote-access'], mutate: (s) => { beat(s, 'office-calendar').popup.body = 'Open the Nextcloud calendar from anywhere in the world, even from a coffee shop on the road.'; } },
  { name: 'bad-4-autonomy', expect: ['cap-autonomy'], mutate: (s) => { beat(s, 'office-reply').popup.body = 'Odette books the supplier and pays the invoice automatically, so Mika never has to check anything today.'; } },
  { name: 'bad-5-unknown-app', expect: ['app-unknown'], mutate: (s) => { beat(s, 'office-paper').app!.id = 'paperless-ngx'; } },
  { name: 'bad-6-invented-app-and-chip', expect: ['app-undeclared', 'chips'], mutate: (s) => { const b = beat(s, 'kitchen-wallos'); b.popup.body = 'Mika opens Wallos and Firefly III at the counter. They list every subscription the household still pays for.'; b.popup.chips = ['Wallos', 'replaces Netflix']; } },
  { name: 'bad-7-no-tv', expect: ['text-role'], mutate: (s) => { s.slug = 'eriksen-bautista'; s.house = 'familyhome'; s.family.household = 'young-family'; s.family.narrator = 'v-light-m'; } },
  { name: 'bad-8-agent-without-approval', expect: ['agent'], mutate: (s) => { delete beat(s, 'studio-lead').approval; } },
  { name: 'bad-9-ftue-leak', expect: ['ftue-claims'], mutate: (s) => { beat(s, 'ftue-join').popup.phone!.rows = ['Join Companion-Setup', 'Type the pairing code', 'Sign up for an account']; } },
  { name: 'bad-10-too-long', expect: ['len-body', 'len-title', 'digits'], mutate: (s) => { const p = beat(s, 'living-lights').popup; p.title = 'Lights now dim at ten every single night'; p.body = 'At 10 the living-room lights dim on a Home Assistant schedule. It runs on the Core and reaches each one of the lights over the home Wi-Fi in the whole house.'; } },

  // ---- rules the TypeScript port added
  { name: 'bad-11-anchor', expect: ['anchor'], mutate: (s) => { beat(s, 'living-lights').anchor = { role: 'fireplace' }; } },
  { name: 'bad-12-not-in-store', expect: ['app-not-in-store'], mutate: (s) => { beat(s, 'kitchen-wallos').popup.body = 'Mika opens Actual Budget at the counter. It lists every subscription the household still pays for.'; } },
  { name: 'bad-13-disclosure', expect: ['disclosure'], mutate: (s) => { delete beat(s, 'ftue-plug-in').popup.note; } },
  { name: 'bad-14-voices', expect: ['voices'], mutate: (s) => { s.members[1].companion!.voice = s.family.narrator; } },
  { name: 'bad-15-memory-beta', expect: ['disclosure'], mutate: (s) => {
    // the first mention is in ftue-pick (its body and its phone rows); take the tag off wherever it stands
    for (const b of s.beats) {
      b.popup.body = b.popup.body.replace('Companion Memory (beta)', 'Companion Memory');
      if (b.popup.phone) b.popup.phone.rows = b.popup.phone.rows.map((r) => r.replace('Companion Memory (beta)', 'Companion Memory'));
    }
  } },
  { name: 'bad-16-film', expect: ['film'], mutate: (s) => { for (const b of s.beats) if (b.film && b.chapter !== 'ftue') delete b.film; } },
  { name: 'bad-17-agent-app', expect: ['agent-app'], mutate: (s) => { const b = beat(s, 'office-paper'); b.agent = 'mika'; b.approval = 'mika'; } },
  { name: 'bad-18-no-screenshot', expect: ['app-qa-screenshot'], mutate: (s) => { const b = beat(s, 'kitchen-recipe'); b.app = { id: 'mealie', replaces: [] }; b.popup.chips = ['Mealie']; b.popup.title = 'Grandma\'s soup, kept'; b.popup.body = 'Elias types his grandmother\'s soup recipe into Mealie once. Now it sits in the family recipe book, beside the meal planner.'; b.capability = 'import recipes and plan meals'; } },
  { name: 'bad-19-bare-paperless', expect: ['app-name'], mutate: (s) => { beat(s, 'office-paper').popup.body = 'Mika scans a supplier invoice. Paperless reads every page, tags it and files it, so a search finds it later.'; } },
  { name: 'bad-20-schema', expect: ['schema'], mutate: (s) => { delete (s as any).closing; } },
  { name: 'bad-21-sign-off-typed', expect: ['closing'], mutate: (s) => { s.closing.body += ' UnCloud your life.'; } },
  { name: 'bad-22-first-hermes-note', expect: ['disclosure'], mutate: (s) => { delete beat(s, 'ftue-hello').popup.note; } },

  // ---- false positives found and guarded
  // "nursery" is also where a grower's plants live; the crib/nursery text-role must not fire for plants
  { name: 'ok-1-plant-nursery', expect: [], absent: ['text-role'], mutate: (s) => { beat(s, 'garden-plants').popup.body = 'Mika logs the new seedlings from the plant nursery in HortusFox. She notes where each one grows and adds a photo for the journal.'; } },
  // an island in a lake is not a kitchen island
  { name: 'ok-2-lake-island', expect: [], absent: ['text-role'], mutate: (s) => { beat(s, 'garden-music').popup.body = 'Elias plays his own music collection from Navidrome on the patio. The sound carries across the water to the island.'; } },

  // ---- the persona model (reference/story/personas.md)
  // a persona family passes every rule, and a family with no archetypes is not held to the persona rules at all
  { name: 'ok-3-persona-family', expect: [], absent: ['persona-cover', 'persona-spread', 'persona-replaces', 'persona-no-ui'], mutate: (s) => { persona(s); } },
  // an organiser with no beat in the office (the house has one, so the fallback rooms do not count)
  { name: 'bad-23-persona-cover-room', expect: ['persona-cover'], mutate: (s) => { persona(s); for (const b of s.beats) if (b.member === 'mika' && b.chapter === 'office') b.anchor = { ...b.anchor, room: 'kitchen' }; } },
  // a builder whose beats use no code or local-model app
  { name: 'bad-24-persona-cover-apps', expect: ['persona-cover'], mutate: (s) => { persona(s); member(s, 'mika').archetype = 'builder'; } },
  // two organisers are one archetype
  { name: 'bad-25-persona-spread', expect: ['persona-spread'], mutate: (s) => { persona(s); member(s, 'elias').archetype = 'organiser'; } },
  // the uncloud argument is missing: Nextcloud replaces Google Drive and the chips do not say so
  { name: 'bad-26-persona-replaces', warn: ['persona-replaces'], expect: [], mutate: (s) => { persona(s); const b = beat(s, 'office-calendar'); b.app!.replaces = []; b.popup.chips = ['Nextcloud']; } },
  // ADS.md: the story is told, not shown as an app screen
  { name: 'bad-27-persona-no-ui', expect: ['persona-no-ui'], mutate: (s) => { persona(s); beat(s, 'living-tv').popup.body = 'On the screen she sees the Jellyfin interface, and its dashboard lists every film in Mika\'s own collection.'; } },
  // the gaming claims the ad rules and the Steam Headless caveats rule out; "zero latency" is num-tokens' catch, "lag-free" is cap-lag-free
  { name: 'bad-28-gaming-claims', expect: ['num-fps', 'cap-gaming', 'cap-lag-free', 'num-tokens'], mutate: (s) => { beat(s, 'living-tv').popup.body = 'Elias streams a game at sixty fps from a gaming PC with no Steam account. It plays anywhere, lag-free, with zero latency.'; } },
  // a named cloud-gaming service as the target of a factual attack: incumbent-attack (extended), not a second rule
  { name: 'bad-29-cloud-gaming-attack', expect: ['incumbent-attack'], mutate: (s) => { beat(s, 'living-tv').popup.body = 'GeForce Now spies on every game the family plays, so Elias streams from the Core instead.'; } },
  // parity with a hosted model, said the other way round: cap-parity (extended)
  { name: 'bad-30-chatgpt-level', expect: ['cap-parity'], mutate: (s) => { beat(s, 'studio-edit').popup.body = 'Marlo is ChatGPT-level and as smart as any cloud agent. Elias asks it about every album spread.'; } },
  // offline for a coding or study agent, and the code that never leaves: sec-offline and sec-never-leaves (both extended)
  { name: 'bad-31-offline-study', expect: ['sec-offline', 'sec-never-leaves'], mutate: (s) => { beat(s, 'studio-edit').popup.body = 'Elias studies offline with Marlo, and his layout notes do not leave the Core. His code never leaves the house.'; } },
  // false-positive guard: playing a game on the Core and streaming it inside the house is the allowed sentence
  { name: 'ok-4-streamed-game', expect: [], absent: ['num-fps', 'cap-gaming', 'cap-lag-free', 'cap-remote-access', 'sec-offline', 'incumbent-attack'], mutate: (s) => { beat(s, 'living-tv').popup.body = 'Elias plays a game from his own Steam library. It runs on the Core and streams to the living-room TV over the home network.'; } },
  // false-positive guard: an archive app that keeps "a screenshot and a PDF of the page" is a feature, not a description of an app screen
  { name: 'ok-5-archived-screenshot', expect: [], absent: ['persona-no-ui'], mutate: (s) => { persona(s); beat(s, 'office-paper').popup.body = 'Mika saves a supplier page, with a screenshot and a PDF of it. Paperless-ngx files both, so a search finds them later.'; } },
  // ---- the cast plan (content/story/cast-plan.json): a family file tells the people the casting names, no others
  { name: 'bad-32-casting-member-name', expect: ['casting'], mutate: (s) => { member(s, 'mika').name = 'Mina'; } },
  { name: 'bad-33-casting-extra-member', expect: ['casting'], mutate: (s) => { s.members.push({ id: 'otto', name: 'Otto', age: 9, role: 'child', colour: 'chart-3' }); } },
  // ---- story v2 (reference/story/story-v2.md): beat.detail, family.home, family.day, member.profile. All optional; each rule has a case.
  // a family with every v2 field, all valid: the guard that none of the v2 rules fires on good text
  { name: 'ok-7-story-v2', expect: [], absent: ['detail-len', 'detail-replaces', 'detail-fact', 'detail-missing', 'home-lede', 'home-spots', 'day', 'profile', 'digits', 'text-role'], mutate: (s) => { v2(s); } },
  // detail-len: a before over 28 words, a step over 12 words, and an after over 28
  { name: 'bad-34-detail-len', expect: ['detail-len'], mutate: (s) => { v2(s); const d = beat(s, 'living-photos').detail!;
    d.before = 'Weekend photos went to Google Photos and sat in a company cloud, where they were kept in a long list and shown back to Elias one small square at a time every day.';
    d.steps[1] = 'Start the backup from the phone while the kettle boils and the family gets ready for the long walk';
    d.after = d.after + ' Nothing else changes about how he works, and the whole archive is ready to search the moment the first upload is done.'; } },
  // detail-copy: the new strings are read like any other copy (dash, exclamation, price, digits, a security absolute, the persona-no-ui and app rules are separate cases)
  { name: 'bad-35-detail-copy', expect: ['dash-em-en', 'exclamation', 'num-dollar', 'digits', 'sec-never-leaves'], mutate: (s) => { v2(s); const d = beat(s, 'living-photos').detail!;
    d.before = 'Weekend photos went to Google Photos \u2014 and sat in a company cloud.';
    d.after = 'Immich backs them up to the Core and saves $500 a year!';
    d.steps[2] = 'Search 3 photos by one word';
    d.fact = 'Immich backs up, organises and searches your family photos, and nothing ever leaves the Core.'; } },
  // detail-replaces: a before that names Dropbox, which Immich does not replace; the argument must not attack a company the chip does not name
  { name: 'bad-36-detail-replaces', expect: ['detail-replaces'], mutate: (s) => { v2(s); beat(s, 'living-photos').detail!.before = 'Weekend photos went to Dropbox and sat in a company cloud, searched by that company.'; } },
  // false-positive guard: a name the catalog entry replaces (iCloud Photos) or the beat's own (Google Photos), a bare "Google" beside Google Photos, and ordinary words that are service names
  { name: 'ok-8-detail-services-allowed', expect: [], absent: ['detail-replaces'], mutate: (s) => { v2(s); beat(s, 'living-photos').detail!.before = 'Weekend photos went to Google Photos or iCloud Photos. Google kept them in a cloud. Make room for a mint tin and the ring box.'; } },
  // detail-fact: a fact that shares no word with the catalog description is a warning
  { name: 'bad-37-detail-fact', warn: ['detail-fact'], expect: [], mutate: (s) => { v2(s); beat(s, 'living-photos').detail!.fact = 'Elias enjoys tidy cupboards, quiet mornings and warm bread.'; } },
  // detail-missing: once a story has details, a persona beat without one is a warning
  { name: 'bad-38-detail-missing', warn: ['detail-missing'], expect: [], mutate: (s) => { persona(s); v2(s); } },
  // a detail names a Hub app its beat does not declare, and describes an app screen
  { name: 'bad-39-detail-apps-and-ui', expect: ['app-undeclared', 'persona-no-ui'], mutate: (s) => { persona(s); v2(s); const d = beat(s, 'living-photos').detail!; d.after = 'Immich backs them up to the Core, and Wallos lists every subscription beside them.'; d.steps[0] = 'On the screen she sees the dashboard lists every photo'; } },
  // home-lede: over 50 words with a sentence over 22 words, and the house id named
  { name: 'bad-40-home-lede', expect: ['home-lede'], mutate: (s) => { v2(s); s.family.home!.lede = 'A white house of three storeys stands by the canal with a covered patio and a pool and a long garden that runs down to the water behind the aurora house. Studios on the ground and first floors share one Companion Core, and the family keeps their photos, their invoices, their passwords, their music and their calendars there for the whole year.'; } },
  // home-lede: text-role applies, a fireplace the house does not have
  { name: 'bad-41-home-lede-furniture', expect: ['text-role'], mutate: (s) => { v2(s); s.family.home!.lede = 'A white house of three storeys by the canal, with a fireplace in the living room. Studios on the ground and first floors share one Companion Core.'; } },
  // home-spots: a room the house does not have, a line over 16 words, a room named twice
  { name: 'bad-42-home-spots', expect: ['home-spots'], mutate: (s) => { v2(s); const sp = s.family.home!.spots;
    sp[0].room = 'Ballroom'; sp[1].line = 'A sofa, a television, a row of lamps, a tall shelf of films and a long low table for Friday film night with the whole family.'; sp[2].room = 'Living'; } },
  // day: a beat id that is not in the story, an entry out of time order, a line over 14 words, a line that repeats the beat's own title
  { name: 'bad-43-day', expect: ['day'], mutate: (s) => { v2(s); const d = s.family.day!;
    d[1].beat = 'office-ghost'; d[3].at = 'morning'; d[2].line = 'Lunch happens, and then the shopping list for the whole week gets one more item added to it.'; d[4].line = beat(s, 'garden-music').popup.title + '.'; } },
  // day: an adult missing from the day is a warning
  { name: 'bad-44-day-member', warn: ['day'], expect: [], mutate: (s) => { v2(s); for (const d of s.family.day!) if (d.beat === 'studio-edit' || d.beat === 'living-photos' || d.beat === 'garden-music') d.beat = d.beat === 'studio-edit' ? 'office-calendar' : d.beat === 'living-photos' ? 'kitchen-wallos' : 'office-reply'; } },
  // profile: over 45 words
  { name: 'bad-45-profile', expect: ['profile'], mutate: (s) => { v2(s); member(s, 'mika').profile!.bio = 'Mika is an operations consultant who works from the house on the canal and keeps her invoices, her passwords, the shared calendar, the family recipes, the garden notes and every one of the supplier contracts on the Core, and she reads each draft her agent writes before it goes anywhere.'; } },
  // ---- story v3, age rule 16 (v3-decisions.md "Age rule"; scripts/story/lib/v3.mts). Errors in a v3 family (a beat has a `service`), warnings in every other
  // age-chat: a nine-year-old is the actor of a beat whose app is a chat model (Open WebUI is tagged ai: chat in the catalog)
  { name: 'bad-46-age-chat', expect: ['age-chat'], mutate: (s) => { v3(s); otto(s); const b = beat(s, 'garden-plants'); b.member = 'otto'; b.app = { id: 'open-webui', replaces: ['ChatGPT'] }; b.popup.chips = ['Open WebUI', 'replaces ChatGPT'];
    b.popup.title = 'Homework questions at the table'; b.popup.body = 'Otto asks his homework questions of a model on the Core in Open WebUI. Mika sits beside him and reads each answer with him.'; } },
  // age-companion: a companion needs a member of 16 or older; Elias is 15 here (his agent beat trips age-chat too: the agent's owner is under 16)
  { name: 'bad-47-age-companion', expect: ['age-companion'], mutate: (s) => { v3(s); member(s, 'elias').age = 15; } },
  // false-positive guard: a v3 family whose members are all adults trips neither age rule, and the exemplar's agent beats (both adults) stay clean
  { name: 'ok-9-v3-adults', expect: [], absent: ['age-chat', 'age-companion', 'app-avoid'], tolerate: ['service-missing', 'chips', 'chips-legacy', 'household-beats', 'household-doer', 'persona-band', 'pair-share', 'pair-budget'], mutate: (s) => { v3(s); } },
  // ---- story v3, the registry and the v3 rules (reference/story/story-v3.md). Each of these starts from V3_BASE (ok-9-story-v3.json), a whole valid v3 family
  // service-unknown: a service that is not an id of content/story/services.json
  { name: 'bad-48-service-unknown', base: V3_BASE, expect: ['service-unknown'], mutate: (s) => { beat(s, 'office-paper').service = 'evernotes'; } },
  // service-app: the beat's app is not the alternative to that service (app.replaces[0] is Evernote, the service is Google Drive)
  { name: 'bad-49-service-app', base: V3_BASE, expect: ['service-app'], mutate: (s) => { beat(s, 'office-paper').service = 'google-drive'; } },
  // service-status: Pocket is flagged stale in the registry; Linkwarden does replace Pocket in the catalog, so only the status is wrong
  { name: 'bad-50-service-stale', base: V3_BASE, expect: ['service-status'], absent: ['service-app'], mutate: (s) => { const b = beat(s, 'jean-lookup'); b.service = 'pocket'; b.app!.replaces = ['Pocket']; b.popup.chips = ['Linkwarden', 'alternative to Pocket']; b.detail!.before = 'Sources for an essay were saved as bookmarks in Pocket, and the page itself stayed out on the web.'; } },
  // service-status: Tailscale's "alternative to" form is blocked by the claims rules (cap-remote-access); the beat's app does not replace it either, which is also reported
  { name: 'bad-51-service-blocked', base: V3_BASE, expect: ['service-status'], mutate: (s) => { const b = beat(s, 'living-film'); b.service = 'tailscale'; b.app!.replaces = ['Tailscale']; b.popup.chips = ['Jellyfin', 'alternative to Tailscale']; } },
  // service-missing: app.replaces names a service and the beat has no `service` (the second chip then has nothing to name: chips says so too)
  { name: 'bad-52-service-missing', base: V3_BASE, expect: ['service-missing', 'chips'], mutate: (s) => { delete beat(s, 'office-paper').service; } },
  // service-missing, the other way: a `service` on a beat whose app.replaces is empty
  { name: 'bad-53-service-no-replaces', base: V3_BASE, expect: ['service-missing'], mutate: (s) => { beat(s, 'garden-beds').service = 'google-photos'; } },
  // chips: the second chip must read "alternative to <Service>" with the beat's service, and a pair beat has exactly two chips
  { name: 'bad-54-chips-alternative', base: V3_BASE, expect: ['chips'], mutate: (s) => { beat(s, 'office-paper').popup.chips = ['Paperless-ngx', 'alternative to Google Drive']; beat(s, 'living-film').popup.chips = ['Jellyfin', 'alternative to Plex', 'alternative to Netflix']; } },
  // chips-legacy: the pass 1 chip "replaces <X>" in a family that is not v3 is a warning (an error in a v3 family); the exemplar uses it on eleven beats
  { name: 'bad-55-chips-legacy', warn: ['chips-legacy', 'service-missing'], expect: [], mutate: () => {} },
  // persona-band: Jean has three beats and a teen in a family of four has four to seven
  { name: 'bad-56-persona-band', base: V3_BASE, expect: ['persona-band'], mutate: (s) => { beat(s, 'jean-notes').member = 'steve'; beat(s, 'garden-beds').member = 'steve'; } },
  // household-beats: seven room beats without a member (at most six)
  { name: 'bad-57-household-beats', base: V3_BASE, expect: ['household-beats'], mutate: (s) => { for (const id of ['office-plan', 'office-paper', 'office-pdf', 'kitchen-list', 'kitchen-rota', 'living-film', 'living-scene']) delete beat(s, id).member; } },
  // household-kind: two household beats about one kind of app (two lists) are a warning
  { name: 'bad-58-household-kind', warn: ['household-kind'], expect: [], mutate: (s) => { delete beat(s, 'kitchen-list').member; delete beat(s, 'kitchen-recipe').member; } },
  // household-doer: a beat without a member whose body has a member as its subject (Sally checks the pantry)
  { name: 'bad-59-household-doer', base: V3_BASE, expect: ['household-doer'], mutate: (s) => { delete beat(s, 'kitchen-list').member; } },
  // pair-share and pair-budget: two pair beats lose their service and their alternative chip (seventy percent of the room beats are pairs; at least eighty, at most twenty percent pair-less)
  { name: 'bad-60-pair-share', base: V3_BASE, expect: ['pair-share', 'pair-budget'], absent: ['service-missing'], mutate: (s) => { for (const id of ['office-paper', 'living-film']) { const b = beat(s, id); delete b.service; b.app!.replaces = []; b.popup.chips = [b.popup.chips![0]]; } } },
  // detail-replaces (changed): in a pair beat a before or after may name only the beat's service; Paperless-ngx also replaces Google Drive in the catalog, which pass 2 would allow
  { name: 'bad-61-detail-service', base: V3_BASE, expect: ['detail-replaces'], mutate: (s) => { beat(s, 'office-paper').detail!.before = 'Receipts sat in a shoebox, then as photos in Evernote and as files in Google Drive.'; } },
];
