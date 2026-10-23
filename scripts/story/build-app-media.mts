#!/usr/bin/env -S node --experimental-strip-types
// Real logos and real screenshots of the apps the 30 families use, of Companion Hub and of the Companion account page (the Portal),
// built into small content-hashed WebP files and the manifest the page generators read (reference/story/story-v2.md "App media").
//
//   pnpm run story:media [--out <dir>] [--apps a,b] [--no-ci] [--check] [--update-sources] [--fetch] [--verbose]
//
//   content/story/app-media.json                    the manifest (sorted keys, no timestamps), read by scripts/story/lib/media.mts
//   portal/apps/<id>/logo.<hash10>.webp             128 x 128, at most 12 KB, transparency kept, the app's own mark
//   portal/apps/<id>/shot.<hash10>.webp             960 px wide, quality about 72, at most 90 KB: a real capture, scaled and re-encoded, nothing else
//   portal/ci/hub-<id>.<hash10>.webp, portal-<id>   Companion Hub and Companion account page screenshots, the same treatment
//
// WHERE THE BYTES COME FROM. The sibling repos CI-Marketplace, CI-Hub, CI-Portal and CI-Docs (beside this one; CI_SIBLINGS or --marketplace-dir, --hub-dir,
// --portal-dir, --docs-dir say otherwise), read with `git cat-file blob <sha>:<path>` at a PINNED commit, never from a working tree (theirs are behind origin
// or carry other people's edits). CI-Docs `public/screenshots/` holds real captures of our own apps with sample data: a first-party app's screen comes from
// there (scripts/story/lib/media-docs.mts: what ships, and a rule with a reason for every other file), with its own caption, "with sample data".
// The pin is the `sources` of the existing manifest, so a rerun is the same bytes; `--update-sources` moves it to each repo's origin/main (and
// `--fetch` runs `git fetch origin` first, which only updates remote refs). A moved pin is not trusted: see VETTED below.
//
// WHAT SHIPS IS CHOSEN BY EYE, AND THE CHOICE IS DATA, below: the screenshots each looked at one by one (the rejections, with their reasons, are
// written into the manifest's `rejected` list), and a git blob id for every screenshot that passed, so a source file that has changed since
// someone looked at it stops the build (`VETTED`). A screenshot that is not named there is never shipped.
//
// HOW THEY ARE MADE. ffmpeg with libwebp, nothing else (the repo has no image library and none may be added); no network. A logo is scaled in
// premultiplied alpha (no halo at a soft edge) to fit a 128 px square, centred on a transparent canvas, lossy WebP with its alpha kept. A screenshot is
// scaled to 960 px wide, its aspect kept, lossy WebP at quality 72, stepped down until it is at most 90 KB. No metadata is written, one thread is used,
// so the same input on the same ffmpeg gives the same bytes (the test builds twice and compares). A different ffmpeg may give different bytes: then
// `--check` fails and the files are rebuilt and committed, like portal/thumbs.
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from '../portal-lib.mts';
import {
  ROOT, MANIFEST, LOGO_BUDGET, SHOT_BUDGET, LOGO_PX, SHOT_PX, CAPTION_TAIL, UNLOOKED, appCaption, docsCaption, hash10, imageSize, webpHasAlpha, usedAppIds, checkManifest, stable,
  type MediaManifest, type MediaImage, type MediaShot, type CiShot, type Rejected, type AppMedia,
} from './lib/media.mts';
import { DOCS_SHOTS, SUPERSEDED_QA, DOCS_APP_REJECT, docsRejections } from './lib/media-docs.mts';

// ------------------------------------------------------------------------------------------------------------ the choices (vetted by eye)

type Repo = 'marketplace' | 'hub' | 'portal' | 'docs';
const REPO_NAME: Record<Repo, string> = { marketplace: 'CI-Marketplace', hub: 'CI-Hub', portal: 'CI-Portal', docs: 'CI-Docs' };
const REPOS: Repo[] = ['marketplace', 'hub', 'portal', 'docs'];

/** The commits the choices below were looked at on (a rejection cites these, whatever the pin is now). */
const REVIEWED = { marketplace: 'e947721966952d762deec382e64fd55a8f2db3fb', hub: '860b47a7a84c53d305be8b7696fc390463fcbb96', portal: 'ff8777c623760ca471ebd89a7881b0aa0f6018e7', docs: '6773705a5754e506c3f5d0e8a004ca2b0e616f17' };

/**
 * What an app's QA-run screenshot shows, for its alt text ("<Name> <what> in a browser"): every one of these is a first-run or sign-in page of the real app.
 * (A first-party app's screen from the product's own documentation is chosen in scripts/story/lib/media-docs.mts, DOCS_SHOTS, and takes the slot first.)
 */
const SHOT_SHOWS: Record<string, string> = {
  'activepieces': 'sign-up page', 'airtrail': 'owner account setup page', 'akaunting': 'sign-in page', 'anything-llm': 'empty chat page', 'audiobookshelf': 'initial server setup page',
  'audiomass': 'waveform editor with its welcome dialog', 'baikal': 'initialization wizard', 'booklore': 'admin account setup page', 'bookstack': 'sign-in page',
  'ci-spellbook': 'prompt library home', 'donetick': 'sign-in page', 'drawio': 'empty diagram editor',
  'duplicati': 'sign-in page', 'espocrm': 'sign-in page', 'excalidraw': 'empty whiteboard', 'firefly-iii': 'registration page', 'foldergram': 'photo library start page',
  'forgejo': 'home page', 'glasshome': 'dashboard welcome screen', 'grist': 'welcome page', 'grocy': 'sign-in page', 'home-assistant': 'welcome page',
  'hortusfox': 'dashboard', 'immich': 'photo library welcome page', 'inkscape': 'welcome dialog', 'joplin': 'sign-in page', 'kimai': 'sign-in page',
  'kitchenowl': 'first user setup page', 'libreoffice': 'start centre', 'librephotos': 'sign-in page', 'mazanoke': 'image upload page',
  'monetr': 'sign-in page', 'n8n': 'owner account setup page', 'nextcloud': 'setup page', 'open-webui': 'welcome screen', 'pairdrop': 'device discovery page',
  'paperless': 'sign-in page', 'photoprism': 'sign-in page', 'pi-hole': 'sign-in page', 
  'comfyui': 'node graph editor with its default workflow', 'convert': 'file converter page',
  'uptime-kuma': 'admin account setup page', 'vaultwarden': 'sign-in page', 'wallos': 'account registration page', 'wanderer': 'welcome page', 'yuvomi': 'administrator setup page',
};

