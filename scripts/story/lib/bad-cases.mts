// Negative cases (and false-positive guards): each mutates the exemplar and says which rule ids must (or must not) fire.
// The first ten are ported from reference/story/ref/bad-cases.mjs; the rest cover rules the TypeScript port added and
// every false positive found while running it over writers' text. `scripts/story/make-bad-fixtures.mts` writes them to
// test/fixtures/stories/bad-*.json; scripts/test-stories.mts asserts the fixtures still equal exemplar + mutation, so a
// change to the exemplar cannot leave a fixture silently stale.
import type { Story } from '../../../assets/story/types.ts';

export interface BadCase {
  name: string;
  /** rule ids that must fire (error or review) */
  expect: string[];
  /** rule ids that must NOT fire: a false-positive guard */
  absent?: string[];
  mutate: (s: Story) => void;
}

const beat = (s: Story, id: string) => s.beats.find((b) => b.id === id)!;

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
];
