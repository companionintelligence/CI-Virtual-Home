// The CI-Docs source of the app media: what was looked at in `public/screenshots/` of the Docs repo, what ships and what does not (and why).
//
// CI-Docs holds real captures of our own products with sample data (Companion Memory, Planning, Hub, Atlas, Asks ...), taken for the documentation.
// They are the first-party apps' screens: the Marketplace's QA run only captures an app's first-run page. Rules, all from reference/story/story-v2.md
// "App media": a capture ships only if it was looked at and passed (no real person's name, no email, no token or key, no localhost or internal host or
// device id, no error page, no price, no claim the site does not make, no third-party brand logo, sample data only); the choice is data, below, and a
// git blob id for each one that ships (a changed source stops the build until someone looks again). Every other file of the folder is accounted for by a
// rule below with its reason (the manifest's `rejected` list), and a file that no rule names stops the build: a new capture at a moved pin is looked at
// before it is used or left out.
//
// Looked at on 2026-10 at CI-Docs 6773705a5754 (every light capture on a contact sheet, each one that ships at full size).
// Pure data and one function: no sibling repo is needed to import it.

/** First-party apps: the capture that ships for each (an app has one screenshot slot). `shows` completes the alt text "<Name> <shows> in a browser". */
export const DOCS_SHOTS: Record<string, { path: string; oid: string; shows: string }> = {
  'ci-memory': { path: 'public/screenshots/memory-2026-10/explorer-gallery-light.webp', oid: '26168ba4f6c4', shows: 'file gallery with sample pictures' },
  'ci-planning': { path: 'public/screenshots/planning/planning-today-light.webp', oid: '00e08a53544e', shows: 'Today view with a sample day' },
};

/** The QA run's capture of an app that a CI-Docs capture replaced, and why (an app with no entry here keeps its own REJECT_SHOT reason). */
export const SUPERSEDED_QA: Record<string, string> = {
  'ci-planning': 'Replaced by the CI-Docs capture of the current interface: this QA capture is the empty Today view of an older, dark interface ("a clear day", no tasks), which shows little of what the app does.',
};

/** Candidates for an app that has no slot left: the manifest records them under the app's id (`kind: shot`), so an app without a screenshot says why. */
export const DOCS_APP_REJECT: Record<string, { path: string; reason: string }> = {
  'ci-hermes': {
    path: 'public/screenshots/hermes/hermes-terminal-dashboard.webp',
    reason: 'A dark setup page that names Telegram, Discord and WhatsApp (outside services the site does not claim the app uses), a "Hermex for iOS" link and the old "CI marketplace" product name, above an empty terminal, with an illustrated woman\'s face as its mark: not usable, and it shows little of the app.',
  },
  'ci-openclaw': {
    path: 'public/screenshots/openclaw/openclaw-setup.webp',
    reason: 'A dark setup page that says "Your personal AI assistant" (a banned phrase), asks for an AI provider API key (a cloud model) and names Telegram, with iOS and Android links, above an empty terminal: not usable.',
  },
};

const PORTAL_PRICE = 'shows prices or plan names (Free, Pro, $9.00 a month) or a billing state, which the site never prints';
const EMAIL = 'an example email address';

/**
 * Why every other file is left out, by path under `public/screenshots/` (the first rule that matches wins). A dark twin of a light capture has its own
 * rule below and is not listed here. Written from what each capture showed; the groups say what the whole folder showed.
 */