/** The git blob id (12 hex) of each app screenshot that passed, at the reviewed commit. A changed source stops the build until someone looks again. */
const VETTED: Record<string, string> = {
  'activepieces': '64dcc3ed38c1', 'airtrail': 'd61060ac696d', 'akaunting': '8cd356b171bb',
  'anything-llm': '49b40b6cff72', 'audiobookshelf': 'ed992477f135', 'audiomass': '7fc4298c4661',
  'baikal': 'df9b4184c7a5', 'booklore': '490c7d4915b5', 'bookstack': '33dd72817842',
  'ci-spellbook': '1fd18e2d9466', 'comfyui': '906653ecbf5e', 'convert': 'c3cd95ba9d53',
  'donetick': 'db7411cc9354', 'drawio': '02bb35b443b9', 'duplicati': '7e438facd6ce',
  'espocrm': '17fb561972fc', 'excalidraw': 'c973046321fd', 'firefly-iii': 'ca2c0f16507e',
  'foldergram': 'b6f37a310412', 'forgejo': '6ce0f2738350', 'glasshome': 'b56ac0881d40',
  'grist': 'dad3e94bc12c', 'grocy': '577938b56e97', 'home-assistant': 'c426ce209b76',
  'hortusfox': '1f09a1dab19b', 'immich': 'dc9849092cfd', 'inkscape': 'c0ee4524a0e2',
  'joplin': '5398ee01471c', 'kimai': '5fbcbf87e6ff', 'kitchenowl': '5c032aa2d4a7',
  'libreoffice': '826921276e89', 'librephotos': '993df566814b',
  'mazanoke': 'b8bbf475e481', 'monetr': 'f778cb8d1e90', 'n8n': '46914dfb56ee',
  'nextcloud': '78529edc5bef', 'open-webui': '6e381c5c76e9', 'pairdrop': '140d5019f88d',
  'paperless': '3ed30503793f', 
  'photoprism': '2edc64a618e0', 'pi-hole': '6b9303157478', 
  'uptime-kuma': '8e69e23ae2cd', 'vaultwarden': '2820e3cf21e9', 'wallos': '03050c156827',
  'wanderer': '9857844cd646', 'yuvomi': '2b93e19abe9c',
};

