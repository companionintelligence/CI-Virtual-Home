// The portal's front page (index.html), the Companion Core's lander: this script makes the chooser work ("What do you rent today?": a chip for each service,
// a chip for each job, a search, and the kind of place when there is more than one) and keeps the page honest when the list of homes does not load. No WebGL,
// no framework, relative URLs only (the site is served under a sub-path by portal:test). The filters live in the address (?service=&persona=&type=&q=) so a
// filtered view can be linked, and a service-targeted ad can land on the exact pair; any other parameter (an ad's utm_ tags, a click id) is kept as it is.
// A home's name is assets/home-names.js's displayName.
//
// Everything that argues, proves and offers is static HTML in the built page (scripts/portal-front.mts, written by scripts/build-portal.mts), and so are the
// family cards: a crawler, a visitor without JavaScript and an in-app browser with a slow script see all of it. This script ADOPTS the cards (it keeps the
// elements and reads data-persona, data-service, data-type and data-find off them) and draws a card only for a home that has no family card, as it always did:
// that card opens the live player. A family's card opens its page (family/<slug>), which opens the tour. Six cards are featured; every other family and home
// is in a native <details> that this script opens for any filter and puts back when the filters are cleared. The chooser's controls are `disabled` in the
// static page (a disabled control is not focusable, so a page with no script has no dead controls); this script enables them.
//
// The names are imported when the page runs, not statically: if that one file does not come (a partial deploy, a dropped request), the page still lists the
// homes, under the name the list carries, instead of never running and leaving the placeholder cards up for good.
const FALLBACK_NAMES = {
  displayName: h => (h.name || '').trim() || h.id,
};
const namesReady = import('../assets/home-names.js').catch(err => { console.warn('gallery: the names did not load', err); return FALLBACK_NAMES; });
let names = FALLBACK_NAMES;

