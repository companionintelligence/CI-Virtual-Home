#!/usr/bin/env node
// REFERENCE implementation of the story rules, written by the showrunner to prove the contract is satisfiable.
// It is a seed, not the product: story-validator (scripts/validate-stories.mts) re-implements it in TypeScript with the same rule ids,
// reads the real plan.json / spec for anchors, and adds the cross-family metrics. Zero dependencies. Node 22.
//   node ref-validate.mjs <family.json> [--json]
import fs from 'node:fs';
import path from 'node:path';

// Data directory: the contract folder (default) or content/story/ in the repo (STORY_DATA=content/story). Same file names, plus
// schema/family.schema.json in the repo.
const C = path.resolve(process.env.STORY_DATA || path.join(import.meta.dirname, '..'));
const J = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));
const first = (...ps) => ps.find((p) => fs.existsSync(p)) || ps[0];
const schema = J(first(path.join(C, 'schema.json'), path.join(C, 'schema', 'family.schema.json')));
const claims = J(path.join(C, 'claims.json'));
const catalog = J(path.join(C, 'catalog-apps.json'));
const casting = J(path.join(C, 'casting.json'));
const roles = J(path.join(C, 'roles.json'));
const voices = J(path.join(C, 'voices.json'));

// ---------------------------------------------------------------- 1. schema-lite (the keyword subset of STORY-BIBLE section 12)
const KEYWORDS = new Set(['$schema', '$id', '$ref', '$defs', '$comment', 'title', 'description', 'type', 'enum', 'const', 'required', 'properties', 'additionalProperties', 'items', 'minItems', 'maxItems', 'minLength', 'maxLength', 'pattern', 'minimum', 'maximum']);
export function checkSchema(data, sch = schema) {
  const errs = [];
  const resolve = (s) => { while (s && s.$ref) { const p = s.$ref.replace(/^#\//, '').split('/'); let t = schema; for (const k of p) t = t[k]; s = { ...t, ...Object.fromEntries(Object.entries(s).filter(([k]) => k !== '$ref')) }; } return s; };
  const walk = (v, s, at) => {
    s = resolve(s);
    for (const k of Object.keys(s)) if (!KEYWORDS.has(k)) errs.push(`${at}: schema uses unsupported keyword ${k}`);
    if ('const' in s && v !== s.const) errs.push(`${at}: must equal ${JSON.stringify(s.const)}`);
    if (s.enum && !s.enum.includes(v)) errs.push(`${at}: must be one of ${s.enum.join(', ')} (got ${JSON.stringify(v)})`);
    if (s.type) {
      const t = Array.isArray(v) ? 'array' : v === null ? 'null' : Number.isInteger(v) && s.type === 'integer' ? 'integer' : typeof v;
      if (t !== s.type && !(s.type === 'number' && typeof v === 'number')) { errs.push(`${at}: expected ${s.type}, got ${t}`); return; }
    }
    if (typeof v === 'string') {
      if (s.minLength != null && v.length < s.minLength) errs.push(`${at}: shorter than ${s.minLength}`);
      if (s.maxLength != null && v.length > s.maxLength) errs.push(`${at}: longer than ${s.maxLength} (${v.length})`);
      if (s.pattern && !new RegExp(s.pattern).test(v)) errs.push(`${at}: does not match ${s.pattern}`);
    }
    if (typeof v === 'number') {
      if (s.minimum != null && v < s.minimum) errs.push(`${at}: below ${s.minimum}`);
      if (s.maximum != null && v > s.maximum) errs.push(`${at}: above ${s.maximum}`);
    }
    if (Array.isArray(v)) {
      if (s.minItems != null && v.length < s.minItems) errs.push(`${at}: fewer than ${s.minItems} items`);
      if (s.maxItems != null && v.length > s.maxItems) errs.push(`${at}: more than ${s.maxItems} items`);
      if (s.items) v.forEach((x, i) => walk(x, s.items, `${at}[${i}]`));
    }
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      for (const k of s.required || []) if (!(k in v)) errs.push(`${at}: missing ${k}`);
      for (const k of Object.keys(v)) {
        if (s.properties && k in s.properties) walk(v[k], s.properties[k], `${at}.${k}`);
        else if (s.additionalProperties === false) errs.push(`${at}: unknown property ${k}`);
      }
    }
  };
  walk(data, sch, '$');
  return errs;
}

// ---------------------------------------------------------------- 2. text rules
const stripHtml = (s) => s.replace(/<[^>]*>/g, ' ').replace(/[‘’]/g, "'").replace(/[“”]/g, '"');
const words = (s) => s.trim().split(/\s+/).filter(Boolean);
const sentences = (s) => s.split(/(?<=[.!?])\s+/).filter(Boolean);
const bans = claims.bannedPhrases.map((b) => ({ ...b, re: new RegExp(b.pattern, b.flags) }));
const apps = new Map(catalog.apps.map((a) => [a.id, a]));
const FIRST_PARTY = new Set(['ci-memory', 'ci-hermes', 'ci-openclaw']);
const AMBIGUOUS = new Set(['convert', 'vert', 'trip', 'trek', 'stash', 'sure', 'element', 'vane', 'strix', 'memos', 'grist', 'planka', 'kokoro', 'samba', 'ghost', 'cal', 'halo', 'homarr', 'monetr', 'blinko', 'jotty', 'papra', 'invio', 'razzia']);
const notInStore = claims && catalog.notInStore ? catalog.notInStore.apps : [];

export function validate(story, { reviewed = [] } = {}) {
  const out = { errors: [], review: [], warn: [] };
  const E = (id, at, msg) => out.errors.push(`${id} ${at}: ${msg}`);
  const R = (id, at, msg) => out.review.push(`${id} ${at}: ${msg}`);
  const W = (id, at, msg) => out.warn.push(`${id} ${at}: ${msg}`);

  for (const m of checkSchema(story)) E('schema', '', m);
  if (out.errors.length) return out;               // the rest assumes the shape

  const cast = casting.families.find((f) => f.slug === story.slug);
  if (!cast) E('casting', 'slug', `slug ${story.slug} is not in casting.json`);
  else {
    if (cast.house !== story.house) E('casting', 'house', `${story.slug} belongs to house ${cast.house}`);
    if (cast.household !== story.family.household) E('casting', 'household', `casting says ${cast.household}`);
    if (cast.business !== story.family.business) E('casting', 'business', `casting says ${cast.business}`);
    if (cast.narrator !== story.family.narrator) E('casting', 'narrator', `casting says ${cast.narrator}`);
  }
  const members = new Map(story.members.map((m) => [m.id, m]));
  if (members.size !== story.members.length) E('members', 'id', 'duplicate member id');
  const chapters = new Map(story.chapters.map((c) => [c.id, c]));
  const beatIds = new Set(); for (const b of story.beats) { if (beatIds.has(b.id)) E('beats', b.id, 'duplicate beat id'); beatIds.add(b.id); }

  // ---- collect user-facing strings ----
  const strings = []; const S = (at, s) => { if (s) strings.push([at, s]); };
  S('family.tagline', story.family.tagline); S('family.story', story.family.story); S('family.address', `${story.family.address.line}, ${story.family.address.place}`);
  story.chapters.forEach((c) => S(`chapter ${c.id}`, c.title));
  story.members.forEach((m) => { if (m.work) S(`member ${m.id}.work`, m.work); if (m.companion) { S(`member ${m.id}.companion.job`, m.companion.job); S(`member ${m.id}.companion.limits`, m.companion.limits); } });
  story.beats.forEach((b) => { const p = b.popup; S(`${b.id}.title`, p.title); S(`${b.id}.body`, p.body); (p.chips || []).forEach((c, i) => S(`${b.id}.chip${i}`, c)); S(`${b.id}.note`, p.note); if (p.phone) { S(`${b.id}.phone.header`, p.phone.header); p.phone.rows.forEach((r, i) => S(`${b.id}.phone.row${i}`, r)); } if (b.say) S(`${b.id}.say`, b.say.text); });
  S('closing.body', story.closing.body); S('closing.cta', story.closing.cta.label);

  for (const [at, raw] of strings) {
    const s = stripHtml(raw);
    for (const b of bans) {
      if (!b.re.test(s)) continue;
      const msg = `"${s.length > 70 ? s.slice(0, 70) + '...' : s}" ${b.why} Fix: ${b.fix}`;
      if (b.severity === 'error') E(b.id, at, msg);
      else if (b.severity === 'review') { if (!reviewed.includes(`${story.slug}|${at}|${b.id}`)) R(b.id, at, msg); }
      else W(b.id, at, msg);
    }
  }

  // ---- counts and shape of the spoken text ----
  const digits = /\d/;
  const appNames = [...apps.values()].map((a) => a.name);
  const stripAppNames = (s) => appNames.reduce((t, n) => (digits.test(n) ? t.split(n).join(' ') : t), s);
  story.beats.forEach((b) => {
    const p = b.popup, at = b.id;
    if (words(p.title).length > 6) E('len-title', at, `title has ${words(p.title).length} words (max 6)`);
    if (words(p.body).length > 30) E('len-body', at, `body has ${words(p.body).length} words (max 30)`);
    for (const sn of sentences(p.body)) if (words(sn).length > 20) E('len-sentence', at, `a sentence has ${words(sn).length} words (max 20)`);
    if (digits.test(stripAppNames(p.title + ' ' + p.body + ' ' + (b.say?.text || '')))) E('digits', at, 'no digits in spoken or titled text; spell numbers out');
    if (b.say && words(b.say.text).length > 16) E('len-say', at, `say has ${words(b.say.text).length} words (max 16)`);
    if (!/[.!?]$/.test(p.body.trim())) E('body-end', at, 'body must end with a full stop');
    if (/^[a-z]/.test(p.title)) E('title-case', at, 'title starts with a capital');
    if (p.title.split(' ').slice(1).map((w) => w.replace(/[^A-Za-z'’-]/g, '')).filter((w) => /^[A-Z][a-z]/.test(w) && !appNames.some((n) => n.includes(w)) && !/^(Companion|Core|Hub|Memory|OS|Wi-Fi|Elias|Mika|Odette|Marlo|Grandma's)$/.test(w) && !story.members.some(m => m.name === w || m.companion?.name === w)).length) W('title-case', at, `headings are sentence case: "${p.title}"`);
  });
  if (words(story.closing.body).length > 30) E('len-closing', 'closing', `closing body has ${words(story.closing.body).length} words (max 30)`);
  if (/UnCloud your life/i.test(story.closing.body)) E('closing', 'body', 'the sign-off is added by the site; do not type it here');
  for (const sn of sentences(story.family.story)) if (words(sn).length > 20) E('len-sentence', 'family.story', `a sentence has ${words(sn).length} words`);

  // ---- structure ----
  const cs = story.chapters;
  if (cs[0].kind !== 'ftue') E('chapters', 'first', 'first chapter must be the ftue');
  if (cs[cs.length - 1].kind !== 'outro') E('chapters', 'last', 'last chapter must be the outro');
  cs.forEach((c) => { if ((c.kind === 'room' || c.kind === 'outside') && !c.room) E('chapters', c.id, 'room and outside chapters need `room`'); });
  for (const need of ['living', 'kitchen', 'garden']) if (!cs.some((c) => c.room === need)) E('chapters', need, `a ${need} chapter is required`);
  if (cs.filter((c) => c.kind === 'room' && !['living', 'kitchen'].includes(c.room)).length < 2) E('chapters', 'rooms', 'at least two further room chapters (office, kids, bedroom, garage, dining, entry, laundry)');
  // beats follow chapter order
  let last = -1; story.beats.forEach((b) => { const i = cs.findIndex((c) => c.id === b.chapter); if (i < 0) E('beats', b.id, `unknown chapter ${b.chapter}`); else { if (i < last) E('order', b.id, 'beats must follow chapter order'); last = i; } });
  const ftue = story.beats.filter((b) => b.chapter === cs[0].id);
  if (ftue.length < 5 || ftue.length > 6) E('ftue', 'count', `the ftue chapter has ${ftue.length} beats (5 or 6)`);
  const fid = new Set(ftue.map((b) => b.id));
  for (const need of ['ftue-delivery', 'ftue-plug-in', 'ftue-join', 'ftue-pick', 'ftue-hello']) if (!fid.has(need)) E('ftue', need, 'required beat id missing');
  const ftueOrder = ['ftue-delivery', 'ftue-unbox', 'ftue-plug-in', 'ftue-join', 'ftue-pick', 'ftue-hello'].filter((x) => fid.has(x));
  if (ftueOrder.join() !== ftue.map((b) => b.id).join()) E('ftue', 'order', `ftue order must be ${ftueOrder.join(' > ')}`);
  const fb = (id) => ftue.find((b) => b.id === id);
  if (fb('ftue-plug-in') && !fb('ftue-plug-in').emphasis?.wake) E('ftue', 'ftue-plug-in', 'emphasis.wake must be true');
  if (fb('ftue-pick') && fb('ftue-pick').popup.note !== 'Installing apps uses the internet.') E('disclosure', 'ftue-pick', 'note must be "Installing apps uses the internet."');
  for (const id of ['ftue-join', 'ftue-pick']) if (fb(id) && fb(id).popup.kind !== 'phone') E('ftue', id, 'popup.kind must be phone');
  story.beats.forEach((b) => { if (b.popup.kind === 'phone' && b.chapter !== cs[0].id) E('ftue', b.id, 'phone popups belong to the ftue'); if (b.emphasis?.wake && b.id !== 'ftue-plug-in') E('ftue', b.id, 'only ftue-plug-in wakes the Core'); });
  const ftueText = ftue.map((b) => b.popup.title + ' ' + b.popup.body + ' ' + (b.popup.phone ? b.popup.phone.rows.join(' ') : '')).join(' ');
  if (/\b(SSID|password is|pairing code|QR|Companion-Setup|activation|account|sign up|offline|no internet)\b/i.test(ftueText.replace('Enter its password', ''))) E('ftue-claims', 'ftue', 'ftue text must not show an SSID, pairing code, QR, account step or an offline claim (STORY-BIBLE section 8)');

  // members, companions, voices
  const comps = story.members.filter((m) => m.companion);
  if (comps.length < 1 || comps.length > 3) E('members', 'companions', `${comps.length} companions (1 to 3)`);
  for (const m of comps) if (m.age < 13 || ['baby', 'child', 'visitor'].includes(m.role)) E('members', m.id, 'children, babies and visitors have no companion');
  const nv = story.family.narrator; const used = new Set([nv]);
  for (const m of comps) { if (used.has(m.companion.voice)) E('voices', m.id, `companion voice ${m.companion.voice} repeats the narrator or another companion`); used.add(m.companion.voice); }
  if (story.members.some((m) => m.age < 13) && !story.beats.some((b) => b.category === 'kids')) E('categories', 'kids', 'a household with children needs a kids beat');
  const memoryMember = comps.some((m) => m.companion.memory);

  // beats: references, agents, approval
  let sayCount = 0, firstHermes = null, firstOpenClawWeb = null;
  story.beats.forEach((b) => {
    for (const k of ['member', 'agent', 'approval']) if (b[k] && !members.has(b[k])) E('refs', b.id, `${k} ${b[k]} is not a member`);
    if (b.agent) {
      const m = members.get(b.agent);
      if (!m?.companion) E('agent', b.id, `${b.agent} has no companion`);
      if (!b.approval) E('agent', b.id, 'a beat with an agent needs an approval member: an agent prepares, a person approves');
      if (b.app && m?.companion && apps.has(b.app.id) && !FIRST_PARTY.has(b.app.id)) {
        const link = apps.get(b.app.id).agent.link;
        if (m.companion.runtime === 'Hermes' && !['wired', 'mcp'].includes(link)) E('agent-app', b.id, `Hermes cannot act on ${b.app.id} (agent link "${link}"); let it draft and the person act`);
        if (m.companion.runtime === 'OpenClaw' && link === 'none') E('agent-app', b.id, `OpenClaw has no path to ${b.app.id}`);
      }
      if (m?.companion?.runtime === 'Hermes' && !firstHermes) firstHermes = b;
    }
    if (b.say) {
      sayCount++;
      const m = members.get(b.say.speaker);
      if (!m?.companion) E('say', b.id, `${b.say.speaker} has no companion to speak`);
      if (/\b(I (can|will|always|never|know|remember)|everything|anything|for you)\b/i.test(b.say.text)) E('say', b.id, 'agent lines make no claim about the agent and promise nothing');
    }
    if (b.approval && !b.agent) W('agent', b.id, 'approval without agent');
    if (b.segment !== (b.category === 'small-business' ? 'small-business' : b.segment)) E('segment', b.id, 'category small-business needs segment small-business');
  });
  if (sayCount > 6) E('say', 'count', `${sayCount} agent lines (max 6)`);
  if (firstHermes && firstHermes.popup.note !== 'Messages pass through the chat service you choose.') E('disclosure', firstHermes.id, 'the first Hermes beat carries the note "Messages pass through the chat service you choose."');
  const ftueHello = fb('ftue-hello'); if (ftueHello && !ftueHello.say) E('ftue', 'ftue-hello', 'the first agent greeting needs a `say` line');
  // a companion with Companion Memory connected is named somewhere
  const allText = story.beats.flatMap((b) => [[b.id, b.popup.title + ' ' + b.popup.body + ' ' + (b.popup.phone ? b.popup.phone.rows.join(' ') : '')]]);
  const firstMem = allText.find(([, t]) => /Companion Memory/.test(t));
  if (memoryMember && !firstMem) W('disclosure', 'memory', 'a companion has Memory connected but no beat mentions Companion Memory');

  // ---- apps ----
  const catNames = new Map(); for (const a of apps.values()) catNames.set(a.name.toLowerCase(), a);
  story.beats.forEach((b) => {
    const named = new Set();
    const text = [b.popup.title, b.popup.body, ...(b.popup.chips || []), ...(b.popup.phone ? b.popup.phone.rows : []), b.say?.text || ''].join(' ');
    const textNoCompat = text.replace(/\bBitwarden (apps|clients)\b|\bBitwarden-compatible\b/g, ' ');   // compat phrases are allowed (STORY-BIBLE section 6)
    for (const a of apps.values()) {
      const n = a.name; if (n.length < 4) continue;
      if (AMBIGUOUS.has(n.toLowerCase()) && !new RegExp(`\\b${n}\\b`).test(text)) continue;
      if (new RegExp(`(?<![\\w-])${n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![\\w-])`, AMBIGUOUS.has(n.toLowerCase()) ? '' : 'i').test(text)) named.add(a.id);
    }
    if (/\bPaperless\b(?!-ngx)/.test(text)) named.add('paperless');
    for (const n of notInStore) if (new RegExp(`\\b${n.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(textNoCompat)) E('app-not-in-store', b.id, `${n.name} is not in the production store`);
    if (b.app) {
      const a = apps.get(b.app.id);
      if (!a) { E('app-unknown', b.id, `app ${b.app.id} is not in the catalog snapshot`); return; }
      if (a.storySafe === 'avoid') E('app-avoid', b.id, `${a.id} is marked avoid`);
      if (a.qa === 'not-boot-tested') E('app-qa', b.id, `${a.id} says it was not boot-tested on a live Hub device`);
      if (a.qa === 'no-screenshot' && !reviewed.includes(`${story.slug}|${b.id}|app-qa-screenshot`)) R('app-qa-screenshot', b.id, `${a.id} has no QA screenshot; the owner must list it as reviewed`);
      if (a.storySafe === 'with-caveat') { const k = [...new Set(a.caveats.map((c) => c.kind).filter((k) => k !== 'note'))]; if (k.some((x) => ['public-access', 'hardware'].includes(x)) && !b.capability) W('app-caveat', b.id, `${a.id} carries caveats ${k.join(', ')}`); }
      for (const r of b.app.replaces) if (!a.replaces.includes(r)) E('app-replaces', b.id, `${a.id} replaces ${a.replaces.join(', ') || 'nothing'} in the catalog, not "${r}"`);
      const chips = b.popup.chips || [];
      if (chips.length) {
        if (chips[0].toLowerCase() !== a.name.toLowerCase() && !(a.id === 'ci-openclaw' && /openclaw/i.test(chips[0]))) E('chips', b.id, `first chip must be the app name "${a.name}"`);
        const rep = chips.slice(1).map((c) => c.replace(/^replaces /, ''));
        if (chips.slice(1).some((c) => !/^replaces /.test(c))) E('chips', b.id, 'other chips read "replaces <name>"');
        for (const r of rep) if (!b.app.replaces.includes(r)) E('chips', b.id, `chip names ${r} which is not in app.replaces`);
      }
      if (b.app.replaces.length && !chips.some((c) => /^replaces /.test(c))) W('chips', b.id, 'app.replaces is set but no "replaces" chip shows it');
      named.delete(b.app.id);
    } else if (b.category !== 'setup') W('app', b.id, 'a non-setup beat without an app');
    for (const w of b.with || []) { if (!apps.has(w)) E('app-unknown', b.id, `with: ${w} is not in the catalog`); named.delete(w); }
    for (const id of FIRST_PARTY) named.delete(id);
    for (const id of named) E('app-undeclared', b.id, `text names ${apps.get(id).name} but it is not app.id or in with`);
    if (b.app && !b.capability && b.category !== 'setup') W('capability', b.id, 'name the ONE thing the app does (capability)');
    if (b.app && b.capability) {
      const a = apps.get(b.app.id); const desc = ((a?.description || '') + ' ' + (claims.apps.find((x) => x.id === b.app.id)?.mayDescribeAs || '')).toLowerCase();
      const keys = b.capability.toLowerCase().match(/[a-z]{5,}/g) || [];
      if (a && keys.length && !keys.some((k) => desc.includes(k.slice(0, 5)))) W('capability', b.id, 'capability shares no word with the catalog description');
    }
  });

  // ---- anchors against the house ----
  story.beats.forEach((b) => {
    const chain = [b.anchor, ...(b.anchor.fallback || [])];
    const ok = chain.some((l) => roles.universal.includes(l.role) || (cast && (cast.roles[l.role] || 0) > 0));
    if (!ok) E('anchor', b.id, `none of ${chain.map((l) => l.role).join(', ')} exists in ${story.slug}`);
    else if (!roles.universal.includes(b.anchor.role) && !(b.anchor.fallback || []).length && cast && (cast.roles[b.anchor.role] || 0) === 0) E('anchor', b.id, 'missing role needs a fallback');
    if (!roles.universal.includes(b.anchor.role) && !(b.anchor.fallback || []).some((l) => roles.universal.includes(l.role))) W('anchor', b.id, `${b.anchor.role} is not in every house; end the fallback chain in a universal role (${roles.universal.join(', ')})`);
    // text promises a thing the house does not have
    const t = b.popup.title + ' ' + b.popup.body;
    const chk = [[/\b(TV|television)\b/i, 'tv', 'tv'], [/\bfireplace\b/i, 'fireplace', 'fireplace'], [/\b(crib|nursery)\b/i, 'crib', 'crib'], [/\b(kitchen )?island\b/i, 'kitchen-island', 'kitchen-island']];
    for (const [re, role, flag] of chk) if (re.test(t) && cast) { const noFlag = cast.homeFlags.some((f) => f.no === flag); if ((cast.roles[role] || 0) === 0 || noFlag) E('text-role', b.id, `text says ${role} but ${story.slug} has none (see casting homeFlags)`); }
    if (b.anchor.room && !chapters.get(b.chapter)) E('anchor', b.id, 'chapter missing');
  });

  // ---- categories, segments, film ----
  const cats = new Set(story.beats.map((b) => b.category));
  for (const need of ['setup', 'home', 'food', 'iot', 'productivity', 'privacy']) if (!cats.has(need)) E('categories', need, `every family covers ${need}`);
  if (cats.size < 8) E('categories', 'spread', `${cats.size} categories (min 8 of 11)`);
  const sb = story.beats.filter((b) => b.segment === 'small-business').length;
  if (story.family.business) { if (sb < 5) E('segment', 'small-business', `a business family needs 5 or more small-business beats (has ${sb})`); if (sb / story.beats.length > 0.45) E('segment', 'small-business', 'small-business beats are over 45% of the tour'); }
  else if (sb > 2) E('segment', 'small-business', `a non-business family has ${sb} small-business beats (max 2)`);
  for (const m of story.members) { const n = story.beats.filter((b) => b.member === m.id || b.agent === m.id).length; if (m.age >= 13 && n < 3) E('members', m.id, `${m.name} has ${n} beats (min 3)`); if (m.age < 13 && n < 1) E('members', m.id, `${m.name} has no beat`); }
  const filmBeats = story.beats.filter((b) => b.film);
  const filmWords = filmBeats.reduce((n, b) => n + words(b.popup.body).length + (b.say ? words(b.say.text).length : 0), 0) + words(story.closing.body).length + 3;
  const filmSec = filmWords / 2.5 + 0.6 * (filmBeats.length + 1) + 10;
  if (filmBeats.length < 8 || filmBeats.length > 12) E('film', 'count', `${filmBeats.length} film beats (8 to 12)`);
  if (filmBeats.filter((b) => b.chapter === cs[0].id).length < 3) E('film', 'ftue', 'at least 3 ftue beats in the film');
  if (!filmBeats.some((b) => b.chapter === cs[cs.length - 1].id)) E('film', 'outro', 'the outro beat is in the film');
  const filmRooms = new Set(filmBeats.map((b) => b.chapter)); if (filmRooms.size < 5) E('film', 'rooms', `film visits ${filmRooms.size} chapters (min 5)`);
  if (story.members.length >= 2 && new Set(filmBeats.map((b) => b.member).filter(Boolean)).size < Math.min(2, story.members.length)) E('film', 'members', 'film shows at least two members');
  if (story.family.business && !filmBeats.some((b) => b.segment === 'small-business')) E('film', 'business', 'a business family shows one small-business beat in the film');
  if (filmWords > 215) E('film', 'words', `film speech is ${filmWords} words (max 215)`);
  if (filmSec < 75 || filmSec > 115) E('film', 'length', `estimated film length ${filmSec.toFixed(0)} s (75 to 115)`);
  out.stats = { beats: story.beats.length, members: story.members.length, categories: [...cats], smallBusiness: sb, filmBeats: filmBeats.length, filmWords, filmSec: Math.round(filmSec), sayLines: sayCount };
  return out;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const file = process.argv[2]; if (!file) { console.error('usage: ref-validate.mjs <family.json>'); process.exit(2); }
  const r = validate(J(file));
  if (process.argv.includes('--json')) console.log(JSON.stringify(r, null, 1));
  else { for (const k of ['errors', 'review', 'warn']) for (const m of r[k]) console.log(k.toUpperCase().padEnd(6), m); console.log('stats', JSON.stringify(r.stats)); console.log(r.errors.length ? `FAIL: ${r.errors.length} errors, ${r.review.length} review, ${r.warn.length} warnings` : `OK: 0 errors, ${r.review.length} review, ${r.warn.length} warnings`); }
  process.exit(r.errors.length || r.review.length ? 1 : 0);
}
