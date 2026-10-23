// The tour's surfaces: the beat card (a card or side panel of clamp(420px, 32vw, 560px), or a full-width bottom sheet under 768 px), the leader
// from the card to the thing it is about, the start card and the end card. Pure DOM; the director decides when and where (place.ts decides where, once per beat).
//
// Type (live pass 3, the owner's "36 px text minimum" and then "30 percent too big, reference the website"): every line of text on these surfaces is set from the
// tokens --st-min (1.5rem of the canon's 17 px root = 25.5 px at 768 px and wider, clamp(20px, 5.4vw, 25.5px) on a phone), --st-title (2.25rem) and --st-hook (2.6rem),
// defined in portal/viewer.css and used by portal/story.css. Nothing here sets a size; a card that is taller than its room scrolls inside (and keeps the word being
// spoken in view), it never shrinks its type. A person's name is kept as the person wrote it in the DOM and in every aria-label; the kicker look (all caps, 0.2em
// tracking, bold, the accent) is CSS on `.st-name`.
//
// The container fits the text (the owner's glass mockup, 2026-10, rule 3). Once the solver has placed a card at the width it chose, `fitWidth` trims the box to its
// widest wrapped line plus the right padding: Range.getClientRects over every text node (one rect a line) and the right edges of the chips, buttons, the monogram and a
// logo. Never wider than the solved width (a narrower card can only cover less of the subject), never on a phone's sheet (full width by contract); the left edge and the
// height stay. Two boxes sit pinned to the far end of a row and are measured by what they need, not where they are: the "More" toggle (the kicker's right edge, the gap and
// its own width) and a person's button on the start card (its content and padding). A trim that would make the content taller (a re-wrap) is undone. `data-solved-w` keeps the
// solver's width for the tests, and `box` is the card as drawn, which the leader starts from (the solved rect would start it in the air beside a trimmed card).
//
// One surface for the words. The card shows the kicker (who, with which companion), the title, the beat's text lit word by word as it is
// spoken (captions.ts), the apps as chips (the chip that names an app wears its real logo, 1.3 times the type: story v2, `rs.media`), a "More" toggle when
// the beat has a `detail` (at the right of the kicker, where it takes no height; it opens the beat's `before` and `after` in the card, and the
// director solves the card's place again for the taller card; no screenshot is ever in the tour), the agent's scripted line when it comes, the note and a "Fictional" footer. The bottom sheet is
// the same card re-laid-out, not a second component. The words on it are aria-hidden: a screen reader gets the beat from the live region
// (a11y.ts) and the transcript (chapters.ts), once. The "More" button and what it opens are controls, so they are not hidden.
import type { RuntimeStory, RuntimeBeat, RuntimeLogo } from './runtime.js';
import type { Member } from './types.js';
import { FICTIONAL_LINE, SIGNOFF } from './types.js';
import { Karaoke } from './captions.js';
import type { Rect } from './place.js';

export const el = <K extends keyof HTMLElementTagNameMap>(tag: K, cls = '', text?: string): HTMLElementTagNameMap[K] => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
};
const SVGNS = 'http://www.w3.org/2000/svg';
const svg = <K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number> = {}): SVGElementTagNameMap[K] => {
  const e = document.createElementNS(SVGNS, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, String(v));
  return e;
};

/** the disclosures the start card carries (claims.json: scripted-scenes, synthetic-voice, stylised-art, beta-short), word for word. The voice line is only said of a tour that has a voice. */
export const FINE_PRINT = [
  'Scenes are written for this site. They show what the listed apps do. They are not recordings of a real session.',
  'Narration is generated locally with an open text-to-speech model. It is not a recording of a person.',
  'The Companion Core is drawn as a stylised illustration, not a photograph.',
  'Companion OS, Companion Memory and Companion Agents are in beta.',
];
export const SYNTHETIC_VOICE_LINE = FINE_PRINT[1];
/** the beta line the end card closes on (the last of the start card's lines: claims.json beta-short, which scripts/test-fine-print.mts holds FINE_PRINT to) */
const BETA_SHORT = FINE_PRINT[3];
/** Where the end card sends a visitor besides the story's own call to action (the same address as assets/viewer.ts's DOWNLOAD_URL and the site's LINKS.download). */
export const DOWNLOAD_URL = 'https://ci.computer/download';

/** the boxes a reader sees as content besides the text: their right edges count toward a card's widest line */
export const FIT_BOXES = '.st-chip, .st-btn, .st-more-btn, .st-disc, .st-logo, .st-member';
/** boxes that sit pinned to the far end of a row: measured by what they need (see widestLine), not by where they are */
const PINNED = '.st-more-btn, .st-member';
/** Run `fn` with a surface laid out: a hidden one (the first beat's card, the end card before it shows) is shown invisibly for the call, as `measure` does. */
export function whileLaidOut<T>(c: HTMLElement, fn: () => T): T {
  const was = c.hidden, vis = c.style.visibility;
  c.hidden = false; c.style.visibility = 'hidden';
  try { return fn(); } finally { c.hidden = was; c.style.visibility = vis; }
}
/** the room a line of text needs to its right inside `root`: the padding, border and margin at the right of every box it sits in (a phone drawing's panel, the agent's quoted line ...) */
function trail(e: Element, root: Element): number {
  let t = 0;
  for (let a: Element | null = e; a && a !== root; a = a.parentElement) {
    const cs = getComputedStyle(a);
    t += (parseFloat(cs.paddingRight) || 0) + (parseFloat(cs.borderRightWidth) || 0) + (parseFloat(cs.marginRight) || 0);
  }
  return t;
}
/**
 * the rightmost edge (client px) of the text lines under `root`, each with the room its boxes need to its right (a trim must not narrow a panel that holds the line below
 * the line's own width), and of the boxes `boxes` names (hidden parts skipped); -Infinity when there is none
 */
