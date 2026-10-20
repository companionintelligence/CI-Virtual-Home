// Cast lint: checks the authored cast plan (content/story/cast-plan.json) against every rule the fleet has, before a writer
// opens a family file. Exits 1 on any error. Warnings print and never fail.
//
//   node --experimental-strip-types scripts/story/cast-lint.mts            the checks, then the distribution tables
//   node --experimental-strip-types scripts/story/cast-lint.mts --quiet    the checks only
//
// What it checks (the numbers are validator.md "Fleet", reference/story/personas.md and the schema):
//   shape        slugs, surnames, names, ages, roles, archetypes, rooms by exact name, schema patterns and enums
//   fit          who can sleep where, a nursery means a baby, a baby means a crib, nobody under 16 has a companion (age rule 16),
//                a couple has an adult with a job archetype (organiser, builder or one of the eight story v3 archetypes), the household type matches the ages
//   flagship     Sally, John, Steve and Jean (Brennan) in seraphine, bgfamily and familyhouse-nora only
//   fleet        at least 70 distinct apps, no third-party app in more than 12 of 30 families, the 14 story-rich apps in at
//                least three, each of the ten topics possible in at least ten, small-business share reachable, gamer in at
//                most 12, organiser, builder and learner in at least 8, narrator counts equal voices.json
//   uniqueness   surname, place, companion name, first name (at most twice); none of it repeated outside the flagship
//   apps         every signature app is in the catalog, story-safe, boot-tested and has a QA screenshot (else it is listed
//                in the family's reviewNeeded, which the owner must then clear in reviewed.json)
//   sync         content/story/casting.json and reference/story/cast.md equal what build-casting.mts produces
//
// The signature apps are a proxy for the stories: the real fleet metrics are the validator's (`story:validate --complete`),
// which count the apps the beats show. The margins here (a cap of 12 with a warning from 11) leave the writers room.
import fs from 'node:fs';
import path from 'node:path';
import {
  ARCHETYPES, APP_TOPICS, ROLE_GAPS, TOPICS, allApps, ROOT, build, deriveAnchors, findRoom, hasCrib, loadHouse, loadRoles, sleepCapacity, topicsPossible,
  type Archetype, type HouseInfo, type Plan, type PlanFamily, type PlanMember,
} from './build-casting.mts';

const J = (...p: string[]): any => JSON.parse(fs.readFileSync(path.join(ROOT, ...p), 'utf8'));
const quiet = process.argv.includes('--quiet');

interface Msg { sev: 'error' | 'warn'; at: string; text: string }
const msgs: Msg[] = [];
const E = (at: string, text: string): void => { msgs.push({ sev: 'error', at, text }); };
const W = (at: string, text: string): void => { msgs.push({ sev: 'warn', at, text }); };

const plan: Plan = J('content', 'story', 'cast-plan.json');
const catalog = J('content', 'story', 'catalog-apps.json');
const voices = J('content', 'story', 'voices.json');
const roles = loadRoles();
const index = J('content', 'houses', 'index.json').houses as { id: string }[];
const apps = new Map<string, any>(catalog.apps.map((a: any) => [a.id, a]));
const FIRST_PARTY = new Set(['ci-memory', 'ci-hermes', 'ci-openclaw']);
const AGENT_APPS = ['ci-hermes', 'ci-openclaw', 'ci-memory'];
const storyRich: string[] = (catalog.meta?.top15 ?? []).filter((a: any) => a.qa === 'screenshot').map((a: any) => a.id);

