// Compare homes (plan §6 P2 13; Completeness J): every home at the same shot, the same moment and the same light, as a
// grid of posters — the most direct answer to "each home looks very same". The posters are frames drawn through the
// film's own renderer (the page's `poster` hook: __houseRenderBegin / __houseRenderFrames, at 640 × 360), one home at a
// time, so what you compare is what a Record would see. Rendering rebuilds each home in turn, so the dialog says when that
// will cost the home you have open something you added (`edits`), and puts that home back when it is done or stopped.
//
// A finished set can be saved as one PNG sheet (every poster with its name). Posters are cached for the session by
// home, shot, moment and light, so reopening the dialog costs nothing, and a changed control only re-renders what changed.
// The module owns the dialog and the order of work; drawing a frame, building a home and saving a file are the page's.

export type CompareHome = { id: string; name: string; credit?: string };
export type CompareOpts = { shot: string; t: number; lighting: string };
export type CompareHooks = {
  homes: () => CompareHome[];
  shots: Array<[string, string]>;                 // [shot id, label]: the shots every home has
  lightings: Array<[string, string]>;             // [preset, label]; 'auto' is each home's own
  /** a data: URL of the frame, or null when the home has no such shot. Builds the home; throws to say it could not. */
  poster: (id: string, o: CompareOpts, signal: AbortSignal) => Promise<string | null>;
  /** put the editor's own home back (after a set, or a stop) */
  restore: () => Promise<void>;
  open: (id: string, o: CompareOpts) => void;
  /** how many things the person has added to the open home (they do not survive a rebuild) */
  edits: () => number;
  save: (blob: Blob, name: string) => void;
  fileName: (o: CompareOpts) => string;
  toast: (message: string, kind?: 'info' | 'error') => void;
};

const esc = (s: string) => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
const svg = (name: string) => `<svg class="i" aria-hidden="true" focusable="false"><use href="#i-${name}"/></svg>`;
export const posterKey = (id: string, o: CompareOpts) => `${id}|${o.shot}|${o.t.toFixed(3)}|${o.lighting}`;
/** the sheet's grid: `cols` columns of cells `cw` × `ch` plus a caption band, with `gap` between and round it */
export function sheetLayout(n: number, cols: number, cw: number, ch: number, cap: number, gap: number): { w: number; h: number; cell: (i: number) => { x: number; y: number } } {
  const rows = Math.max(1, Math.ceil(n / cols));
  return { w: gap + cols * (cw + gap), h: gap + rows * (ch + cap + gap), cell: i => ({ x: gap + (i % cols) * (cw + gap), y: gap + Math.floor(i / cols) * (ch + cap + gap) }) };
}

