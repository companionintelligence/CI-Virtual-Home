// The landing's family list (index.html): story/families.<hash>.json as cards, with a household facet, ten topic chips and a
// search. A card opens the family's page (family/<slug>); "Take the tour" opens the live player. No WebGL, no framework,
// relative URLs only (the site is served under a sub-path by portal:test). The filters live in the URL
// (?household=&topic=a,b&q=) so a filtered view can be linked; values it does not know are ignored.
//
// The page names no home and no builder: a card is a family (surname, an invented address, a tagline, who lives there,
// which apps they run). Nothing the engine owns is imported here, and nothing is fetched before an interaction except the
// family list itself: three.js, the engine and a family's spec are warmed when a card is pointed at or focused.
const $ = sel => document.querySelector(sel);
const $$ = sel => [...document.querySelectorAll(sel)];
const HOUSEHOLDS = ['solo-or-couple', 'young-family', 'older-kids', 'grandparents'];
const TOPICS = ['home', 'food', 'iot', 'productivity', 'money', 'privacy', 'kids', 'media', 'creative', 'small-business'];
const tourHref = slug => `./room-creator.html?mode=view&family=${encodeURIComponent(slug)}`;
const pageHref = slug => `./family/${encodeURIComponent(slug)}`;
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

let families = [];
const state = { q: '', household: '', topics: new Set() };

function readUrl() {
  const q = new URLSearchParams(location.search);
  state.q = (q.get('q') || '').slice(0, 80);
  const h = q.get('household') || '';
  state.household = HOUSEHOLDS.includes(h) ? h : '';
  state.topics = new Set((q.get('topic') || '').split(',').filter(t => TOPICS.includes(t)));
}
function writeUrl() {
  const q = new URLSearchParams();
  if (state.household) q.set('household', state.household);
  if (state.topics.size) q.set('topic', [...state.topics].join(','));
  if (state.q) q.set('q', state.q);
  const s = q.toString();
  try { history.replaceState(null, '', s ? `?${s}${location.hash}` : `${location.pathname}${location.hash}`); } catch { /* file:// or sandboxed */ }
}

// each facet on its own, so a count can be taken against the others
const householdOk = f => !state.household || f.household === state.household;
const topicsOk = f => [...state.topics].every(t => f.topics.includes(t));
function queryOk(f) {
  if (!state.q) return true;
  return state.q.toLowerCase().split(/\s+/).filter(Boolean).every(w => f._hay.includes(w));
}
const matches = f => householdOk(f) && topicsOk(f) && queryOk(f);
const hay = f => [f.title, f.surname, f.address, f.tagline, ...f.members.map(m => m.name), ...f.members.map(m => m.companion || ''), ...f.apps.map(a => a.name), ...(f.rooms || [])].join(' ').toLowerCase();

function card(f, i) {
  const li = document.createElement('li');
  li.className = 'card';
  li.dataset.slug = f.slug;
  const thumb = document.createElement('div'); thumb.className = 'thumb';
  const img = document.createElement('img');
  img.src = `./${f.thumb}`; img.alt = `An aerial view of the ${f.surname} family home, drawn in 3D.`;
  img.width = 640; img.height = 360; img.decoding = 'async';
  if (i > 5) img.loading = 'lazy';
  thumb.append(img);

  const body = document.createElement('div'); body.className = 'card-body';
  const kick = document.createElement('p'); kick.className = 'card-kicker'; kick.textContent = 'Fictional family';
  const h3 = document.createElement('h3');
  const a = document.createElement('a'); a.href = pageHref(f.slug); a.textContent = f.title; h3.append(a);
  const addr = document.createElement('p'); addr.className = 'addr'; addr.textContent = f.address;
  const tag = document.createElement('p'); tag.className = 'tag'; tag.textContent = f.tagline;

  const people = document.createElement('div'); people.className = 'card-people';
  const ul = document.createElement('ul'); ul.className = 'avatars';
  const colours = ['chart-1', 'chart-2', 'chart-3', 'chart-4', 'chart-5'];
  f.members.slice(0, 5).forEach((m, k) => {
    const li2 = document.createElement('li'); li2.className = 'avatar'; li2.style.setProperty('--disc', `var(--${colours[k % 5]})`); li2.setAttribute('aria-hidden', 'true');
    li2.textContent = m.name.charAt(0).toUpperCase(); ul.append(li2);
  });
  const who = document.createElement('span'); who.className = 'sr';
  who.textContent = `Who lives there: ${f.members.map(m => m.name).join(', ')}.`;
  people.append(ul, who);

  const apps = document.createElement('p'); apps.className = 'chips card-apps';
  for (const app of f.apps.slice(0, 3)) { const c = document.createElement('span'); c.className = 'chip'; c.textContent = app.name; apps.append(c); }
  if (f.apps.length > 3) { const c = document.createElement('span'); c.className = 'chip chip-quiet'; c.textContent = `+${f.apps.length - 3}`; apps.append(c); }

  const tour = document.createElement('a'); tour.className = 'tour'; tour.href = tourHref(f.slug);
  tour.setAttribute('aria-label', `Take the tour of ${f.title}`);
  tour.innerHTML = 'Take the tour<svg class="i" aria-hidden="true"><use href="#i-next"/></svg>';
  body.append(kick, h3, addr, tag, people, apps, tour);
  li.append(thumb, body);
  return li;
}