/** The screenshots that did not pass, and why. Each is a first-hand finding from looking at the file at the reviewed commit. */
const REJECT_SHOT: Record<string, string> = {
  // ---- v3 media review (owner decision 2026-10-19: show only vetted captures; the 17 accepted are the apps not listed here) ----
  'activepieces': 'Rejected by the v3 media review: sign-up form (login wall)',
  'airtrail': 'Rejected by the v3 media review: QA capture is the empty owner-account setup form (username, password, display name): shows nothing of the app.',
  'akaunting': 'Rejected by the v3 media review: Login wall.',
  'audiobookshelf': 'Rejected by the v3 media review: Initial server setup form (create root user). No library.',
  'audiomass': 'Rejected by the v3 media review: Dark empty editor behind a welcome dialog; shows nothing of the app at work.',
  'baikal': 'Rejected by the v3 media review: The install wizard (empty admin password fields, Europe/Paris time zone), not the product working. The catalog marks QA as screenshot; the screenshot shows setup only.',
  'booklore': 'Rejected by the v3 media review: Admin account setup form. No library.',
  'bookstack': 'Rejected by the v3 media review: Login wall.',
  'ci-memory': 'Rejected by the v3 media review: Companion login landing page with a Log In button and the words "personal assistant": login wall and banned vocabulary.',
  'donetick': 'Rejected by the v3 media review: QA capture is the sign-in screen (cute mascot, username, password).',
  'duplicati': 'Rejected by the v3 media review: QA capture is the Duplicati login box.',
  'espocrm': 'Rejected by the v3 media review: Login wall.',
  'firefly-iii': 'Rejected by the v3 media review: Register-a-new-account form.',
  'foldergram': 'Rejected by the v3 media review: Empty state: "No folders found yet".',
  'grocy': 'Rejected by the v3 media review: QA capture is the login form.',
  'joplin': 'Rejected by the v3 media review: Login wall.',
  'kimai': 'Rejected by the v3 media review: QA capture is the login form.',
  'kitchenowl': 'Rejected by the v3 media review: Create-a-user form.',
  'librephotos': 'Rejected by the v3 media review: Login page.',
  'monetr': 'Rejected by the v3 media review: Sign-in form.',
  'n8n': 'Rejected by the v3 media review: owner setup form (login wall)',
  'nextcloud': 'Rejected by the v3 media review: Install form (create admin account) carrying the vendor slogan "a safe home for all your data", a claim the site must not make.',
  'open-webui': 'Rejected by the v3 media review: Dark splash "Chart new frontiers wherever you are" with a Get started button: no app UI.',
  'paperless': 'Rejected by the v3 media review: Login wall.',
  'photoprism': 'Rejected by the v3 media review: Login wall.',
  'uptime-kuma': 'Rejected by the v3 media review: Create admin set-up form',
  'vaultwarden': 'Rejected by the v3 media review: Login wall (shows the Bitwarden trademark line).',
  'wallos': 'Rejected by the v3 media review: Create-an-account form.',
  'yuvomi': 'Rejected by the v3 media review: administrator set-up form',
  'bentopdf': 'Shows a row of third-party brand logos (Google, Microsoft, Reddit, Amazon, Apple) under "Used by companies and people working at".',
  'blockbench': 'Its splash art credits two named creators, and the page offers Minecraft project types: a third-party brand and personal names on the page.',
  'ci-hermes': 'The upstream project\'s own website, with an install command for another machine: not the app running on a Core.',
  'ci-openclaw': 'The upstream project\'s own website, with install commands for another machine: not the app running on a Core.',
  'cryptpad': 'Shows a localhost address and port (localhost:19024) as the instance name.',
  'docuseal': 'Shows a localhost address and port (localhost:5341) in its App URL field.',
  'frigate': 'An error state: "No frames have been received, check error logs".',
  'gitea': 'Shows an internal host name (gitea-db:5432) and a masked database password field.',
  'homehub': 'Shows first names in its "Who is home" widget (Mom, Dad, Vivek, India) and a user picker.',
  'jellyfin': 'Shows a container id (addea8c7324a) as the server name.',
  'jupyterlab': 'Shows a localhost address, an example token and a local path in its help text.',
  'kiwix': 'An empty library ("No result. Would you like to reset filter?"), not a working Kiwix.',
  'koodo-reader': 'An empty library behind a dimmed data-loss warning, with a "Pro version" link.',
  'libretranslate': 'Not a QA run capture: its size (1399 x 576) and rendering are not the harness\'s, so the "Companion Hub QA run" caption would not be true.',
  'navidrome': 'Not a QA run capture: the project\'s own demo shot in a macOS window, with commercial album covers and a person\'s first name in the header.',
  'ntfy': 'Shows a "Notifications are blocked" warning, which reads as a fault.',
  'obsidian': 'Shows the remote desktop viewer\'s panel and brand over the app.',
  'onlyoffice': 'Shows a container id and a docker command that prints the JWT secret.',
  'opnform': 'Not a capture: marketing artwork with stock photography.',
  'papra': 'Its email field shows an example address on the app\'s own domain.',
  'penpot': 'Its login illustration carries three personal names on cursor labels, which may be real people.',
  'planka': 'Half the page is a stock photograph that carries third-party brand marks.',
  'spliit': 'Its footer names the app\'s author, a real person.',
  'steam-headless': 'A blank page.',
  'stirling-pdf': 'Shows the default login credentials (a username and a password).',
  'tldraw': 'A blank canvas with a license watermark and a test room id.',
  'twenty': 'Shows third-party company brands and street addresses in its demo rows.',
  'vikunja': 'Shows the local address 127.0.0.1:19997.',
  'wingfit': 'Shows an error toast ("You must be authenticated"), a photograph of people and a personal GitHub handle.',
  'wordpress': 'The install language list, with the WordPress logo cut off at the top.',
  // ---- the 2026-10 look at the QA captures nobody had vetted, and at the audit's tier A and B shortlist (each at full size, at the pinned commit)
  'archivebox': 'A sign-in page (a login wall) with username and password fields and the shell commands that reset a password or create an administrator.',
  'baserow': 'A create-account form (a login wall): the first administrator.',
  'cryptgeon': 'A clean empty note form, but its first line reads "Easily send fully encrypted, secure notes or files": a vendor security claim the site does not make (the Nextcloud precedent), above an empty text box.',
  'element': 'A sign-in splash over a third-party landscape photograph, with the vendor line "Decentralised, encrypted chat & collaboration powered by" and the Matrix brand: a login wall and a claim the site does not make.',
  'endurain': 'A sign-in page beside a photograph of a cyclist (a person), with the Strava and Garmin Connect brand marks in its footer: a login wall and third-party brands.',
  'freecut': 'A real editing session: its clip names are films, shows and songs by named artists, and the preview is a stock footage frame: third-party titles and real people\'s names.',
  'ghost': 'The blog\'s front page with an example email address in its subscribe box and a "Coming soon" placeholder post: an example address, and nothing of the writing tool at work.',
  'habitica': 'A sign-up page with a cookie banner over the vendor\'s marketing page and its pixel-art characters: a login wall and marketing.',
  'invio': 'A login page (a login wall).',
  'invoice-ninja': 'A login page with a build date (a login wall).',
  'kokoro': 'The page header carries the GitHub mark with a live star count and a "powered by" banner naming the model author\'s handle, above an empty text box: third-party brand marks, a count, and nothing at work.',
  'linkwarden': 'A login page (a login wall).',
  'listmonk': 'The public landing page: a Login button and two links, nothing of the app at work.',
  'logseq': 'The demo graph: a warning banner ("changes will not be saved") and the vendor line "a privacy-first, open-source platform", a claim the site does not make (the Nextcloud precedent), over a tutorial page.',
  'lubelogger': 'An empty garage with one plus button: an empty state.',
  'memos': 'A create-account form (a login wall).',
  'mixpost': 'A login page (a login wall).',
  'mstream': 'An empty player and an empty library folder, with the Discord and GitHub marks in the header: an empty state and third-party brand marks.',
  'pingvin-share': 'Its home page names WeTransfer, a third-party company, and claims "your files ... will never be accessed by third parties": a competitor\'s name and a claim the site does not make.',
  'plausible': 'A registration form with a placeholder name and email address and the vendor line "privacy-friendly analytics": a login wall and a claim the site does not make.',
  'razzia': 'A game lobby that prints the address localhost:3000, a game PIN and a QR code: a localhost address.',
  'readeck': 'The first-run installation form (username, password, email): a setup wall.',
  'trip': 'Not a QA run capture: the project\'s own marketing picture, a street map of London with a collage of screens that name real places (a college, an Amsterdam weekend) and pins of real photographs, so the "Companion Hub QA run" caption would not be true.',
  'open-notebook': 'A populated notebook about "Superintelligence": notes tagged "AI Generated" that make claims about what AI can do, a third-party product name (AlphaGo), source ids and an exclamation-marked headline: content that makes claims the site must not make.',
  'privatebin': 'An empty editor under the vendor line "Because ignorance is bliss" and the claim that the server has "zero knowledge" and uses "256 bits AES": security claims the site does not make, over a blank page.',
  'searxng': 'The search landing page: an empty search box under the vendor line "a privacy-respecting, open metasearch engine", a claim the site does not make; nothing at work.',
  'vert': 'The landing page: it claims "lightning-fast servers", "no file size limit" and that all processing is "done on your device", and links a Discord server: performance and privacy claims the site does not make.',
  'mattermost': 'A "Where would you like to view this?" chooser with a download link: not the app.',
  'super-productivity': 'The first-run chooser ("How do you want to use Super Productivity?") with the line "Your data stays securely on your device": a setup page and a security word the site does not use.',
  'wealthfolio': 'The first-run chooser with investment wording ("total return", "performance analytics", TWR and IRR): finance claims the site does not make, on a setup page.',
  'ci-web-xr-scan': 'A scan viewer that prints a latitude and longitude in its corner (a real place in the San Francisco Bay area) beside named scans of rooms ("Kids Room", "Home Office"): coordinates are not shown. A candidate for a fresh capture with the position hidden.',
  'project-nomad': 'A menu of tiles under a badge that reads "Node for offline media, archives, and data" and "View offline maps": offline claims the site does not make, and no content at work.',
  'synapse': 'A server status page ("It works! Synapse is running") with the Matrix brand: not an app screen.',
  'homarr': 'The first-run setup chooser (start from scratch, import, restore): a setup page.',
  'heimdall': 'An empty dashboard ("There are currently no pinned applications") over a stock photograph of a hot air balloon: an empty state and a stock photograph.',
  'prestashop': 'A demo storefront with stock photographs, lorem ipsum text and discount tags (-20%): stock photography, placeholder text and prices.',
};