export function createCompare(dialog: HTMLDialogElement, hooks: CompareHooks) {
  dialog.classList.add('rc-dialog', 'rc-compare');
  dialog.setAttribute('aria-labelledby', 'compare-title');
  dialog.innerHTML = `
    <form method="dialog" class="rc-dialog-head">
      <h2 id="compare-title">${svg('grid')}Compare homes</h2>
      <button class="rc-icon-btn" value="close" aria-label="Close" title="Close (Esc)">${svg('x')}</button>
    </form>
    <div class="rc-compare-bar">
      <label class="rc-compare-f"><span>Shot</span><select class="select-ctrl" id="compare-shot"></select></label>
      <label class="rc-compare-f"><span>Moment</span><span class="rc-compare-range"><input type="range" id="compare-t" min="0" max="100" step="1" value="55" aria-describedby="compare-t-out"><output id="compare-t-out" for="compare-t">55 %</output></span></label>
      <label class="rc-compare-f"><span>Light</span><select class="select-ctrl" id="compare-light"></select></label>
      <span class="rc-compare-spacer"></span>
      <button type="button" class="btn-ctrl" id="compare-sheet" disabled>${svg('download')}<span>Save sheet</span></button>
      <button type="button" class="btn-ctrl" id="compare-stop" hidden>Stop</button>
      <button type="button" class="btn-export" id="compare-run">${svg('grid')}<span id="compare-run-label">Render the homes</span></button>
    </div>
    <p class="rc-compare-note" id="compare-note" role="status" aria-live="polite"></p>
    <div class="rc-compare-body">
      <div class="rc-compare-grid" id="compare-grid" role="list" aria-label="Homes at the same shot"></div>
    </div>`;
  const $ = <T extends HTMLElement>(id: string) => dialog.querySelector('#' + id) as T;
  const shotSel = $<HTMLSelectElement>('compare-shot'), lightSel = $<HTMLSelectElement>('compare-light'), tRange = $<HTMLInputElement>('compare-t'), tOut = $<HTMLOutputElement>('compare-t-out');
  const runBtn = $<HTMLButtonElement>('compare-run'), runLabel = $('compare-run-label'), stopBtn = $<HTMLButtonElement>('compare-stop'), sheetBtn = $<HTMLButtonElement>('compare-sheet');
  const note = $('compare-note'), grid = $('compare-grid');
  shotSel.replaceChildren(...hooks.shots.map(([id, label]) => new Option(label, id)));
  lightSel.replaceChildren(...hooks.lightings.map(([id, label]) => new Option(label, id)));

  const cache = new Map<string, string | null>();
  let running: AbortController | null = null, homes: CompareHome[] = [];
  const opts = (): CompareOpts => ({ shot: shotSel.value, t: Number(tRange.value) / 100, lighting: lightSel.value });

  function cardFor(h: CompareHome, o: CompareOpts): HTMLElement {
    const wrap = document.createElement('div'); wrap.setAttribute('role', 'listitem'); wrap.dataset.id = h.id;
    const b = document.createElement('button'); b.type = 'button'; b.className = 'rc-home-card rc-compare-card';
    const has = cache.has(posterKey(h.id, o)), url = cache.get(posterKey(h.id, o));
    b.dataset.state = has ? (url ? 'done' : 'none') : 'pending';
    b.innerHTML = `<span class="rc-compare-poster">${url ? `<img src="${url}" alt="" width="640" height="360">` : `<span class="rc-compare-wait">${has ? 'No such shot' : ''}</span>`}</span><span class="rc-home-name">${esc(h.name)}</span>${h.credit ? `<span class="rc-home-meta">${esc(h.credit)}</span>` : ''}`;
    b.setAttribute('aria-label', `${h.name}: open it at this moment`);
    b.addEventListener('click', () => { if (running) return; dialog.close(); hooks.open(h.id, opts()); });   // (a home opened mid-set would be rebuilt over by the restore)
    wrap.appendChild(b);
    return wrap;
  }
  function layout() {
    homes = hooks.homes();
    const o = opts();
    grid.replaceChildren(...homes.map(h => cardFor(h, o)));
    const done = homes.filter(h => cache.get(posterKey(h.id, o))).length;
    sheetBtn.disabled = done === 0;
    runLabel.textContent = done === 0 ? `Render ${homes.length} homes` : done < homes.length ? `Render the other ${homes.length - done}` : 'Render again';
    const edits = hooks.edits();
    note.textContent = running ? note.textContent : edits > 0
      ? `Rendering rebuilds each home in turn, and then yours. The ${edits} thing${edits === 1 ? '' : 's'} you added to it will not be kept.`
      : done === 0 ? 'Each home is built and drawn through the film\'s renderer at the same shot, moment and light. It takes about two seconds a home.' : `${done} of ${homes.length} rendered.`;
  }
  function paint(id: string, url: string | null | undefined, state: 'done' | 'none' | 'busy') {
    const b = grid.querySelector(`[data-id="${CSS.escape(id)}"] .rc-compare-card`) as HTMLElement | null;
    if (!b) return;
    b.dataset.state = state;
    const p = b.querySelector('.rc-compare-poster') as HTMLElement;
    p.innerHTML = state === 'done' && url ? `<img src="${url}" alt="" width="640" height="360">` : `<span class="rc-compare-wait">${state === 'busy' ? `<svg class="i rc-spin" aria-hidden="true" focusable="false"><use href="#i-loader"/></svg>` : 'No such shot'}</span>`;
  }
  function setBusy(on: boolean) {
    runBtn.hidden = on; stopBtn.hidden = !on; shotSel.disabled = lightSel.disabled = tRange.disabled = on;
    dialog.querySelector('.rc-compare-bar')!.toggleAttribute('data-busy', on);
  }

  /** render the homes that have no poster yet for the current controls (`ids`: only these) */
  async function run(ids?: string[]) {
    if (running) return;
    const o = opts(), todo = homes.filter(h => (!ids || ids.includes(h.id)) && !cache.has(posterKey(h.id, o)));
    if (!todo.length) { layout(); return; }
    const ac = running = new AbortController();
    setBusy(true);
    let n = 0, failed = 0;
    try {
      for (const h of todo) {
        if (ac.signal.aborted) break;
        note.textContent = `Rendering ${h.name}, ${n + 1} of ${todo.length}`;
        paint(h.id, null, 'busy');
        try {
          const url = await hooks.poster(h.id, o, ac.signal);
          cache.set(posterKey(h.id, o), url);
          paint(h.id, url, url ? 'done' : 'none');
        } catch (e) {
          if (ac.signal.aborted) break;
          failed++; console.error(e);
          paint(h.id, null, 'none');
        }
        n++;
      }
    } finally {
      running = null;
      setBusy(false);
      try { await hooks.restore(); } catch (e) { console.error(e); hooks.toast(`Your home could not be put back: ${(e as Error).message}`, 'error'); }
      layout();
      if (failed) hooks.toast(`${failed} home${failed === 1 ? '' : 's'} could not be drawn. See the console.`, 'error');
      else if (ac.signal.aborted) note.textContent = `Stopped after ${n}. ${note.textContent}`;
    }
  }

  async function saveSheet() {
    const o = opts(), shown = homes.map(h => ({ h, url: cache.get(posterKey(h.id, o)) })).filter(x => x.url) as Array<{ h: CompareHome; url: string }>;
    if (!shown.length) return;
    const cs = getComputedStyle(dialog), col = (v: string) => cs.getPropertyValue(v).trim() || 'currentColor';
    const cols = shown.length > 12 ? 5 : shown.length > 6 ? 4 : 3, cw = 384, ch = 216, cap = 34, gap = 14;
    const L = sheetLayout(shown.length, cols, cw, ch, cap, gap);
    const cv = document.createElement('canvas'); cv.width = L.w; cv.height = L.h;
    const g = cv.getContext('2d')!;
    g.fillStyle = col('--background'); g.fillRect(0, 0, L.w, L.h);
    const imgs = await Promise.all(shown.map(x => new Promise<HTMLImageElement>((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = () => rej(new Error('a poster would not decode')); im.src = x.url; })));
    g.font = `600 15px ${col('--font-sans')}`; g.textBaseline = 'middle';
    shown.forEach((x, i) => {
      const { x: cx, y: cy } = L.cell(i);
      g.drawImage(imgs[i], cx, cy, cw, ch);
      g.fillStyle = col('--foreground'); g.fillText(x.h.name, cx + 2, cy + ch + cap / 2, cw - 4);
    });
    const blob: Blob = await new Promise((res, rej) => cv.toBlob(b => (b ? res(b) : rej(new Error('the sheet could not be encoded'))), 'image/png'));
    hooks.save(blob, hooks.fileName(o));
    hooks.toast(`Saved the sheet of ${shown.length} homes.`);
  }

  const relayout = () => { if (!running) layout(); };
  shotSel.addEventListener('change', relayout);
  lightSel.addEventListener('change', relayout);
  tRange.addEventListener('input', () => { tOut.textContent = `${tRange.value} %`; });
  tRange.addEventListener('change', relayout);
  runBtn.addEventListener('click', () => { void run(); });
  stopBtn.addEventListener('click', () => { running?.abort(); stopBtn.disabled = true; note.textContent = 'Stopping after this home…'; setTimeout(() => { stopBtn.disabled = false; }, 100); });
  sheetBtn.addEventListener('click', () => { saveSheet().catch(e => hooks.toast(`The sheet could not be saved: ${e.message}`, 'error')); });
  dialog.addEventListener('close', () => { running?.abort(); });

  return {
    open(from: { shot?: string; t?: number; lighting?: string } = {}) {
      if (from.shot && [...shotSel.options].some(o => o.value === from.shot)) shotSel.value = from.shot;
      if (typeof from.t === 'number') { tRange.value = String(Math.round(Math.max(0, Math.min(1, from.t)) * 100)); tOut.textContent = `${tRange.value} %`; }
      if (from.lighting && [...lightSel.options].some(o => o.value === from.lighting)) lightSel.value = from.lighting;
      layout();
      dialog.showModal();
      runBtn.focus();
    },
    run, layout, saveSheet,
    /** for scripts/test-ui.mts */
    get state() { return { running: !!running, cached: cache.size, done: homes.filter(h => cache.get(posterKey(h.id, opts()))).length }; },
    get element() { return dialog; },
  };
}