function rightEdge(root: Element, boxes: string): number {
  let w = -Infinity;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    if (!(n.textContent || '').trim()) continue;
    const e = n.parentElement; if (!e || e.closest('[hidden]')) continue;
    const range = document.createRange(); range.selectNodeContents(n);
    const extra = trail(e, root);
    for (const r of Array.from(range.getClientRects())) if (r.width > 0) w = Math.max(w, r.right + extra);
  }
  for (const b of Array.from(root.querySelectorAll<HTMLElement>(boxes))) {
    if (b.closest('[hidden]')) continue;
    const r = b.getBoundingClientRect(); if (r.width > 0) w = Math.max(w, r.right);
  }
  return w;
}
/**
 * The widest wrapped line of a laid-out surface, px from its border-box left edge: every text node's line rects and the right edges of FIT_BOXES. The two boxes that sit
 * at the far end of a row are measured by what they need: the "More" toggle is the kicker's right edge + the head's gap + its own width, a person's button on the start
 * card its content's right edge + its own padding (a button as wide as its column would otherwise hold the card at the width it already has).
 */
export function widestLine(card: HTMLElement): number {
  const left = card.getBoundingClientRect().left;
  const plain = FIT_BOXES.split(', ').filter(s => !PINNED.split(', ').includes(s)).join(', ');
  let w = rightEdge(card, plain) - left;
  if (!Number.isFinite(w)) w = 0;
  for (const b of Array.from(card.querySelectorAll<HTMLElement>('.st-more-btn'))) {
    const head = b.parentElement; if (!head || b.closest('[hidden]')) continue;
    const kick = head.querySelector('.st-kicker'), gap = parseFloat(getComputedStyle(head).columnGap) || 0;
    const k = kick ? rightEdge(kick, '.st-disc') : -Infinity;
    w = Math.max(w, (Number.isFinite(k) ? k - left + gap : 0) + b.getBoundingClientRect().width);
  }
  for (const b of Array.from(card.querySelectorAll<HTMLElement>('.st-member'))) {
    if (b.closest('[hidden]')) continue;
    const cs = getComputedStyle(b), c = rightEdge(b, '.st-disc');
    if (Number.isFinite(c)) w = Math.max(w, c - left + (parseFloat(cs.paddingRight) || 0) + (parseFloat(cs.borderRightWidth) || 0));
  }
  return w;
}
/**
 * Trim a placed surface to its widest line plus its right padding (and the room a scrollbar takes), never wider than `solved`; returns the width set. The left edge is
 * the caller's and stays; the height is not touched. `+1`: a line measured at a fraction of a pixel must still fit at the trimmed width. A trim that makes the content
 * taller (a column or a line that re-wraps at the narrower width) is undone: the container fits the text, but never at the cost of the card's height. It trims again while
 * the text lays itself out shorter at the new width (`text-wrap: balance`), so what is left at the right of the widest line is the +1 and nothing more.
 */
export function fitWidth(card: HTMLElement, solved: number): number {
  const cs = getComputedStyle(card);
  const bl = parseFloat(cs.borderLeftWidth) || 0, br = parseFloat(cs.borderRightWidth) || 0;
  const padR = (parseFloat(cs.paddingRight) || 0) + br;
  const full = Math.max(0, Math.round(solved));
  card.style.width = `${full}px`;
  card.dataset.solvedW = String(full);
  // (a balanced title or a paragraph that is set to fill its lines lays itself out again at the narrower width, and its widest line may then be shorter still: trim again until
  // the width stops moving, up to four times)
  let cur = full;
  for (let pass = 0; pass < 4; pass++) {
    const bar = Math.max(0, card.offsetWidth - card.clientWidth - bl - br);     // a vertical scrollbar, when the card scrolls
    const want = Math.ceil(widestLine(card) + padR + bar) + 1;
    const w = Math.max(0, Math.min(cur, want));
    if (w >= cur - 1) break;
    const h = card.scrollHeight;
    card.style.width = `${w}px`;
    if (card.scrollHeight > h + 1) { card.style.width = `${cur}px`; break; }
    cur = w;
  }
  return cur;
}

// ---- the beat card ----------------------------------------------------------------------------------------------------------------------
export class BeatCard {
  readonly el: HTMLElement;
  readonly leader: SVGSVGElement;
  private line: SVGLineElement;
  private pin: SVGGElement;
  private body!: HTMLElement;
  private say!: HTMLElement;
  private sayText!: HTMLElement;
  private narration: Karaoke | null = null;
  private sayLine: Karaoke | null = null;
  private more: HTMLButtonElement | null = null;
  private morePanel: HTMLElement | null = null;
  private touched = 0;                     // the last time a person scrolled or pressed in the card (the card then stops following the lit word for a while)
  private litNow: Element | null = null;
  beatId: string | null = null;
  /** the "More" toggle was pressed (or Esc closed it): the director solves the card's place again and, on opening, pauses the tour */
  onMore: (open: boolean) => void = () => {};
  constructor(host: HTMLElement) {
    this.leader = svg('svg', { class: 'st-leader', 'aria-hidden': 'true', focusable: 'false' }) as SVGSVGElement;
    this.line = svg('line', { class: 'st-leader-line' });
    this.pin = svg('g', { class: 'st-pin' });
    this.pin.append(svg('circle', { class: 'st-pin-ring', r: 9 }), svg('circle', { class: 'st-pin-dot', r: 4 }));
    this.leader.append(this.line, this.pin);
    this.el = el('div', 'st-card');
    this.el.hidden = true;
    for (const ev of ['wheel', 'touchstart', 'pointerdown', 'keydown'] as const) this.el.addEventListener(ev, () => { this.touched = Date.now(); }, { passive: true });
    // (a card that has been scrolled puts its head, the person and the More toggle, on an opaque band; a phone's sheet sticks its head always: portal/story.css)
    this.el.addEventListener('scroll', () => { this.el.dataset.scrolled = this.el.scrollTop > 2 ? '1' : '0'; }, { passive: true });
    host.append(this.leader, this.el);
    this.leader.style.display = 'none';
  }