function apply() {
  let n = 0;
  for (const li of $('#grid').children) {
    const f = families.find(x => x.slug === li.dataset.slug);
    if (!f) continue;
    const on = matches(f);
    li.hidden = !on;
    if (on) n++;
  }
  const total = families.length;
  $('#count').textContent = n === total ? plural(total, 'family', 'families') : `${n} of ${plural(total, 'family', 'families')}`;
  $('#empty').hidden = n !== 0;
  // household counts: the families that facet would show with the topics and the search as they are
  for (const b of $$('#household [data-household]')) {
    const h = b.dataset.household, on = h === state.household;
    b.setAttribute('aria-checked', String(on));
    b.tabIndex = on ? 0 : -1;
    const small = b.querySelector('small');
    if (small) { const c = families.filter(f => f.household === h && topicsOk(f) && queryOk(f)).length; small.textContent = String(c); b.setAttribute('aria-label', `${b.firstChild.textContent.trim()}, ${plural(c, 'family', 'families')}`); }
  }
  // topic counts: the families it would show with the household and the search as they are; at none it is off (unless pressed, so it can be let go)
  for (const b of $$('#topics [data-topic]')) {
    const t = b.dataset.topic, on = state.topics.has(t);
    const c = families.filter(f => f.topics.includes(t) && householdOk(f) && queryOk(f) && [...state.topics].filter(x => x !== t).every(x => f.topics.includes(x))).length;
    b.querySelector('small').textContent = String(c);
    b.setAttribute('aria-pressed', String(on));
    b.disabled = c === 0 && !on;
    b.setAttribute('aria-label', `${b.firstChild.textContent.trim()}, ${plural(c, 'family', 'families')}`);
  }
  const active = (state.household ? 1 : 0) + state.topics.size + (state.q ? 1 : 0);
  $('#clear-top').hidden = !active;
  $('#filters-n').textContent = active ? String(active) : '';
  if ($('#q').value !== state.q) $('#q').value = state.q;
  writeUrl();
}

// The list did not load: say so where the families would be, with a way to try again, and put the filters away
function failed(on) {
  $('#failed').hidden = !on;
  $('#grid').hidden = on;
  $('#filters').hidden = on;
  $('#count').hidden = on;
  $('#grid').setAttribute('aria-busy', String(!on && !families.length));
}

async function load() {
  let list;
  try {
    const url = document.querySelector('meta[name="vh-families"]').content;
    const res = await fetch(`./${url}`, { cache: families.length ? 'reload' : 'default' });
    if (!res.ok) throw new Error(`families: ${res.status}`);
    list = await res.json();
  } catch (err) {
    console.warn(err);
    failed(true);
    return false;
  }
  failed(false);
  families = list.families.slice().sort((a, b) => a.order - b.order);
  for (const f of families) f._hay = hay(f);
  // a topic or a household nobody in this build has is not a choice: take it out of the URL's state
  $('#grid').replaceChildren(...families.map(card));
  $('#grid').setAttribute('aria-busy', 'false');
  apply();
  return true;
}

// ---------------------------------------------------------------- the phone's sheet: the same panel, moved into a <dialog>
function wireSheet() {
  const sheet = $('#sheet'), panel = $('#filter-panel'), opener = $('#filters-open'), home = $('#filters');
  if (!sheet || typeof sheet.showModal !== 'function') { opener.hidden = true; return; }
  const close = () => { if (sheet.open) sheet.close(); };
  opener.addEventListener('click', () => { $('#sheet-body').append(panel); sheet.showModal(); });
  sheet.addEventListener('close', () => { home.insertBefore(panel, $('#clear-top')); opener.focus(); });
  $('#sheet-close').addEventListener('click', close);
  $('#sheet-done').addEventListener('click', close);
  $('#sheet-clear').addEventListener('click', () => { clearAll(); });
  sheet.addEventListener('click', e => { if (e.target === sheet) close(); });   // the backdrop
  matchMedia('(min-width: 701px)').addEventListener('change', e => { if (e.matches) close(); });
}

