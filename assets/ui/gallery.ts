// The home picker (plan §6 P0 4): a dialog with every home as a thumbnail (the portal's committed thumbnails,
// portal/thumbs/<id>.webp), a search box, and the studio scenes the editor also builds. It replaces the 37-entry select
// and the strip of quick chips. Keyboard: type to search; the arrow keys move through the grid (↑ ↓ by a row);
// Enter or Space opens a home; Esc closes. A native <dialog> (showModal), so focus stays inside while it is open and
// returns to the button that opened it.

export type GalleryHome = { id: string; name: string; meta?: string; thumb?: string };
export type GalleryScene = { key: string; name: string; note?: string };

const esc = (s: string) => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
const svg = (name: string) => `<svg class="i" aria-hidden="true" focusable="false"><use href="#i-${name}"/></svg>`;
const norm = (s: string) => String(s || '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '');

/** Arrow keys through a grid of cards: ← → one card, ↑ ↓ one row (measured from the cards' positions, so any column count),
 *  Home / End the first and last. Up from the first row hands the focus to `above`. */
export function bindGridKeys(root: HTMLElement, cardSelector: string, above?: () => void) {
  root.addEventListener('keydown', e => {
    const el = document.activeElement as HTMLElement | null;
    if (!el || !el.matches(cardSelector) || !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(e.key)) return;
    const cards = Array.from(root.querySelectorAll(cardSelector)) as HTMLElement[];
    const i = cards.indexOf(el);
    let j = i;
    if (e.key === 'ArrowLeft') j = i - 1;
    else if (e.key === 'ArrowRight') j = i + 1;
    else if (e.key === 'Home') j = 0;
    else if (e.key === 'End') j = cards.length - 1;
    else {
      const r = el.getBoundingClientRect(), dir = e.key === 'ArrowDown' ? 1 : -1;
      const rows = cards.map(c => c.getBoundingClientRect()).map((b, k) => ({ k, dy: (b.top - r.top) * dir, dx: Math.abs(b.left - r.left) })).filter(o => o.dy > 4);
      if (!rows.length) { if (dir < 0 && above) { e.preventDefault(); above(); } return; }
      const nextRow = Math.min(...rows.map(o => o.dy));
      j = rows.filter(o => Math.abs(o.dy - nextRow) < 4).sort((a, b) => a.dx - b.dx)[0].k;
    }
    if (j >= 0 && j < cards.length) { e.preventDefault(); cards[j].focus(); cards[j].scrollIntoView({ block: 'nearest' }); }
  });
}

export function createGallery(dialog: HTMLDialogElement, { onPick }: { onPick: (key: string) => void }) {
  dialog.classList.add('rc-dialog', 'rc-gallery');
  dialog.setAttribute('aria-labelledby', 'gallery-title');
  dialog.innerHTML = `
    <form method="dialog" class="rc-dialog-head">
      <h2 id="gallery-title">Choose a home</h2>
      <label class="rc-search">${svg('search')}<input type="search" id="gallery-search" placeholder="Search homes or styles" aria-label="Search homes" autocomplete="off" spellcheck="false"></label>
      <button type="button" class="btn-ctrl btn-outline rc-gallery-compare" id="gallery-compare" title="Every home at the same shot, side by side (C)">${svg('grid')}<span class="lbl">Compare</span></button>
      <button class="rc-icon-btn" value="close" aria-label="Close" title="Close (Esc)">${svg('x')}</button>
    </form>
    <div class="rc-gallery-body">
      <h3 class="rc-gallery-h" id="gallery-homes-h">Homes <span class="rc-count" id="gallery-count"></span></h3>
      <div class="rc-gallery-grid" id="gallery-grid" role="list" aria-labelledby="gallery-homes-h"></div>
      <p class="rc-gallery-empty" id="gallery-empty" hidden>No home matches that search.</p>
      <h3 class="rc-gallery-h" id="gallery-scenes-h">Studio scenes</h3>
      <div class="rc-gallery-scenes" id="gallery-scenes" role="list" aria-labelledby="gallery-scenes-h"></div>
    </div>`;
  const grid = dialog.querySelector('#gallery-grid') as HTMLElement, scenesEl = dialog.querySelector('#gallery-scenes') as HTMLElement;
  const search = dialog.querySelector('#gallery-search') as HTMLInputElement, count = dialog.querySelector('#gallery-count') as HTMLElement;
  const empty = dialog.querySelector('#gallery-empty') as HTMLElement;
  let homes: GalleryHome[] = [], scenes: GalleryScene[] = [], current: string | null = null;

  function card(key: string, title: string, sub: string, thumb: string | null, extra: string): HTMLElement {
    const wrap = document.createElement('div');
    wrap.setAttribute('role', 'listitem');
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'rc-home-card'; b.dataset.key = key;
    if (key === current) b.setAttribute('aria-current', 'true');
    b.innerHTML = (thumb ? `<img src="${esc(thumb)}" alt="" loading="lazy" width="640" height="360">` : `<span class="rc-home-noimg">${svg('box')}</span>`)
      + `<span class="rc-home-name">${esc(title)}</span>` + (sub ? `<span class="rc-home-meta">${esc(sub)}</span>` : '') + extra;
    b.addEventListener('click', () => { dialog.close(); onPick(key); });
    wrap.appendChild(b);
    return wrap;
  }
  function render() {
    const q = norm(search.value.trim());
    const hit = (s: string) => !q || norm(s).includes(q);
    const shown = homes.filter(h => hit(`${h.name} ${h.meta || ''} ${h.id}`));
    grid.replaceChildren(...shown.map(h => card(`house:${h.id}`, h.name, h.meta || '', h.thumb || null, '')));
    count.textContent = q ? `${shown.length} of ${homes.length}` : String(homes.length);
    empty.hidden = shown.length > 0;
    const sc = scenes.filter(s => hit(`${s.name} ${s.note || ''}`));
    scenesEl.replaceChildren(...sc.map(s => card(s.key, s.name, s.note || '', null, '')));
    (dialog.querySelector('#gallery-scenes-h') as HTMLElement).hidden = !sc.length;
  }
  search.addEventListener('input', render);
  search.addEventListener('keydown', e => {
    if (e.key === 'ArrowDown' || (e.key === 'Enter' && search.value)) { const first = dialog.querySelector('.rc-home-card') as HTMLElement | null; if (first) { e.preventDefault(); if (e.key === 'Enter') first.click(); else first.focus(); } }
  });
  bindGridKeys(dialog, '.rc-home-card', () => search.focus());

  return {
    setHomes(h: GalleryHome[], s: GalleryScene[]) { homes = h; scenes = s; render(); },
    open(currentKey: string | null) {
      current = currentKey; search.value = ''; render();
      dialog.showModal();
      const cur = dialog.querySelector('.rc-home-card[aria-current="true"]') as HTMLElement | null;
      if (cur) { cur.scrollIntoView({ block: 'center' }); }
      search.focus();
    },
    get homes() { return homes; },
  };
}
