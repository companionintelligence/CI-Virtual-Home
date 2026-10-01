// The tour's surfaces: the beat card (a floating card, or a bottom sheet at 600 px and under), the leader from the card to the thing it
// is about, the start card and the end card. Pure DOM; the director decides when and where (place.ts decides where, once per beat).
//
// One surface for the words. The card shows the kicker (who, with which companion), the title, the beat's text lit word by word as it is
// spoken (captions.ts), the apps as chips, the agent's scripted line when it comes, the note and a "Fictional" footer. The bottom sheet is
// the same card re-laid-out, not a second component. Everything on it is aria-hidden: a screen reader gets the beat from the live region
// (a11y.ts) and the transcript (chapters.ts), once.
import type { RuntimeStory, RuntimeBeat } from './runtime.js';
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

/** the three disclosures the start card carries (claims.json: scripted-scenes, synthetic-voice, beta-short, stylised-art), word for word */
export const FINE_PRINT = [
  'Scenes are written for this site. They show what the listed apps do. They are not recordings of a real session.',
  'Narration is generated locally with an open text-to-speech model. It is not a recording of a person.',
  'The Companion Core is drawn as a stylised illustration, not a photograph.',
  'Companion OS, Companion Memory and Companion Agents are in beta.',
];

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
  beatId: string | null = null;
  constructor(host: HTMLElement) {
    this.leader = svg('svg', { class: 'st-leader', 'aria-hidden': 'true', focusable: 'false' }) as SVGSVGElement;
    this.line = svg('line', { class: 'st-leader-line' });
    this.pin = svg('g', { class: 'st-pin' });
    this.pin.append(svg('circle', { class: 'st-pin-ring', r: 9 }), svg('circle', { class: 'st-pin-dot', r: 4 }));
    this.leader.append(this.line, this.pin);
    this.el = el('div', 'st-card');
    this.el.hidden = true; this.el.setAttribute('aria-hidden', 'true');
    host.append(this.leader, this.el);
    this.leader.style.display = 'none';
  }

  /** Build the card for a beat. The narration's word timings are the lock's (null: pace by length). */
  fill(rs: RuntimeStory, b: RuntimeBeat, chapterTitle: string, timings: { narration: [string, number, number][] | null; say: [string, number, number][] | null }, durMs: { narration: number; say: number }): void {
    this.beatId = b.id;
    const c = this.el;
    c.textContent = '';
    c.dataset.kind = b.popup.kind === 'phone' ? 'phone' : 'card';
    c.dataset.beat = b.id;
    const member = b.member ? rs.members.find(m => m.id === b.member) : undefined;
    const agentOwner = b.agent ? rs.members.find(m => m.id === b.agent) : undefined;
    const kick = el('div', 'st-kicker');
    if (member) {
      kick.append(disc(member), el('span', 'st-who', member.name));
      if (agentOwner?.companion) kick.append(el('span', 'st-with', `with ${agentOwner.companion.name}`));
    } else kick.append(el('span', 'st-who', chapterTitle));
    const title = el('h3', 'st-title', b.popup.title);
    this.body = el('p', 'st-body');
    this.narration = new Karaoke(this.body, b.popup.body, timings.narration, durMs.narration);
    c.append(kick, title, this.body);
    if (b.popup.kind === 'phone' && b.popup.phone) c.append(phoneDrawing(b.popup.phone.header, b.popup.phone.rows));
    if (b.popup.chips && b.popup.chips.length) {
      const ul = el('ul', 'st-chips');
      for (const t of b.popup.chips) ul.append(el('li', /^replaces /i.test(t) ? 'st-chip st-chip-replaces' : 'st-chip', t));
      c.append(ul);
    }
    this.say = el('div', 'st-say');
    this.sayText = el('p', 'st-say-text');
    this.sayLine = null;
    if (b.say) {
      const speaker = rs.members.find(m => m.id === b.say!.speaker)?.companion?.name || 'Companion';
      this.sayLine = new Karaoke(this.sayText, b.say.text, timings.say, durMs.say);
      this.say.append(el('span', 'st-say-who', speaker), this.sayText);
      c.append(this.say);
    }
    if (b.popup.note) c.append(el('p', 'st-note', b.popup.note));
    c.append(el('p', 'st-foot', FICTIONAL_LINE));
    this.setSayVisible(false);
  }
  /** a phone's card without its drawing of the phone's screen (the placer asks for it when the full card would cover the subject) */
  setCompact(on: boolean): void { this.el.classList.toggle('st-compact', on); }
  setSayVisible(on: boolean): void { this.say.classList.toggle('st-on', on); }
  /** light the narration at `ms` into its clip (null: plain text) */
  setNarration(ms: number | null): void { this.narration?.set(ms); }
  setSay(ms: number | null): void { this.sayLine?.set(ms); }
  get hasSay(): boolean { return !!this.sayLine; }

  /** the card's size at this width, for the placer (it is laid out hidden, then shown where it goes) */
  measure(width: number, maxH: number): { w: number; h: number } {
    const c = this.el;
    c.style.width = `${Math.round(width)}px`; c.style.maxHeight = `${Math.round(maxH)}px`; c.style.height = '';
    const was = c.hidden, vis = c.style.visibility;
    c.hidden = false; c.style.visibility = 'hidden';
    this.setSayReserve(true);
    const h = Math.min(maxH, c.scrollHeight);
    this.setSayReserve(false);
    c.hidden = was; c.style.visibility = vis;
    return { w: Math.round(width), h: Math.ceil(h) };
  }
  /** the agent's line takes its room from the start (so the card never grows when it appears) */
  private setSayReserve(on: boolean): void { this.el.classList.toggle('st-reserve', on); }
  put(r: Rect, mode: 'card' | 'sheet'): void {
    const c = this.el;
    c.dataset.mode = mode;
    c.style.left = `${Math.round(r.x)}px`; c.style.top = `${Math.round(r.y)}px`; c.style.width = `${Math.round(r.w)}px`; c.style.height = `${Math.round(r.h)}px`; c.style.maxHeight = '';
  }
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

