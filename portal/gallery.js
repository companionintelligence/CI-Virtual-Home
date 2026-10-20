// The portal's front page (index.html): the families and their homes, with the committed thumbnails
// (portal/thumbs/<id>.webp, scripts/build-thumbs.mts), search, a persona filter (what they do: work from home, code, play,
// study, make, host), a storeys filter and style tags. No WebGL, no framework, relative URLs only (the site is served under
// a sub-path by portal:test). The filters live in the URL (?q=&persona=&storeys=&tag=) so a filtered view can be linked; any
// other parameter in the address (an ad's utm_ tags, a click id) is kept as it is. A home's name is assets/home-names.js's
// displayName.
//
// "Pick a person" (the cards of the organiser, builder, gamer and learner, scripts/portal-front.mts pickPerson) is the same filter as the persona buttons: a card's
// button sets and clears state.persona, the list "Rented before, on the Core now" for that archetype is shown, and the wall of the apps the families run dims the apps
// that archetype does not use. All of it is static HTML in the built page; this file only toggles classes and aria-pressed.
//
// The family cards are in the built page as static HTML (scripts/portal-front.mts, written by scripts/build-portal.mts), so a
// crawler, a visitor without JavaScript and an in-app browser with a slow script see them. This script ADOPTS them (it keeps
// the elements, reads data-persona and data-find off them) and draws a card only for a home with no family, as it always did:
// that card opens the live player, room-creator.html?mode=view. A family's card opens its page (family/<slug>), which opens
// the tour. A checkout served as it is has no family cards and lists the homes.
//
// The names are imported when the page runs, not statically: if that one file does not come (a partial deploy, a
// dropped request), the gallery still lists the homes, under the name the list carries, instead of never running and
// leaving the placeholder cards up for good.
const FALLBACK_NAMES = {
  displayName: h => (h.name || '').trim() || h.id,
};
const namesReady = import('../assets/home-names.js').catch(err => { console.warn('gallery: the names did not load', err); return FALLBACK_NAMES; });
let names = FALLBACK_NAMES;

// Style tags: the words a visitor would filter by, matched against each spec's one-paragraph `style`. A tag is
// shown when it matches three or more homes and no more than half of them (a tag that fits most homes, like
// gables, narrows nothing), so the row follows the collection as it grows. Waterfront means open water: a pond
// in the garden does not make a lake house. Apartment is a home that is one unit in a block (reference/APARTMENTS.md): the style
// paragraph of each says "apartment" (the loft, the flat, the penthouse and the duplex are each one), and only that word counts,
// because "flat" and "loft" alone also name a flat roof, a flat lawn and a loft dormer on houses.
const TAGS = [
  ['Apartment', /\bapartments?\b/i],
  ['Modern', /\bmodern|contemporary/i],
  ['Cottage', /\bcottage|cape cod|\bcabin|farmhouse/i],
  ['Mediterranean', /mediterranean|spanish|stucco|terracotta|desert|adobe/i],
  ['Pool', /\bpool\b/i],
  ['Garden', /\bgarden|greenhouse|planting|orchard/i],
  ['Waterfront', /\bwaterfront|\blake\b|\briver\b|\bdock\b|\bcreek\b/i],
  ['Porch', /\bporch|veranda|portico/i],
  ['Gables', /\bgable/i],
  ['Brick', /\bbrick/i],
  ['Stone', /\bstone\b/i],
  ['Timber', /\btimber|\bwood|\blog\b|\bcedar/i],
];

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

let homes = [];
let items = [];          // one per card in the grid: { li, h (the home), persona: [archetypes], find: 'words the search reads' }
let shownTags = [];
const state = { q: '', storeys: '', tag: '', persona: '' };
const MANAGED = ['q', 'storeys', 'tag', 'persona'];

