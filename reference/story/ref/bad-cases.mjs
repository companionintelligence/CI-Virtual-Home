// Negative cases for the reference validator: each mutates the exemplar and must produce the listed rule ids.
// story-validator turns these into test/fixtures/stories/bad-*.json and asserts the same ids.
import fs from 'node:fs';
import path from 'node:path';
import { validate } from './ref-validate.mjs';
const base = JSON.parse(fs.readFileSync(process.env.STORY_EXAMPLE || path.resolve(import.meta.dirname, '../example-family.json'), 'utf8'));
const clone = () => JSON.parse(JSON.stringify(base));
const beat = (s, id) => s.beats.find((b) => b.id === id);
export const CASES = [
  { name: 'bad-1-hype', expect: ['buzz-core', 'vocab-home-server', 'num-dollar', 'exclamation', 'dash-em-en'], mutate: (s) => { beat(s, 'living-photos').popup.body = 'Seamlessly manage your photos with our revolutionary home server — save $500 a year!'; } },
  { name: 'bad-2-absolute', expect: ['sec-never-leaves', 'fake-social-proof'], mutate: (s) => { beat(s, 'office-vault').popup.body = 'Our customer Mika says nothing ever leaves the house, so the family never worries again. Five stars.'; } },
  { name: 'bad-3-remote', expect: ['cap-remote-access'], mutate: (s) => { beat(s, 'office-calendar').popup.body = 'Open the Nextcloud calendar from anywhere in the world, even from a coffee shop on the road.'; } },
  { name: 'bad-4-autonomy', expect: ['cap-autonomy'], mutate: (s) => { beat(s, 'office-reply').popup.body = 'Odette books the supplier and pays the invoice automatically, so Mika never has to check anything today.'; } },
  { name: 'bad-5-unknown-app', expect: ['app-unknown'], mutate: (s) => { beat(s, 'office-paper').app.id = 'paperless-ngx'; } },
  { name: 'bad-6-invented-app-and-chip', expect: ['app-undeclared', 'chips'], mutate: (s) => { const b = beat(s, 'kitchen-wallos'); b.popup.body = 'Mika opens Wallos and Firefly III at the counter. They list every subscription the household still pays for.'; b.popup.chips = ['Wallos', 'replaces Netflix']; } },
  { name: 'bad-7-no-tv', expect: ['text-role'], mutate: (s) => { s.slug = 'eriksen-bautista'; s.house = 'familyhome'; s.family.household = 'young-family'; s.family.narrator = 'v-light-m'; } },
  { name: 'bad-8-agent-without-approval', expect: ['agent'], mutate: (s) => { delete beat(s, 'studio-lead').approval; } },
  { name: 'bad-9-ftue-leak', expect: ['ftue-claims'], mutate: (s) => { beat(s, 'ftue-join').popup.phone.rows = ['Join Companion-Setup', 'Type the pairing code', 'Sign up for an account']; } },
  { name: 'bad-10-too-long', expect: ['len-body', 'len-title', 'digits'], mutate: (s) => { const p = beat(s, 'living-lights').popup; p.title = 'Lights now dim at ten every single night'; p.body = 'At 10 the living-room lights dim on a Home Assistant schedule. It runs on the Core and reaches each one of the lights over the home Wi-Fi in the whole house.'; } },
];
let bad = 0;
for (const c of CASES) {
  const s = clone(); c.mutate(s);
  const r = validate(s);
  const ids = new Set([...r.errors, ...r.review].map((m) => m.split(' ')[0]));
  const miss = c.expect.filter((e) => !ids.has(e));
  console.log(`${miss.length ? 'MISS' : 'ok  '} ${c.name.padEnd(30)} got: ${[...ids].join(', ') || '(nothing)'}${miss.length ? '   missing: ' + miss.join(', ') : ''}`);
  if (miss.length) bad++;
}
process.exit(bad ? 1 : 0);