/**
 * The logos that are held back, and why (looked at full size on 2026-10-22; each lands in the manifest's `rejected` list as a `logo`). The store listing's
 * mark is not always the app's own mark, and a logo "identifies the app named beside it", so one that identifies something else does not ship: the app is
 * then shown by its name alone (an app with neither a logo nor a screenshot is listed in `noMedia`). The owner may overrule any of them by deleting the entry.
 */
const REJECT_LOGO: Record<string, string> = {
  'whisper-webui': 'The listing\'s mark is the OpenAI Whisper logo (the OpenAI blossom over the word "Whisper"): another company\'s mark, which would read as OpenAI\'s endorsement of a different project. Shown by name only unless the owner clears it or the project supplies its own mark.',
  'taxhacker': 'The listing\'s mark is an illustrated anime-style hooded character at a laptop, not a product mark: it identifies nothing of the app and reads as a person or a character.',
  'tandoor': 'The listing\'s mark is a photograph of cooked food (256 px, blurred at 128 px), not a mark: a photograph, and nothing of it identifies the app.',
  'razzia': 'The listing\'s "logo" file is a 1920 x 947 screenshot of the app\'s PIN-code sign-in page, not a mark: scaled to 128 px it is an unreadable dark tile, and it is a sign-in page (found by eye after the audit, which listed only the other three).',
};

type CiChoice = { id: string; repo: Repo; path: string; oid: string; alt: string; caption: string };
const SAMPLE = 'from a product tutorial capture, with sample data';
/** Companion Hub and the Companion account page: seven real captures from the Hub repo's tutorial stage and one from the Portal repo's docs. */
const CI_CHOICES: { hub: CiChoice[]; portal: CiChoice[] } = {
  hub: [
    { id: 'store', repo: 'hub', path: 'videos/ci-tutorial-video/public/screens/hub-store-featured.png', oid: '679a6f32f952', alt: 'Companion Hub store showing the Featured apps',
      caption: `Real screenshot of Companion Hub from a product tutorial capture. ${CAPTION_TAIL}` },
    { id: 'app-detail', repo: 'hub', path: 'videos/ci-tutorial-video/public/screens/hub-app-details-immich.png', oid: '3d7009b3c462', alt: 'Companion Hub store page for Immich with an Install button',
      caption: `Real screenshot of Companion Hub from a product tutorial capture. ${CAPTION_TAIL}` },
    { id: 'installing', repo: 'hub', path: 'videos/ci-tutorial-video/public/screens/hub-onboarding-installing.png', oid: '7ef89331282d', alt: 'Companion Hub setup screen while an app installs',
      caption: `Real screenshot of Companion Hub ${SAMPLE}. ${CAPTION_TAIL}` },
    { id: 'home', repo: 'hub', path: 'videos/ci-tutorial-video/public/screens/hub-home-dashboard.png', oid: '3e3e07e26861', alt: 'Companion Hub home with five installed apps and three system meters',
      caption: `Real screenshot of Companion Hub ${SAMPLE}. The disk, CPU and memory figures are the capture machine's, not a Companion Core spec. ${CAPTION_TAIL}` },
  ],
  portal: [
    { id: 'store', repo: 'hub', path: 'videos/ci-tutorial-video/public/screens/portal-store-public-top.png', oid: '4025131ee6c6', alt: 'Companion account store with its list of apps, signed out',
      caption: `Real screenshot of the Companion account page from a product tutorial capture. ${CAPTION_TAIL}` },
    { id: 'add-device', repo: 'hub', path: 'videos/ci-tutorial-video/public/screens/portal-add-device-dialog.png', oid: 'e4043ca98931', alt: 'Companion account dialog that names a new device',
      caption: `Real screenshot of the Companion account page ${SAMPLE}. ${CAPTION_TAIL}` },
    { id: 'home', repo: 'hub', path: 'videos/ci-tutorial-video/public/screens/portal-home-with-device.png', oid: '4f888d696647', alt: 'Companion account home with one device and one app',
      caption: `Real screenshot of the Companion account page ${SAMPLE}. ${CAPTION_TAIL}` },
  ],
};