function readUrl() {
  const q = new URLSearchParams(location.search);
  state.q = q.get('q') || '';
  state.storeys = q.get('storeys') || '';
  state.tag = q.get('tag') || '';
  state.persona = /^[a-z0-9]+(-[a-z0-9]+){0,4}$/.test(q.get('persona') || '') ? q.get('persona') : '';
}
// The address keeps every parameter that is not one of ours, byte for byte (an ad's utm_ tags and a click id: portal/campaign.js reads
// them, and a platform may check the id as it was sent), and ours are written after them.
function writeUrl() {
  const others = location.search.replace(/^\?/, '').split('&').filter(p => p && !MANAGED.includes(p.split('=')[0]));
  const ours = MANAGED.filter(k => state[k]).map(k => `${k}=${encodeURIComponent(state[k])}`);
  const s = [...others, ...ours].join('&');
  try { history.replaceState(null, '', `${location.pathname}${s ? `?${s}` : ''}${location.hash}`); } catch { /* file:// or sandboxed */ }
}

// each filter on its own, so a tag's count can be taken against the others
const storeysOk = h => !state.storeys || String(h.storeys || 1) === state.storeys || (state.storeys === '3' && (h.storeys || 1) >= 3);
const tagOk = h => !state.tag || h.tags.includes(state.tag);
const personaOk = it => !state.persona || it.persona.includes(state.persona);
// the search reads the home's name, style and id, and for a family its name, its people, their jobs, every app and what it replaces
function queryOk(it) {
  if (!state.q) return true;
  const hay = `${it.h.display} ${it.h.style || ''} ${it.h.id} ${it.find}`.toLowerCase();
  return state.q.toLowerCase().split(/\s+/).filter(Boolean).every(w => hay.includes(w));
}
const matches = it => storeysOk(it.h) && tagOk(it.h) && personaOk(it) && queryOk(it);

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

function card(h, i) {
  const li = document.createElement('li');
  li.className = 'card';
  li.dataset.id = h.id;
  const a = document.createElement('a');
  a.href = viewerHref(h.id);
  a.setAttribute('data-campaign', '');   // portal/campaign.js carries an ad's tags into the player
  a.setAttribute('aria-label', `${h.display}. ${shortStyle(h.style)}. Play in 3D`);

  const thumb = document.createElement('div');
  thumb.className = 'thumb';
  const img = document.createElement('img');
  img.src = `./portal/thumbs/${encodeURIComponent(h.id)}.webp`;
  img.alt = '';
  img.width = 640; img.height = 360;
  img.decoding = 'async';
  if (i > 5) img.loading = 'lazy';
  img.addEventListener('error', () => missingThumb(thumb, h), { once: true });
  const play = document.createElement('span');
  play.className = 'thumb-play';
  play.innerHTML = '<svg class="i i-fill"><use href="#i-play"/></svg>';
  play.append('Play in 3D');
  thumb.append(img, play);

  const body = document.createElement('div');
  body.className = 'card-body';
  const h3 = document.createElement('h3'); h3.textContent = h.display;
  const style = document.createElement('p'); style.className = 'style'; style.textContent = shortStyle(h.style); style.title = h.style || '';
  const facts = document.createElement('p'); facts.className = 'facts';
  const fact = text => { const s = document.createElement('span'); s.className = 'fact'; s.textContent = text; return s; };
  const storeys = h.storeys || 1;
  facts.append(fact(`${storeys} ${storeys === 1 ? 'storey' : 'storeys'}`));
  if (h.areaSqm) facts.append(fact(`${nf.format(h.areaSqm)} m²`));
  body.append(h3, style, facts);

  a.append(thumb, body);
  li.append(a);
  return li;
}

