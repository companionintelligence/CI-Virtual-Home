// The tour for people who do not see it: one polite live region, a labelled canvas, and a few focus helpers.
//
//   - ONE role="status" aria-live="polite" region (not one per widget, which would read the same beat twice). At each beat change it is
//     given "Chapter 3 of 9, Kitchen. <beat title>. <beat text>", debounced 400 ms so a run of key presses reads only the last beat, and
//     never while the viewer is dragging the scrubber (a scrub passes dozens of beats).
//   - The karaoke on the card is aria-hidden (it is the same words again), and so are the in-scene pin and the leader line.
//   - The 3D canvas is role="img" with a label that says what it is and where the real navigation is.
//   - Focus is never trapped and never taken on a beat change. The only places the tour moves focus: onto the start card's first
//     button when it opens, onto the play button when it closes, into the chapters panel when a key opened it, and back to the
//     button that opened a panel when it closes.
import type { RuntimeStory } from './runtime.js';

export class Announcer {
  readonly el: HTMLElement;
  private timer = 0;
  private last = '';
  scrubbing = false;
  constructor(parent: HTMLElement) {
    const el = document.createElement('div');
    el.className = 'st-live-region';
    el.setAttribute('role', 'status'); el.setAttribute('aria-live', 'polite'); el.setAttribute('aria-atomic', 'true');
    parent.append(el);
    this.el = el;
  }
  /** Say this after 400 ms of quiet. The same text twice in a row is said once. */
  say(text: string, delay = 400): void {
    clearTimeout(this.timer);
    this.timer = window.setTimeout(() => {
      if (this.scrubbing || text === this.last) return;
      this.last = text;
      this.el.textContent = text;
    }, delay);
  }
  /** Forget the last text (the next beat is announced even if it reads the same) */
  reset(): void { this.last = ''; }
  destroy(): void { clearTimeout(this.timer); this.el.remove(); }
}

/** "Chapter 3 of 9, Kitchen. Lights on a schedule. At ten, the living-room lights dim ..." */
export function beatAnnouncement(rs: RuntimeStory, i: number): string {
  const b = rs.beats[i];
  const ci = Math.max(0, rs.chapters.findIndex(c => c.id === b.chapter));
  return `Chapter ${ci + 1} of ${rs.chapters.length}, ${rs.chapters[ci].title}. ${b.popup.title}. ${b.popup.body}`;
}

/** The canvas is a picture of a house with a tour on top of it. */
export function labelCanvas(canvas: HTMLElement, surname: string): void {
  canvas.setAttribute('role', 'img');
  canvas.setAttribute('aria-label', `Interactive 3D tour of the ${surname} family home. Use the chapters list to move between rooms.`);
}

/** Put focus on `el` without scrolling the page. */
export const focusEl = (el: HTMLElement | null | undefined): void => { try { el?.focus({ preventScroll: true }); } catch { /* removed from the page */ } };

/** Is focus somewhere inside `root` (so a panel closing knows whether to give it back) */
export const hasFocus = (root: Element | null): boolean => !!root && root.contains(document.activeElement);