type CiReject = { repo: 'hub' | 'portal' | 'docs'; path: string; reason: string };
const SLATE = 'A branded placeholder slate ("capture pending"), not a capture.';
const PRODUCT_OTHER = 'Shows Runtipi\'s own Tipi app store in a macOS browser frame: a different product, not Companion Hub.';
const TUT = 'videos/ci-tutorial-video/public/screens/';
const FIXTURE = 'The capture stage stubs the store and the devices (video/capture.config.mjs), so the data is made up';
/** Every other candidate in the Hub, Portal and Docs repos, looked at and not used. */
const CI_REJECT: CiReject[] = [
  { repo: 'hub', path: 'screenshots/appstore.png', reason: PRODUCT_OTHER },
  { repo: 'hub', path: 'screenshots/darkmode.png', reason: PRODUCT_OTHER },
  { repo: 'hub', path: 'docs/ci-portal/01-signin.png', reason: 'An older capture of the account sign-in page, replaced by a newer one.' },
  { repo: 'hub', path: 'docs/ci-portal/02-signup.png', reason: 'An older capture of the account sign-up form, replaced by a newer one.' },
  { repo: 'hub', path: 'docs/ci-portal/03-home.png', reason: 'An older capture with invented data: placeholder letter icons and red Cloudflare status labels.' },
  { repo: 'hub', path: 'docs/ci-portal/04-store.png', reason: 'An older capture with invented data: placeholder letter icons and invented ratings.' },
  { repo: 'hub', path: 'docs/ci-portal/05-add-device.png', reason: 'An older capture whose background is the invented device list with red Cloudflare status labels.' },
  { repo: 'hub', path: `${TUT}app-immich-live.png`, reason: SLATE },
  { repo: 'hub', path: `${TUT}app-immich-live-mobile.png`, reason: SLATE },
  { repo: 'hub', path: `${TUT}hub-app-install-progress-immich.png`, reason: SLATE },
  { repo: 'hub', path: `${TUT}hub-app-installing-immich.png`, reason: SLATE },
  { repo: 'hub', path: `${TUT}hub-app-running-immich.png`, reason: SLATE },
  { repo: 'hub', path: `${TUT}hub-app-running-immich-mobile.png`, reason: SLATE },
  { repo: 'hub', path: `${TUT}hub-device-registration-complete.png`, reason: SLATE },
  { repo: 'hub', path: `${TUT}hub-register.png`, reason: SLATE },
  { repo: 'hub', path: `${TUT}portal-login.png`, reason: SLATE },
  { repo: 'hub', path: `${TUT}hub-device-registration-empty.png`, reason: 'Shows test values (a device id "test-device-id" and the code "ABC123").' },
  { repo: 'hub', path: `${TUT}hub-device-registration-mobile-code.png`, reason: 'Shows test values (a device id "test-device-id" and a pairing code).' },
  { repo: 'hub', path: `${TUT}hub-device-registration-provisioning.png`, reason: 'Says the Hub is being made "reachable on the web", which claims remote access that the site does not.' },
  { repo: 'hub', path: `${TUT}hub-device-registration-mobile-provisioning.png`, reason: 'Says it is turning on "your public connection" and waiting for DNS propagation, a remote access claim the site does not make.' },
  { repo: 'hub', path: `${TUT}hub-install-dialog-immich.png`, reason: 'Shows "Public Web" preselected and a host path (/nfs/tipi/immich), which claim remote access and carry the old product\'s name.' },
  { repo: 'hub', path: `${TUT}hub-resource-monitor.png`, reason: 'Shows an untranslated string key (COMMON_APP) as a column heading.' },
  { repo: 'hub', path: `${TUT}hub-settings-overview.png`, reason: 'Shows "Allow anonymous error monitoring" switched on, which contradicts a story that names where data goes.' },
  { repo: 'hub', path: `${TUT}hub-onboarding-form.png`, reason: 'A full-page strip (3840 x 10806) with a no-GPU warning, a Tailscale sign-in and cloud API key fields.' },
  { repo: 'portal', path: 'docs/ui/portal-light.png', reason: 'A loading skeleton with no content (portal-store-light.png is the same file).' },
  { repo: 'portal', path: 'docs/ui/portal-dark.png', reason: 'A loading skeleton with no content (portal-store-dark.png is the same file).' },
  { repo: 'portal', path: 'docs/ui/portal-login-light.png', reason: 'A clean sign-in page, but its own line calls passkey sign-in the "most secure", a security claim this site does not make. Owner may overrule: it is otherwise the best account page shot.' },
  { repo: 'portal', path: 'docs/screenshots/03-home.png', reason: 'An empty workspace ("No hosted apps yet") under a demo organisation name.' },
  { repo: 'portal', path: 'docs/screenshots/04-store.png', reason: 'An empty store ("No apps found").' },
  { repo: 'portal', path: 'video/assets/shots/store-home.png', reason: `${FIXTURE}, with placeholder letter icons.` },
  { repo: 'portal', path: 'video/assets/shots/home-workspace.png', reason: `${FIXTURE}: an invented workspace with generic icons.` },
  { repo: 'portal', path: 'video/assets/shots/store-app-detail.png', reason: `${FIXTURE}: an invented workspace name sits in the header.` },
  { repo: 'portal', path: 'video/assets/shots/store-install-device.png', reason: 'Shows "Public Web" preselected ("Accessible from anywhere via a secure public URL") and device codes, which claim remote access.' },
  { repo: 'portal', path: 'video/assets/shots/store-alternatives.png', reason: `${FIXTURE}: "Soon" badges beside competitor product names.` },
  { repo: 'portal', path: 'video/assets/shots/home-pairing-code.png', reason: 'Shows a pairing code.' },
  { repo: 'docs', path: 'public/images/appstore.webp', reason: 'Shows broken image icons with their alt text where app icons should be.' },
  { repo: 'docs', path: 'public/images/app.webp', reason: 'A Runtipi page for Nextcloud: a different product, not Companion Hub.' },
  { repo: 'docs', path: 'public/images/social-core/home-hub-store-light.webp', reason: 'A phone held in a hand over a coloured background: a composite, not a capture.' },
];

// ------------------------------------------------------------------------------------------------------------ the sources

const args = parseArgs(process.argv.slice(2));
const OUT = path.resolve(args.out && args.out !== 'true' ? args.out : ROOT);
const VERBOSE = args.verbose === 'true';
const SIBLINGS = path.resolve(process.env.CI_SIBLINGS || path.join(ROOT, '..'));
const repoDir = (r: Repo): string => path.resolve(args[`${r}-dir`] && args[`${r}-dir`] !== 'true' ? args[`${r}-dir`] : path.join(SIBLINGS, REPO_NAME[r]));
const die = (msg: string): never => { console.error(`story:media: ${msg}`); process.exit(1); };
const note = (msg: string): void => { if (VERBOSE) console.log(msg); };

// ------------------------------------------------------------------------------------------------------------ ffmpeg

const FFMPEG = process.env.FFMPEG || 'ffmpeg';
function preflight(): string {
  const v = spawnSync(FFMPEG, ['-hide_banner', '-version'], { encoding: 'utf8' });
  if (v.error || v.status !== 0) die(`ffmpeg is not runnable (${FFMPEG}): it is the one tool this needs, with libwebp (apt install ffmpeg, or set FFMPEG)`);
  const enc = spawnSync(FFMPEG, ['-hide_banner', '-encoders'], { encoding: 'utf8' }).stdout || '';
  const flt = spawnSync(FFMPEG, ['-hide_banner', '-filters'], { encoding: 'utf8' }).stdout || '';
  if (!/\blibwebp\b/.test(enc)) die('this ffmpeg has no libwebp encoder');
  if (!/\bunpremultiply\b/.test(flt) || !/\bpremultiply\b/.test(flt)) die('this ffmpeg has no premultiply filters');
  return (v.stdout.split('\n')[0] || '').replace(/ Copyright.*/, '').trim();
}

/** One still through ffmpeg: bytes in, WebP bytes out. Deterministic: one thread, no metadata, bit-exact flags. */
export function toWebp(input: Uint8Array, vf: string, quality: number): Buffer {
  const r = spawnSync(FFMPEG, [
    '-v', 'error', '-nostdin', '-y', '-threads', '1', '-i', 'pipe:0', '-vf', vf,
    '-c:v', 'libwebp', '-quality', String(quality), '-compression_level', '6', '-map_metadata', '-1', '-fflags', '+bitexact', '-flags:v', '+bitexact', '-frames:v', '1', '-f', 'webp', 'pipe:1',
  ], { input, maxBuffer: 64 * 1024 * 1024 });
  if (r.status !== 0 || !r.stdout || !r.stdout.length) throw new Error(`ffmpeg failed: ${(r.stderr || Buffer.alloc(0)).toString().trim().slice(0, 300)}`);
  return r.stdout;
}
/** The logo filter: premultiplied alpha, fit inside the square, centred on a transparent canvas. */
export const LOGO_VF = `format=gbrap,premultiply=inplace=1,scale=${LOGO_PX}:${LOGO_PX}:force_original_aspect_ratio=decrease:flags=lanczos,pad=${LOGO_PX}:${LOGO_PX}:(ow-iw)/2:(oh-ih)/2:color=0x00000000,unpremultiply=inplace=1,format=bgra`;
export const SHOT_VF = `scale=${SHOT_PX}:-1:flags=lanczos,format=bgra`;
export const LOGO_QUALITY = 90;
export const SHOT_QUALITIES = [72, 68, 64, 60, 56, 52, 48, 44, 40];