function renderTags() {
  const counts = new Map();
  for (const h of homes) for (const t of h.tags) counts.set(t, (counts.get(t) || 0) + 1);
  shownTags = TAGS.map(([name]) => name).filter(n => (counts.get(n) || 0) >= 3 && (counts.get(n) || 0) <= homes.length / 2);
  if (state.tag && !shownTags.includes(state.tag)) state.tag = '';
  $('#tags').replaceChildren(...shownTags.map(name => {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'tag'; b.dataset.tag = name;
    b.append(name);
    const n = document.createElement('small'); b.append(n);
    b.addEventListener('click', () => { state.tag = state.tag === name ? '' : name; apply(); });
    return b;
  }));
}

function apply() {
  let n = 0;
  for (const it of items) {
    const on = matches(it);
    it.li.hidden = !on;
    if (on) n++;
  }
  $('.count').textContent = n === items.length ? String(items.length) : `${n} of ${items.length}`;
  $('#empty').hidden = n !== 0;
  for (const b of document.querySelectorAll('#storeys button')) b.setAttribute('aria-pressed', String(b.dataset.storeys === state.storeys));
  // a button's count is the cards it would show with the search and the other filters as they are; one that would show none is
  // greyed out (the pressed one stays pressable, so it can be let go)
  const count = (b, label, c, on) => {
    b.querySelector('small').textContent = String(c);
    b.setAttribute('aria-pressed', String(on));
    b.disabled = c === 0 && !on;
    b.setAttribute('aria-label', `${label}, ${c} ${c === 1 ? 'home' : 'homes'}`);
  };
  for (const b of document.querySelectorAll('#tags .tag')) {
    const name = b.dataset.tag;
    count(b, name, items.filter(it => it.h.tags.includes(name) && storeysOk(it.h) && personaOk(it) && queryOk(it)).length, name === state.tag);
  }
  for (const b of document.querySelectorAll('#personas .persona')) {
    const id = b.dataset.persona;
    const c = items.filter(it => it.persona.includes(id) && storeysOk(it.h) && tagOk(it.h) && queryOk(it)).length;
    count(b, b.firstChild.textContent, c, id === state.persona);
    b.setAttribute('aria-label', `${b.firstChild.textContent}, ${c} ${c === 1 ? 'family' : 'families'}`);
  }
  // story v2: the archetype cards (pressed = the filter), the list for the archetype chosen and the wall dimmed to the apps it uses
  for (const b of document.querySelectorAll('#pick .arch-btn')) {
    const on = b.dataset.persona === state.persona;
    b.setAttribute('aria-pressed', String(on));
    b.closest('.arch').classList.toggle('on', on);
  }
  for (const p of document.querySelectorAll('#pick .arch-panel')) p.classList.toggle('on', p.dataset.persona === state.persona);
  // on a phone the cards are a row that scrolls sideways: bring the chosen one into the middle of it (the row only; the page is not moved)
  const chosen = document.querySelector('#pick .arch.on'), row = document.querySelector('#pick .pick-grid');
  if (chosen && row && row.scrollWidth > row.clientWidth + 1) {
    const left = Math.max(0, chosen.getBoundingClientRect().left - row.getBoundingClientRect().left + row.scrollLeft - (row.clientWidth - chosen.offsetWidth) / 2);
    try { row.scrollTo({ left, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' }); } catch { row.scrollLeft = left; }
  }
  const wall = document.getElementById('wall');
  if (wall) {
    wall.classList.toggle('filtered', !!state.persona);
    for (const li of wall.querySelectorAll('.wall-app')) li.classList.toggle('dim', !!state.persona && !(li.dataset.by || '').split(' ').includes(state.persona));
  }
  if ($('#q').value !== state.q) $('#q').value = state.q;
  writeUrl();
}

function stats() {
  const area = homes.reduce((a, h) => a + (h.areaSqm || 0), 0);
  $('[data-stat="homes"]').textContent = String(homes.length);
  $('[data-stat="area"]').textContent = nf.format(Math.round(area / 10) * 10);
}

// The list did not load: say so where the homes would be, with a way to try again, and put the filters away
// (they have nothing to filter)
function failed(on) {
  $('#failed').hidden = !on;
  $('#grid').hidden = on;
  $('#tags').hidden = on;
  $('#more-filters').hidden = on;
  $('#personas').hidden = on || !document.querySelector('#personas .persona');
  $('#filters').classList.toggle('off', on);
  for (const c of document.querySelectorAll('#filters input, #filters button, #personas button, #more-filters button, #pick .arch-btn')) c.disabled = on;
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
    return false;
  }
  failed(false);
  // Anything that throws from here on (a record the page did not expect) ends on the same card, with the same way to
  // try again, as a list that did not download: a gallery never stays on its placeholders.
  try {
    homes = (index.houses || []).map(h => ({ ...h, display: names.displayName(h), tags: TAGS.filter(([, re]) => re.test(h.style || '')).map(([name]) => name) }));
    stats();
    renderTags();
    // the family cards in the page are kept as they are; a card is drawn only for a home with no family card (the plain list, the
    // source page without a build, a home whose family is not current), after the families', and a family card whose home is not in the list goes
    const byId = new Map(homes.map(h => [h.id, h]));
    const families = [...$('#grid').querySelectorAll(':scope > li.card-family')].filter(li => byId.has(li.dataset.id));
    const withFamily = new Set(families.map(li => li.dataset.id));
    const plain = homes.filter(h => !withFamily.has(h.id)).map((h, i) => card(h, families.length + i));
    $('#grid').replaceChildren(...families, ...plain);
    items = [...$('#grid').children].map(li => ({
      li, h: byId.get(li.dataset.id),
      persona: (li.dataset.persona || '').split(' ').filter(Boolean),
      find: li.dataset.find || '',
    }));
    $('#grid').setAttribute('aria-busy', 'false');
    // the persona buttons the build wrote: only the jobs a current family does; a state in the address that no card has is dropped
    const personas = [...document.querySelectorAll('#personas .persona')];
    $('#personas').hidden = !personas.length;
    if (state.persona && !personas.some(b => b.dataset.persona === state.persona)) state.persona = '';
    // the style and storeys filters are for browsing homes: open on a wide screen, and wherever the address already uses one
    if (matchMedia('(min-width: 901px)').matches || state.storeys || state.tag) $('#more-filters').open = true;
    apply();
  } catch (err) {
    console.warn('gallery: the list could not be shown', err);
    homes = [];
    failed(true);
    return false;
  }
  return true;
}

let wired = false;
function wire() {
  if (wired) return;
  wired = true;
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
  for (const b of document.querySelectorAll('#storeys button')) b.addEventListener('click', () => { state.storeys = b.dataset.storeys; apply(); });
  for (const b of document.querySelectorAll('#personas .persona')) b.addEventListener('click', () => { state.persona = state.persona === b.dataset.persona ? '' : b.dataset.persona; apply(); });
  // story v2: a card of "Pick a person" is the same filter
  for (const b of document.querySelectorAll('#pick .arch-btn')) b.addEventListener('click', () => { state.persona = state.persona === b.dataset.persona ? '' : b.dataset.persona; apply(); });
  $('#clear').addEventListener('click', () => { state.q = ''; state.storeys = ''; state.tag = ''; state.persona = ''; apply(); $('#q').focus(); });
  window.addEventListener('keydown', e => {
    if (!homes.length) return;
    if (e.key === '/' && document.activeElement !== $('#q') && !e.metaKey && !e.ctrlKey) { e.preventDefault(); $('#q').focus(); }
    if (e.key === 'Escape' && document.activeElement === $('#q')) { state.q = ''; apply(); $('#q').blur(); }
  });
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
  if (!(await load())) { document.documentElement.dataset.gallery = 'failed'; return; }
  wire();
  document.documentElement.dataset.gallery = 'ready';
}

main().catch(err => {
  console.warn('gallery: stopped', err);
  try { failed(true); } catch { /* the page has no card to show */ }
  document.documentElement.dataset.gallery = 'failed';
});
