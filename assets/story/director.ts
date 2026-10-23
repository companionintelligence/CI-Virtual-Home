// The director: the tour's brain. It does not move the camera (the player's loop plays the baked story track through the page's own
// applySplineFrame); it watches the player's clock, and decides what the person sees and hears on top of it: which beat is on, its card
// and where the card goes, the narration, the captions, the chapters, the end card, the address bar, and what the keys do.
//
// The clock. `stats.t` (0 to 1 of the track) is the player's; one tour second is `t * duration`. While narration is audible the clock is
// the audio's: if the voice and the picture drift more than DRIFT_S the picture is moved to the voice (a clip that buffered late, a
// tab that slept). Muted, or with no recording, it is the wall clock the player already runs, and the durations are the voice lock's
// either way, so a tour with sound and one without take the same time and land on the same frames.
//
// Reduced motion. Nothing auto-advances and nothing glides: the tour opens paused, a step is a cut (a 250 ms cross-fade, below), the
// camera rests at the beat's pose and the beat's narration plays once on request. `stepClock` is that beat's own small clock.
//
// Cross-fades. Anything that is not a continuous move (a step, a chapter jump, the tour's own cuts across a house, reduced motion) fades from
// the old picture to the new: the canvas is drawn into an overlay canvas in the same task as a render, then the overlay fades out over 250 ms.
import type { RuntimeStory, RuntimeBeat } from './runtime.js';
import { beatIndexAt } from './runtime.js';
import { trackFrameAt } from './track.js';
import { focusRect, placePopup, placeSheet, placeEndCard, leaderTo, panelWidths, sheetLayout, typeFloor, SHEET_MAX_FRAC, type Rect, type CardSize, type SheetVariant, type SheetOut } from './place.js';
import { placePhoneSheet, PHONE_SHEET_FRAC } from './sheet.js';
import { Narrator } from './audio.js';
import { BeatCard, StartCard, EndCard, el, type StartChoice, type StartMember } from './popup.js';
import { Chapters } from './chapters.js';
import { Announcer, beatAnnouncement, labelCanvas, focusEl, hasFocus } from './a11y.js';
import { bindKeys } from './keys.js';
import { writeBeat, beatInUrl, familyPageUrl, beatFromQuery, memberFromQuery, memberBeat, tourHref } from './url.js';

export type Control = {
  seek(t: number): void; setPlaying(on: boolean): void; selectShot(s: any, o?: any): void;
  toast(msg: string, ms?: number): void; enterFly(o?: any): void; exitFly(): void;
};
export type Env = {
  api: any; stats: any; root: HTMLElement; rs: RuntimeStory; control: Control; slug: string;
  reduced: boolean; audioBase: string;
  /** the family the end card's "Next family" opens (the next one that has a tour), or null when there is no other */
  next?: { slug: string; house: string } | null;
  /** the address the page was opened with (its ?beat= or ?member=), when this is the first tour of the page view */
  query?: URLSearchParams;
};

type Subject = { box: number[]; focus: number[] | null };
/** A phone on its side (a window at most 500 px tall and wider than tall) takes a side panel of at most this share of the width, never a sheet that covers the height of the scene. */
export const SIDE_PANEL_FRAC = 0.45;
export const SIDE_MAX_H = 500;
/** The picture is shifted up by this share of the window's height on a phone held upright, so the sheet has the room under the subject (Director.syncShift). */
export const PHONE_SHIFT = 0.17;
/** is this window a phone on its side: short and wider than tall (a width under 768 px is still the phone's type scale, but the layout is the side panel's) */
export const sidePhone = (w: number, h: number): boolean => h <= SIDE_MAX_H && w > h;
const DRIFT_S = 0.12;           // the picture follows the voice when they are further apart than this
const FADE_MS = 250;
const END_EPS = 0.9995;
const ICON = {
  list: '<path d="M8 6h13"/><path d="M8 12h13"/><path d="M8 18h13"/><path d="M3 6h.01"/><path d="M3 12h.01"/><path d="M3 18h.01"/>',
  on: '<path d="M11 4.702a.705.705 0 0 0-1.203-.498L6.413 7.587A1.4 1.4 0 0 1 5.416 8H3a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2.416a1.4 1.4 0 0 1 .997.413l3.383 3.384A.705.705 0 0 0 11 19.298z"/><path d="M16 9a5 5 0 0 1 0 6"/><path d="M19.364 18.364a9 9 0 0 0 0-12.728"/>',
  off: '<path d="M11 4.702a.705.705 0 0 0-1.203-.498L6.413 7.587A1.4 1.4 0 0 1 5.416 8H3a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2.416a1.4 1.4 0 0 1 .997.413l3.383 3.384A.705.705 0 0 0 11 19.298z"/><path d="m22 9-6 6"/><path d="m16 9 6 6"/>',
};
const icon = (p: string, cls = '') => `<svg class="vh-i ${cls}" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${p}</svg>`;

export class Director {
  private env: Env;
  private rs: RuntimeStory;
  private T: number;
  private host: HTMLElement;
  private probe!: HTMLElement;
  private card: BeatCard;
  private start: StartCard | null = null;
  private end: EndCard;
  private chapters: Chapters;
  private live: Announcer;
  private narrator: Narrator | null;
  private fade: HTMLCanvasElement;
  private btnChapters!: HTMLButtonElement;
  private btnSound!: HTMLButtonElement;
  private unbind: () => void = () => {};
  private raf = 0;
  private destroyed = false;
  private started = false;
  private soundOn = false;
  private beat = -1;
  private stepMode: boolean;
  private stepClock = 0;          // reduced motion: seconds into the tour as the current beat's narration has it
  private stepSpeaking = false;
  private stepBeat = -1;         // reduced motion: the beat the person stepped to
  private endMode = false;
  private place_: { rect: Rect; mode: 'card' | 'sheet'; subject: Rect | null; ok: boolean; overlapFocus: number; slot: string; variant: number; scrolls: boolean; type: number; refused: number } | null = null;
  private placedFor = '';
  private subject: Subject | null = null;
  private lastPlaying = false;
  private audioPaused = false;
  private pendingClip = '';
  private failToast = false;
  private lastUrlCheck = 0;
  private snapped: number | null = null;     // the cut time a snapshot is waiting for
  private prevClock = 0;
  private fadeTimer = 0;
  private resizeObs: ResizeObserver | null = null;
  private resizeTimer = 0;
  private initial = -1;
  private ticks = 0;
  private shift = 0;                 // px the picture is shifted up (syncShift)
  private shiftKey = '';
  private noShift = (new URLSearchParams(location.search).get('no') || '').split(',').includes('shift');