export function encodeLogo(input: Uint8Array): Buffer {
  const out = toWebp(input, LOGO_VF, LOGO_QUALITY);
  if (out.length > LOGO_BUDGET) throw new Error(`a logo came to ${out.length} bytes, over ${LOGO_BUDGET}`);
  return out;
}
export function encodeShot(input: Uint8Array): { bytes: Buffer; quality: number } {
  for (const q of SHOT_QUALITIES) { const bytes = toWebp(input, SHOT_VF, q); if (bytes.length <= SHOT_BUDGET) return { bytes, quality: q }; }
  throw new Error(`a screenshot is over ${SHOT_BUDGET} bytes even at quality ${SHOT_QUALITIES[SHOT_QUALITIES.length - 1]}`);
}


const ffmpegLine = preflight();
// --selftest: encode a synthetic still twice and check what every real one must meet (no sources needed; the quick test runs this)
if (args.selftest === 'true') {
  const make = (lavfi: string): Buffer => {
    const r = spawnSync(FFMPEG, ['-v', 'error', '-nostdin', '-f', 'lavfi', '-i', lavfi, '-frames:v', '1', '-f', 'image2pipe', '-c:v', 'png', 'pipe:1'], { maxBuffer: 64 * 1024 * 1024 });
    if (r.status !== 0) die('selftest: ffmpeg could not make the synthetic still');
    return r.stdout;
  };
  const fails: string[] = [];
  const logoIn = make('color=c=white@0.0:s=300x200,format=rgba,drawbox=x=60:y=40:w=180:h=120:color=teal@1:t=fill');
  const a = encodeLogo(logoIn), b = encodeLogo(logoIn);
  if (!a.equals(b)) fails.push('the same logo twice gave different bytes');
  const ls = imageSize(a);
  if (!ls || ls.type !== 'webp' || ls.w !== LOGO_PX || ls.h !== LOGO_PX) fails.push('a 300 x 200 logo did not come out 128 x 128');
  if (!webpHasAlpha(a)) fails.push('the logo lost its transparency');
  if (a.length > LOGO_BUDGET) fails.push('the logo is over its budget');
  const shotIn = make('testsrc2=size=1280x800:rate=1');
  const c1 = encodeShot(shotIn), c2 = encodeShot(shotIn);
  if (!c1.bytes.equals(c2.bytes) || c1.quality !== c2.quality) fails.push('the same screenshot twice gave different bytes');
  const ss = imageSize(c1.bytes);
  if (!ss || ss.type !== 'webp' || ss.w !== SHOT_PX || ss.h !== 600) fails.push('a 1280 x 800 screenshot did not come out 960 x 600');
  if (c1.bytes.length > SHOT_BUDGET) fails.push('the screenshot is over its budget');
  if (fails.length) { console.error('story:media --selftest: ' + fails.join('; ')); process.exit(1); }
  console.log('story:media --selftest: a logo (' + a.length + ' B) and a screenshot (' + c1.bytes.length + ' B, quality ' + c1.quality + ') encode alike twice and meet their size and shape (' + ffmpegLine + ')');
  process.exit(0);
}

const git = (r: Repo, argv: string[]): Buffer => execFileSync('git', ['-C', repoDir(r), ...argv], { maxBuffer: 512 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] });
const hasBlob = (r: Repo, sha: string, p: string): boolean => spawnSync('git', ['-C', repoDir(r), 'cat-file', '-e', `${sha}:${p}`], { stdio: 'ignore' }).status === 0;
const blob = (r: Repo, sha: string, p: string): Buffer => git(r, ['cat-file', 'blob', `${sha}:${p}`]);
const oid12 = (r: Repo, sha: string, p: string): string => git(r, ['rev-parse', `${sha}:${p}`]).toString().trim().slice(0, 12);

for (const r of REPOS) if (!fs.existsSync(path.join(repoDir(r), '.git'))) die(`${REPO_NAME[r]} is not at ${repoDir(r)} (set CI_SIBLINGS, or --${r}-dir)`);
if (args.fetch === 'true') for (const r of REPOS) { console.log(`git fetch origin (${REPO_NAME[r]}): updates remote refs only`); git(r, ['fetch', 'origin']); }

const manifestFile = path.join(ROOT, MANIFEST);
const existing: MediaManifest | null = fs.existsSync(manifestFile) ? JSON.parse(fs.readFileSync(manifestFile, 'utf8')) : null;
const SOURCES = ((): MediaManifest['sources'] => {
  const pin = (r: Repo): string => git(r, ['rev-parse', 'origin/main']).toString().trim();
  // a manifest from before the Docs source has no pin for it: the first pin is the commit the Docs captures were looked at on
  if (existing && args['update-sources'] !== 'true') return { ...existing.sources, docs: existing.sources.docs || REVIEWED.docs };
  return { marketplace: pin('marketplace'), hub: pin('hub'), portal: pin('portal'), docs: pin('docs') };
})();
for (const r of REPOS) if (spawnSync('git', ['-C', repoDir(r), 'cat-file', '-e', `${SOURCES[r]}^{commit}`], { stdio: 'ignore' }).status !== 0) die(`${REPO_NAME[r]} has no commit ${SOURCES[r]} (git -C ${repoDir(r)} fetch origin)`);
const sha12 = (r: Repo): string => SOURCES[r].slice(0, 12);

// ------------------------------------------------------------------------------------------------------------ the build

const LOGO_FILES = ['logo.png', 'logo.webp', 'logo.jpg', 'logo.jpeg'];
type Built = { manifest: MediaManifest; files: Map<string, Buffer>; log: string[] };