// ---- the start card -----------------------------------------------------------------------------------------------------------------------
export type StartChoice = 'sound' | 'silent';
export class StartCard {
  readonly el: HTMLElement;
  private primary: HTMLButtonElement;
  private secondary: HTMLButtonElement;
  constructor(host: HTMLElement, rs: RuntimeStory, opts: { shared: RuntimeBeat | null; audio: boolean; onChoose: (c: StartChoice) => void }) {
    // the outer element is the scrim, the inner one the dialog
    const wrap = (this.el = el('div', 'st-start'));
    const c = el('div', 'st-start-card');
    c.setAttribute('role', 'dialog'); c.setAttribute('aria-labelledby', 'st-start-h'); c.setAttribute('aria-describedby', 'st-start-p');
    wrap.append(c);
    const shared = opts.shared;
    const mins = Math.max(1, Math.round(rs.duration / 60));
    c.append(el('p', 'st-start-kick', shared ? 'A shared moment' : 'Interactive tour'));
    const h = el('h2', '', shared ? shared.popup.title : `The ${rs.family.surname} family home`);
    h.id = 'st-start-h';
    const p = el('p', 'st-start-p', shared ? `From the ${rs.family.surname} family tour. ${rs.family.tagline}` : rs.family.tagline);
    p.id = 'st-start-p';
    c.append(h, p);
    c.append(el('p', 'st-start-meta', `${rs.beats.length} stops, about ${mins} minute${mins === 1 ? '' : 's'}. ${FICTIONAL_LINE}`));
    const acts = el('div', 'st-actions');
    this.primary = el('button', 'st-btn st-primary', shared ? 'Play from here' : opts.audio ? 'Start with narration' : 'Start the tour');
    this.primary.type = 'button';
    this.secondary = el('button', 'st-btn', shared ? 'Play from here without sound' : 'Start without sound');
    this.secondary.type = 'button';
    this.primary.addEventListener('click', () => opts.onChoose(opts.audio ? 'sound' : 'silent'));
    this.secondary.addEventListener('click', () => opts.onChoose('silent'));
    acts.append(this.primary);
    if (opts.audio) acts.append(this.secondary);
    c.append(acts);
    const fine = el('ul', 'st-fine');
    for (const t of FINE_PRINT) fine.append(el('li', '', t));
    c.append(fine);
    host.append(wrap);
  }
  focus(): void { this.primary.focus({ preventScroll: true }); }
  contains(n: Node | null): boolean { return !!n && this.el.contains(n); }
  destroy(): void { this.el.remove(); }
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
    c.append(this.body);
    const acts = el('div', 'st-actions');
    const cta = el('a', 'st-btn st-primary', rs.closing.cta.label) as HTMLAnchorElement;
    cta.href = rs.closing.cta.url; cta.target = '_blank'; cta.rel = 'noopener';
    const mk = (label: string, fn: () => void) => { const b = el('button', 'st-btn', label); b.type = 'button'; b.addEventListener('click', fn); return b; };
    acts.append(cta, mk('Replay', opts.onReplay));
    if (opts.hasNext) acts.append(mk('Next family', opts.onNext));
    acts.append(mk('Share this family', opts.onShare));
    c.append(acts, el('p', 'st-note', 'Companion OS is in beta.'));
    host.append(c);
  }
  setNarration(ms: number | null): void { this.karaoke.set(ms); }
  put(r: Rect): void { const c = this.el; c.style.left = `${Math.round(r.x)}px`; c.style.top = `${Math.round(r.y)}px`; c.style.width = `${Math.round(r.w)}px`; }
  measure(width: number): { w: number; h: number } {
    const c = this.el, was = c.hidden, vis = c.style.visibility;
    c.style.width = `${Math.round(width)}px`; c.hidden = false; c.style.visibility = 'hidden';
    const h = c.offsetHeight;
    c.hidden = was; c.style.visibility = vis;
    return { w: Math.round(width), h };
  }
  show(on: boolean): void { this.el.hidden = !on; if (on) { void this.el.offsetWidth; this.el.classList.add('st-in'); } else this.el.classList.remove('st-in'); }
  get visible(): boolean { return !this.el.hidden; }
  destroy(): void { this.el.remove(); }
}