  constructor(env: Env) {
    this.env = env;
    const rs = (this.rs = env.rs);
    this.T = rs.duration;
    this.stepMode = env.reduced;
    const root = env.root;
    // the tour's layer inside the player's: pointer-events none, its parts opt in
    const host = (this.host = el('div', 'st'));
    host.dataset.st = '1';
    root.append(host);
    // the notch and the home bar: env(safe-area-inset-*) cannot be read from script, so a probe that pads itself with them is (the placement keeps cards out of them)
    this.probe = el('div', 'st-safe-probe');
    this.probe.setAttribute('aria-hidden', 'true');
    this.probe.style.cssText = 'position:absolute;left:0;top:0;width:0;height:0;visibility:hidden;pointer-events:none;box-sizing:content-box;padding:env(safe-area-inset-top,0px) env(safe-area-inset-right,0px) env(safe-area-inset-bottom,0px) env(safe-area-inset-left,0px)';
    host.append(this.probe);

    // the narrator: every recorded clip, by its URL (relative to the page, which is at the site root)
    const clips: Record<string, { url: string; durationMs: number }> = {};
    for (const [id, c] of Object.entries(rs.audio || {})) clips[id] = { url: new URL(c.file, location.href).href, durationMs: c.durationMs };
    this.narrator = Object.keys(clips).length ? new Narrator(clips) : null;
    if (this.narrator) {
      this.narrator.onFail = () => { if (!this.failToast) { this.failToast = true; env.control.toast('Narration could not load. Captions are on.', 4200); } };
      // (no clip is fetched until a person chooses sound: "Start without sound" costs no audio bytes at all)
    }

    this.card = new BeatCard(host);
    // story v2: "More" makes the card taller (or shorter): its place is solved again for the new size, and opening it pauses the tour, so the card does not change under a reader
    this.card.onMore = open => this.moreChanged(open);
    const endTimings = rs.audio?.closing;
    this.end = new EndCard(host, rs, {
      timings: endTimings ? endTimings.words : null, durMs: endTimings ? endTimings.durationMs : 9000, hasNext: !!env.next,
      onReplay: () => this.replay(), onNext: () => this.nextFamily(), onShare: () => this.share(),
    });
    this.chapters = new Chapters(host, rs, { beat: i => this.userGoBeat(i), chapter: i => this.userGoChapter(i) }, open => this.onChapters(open));
    this.live = new Announcer(host);
    this.fade = el('canvas', 'st-fade') as HTMLCanvasElement;
    this.fade.setAttribute('aria-hidden', 'true');
    host.append(this.fade);

    this.mountChrome();
    labelCanvas(env.api.canvas, rs.family.surname);

    // where a shared link points: ?beat=<id|n>, else ?member=<id> (the first beat of that person's own room: "Start with John"), else ?t=
    // (the player seeks to it itself; the card names the moment). A beat is a shared moment; a member is a way in, and the card says whose.
    const q = env.query || new URLSearchParams();
    let at = beatFromQuery(q, rs.beats), who: { name: string } | null = null;
    if (at < 0) {
      const m = memberFromQuery(q, rs.members, rs.chapters, rs.beats);
      if (m >= 0) { at = m; who = rs.members.find(x => x.id === q.get('member')) || null; }
    }
    if (at < 0 && Number(env.stats.t) > 0.001) at = beatIndexAt(rs.beats, env.stats.t * this.T);
    this.initial = at;
    if (at >= 0) env.control.seek(rs.beats[at].rest / this.T);
    env.control.setPlaying(false);

    // the family on the start card: each person who has a beat in their own room, in the story's order
    const members: StartMember[] = rs.members.map(m => ({ id: m.id, name: m.name, archetype: m.archetype || '', colour: m.colour, beat: memberBeat(rs.chapters, rs.beats, m.id) })).filter(m => m.beat >= 0);
    this.start = new StartCard(host, rs, {
      shared: at >= 0 && !who ? rs.beats[at] : null, member: who, members, audio: !!this.narrator,
      onChoose: (c, to) => this.begin(c, to),
    });
    this.start.focus();
    this.unbind = bindKeys({
      startCardOpen: () => !!this.start, startFromKey: () => this.begin(this.narrator ? 'sound' : 'silent'),
      togglePlay: () => this.togglePlay(), step: (d, ch) => this.step(d, ch), toggleMute: () => this.toggleSound(),
      chapter: n => this.userGoChapter(n), toggleChapters: () => this.chapters.toggle(this.btnChapters, true),
      chaptersOpen: () => this.chapters.isOpen, closeChapters: () => this.chapters.close(true),
      moreOpen: () => this.card.expanded, closeMore: () => { const had = hasFocus(this.card.el); this.card.setMore(false); if (had) this.card.focusMore(); },
      helpOpen: () => { const h = env.root.querySelector<HTMLElement>('.vh-help'); return !!h && !h.hidden; },
      flying: () => this.flying, leaveFreeLook: () => this.leaveFreeLook(),
    });
    this.resizeObs = new ResizeObserver(() => { clearTimeout(this.resizeTimer); this.resizeTimer = window.setTimeout(() => { this.placedFor = ''; this.replace(); this.start?.fit(); }, 120); });
    this.resizeObs.observe(root);
    // (the display face arriving after a card was placed re-wraps its lines: the trimmed width was the old lines'. Place it again once the fonts are in.)
    try { void document.fonts.ready.then(() => { if (this.destroyed) return; this.placedFor = ''; this.replace(); this.start?.fit(); }); } catch { /* no font API */ }
    this.raf = requestAnimationFrame(this.tick);
  }

  // ------------------------------------------------------------------ small readers
  private get stats() { return this.env.stats; }
  private get flying(): boolean { return this.env.root.dataset.fly === '1'; }
  private get playing(): boolean { return !!this.stats.playing; }
  private get t(): number { return Number(this.stats.t) || 0; }
  private get playerClock(): number { return this.t * this.T; }
  /** the tour's clock, seconds */
  private get clock(): number { return this.stepMode ? this.stepClock : this.playerClock; }
  private clipsFor(i: number, n: number): string[] {
    const out: string[] = [];
    for (let k = i; k < Math.min(this.rs.beats.length, i + n); k++) { const b = this.rs.beats[k]; out.push(b.id); if (b.say) out.push(`${b.id}.say`); }
    return out;
  }
  private dur(id: string): number { const c = this.rs.audio?.[id]; return c ? c.durationMs / 1000 : 0; }
  private rect(): { w: number; h: number; x: number; y: number } { const r = this.env.root.getBoundingClientRect(); return { w: r.width, h: r.height, x: r.left, y: r.top }; }
  /** the room the notch, the rounded corners and the home bar take at each edge of the player, px (0 on a screen without them) */
  private insets(): { top: number; right: number; bottom: number; left: number } {
    const cs = getComputedStyle(this.probe), n = (v: string) => parseFloat(v) || 0;
    return { top: n(cs.paddingTop), right: n(cs.paddingRight), bottom: n(cs.paddingBottom), left: n(cs.paddingLeft) };
  }