function build(): Built {
  const files = new Map<string, Buffer>();
  const log: string[] = [];
  const rejected: Rejected[] = [];
  const names = (() => {
    try { return new Map<string, string>((JSON.parse(fs.readFileSync(path.join(ROOT, 'content', 'story', 'catalog-apps.json'), 'utf8')).apps as any[]).map(a => [a.id, a.name])); } catch { return new Map<string, string>(); }
  })();
  const put = (rel: string, bytes: Buffer): void => { files.set(rel, bytes); };
  const named = (dir: string, base: string, bytes: Buffer): string => `${dir}/${base}.${hash10(bytes)}.webp`;

  const wanted = args.apps && args.apps !== 'true' ? args.apps.split(',').filter(Boolean).sort() : usedAppIds(ROOT);
  const apps: Record<string, AppMedia> = {};
  const noMedia: string[] = [];
  for (const id of wanted) {
    // the name an alt text and a caption use: the voice rule bars an exclamation mark there, so "Convert to it!" is written "Convert to it"
    const name = (names.get(id) || id.replace(/(^|-)([a-z])/g, (_m, s: string, c: string) => `${s ? ' ' : ''}${c.toUpperCase()}`)).replace(/\s*!+/g, '');
    if (!names.has(id)) log.push(`${id}: not in content/story/catalog-apps.json, named ${JSON.stringify(name)}`);
    // the logo: the app's own mark from the store listing, the PNG (transparency) before the others
    let logo: MediaImage | null = null;
    const logoFile = LOGO_FILES.map(f => `apps/${id}/metadata/${f}`).find(p => hasBlob('marketplace', SOURCES.marketplace, p));
    if (REJECT_LOGO[id]) { /* held back by eye: the reason is in `rejected` below */ }
    else if (logoFile) {
      const webp = encodeLogo(blob('marketplace', SOURCES.marketplace, logoFile));
      const size = imageSize(webp)!;
      const rel = named(`portal/apps/${id}`, 'logo', webp);
      put(rel, webp);
      logo = { file: rel, w: size.w, h: size.h, alt: `${name} logo`, source: `CI-Marketplace ${logoFile}@${sha12('marketplace')}` };
      note(`  ${id} logo ${webp.length} B`);
    } else log.push(`${id}: the Marketplace has no logo for it`);
    // the screenshot: the QA run's capture, unless it was rejected by eye or does not exist
    let shot: MediaShot | null = null;
    const shotPath = `e2e/screenshots/${id}.png`;
    const source = `CI-Marketplace ${shotPath}@${sha12('marketplace')}`;
    const docs = DOCS_SHOTS[id];
    if (docs) {
      // a first-party app's screen from the product's own documentation (CI-Docs, sample data): it takes the slot, and the QA run's capture, if any, is left out for it
      const seen = oid12('docs', SOURCES.docs, docs.path);
      if (seen !== docs.oid) die(`${id}: ${docs.path} is blob ${seen} at ${sha12('docs')}, not the ${docs.oid} that was looked at: look at it again, then update DOCS_SHOTS (scripts/story/lib/media-docs.mts)`);
      const { bytes, quality } = encodeShot(blob('docs', SOURCES.docs, docs.path));
      const size = imageSize(bytes)!;
      const rel = named(`portal/apps/${id}`, 'shot', bytes);
      put(rel, bytes);
      shot = { file: rel, w: size.w, h: size.h, alt: `${name} ${docs.shows} in a browser`, caption: docsCaption(name), source: `CI-Docs ${docs.path}@${sha12('docs')}` };
      note(`  ${id} shot ${(bytes.length / 1024).toFixed(1)} KB q${quality} (CI-Docs)`);
      if (hasBlob('marketplace', SOURCES.marketplace, shotPath)) rejected.push({ kind: 'shot', id, source, reason: REJECT_SHOT[id] || SUPERSEDED_QA[id] || 'Replaced by the CI-Docs capture of the same app.' });
    }
    else if (REJECT_SHOT[id]) rejected.push({ kind: 'shot', id, source, reason: REJECT_SHOT[id] });
    else if (!hasBlob('marketplace', SOURCES.marketplace, shotPath)) rejected.push({ kind: 'shot', id, source, reason: `The source has none: ${shotPath} does not exist.` });
    else if (!SHOT_SHOWS[id] || !VETTED[id]) {
      // a capture nobody has looked at is never shipped, and the manifest says so (the test notes it as a warning: someone should look)
      log.push(`${id}: ${shotPath} exists but nobody has looked at it (no entry in SHOT_SHOWS and VETTED): not used`);
      rejected.push({ kind: 'shot', id, source, reason: UNLOOKED });
    }
    else {
      const seen = oid12('marketplace', SOURCES.marketplace, shotPath);
      if (seen !== VETTED[id]) die(`${id}: ${shotPath} is blob ${seen} at ${sha12('marketplace')}, not the ${VETTED[id]} that was looked at: look at it again, then update VETTED (and SHOT_SHOWS)`);
      const { bytes, quality } = encodeShot(blob('marketplace', SOURCES.marketplace, shotPath));
      const size = imageSize(bytes)!;
      const rel = named(`portal/apps/${id}`, 'shot', bytes);
      put(rel, bytes);
      shot = { file: rel, w: size.w, h: size.h, alt: `${name} ${SHOT_SHOWS[id]} in a browser`, caption: appCaption(name), source };
      note(`  ${id} shot ${(bytes.length / 1024).toFixed(1)} KB q${quality}`);
    }
    if (!logo && !shot) noMedia.push(id); else apps[id] = { name, logo, shot };
  }

  // a capture looked at and left out for an app no story names (yet) is on record all the same: the next story that names it finds the answer
  const wantedSet = new Set(wanted);
  for (const [id, reason] of Object.entries(REJECT_SHOT)) {
    if (!wantedSet.has(id)) rejected.push({ kind: 'shot', id, source: `CI-Marketplace e2e/screenshots/${id}.png@${sha12('marketplace')}`, reason });
  }
  // the logos held back by eye (every one, whether a story names the app yet or not: the rule must already hold when one does)
  for (const [id, reason] of Object.entries(REJECT_LOGO)) {
    const logoFile = LOGO_FILES.map(f => `apps/${id}/metadata/${f}`).find(p => hasBlob('marketplace', SOURCES.marketplace, p)) || `apps/${id}/metadata/logo.png`;
    rejected.push({ kind: 'logo', id, source: `CI-Marketplace ${logoFile}@${sha12('marketplace')}`, reason });
  }

  // Companion Hub and the Companion account page
  const ci: MediaManifest['ci'] = { hub: [], portal: [] };
  if (args['no-ci'] !== 'true') {
    for (const which of ['hub', 'portal'] as const) {
      for (const c of CI_CHOICES[which]) {
        const seen = oid12(c.repo, SOURCES[c.repo], c.path);
        if (seen !== c.oid) die(`${which}/${c.id}: ${c.path} is blob ${seen} at ${sha12(c.repo)}, not the ${c.oid} that was looked at: look at it again, then update CI_CHOICES`);
        const { bytes, quality } = encodeShot(blob(c.repo, SOURCES[c.repo], c.path));
        const size = imageSize(bytes)!;
        const rel = named('portal/ci', `${which}-${c.id}`, bytes);
        put(rel, bytes);
        ci[which].push({ id: c.id, file: rel, w: size.w, h: size.h, alt: c.alt, caption: c.caption, source: `${REPO_NAME[c.repo]} ${c.path}@${sha12(c.repo)}` } as CiShot);
        note(`  ${which}/${c.id} ${(bytes.length / 1024).toFixed(1)} KB q${quality}`);
      }
    }
    const chosen = new Set(Object.values(CI_CHOICES).flat().map(c => `${c.repo}:${c.path}`));
    for (const r of CI_REJECT) {
      if (chosen.has(`${r.repo}:${r.path}`)) die(`${r.path} is both chosen and rejected`);
      rejected.push({ kind: 'ci', id: `${r.repo}/${path.basename(r.path, path.extname(r.path))}`, source: `CI-${r.repo === 'docs' ? 'Docs' : REPO_NAME[r.repo].slice(3)} ${r.path}@${REVIEWED[r.repo].slice(0, 12)}`, reason: r.reason });
    }
    // CI-Docs `public/screenshots/`: every file of the folder at the pin that does not ship is accounted for (a file no rule names stops the build)
    const prefix = 'public/screenshots/';
    const rels = git('docs', ['ls-tree', '-r', '--name-only', SOURCES.docs, '--', prefix]).toString().split('\n').filter(Boolean).map(p => p.slice(prefix.length));
    const appPaths = Object.fromEntries(Object.entries(DOCS_APP_REJECT).map(([id, v]) => [id, v.path]));
    let left: ReturnType<typeof docsRejections>;
    try { left = docsRejections(rels, new Set(Object.values(DOCS_SHOTS).map(d => d.path)), appPaths); } catch (e) { return die((e as Error).message); }
    for (const r of left) {
      const src = `CI-Docs ${prefix}${r.rel}@${sha12('docs')}`;
      rejected.push(r.app ? { kind: 'shot', id: r.app, source: src, reason: r.reason } : { kind: 'ci', id: `docs/${r.rel.replace(/\.[a-z0-9]+$/, '')}`, source: src, reason: r.reason });
    }
  }
  rejected.sort((a, b) => a.kind.localeCompare(b.kind) || a.id.localeCompare(b.id) || a.source.localeCompare(b.source));
  const manifest: MediaManifest = { v: 1, sources: SOURCES, apps, ci, noMedia, rejected };
  return { manifest, files, log };
}

