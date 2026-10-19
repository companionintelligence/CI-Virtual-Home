// The tour's keys, taken in the capture phase so they win over the player's own (assets/viewer.ts binds Space, the arrows, C, 1 to 9 and
// Esc on window, in the bubble phase). A key the tour owns stops there (stopPropagation + preventDefault) so the player never sees it;
// every other key goes through untouched.
//
//   Space            play or pause (replays the beat's narration when motion is reduced and nothing auto-plays)
//   Left, Right      the previous or next beat; with Shift, the previous or next chapter. A focused slider keeps its native arrows.
//   M                narration on or off (turning it on is a gesture: it is what makes the audio context)
//   1 to 9           chapter n
//   C                the chapters panel (in free-look C stays the player's cutaway toggle)
//   Esc              closes, in this order: the shortcuts panel (the player's), the chapters panel, then free-look (back to the tour) and
//                    at last the player's own fly exit
//   [ and ]          the previous and next family (the player's; not taken here)
//   ?                the shortcuts panel (the player's; mount.ts rewrites its text for the tour)
//
// A key typed in a text field, or with Ctrl, Alt or the Command key, is never taken. Space on a focused button or link is that
// control's own key and is left alone, except on the start card, where it is "Start with narration".
export interface KeyActions {
  startCardOpen(): boolean;
  startFromKey(): void;
  togglePlay(): void;
  step(dir: 1 | -1, chapter: boolean): void;
  toggleMute(): void;
  chapter(n: number): void;
  toggleChapters(): void;
  chaptersOpen(): boolean;
  closeChapters(): void;
  helpOpen(): boolean;
  flying(): boolean;
  leaveFreeLook(): void;
}

export function bindKeys(a: KeyActions): () => void {
  const onKey = (e: KeyboardEvent) => {
    if (e.metaKey || e.ctrlKey || e.altKey || e.isComposing) return;
    const t = e.target as HTMLElement | null;
    const tag = t?.tagName || '';
    if (tag === 'TEXTAREA' || tag === 'SELECT' || (tag === 'INPUT' && (t as HTMLInputElement).type !== 'range')) return;
    if (t?.isContentEditable) return;
    const onRange = tag === 'INPUT';
    const onControl = tag === 'BUTTON' || tag === 'A' || tag === 'SUMMARY';
    const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    const take = () => { e.preventDefault(); e.stopPropagation(); };

    if (a.startCardOpen()) {
      // before the tour starts: the keys the player would act on (arrows, digits, ...) do nothing, so a stray press never moves a tour nobody started
      if ((k === ' ' || k === 'Spacebar') && !onControl) { take(); a.startFromKey(); return; }
      if (k === 'ArrowLeft' || k === 'ArrowRight' || k === 'Home' || k === 'End' || /^[1-9]$/.test(k) || k === 'c' || k === 'm') { if (!onRange) take(); return; }
      return;
    }
    if (k === ' ' || k === 'Spacebar') { if (onControl) return; take(); a.togglePlay(); return; }
    if (k === 'ArrowLeft' || k === 'ArrowRight') { if (onRange) return; take(); a.step(k === 'ArrowLeft' ? -1 : 1, e.shiftKey); return; }
    if (k === 'm') { take(); a.toggleMute(); return; }
    if (/^[1-9]$/.test(k)) { take(); a.chapter(Number(k) - 1); return; }
    if (k === 'c') { if (a.flying()) return; take(); a.toggleChapters(); return; }
    if (k === 'Escape') {
      if (a.helpOpen()) return;                              // the player closes it
      if (a.chaptersOpen()) { take(); a.closeChapters(); return; }
      if (a.flying()) { take(); a.leaveFreeLook(); return; }
      return;
    }
  };
  window.addEventListener('keydown', onKey, true);
  return () => window.removeEventListener('keydown', onKey, true);
}