// the numbers
const N = 30, APPS_MIN = 70, SHARE_MAX = 12, SHARE_WARN = 10, TOPIC_MIN = 10, RICH_MIN = 3, GAMER_MAX = 12, ARCH_MIN = 8;
const SB_SHARE = 0.18, BEATS = 26, SB_MAX_SHARE = 0.45, FIRST_NAME_MAX = 2;
const FLAGSHIP_HOUSES = ['seraphine', 'bgfamily', 'familyhouse-nora'];
const FLAG = {
  Sally: { age: 43, role: 'parent', archetype: 'organiser' }, John: { age: 45, role: 'parent', archetype: 'builder' },
  Steve: { age: 16, role: 'teen', archetype: 'gamer' }, Jean: { age: 14, role: 'teen', archetype: 'learner' },
} as const;
const ROLE_ENUM = ['parent', 'partner', 'adult-child', 'teen', 'child', 'baby', 'grandparent', 'housemate', 'visitor'];
const HOUSEHOLDS = Object.keys(plan.households);
const POOLS: Record<Archetype, Set<string>> = {
  organiser: new Set('ci-planning nextcloud libreoffice onlyoffice collabora-online cryptpad paperless papra stirling-pdf bentopdf vaultwarden joplin bookstack n8n yuvomi homehub akaunting invoice-ninja invio twenty espocrm kimai docuseal opnform nocodb wordpress wallos firefly-iii monetr spliit vikunja planka donetick baikal'.split(' ')),
  builder: new Set('code-server forgejo gitea open-webui ci-openclaw jupyterlab n8n activepieces opencode aider uptime-kuma pi-hole'.split(' ')),
  gamer: new Set('steam-headless jellyfin immich'.split(' ')),
  learner: new Set('open-webui anything-llm libretranslate obsidian logseq jupyterlab ci-spellbook koodo-reader booklore audiobookshelf calibre-web kokoro razzia readeck linkwarden'.split(' ')),
  maker: new Set('immich ci-planning obsidian jellyfin penpot inkscape excalidraw tldraw drawio blockbench audiomass navidrome mstream photoprism librephotos foldergram wordpress'.split(' ')),
  host: new Set('immich jellyfin home-assistant kitchenowl mealie hortusfox yuvomi homehub frigate navidrome audiobookshelf wanderer airtrail ntfy wallos ci-planning'.split(' ')),
  // story v3 (reference/story/persona-bible.md 5.3; the same pools as content/story/personas.json)
  'tech-family': new Set('home-assistant pi-hole forgejo ntfy uptime-kuma open-webui ollama vaultwarden n8n syncthing'.split(' ')),
  'business-owner': new Set('nextcloud invoice-ninja paperless docuseal akaunting twenty vaultwarden anything-llm solidtime grist bookstack baikal libreoffice stirling-pdf whisper-webui ci-memory'.split(' ')),
  creative: new Set('immich nextcloud penpot inkscape open-webui invoice-ninja vaultwarden whisper-webui docuseal freecut audiomass photoview pingvin-share syncthing navidrome'.split(' ')),
  contractor: new Set('invoice-ninja immich homebox lubelogger paperless docuseal solidtime vaultwarden nextcloud radicale stirling-pdf open-webui planka akaunting'.split(' ')),
  marketer: new Set('open-webui ci-memory nextcloud ghost penpot vaultwarden twenty whisper-webui listmonk plausible n8n inkscape freecut mixpost solidtime grist'.split(' ')),
  lawyer: new Set('paperless nextcloud docuseal open-webui libreoffice vaultwarden stirling-pdf cryptgeon ollama whisper-webui radicale solidtime invoice-ninja bookstack twenty ci-memory'.split(' ')),
  journalist: new Set('whisper-webui paperless obsidian open-webui nextcloud vaultwarden ci-memory stirling-pdf libretranslate linkwarden libreoffice cryptgeon joplin anything-llm miniflux element'.split(' ')),
  educator: new Set('open-webui paperless nextcloud libreoffice libretranslate joplin stirling-pdf vaultwarden razzia excalidraw ci-planning radicale calibre-web'.split(' ')),
};
/** the archetypes that are a job (a couple needs one adult who does one; a business family needs one who runs it) */
const JOBS = new Set<Archetype>(['organiser', 'builder', 'tech-family', 'business-owner', 'creative', 'contractor', 'marketer', 'lawyer', 'journalist', 'educator']);
/** a family that is a business keeps at least one of these (decisions of 2026-10-19: organiser, builder or business-owner) */
const BUSINESS_LEADS = new Set<Archetype>(['organiser', 'builder', 'business-owner']);
/** apps the story pools dropped (storySafe avoid) that the cast plan's unrewritten rows still list: warnings, not errors, until each family is recast */
const UNTIL_RECAST = new Set<string>(['kiwix']);
/** age rule 16 (v3-decisions "Age rule"): no agent companion under this age */
const COMPANION_AGE = 16;
const REQUIRED_TOPICS = ['home', 'food', 'iot', 'productivity', 'privacy'] as const;

// ---- shape: only known keys ---------------------------------------------------------------------------------------------------
const FAM_KEYS = new Set(['slug', 'house', 'surname', 'place', 'flagship', 'household', 'business', 'businessText', 'tenure', 'narrator', 'reason', 'household_text', 'care', 'fitNote', 'reviewNeeded', 'signatureApps', 'beatApps', 'members']);
const MEM_KEYS = new Set(['id', 'name', 'age', 'role', 'archetype', 'work', 'room', 'sleepsIn', 'roomLabel', 'companion']);
const BAD_COPY: [RegExp, string][] = [
  [/[\u2013\u2014]/, 'an em or en dash'], [/!/, 'an exclamation mark'],
  [/\b(seamless(ly)?|leverage|revolutionary|democratize|for everyone)\b/i, 'a banned buzzword'],
  [/\b(chatbot|degoogle|log in)\b/i, 'a banned product word'],
];
function copy(at: string, s: unknown): void {
  if (typeof s !== 'string') return;
  for (const [re, what] of BAD_COPY) if (re.test(s)) E(at, `${what} in "${s.slice(0, 60)}"`);
}

