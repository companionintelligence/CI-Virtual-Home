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
];
