// The portal's gallery (index.html): lists content/houses/index.json as cards with the committed thumbnails
// (portal/thumbs/<id>.webp, scripts/build-thumbs.mts), with search, a storeys filter and style tags. A card
// opens the live player, room-creator.html?mode=view. No WebGL, no framework, relative URLs only (the site is
// served under /ci-virtual-home/ on GitHub Pages). The filters live in the URL (?q=&storeys=&tag=) so a filtered
// view can be linked.

// The home the hero plays. scripts/build-thumbs.mts renders portal/hero.webp from the same house (--hero).
const HERO = 'aurora';

// Style tags: the words a visitor would filter by, matched against each spec's one-paragraph `style`. Only the
// tags that match three or more homes are shown, so the row follows the collection as it grows.
const TAGS = [
  ['Modern', /\bmodern|contemporary/i],
  ['Cottage', /\bcottage|cape cod|\bcabin|farmhouse/i],
  ['Mediterranean', /mediterranean|spanish|stucco|terracotta|desert|adobe/i],
  ['Pool', /\bpool\b/i],
  ['Garden', /\bgarden|greenhouse|planting|orchard/i],
  ['Waterfront', /\bwaterfront|\blake|\briver|\bdock|\bpond\b/i],
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

function matches(h) {
  if (state.storeys && String(h.storeys || 1) !== state.storeys && !(state.storeys === '3' && (h.storeys || 1) >= 3)) return false;
  if (state.tag && !h.tags.includes(state.tag)) return false;
  if (state.q) {
    const hay = `${h.name} ${h.style || ''} ${h.author || ''} ${h.source || ''} ${h.id}`.toLowerCase();
    if (!state.q.toLowerCase().split(/\s+/).filter(Boolean).every(w => hay.includes(w))) return false;
  }
  return true;
}

function card(h, i) {
  const li = document.createElement('li');
  li.className = 'card';
  li.dataset.id = h.id;
  const a = document.createElement('a');
  a.href = viewerHref(h.id);
  a.setAttribute('aria-label', `${h.name}. ${shortStyle(h.style)}. Play in 3D`);

  const thumb = document.createElement('div');
  thumb.className = 'thumb';
  const img = document.createElement('img');
  img.src = `./portal/thumbs/${encodeURIComponent(h.id)}.webp`;
  img.alt = '';
  img.width = 640; img.height = 360;
  img.decoding = 'async';
  if (i > 5) img.loading = 'lazy';
  img.addEventListener('error', () => img.classList.add('missing'), { once: true });
  const play = document.createElement('span');
  play.className = 'thumb-play';
  play.innerHTML = '<svg class="i i-fill"><use href="#i-play"/></svg>';
  play.append('Play in 3D');
  thumb.append(img, play);

  const body = document.createElement('div');
  body.className = 'card-body';
  const h3 = document.createElement('h3'); h3.textContent = h.name;
  const style = document.createElement('p'); style.className = 'style'; style.textContent = shortStyle(h.style); style.title = h.style || '';
  const facts = document.createElement('p'); facts.className = 'facts';
  const fact = text => { const s = document.createElement('span'); s.className = 'fact'; s.textContent = text; return s; };
  const storeys = h.storeys || 1;
  facts.append(fact(`${storeys} ${storeys === 1 ? 'storey' : 'storeys'}`));
  if (h.areaSqm) facts.append(fact(`${nf.format(h.areaSqm)} m²`));
  const credit = document.createElement('span'); credit.className = 'credit';
  credit.title = [h.author && `Sims 4 build by ${h.author}`, h.source].filter(Boolean).join(', ');
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
  const shown = TAGS.map(([name]) => name).filter(n => (counts.get(n) || 0) >= 3);
  if (state.tag && !shown.includes(state.tag)) state.tag = '';
  $('#tags').replaceChildren(...shown.map(name => {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'tag'; b.dataset.tag = name;
    b.append(name);
    const n = document.createElement('small'); n.textContent = String(counts.get(name)); b.append(n);
    b.addEventListener('click', () => { state.tag = state.tag === name ? '' : name; apply(); });
    return b;
  }));
}

function apply() {
  let n = 0;
  for (const li of $('#grid').children) {
    const h = homes.find(x => x.id === li.dataset.id);
    const on = matches(h);
    li.hidden = !on;
    if (on) n++;
  }
  $('.count').textContent = n === homes.length ? String(homes.length) : `${n} of ${homes.length}`;
  $('#empty').hidden = n !== 0;
  for (const b of document.querySelectorAll('#storeys button')) b.setAttribute('aria-pressed', String(b.dataset.storeys === state.storeys));
  for (const b of document.querySelectorAll('#tags .tag')) b.setAttribute('aria-pressed', String(b.dataset.tag === state.tag));
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
    const short = hero.name.replace(/^Base Game\s+/i, '');
    for (const el of document.querySelectorAll('[data-hero-name]')) el.textContent = short;
    $('#hero-play').href = viewerHref(HERO);
    $('#hero-media').href = viewerHref(HERO);
    $('#hero-media').setAttribute('aria-label', `Play ${hero.name} in 3D`);
  }
}

async function main() {
  readUrl();
  let index;
  try {
    const res = await fetch('./content/houses/index.json');
    if (!res.ok) throw new Error(`index.json: ${res.status}`);
    index = await res.json();
  } catch (err) {
    console.warn(err);
    $('#empty').hidden = false;
    $('#empty').querySelector('p').textContent = 'The list of homes could not be loaded. Reload the page to try again.';
    $('#clear').hidden = true;
    return;
  }
  homes = (index.houses || []).map(h => ({ ...h, tags: TAGS.filter(([, re]) => re.test(h.style || '')).map(([name]) => name) }));
  stats();
  renderTags();
  $('#grid').replaceChildren(...homes.map(card));
  apply();

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
    if (e.key === '/' && document.activeElement !== $('#q') && !e.metaKey && !e.ctrlKey) { e.preventDefault(); $('#q').focus(); }
    if (e.key === 'Escape' && document.activeElement === $('#q')) { state.q = ''; apply(); $('#q').blur(); }
  });
  document.documentElement.dataset.gallery = 'ready';
}

main();