  // ------------------------------------------------------------------ chrome: the buttons beside the player's, the help text, the chapter ticks
  private mountChrome(): void {
    const root = this.env.root, actions = root.querySelector('.vh-actions');
    if (actions) {
      const mk = (cls: string, label: string, svg: string) => { const b = el('button', `vh-iconbtn ${cls}`); b.type = 'button'; b.setAttribute('aria-label', label); b.title = label; b.innerHTML = svg; return b; };
      this.btnChapters = mk('st-btn-chapters', 'Chapters', icon(ICON.list)) as HTMLButtonElement;
      this.btnChapters.setAttribute('aria-controls', 'st-chapters'); this.btnChapters.setAttribute('aria-expanded', 'false');
      this.btnChapters.title = 'Chapters  C';
      this.btnChapters.addEventListener('click', () => this.chapters.toggle(this.btnChapters, false));
      this.btnSound = mk('st-btn-sound', 'Turn narration on', icon(ICON.off)) as HTMLButtonElement;
      this.btnSound.setAttribute('aria-pressed', 'false');
      this.btnSound.addEventListener('click', () => this.toggleSound());
      if (!this.narrator) this.btnSound.hidden = true;
      actions.prepend(this.btnChapters, this.btnSound, Object.assign(el('span', 'vh-sep'), { ariaHidden: 'true' }));
    } else { this.btnChapters = el('button') as HTMLButtonElement; this.btnSound = el('button') as HTMLButtonElement; }
    // the shortcuts panel says what the keys do in the tour
    const dl = root.querySelector('.vh-help dl');
    if (dl) {
      dl.innerHTML = [
        ['<kbd>Space</kbd>', 'Play or pause'], ['<kbd>←</kbd> <kbd>→</kbd>', 'Previous or next stop (Shift: chapter)'],
        ['<kbd>1</kbd>…<kbd>9</kbd>', 'Go to a chapter'], ['<kbd>C</kbd>', 'Chapters (while flying: cutaway)'],
        ['<kbd>M</kbd>', 'Narration on or off'], ['<kbd>F</kbd>', 'Fly the camera yourself'],
        ['<kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd>', 'Move while flying (Shift: faster)'], ['<kbd>Esc</kbd>', 'Close a panel, then back to the tour'],
        ['<kbd>[</kbd> <kbd>]</kbd>', 'Previous or next family'], ['<kbd>Shift</kbd> <kbd>F</kbd>', 'Full screen'],
      ].map(([k, d]) => `<dt>${k}</dt><dd>${d}</dd>`).join('');
    }
    const legend = root.querySelector('.vh-help-legend'); if (legend) legend.setAttribute('hidden', '');
    // chapter ticks on the timeline (decoration: the chapters panel is the real navigation)
    const scrub = root.querySelector('.vh-scrub');
    if (scrub) {
      for (const ch of this.rs.chapters.slice(1)) {
        const tick = el('span', 'st-tick'); tick.setAttribute('aria-hidden', 'true'); tick.style.left = `${(ch.t0 / this.T * 100).toFixed(2)}%`; tick.title = ch.title;
        scrub.append(tick);
      }
      const input = scrub.querySelector('input');
      let quiet = 0;
      const scrubbing = () => { this.live.scrubbing = true; clearTimeout(quiet); quiet = window.setTimeout(() => { this.live.scrubbing = false; this.live.reset(); if (this.beat >= 0) this.announce(this.beat); }, 600); };
      input?.addEventListener('input', scrubbing);
    }
    this.env.root.dataset.story = '1';
  }
  /** The card's "More" opened or closed: the card is a different size, so it is placed again (against the same rest pose, so it still keeps off the subject). */
  private moreChanged(open: boolean): void {
    this.placedFor = ''; this.replace();
    if (open && !this.stepMode && this.playing) this.env.control.setPlaying(false);
  }
  private onChapters(open: boolean): void {
    this.btnChapters.setAttribute('aria-expanded', String(open));
    this.env.root.dataset.chapters = open ? '1' : '0';
    this.placedFor = ''; this.replace();
  }

  // ------------------------------------------------------------------ starting
  /** The first gesture. Narration is only ever turned on from here, from M, or from the sound button: each is a click or a key press. */
  private begin(choice: StartChoice, at = -1): void {
    if (this.started) return;
    this.started = true;
    if (at >= 0 && at < this.rs.beats.length) this.initial = at;       // "Start with Sally": her room's first beat
    this.start?.destroy(); this.start = null;
    this.env.root.dataset.started = '1';
    if (choice === 'sound' && this.narrator) {
      if (this.narrator.enable()) { this.soundOn = true; this.narrator.setMuted(false); this.narrator.warm(this.clipsFor(Math.max(0, this.initial), 3)); }
      else this.env.control.toast('Narration is not available here. Captions are on.', 4200);
    }
    this.syncSoundUi();
    focusEl(this.env.root.querySelector<HTMLElement>('.vh-play'));
    const first = this.initial >= 0 ? this.initial : 0;
    if (this.stepMode) this.goBeat(first, true);
    else {
      if (this.initial >= 0) this.jump(this.rs.beats[first].speechAt, true);
      this.env.control.setPlaying(true);
    }
  }

