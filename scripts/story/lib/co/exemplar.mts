// A synthetic company story that passes every rule of validateCompany with no finding: the base the validator's tests mutate (each case is the exemplar plus one change,
// the way test/fixtures/stories/bad-* are the frozen exemplar plus one). It is NOT a story and says so in its notes: its words are plain on purpose, its company is made up to be
// a test, and nothing builds a page from it. The writers' real stories arrive with M1 (reference/office/office-contract-m0.md).
import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from '../context.mts';
import type { CompanyStory, CoBeat, CoAnchor, CoMember } from './types.mts';

interface Pair { app: string; service: string }
const J = (rel: string): any => JSON.parse(fs.readFileSync(path.join(ROOT, rel), 'utf8'));

/** a fresh copy every call, so a test may change it */
export function makeExemplar(): CompanyStory {
  const catalog = J('content/story/catalog-apps.json').apps as { id: string; name: string }[];
  const services = J('content/story/services.json').services as { id: string; name: string }[];
  const appName = (id: string): string => catalog.find((a) => a.id === id)!.name;
  const svcName = (id: string): string => services.find((s) => s.id === id)!.name;
  const at = (role: string, room: string, ...fallback: CoAnchor[]): CoAnchor => ({ role, room, fallback: [...fallback, { role: 'room', room }] });
  const beat = (id: string, chapter: string, category: string, member: string | undefined, anchor: CoAnchor, title: string, body: string, pair?: Pair | string, extra: Partial<CoBeat> = {}): CoBeat => {
    const app = typeof pair === 'string' ? pair : pair?.app;
    return {
      id, chapter, category, ...(member ? { member } : {}), anchor,
      ...(app ? { app: { id: app, replaces: typeof pair === 'object' ? [svcName(pair.service)] : [] } } : {}),
      ...(typeof pair === 'object' ? { service: pair.service } : {}),
      popup: { title, body, ...(app ? { chips: typeof pair === 'object' ? [appName(app), `alternative to ${svcName(pair.service)}`] : [appName(app)] } : {}) },
      ...extra,
    };
  };
  const members: CoMember[] = [
    { id: 'oriel', name: 'Oriel', function: 'engineering', title: 'Chief technology officer', colour: 'chart-1', ownsCore: true,
      profile: { bio: 'Oriel installs the apps and looks after the one Companion Core in the comms room. Oriel reads what the agent drafts and sends it.' },
      companion: { name: 'Rook', runtime: 'Hermes', job: 'Drafts the weekly note for the team from what Oriel pastes in.', personality: ['dry', 'careful', 'quick'], voice: 'v-light-m', memory: false, limits: 'Drafts only. Oriel sends every message.' } },
    { id: 'wren', name: 'Wren', function: 'owner', title: 'Founder and chief executive', colour: 'chart-2', ownsCore: false },
    { id: 'bram', name: 'Bram', function: 'finance', title: 'Practice manager', colour: 'chart-3', ownsCore: false },
    { id: 'isolde', name: 'Isolde', function: 'design', title: 'Product designer', colour: 'chart-4', ownsCore: false },
  ];
  const beats: CoBeat[] = [
    beat('ftue-delivery', 'day-one', 'setup', undefined, { role: 'front-door', room: 'entry' }, 'The Core arrives', 'A parcel arrives at the front door. Oriel carries it past the front desk to the comms room.'),
    beat('ftue-unbox', 'day-one', 'setup', undefined, at('core', 'server'), 'Unpacked', 'The Companion Core comes out of its packaging. It is about the size of a small router and sits on a shelf in the comms room.'),
    beat('ftue-plug-in', 'day-one', 'setup', 'oriel', at('core', 'server'), 'Plug it in', 'Oriel plugs in power and the network cable. The light on the front says the Core is waking up for its first run.'),
    beat('ftue-join', 'day-one', 'setup', 'oriel', at('core', 'server'), 'Pair it', 'Oriel pairs the Core with the company account on a phone. The Core then asks which agents and apps to start with.'),
    beat('ftue-pick', 'day-one', 'setup', 'oriel', at('core', 'server'), 'Pick the first apps', 'Oriel picks the first apps from the Companion Hub store. Installing apps uses the internet, and the rest runs on the Core.'),
    beat('ftue-hello', 'day-one', 'setup', 'oriel', at('core', 'server'), 'Rook says hello', 'The agent Rook says hello in the chat on the phone. Rook drafts, and Oriel reads every draft before anything is sent.', undefined, { agent: 'oriel', approval: 'oriel', say: { speaker: 'oriel', text: 'Hello, I am ready to draft when you are.' } }),
    beat('comms-vault', 'comms', 'it', 'oriel', at('server-rack', 'server', { role: 'core' }), 'One vault for logins', 'Oriel moves the shared logins into one vault on the Core. Each app keeps its own sign-ins, and the vault stays on the office network.', { app: 'vaultwarden', service: '1password' }),
    beat('comms-status', 'comms', 'it', 'oriel', at('server-rack', 'server', { role: 'core' }), 'A status page by the router', 'Oriel keeps a status page for the apps the team uses. It shows which of them answer, and Oriel reads it each morning.', 'uptime-kuma'),
    beat('floor-code', 'floor', 'engineering', 'oriel', at('workstation', 'workfloor'), 'The code moves in', 'The team keeps its repositories on the Core. Oriel points the build at the new address and the old one is retired.', { app: 'forgejo', service: 'github' }),
    beat('floor-leads', 'floor', 'customers', 'wren', at('workstation', 'workfloor'), 'Every lead in one list', 'Wren keeps the leads and contacts in one list on the Core. The list is the same one the whole team opens during the week.', { app: 'twenty', service: 'salesforce' }),
    beat('floor-screens', 'floor', 'design', 'isolde', at('workstation', 'workfloor'), 'The screens sit on the Core', 'Isolde draws the screens in a design app that runs on the Core. The files stay with the team and open in a browser.', { app: 'penpot', service: 'figma' }),
    beat('floor-board', 'floor', 'projects', 'oriel', at('workstation', 'workfloor'), 'The sprint board', 'Oriel runs the sprint board on the Core. Cards move from left to right and everyone reads the same board.', { app: 'planka', service: 'trello' }),
    beat('floor-chat', 'floor', 'communication', 'bram', at('workstation', 'workfloor'), 'The office channel', 'Bram sets up the office channel on the Core. Messages stay on the office network and the team finds them by one word.', { app: 'campfire', service: 'slack' }),
    beat('floor-drive', 'floor', 'documents', 'isolde', at('workstation', 'workfloor'), 'The shared drive moves in', 'Isolde moves the shared files into a drive on the Core. Folders keep their names and the team opens them from a browser.', { app: 'nextcloud', service: 'google-drive' }),
    beat('floor-flow', 'floor', 'engineering', 'oriel', at('workstation', 'workfloor'), 'A hand-off, built by hand', 'Oriel rebuilds one hand-off by hand in a workflow app on the Core. The idea of the old automation comes across and the details do not.', { app: 'n8n', service: 'zapier' }),
    beat('meet-list', 'meeting', 'money', 'wren', at('whiteboard', 'meeting'), 'Everything the company rents', 'Wren writes the rented tools on the whiteboard and lists them in one app. The list shows what renews and when.', 'wallos'),
    beat('meet-handbook', 'meeting', 'documents', 'wren', at('meeting-table', 'meeting'), 'Day one, one handbook', 'Wren writes the handbook in one place on the Core. A new starter opens it on the first morning and reads it at the table.', { app: 'docmost', service: 'notion' }),
    beat('meet-sketch', 'meeting', 'design', 'isolde', at('whiteboard', 'meeting'), 'The flow, sketched', 'Isolde sketches the flow on the wall screen in the meeting room. The team talks it through and Isolde exports a picture.', 'excalidraw'),
    beat('meet-sign', 'meeting', 'documents', 'bram', at('meeting-table', 'meeting'), 'Signed at the table', 'Bram and the client sign at the meeting table. Both signers are in the room and the signed file is kept with the job.', { app: 'docuseal', service: 'docusign' }),
    beat('kitchen-receipts', 'kitchen', 'documents', 'bram', at('counter', 'kitchen'), 'Receipts, searchable', 'Bram scans the receipts at the counter. The app finds a receipt by one word and the paper goes in a drawer.', 'paperless'),
    beat('kitchen-week', 'kitchen', 'projects', 'wren', at('counter', 'kitchen'), 'The week by the kettle', 'Wren plans the week by the kettle in the planner on the Core. The plan is one person\'s planner, not the team\'s.', 'ci-planning'),
    beat('kitchen-notes', 'kitchen', 'people', 'wren', at('counter', 'kitchen'), 'Her own notes, her own file', 'Wren keeps her own notes in a file of her own. The notes are hers and stay on the Core.', 'ci-memory'),
    beat('front-calendar', 'front', 'communication', 'bram', at('reception-desk', 'reception'), 'The front room, on a calendar', 'Bram keeps the front room on a calendar. Visitors and meetings land on the same page that the team reads.', { app: 'baikal', service: 'google-calendar' }),
    beat('front-post', 'front', 'documents', 'bram', at('reception-desk', 'reception'), 'The post, scanned at the desk', 'Bram scans the post at the front desk. The app reads each page and files it where the team looks for it.', 'paperless'),
    beat('front-visitors', 'front', 'people', 'wren', at('reception-desk', 'reception'), 'A sign-in sheet that stays', 'Wren keeps the visitors sheet at the front desk. It stays in the office and the team reads it on Monday.', 'planka'),
    beat('outro-close', 'your-turn', 'setup', undefined, { role: 'core', room: 'server' }, 'Your turn next', 'Your office has its own jobs to move. Pick one app, move one job onto the Core, and see what comes along.'),
  ];
  return {
    schema: 'company/v1', slug: 'fixture-works', house: 'office-fixture-loft', fictional: true,
    company: {
      name: 'Fixture Works', tagline: 'A made-up studio that exists to test the rules.', sector: 'Test studio for validators', size: 'startup', scope: 'company', headcount: 6, floor: 6,
      story: 'Fixture Works is made up to test the rules. Four people share one room, and they keep their files, hours and logins on one Companion Core in the comms room.',
      address: { line: '1 Fixture Row', place: 'Testbury' }, narrator: 'v-clear-f',
    },
    members,
    chapters: [
      { id: 'day-one', kind: 'ftue', title: 'Day one' },
      { id: 'comms', kind: 'room', room: 'server', title: 'The comms room' },
      { id: 'floor', kind: 'room', room: 'workfloor', title: 'The open office' },
      { id: 'meeting', kind: 'room', room: 'meeting', title: 'The meeting room' },
      { id: 'kitchen', kind: 'room', room: 'kitchen', title: 'The kitchenette' },
      { id: 'front', kind: 'room', room: 'reception', title: 'The front desk' },
      { id: 'your-turn', kind: 'outro', title: 'Your turn' },
    ],
    beats,
    closing: { body: 'Oriel and the team keep their working files on one Companion Core. Pick one job in your own office and move it first.', cta: { label: 'See Companion Core', url: 'https://ci.computer/core' } },
    notes: ['A synthetic exemplar for the validator tests (scripts/story/lib/co/exemplar.mts). Not a story; nothing builds a page from it.'],
  };
}