function clearAll() { state.q = ''; state.household = ''; state.topics.clear(); apply(); }

let wired = false;
function wire() {
  if (wired) return;
  wired = true;
  // The player's heaviest files, fetched into the cache the first time a card is pointed at or focused, so the click lands
  // on a warm three.js and engine; and the pointed-at family's spec (the player fetches it with the HTTP cache).
  // Plain low-priority fetches, not <link rel="prefetch">: the live zone refuses a prefetch with a 503. Each module is asked
  // for by the URL the player will ask for (the import map names it by a hash of its content). Not on touch: a finger that
  // starts a scroll on a card is not a choice, and a phone's data is not ours to spend on one.
  const imports = (() => { try { return JSON.parse(document.querySelector('script[type="importmap"]').textContent).imports || {}; } catch { return {}; } })();
  const asked = new Set();
  const fetchLow = href => {
    const url = imports[href] || href;
    if (asked.has(url)) return;
    asked.add(url);
    fetch(url, { priority: 'low' }).then(r => (r.ok ? r.arrayBuffer() : null)).catch(() => { /* a warm-up that fails costs nothing */ });
  };
  let manifest = null;
  const specOf = async slug => {
    try { manifest ||= await (await fetch('./story/manifest.json')).json(); } catch { return ''; }
    return (manifest.byFamily[slug] || {}).spec || '';
  };
  let warmed = false;
  const warm = e => {
    if (e.pointerType === 'touch') return;
    const a = e.target.closest && e.target.closest('.card, #hero-media, #hero-play');
    if (!a) return;
    const link = a.matches('.card') ? a.querySelector('h3 a') : a;
    const m = /(?:family\/|family=)([a-z-]+)/.exec(link.getAttribute('href') || '');
    if (!warmed) for (const href of ['./assets/vendor/three/three.module.min.js', './assets/house-builder.js', './assets/viewer.js']) fetchLow(href);
    warmed = true;
    if (m) specOf(m[1]).then(u => { if (u) fetchLow(`./${u}`); });
  };
  for (const ev of ['pointerover', 'focusin']) document.addEventListener(ev, warm, { passive: true });

  let typing = 0;
  $('#q').addEventListener('input', e => { clearTimeout(typing); typing = setTimeout(() => { state.q = e.target.value.trim(); apply(); }, 80); });
  for (const b of $$('#household [data-household]')) b.addEventListener('click', () => { state.household = b.dataset.household; apply(); });
  // a radio group: one tab stop, the arrows move and choose
  $('#household .radios').addEventListener('keydown', e => {
    const keys = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 };
    if (!(e.key in keys)) return;
    e.preventDefault();
    const radios = $$('#household [data-household]'), at = radios.findIndex(r => r.getAttribute('aria-checked') === 'true');
    const next = radios[(at + keys[e.key] + radios.length) % radios.length];
    state.household = next.dataset.household; apply(); next.focus();
  });
  for (const b of $$('#topics [data-topic]')) b.addEventListener('click', () => { const t = b.dataset.topic; if (state.topics.has(t)) state.topics.delete(t); else state.topics.add(t); apply(); });
  for (const id of ['#clear', '#clear-top']) $(id).addEventListener('click', () => { clearAll(); $('#q').focus(); });

  // the arrow keys move among the cards (Left and Right one card, Up and Down one row, Home and End the first and last)
  $('#grid').addEventListener('keydown', e => {
    const link = e.target.closest && e.target.closest('h3 a');
    if (!link || e.altKey || e.ctrlKey || e.metaKey) return;
    const cards = $$('#grid .card:not([hidden])'), at = cards.indexOf(link.closest('.card'));
    if (at < 0) return;
    const cols = Math.max(1, Math.round($('#grid').clientWidth / (cards[0].getBoundingClientRect().width || 1)));
    const to = { ArrowRight: at + 1, ArrowLeft: at - 1, ArrowDown: at + cols, ArrowUp: at - cols, Home: 0, End: cards.length - 1 }[e.key];
    if (to === undefined || to < 0 || to >= cards.length) return;
    e.preventDefault();
    cards[to].querySelector('h3 a').focus();
  });
  window.addEventListener('keydown', e => {
    if (!families.length) return;
    const typing = ['INPUT', 'TEXTAREA'].includes(document.activeElement && document.activeElement.tagName);
    if (e.key === '/' && !typing && !e.metaKey && !e.ctrlKey && !e.altKey) { e.preventDefault(); $('#q').focus(); }
    if (e.key === 'Escape' && document.activeElement === $('#q')) { state.q = ''; apply(); $('#q').blur(); }
  });
  wireSheet();
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