  // ------------------------------------------------------------------ moving
  private togglePlay(): void {
    if (this.endMode) { this.replay(); return; }
    if (this.stepMode) { this.speakBeat(); return; }
    if (this.flying) this.env.control.exitFly();
    this.env.control.setPlaying(!this.playing);
  }
  /** A person asked to be somewhere: leave free-look, and go (fading, unless the move is a small one inside a beat). */
  private jump(clock: number, fade: boolean): void {
    const go = () => this.env.control.seek(Math.max(0, Math.min(1, clock / this.T)));
    if (this.flying) this.env.control.exitFly();
    if (fade) this.crossfade(go); else go();
  }
  /** Go to a beat. Playing: the player carries on from the start of its narration. Paused: it rests on the beat's pose. Stepping (reduced motion): it rests, and the narration plays once. */
  private goBeat(i: number, silentStart = false): void {
    const n = this.rs.beats.length;
    if (i >= n) { this.finish(); return; }
    i = Math.max(0, i);
    const b = this.rs.beats[i];
    this.endMode = false; this.end.show(false);
    this.narrator?.stop(); this.pendingClip = '';
    this.live.reset();
    if (this.stepMode) {
      this.stepBeat = i;
      if (this.flying) this.env.control.exitFly();
      this.crossfade(() => this.env.control.seek(b.rest / this.T));
      this.stepClock = b.speechAt; this.stepSpeaking = this.soundOn && !silentStart ? true : this.soundOn;
      if (!this.soundOn) this.stepClock = Number.MAX_SAFE_INTEGER;   // no voice to wait for: the whole card is shown
    } else {
      const playing = this.playing;
      this.jump(playing || silentStart ? b.speechAt : b.rest, !silentStart);
      if (!playing && silentStart) this.env.control.setPlaying(true);
    }
  }
  private userGoBeat(i: number): void { this.goBeat(i); }
  private userGoChapter(ci: number): void {
    const ch = this.rs.chapters[ci]; if (!ch) return;
    this.goBeat(ch.beat0);
  }
  private step(dir: 1 | -1, chapter: boolean): void {
    if (!this.started) return;
    const cur = this.endMode ? this.rs.beats.length : Math.max(0, this.beat);
    if (chapter) {
      const ci = this.endMode ? this.rs.chapters.length : this.rs.chapters.findIndex(c => c.id === this.rs.beats[cur].chapter);
      const to = ci + dir;
      if (to >= this.rs.chapters.length) { this.finish(); return; }
      this.userGoChapter(Math.max(0, to)); return;
    }
    this.goBeat(cur + dir);
  }
  /** past the last beat: the end card */
  private finish(): void {
    this.env.control.setPlaying(false);
    if (this.flying) this.env.control.exitFly();
    this.env.control.seek(1);
    this.endMode = true;
  }
  private replay(): void {
    this.end.show(false); this.endMode = false;
    this.narrator?.stop();
    this.env.control.seek(0);
    this.beat = -1; this.stepBeat = -1;
    if (this.stepMode) this.goBeat(0); else this.env.control.setPlaying(true);
  }
  private speakBeat(): void {
    // reduced motion, Space: say this beat's narration again
    if (this.beat < 0) return;
    this.narrator?.stop(); this.pendingClip = '';
    this.stepClock = this.soundOn ? this.rs.beats[this.beat].speechAt : Number.MAX_SAFE_INTEGER;
    this.stepSpeaking = this.soundOn;
  }
  private leaveFreeLook(): void { this.env.control.exitFly(); this.env.control.toast('Back to the tour', 1800); }
  /** The next family that has a tour: a page of its own (the player opens the house it lives in), with the address's campaign tags kept. */
  private nextFamily(): void {
    const n = this.env.next; if (!n) return;
    try { location.assign(tourHref(location.pathname.split('/').pop() || 'room-creator', n.house, n.slug, location.search)); }
    catch { this.env.control.toast('The next family could not open.', 3000); }
  }
  private async share(): Promise<void> {
    const href = familyPageUrl(this.env.slug);
    const title = `The ${this.rs.family.surname} family home`;
    try {
      if (matchMedia('(pointer: coarse)').matches && (navigator as any).share) { await (navigator as any).share({ title, url: href }); return; }
      await navigator.clipboard.writeText(href);
      this.env.control.toast('Link copied.', 2200);
    } catch { this.env.control.toast(href, 5000); }
  }

  // ------------------------------------------------------------------ narration
  private toggleSound(): void {
    if (!this.narrator) return;
    if (!this.started) return;
    if (!this.soundOn) {
      if (!this.narrator.enable()) { this.env.control.toast('Narration is not available here. Captions are on.', 4200); return; }
      this.narrator.setMuted(false); this.soundOn = true;
      this.narrator.warm(this.clipsFor(Math.max(0, this.beat), 3));
      this.env.control.toast('Narration on', 1600);
      if (this.stepMode) this.speakBeat();
    } else {
      this.soundOn = false; this.narrator.stop(); this.pendingClip = '';
      this.env.control.toast('Narration off. Captions stay on.', 2200);
    }
    this.syncSoundUi();
  }
  private syncSoundUi(): void {
    const b = this.btnSound;
    b.setAttribute('aria-pressed', String(this.soundOn));
    const label = this.soundOn ? 'Turn narration off  M' : 'Turn narration on  M';
    b.setAttribute('aria-label', this.soundOn ? 'Turn narration off' : 'Turn narration on'); b.title = label;
    b.innerHTML = icon(this.soundOn ? ICON.on : ICON.off);
    this.env.root.dataset.sound = this.soundOn ? '1' : '0';
  }

  /** The clip that should be sounding at this clock, with when it started */
  private clipAt(i: number, clock: number): { id: string; start: number; dur: number } | null {
    const b = this.rs.beats[i]; if (!b) return null;
    const n = this.rs.audio?.[b.id];
    if (n && clock >= b.speechAt && clock < b.speechAt + n.durationMs / 1000) return { id: b.id, start: b.speechAt, dur: n.durationMs / 1000 };
    if (b.say && b.sayAt !== null) { const s = this.rs.audio?.[`${b.id}.say`]; if (s && clock >= b.sayAt && clock < b.sayAt + s.durationMs / 1000) return { id: `${b.id}.say`, start: b.sayAt, dur: s.durationMs / 1000 }; }
    return null;
  }

  // ------------------------------------------------------------------ cross-fade
  private snapshot(): boolean {
    const f = this.fade, src = this.env.api.canvas as HTMLCanvasElement;
    try {
      if (f.width !== src.width || f.height !== src.height) { f.width = src.width; f.height = src.height; }
      this.env.api.render(false);                       // (a render in this task, so the canvas holds the picture now)
      const g = f.getContext('2d'); if (!g) return false;
      g.drawImage(src, 0, 0);
      return true;
    } catch { return false; }
  }
  private showFade(): void {
    const f = this.fade;
    clearTimeout(this.fadeTimer);
    f.style.transition = 'none'; f.style.opacity = '1';
    requestAnimationFrame(() => requestAnimationFrame(() => {
      f.style.transition = `opacity ${FADE_MS}ms ease-out`; f.style.opacity = '0';
    }));
  }
  private crossfade(change: () => void): void {
    const ok = this.snapshot();
    change();
    if (ok) this.showFade();
  }