const $ = sel => document.querySelector(sel);
// No play=: the player starts the shot by itself, except for a visitor whose system asks for reduced motion, and
// that is the player's call (it can read the setting; a link cannot).
// Cloudflare Pages serves room-creator.html as /room-creator and answers the .html address with a 308, which a card
// click would pay for first. scripts/build-portal.mts marks the built page <meta name="vh-clean-urls">; a checkout
// served as it is (python -m http.server) has no such routing and keeps the file name.
const CLEAN_URLS = !!document.querySelector('meta[name="vh-clean-urls"]');
const viewerHref = id => `./room-creator${CLEAN_URLS ? '' : '.html'}?mode=view&house=${encodeURIComponent(id)}`;
// the first clause of the spec's style paragraph: "Two-storey white modern villa, stacked flat roofs, …" → "Two-storey white modern villa"
const shortStyle = s => (s || '').split(/[:;,(]| with | over | under /)[0].trim();
const nf = new Intl.NumberFormat('en');
const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

// a count in words (scripts/portal-pages.mts numberWord): a digit beside a service reads as a usage figure, so the page never prints one
const ONES = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
const word = n => (!Number.isInteger(n) || n < 0 || n > 99 ? String(n) : n < 20 ? ONES[n] : TENS[Math.floor(n / 10)] + (n % 10 ? `-${ONES[n % 10]}` : ''));
const families = n => `${word(n)} fictional ${n === 1 ? 'family' : 'families'}`;
const cap = s => s.charAt(0).toUpperCase() + s.slice(1);

let homes = [];
let items = [];          // one per card: { li, h (the home, when the list came), persona, services, type, find, family, featured }
const state = { q: '', service: '', persona: '', type: '' };
const MANAGED = ['q', 'service', 'persona', 'type'];
const ID = /^[a-z0-9]+(-[a-z0-9]+){0,4}$/;

function readUrl() {
  const q = new URLSearchParams(location.search);
  state.q = q.get('q') || '';
  for (const k of ['service', 'persona', 'type']) state[k] = ID.test(q.get(k) || '') ? q.get(k) : '';
}
// The address keeps every parameter that is not one of ours, byte for byte (an ad's utm_ tags and a click id: portal/campaign.js reads them, and a platform may
// check the id as it was sent), and ours are written after them. What was typed in the search goes in the address only when it finds something (typed text
// should not leak into analytics through the address).
function writeUrl(found) {
  const others = location.search.replace(/^\?/, '').split('&').filter(p => p && !MANAGED.includes(p.split('=')[0]));
  const ours = MANAGED.filter(k => state[k] && (k !== 'q' || found)).map(k => `${k}=${encodeURIComponent(state[k])}`);
  const s = [...others, ...ours].join('&');
  try { history.replaceState(null, '', `${location.pathname}${s ? `?${s}` : ''}${location.hash}`); } catch { /* file:// or sandboxed */ }
}

// each filter on its own, so a chip's count can be taken against the others
const personaOk = it => !state.persona || it.persona.includes(state.persona);
const serviceOk = it => !state.service || it.services.includes(state.service);
const typeOk = it => !state.type || it.type === state.type;
// the search reads the card: the home's name, the family, the people, their jobs, and every service, alias and app the family's pairs name. A phrase that some
// card holds whole ("google photos") is the search: the cards that hold it, which are the families the chip of that service shows. A phrase nothing holds
// is its words, each anywhere on the card ("stone gable").
const hayOf = it => it.hay || (it.hay = `${it.find} ${it.li.textContent} ${it.h ? `${it.h.display} ${it.h.style || ''} ${it.h.id}` : ''}`.toLowerCase().replace(/\s+/g, ' '));
let phraseMode = false;
function queryOk(it) {
  if (!state.q) return true;
  const phrase = state.q.toLowerCase().replace(/\s+/g, ' ').trim();
  if (phraseMode) return hayOf(it).includes(phrase);
  return phrase.split(' ').filter(Boolean).every(w => hayOf(it).includes(w));
}
const matches = it => personaOk(it) && serviceOk(it) && typeOk(it) && queryOk(it);

// A thumbnail that will not load: the home's initial and name on a tinted tile, so the card still says what it is
function missingThumb(thumb, h) {
  thumb.classList.add('missing');
  const ph = document.createElement('span');
  ph.className = 'thumb-missing';
  ph.setAttribute('aria-hidden', 'true');
  const initial = document.createElement('b'); initial.textContent = h.display.replace(/^the\s+/i, '').charAt(0).toUpperCase();
  const name = document.createElement('span'); name.textContent = h.display;
  ph.append(initial, name);
  thumb.prepend(ph);
}

// a home with no family: its plain card (the same as scripts/portal-pages.mts galleryCards, but the link goes straight to the player)
function card(h, i, type) {
  const li = document.createElement('li');
  li.className = 'card card-plain';
  li.dataset.id = h.id;
  li.dataset.type = type || 'home';
  li.dataset.find = `${h.display} ${h.style || ''} ${h.id}`.toLowerCase().replace(/\s+/g, ' ').trim();
  const a = document.createElement('a');
  a.href = viewerHref(h.id);
  a.setAttribute('data-campaign', '');   // portal/campaign.js carries an ad's tags into the player
  a.setAttribute('aria-label', `${h.display}. No family yet. Look around in 3D`);

  const thumb = document.createElement('div');
  thumb.className = 'thumb';
  const img = document.createElement('img');
  // `loading` first: an image whose src is set before it is lazy has already been asked for. A plain card is behind the disclosure (or, in a checkout with no
  // build, one of the list: the first two are in the first screens), so it is never asked for before it is wanted.
  if (i > 1 || !$('#all-homes').hidden) img.loading = 'lazy';
  img.src = `./portal/thumbs/${encodeURIComponent(h.id)}.webp`;
  img.alt = '';
  img.width = 640; img.height = 360;
  img.decoding = 'async';
  img.addEventListener('error', () => missingThumb(thumb, h), { once: true });
  const play = document.createElement('span');
  play.className = 'thumb-play';
  play.innerHTML = '<svg class="i i-fill"><use href="#i-play"/></svg>';
  play.append('Look around in 3D');
  thumb.append(img, play);

  const body = document.createElement('div');
  body.className = 'card-body';
  const h3 = document.createElement('h3'); h3.textContent = h.display;
  const none = document.createElement('p'); none.className = 'no-family'; none.textContent = 'No family yet.';
  const style = document.createElement('p'); style.className = 'style'; style.textContent = shortStyle(h.style); style.title = h.style || '';
  const facts = document.createElement('p'); facts.className = 'facts';
  const fact = text => { const s = document.createElement('span'); s.className = 'fact'; s.textContent = text; return s; };
  const storeys = h.storeys || 1;
  facts.append(fact(`${storeys} ${storeys === 1 ? 'storey' : 'storeys'}`));
  if (h.areaSqm) facts.append(fact(`${nf.format(h.areaSqm)} m²`));
  body.append(h3, none, style, facts);

  a.append(thumb, body);
  li.append(a);
  return li;
}

const tokens = v => (v || '').split(' ').filter(Boolean);
const itemOf = (li, byId) => ({
  li, h: byId.get(li.dataset.id),
  persona: tokens(li.dataset.persona), services: tokens(li.dataset.service), type: li.dataset.type || 'home',
  find: li.dataset.find || '', family: li.classList.contains('card-family'), featured: li.classList.contains('is-featured'),
});

// The details holding every other family and home opens for any filter and goes back to how the visitor left it when the filters are cleared.
let wasOpen = null;
function syncDetails(active) {
  const det = $('#all-homes');
  if (!det) return;
  if (active) { if (wasOpen === null) wasOpen = det.open; det.open = true; }
  else if (wasOpen !== null) { det.open = wasOpen; wasOpen = null; }
}

function apply() {
  const active = !!(state.q || state.service || state.persona || state.type);
  const phrase = state.q.toLowerCase().replace(/\s+/g, ' ').trim();
  phraseMode = !!phrase && items.some(it => hayOf(it).includes(phrase));
  let nFam = 0, nPlain = 0;
  const totalFam = items.filter(it => it.family).length;
  for (const it of items) {
    const on = matches(it);
    it.li.hidden = !on;
    if (on) { if (it.family) nFam++; else nPlain++; }
    // a card never hides the pair the visitor asked for: that line is shown first, and shown even if it was one of the waiting ones
    for (const p of it.li.querySelectorAll('.pairs-lines li')) {
      const hit = !!state.service && p.dataset.service === state.service;
      p.classList.toggle('hit', hit);
      if (hit) p.hidden = false; else if (p.dataset.extra === '1') p.hidden = true;
    }
  }
  syncDetails(active);
  $('#empty').hidden = nFam + nPlain !== 0;
  $('#clear').hidden = !active;
  const live = $('#homes-live');
  live.textContent = !active ? '' : `Showing ${word(nFam)} of ${word(totalFam)} fictional families.${nPlain ? ` And ${word(nPlain)} ${nPlain === 1 ? 'home' : 'homes'} with no family yet.` : ''}`;
  $('#swap-note').hidden = !(state.service && !state.persona && !state.q && !state.type);
  // a chip's count is the families it would show with the search and the other filters as they are; one that would show none is greyed out (the pressed one
  // stays pressable, so it can be let go). The count is in the accessible name, in words, never on the chip.
  const fams = items.filter(it => it.family);
  for (const b of document.querySelectorAll('#pairs .pair')) {
    const id = b.dataset.service, on = id === state.service;
    const c = fams.filter(it => it.services.includes(id) && personaOk(it) && typeOk(it) && queryOk(it)).length;
    b.setAttribute('aria-pressed', String(on));
    b.disabled = c === 0 && !on;
    b.setAttribute('aria-label', `${b.dataset.serviceName}. ${b.dataset.appName} is an alternative. ${cap(families(c))}. ${on ? 'Showing them. Press to let go.' : 'Show them.'}`);
  }
  for (const b of document.querySelectorAll('#personas .persona')) {
    const id = b.dataset.persona, on = id === state.persona;
    const c = fams.filter(it => it.persona.includes(id) && serviceOk(it) && typeOk(it) && queryOk(it)).length;
    b.setAttribute('aria-pressed', String(on));
    b.disabled = c === 0 && !on;
    b.setAttribute('aria-label', `${b.dataset.label}, ${families(c)}${on ? ', showing them' : ''}`);
  }
  for (const b of document.querySelectorAll('#types button')) b.setAttribute('aria-pressed', String((b.dataset.type || '') === state.type));
  if ($('#q').value !== state.q) $('#q').value = state.q;
  writeUrl(nFam + nPlain > 0);
}

// After a choice, bring the results into view if the first of them is off screen (the sticky header's height is the cards' scroll-margin), without
// moving focus: it stays on the chip.
function reveal() {
  const first = items.find(it => !it.li.hidden);
  if (!first) return;
  const r = first.li.getBoundingClientRect();
  if (r.top > innerHeight - 100 || r.bottom < 72) first.li.scrollIntoView({ behavior: reduced() ? 'auto' : 'smooth', block: 'start' });
}

// The list did not load: say so under the families, with a way to try again. The families themselves are static HTML, so they stay.
function failed(on) {
  $('#failed').hidden = !on;
  $('#grid').setAttribute('aria-busy', String(!on && !homes.length));
}

async function load() {
  let index;
  try {
    const res = await fetch('./content/houses/index.json', { cache: homes.length ? 'reload' : 'default' });
    if (!res.ok) throw new Error(`index.json: ${res.status}`);
    index = await res.json();
  } catch (err) {
    console.warn(err);
    failed(true);
    adopt([]);
    return false;
  }
  failed(false);
  // Anything that throws from here on (a record the page did not expect) ends on the same line, with the same way to try again, as a list that did not download.
  try {
    homes = (index.houses || []).map(h => ({ ...h, display: names.displayName(h) }));
    adopt(homes);
  } catch (err) {
    console.warn('gallery: the list could not be shown', err);
    homes = [];
    failed(true);
    return false;
  }
  return true;
}

// The cards in the page are kept as they are (the featured list, then the rest); a card is drawn only for a home with no family card (the plain list, the
// source page without a build, a home whose family is not current), after the families', and a family card whose home is not in the list goes.
function adopt(list) {
  const byId = new Map(list.map(h => [h.id, h]));
  const feat = $('#grid'), rest = $('#grid-rest');
  const cards = [...feat.querySelectorAll(':scope > li.card'), ...rest.querySelectorAll(':scope > li.card')].filter(li => !li.classList.contains('skel'));
  const types = new Map(cards.map(li => [li.dataset.id, li.dataset.type || 'home']));
  const fam = cards.filter(li => li.classList.contains('card-family') && (!list.length || byId.has(li.dataset.id)));
  const withFamily = new Set(fam.map(li => li.dataset.id));
  const plain = list.filter(h => !withFamily.has(h.id)).map((h, i) => card(h, i, types.get(h.id)));
  const featured = fam.filter(li => li.classList.contains('is-featured')), others = fam.filter(li => !li.classList.contains('is-featured'));
  if (!featured.length && plain.length && !others.length) {
    // a checkout with no build: no family cards at all, so the homes are the list and there is nothing to put behind a disclosure
    feat.replaceChildren(...plain);
    $('#all-homes').hidden = true;
  } else {
    feat.replaceChildren(...featured);
    rest.replaceChildren(...others, ...plain);
  }
  for (const p of document.querySelectorAll('.pairs-lines li[hidden]')) p.dataset.extra = '1';
  items = [...feat.children, ...rest.children].map(li => itemOf(li, byId));
  feat.setAttribute('aria-busy', 'false');
  // an address that asks for something nothing has is dropped; the page loads unfiltered and nothing breaks
  if (state.service && !items.some(it => it.services.includes(state.service))) state.service = '';
  if (state.persona && !items.some(it => it.persona.includes(state.persona))) state.persona = '';
  if (state.type && !items.some(it => it.type === state.type)) state.type = '';
  apply();
}

let wired = false;
function wire() {
  if (wired) return;
  wired = true;
  // the chooser's controls were inert in the static page; they work now
  for (const c of document.querySelectorAll('#swap button, #swap input')) c.disabled = false;
  apply();
  // The player's heaviest files, fetched into the cache the first time a card is pointed at or focused, so the
  // click lands on a warm three.js and engine; and the pointed-at home's spec, which the player fetches with the
  // HTTP cache (room-creator.html itself is not warmed: the player's URL carries a query, so a request for the
  // bare page would never be the one used). Not on touch: a finger that starts a scroll on a card is not a
  // choice, and a phone's data is not ours to spend on one.
  // Plain low-priority fetches, not <link rel="prefetch">: a browser marks a prefetch `Sec-Purpose: prefetch`, and the
  // homes.ci.computer zone refuses every such request with a 503 (`cf-speculation-refused`), so nothing was ever warmed
  // and the console filled with red. And each module is asked for by the URL the player will ask for: the page's import
  // map names it by a hash of its content (scripts/build-portal.mts), so warming the plain URL would warm a file nobody uses.
  const imports = (() => { try { return JSON.parse(document.querySelector('script[type="importmap"]').textContent).imports || {}; } catch { return {}; } })();
  const asked = new Set();
  const fetchLow = href => {
    const url = imports[href] || href;
    if (asked.has(url)) return;
    asked.add(url);
    // read the body so the browser finishes the download and keeps it; the answer is not used
    fetch(url, { priority: 'low' }).then(r => (r.ok ? r.arrayBuffer() : null)).catch(() => { /* a warm-up that fails costs nothing */ });
  };
  let warmed = false;
  const warm = e => {
    if (e.pointerType === 'touch') return;
    const a = e.target.closest && e.target.closest('.card a, #hero-play, #hero-media');
    if (!a) return;
    // only a link that opens the player (it names a house): a family's card goes to its page first, which is a light page
    const id = new URL(a.href).searchParams.get('house');
    if (!id) return;
    const urls = warmed ? [] : ['./assets/vendor/three/three.module.min.js', './assets/house-builder.js', './assets/viewer.js'];
    urls.push(`./content/houses/${encodeURIComponent(id)}.json`);
    warmed = true;
    for (const href of urls) fetchLow(href);
  };
  for (const ev of ['pointerover', 'focusin']) document.addEventListener(ev, warm, { passive: true });

  let typing = 0;
  $('#q').addEventListener('input', e => { clearTimeout(typing); typing = setTimeout(() => { state.q = e.target.value.trim(); apply(); }, 80); });
  // a chip narrows the families; a second press lets go
  for (const b of document.querySelectorAll('#pairs .pair')) b.addEventListener('click', () => { state.service = state.service === b.dataset.service ? '' : b.dataset.service; apply(); if (state.service) reveal(); });
  for (const b of document.querySelectorAll('#personas .persona')) b.addEventListener('click', () => { state.persona = state.persona === b.dataset.persona ? '' : b.dataset.persona; apply(); if (state.persona) reveal(); });
  for (const b of document.querySelectorAll('#types button')) b.addEventListener('click', () => { state.type = b.dataset.type || ''; apply(); if (state.type) reveal(); });
  const clear = () => { state.q = ''; state.service = ''; state.persona = ''; state.type = ''; apply(); $('#q').focus(); };
  $('#clear').addEventListener('click', clear);
  $('#clear-empty').addEventListener('click', clear);
  window.addEventListener('keydown', e => {
    if (!homes.length && !items.length) return;
    if (e.key === '/' && document.activeElement !== $('#q') && !e.metaKey && !e.ctrlKey && !e.altKey && !/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName || '')) { e.preventDefault(); $('#q').focus(); }
    if (e.key === 'Escape' && document.activeElement === $('#q')) { state.q = ''; apply(); $('#q').blur(); }
  });
  // "See Companion Core" is an in-page pointer: it lands on the band and puts focus on its heading, so a keyboard or a screen reader continues from there
  const see = document.querySelector('[data-cta="see-core"]');
  if (see) see.addEventListener('click', () => setTimeout(() => $('#cta-title')?.focus({ preventScroll: true }), 0));
  // a service-targeted link: the chip is lit, the families are filtered, and the first of them is brought into view
  if (state.service && !state.persona && !state.q && !state.type) setTimeout(reveal, 60);
}

async function main() {
  readUrl();
  names = await namesReady;
  $('#retry').addEventListener('click', async () => {
    const b = $('#retry');
    b.disabled = true; b.setAttribute('aria-busy', 'true');
    const ok = await load();
    b.disabled = false; b.removeAttribute('aria-busy');
    if (ok) { wire(); document.documentElement.dataset.gallery = 'ready'; }
  });
  const ok = await load();
  // the static families work whether or not the list came: the chooser is wired either way, the page says what failed
  wire();
  document.documentElement.dataset.gallery = ok ? 'ready' : 'failed';
}

main().catch(err => {
  console.warn('gallery: stopped', err);
  try { failed(true); } catch { /* the page has no line to show */ }
  document.documentElement.dataset.gallery = 'failed';
});
