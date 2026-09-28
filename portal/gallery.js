// The portal's gallery (index.html): lists content/houses/index.json as cards with the committed thumbnails
// (portal/thumbs/<id>.webp, scripts/build-thumbs.mts), with search, a storeys filter and style tags. A card
// opens the live player, room-creator.html?mode=view. No WebGL, no framework, relative URLs only (the site is
// served under a sub-path on GitHub Pages). The filters live in the URL (?q=&storeys=&tag=) so a filtered view
// can be linked. A home's name is assets/home-names.js's displayName (the Sims build's own title is the credit).
import { displayName, buildName, buildCredit } from '../assets/home-names.js';

// The home the hero plays. scripts/build-thumbs.mts renders portal/hero.webp from the same house (--hero).
const HERO = 'aurora';

// Style tags: the words a visitor would filter by, matched against each spec's one-paragraph `style`. A tag is
// shown when it matches three or more homes and no more than half of them (a tag that fits most homes, like
// gables, narrows nothing), so the row follows the collection as it grows. Waterfront means open water: a pond
// in the garden does not make a lake house.
const TAGS = [
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
const viewerHref = id => `./room-creator.html?mode=view&house=${encodeURIComponent(id)}`;
// the first clause of the spec's style paragraph: "Two-storey white modern villa, stacked flat roofs, …" → "Two-storey white modern villa"
const shortStyle = s => (s || '').split(/[:;,(]| with | over | under /)[0].trim();
const nf = new Intl.NumberFormat('en');

let homes = [];
let shownTags = [];
const state = { q: '', storeys: '', tag: '' };

function readUrl() {
  const q = new URLSearchParams(location.search);
  state.q = q.get('q') || '';
  state.storeys = q.get('storeys') || '';
  state.tag = q.get('tag') || '';
}
function writeUrl() {
  const q = new URLSearchParams();
  if (state.q) q.set('q', state.q);
  if (state.storeys) q.set('storeys', state.storeys);
  if (state.tag) q.set('tag', state.tag);
  const s = q.toString();
  try { history.replaceState(null, '', s ? `?${s}${location.hash}` : `${location.pathname}${location.hash}`); } catch { /* file:// or sandboxed */ }
}

// each filter on its own, so a tag's count can be taken against the others
const storeysOk = h => !state.storeys || String(h.storeys || 1) === state.storeys || (state.storeys === '3' && (h.storeys || 1) >= 3);
const tagOk = h => !state.tag || h.tags.includes(state.tag);
function queryOk(h) {
  if (!state.q) return true;
  const hay = `${h.display} ${h.name} ${h.style || ''} ${h.author || ''} ${h.source || ''} ${h.id}`.toLowerCase();
  return state.q.toLowerCase().split(/\s+/).filter(Boolean).every(w => hay.includes(w));
}
const matches = h => storeysOk(h) && tagOk(h) && queryOk(h);

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
  // the builder's credit; its tooltip names the build the spec was written from, by its own title
  const credit = document.createElement('span'); credit.className = 'credit';
  credit.title = [buildCredit(h), h.source].filter(Boolean).join(', ');
  if (h.author) { credit.append('by '); const b = document.createElement('b'); b.textContent = h.author; credit.append(b); }
  facts.append(credit);
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
  for (const li of $('#grid').children) {
    const h = homes.find(x => x.id === li.dataset.id);
    if (!h) continue;
    const on = matches(h);
    li.hidden = !on;
    if (on) n++;
  }
  $('.count').textContent = n === homes.length ? String(homes.length) : `${n} of ${homes.length}`;
  $('#empty').hidden = n !== 0;
  for (const b of document.querySelectorAll('#storeys button')) b.setAttribute('aria-pressed', String(b.dataset.storeys === state.storeys));
  // a tag's count is the homes it would show with the search and storeys as they are; a tag that would show
  // none is greyed out (the pressed one stays pressable, so it can be let go)
  for (const b of document.querySelectorAll('#tags .tag')) {
    const name = b.dataset.tag, on = name === state.tag;
    const c = homes.filter(h => h.tags.includes(name) && storeysOk(h) && queryOk(h)).length;
    b.querySelector('small').textContent = String(c);
    b.setAttribute('aria-pressed', String(on));
    b.disabled = c === 0 && !on;
    b.setAttribute('aria-label', `${name}, ${c} ${c === 1 ? 'home' : 'homes'}`);
  }
  if ($('#q').value !== state.q) $('#q').value = state.q;
  writeUrl();
}

function stats() {
  const builders = new Set(homes.map(h => h.author).filter(Boolean));
  const area = homes.reduce((a, h) => a + (h.areaSqm || 0), 0);
  $('[data-stat="homes"]').textContent = String(homes.length);
  $('[data-stat="builders"]').textContent = String(builders.size);
  $('[data-stat="area"]').textContent = nf.format(Math.round(area / 10) * 10);
  const hero = homes.find(h => h.id === HERO);
  if (hero) {
    for (const el of document.querySelectorAll('[data-hero-name]')) el.textContent = hero.display;
    $('#hero-play').href = viewerHref(HERO);
    $('#hero-media').href = viewerHref(HERO);
    $('#hero-media').setAttribute('aria-label', `Play ${hero.display} in 3D`);
  }
}

// The list did not load: say so where the homes would be, with a way to try again, and put the filters away
// (they have nothing to filter)
function failed(on) {
  $('#failed').hidden = !on;
  $('#grid').hidden = on;
  $('#tags').hidden = on;
  $('#filters').classList.toggle('off', on);
  for (const c of document.querySelectorAll('#filters input, #filters button')) c.disabled = on;
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
  homes = (index.houses || []).map(h => ({ ...h, name: buildName(h), display: displayName(h), tags: TAGS.filter(([, re]) => re.test(h.style || '')).map(([name]) => name) }));
  stats();
  renderTags();
  $('#grid').replaceChildren(...homes.map(card));
  $('#grid').setAttribute('aria-busy', 'false');
  apply();
  return true;
}

let wired = false;
function wire() {
  if (wired) return;
  wired = true;
  // The player's heaviest files, fetched into the cache the first time a card is pointed at or focused, so the
  // click lands on a warm three.js and engine; and the pointed-at home's spec, which the player fetches with the
  // HTTP cache (room-creator.html itself is not warmed: the player's URL carries a query, so a prefetch of the
  // bare page would never be the one used). Not on touch: a finger that starts a scroll on a card is not a
  // choice, and a phone's data is not ours to spend on one.
  let warmed = false;
  const warm = e => {
    if (e.pointerType === 'touch') return;
    const a = e.target.closest && e.target.closest('.card a, #hero-play, #hero-media');
    if (!a) return;
    const id = new URL(a.href).searchParams.get('house');
    const urls = warmed ? [] : ['./assets/vendor/three/three.module.min.js', './assets/house-builder.js', './assets/viewer.js'];
    if (id) urls.push(`./content/houses/${encodeURIComponent(id)}.json`);
    warmed = true;
    for (const href of urls) {
      if (document.querySelector(`link[rel="prefetch"][href="${href}"]`)) continue;
      const l = document.createElement('link'); l.rel = 'prefetch'; l.href = href; document.head.append(l);
    }
  };
  for (const ev of ['pointerover', 'focusin']) document.addEventListener(ev, warm, { passive: true });

  let typing = 0;
  $('#q').addEventListener('input', e => { clearTimeout(typing); typing = setTimeout(() => { state.q = e.target.value.trim(); apply(); }, 80); });
  for (const b of document.querySelectorAll('#storeys button')) b.addEventListener('click', () => { state.storeys = b.dataset.storeys; apply(); });
  $('#clear').addEventListener('click', () => { state.q = ''; state.storeys = ''; state.tag = ''; apply(); $('#q').focus(); });
  window.addEventListener('keydown', e => {
    if (!homes.length) return;
    if (e.key === '/' && document.activeElement !== $('#q') && !e.metaKey && !e.ctrlKey) { e.preventDefault(); $('#q').focus(); }
    if (e.key === 'Escape' && document.activeElement === $('#q')) { state.q = ''; apply(); $('#q').blur(); }
  });
}

async function main() {
  readUrl();
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

main();