  // ------------------------------------------------------------------ placement
  private barRects(): Rect[] {
    const o = this.rect(), out: Rect[] = [];
    const add = (e: Element | null, pad = 0) => { if (!e) return; const r = (e as HTMLElement).getBoundingClientRect(); if (r.width < 1 || r.height < 1 || (e as HTMLElement).hidden) return; out.push({ x: r.left - o.x - pad, y: r.top - o.y - pad, w: r.width + 2 * pad, h: r.height + 2 * pad }); };
    for (const e of Array.from(this.env.root.querySelectorAll('.vh-top > *'))) add(e, 4);
    add(this.env.root.querySelector('.vh-dock'), 2);
    if (this.chapters.isOpen) add(this.chapters.el);
    return out;
  }
  /**
   * What a beat is about, as a box and the point the camera aims at. The card keeps off the box's picture; but a room, a lawn or a street is
   * too big to keep a card off, and a box the camera stands beside fills the whole window, so for those the subject is the pin zone: a
   * square round the aim point (about a quarter of the short side of the window), which is where the eye is sent.
   */
  private specOf(b: RuntimeBeat): Subject { return { box: b.frame.box, focus: b.frame.focus }; }
  /**
   * Where a box is in the window (px), through the camera `cam` as the window shows it: with the picture shifted up by `this.shift` px on a phone (see syncShift), the frame's rows are
   * the unshifted picture's from `shift` to `h + shift`, which reach past the unshifted frame at the bottom, so the box is projected onto a taller virtual frame (`h + 2 * shift`, the
   * same pixels per radian) first and the shift is taken off after, so a box that was cut by the bottom edge is whole. With no shift it is place.ts's focusRect.
   */
  private focus(cam: { eye: [number, number, number]; target: [number, number, number]; fov: number }, box: number[], w: number, h: number): Rect | null {
    const s = this.shift;
    if (!s) return focusRect(cam.eye, cam.target, cam.fov, box as any, w, h);
    const H = h + 2 * s, fov = 2 * Math.atan(Math.tan(cam.fov * Math.PI / 360) * H / h) * 180 / Math.PI;
    const r = focusRect(cam.eye, cam.target, fov, box as any, w, H);
    if (!r) return null;
    const y0 = Math.max(0, r.y - 2 * s), y1 = Math.min(h, r.y + r.h - 2 * s);
    return y1 > y0 ? { x: r.x, y: y0, w: r.w, h: y1 - y0 } : null;
  }
  /**
   * The picture is shifted up on a phone held upright (a camera view offset: the projection's principal point moves down by `shift` px, which is a shear and no distortion; the 3D
   * canvas only, in the player only, never the offline renderer's camera) so that what a beat is about stands in the room ABOVE the sheet and the sheet gets the room under it: the track
   * puts the subject at the middle of the window, which is where a sheet of 40 % goes, and a sheet that may not cover the subject was left a short box to scroll in. The start sheet gets the
   * same, so the house is in the upper half. Not while flying (free look is the camera's own), and `?no=shift` is the kill switch. Every rect the director solves with goes through `focus`.
   */
  private shiftFor(o: { w: number; h: number }): number {
    if (this.noShift || this.flying || !sheetLayout(o.w, o.h) || sidePhone(o.w, o.h)) return 0;
    return Math.round(o.h * PHONE_SHIFT);
  }
  private syncShift(): void {
    const o = this.rect();
    if (o.w < 50 || o.h < 50) return;
    const want = this.shiftFor(o), key = `${want}:${Math.round(o.w)}x${Math.round(o.h)}`;
    if (key === this.shiftKey) return;
    this.shiftKey = key;
    const cam = this.env.api.camera;
    if (want > 0) cam.setViewOffset(o.w, o.h, 0, want, o.w, o.h);
    else if (cam.view && cam.view.enabled) cam.clearViewOffset();
    cam.updateProjectionMatrix();
    this.shift = want;
    this.placedFor = '';                                      // the cards are solved again for the new framing
    try { this.env.control.seek(this.t); } catch { /* the player draws the next frame anyway */ }   // (a paused player draws a frame when it is asked to seek: the shift shows at once)
  }
  private subjectIn(cam: { eye: [number, number, number]; target: [number, number, number]; fov: number }, sp: Subject, w: number, h: number): Rect | null {
    const bx = sp.box, f = sp.focus;
    const wide = Math.max(bx[3] - bx[0], bx[5] - bx[2]) > 3.2 || bx[4] - bx[1] > 3.2;
    if (!wide) { const r = this.focus(cam, bx, w, h); if (r && (!f || r.w * r.h < 0.45 * w * h)) return r; if (!f) return r; }
    if (!f) return this.focus(cam, bx, w, h);
    const p = this.focus(cam, [f[0] - 0.03, f[1] - 0.03, f[2] - 0.03, f[0] + 0.03, f[1] + 0.03, f[2] + 0.03], w, h);
    if (!p) return null;
    const side = 0.24 * Math.min(w, h), cx = p.x + p.w / 2, cy = p.y + p.h / 2;
    const x0 = Math.max(0, cx - side / 2), y0 = Math.max(0, cy - side / 2), x1 = Math.min(w, cx + side / 2), y1 = Math.min(h, cy + side / 2);
    return x1 > x0 && y1 > y0 ? { x: x0, y: y0, w: x1 - x0, h: y1 - y0 } : null;
  }
  /**
   * Solve the card for the current beat against the beat's rest pose. Once per beat (and again when the window or the panels change).
   * A wide window gets a card of clamp(420 px, 32 vw, 560 px) (28 to 34 % of its width: a narrower and taller one, or one with tighter padding, when the full one would
   * cover the subject), as tall as its content needs up to the room between the top bar and the dock and scrolling inside beyond that, on the side the subject leaves free;
   * a phone, and a tablet held upright, gets a full-width sheet of up to 55 % of the height. Either way the type is the floor (portal/viewer.css --st-min: 1.5rem, 25.5 px, or
   * clamp(20px, 5.4vw, 25.5px) on a phone) and is never shrunk to fit: the solver is offered variants of the card and refuses one whose type is under it (place.ts).
   */
  private replace(): void {
    const i = this.beat; if (i < 0) return;
    const b = this.rs.beats[i], o = this.rect();
    if (o.w < 50) return;
    const key = `${b.id}:${Math.round(o.w)}x${Math.round(o.h)}:${this.chapters.isOpen ? 1 : 0}:${this.card.expanded ? 'more' : ''}`;
    if (key === this.placedFor) return;
    this.placedFor = key;
    const aspect = o.w / o.h, fr = trackFrameAt(this.rs.track, b.rest, aspect);
    const sub = this.specOf(b); this.subject = sub;
    const focus = this.subjectIn(fr, sub, o.w, o.h);
    const coreBox = this.rs.track.core;
    const core = coreBox && (b.chapter === this.rs.chapters[0].id) ? this.focus(fr, coreBox, o.w, o.h) : null;
    const bars = this.barRects();
    // a phone on its side takes the side panel (whatever its width: 740 px is the phone's type scale but not a layout for a sheet), a phone upright the sheet
    const side = sidePhone(o.w, o.h);
    const out: ReturnType<typeof placePopup> & { type: number } | SheetOut & { type: number } =!side && sheetLayout(o.w, o.h) ? this.placeSheetFor(o, focus, core, bars) : this.placePanelFor(o, focus, core, bars, side);
    this.card.put(out.rect, out.mode, 'where' in out ? (out as SheetOut).where : undefined);
    this.place_ = { rect: out.rect, mode: out.mode, subject: focus, ok: out.ok, overlapFocus: out.overlapFocus, slot: out.slot, variant: out.variant, scrolls: out.scrolls, type: out.type, refused: out.refused };
  }
  /** the room between the top bar and the dock: where a card or a panel may stand (px, relative to the player) */
  private roomFor(o: { w: number; h: number }, bars: Rect[]): { top: number; bottom: number } {
    // (the top bar's items only: a tall panel that starts high, the chapters drawer, is something the card keeps off, not the top of the room)
    const top = Math.max(12, bars.filter(x => x.y < o.h * 0.4 && x.h <= o.h * 0.25).reduce((m, x) => Math.max(m, x.y + x.h), 0) + 8);
    const dock = bars.filter(x => x.y > o.h * 0.5 && x.w >= o.w * 0.6).reduce((m, x) => Math.min(m, x.y), o.h - 12);
    return { top, bottom: dock - 8 };
  }
  /**
   * A wide window's card: the card at clamp(420 px, 32 vw, 560 px), then the same with tighter padding (padding may shrink, type may not), then a narrower one (90 and 80 % of
   * that width, never under 360 px) with each padding: the first that keeps off the subject and shows the most of itself wins, each as tall as its content up to the room above
   * the dock. The type is the same in all of them: a narrower card is a taller card, never a smaller one. A phone on its side (`side`) gets the same panel at most 45 % of the width
   * (never a sheet over the height of the scene), kept out of the notch's insets at both ends.
   */
  private placePanelFor(o: { w: number; h: number }, focus: Rect | null, core: Rect | null, bars: Rect[], side = false): ReturnType<typeof placePopup> & { type: number } {
    this.card.setMode('card'); this.card.setCompact(false);
    const ins = this.insets();
    const room = this.roomFor(o, bars), availH = Math.max(160, room.bottom - room.top);
    const cap = Math.floor(o.w * SIDE_PANEL_FRAC);
    const widths = side ? [cap, Math.round(cap * 0.9)].filter((w, k, a) => w >= 260 && a.indexOf(w) === k) : panelWidths(o.w);
    const specs = (widths.length ? widths : [cap]).flatMap((w, k) => [{ w, tight: false, cost: k * 0.4 }, { w, tight: true, cost: k * 0.4 + 0.1 }]);
    const variants: CardSize[] = specs.map(sp => { this.card.setTight(sp.tight); const m = this.card.measure(sp.w, availH); return { w: m.w, h: m.h, full: m.full, type: m.type, cost: sp.cost, tag: `${Math.round(sp.w / o.w * 100)}%${sp.tight ? ' tight' : ''}` }; });
    const out = placePopup({ vw: o.w, vh: o.h, focus, core, bars, card: variants[0], variants, floor: typeFloor(o.w), phone: false, gap: 18, safe: { top: room.top, right: 12 + ins.right, bottom: 12 + ins.bottom, left: 12 + ins.left } });
    this.card.setTight(specs[out.variant].tight);
    return { ...out, type: variants[out.variant].type ?? 0 };
  }
  /**
   * A phone's card (and a tablet held upright): a full-width sheet of at most 40 % of the height (sheet.ts, PHONE_SHEET_FRAC). It takes the room under the subject down to the dock, or the
   * room under the top bar, whichever shows more of the card, and scrolls inside beyond that; it never covers the subject, the Core or a bar. The ways to set it, tried in this order,
   * change the layout and never the type: the card with its phone drawing, without the drawing (the narration says what it shows, and the transcript keeps its rows), with the padding
   * and gaps tighter, and both. The sheet that shows the most of the card without covering anything wins (sheet.ts is place.ts's placeSheet with the owner's lower cap: that one is 55 %
   * and is the end card's). The sheet is then drawn as tall as its words (popup.ts put()), up to the height chosen here, which counted the agent's line that has not come yet.
   */
  private placeSheetFor(o: { w: number; h: number }, focus: Rect | null, core: Rect | null, bars: Rect[]): SheetOut & { type: number } {
    const ins = this.insets();
    const flags = [{ compact: false, tight: false }, { compact: true, tight: false }, { compact: false, tight: true }, { compact: true, tight: true }];
    const x = 8 + ins.left, width = o.w - 16 - ins.left - ins.right;
    this.card.setMode('sheet');
    const variants: SheetVariant[] = [];
    let type = 0;
    for (const f of flags) {
      this.card.setCompact(f.compact); this.card.setTight(f.tight);
      const m = this.card.measure(width, o.h * PHONE_SHEET_FRAC);
      variants.push({ full: m.full, type: m.type, tag: `${f.compact ? 'compact ' : ''}${f.tight ? 'tight' : ''}`.trim() || 'full' });
      if (!type || m.type < type) type = m.type;
    }
    const out = placePhoneSheet({ vw: o.w, vh: o.h, x, width, focus, core, bars, variants, floor: typeFloor(o.w) });
    const f = flags[out.variant]; this.card.setCompact(f.compact); this.card.setTight(f.tight);
    return { ...out, type: variants[out.variant].type ?? type };
  }

