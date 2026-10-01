// The chapters panel: where to go next, and the whole tour as text.
//
// A drawer on the right at 1100 px and up, a bottom sheet below (story.css decides; this file only builds the list). It is not modal and
// traps nothing: Tab leaves it, Esc closes it and gives focus back to the button that opened it. The list is a real <nav> of real
// <button>s (the current chapter is aria-current and shows its stops), so it works without the 3D view and with a screen reader. The
// Transcript beneath it is the same story as plain text, one heading per chapter, so the tour can be read start to finish in a minute.
import type { RuntimeStory } from './runtime.js';
import { el } from './popup.js';
import { focusEl } from './a11y.js';

export class Chapters {
  readonly el: HTMLElement;
  private items: HTMLButtonElement[] = [];
  private beatBtns: HTMLButtonElement[] = [];
  private lists: HTMLElement[] = [];
  private opener: HTMLElement | null = null;
  private cur = -1;
  constructor(host: HTMLElement, private rs: RuntimeStory, private go: { beat(i: number): void; chapter(i: number): void }, private onToggle: (open: boolean) => void) {
    const a = (this.el = el('aside', 'st-chapters'));
    a.id = 'st-chapters'; a.hidden = true;
    a.setAttribute('aria-label', 'Chapters');
    const head = el('div', 'st-ch-head');
    head.append(el('h2', '', 'Chapters'));
    const x = el('button', 'st-x'); x.type = 'button'; x.setAttribute('aria-label', 'Close chapters');
    x.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>';
    x.addEventListener('click', () => this.close(true));
    head.append(x);
    a.append(head);

    const nav = el('nav', 'st-ch-nav'); nav.setAttribute('aria-label', 'Tour chapters');
    const ol = el('ol', 'st-ch-list');
    rs.chapters.forEach((c, ci) => {
      const li = el('li', 'st-ch-item');
      const b = el('button', 'st-ch'); b.type = 'button';
      b.append(el('span', 'st-n', String(ci + 1)), el('span', 'st-ch-title', c.title), el('small', '', `${c.beats} ${c.beats === 1 ? 'stop' : 'stops'}`));
      b.addEventListener('click', () => this.go.chapter(ci));
      this.items.push(b);
      const bl = el('ol', 'st-beats'); bl.hidden = true;
      rs.beats.forEach((bt, bi) => {
        if (bt.chapter !== c.id) return;
        const bli = el('li');
        const bb = el('button', 'st-bt', bt.popup.title); bb.type = 'button'; bb.dataset.i = String(bi);
        bb.addEventListener('click', () => this.go.beat(bi));
        this.beatBtns[bi] = bb; bli.append(bb); bl.append(bli);
      });
      this.lists.push(bl);
      li.append(b, bl); ol.append(li);
    });
    nav.append(ol); a.append(nav);

    const tr = el('details', 'st-transcript');
    tr.append(el('summary', '', 'Transcript'));
    const body = el('div', 'st-tr-body');
    for (const c of rs.chapters) {
      body.append(el('h3', '', c.title));
      for (const bt of rs.beats.filter(x => x.chapter === c.id)) {
        const p = el('p');
        p.append(el('strong', '', `${bt.popup.title}. `), document.createTextNode(bt.popup.body));
        if (bt.popup.note) p.append(' ', el('em', '', bt.popup.note));
        body.append(p);
        if (bt.say) {
          const who = rs.members.find(m => m.id === bt.say!.speaker)?.companion?.name || 'Companion';
          const q = el('p', 'st-tr-say'); q.append(el('strong', '', `${who}: `), document.createTextNode(bt.say.text));
          body.append(q);
        }
      }
    }
    tr.append(body); a.append(tr);
    host.append(a);
  }

  get isOpen(): boolean { return !this.el.hidden; }
  open(opener: HTMLElement | null, focusIn: boolean): void {
    if (this.isOpen) return;
    this.opener = opener;
    this.el.hidden = false;
    this.onToggle(true);
    if (focusIn) focusEl(this.items[Math.max(0, this.cur >= 0 ? this.chapterOf(this.cur) : 0)]);
  }
  close(returnFocus: boolean): void {
    if (!this.isOpen) return;
    const had = this.el.contains(document.activeElement);
    this.el.hidden = true;
    this.onToggle(false);
    if ((returnFocus || had) && this.opener) focusEl(this.opener);
  }
  toggle(opener: HTMLElement | null, focusIn: boolean): void { this.isOpen ? this.close(true) : this.open(opener, focusIn); }

  private chapterOf(beat: number): number { return Math.max(0, this.rs.chapters.findIndex(c => c.id === this.rs.beats[beat].chapter)); }
  /** Mark the beat that is playing: its chapter is aria-current and shows its stops. */
  setCurrent(beat: number): void {
    if (beat === this.cur) return;
    this.cur = beat;
    const ci = this.chapterOf(beat);
    this.items.forEach((b, i) => { if (i === ci) b.setAttribute('aria-current', 'step'); else b.removeAttribute('aria-current'); this.lists[i].hidden = i !== ci; });
    this.beatBtns.forEach((b, i) => { if (!b) return; if (i === beat) b.setAttribute('aria-current', 'true'); else b.removeAttribute('aria-current'); });
    const active = this.beatBtns[beat];
    if (active && this.isOpen && active.scrollIntoView) active.scrollIntoView({ block: 'nearest' });
  }
  destroy(): void { this.el.remove(); }
}
