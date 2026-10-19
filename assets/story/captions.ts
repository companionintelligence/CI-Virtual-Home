// Captions: the card's words, lit as they are spoken.
//
// There is one surface for the words (the beat's card, or the bottom sheet on a phone), so the caption IS the card's body: the same
// text, split into words, with the word being spoken marked. The narration is `popup.body` (STORY-BIBLE R2), so there is no second
// string to keep in step. The karaoke is decoration for the eye: it is aria-hidden, and a screen reader gets the text once from the
// live region (a11y.ts) and in the transcript (chapters.ts).
//
// Timings are the voice lock's, one per space-separated word of the text ([word, startMs, endMs], relative to the clip's start).
// With none (a clip that has no recording, or one whose word count does not match the text) the words are spread over `fallbackMs`
// by length, which is only used to pace the highlight; the tour never waits on it.
import type { WordTiming } from './types.js';

export type Timings = Array<[number, number]>;

/** Split a caption into the same words the voice lock counted. */
export const wordsOf = (text: string): string[] => text.split(/\s+/).filter(Boolean);

/** [start, end] ms per word, from the lock when its words match the text, else spread by length over `fallbackMs`. */
export function timingsFor(text: string, lock: WordTiming[] | null | undefined, fallbackMs: number): { t: Timings; real: boolean } {
  const ws = wordsOf(text);
  if (lock && lock.length === ws.length) return { t: lock.map(w => [w[1], w[2]] as [number, number]), real: true };
  const w = ws.map(x => x.length + 2), sum = w.reduce((a, b) => a + b, 0) || 1;
  let at = 0;
  return { t: w.map(x => { const s = at; at += (x / sum) * fallbackMs; return [s, at] as [number, number]; }), real: false };
}

/** index of the word being spoken at `ms` (-1 before the first; the last word stays lit after the end) */
export function wordIndexAt(t: Timings, ms: number): number {
  let k = -1;
  for (let i = 0; i < t.length; i++) { if (t[i][0] <= ms) k = i; else break; }
  return k;
}

/** A line of words in the DOM that can be lit. Build once per text; `set` is cheap and only touches the words that change. */
export class Karaoke {
  readonly el: HTMLElement;
  private spans: HTMLElement[] = [];
  private timings: Timings = [];
  private at = -2;
  private live = false;
  constructor(el: HTMLElement, text: string, lock?: WordTiming[] | null, fallbackMs = 0) {
    this.el = el;
    const ws = wordsOf(text);
    el.textContent = '';
    this.spans = ws.map((w, i) => {
      const s = document.createElement('span');
      s.className = 'st-w'; s.textContent = w;
      el.append(s);
      if (i < ws.length - 1) el.append(' ');
      return s;
    });
    this.timings = timingsFor(text, lock, fallbackMs || ws.length * 360).t;
  }
  /** Light the word at `ms` into the clip; `ms` null means plain text (nothing is being spoken for this line): every word at full strength. */
  set(ms: number | null): void {
    const live = ms !== null;
    const k = live ? wordIndexAt(this.timings, ms!) : -1;
    if (k === this.at && live === this.live) return;
    this.at = k; this.live = live;
    this.el.classList.toggle('st-live', live);
    for (let i = 0; i < this.spans.length; i++) {
      const c = this.spans[i].classList;
      c.toggle('st-done', live && i < k);
      c.toggle('st-now', live && i === k);
    }
  }
  get durationMs(): number { return this.timings.length ? this.timings[this.timings.length - 1][1] : 0; }
}