  /** the subject's rectangle through the camera as it is right now (px, relative to the player), or null when it is behind it */
  private liveSubject(sp: Subject | null = this.subject): Rect | null {
    if (!sp) return null;
    const a = this.env.api, cam = a.camera, o = this.rect();
    const eye: [number, number, number] = [cam.position.x, cam.position.y, cam.position.z];
    const d = cam.getWorldDirection(new a.THREE.Vector3());
    return this.subjectIn({ eye, target: [eye[0] + d.x, eye[1] + d.y, eye[2] + d.z], fov: cam.fov }, sp, o.w, o.h);
  }

  // ------------------------------------------------------------------ a beat begins
  private enterBeat(i: number): void {
    this.beat = i;
    const b = this.rs.beats[i];
    const ch = this.rs.chapters.find(c => c.id === b.chapter)!;
    const w = (id: string) => this.rs.audio?.[id];
    this.card.fill(this.rs, b, ch.title, { narration: w(b.id)?.words ?? null, say: w(`${b.id}.say`)?.words ?? null }, { narration: Math.max(1500, (b.sayAt ?? b.t1) * 1000 - b.speechAt * 1000), say: 3000 });
    this.placedFor = ''; this.replace();
    this.chapters.setCurrent(i);
    this.env.root.dataset.beat = b.id;
    this.announce(i);
    writeBeat(b.id);
    if (this.soundOn) { this.narrator?.prefetch(this.clipsFor(i, 3)); this.narrator?.warm(this.clipsFor(i, 2)); }
    this.prevClock = this.clock;
  }
  private announce(i: number): void { this.live.say(beatAnnouncement(this.rs, i)); }