const RULES: [RegExp, string][] = [
  // ---- not stills
  [/\.svg$/, 'A drawn banner or diagram (an SVG), not a capture of a running app.'],
  [/\.gif$/, 'An animated capture (a GIF), not a still: the page shows one real still at a time, whole and labelled.'],
  [/\.mp4$/, 'A video, not a still capture.'],
  // ---- Companion Memory
  [/^companion-memory\/companion-memory-arch\./, 'A drawn architecture diagram of boxes, with a row of third-party brand logos (Google, Microsoft, Amazon), not a capture.'],
  [/^companion-memory\/graphiql/, 'GraphiQL, a developer tool, with an empty API key field: not the app.'],
  [/^companion-memory\/companion-memory-knowledge-graph/, 'Clean (a dot graph of sample data, no text and no names), not chosen: an app has one screenshot slot, and the file gallery shows more of the product.'],
  [/^companion-memory\/companion-memory-main/, 'Clean (a list of sample events), not chosen: an app has one screenshot slot, the file gallery was chosen, and the list reads small at 960 px.'],
  [/^memory-2026-10\/chat-conversation/, 'Clean but not chosen: an app has one screenshot slot, and the chat shows a thread id and a model name ("docs-demo-model") that mean little to a visitor.'],
  [/^memory-2026-10\/explorer-map/, 'A satellite map of a real region (third-party imagery with its credit line) beside events at "Smith Family Home": a real place and a family name, where the file gallery has neither.'],
  [/^memory-2026-10\/first-run-empty-explorer/, 'An empty state ("Your memory is empty"), not the app at work.'],
  [/^memory-2026-10\/first-run-login/, 'A sign-in page (a login wall).'],
  [/^memory-2026-10\/first-run-trust/, 'A page that offers "Hands-off" autonomy (deleting, sending and using tools without asking): an autonomy claim the site does not make.'],
  [/^memory-2026-10\/import-export-guide/, 'Steps to export from a named third-party service, with its logo and a red "Can take weeks" tag.'],
  [/^memory-2026-10\/import-history-detail/, 'Shows an export file named for a person ("john-smith-export.zip") and third-party service names.'],
  [/^memory-2026-10\/import-inbox/, 'Shows an export file named for a person ("john-smith-export.zip") and a server folder path.'],
  [/^memory-2026-10\/import-pipeline/, 'Shows an export file named for a person ("john-smith-export.zip") and the services it came from.'],
  [/^memory-2026-10\/import-sync/, 'Shows an export file named for a person ("john-smith-export.zip") and counts of imported messages.'],
  [/^memory-2026-10\/settings-your-data/, 'Settings pages (export and import of all data) with no sign of the app at work.'],
  [/^memory-2026-10\/sources-services/, 'A grid of third-party service brands with their logos (Microsoft, Google, Meta, Spotify, Steam, GitHub, Signal, Slack, Reddit).'],
  // ---- Companion Planning
  [/^planning\/planning-connections/, 'Settings with Ollama shown as unavailable at localhost:11434, Companion Memory as not connected and a Google Calendar connection: localhost and a fault state.'],
  [/^planning\/planning-first-run-source/, 'A first-run dialog offering to connect Google (a third-party brand) over a blurred page.'],
  [/^planning\/planning-sign-in/, 'A sign-in page (a login wall).'],
  [/^planning\/planning-tasks/, 'Clean (sample tasks, no names), not chosen: an app has one screenshot slot, and the Today view was chosen.'],
  // ---- Companion Hub (the Hub section keeps its four tutorial captures; these were looked at for it too)
  [/^hub-2026-09\/app-store(-mobile)?-light/, 'Clean and current (the light store with the first-party row), held back: the Hub section already carries four real captures and swapping one in puts a light page beside the dark ones; every tile also reads "Free", a price word the site does not print. A candidate for the owner to swap in.'],
  [/^hub-2026-09\/dashboard(-mobile)?-light/, 'Clean and current (the home with five apps), held back with the store capture above; its disk, CPU and memory figures are the capture machine\'s, not a Companion Core spec.'],
  [/^hub-2026-09\/app-detail/, 'The store page for Hermes: "messaging AI assistant", a 0.0 rating, an unknown download size and "Memory not connected", beside an unreadable dark screenshot of the app.'],
  [/^hub-2026-09\/app-install/, 'An install form with "Public Web" exposure (remote access, which the site does not claim), host.docker.internal and an authorised messaging user id.'],
  [/^hub-2026-09\/device-registration/, 'A pairing code and a device id, or a provisioning step that says the Hub is being made reachable.'],
  [/^hub-2026-09\/(login|register)/, 'A sign-in or sign-up page (a login wall) with an example email address.'],
  [/^hub-2026-09\/onboarding-/, 'A step of the Hub setup wizard: localhost and host.docker.internal addresses, "Public Web" exposure, cloud API key fields, a hardware list and recommended third-party apps with their logos.'],
  [/^hub-2026-09\/settings-/, 'A Hub settings page: addresses, "Public Web" and Tailscale remote access, MCP and cloud API key fields, or a reset prompt: configuration, not the product at work.'],
  [/^hub-2026-09\/system-inspector/, 'A system inspector page with host names, port allocations and machine figures.'],
  [/^hub-0-3\/app-backups/, 'A backup list with generated archive file names and sizes over the Companion Memory store page.'],
  [/^hub-0-3\/(app-not-responding|app-starting|startup-)/, 'An error, loading or start-up state ("isn\'t responding", "is starting", "couldn\'t start"), not a working screen.'],
  [/^hub-0-3\/(app-restore|app-uninstall)/, 'A destructive confirmation dialog (restore a backup, uninstall) over a third-party app\'s store page.'],
  [/^hub-0-3\/dashboard-batch/, 'The Hub home with a batch-actions menu open (start, stop, restart, update all): a menu over the home, not the home.'],
  [/^hub-0-3\/settings-network-tailscale/, 'A Tailscale "refused" fault state with a shell command (sudo tailscale ...): remote access and an error.'],
  [/^hub-0-3\/settings-security/, `A Hub security page with ${EMAIL} (owner@example.com) and a list of API keys.`],
  [/^hub-0-3\/settings-system/, 'A Hub update or restart settings page with version numbers and download steps: configuration, not the product at work.'],
  [/^hub-pool-2026-10\//, 'Hub Pool (sharing models between Hubs over a Tailscale network): tailnet host names (hub-b.example-tailnet.ts.net), key fingerprints, pairing PINs and per-request timings: remote access and performance figures the site does not claim, and no story names Hub Pool.'],
  [/^pool\//, 'The Hub Pool setup wizard: tailnet host names (beta-red.example-tailnet.ts.net) and model counts: remote access, and no story names Hub Pool.'],
  [/^local-bench\//, 'Local LLM benchmark pages: tokens per second and an intelligence index are performance numbers the site does not print (none is on the fact sheet).'],
  [/^onboarding\//, 'A Hub setup page for vLLM: host.docker.internal addresses and an engine panel on a dark page.'],
  [/^connect\//, `An API key screen (Hub or Memory settings): a created key, its reveal, a key list, or an approval card carrying a token-like string and ${EMAIL}: credentials are never shown, even sample ones.`],
  // ---- the Companion account page
  [/^portal-2026-10\/billing-/, `A billing page: it ${PORTAL_PRICE}.`],
  [/^portal-2026-10\/domains-/, 'A custom-domain page (grafana.example.com, a TLS certificate, DNS records): serving a Hub on a public domain is a remote access claim the site does not make.'],
  [/^portal-2026-10\/(sign-in|sign-up|check-your-email)/, `A sign-in, sign-up or verification page (a login wall), with ${EMAIL} on the last.`],
  [/^portal-2026-10\/(org-|invite-member|create-org)/, `An organisation page or dialog with named members (Alex Rivera, Sam Taylor) and ${EMAIL} (alex@example.test).`],
  [/^portal-2026-10\/home-no-org/, 'An empty account home ("Set up an organization"): an empty state.'],
  [/^portal-2026-10\/home-/, 'The account home for a made-up household ("Example Household"): a device named kitchen-hub, public subdomain addresses (remote access) or an offline fault state ("No check-in for over 3h"), not the product at work.'],
  [/^portal-2026-10\/(device-|delete-device|pairing-code|hub-already)/, 'A device dialog or menu with a device id (a UUID) or a pairing code, which are not shown.'],
  [/^portal-2026-10\/(app-drawer|app-page)/, 'An installed app\'s panel in the account, with "Routing: Cloudflare Tunnel" and a device name (remote access), or the Hermes listing with messaging claims.'],
  [/^portal-2026-10\/(install-dialog|store-agents)/, 'A store dialog or page with "Public Web" exposure (remote access) and a device id, or an agents list whose Hermes and OpenClaw blurbs make messaging claims.'],
  [/^portal-2026-10\/user-settings/, 'A security settings page (passkeys, two-factor authentication): not the product at work, and passkey wording the site does not repeat.'],
  [/^portal-2026-10\//, 'A Companion account page the site does not use: the account section keeps its three real captures.'],
  // ---- other products, none named by a story
  [/^asks\//, 'Companion Memory\'s Asks page, which no story names: peer identifiers (key fragments such as "Peer ..EzNWU=") and questions between two Companions, such as where a person lives.'],
  [/^avatar-companion\/avatar-companion-chat-only/, 'A rendered 3D head with glasses on a dark page: a person-like face, not an app screen, in an app no story names.'],
  [/^avatar-companion\//, 'A dark dialog of the avatar app (microphone permission, connection check, model and proxy fields), an app no story names.'],
  [/^browser-extensions\//, 'The browser extension\'s small popup on a plain page: its words (the old "CI-Portal" product name, "Remember everything you browse") or its placeholder example.com addresses are not wording the site uses, and no story names the extension.'],
  [/^companion-atlas\/(13|20)-/, 'Companion Atlas with a full-screen photograph of a desert road of unknown origin; the app is dark, shows real satellite imagery, and no story names it.'],
  [/^companion-atlas\/2[567]-vr/, 'A dark VR view of the Atlas globe with floating photo panels (a hand controller in one); no story names Companion Atlas.'],
  [/^companion-atlas\//, 'Companion Atlas, a dark map app with satellite imagery of real places and a street photograph under a journey title; no story names it (the catalog\'s Companion Earth has no story and no logo in the manifest yet).'],
  [/^companion-os-2026-10\/(ci-os-info|forced-password)/, 'A terminal or password prompt of the operating system: host names, IP addresses and a password field.'],
  [/^companion-os-2026-10\/(grub-menu|one-click|installed-desktop|live-desktop)/, 'The operating system\'s boot menu, installer ("will ERASE EVERYTHING", a one-time password line) or desktop: not an app, and no story names it.'],
  [/^companion-os-2026-10\/(hub-pairing|welcome-page)/, 'A pairing code and device id, or a browser window on the documentation site: not an app screen.'],
  [/^companion-os-2026-10\/setup-notification/, 'A desktop notification toast with a German timestamp ("Gerade eben"): a toast, not an app.'],
  [/^desktop-applet\/.*(settings-connection|settings-find-memory)/, `Capture applet settings with a server address (memory.example.com), a sample user (${EMAIL}) and a device id: addresses, emails and ids are not shown.`],
  [/^desktop-applet\//, 'A setup dialog of the capture applet, which "records what you see and edit on this computer": a claim the site does not make, and no story names the applet.'],
  [/^earth\//, 'Companion Earth: a dark globe with a list of real cities (San Francisco, Paris, Tokyo, Cape Town) or a place search; no story names Companion Earth yet and its manifest entry has no logo, so there is no slot for it. A candidate to look at again when one does.'],
  [/^even-realities\/(answer-hud|hud-streamed)/, 'A smart-glasses display: green text on black, an answer about Bluetooth Low Energy; no story names the product.'],
  [/^even-realities\/hud-permission/, 'A smart-glasses approval prompt to run "git push origin main" from a repository path: a developer approval, not a product screen.'],
  [/^even-realities\//, 'A dark chat or settings panel of the smart-glasses app, with a localhost backend URL and an API key field; no story names it.'],
  [/^headless-setup\//, 'Setting up a box with no screen: a list of Wi-Fi network names (Companion-Home, Studio-5G, CoffeeShop Free WiFi, NETGEAR-24) and a pairing code: neighbours\' network names and codes are not shown.'],
  [/^mobile-app\//, `The mobile app's sign-in, server picker (memory.example.com, ${EMAIL}) or advanced connection settings: connection screens, not the app at work.`],
  [/^pebble\//, 'A strip of three smartwatch screens (a menu, a prompt, a note list) naming a person (Ada Lovelace) and "Team standup notes"; no story names the watch app.'],
  [/^photogram\//, 'A dark globe landing page for a product no story names.'],
  [/^spatial-scan\//, 'Companion Scan: a dark room-scan editor and phone scanning screens with named scans ("One-Bedroom C", "Studio Apartment A") and point clouds of rooms; no story names Companion Scan and its manifest entry has no logo.'],
  [/^spatial-time-machine\//, 'Companion Spatial: dark map and AR screens naming real places (a school in California, a venue called The Matrix); no story names the app.'],
  [/^spellbook\/spellbook-shelf\./, 'A shelf of third-party tools with a vendor price ("$20/mo") and a free-tier number in its notes: prices and numbers the site does not print.'],
  [/^spellbook\/spellbook-search\./, 'Not better than the Spellbook capture already shipped (the same search and category cards in the same dark interface): nothing is gained by replacing it.'],
  [/^spellbook\/spellbook-shelves\./, 'The same category cards as the Spellbook capture already shipped: a duplicate of the vetted QA capture.'],
];

/** Dark twins: `x-dark.webp` beside `x-light.webp` (or beside a plain `x.webp`), the same screen in the dark theme. */
export function darkTwinOf(rel: string, all: Set<string>): string | null {
  if (!/-dark\.(webp|png)$/.test(rel)) return null;
  const light = rel.replace('-dark.', '-light.'), plain = rel.replace('-dark.', '.');
  return all.has(light) ? light : all.has(plain) ? plain : null;
}

/**
 * Every file of `public/screenshots/` that is not chosen, with its reason, or an error that names the files no rule covers.
 * `files` are paths under `public/screenshots/`; `chosen` are the paths of the shots that ship (a path of the repo, `public/screenshots/...`).
 */
export function docsRejections(files: string[], chosen: Set<string>, apps: Record<string, string>): { rel: string; reason: string; app?: string }[] {
  const all = new Set(files);
  const byApp = new Map(Object.entries(apps).map(([id, p]) => [p.replace('public/screenshots/', ''), id]));
  const out: { rel: string; reason: string; app?: string }[] = [];
  const unknown: string[] = [];
  for (const rel of files) {
    if (chosen.has(`public/screenshots/${rel}`)) continue;
    const app = byApp.get(rel);
    const twin = darkTwinOf(rel, all);
    if (twin) {
      out.push({ rel, reason: `The dark-theme twin of ${twin.split('/').pop()}: the light capture is the one looked at (the family pages are light); see its entry for what was found.` });
      continue;
    }
    const rule = RULES.find(([re]) => re.test(rel));
    if (!rule && !app) { unknown.push(rel); continue; }
    out.push({ rel, reason: app ? DOCS_APP_REJECT[app].reason : rule![1], app });
  }
  if (unknown.length) throw new Error(`${unknown.length} CI-Docs capture${unknown.length === 1 ? '' : 's'} nobody has looked at (add each to DOCS_SHOTS or to a rule in scripts/story/lib/media-docs.mts after looking at it): ${unknown.slice(0, 8).join(', ')}${unknown.length > 8 ? ', ...' : ''}`);
  return out;
}