  /** Build the card for a beat. The narration's word timings are the lock's (null: pace by length). */
  fill(rs: RuntimeStory, b: RuntimeBeat, chapterTitle: string, timings: { narration: [string, number, number][] | null; say: [string, number, number][] | null }, durMs: { narration: number; say: number }): void {
    const c = this.el;
    // (the card is rebuilt for each beat: a "More" button that had focus is replaced by the next beat's, so focus is not lost from the keyboard)
    const keepFocus = !!c.querySelector('.st-more-btn:focus');
    this.beatId = b.id;
    c.textContent = '';
    c.classList.remove('st-open');
    c.scrollTop = 0; this.litNow = null; c.dataset.scrolled = '0'; c.dataset.chips = '0';
    this.more = null; this.morePanel = null;
    c.dataset.kind = b.popup.kind === 'phone' ? 'phone' : 'card';
    c.dataset.beat = b.id;
    const member = b.member ? rs.members.find(m => m.id === b.member) : undefined;
    const agentOwner = b.agent ? rs.members.find(m => m.id === b.agent) : undefined;
    const kick = hide(el('div', 'st-kicker'));
    if (member) {
      kick.append(disc(member), el('span', 'st-who st-name', member.name));
      if (agentOwner?.companion) kick.append(el('span', 'st-with', `with ${agentOwner.companion.name}`));
    } else kick.append(el('span', 'st-who', chapterTitle));
    // the top line: who, and (when the beat has a detail) the "More" toggle at its right
    const head = el('div', 'st-head');
    head.append(kick);
    const title = hide(el('h3', 'st-title', b.popup.title));
    this.body = hide(el('p', 'st-body'));
    this.narration = new Karaoke(this.body, b.popup.body, timings.narration, durMs.narration);
    c.append(head, title, this.body);
    if (b.popup.kind === 'phone' && b.popup.phone) c.append(hide(phoneDrawing(b.popup.phone.header, b.popup.phone.rows)));
    // the chips
    const row = el('div', 'st-row');
    if (b.popup.chips && b.popup.chips.length) {
      const ul = hide(el('ul', 'st-chips'));
      for (const t of b.popup.chips) {
        // the pair chip is the quiet one: story v3 writes "alternative to <Service>" (reference/story/story-v3.md), pass 1 wrote "replaces <X>"
        const replaces = /^(replaces|alternative to) /i.test(t), logo = replaces ? null : logoOf(rs, b, t);
        const li = el('li', replaces ? 'st-chip st-chip-replaces' : logo ? 'st-chip st-chip-app' : 'st-chip');
        if (logo) li.append(logoImg(logo));
        li.append(t);
        ul.append(li);
      }
      // (a phone's sheet shows the apps as one row that scrolls sideways; it fades at the right edge while there are more beyond it)
      ul.addEventListener('scroll', () => this.markChips(), { passive: true });
      row.append(ul);
    }
    if (b.detail) {
      const id = `st-more-${b.id}`;
      const btn = el('button', 'st-more-btn'); btn.type = 'button';
      btn.setAttribute('aria-expanded', 'false'); btn.setAttribute('aria-controls', id); btn.setAttribute('aria-label', 'More about this moment');
      btn.append(el('span', 'st-more-label', 'More'));
      btn.insertAdjacentHTML('beforeend', '<svg class="st-more-i" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="m6 9 6 6 6-6"/></svg>');
      btn.addEventListener('click', () => this.setMore(!this.expanded, true));
      const panel = el('div', 'st-more'); panel.id = id; panel.hidden = true;
      panel.setAttribute('role', 'group'); panel.setAttribute('aria-label', 'More about this moment');
      for (const [k, v] of [['Before', b.detail.before], ['Now', b.detail.after]] as const) {
        const p = el('p', 'st-more-row'); p.append(el('b', '', k), ' ', v); panel.append(p);
      }
      this.more = btn; this.morePanel = panel;
      head.append(btn);
    }
    if (row.childNodes.length) c.append(row);
    if (this.morePanel) c.append(this.morePanel);
    this.say = hide(el('div', 'st-say'));
    this.sayText = el('p', 'st-say-text');
    this.sayLine = null;
    if (b.say) {
      const speaker = rs.members.find(m => m.id === b.say!.speaker)?.companion?.name || 'Companion';
      this.sayLine = new Karaoke(this.sayText, b.say.text, timings.say, durMs.say);
      this.say.append(el('span', 'st-say-who', speaker), this.sayText);
      c.append(this.say);
    }
    if (b.popup.note) c.append(hide(el('p', 'st-note', b.popup.note)));
    c.append(hide(el('p', 'st-foot', FICTIONAL_LINE)));
    this.setSayVisible(false);
    if (keepFocus && this.more) { try { this.more.focus({ preventScroll: true }); } catch { /* the card is not showing yet */ } }
  }
  /** is the detail open */
  get expanded(): boolean { return !!this.more && this.more.getAttribute('aria-expanded') === 'true'; }
  get hasMore(): boolean { return !!this.more; }
  /** Open or close the detail. `user`: a press of the button (the tour is paused when it opens, and the opened text is brought into view in a card that scrolls). */
  setMore(open: boolean, user = false): void {
    if (!this.more || !this.morePanel || open === this.expanded) return;
    this.more.setAttribute('aria-expanded', String(open));
    this.morePanel.hidden = !open;
    this.el.classList.toggle('st-open', open);
    this.onMore(open);
    if (open && user) requestAnimationFrame(() => {
      const c = this.el, p = this.morePanel, h = c.querySelector<HTMLElement>('.st-head');
      if (!p || c.scrollHeight <= c.clientHeight + 1) return;
      // the opened text is brought to the top of what scrolls, under the card's stuck head (the person and the toggle)
      c.scrollTop = Math.max(0, p.offsetTop - (h ? h.offsetHeight : 0) - 8);
    });
    if (!open) this.el.scrollTop = 0;
  }
  /**
   * A phone's sheet whose words are taller than its room (at most 40 % of the window) brings the rest up by itself as the beat's time goes, when no voice is lighting words for it to
   * follow (keepLit does that), the person has not touched it in the last few seconds and "More" is shut: a tour that moves on without the reader must not hide the end of a card under
   * its edge. `frac` is how far through the beat the clock is (0 to 1): the first third reads what is in view, the rest scrolls to the end by four fifths of the beat. It only ever goes
   * down the card (a reader who scrolled ahead is not pulled back). Never with reduced motion (the tour is stepped then, and a card is read at the reader's own pace).
   */
  follow(frac: number): void {
    const c = this.el;
    if (c.hidden || c.dataset.mode !== 'sheet' || c.classList.contains('st-open') || Date.now() - this.touched < 4000) return;
    const max = c.scrollHeight - c.clientHeight;
    if (max <= 1) return;
    const want = Math.max(0, Math.min(1, (frac - 0.3) / 0.5)) * max;
    if (want > c.scrollTop + 0.5) c.scrollTop = want;
  }
  /** a phone's row of apps: faded at its right edge while more of it is beyond (`data-chips="more"`) */
  private markChips(): void {
    const ul = this.el.querySelector<HTMLElement>('.st-chips');
    this.el.dataset.chips = ul && this.el.dataset.mode === 'sheet' && ul.scrollWidth > ul.clientWidth + 1 && ul.scrollLeft + ul.clientWidth < ul.scrollWidth - 2 ? 'more' : '0';
  }
  /** the "More" button, to give focus back to it when Esc has closed the detail */
  focusMore(): void { try { this.more?.focus({ preventScroll: true }); } catch { /* gone */ } }
  /** a phone's card without its drawing of the phone's screen (the placer asks for it when the full card would cover the subject) */
  setCompact(on: boolean): void { this.el.classList.toggle('st-compact', on); }
  /** a card with its padding and gaps a little tighter, on a phone's sheet or a wide window's card (the type is not touched: it never goes under the floor; every word, chip and the footer stay) */
  setTight(on: boolean): void { this.el.classList.toggle('st-tight', on); }
  setSayVisible(on: boolean): void { this.say.classList.toggle('st-on', on); }
  /** light the narration at `ms` into its clip (null: plain text) */
  setNarration(ms: number | null): void { this.narration?.set(ms); if (ms !== null) this.keepLit(this.body); }
  setSay(ms: number | null): void { this.sayLine?.set(ms); if (ms !== null) this.keepLit(this.sayText); }
  get hasSay(): boolean { return !!this.sayLine; }
  /**
   * A card whose content is taller than its room scrolls inside; the word being spoken stays in view while it plays (unless the person has scrolled
   * the card themselves in the last few seconds, or the card is not showing). Instant with reduced motion.
   */
  private keepLit(line: HTMLElement): void {
    const c = this.el, w = line.querySelector('.st-now');
    if (!w || w === this.litNow) return;
    this.litNow = w;
    if (c.hidden || c.scrollHeight <= c.clientHeight + 1 || Date.now() - this.touched < 4000) return;
    const cr = c.getBoundingClientRect(), wr = w.getBoundingClientRect(), head = c.querySelector<HTMLElement>('.st-head'), stuck = c.classList.contains('st-open') && head ? head.offsetHeight : 0;
    const margin = 28, top = cr.top + stuck + margin, bottom = cr.bottom - margin;
    let to = c.scrollTop;
    if (wr.top < top) to -= top - wr.top; else if (wr.bottom > bottom) to += wr.bottom - bottom; else return;
    c.scrollTo({ top: Math.max(0, to), behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  }

  /** the card's size at this width, for the placer (it is laid out hidden, then shown where it goes): `full` is the height its content needs, `h` that or `maxH` */
  measure(width: number, maxH: number, collapsed = false): { w: number; h: number; full: number; type: number } {
    const c = this.el;
    c.style.width = `${Math.round(width)}px`; c.style.maxHeight = `${Math.round(maxH)}px`; c.style.height = '';
    const was = c.hidden, vis = c.style.visibility;
    // (`collapsed`: the size the card has with its "More" closed, whichever way it is now)
    const panel = this.morePanel, panelWas = panel ? panel.hidden : true;
    if (collapsed && panel) panel.hidden = true;
    c.hidden = false; c.style.visibility = 'hidden';
    this.setSayReserve(true);
    const full = Math.ceil(c.scrollHeight), h = Math.min(maxH, full), type = minTypePx(c);
    this.setSayReserve(false);
    c.hidden = was; c.style.visibility = vis;
    if (panel) panel.hidden = panelWas;
    return { w: Math.round(width), h: Math.ceil(h), full, type };
  }
  /** the agent's line takes its room from the start (so the card never grows when it appears) */
  private setSayReserve(on: boolean): void { this.el.classList.toggle('st-reserve', on); }
  /** the card's kind, before it is laid out: a phone's sheet is a different arrangement of the same card (portal/story.css `[data-mode="sheet"]`), so it is measured as one */
  setMode(mode: 'card' | 'sheet'): void { this.el.dataset.mode = mode; }
  /**
   * `where`: a sheet's place (the solver's): 'top' under the top bar or 'bottom' above the dock. A sheet that stands over the home's own label (the "Fictional family. Real
   * software." chip under the top bar, which a top sheet covers) carries the label on its last line; one at the bottom leaves the chip showing and does not.
   */
  put(r: Rect, mode: 'card' | 'sheet', where: 'top' | 'bottom' = 'bottom'): void {
    const c = this.el;
    c.dataset.mode = mode;
    if (mode === 'sheet') {
      // A phone's sheet is as tall as its words (no room held for a line that has not come yet), up to the height the solver gave it (which counted the agent's line: it grows into
      // room the solver already kept clear). Its top edge is the solver's, so what a person is reading does not move when it grows.
      c.dataset.where = where;
      c.style.left = `${Math.round(r.x)}px`; c.style.top = `${Math.round(r.y)}px`; c.style.width = `${Math.round(r.w)}px`; c.style.height = ''; c.style.maxHeight = `${Math.round(r.h)}px`;
    } else {
      delete c.dataset.where;
      c.style.left = `${Math.round(r.x)}px`; c.style.top = `${Math.round(r.y)}px`; c.style.width = `${Math.round(r.w)}px`; c.style.height = `${Math.round(r.h)}px`; c.style.maxHeight = '';
    }
    c.dataset.solvedW = String(Math.round(r.w));
    let w = Math.round(r.w), h = Math.round(r.h);
    whileLaidOut(c, () => {
      // the container fits the text: a wide window's card is trimmed to its widest line (a phone's sheet is full width by contract); the left edge and the height stay
      if (mode === 'card') w = fitWidth(c, r.w);
      // a card whose content is taller than its box scrolls inside it, so it takes the pointer (one that fits leaves the picture to the pointer)
      c.dataset.scroll = c.scrollHeight > (mode === 'sheet' ? c.clientHeight : Math.round(r.h)) + 1 ? '1' : '0';
      if (mode === 'sheet') h = Math.round(c.getBoundingClientRect().height);
      this.markChips();
    });
    this.rect = { x: Math.round(r.x), y: Math.round(r.y), w, h };
  }
  private rect: Rect = { x: 0, y: 0, w: 0, h: 0 };
  /** the card's box as drawn (px, in the tour's layer): the trimmed width, not the solved one. The leader starts from this edge. */
  get box(): Rect { return this.rect; }
  show(on: boolean): void {
    const c = this.el;
    if (on === !c.hidden && c.classList.contains('st-in') === on) return;
    if (on) { c.hidden = false; void c.offsetWidth; c.classList.add('st-in'); }
    else { c.classList.remove('st-in'); c.hidden = true; this.leader.style.display = 'none'; }
  }
  get visible(): boolean { return !this.el.hidden; }

  /** Aim the leader: from `from` on the card's edge to `to` on the subject. Null hides it (the subject is behind the camera). In the sheet it is a dot. */
  aim(line: { from: [number, number]; to: [number, number] } | null, dot: [number, number] | null, mode: 'card' | 'sheet'): void {
    const v = this.leader;
    if (mode === 'sheet' ? !dot : !line) { v.style.display = 'none'; return; }
    v.style.display = '';
    if (mode === 'card' && line) {
      this.line.setAttribute('x1', line.from[0].toFixed(1)); this.line.setAttribute('y1', line.from[1].toFixed(1));
      this.line.setAttribute('x2', line.to[0].toFixed(1)); this.line.setAttribute('y2', line.to[1].toFixed(1));
      this.line.style.display = '';
      this.pin.setAttribute('transform', `translate(${line.to[0].toFixed(1)} ${line.to[1].toFixed(1)})`);
    } else if (dot) {
      this.line.style.display = 'none';
      this.pin.setAttribute('transform', `translate(${dot[0].toFixed(1)} ${dot[1].toFixed(1)})`);
    }
  }
  destroy(): void { this.el.remove(); this.leader.remove(); }
}

/**
 * The smallest font size (px) of any text in a laid-out surface: what the placement solver is told so it can refuse a card that would set its type under the floor.
 * Text inside a hidden element, or with no box, is not judged. Call it while the surface is laid out (BeatCard.measure does).
 */
export function minTypePx(root: HTMLElement): number {
  let min = Infinity;
  const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let n = w.nextNode(); n; n = w.nextNode()) {
    if (!(n.textContent || '').trim()) continue;
    const e = n.parentElement; if (!e || e.closest('[hidden]')) continue;
    const cs = getComputedStyle(e); if (cs.display === 'none') continue;
    min = Math.min(min, parseFloat(cs.fontSize));
  }
  return Number.isFinite(min) ? min : 0;
}
/** a part of the card that is only for the eye: a screen reader has the beat from the live region */
function hide<T extends HTMLElement>(e: T): T { e.setAttribute('aria-hidden', 'true'); return e; }
/** the real logo of the app a chip names (the beat's `app` or one of its `with`), when the shipped story carries one */
function logoOf(rs: RuntimeStory, b: RuntimeBeat, chip: string): RuntimeLogo | null {
  const want = chip.trim().toLowerCase();
  for (const id of [b.app?.id, ...(b.with || [])]) {
    const m = id && rs.media ? rs.media[id] : null;
    if (m && m.logo && m.name.toLowerCase() === want) return m.logo;
  }
  return null;
}
function logoImg(l: RuntimeLogo): HTMLImageElement {
  const i = document.createElement('img');
  i.className = 'st-logo'; i.alt = l.alt; i.width = l.w; i.height = l.h; i.decoding = 'async';
  i.src = new URL(l.file, location.href).href;
  return i;
}

function disc(m: Member): HTMLElement {
  const d = el('span', 'st-disc', m.name.slice(0, 1).toUpperCase());
  d.dataset.colour = m.colour;
  d.setAttribute('aria-hidden', 'true');
  return d;
}

/** A stylised phone screen (never a screenshot): a header and a few rows, drawn with the page's own type. */
function phoneDrawing(header: string, rows: string[]): HTMLElement {
  const p = el('div', 'st-phone');
  p.append(el('div', 'st-phone-head', header));
  const ul = el('ul', 'st-phone-rows');
  rows.forEach((r, i) => { const li = el('li', '', r); li.style.setProperty('--i', String(i)); ul.append(li); });
  p.append(ul);
  return p;
}

/** the first sentence of a text ("Two storeys of brick under a dark shingle roof. The ground floor ..." gives the first); the whole text when it has one */
export function firstSentence(t: string): string {
  const m = t.replace(/\s+/g, ' ').trim().match(/^.*?[.!?](?=\s|$)/);
  return m ? m[0] : t.trim();
}

// ---- the start card -----------------------------------------------------------------------------------------------------------------------
export type StartChoice = 'sound' | 'silent';
/** One person of the family on the start card: "Start with Sally" opens the tour at `beat`, the first beat of her own room (url.ts memberBeat). */
export type StartMember = { id: string; name: string; archetype: string; colour: string; beat: number };
/**
 * How the start card is laid out. `wide`: the dialog in two columns (the copy and the buttons; the family and the fine print), as it always was. `sheet` (under 768 px): a bottom
 * sheet of at most half the window with the home visible above it. `panel` (a phone on its side: a window at most 500 px tall and wider than tall): a side panel of at most 45 %
 * of the width. The last two share one DOM (portal/story.css, "the phone's start sheet"), which scrolls inside the card, in reading order: the kicker, the title, the tagline, the action bar
 * (the one primary action, which sticks to the bottom edge of the sheet while the rest would push it out of view), the family as a single scrolling row of person chips, and the
 * disclosure "About this family", which holds the long copy and every line of fine print the claims require.
 */
export type StartLayout = 'wide' | 'sheet' | 'panel';
const PHONE_Q = '(max-width: 767px)', SIDE_Q = '(max-height: 500px) and (orientation: landscape)';
export class StartCard {
  readonly el: HTMLElement;
  /** the dialog inside the scrim */
  readonly card: HTMLElement;
  private primary: HTMLButtonElement;
  private secondary: HTMLButtonElement;
  private gone = false;
  private layoutNow: StartLayout | null = null;
  private mqs: MediaQueryList[] = [];
  private onMq = () => { if (!this.gone) this.fit(); };
  // the pieces, kept so a change of layout moves them and never rebuilds them
  private copy: HTMLElement; private more: HTMLElement;
  private about: HTMLDetailsElement; private aboutBody: HTMLElement;
  private kick: HTMLElement; private h: HTMLElement; private p: HTMLElement; private meta: HTMLElement; private acts: HTMLElement;
  private home: HTMLElement | null = null; private members: HTMLElement | null = null; private fine: HTMLElement;
  constructor(host: HTMLElement, rs: RuntimeStory, opts: {
    shared: RuntimeBeat | null; audio: boolean;
    /** the person ?member= asked to start with, when it named one of the family */
    member?: { name: string } | null;
    /** who the card offers a start with (a member with no beat of their own is not offered) */
    members?: StartMember[];
    onChoose: (c: StartChoice, at?: number) => void;
  }) {
    // the outer element is the scrim, the inner one the dialog. Two columns on a wide screen (the copy and the buttons; the family and the fine print); a phone's sheet and a
    // phone-on-its-side's panel are one column that scrolls inside the card, with the action bar stuck to its bottom edge (layout(), below).
    const wrap = (this.el = el('div', 'st-start'));
    const c = (this.card = el('div', 'st-start-card'));
    c.setAttribute('role', 'dialog'); c.setAttribute('aria-labelledby', 'st-start-h'); c.setAttribute('aria-describedby', 'st-start-p');
    wrap.append(c);
    this.copy = el('div', 'st-start-copy'); this.more = el('div', 'st-start-more');
    const shared = opts.shared;
    const mins = Math.max(1, Math.round(rs.duration / 60));
    // (the kicker line is all caps with wide tracking in the accent, and "Starting with John" is a person's name: the string stays as written, CSS makes the capitals)
    this.kick = el('p', 'st-start-kick', shared ? 'A shared moment' : opts.member ? `Starting with ${opts.member.name}` : 'Interactive tour');
    const h = (this.h = el('h2', '', shared ? shared.popup.title : `The ${rs.family.surname} family home`));
    h.id = 'st-start-h';
    const p = (this.p = el('p', 'st-start-p', shared ? `From the ${rs.family.surname} family tour. ${rs.family.tagline}` : rs.family.tagline));
    p.id = 'st-start-p';
    this.meta = el('p', 'st-start-meta', `${rs.beats.length} stops, about ${mins} minute${mins === 1 ? '' : 's'}. ${FICTIONAL_LINE}`);
    const acts = (this.acts = el('div', 'st-actions'));
    this.primary = el('button', 'st-btn st-primary', shared ? 'Play from here' : opts.audio ? 'Start with narration' : 'Start the tour');
    this.primary.type = 'button'; this.primary.dataset.start = opts.audio ? 'sound' : 'silent';
    this.secondary = el('button', 'st-btn', shared ? 'Play from here without sound' : 'Start without sound');
    this.secondary.type = 'button'; this.secondary.dataset.start = 'silent';
    this.primary.addEventListener('click', () => opts.onChoose(opts.audio ? 'sound' : 'silent'));
    this.secondary.addEventListener('click', () => opts.onChoose('silent'));
    acts.append(this.primary);
    if (opts.audio) acts.append(this.secondary);
    // story v2: the home in one line (the first sentence of the family's `home.lede`, which is true to the house's spec)
    const lede = rs.family.home?.lede ? firstSentence(rs.family.home.lede) : '';
    if (lede) this.home = el('p', 'st-start-home', lede);
    // the family: a way in at one person's room. It starts without sound (a person who chose a name did not choose a voice; M turns narration on).
    const members = (opts.members || []).filter(m => m.beat >= 0);
    if (members.length) {
      const g = el('div', 'st-members'); g.setAttribute('role', 'group'); g.setAttribute('aria-labelledby', 'st-members-h');
      const gh = el('p', 'st-members-h', opts.audio ? 'Or start with one person, without sound' : 'Or start with one person'); gh.id = 'st-members-h';
      const ul = el('ul', 'st-members-list');
      for (const m of members) {
        const li = el('li'), b = el('button', 'st-member'); b.type = 'button'; b.dataset.member = m.id;
        b.setAttribute('aria-label', `Start with ${m.name}${m.archetype ? `, ${m.archetype}` : ''}`);
        const d = el('span', 'st-disc', m.name.slice(0, 1).toUpperCase()); d.dataset.colour = m.colour; d.setAttribute('aria-hidden', 'true');
        b.append(d, el('span', 'st-member-name st-name', m.name));
        if (m.archetype) b.append(el('span', 'st-member-role', m.archetype));
        b.addEventListener('click', () => opts.onChoose('silent', m.beat));
        li.append(b); ul.append(li);
      }
      ul.addEventListener('scroll', () => this.markScroll(), { passive: true });
      g.append(gh, ul); this.members = g;
    }
    const fine = (this.fine = el('ul', 'st-fine'));
    for (const t of FINE_PRINT) if (opts.audio || t !== SYNTHETIC_VOICE_LINE) fine.append(el('li', '', t));
    // the disclosure of a phone's sheet: the long copy and the fine print, behind one 44 px summary. A native <details>, so the words are in the page whether it is open or not.
    const about = (this.about = document.createElement('details')); about.className = 'st-about';
    const sum = el('summary', 'st-about-sum');
    sum.append(el('span', 'st-about-label', 'About this family'));
    sum.insertAdjacentHTML('beforeend', '<svg class="st-more-i" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="m6 9 6 6 6-6"/></svg>');
    this.aboutBody = el('div', 'st-about-body');
    about.append(sum, this.aboutBody);
    // (an opened disclosure brings its words into view: the body scrolls to the end of them)
    about.addEventListener('toggle', () => { if (about.open) this.card.scrollTo({ top: this.card.scrollHeight, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' }); this.markScroll(); });
    this.card.addEventListener('scroll', () => this.markScroll(), { passive: true });
    for (const q of [PHONE_Q, SIDE_Q]) { const m = matchMedia(q); try { m.addEventListener('change', this.onMq); this.mqs.push(m); } catch { /* an old engine: the director's resize observer fits it */ } }
    this.layout();
    host.append(wrap);
    this.fit();
    // (the web font arriving re-wraps the lines: fit again when it has)
    try { void document.fonts.ready.then(() => { if (!this.gone) this.fit(); }); } catch { /* no font API */ }
  }
  /** which layout a window of this size takes (portal/story.css says the same in its media rules) */
  static layoutFor(): StartLayout { return matchMedia(SIDE_Q).matches ? 'panel' : matchMedia(PHONE_Q).matches ? 'sheet' : 'wide'; }
  /**
   * Put the pieces where the layout wants them (once per change: the same nodes move, none is rebuilt, so a focused button keeps its focus). Wide: the copy column (kicker, title,
   * tagline, the facts, the buttons, the home's line) and the family column (the person buttons, the fine print). A sheet or a side panel: kicker, title, tagline, the buttons, the
   * family's row of chips, and the disclosure that holds the facts, the home's line and the fine print.
   */
  private layout(): StartLayout {
    const m = StartCard.layoutFor();
    if (m === this.layoutNow) return m;
    this.layoutNow = m;
    // (moving a focused node blurs it: the control that had focus gets it back, so a turn of the phone does not drop a keyboard or a switch user's place)
    const act = document.activeElement as HTMLElement | null, keep = act && this.card.contains(act) ? act : null;
    this.card.dataset.layout = m; this.el.dataset.layout = m;
    if (m === 'wide') {
      this.copy.replaceChildren(this.kick, this.h, this.p, this.meta, this.acts);
      if (this.home) this.copy.append(this.home);
      this.more.replaceChildren(); if (this.members) this.more.append(this.members); this.more.append(this.fine);
      this.card.replaceChildren(this.copy, this.more);
    } else {
      this.aboutBody.replaceChildren(this.meta); if (this.home) this.aboutBody.append(this.home); this.aboutBody.append(this.fine);
      this.card.replaceChildren(this.kick, this.h, this.p, this.acts);
      if (this.members) this.card.append(this.members);
      this.card.append(this.about);
    }
    if (keep && keep.isConnected) { try { keep.focus({ preventScroll: true }); } catch { /* gone */ } }
    return m;
  }
  /** a sheet scrolls when its words are taller than its room (the action bar stays at its bottom edge: portal/story.css); `data-scroll` says whether it does and where it is */
  private markScroll(): void {
    const b = this.card, more = b.scrollHeight > b.clientHeight + 1, end = b.scrollTop + b.clientHeight >= b.scrollHeight - 2;
    this.card.dataset.scroll = more ? (end ? 'end' : 'more') : '0';
    // (the family's row of chips fades at its right edge while there are more chips beyond it)
    const row = this.members?.querySelector<HTMLElement>('.st-members-list');
    if (row) this.card.dataset.row = row.scrollWidth > row.clientWidth + 1 && row.scrollLeft + row.clientWidth < row.scrollWidth - 2 ? 'more' : '0';
  }
  /**
   * A wide dialog is as wide as its content up to its max (CSS: fit-content, then 1000 px or the window), then trimmed to its widest line. Two columns re-wrap as the width
   * goes, so it is measured again (up to three times) until the slack is under a pixel; a trim that makes it taller is undone (fitWidth). Called on mount, when the fonts
   * arrive, and by the director on a resize. A phone's sheet and a side panel are full width by contract and are not trimmed.
   */
  fit(): void {
    const mode = this.layout();
    const c = this.card; c.style.width = '';
    if (mode !== 'wide') { const w = Math.round(c.getBoundingClientRect().width); if (w > 0) c.dataset.solvedW = String(w); this.markScroll(); return; }
    whileLaidOut(this.el, () => {
      const max = Math.round(c.getBoundingClientRect().width);
      if (max < 1) return;                       // not laid out (the player is not showing yet): the director fits it again when it is
      for (let pass = 0; pass < 3; pass++) {
        const now = c.getBoundingClientRect().width;
        if (now - fitWidth(c, now) < 1) break;
      }
      c.dataset.solvedW = String(max);
    });
  }
  focus(): void { this.primary.focus({ preventScroll: true }); }
  contains(n: Node | null): boolean { return !!n && this.el.contains(n); }
  destroy(): void { this.gone = true; for (const m of this.mqs) { try { m.removeEventListener('change', this.onMq); } catch { /* gone */ } } this.el.remove(); }
}

// ---- the end card -------------------------------------------------------------------------------------------------------------------------
export class EndCard {
  readonly el: HTMLElement;
  readonly body: HTMLElement;
  private karaoke: Karaoke;
  constructor(host: HTMLElement, rs: RuntimeStory, opts: { timings: [string, number, number][] | null; durMs: number; onReplay: () => void; onNext: () => void; onShare: () => void; hasNext: boolean }) {
    const c = (this.el = el('div', 'st-end'));
    c.hidden = true;
    c.setAttribute('role', 'group'); c.setAttribute('aria-labelledby', 'st-end-h');
    const h = el('h2', '', 'Meet the Companion Core.'); h.id = 'st-end-h';
    c.append(h, el('p', 'st-end-lead', 'This family is fictional. The software is real.'));
    this.body = el('p', 'st-body st-end-body');
    this.karaoke = new Karaoke(this.body, `${rs.closing.body} ${SIGNOFF}`, opts.timings, opts.durMs);
    const acts = el('div', 'st-actions');
    const link = (label: string, href: string, cls: string) => { const a = el('a', cls, label) as HTMLAnchorElement; a.href = href; a.target = '_blank'; a.rel = 'noopener'; return a; };
    const cta = link(rs.closing.cta.label, rs.closing.cta.url, 'st-btn st-primary');
    const mk = (label: string, fn: () => void) => { const b = el('button', 'st-btn', label); b.type = 'button'; b.addEventListener('click', fn); return b; };
    // (the one story call to action, the one download link, then the ways on inside the site. At this size the buttons are tall, so they come before the closing words: a card
    // that scrolls shows the way on first and the words, which the voice also says, after them)
    acts.append(cta, link('Download Companion', DOWNLOAD_URL, 'st-btn'), mk('Replay', opts.onReplay));
    if (opts.hasNext) acts.append(mk('Next family', opts.onNext));
    acts.append(mk('Share this family', opts.onShare));
    c.append(acts, this.body, el('p', 'st-note', BETA_SHORT));
    host.append(c);
  }
  setNarration(ms: number | null): void { this.karaoke.set(ms); }
  /** the card with its padding and gaps tighter (the type is never touched): for a window too short for the card at its full padding */
  setTight(on: boolean): void { this.el.classList.toggle('st-tight', on); }
  /** place the card; a wide window's panel is then trimmed to its widest line (a phone's sheet is full width by contract) */
  put(r: Rect, mode: 'card' | 'sheet' = 'card'): void {
    const c = this.el;
    c.style.left = `${Math.round(r.x)}px`; c.style.top = `${Math.round(r.y)}px`; c.style.width = `${Math.round(r.w)}px`; c.style.height = `${Math.round(r.h)}px`; c.style.maxHeight = '';
    c.dataset.solvedW = String(Math.round(r.w));
    c.dataset.mode = mode;
    if (mode === 'card') whileLaidOut(c, () => fitWidth(c, r.w));
  }
  /** the card's size at this width: `full` is the height its content needs, `h` that or `maxH` (a taller one scrolls inside) */
  measure(width: number, maxH = Infinity): { w: number; h: number; full: number; type: number } {
    const c = this.el, was = c.hidden, vis = c.style.visibility;
    c.style.width = `${Math.round(width)}px`; c.style.height = ''; c.style.maxHeight = Number.isFinite(maxH) ? `${Math.round(maxH)}px` : ''; c.hidden = false; c.style.visibility = 'hidden';
    const full = Math.ceil(c.scrollHeight), type = minTypePx(c);
    c.hidden = was; c.style.visibility = vis;
    return { w: Math.round(width), h: Math.min(Math.ceil(maxH), full), full, type };
  }
  show(on: boolean): void { this.el.hidden = !on; if (on) { void this.el.offsetWidth; this.el.classList.add('st-in'); } else this.el.classList.remove('st-in'); }
  get visible(): boolean { return !this.el.hidden; }
  destroy(): void { this.el.remove(); }
}