  // ------------------------------------------------------------------ the frame loop
  private tick = (): void => {
    if (this.destroyed) return;
    this.raf = requestAnimationFrame(this.tick);
    this.ticks++;
    const root = this.env.root;
    if (root.dataset.state !== 'ready') { this.narrator?.pause(); this.audioPaused = true; return; }
    this.syncShift();
    if (!this.started) return;
    const rs = this.rs, T = this.T;
    let playing = this.playing;
    const flying = this.flying;

    // reduced motion: the player must not run by itself; a press of its play button speaks the beat instead
    if (this.stepMode && playing) { this.env.control.setPlaying(false); playing = false; this.speakBeat(); }

    const t = this.t, ended = !flying && !playing && t >= END_EPS && (!this.stepMode || this.endMode);
    if (ended !== this.endMode && !this.stepMode) this.endMode = ended;
    let bi: number;
    if (this.stepMode && this.stepBeat >= 0 && !this.scrubbed()) bi = this.stepBeat;          // stepping: the beat a person asked for
    else { bi = beatIndexAt(rs.beats, this.playerClock); if (this.stepMode) this.stepBeat = bi; }   // playing, or a drag of the timeline: wherever the player is
    if (this.endMode) bi = rs.beats.length - 1;
    if (bi !== this.beat) this.enterBeat(bi);

    // time inside the step clock
    if (this.stepMode && this.stepSpeaking && !this.endMode) {
      const dt = 1 / 60;
      this.stepClock += dt;
    }
    const clock = this.endMode ? T : this.clock;

    // a cut the tour makes by itself: take the picture just before, fade from it just after
    if (!this.stepMode && playing && !flying) this.cutWatch(clock);

    // ---- the voice
    this.audioTick(bi, clock, playing, flying);

    // ---- the card
    const b = rs.beats[bi];
    const showFrom = Math.min(b.popupAt, b.speechAt);
    const cardOn = !this.endMode && (this.stepMode ? true : clock >= showFrom && clock < b.t1 + 0.001);
    this.card.show(cardOn);
    if (cardOn) {
      const sayOn = !b.say ? false : this.stepMode && !this.soundOn ? true : b.sayAt !== null && clock >= b.sayAt;
      this.card.setSayVisible(sayOn);
      this.captions(b, clock);
      this.aimLeader();
    }
    // ---- the end card
    if (this.endMode && !this.end.visible) this.showEnd();
    if (!this.endMode && this.end.visible) this.end.show(false);
    if (this.endMode) this.endCaptions();

    // ---- the address bar keeps the beat the player may have dropped
    if (this.ticks % 30 === 0) { const cur = rs.beats[bi].id; if (beatInUrl() !== cur) writeBeat(cur); }
    this.lastPlaying = playing;
    this.prevClock = clock;
  };
  private scrubbed(): boolean { return this.live.scrubbing || this.env.root.querySelector('.vh-scrub input:active') !== null; }

  private cutWatch(clock: number): void {
    const cuts = this.rs.track.events.cuts || [];
    for (const c of cuts) {
      if (c > clock && c - clock < 0.2 && this.snapped !== c) { if (this.snapshot()) this.snapped = c; }
      else if (this.snapped === c && clock >= c && this.prevClock < c + 0.001) { this.showFade(); this.snapped = null; }
    }
    if (this.snapped !== null && clock > this.snapped + 0.5) this.snapped = null;
  }

  private audioTick(bi: number, clock: number, playing: boolean, flying: boolean): void {
    const n = this.narrator;
    if (!n || !n.created) return;
    const wantSound = this.soundOn && !flying;
    const running = this.stepMode ? this.stepSpeaking : playing;
    if (this.endMode) {
      // the closing line, once, over the end card
      if (this.soundOn && n.current !== 'closing' && this.pendingClip !== 'closing' && !this.closingDone) { this.pendingClip = 'closing'; void n.play('closing', 0).then(() => { this.pendingClip = ''; this.closingDone = true; }); }
      return;
    }
    if (!wantSound || !running) {
      if (!this.audioPaused) { n.pause(); this.audioPaused = true; }
      return;
    }
    if (this.audioPaused) { n.resume(); this.audioPaused = false; }
    const want = this.clipAt(bi, clock);
    if (!want) { if (n.current && this.stepMode === false && !this.stepSpeaking) { /* let a clip finish on its own */ } return; }
    if (n.current === want.id) {
      const pos = n.position();
      if (pos !== null && !this.stepMode) {
        const drift = (want.start + pos) - clock;
        if (Math.abs(drift) > DRIFT_S && Math.abs(drift) < 2) this.env.control.seek(Math.max(0, Math.min(1, (want.start + pos) / this.T)));
      }
      return;
    }
    if (this.pendingClip === want.id || n.hasFailed(want.id)) return;
    this.pendingClip = want.id;
    void n.play(want.id, Math.max(0, clock - want.start)).then(() => { if (this.pendingClip === want.id) this.pendingClip = ''; });
  }
  private closingDone = false;

  private captions(b: RuntimeBeat, clock: number): void {
    const n = this.narrator, audible = !!n && n.running && this.soundOn && !this.audioPaused;
    const cur = n ? n.current : null;
    const pos = n ? n.position() : null;
    // the voice is the clock while it sounds; otherwise nothing is spoken for this line and the text stays plain
    this.card.setNarration(audible && cur === b.id && pos !== null ? pos * 1000 : null);
    this.card.setSay(audible && cur === `${b.id}.say` && pos !== null ? pos * 1000 : null);
    // a phone's sheet taller than its room scrolls to the end of its words over the beat's time (a voice, when there is one, is followed word by word instead)
    if (!this.stepMode && !(audible && (cur === b.id || cur === `${b.id}.say`))) this.card.follow((clock - b.speechAt) / Math.max(1, b.t1 - b.speechAt));
  }
  private endCaptions(): void {
    const n = this.narrator, pos = n ? n.position() : null;
    this.end.setNarration(n && n.running && this.soundOn && n.current === 'closing' && pos !== null ? pos * 1000 : null);
  }

  /** keep the leader on the thing the card is about (it starts from the card's LIVE box, which popup.ts may have trimmed narrower than the solved rect) */
  private aimLeader(): void {
    const p = this.place_; if (!p || !this.card.visible) return;
    const live = this.liveSubject();
    if (!live) { this.card.aim(null, null, p.mode); return; }
    if (p.mode === 'card') this.card.aim(leaderTo(this.card.box, live), null, 'card');
    else this.card.aim(null, [live.x + live.w / 2, live.y + live.h / 2], 'sheet');
  }