// ---- creator fragments (the test's own list, plus every author in the specs) --------------------------------------------------------
const fragments = new Set<string>(['nora', 'olcia', 'schnuck', 'ornilia', 'turbogoku', 'clumsy', 'simmer', 'redo', 'roark', 'sarina', 'plnch', 'axiis', 'sims']);
for (const h of index) {
  const spec = J('content', 'houses', `${h.id}.json`);
  if (spec.author) { const a = String(spec.author).toLowerCase().replace(/[^a-z]/g, ''); if (a.length >= 4) fragments.add(a); }
}

// ---- the plan, family by family ----------------------------------------------------------------------------------------------------------------
const houseInfo = new Map<string, HouseInfo>();
for (const h of index) houseInfo.set(h.id, loadHouse(h.id, roles));

const fams = plan.families;
if (fams.length !== N) E('plan', `${fams.length} families (need ${N})`);
const dup = (xs: string[]): string[] => xs.filter((x, i) => xs.indexOf(x) !== i);
for (const d of dup(fams.map((f) => f.slug))) E('slug', `${d} appears twice`);
for (const d of dup(fams.map((f) => f.house))) E('house', `${d} appears twice`);
for (const h of index) if (!fams.some((f) => f.house === h.id)) E('house', `${h.id} has no family`);
for (const f of fams) if (!houseInfo.has(f.house)) E(f.slug, `house ${f.house} is not in content/houses/index.json`);

const flagFams = fams.filter((f) => f.flagship);
if (flagFams.map((f) => f.house).sort().join() !== [...FLAGSHIP_HOUSES].sort().join()) E('flagship', `flagship homes must be ${FLAGSHIP_HOUSES.join(', ')}; the plan has ${flagFams.map((f) => f.house).join(', ') || 'none'}`);

const companionFleet = new Map<string, string>();      // name -> slug (non-flagship)
const firstNames = new Map<string, string[]>();
const catalogWords = new Set<string>();
for (const a of catalog.apps) { catalogWords.add(String(a.name).toLowerCase()); catalogWords.add(String(a.id).toLowerCase()); }