const built = build();
const text = `${stable(built.manifest)}\n`;
const subset = !!(args.apps && args.apps !== 'true') || args['no-ci'] === 'true';
for (const l of built.log) console.log(`  note: ${l}`);

if (args.check === 'true') {
  const problems: string[] = [];
  const disk = fs.existsSync(manifestFile) ? fs.readFileSync(manifestFile, 'utf8') : '';
  if (disk !== text) problems.push(`${MANIFEST} is not what the sources give (run pnpm run story:media)`);
  for (const [rel, bytes] of built.files) {
    const f = path.join(ROOT, rel);
    if (!fs.existsSync(f)) problems.push(`${rel} is missing`);
    else if (!fs.readFileSync(f).equals(bytes)) problems.push(`${rel} differs from what this ffmpeg makes`);
  }
  if (problems.length) { console.error(`story:media --check: ${problems.length} problem${problems.length === 1 ? '' : 's'} (${ffmpegLine})\n${problems.slice(0, 12).map(p => `  x ${p}`).join('\n')}`); process.exit(1); }
  console.log(`story:media --check: ${built.files.size} files and the manifest are current (${ffmpegLine})`);
  process.exit(0);
}

// write: the files first, then the manifest; a full build removes the generated files no longer named
const write = (rel: string, data: Buffer | string): void => { const f = path.join(OUT, rel); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, data); };
for (const [rel, bytes] of built.files) write(rel, bytes);
write(MANIFEST, text);
let removed = 0;
if (!subset) {
  const sweep = (dirRel: string): void => {
    const dir = path.join(OUT, dirRel);
    if (!fs.existsSync(dir)) return;
    for (const name of fs.readdirSync(dir)) {
      const rel = `${dirRel}/${name}`;
      if (fs.statSync(path.join(OUT, rel)).isDirectory()) { sweep(rel); if (!fs.readdirSync(path.join(OUT, rel)).length) fs.rmdirSync(path.join(OUT, rel)); }
      else if (!built.files.has(rel)) { fs.rmSync(path.join(OUT, rel)); removed++; }
    }
  };
  sweep('portal/apps'); sweep('portal/ci');
}

// the summary: what was made, what was left out, how big
const problems = subset ? [] : checkManifest(built.manifest, OUT);
const apps = Object.values(built.manifest.apps);
const total = [...built.files.values()].reduce((a, b) => a + b.length, 0);
const biggest = [...built.files].sort((a, b) => b[1].length - a[1].length).slice(0, 3).map(([rel, b]) => `${rel} ${(b.length / 1024).toFixed(1)} KB`);
console.log(`story:media: ${apps.filter(a => a.logo).length} logos, ${apps.filter(a => a.shot).length} app screenshots, ${built.manifest.ci.hub.length} Companion Hub and ${built.manifest.ci.portal.length} account page screenshots; ${built.manifest.rejected.length} rejected with their reasons${built.manifest.noMedia.length ? `; no media at all: ${built.manifest.noMedia.join(', ')}` : ''}`);
console.log(`story:media: ${built.files.size} files, ${(total / 1024).toFixed(0)} KB (${(total / 1024 / 1024).toFixed(2)} MB)${removed ? `, ${removed} old file${removed === 1 ? '' : 's'} removed` : ''}; biggest: ${biggest.join('; ')}`);
console.log(`story:media: pinned ${REPOS.map(r => `${REPO_NAME[r]} ${sha12(r)}`).join(', ')}; ${ffmpegLine}; wrote ${path.relative(process.cwd(), path.join(OUT, MANIFEST)) || MANIFEST}`);
if (problems.length) { console.error(problems.map(p => `  x ${p}`).join('\n')); process.exit(1); }