  private showEnd(): void {
    const o = this.rect(), bars = this.barRects(), room = this.roomFor(o, bars);
    const fr = trackFrameAt(this.rs.track, this.T, o.w / o.h);
    const core = this.rs.track.core ? this.focus(fr, this.rs.track.core, o.w, o.h) : null;
    let r: Rect;
    const side = sidePhone(o.w, o.h), sheet = !side && sheetLayout(o.w, o.h), ins = this.insets();
    this.end.el.dataset.mode = sheet ? 'sheet' : 'card';
    this.end.setSide(side);          // (on its side the call to action is a bar that sticks to the panel's bottom edge: popup.ts EndCard.setSide)
    if (sheet) {
      // a phone: a sheet above the dock, up to 55 % of the height, scrolling inside beyond that, in the room the Core leaves (as a beat's sheet takes the room under or over its subject:
      // the end frame's camera composes the Core for a smaller sheet, so a taller one goes under the Core or over it, never on it; tighter padding before a scroll)
      const width = o.w - 16, cap = o.h * SHEET_MAX_FRAC;
      const flags = [false, true], variants: SheetVariant[] = flags.map(tight => { this.end.setTight(tight); const m = this.end.measure(width, cap); return { full: m.full, type: m.type, tag: tight ? 'tight' : 'full' }; });
      const placed = placeSheet({ vw: o.w, vh: o.h, focus: core, core: null, bars, variants, floor: typeFloor(o.w) });
      this.end.setTight(flags[placed.variant]);
      r = placed.rect;
    } else {
      // a wide window, or a phone on its side (the same panel, at most 45 % of the width): the end card is a panel like the beat's, at the width that keeps it off the Core
      const availH = Math.max(160, room.bottom - room.top), cap = Math.floor(o.w * SIDE_PANEL_FRAC);
      const widths = side ? [cap, Math.round(cap * 0.9)].filter((w, k, a) => w >= 260 && a.indexOf(w) === k) : panelWidths(o.w);
      // (the end card says more than a beat's card: the width as wanted, then the same with tighter padding, then narrower and taller; the type is the same in all of them)
      const specs = (widths.length ? widths : [cap]).flatMap((w, k) => [{ w, tight: false, cost: k * 0.3 }, { w, tight: true, cost: k * 0.3 + 0.05 }]);
      const variants: CardSize[] = specs.map(sp => { this.end.setTight(sp.tight); const m = this.end.measure(sp.w, availH); return { w: m.w, h: m.h, full: m.full, type: m.type, cost: sp.cost }; });
      const placed = placeEndCard({ vw: o.w, vh: o.h, card: variants[0], variants, floor: typeFloor(o.w), core, bars, safe: { top: room.top, right: 12 + ins.right, bottom: Math.max(12 + ins.bottom, o.h - room.bottom), left: 12 + ins.left } });
      this.end.setTight(specs[placed.variant].tight);
      r = placed.rect;
    }
    this.end.put(r, sheet ? 'sheet' : 'card');
    this.end.show(true);
    this.closingDone = false;
    this.card.show(false);
    const first = this.end.el.querySelector<HTMLElement>('a, button');
    // (focus is not moved: the end card appears when the tour finishes, not when the person asked for it)
    void first;
    this.live.say('Meet the Companion Core. This family is fictional. The software is real.', 100);
  }

  // ------------------------------------------------------------------ for tests and the console
  api() {
    const self = this;
    return {
      get state() { return { started: self.started, beat: self.beat, sound: self.soundOn, audioCreated: !!self.narrator?.created, audioRunning: !!self.narrator?.running, speaking: self.narrator?.current ?? null, end: self.endMode, step: self.stepMode, chaptersOpen: self.chapters.isOpen, clips: self.narrator ? Object.keys((self.rs.audio || {})).length : 0 }; },
      rs: self.rs,
      /** Put the tour at a beat's rest pose, paused, and report where the card went and what it covers (px, relative to the player). */
      async measure(i: number) {
        self.env.control.setPlaying(false);
        self.env.control.seek(self.rs.beats[i].rest / self.T);
        for (let k = 0; k < 4; k++) await new Promise(r => requestAnimationFrame(r));
        const card = self.card.el.getBoundingClientRect(), o = self.rect();
        const live = self.liveSubject();
        const inter = (a: Rect, b: Rect) => Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)) * Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
        const c: Rect = { x: card.left - o.x, y: card.top - o.y, w: card.width, h: card.height };
        const bars = self.barRects().map(r => inter(c, r));
        // (`card` is the box as drawn, trimmed to its widest line; `solvedW` the width the solver chose, which the trim never exceeds)
        return { beat: self.beat, expanded: self.card.expanded, hasMore: self.card.hasMore, mode: self.place_?.mode, card: c, solvedW: Number(self.card.el.dataset.solvedW) || null, live, vw: o.w, vh: o.h, visible: self.card.visible, hidden: self.card.el.hidden, overlapLive: live ? inter(c, live) / Math.max(1, live.w * live.h) : 0, overlapBars: bars.reduce((a, b) => a + b, 0), planned: self.place_ ? { ok: self.place_.ok, overlapFocus: self.place_.overlapFocus, slot: self.place_.slot, variant: self.place_.variant, scrolls: self.place_.scrolls, type: self.place_.type, refused: self.place_.refused } : null };
      },
      /** Go to the end card (paused), and report where it sits and how much of the Core, as the camera sees it now, it covers. */
      async measureEnd() {
        self.finish();
        for (let k = 0; k < 6; k++) await new Promise(r => requestAnimationFrame(r));
        const card = self.end.el.getBoundingClientRect(), o = self.rect();
        const core = self.liveSubject({ box: self.rs.track.core as any, focus: null });
        const c: Rect = { x: card.left - o.x, y: card.top - o.y, w: card.width, h: card.height };
        const x = Math.max(0, Math.min(c.x + c.w, core ? core.x + core.w : 0) - Math.max(c.x, core ? core.x : 0)), y = Math.max(0, Math.min(c.y + c.h, core ? core.y + core.h : 0) - Math.max(c.y, core ? core.y : 0));
        return { visible: self.end.visible, card: c, solvedW: Number(self.end.el.dataset.solvedW) || null, core, vw: o.w, vh: o.h, overlapCore: core ? (x * y) / Math.max(1, core.w * core.h) : 0, bars: self.barRects().reduce((a, r) => a + Math.max(0, Math.min(c.x + c.w, r.x + r.w) - Math.max(c.x, r.x)) * Math.max(0, Math.min(c.y + c.h, r.y + r.h) - Math.max(c.y, r.y)), 0) };
      },
      goBeat: (i: number) => self.goBeat(i),
      /** the card's follow-scroll at `frac` of the beat (0 to 1), and where the card's scroll is after it (phone.mts: a sheet follows the beat's time down its words) */
      follow(frac: number) { self.card.follow(frac); return self.card.el.scrollTop; },
      /** story v2: open or close the card's "More" and wait for the card to be placed again; false when the beat has none */
      async setMore(open: boolean) {
        if (!self.card.hasMore) return false;
        self.card.setMore(open);
        for (let k = 0; k < 4; k++) await new Promise(r => requestAnimationFrame(r));
        return true;
      },
      start: (c: StartChoice, at?: number) => self.begin(c, at),
    };
  }

  destroy(): void {
    this.destroyed = true;
    cancelAnimationFrame(this.raf);
    this.unbind();
    this.resizeObs?.disconnect();
    clearTimeout(this.resizeTimer); clearTimeout(this.fadeTimer);
    this.narrator?.destroy();
    this.card.destroy(); this.end.destroy(); this.chapters.destroy(); this.live.destroy(); this.start?.destroy();
    // (the picture is the player's again: no shift)
    try { const cam = this.env.api.camera; if (cam.view && cam.view.enabled) { cam.clearViewOffset(); cam.updateProjectionMatrix(); } } catch { /* gone */ }
    this.host.remove();
    this.btnChapters.previousElementSibling && void 0;
    for (const e of Array.from(this.env.root.querySelectorAll('.st-btn-chapters, .st-btn-sound, .st-tick'))) e.remove();
    delete this.env.root.dataset.story; delete this.env.root.dataset.started; delete this.env.root.dataset.beat; delete this.env.root.dataset.sound; delete this.env.root.dataset.chapters;
  }
}