for (const f of fams) {
  const at = f.slug;
  for (const k of Object.keys(f)) if (!FAM_KEYS.has(k)) E(at, `unknown key ${k}`);
  const house = houseInfo.get(f.house);
  if (!/^[a-z]+(-[a-z]+){0,2}$/.test(f.slug) || f.slug.length > 32) E(at, 'slug shape (letters, up to three parts)');
  for (const frag of fragments) if (f.slug.includes(frag)) E(at, `slug contains the creator fragment "${frag}"`);
  if (f.slug.includes(f.house)) E(at, 'slug is derived from the house id');
  if (plan.retiredSlugs.includes(f.slug)) E(at, 'slug reuses a retired family from the old casting');
  if (!/^[A-Z][A-Za-z'’]+(-[A-Z][A-Za-z'’]+)?$/.test(f.surname)) E(at, `surname "${f.surname}" does not match the schema`);
  if (!f.flagship && f.slug !== f.surname.toLowerCase()) E(at, `slug should be the surname in lower case (${f.surname.toLowerCase()})`);
  if (f.flagship && !f.slug.startsWith('brennan')) E(at, 'flagship slugs start with brennan');
  if (!/^[A-Z][A-Za-z' ]{3,30}$/.test(f.place)) E(at, `place "${f.place}" does not match the schema`);
  if (!HOUSEHOLDS.includes(f.household)) E(at, `household ${f.household}`);
  if (typeof f.business !== 'boolean') E(at, 'business must be true or false');
  if (!['owner', 'renter'].includes(f.tenure)) E(at, `tenure ${f.tenure}`);
  const voice = voices.voices[f.narrator];
  if (!voice) E(at, `narrator ${f.narrator} is not in voices.json`); else if (voice.status !== 'ready') E(at, `narrator ${f.narrator} has status ${voice.status}`);
  for (const key of ['reason', 'household_text', 'care', 'fitNote', 'businessText'] as const) copy(`${at}.${key}`, f[key]);
  if (!f.reason || f.reason.length < 20) E(at, 'reason: one line saying why this household fits this house');
  if (f.business && !f.businessText) E(at, 'a business family needs businessText');

  // ---- members
  const ms = f.members;
  if (ms.length < 2 || ms.length > 6) E(at, `${ms.length} members (2 to 6)`);
  const archs = new Set(ms.map((m) => m.archetype).filter(Boolean));
  if (archs.size < 2) E(at, 'a family covers at least two archetypes');
  for (const d of dup(ms.map((m) => m.id))) E(at, `member id ${d} twice`);
  for (const d of dup(ms.map((m) => m.name))) E(at, `member name ${d} twice`);
  let companions = 0;
  for (const m of ms) {
    const mat = `${at}/${m.id}`;
    for (const k of Object.keys(m)) if (!MEM_KEYS.has(k)) E(mat, `unknown key ${k}`);
    if (!/^[a-z][a-z0-9-]{1,31}$/.test(m.id)) E(mat, 'id shape');
    if (!/^[A-Z][a-zA-Z'’]{1,19}$/.test(m.name)) E(mat, `name "${m.name}" does not match the schema`);
    if (!Number.isInteger(m.age) || m.age < 0 || m.age > 99) E(mat, `age ${m.age}`);
    if (!ROLE_ENUM.includes(m.role)) E(mat, `role ${m.role} is not in the schema enum`);
    if (m.work && m.work.length > 60) E(mat, 'work is longer than 60 characters');
    copy(`${mat}.work`, m.work); copy(`${mat}.roomLabel`, m.roomLabel);
    if (m.archetype === null) { if (m.role !== 'baby') E(mat, 'only a baby has no archetype'); }
    else if (!ARCHETYPES.includes(m.archetype)) E(mat, `archetype ${m.archetype}`);
    if (m.role === 'baby' && m.age > 2) E(mat, 'a baby is under 3');
    if (m.age < 13 && m.archetype && !['learner', 'maker'].includes(m.archetype)) E(mat, `a child under 13 is a learner or a maker (Steam needs an adult Valve account), not ${m.archetype}`);
    if (JOBS.has(m.archetype as Archetype) && m.age < 18 && !f.flagship) W(mat, `a ${m.archetype} under 18`);
    const k = m.name.toLowerCase();
    if (!firstNames.has(k)) firstNames.set(k, []);
    firstNames.get(k)!.push(f.slug);
    if (m.companion) {
      companions++;
      if (m.age < COMPANION_AGE || ['baby', 'child', 'visitor'].includes(m.role)) E(mat, `children, babies, visitors and anyone under ${COMPANION_AGE} have no companion (age rule 16)`);
      if (!/^[A-Z][a-z]{2,13}$/.test(m.companion)) E(mat, `companion name "${m.companion}" does not match the schema`);
      if (catalogWords.has(m.companion.toLowerCase())) E(mat, `companion name ${m.companion} is a catalog app name`);
      if (!f.flagship) { if (companionFleet.has(m.companion)) E(mat, `companion name ${m.companion} is also in ${companionFleet.get(m.companion)}`); companionFleet.set(m.companion, f.slug); }
    }
    // the room, by exact name
    if (house) {
      const room = findRoom(house, m.room);
      if (!room) E(mat, `room "${m.room}" is not in ${f.house}: ${house.rooms.map((r) => r.key).join(', ')}`);
      else {
        if (!room.roles.length) W(mat, `${room.key} has no room role in roles.json (kindNames/rooms): its chapter cannot be set by room role; ${room.name} would need a kindNames pattern`);
        if (m.archetype && ['gamer', 'learner', 'organiser', 'builder'].includes(m.archetype) && room.area < 4) W(mat, `${room.key} is ${room.area} m2: too small for a stage`);
      }
      if (m.sleepsIn && !findRoom(house, m.sleepsIn)) E(mat, `sleepsIn "${m.sleepsIn}" is not in ${f.house}`);
    }
  }
  if (companions < 1 || companions > 3) E(at, `${companions} companions (1 to 3)`);

  // ---- household type matches the ages
  const minors = ms.filter((m) => m.age < 18), small = ms.filter((m) => m.age < 13);
  const grand = ms.filter((m) => m.role === 'grandparent');
  if (f.household === 'solo-or-couple') {
    if (minors.length) E(at, 'solo-or-couple has no child at home');
    if (ms.length > 2) E(at, 'solo-or-couple is one or two people');
    if (![...archs].some((a) => JOBS.has(a as Archetype))) E(at, 'a couple needs an adult with a job archetype (organiser, builder, tech-family, business-owner, creative, contractor, marketer, lawyer, journalist or educator)');
    if (!ms.every((m) => m.role === 'partner')) W(at, 'couple members are partners');
  }
  if (f.household === 'young-family' && !small.length) E(at, 'young-family needs a child under 13');
  if (f.household === 'older-kids' && !ms.some((m) => m.role === 'teen' || m.role === 'adult-child')) E(at, 'older-kids needs a teen or an adult child');
  if (f.household === 'older-kids' && small.some((m) => m.role === 'baby')) W(at, 'older-kids with a baby');
  if (f.household === 'grandparents' && (!grand.length || !ms.some((m) => ['child', 'baby', 'teen'].includes(m.role)))) E(at, 'grandparents needs a grandparent and a grandchild');

  // ---- nursery and baby
  if (house) {
    const nursery = house.rooms.filter((r) => hasCrib(r));
    const babies = ms.filter((m) => m.role === 'baby');
    if (nursery.length && !babies.length && !f.flagship) E(at, `${f.house} has a nursery or a crib (${nursery.map((r) => r.name).join(', ')}): a family with a baby lives here`);
    if (nursery.length && !babies.length && f.flagship) W(at, `${f.house} has a nursery that stays a spare room (flagship)`);
    for (const b of babies) {
      const r = b.sleepsIn ? findRoom(house, b.sleepsIn) : null;
      if (r && !hasCrib(r)) W(`${at}/${b.id}`, `${b.sleepsIn} has no crib`);
      if (!ms.some((m) => m.archetype === 'host') && !f.flagship) W(at, 'a baby home has a host (shared beats)');
    }
  }

  // ---- sleeping
  if (house) {
    const byRoom = new Map<string, PlanMember[]>();
    for (const m of ms) {
      if (!m.sleepsIn) { if (!f.fitNote) E(`${at}/${m.id}`, 'sleepsIn is null: say why in fitNote'); continue; }
      if (m.role === 'baby') continue;
      if (!byRoom.has(m.sleepsIn)) byRoom.set(m.sleepsIn, []);
      byRoom.get(m.sleepsIn)!.push(m);
    }
    for (const [roomKey, people] of byRoom) {
      const r = findRoom(house, roomKey);
      if (!r) continue;
      const cap = sleepCapacity(r);
      if (people.length > cap) (f.fitNote ? W : E)(at, `${people.map((p) => p.name).join(' and ')} ${people.length > 1 ? 'sleep' : 'sleeps'} in ${roomKey}, which has room for ${cap}${f.fitNote ? ' (fitNote explains)' : ''}`);
    }
  }

  // ---- signature apps
  const sig = f.signatureApps;
  if (sig.length < 5 || sig.length > 7) E(at, `${sig.length} signature apps (5 to 7)`);
  for (const d of dup(sig)) E(at, `signature app ${d} twice`);
  if (!sig.some((a) => AGENT_APPS.includes(a))) E(at, 'the signature apps include the agent app (ci-hermes, ci-openclaw or ci-memory)');
  for (const id of f.reviewNeeded ?? []) if (!sig.includes(id)) E(at, `reviewNeeded ${id} is not a signature app`);
  for (const id of sig) {
    const a = apps.get(id);
    if (!a) { E(at, `signature app ${id} is not in the catalog`); continue; }
    // Kiwix is storySafe avoid (it ships an empty library) but six rows of the unrewritten plan still list it: a warning until the recast replaces it
    if (a.storySafe === 'avoid') (UNTIL_RECAST.has(id) ? W : E)(at, `${id} is marked avoid${UNTIL_RECAST.has(id) ? ' (still in the plan: the recast replaces it)' : ''}`);
    if (a.qa === 'not-boot-tested') E(at, `${id} was not boot-tested`);
    if (a.qa === 'no-screenshot' && !(f.reviewNeeded ?? []).includes(id)) E(at, `${id} has no QA screenshot (the validator asks for a reviewed.json entry per beat); pick another or list it in reviewNeeded`);
    if (a.inLiveStore === false) E(at, `${id} is not in the live store`);
  }
  for (const [t, id] of Object.entries(f.beatApps ?? {})) {
    if (!(TOPICS as readonly string[]).includes(t)) E(at, `beatApps topic ${t}`);
    else if (!id || !apps.has(id)) E(at, `beatApps.${t} ${id} is not in the catalog`);
    else {
      if (!APP_TOPICS[t as keyof typeof APP_TOPICS].has(id)) E(at, `beatApps.${t} ${id} does not carry the ${t} topic`);
      if (sig.includes(id)) E(at, `beatApps.${t} ${id} is already a signature app`);
      const a = apps.get(id);
      if (a.storySafe === 'avoid' || a.qa !== 'screenshot') E(at, `beatApps.${t} ${id} is not story-safe with a QA screenshot`);
    }
  }
  for (const m of ms) {
    if (!m.archetype) continue;
    if (!sig.some((a) => POOLS[m.archetype!].has(a))) {
      // the only pool app an unrewritten row has is one the pool has since dropped (kiwix): a warning until the recast
      const dropped = sig.some((a) => UNTIL_RECAST.has(a));
      (dropped ? W : E)(`${at}/${m.id}`, `no signature app from the ${m.archetype} pool (${[...POOLS[m.archetype]].slice(0, 6).join(', ')} ...)${dropped ? '; the plan still lists a dropped app: the recast replaces it' : ''}`);
    }
  }
  const tp = topicsPossible(f);
  const lacking = REQUIRED_TOPICS.filter((t) => !tp.includes(t));
  if (lacking.length) E(at, `no signature or beat app covers ${lacking.join(', ')}: name one in beatApps`);
  if (f.business && !ms.some((m) => BUSINESS_LEADS.has(m.archetype as Archetype))) E(at, 'a business family has an organiser, a builder or a business-owner');
}

// ---- flagship ---------------------------------------------------------------------------------------------------------------------------------
for (const f of flagFams) {
  const at = f.slug;
  if (f.surname !== 'Brennan') E(at, 'the flagship surname is Brennan');
  if (!f.business) E(at, "the flagship is a business family (Sally's consultancy)");
  if (f.household !== 'older-kids') E(at, 'the flagship household is older-kids');
  if (f.members.length !== 4) E(at, 'the flagship family has four members');
  for (const [name, spec] of Object.entries(FLAG)) {
    const m = f.members.find((x) => x.name === name);
    if (!m) { E(at, `${name} is missing`); continue; }
    if (m.age !== spec.age || m.role !== spec.role || m.archetype !== spec.archetype) E(`${at}/${m.id}`, `${name} is ${spec.age}, ${spec.role}, ${spec.archetype}`);
  }
}
for (const f of fams.filter((x) => !x.flagship)) {
  if (f.surname === 'Brennan') E(f.slug, 'only the flagship family is Brennan');
  for (const m of f.members) if (Object.keys(FLAG).includes(m.name)) E(`${f.slug}/${m.id}`, `${m.name} is a flagship first name`);
}

// ---- uniqueness ----------------------------------------------------------------------------------------------------------------------------
const nonFlag = fams.filter((f) => !f.flagship);
for (const d of dup(nonFlag.map((f) => f.surname.toLowerCase()))) E('fleet', `surname ${d} appears in two families`);
const placeOwners = new Map<string, string[]>();
for (const f of fams) { const k = f.place.toLowerCase(); if (!placeOwners.has(k)) placeOwners.set(k, []); placeOwners.get(k)!.push(f.slug); }
for (const [p, owners] of placeOwners) if (owners.length > 1 && !owners.every((o) => fams.find((f) => f.slug === o)!.flagship)) E('fleet', `place ${p} is in ${owners.join(' and ')}`);
for (const [name, owners] of firstNames) {
  const outside = owners.filter((o) => !fams.find((f) => f.slug === o)!.flagship);
  if (outside.length > FIRST_NAME_MAX) E('fleet', `first name ${name} is used ${outside.length} times outside the flagship (${outside.join(', ')})`);
}
for (const f of flagFams) for (const m of f.members) if (m.companion) for (const o of nonFlag) for (const om of o.members) if (om.companion === m.companion) E('fleet', `companion ${m.companion} is in the flagship and in ${o.slug}`);

// ---- fleet counts -------------------------------------------------------------------------------------------------------------------------
const appFamilies = new Map<string, string[]>();
for (const f of fams) for (const a of allApps(f)) { if (!appFamilies.has(a)) appFamilies.set(a, []); appFamilies.get(a)!.push(f.slug); }
const distinct = appFamilies.size;
if (distinct < APPS_MIN) E('fleet', `${distinct} distinct apps in the plan (need at least ${APPS_MIN}; the stories add more, but the cast must carry them)`);
for (const [id, owners] of appFamilies) {
  if (FIRST_PARTY.has(id)) continue;
  if (owners.length > SHARE_MAX) E('fleet', `${id} is in the plan of ${owners.length} of ${N} families (at most ${SHARE_MAX}, 40 percent)`);
  else if (owners.length > SHARE_WARN) W('fleet', `${id} is in the plan of ${owners.length} families: the stories may add more, and 12 is the limit`);
}
for (const id of storyRich) if ((appFamilies.get(id)?.length ?? 0) < RICH_MIN) E('fleet', `story-rich app ${id} is in ${appFamilies.get(id)?.length ?? 0} families (at least ${RICH_MIN})`);
if (storyRich.length !== 14) W('fleet', `the catalog has ${storyRich.length} story-rich apps with a screenshot (the validator expects 14)`);

const topicCount = new Map<string, number>();
for (const t of TOPICS) topicCount.set(t, 0);
for (const f of fams) for (const t of topicsPossible(f)) topicCount.set(t, (topicCount.get(t) || 0) + 1);
for (const t of TOPICS) if ((topicCount.get(t) || 0) < TOPIC_MIN) E('fleet', `topic ${t} is possible in ${topicCount.get(t)} families (need ${TOPIC_MIN})`);

const archCount = new Map<string, number>();
for (const a of ARCHETYPES) archCount.set(a, 0);
for (const f of fams) for (const a of new Set(f.members.map((m) => m.archetype).filter(Boolean) as string[])) archCount.set(a, (archCount.get(a) || 0) + 1);
if ((archCount.get('gamer') || 0) > GAMER_MAX) E('fleet', `gamer is in ${archCount.get('gamer')} families (at most ${GAMER_MAX}: the Steam Headless cap)`);
for (const a of ['organiser', 'builder', 'learner']) if ((archCount.get(a) || 0) < ARCH_MIN) E('fleet', `${a} is in ${archCount.get(a)} families (at least ${ARCH_MIN})`);

const bizCount = fams.filter((f) => f.business).length;
const nonBiz = N - bizCount;
const sbNeeded = Math.ceil(SB_SHARE * N * BEATS);
const perBiz = bizCount ? Math.ceil((sbNeeded - nonBiz * 1) / bizCount) : Infinity;
const perBizMax = Math.floor(SB_MAX_SHARE * BEATS);
if (perBiz > perBizMax) E('fleet', `${bizCount} business families cannot reach ${Math.round(SB_SHARE * 100)} percent small-business beats (each would need ${perBiz} of ${BEATS}; the cap is ${perBizMax})`);
else if (perBiz > 9) W('fleet', `small-business share needs about ${perBiz} small-business beats in each of the ${bizCount} business families (a third of a ${BEATS}-beat tour)`);

const narrCount = new Map<string, number>();
for (const f of fams) narrCount.set(f.narrator, (narrCount.get(f.narrator) || 0) + 1);
for (const [k, v] of Object.entries<any>(voices.voices)) if ((narrCount.get(k) || 0) !== v.narratorFor) E('fleet', `narrator ${k} has ${narrCount.get(k) || 0} families, voices.json narratorFor is ${v.narratorFor}`);
const sumFor = Object.values<any>(voices.voices).reduce((n, v) => n + v.narratorFor, 0);
if (sumFor !== N) E('fleet', `voices.json narratorFor adds up to ${sumFor}, not ${N}`);
const reviewTotal = fams.reduce((n, f) => n + (f.reviewNeeded?.length ?? 0), 0);
if (reviewTotal) W('fleet', `${reviewTotal} signature apps need owner entries in reviewed.json per beat: ${fams.filter((f) => f.reviewNeeded?.length).map((f) => `${f.slug}:${f.reviewNeeded!.join('+')}`).join(', ')}`);

// ---- sync with the build ------------------------------------------------------------------------------------------------------------------
{
  const b = build();
  for (const p of b.problems) E('build', p);
  const castingPath = path.join(ROOT, 'content', 'story', 'casting.json'), mdPath = path.join(ROOT, 'reference', 'story', 'cast.md');
  if (!fs.existsSync(castingPath) || fs.readFileSync(castingPath, 'utf8') !== b.json + '\n') E('sync', 'content/story/casting.json is out of date: run node --experimental-strip-types scripts/story/build-casting.mts');
  if (!fs.existsSync(mdPath) || fs.readFileSync(mdPath, 'utf8') !== b.md) E('sync', 'reference/story/cast.md is out of date: run node --experimental-strip-types scripts/story/build-casting.mts');
  // anchors: every member's chain ends in a room or universal role; thin chains (room only) are reported
  const universal = new Set<string>(roles.universal);
  const thin: string[] = [];
  const gapTypes = new Map<string, number>();
  for (const [key, d] of b.derived) {
    const last = d.anchors[d.anchors.length - 1];
    if (!(last.startsWith('room:') || universal.has(last) || last === 'garden')) E(key, `anchor chain ends in ${last}, not a room or universal role`);
    if (d.anchors.length === 1) thin.push(key);
    for (const g of d.gaps) gapTypes.set(g.split(' ')[0], (gapTypes.get(g.split(' ')[0]) || 0) + 1);
  }
  if (thin.length) W('anchors', `${thin.length} members have no furniture anchor in their room (the chain is the room only): ${thin.join(', ')}`);
  if (gapTypes.size) {
    // what the cast would gain if roles.json listed the furniture the specs place (a request to story-bake, never applied here)
    const aug = { ...roles, items: Object.fromEntries(Object.entries(roles.items).map(([r, ts]) => [r, [...ts, ...(ROLE_GAPS[r] ?? [])]])) } as typeof roles;
    let after = 0;
    for (const f of fams) for (const m of f.members) {
      const h = houseInfo.get(f.house), room = h && findRoom(h, m.room);
      if (h && room && deriveAnchors(m, room, h, aug).anchors.length === 1) after++;
    }
    W('anchors', `roles.json does not list furniture the cast stands at: ${[...gapTypes].map(([t, n]) => `${t} (${n})`).join(', ')}. Listing them under couch, bed, desk and dining-table would leave ${after} of ${thin.length} members with a room-only chain`);
  }
}

// ---- report ------------------------------------------------------------------------------------------------------------------------------------------
const pad = (s: string, n: number): string => (s.length >= n ? s : s + ' '.repeat(n - s.length));
const errors = msgs.filter((m) => m.sev === 'error'), warns = msgs.filter((m) => m.sev === 'warn');
if (!quiet) {
  console.log(`Cast: ${fams.length} families, ${fams.reduce((n, f) => n + f.members.length, 0)} members, ${bizCount} business families\n`);
  console.log(pad('house', 17) + pad('slug', 16) + pad('household', 15) + pad('biz', 4) + pad('members', 8) + pad('archetypes', 44) + pad('narrator', 16) + pad('apps', 5) + 'topics possible');
  for (const f of fams) {
    const a = [...new Set(f.members.map((m) => m.archetype ?? 'baby'))].join(',');
    console.log(pad(f.house, 17) + pad(f.slug, 16) + pad(f.household, 15) + pad(f.business ? 'yes' : 'no', 4) + pad(String(f.members.length), 8) + pad(a, 44) + pad(f.narrator, 16) + pad(String(f.signatureApps.length), 5) + topicsPossible(f).join(' '));
  }
  console.log('\nFamilies per archetype: ' + ARCHETYPES.map((a) => `${a} ${archCount.get(a)}`).join(', '));
  console.log('Families per household: ' + HOUSEHOLDS.map((h) => `${h} ${fams.filter((f) => f.household === h).length}`).join(', '));
  console.log('Families per narrator:  ' + [...narrCount].sort().map(([k, n]) => `${k} ${n}/${voices.voices[k]?.narratorFor ?? '?'}`).join(', '));
  console.log('Families per topic:     ' + TOPICS.map((t) => `${t} ${topicCount.get(t)}`).join(', '));
  console.log(`Small-business: ${bizCount} business families; to reach ${Math.round(SB_SHARE * 100)} percent of ${N * BEATS} beats, each needs about ${perBiz} small-business beats (cap ${perBizMax}); the rest at most 2`);
  const top = [...appFamilies].sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]));
  console.log(`\nPlan apps (signature plus beat apps): ${distinct} distinct in ${fams.reduce((n, f) => n + allApps(f).length, 0)} slots. Per app (families):`);
  const rows = top.map(([id, o]) => `${id} ${o.length}${FIRST_PARTY.has(id) ? '*' : ''}`);
  for (let i = 0; i < rows.length; i += 6) console.log('  ' + rows.slice(i, i + 6).map((r) => pad(r, 24)).join(''));
  console.log('  (* first-party: exempt from the 40 percent cap)');
  console.log('Story-rich apps: ' + storyRich.map((id) => `${id} ${appFamilies.get(id)?.length ?? 0}`).join(', '));
  console.log('Apps per family (signature+beat): ' + fams.map((f) => `${f.slug} ${f.signatureApps.length}+${allApps(f).length - f.signatureApps.length}`).join(', '));
  console.log('');
}
for (const m of warns) console.log(`warn   ${pad(m.at, 28)} ${m.text}`);
for (const m of errors) console.log(`ERROR  ${pad(m.at, 28)} ${m.text}`);
console.log(`\ncast-lint: ${errors.length} error${errors.length === 1 ? '' : 's'}, ${warns.length} warning${warns.length === 1 ? '' : 's'}`);
process.exit(errors.length ? 1 : 0);
