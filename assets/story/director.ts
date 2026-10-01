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
import { focusRect, placePopup, placeEndCard, leaderTo, inter, PHONE_MAX_WIDTH, type Rect } from './place.js';
import { camera as probeCamera, projectBox } from '../shot-probe.js';
import { Narrator } from './audio.js';
import { BeatCard, StartCard, EndCard, el, type StartChoice } from './popup.js';
import { Chapters } from './chapters.js';
import { Announcer, beatAnnouncement, labelCanvas, focusEl } from './a11y.js';
import { bindKeys } from './keys.js';
import { writeBeat, beatInUrl, familyPageUrl, beatFromQuery } from './url.js';

export type Control = {
  seek(t: number): void; setPlaying(on: boolean): void; selectShot(s: any, o?: any): void;
  toast(msg: string, ms?: number): void; enterFly(o?: any): void; exitFly(): void;
};
export type Env = {
  api: any; stats: any; root: HTMLElement; rs: RuntimeStory; control: Control; slug: string;
  reduced: boolean; hasNext: boolean; audioBase: string;
};

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
  private endMode = false;
  private place_: { rect: Rect; mode: 'card' | 'sheet'; subject: Rect | null; ok: boolean; overlapFocus: number } | null = null;
  private placedFor = '';
  private subjectBox: number[] | null = null;
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

    // the narrator: every recorded clip, by its URL (relative to the page, which is at the site root)
    const clips: Record<string, { url: string; durationMs: number }> = {};
    for (const [id, c] of Object.entries(rs.audio || {})) clips[id] = { url: new URL(c.file, location.href).href, durationMs: c.durationMs };
    this.narrator = Object.keys(clips).length ? new Narrator(clips) : null;
    if (this.narrator) {
      this.narrator.onFail = () => { if (!this.failToast) { this.failToast = true; env.control.toast('Narration could not load. Captions are on.', 4200); } };
      // (no clip is fetched until a person chooses sound: "Start without sound" costs no audio bytes at all)
    }

    this.card = new BeatCard(host);
    const endTimings = rs.audio?.closing;
    this.end = new EndCard(host, rs, {
      timings: endTimings ? endTimings.words : null, durMs: endTimings ? endTimings.durationMs : 9000, hasNext: env.hasNext,
      onReplay: () => this.replay(), onNext: () => this.nextFamily(), onShare: () => this.share(),
    });
    this.chapters = new Chapters(host, rs, { beat: i => this.userGoBeat(i), chapter: i => this.userGoChapter(i) }, open => this.onChapters(open));
    this.live = new Announcer(host);
    this.fade = el('canvas', 'st-fade') as HTMLCanvasElement;
    this.fade.setAttribute('aria-hidden', 'true');
    host.append(this.fade);

    this.mountChrome();
    labelCanvas(env.api.canvas, rs.family.surname);

    // where a shared link points: ?beat=<id|n>, else ?t= (the player seeks to it itself; the card names the moment)
    const q = new URLSearchParams(location.search);
    let at = beatFromQuery(q, rs.beats);
    if (at < 0 && Number(env.stats.t) > 0.001) at = beatIndexAt(rs.beats, env.stats.t * this.T);
    this.initial = at;
    if (at >= 0) env.control.seek(rs.beats[at].rest / this.T);
    env.control.setPlaying(false);

    this.start = new StartCard(host, rs, {
      shared: at >= 0 ? rs.beats[at] : null, audio: !!this.narrator,
      onChoose: c => this.begin(c),
    });
    this.start.focus();
    this.unbind = bindKeys({
      startCardOpen: () => !!this.start, startFromKey: () => this.begin(this.narrator ? 'sound' : 'silent'),
      togglePlay: () => this.togglePlay(), step: (d, ch) => this.step(d, ch), toggleMute: () => this.toggleSound(),
      chapter: n => this.userGoChapter(n), toggleChapters: () => this.chapters.toggle(this.btnChapters, true),
      chaptersOpen: () => this.chapters.isOpen, closeChapters: () => this.chapters.close(true),
      helpOpen: () => { const h = env.root.querySelector<HTMLElement>('.vh-help'); return !!h && !h.hidden; },
      flying: () => this.flying, leaveFreeLook: () => this.leaveFreeLook(),
    });
    this.resizeObs = new ResizeObserver(() => { clearTimeout(this.resizeTimer); this.resizeTimer = window.setTimeout(() => { this.placedFor = ''; this.replace(); }, 120); });
    this.resizeObs.observe(root);
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
  private onChapters(open: boolean): void {
    this.btnChapters.setAttribute('aria-expanded', String(open));
    this.env.root.dataset.chapters = open ? '1' : '0';
    this.placedFor = ''; this.replace();
  }

  // ------------------------------------------------------------------ starting
  /** The first gesture. Narration is only ever turned on from here, from M, or from the sound button: each is a click or a key press. */
  private begin(choice: StartChoice): void {
    if (this.started) return;
    this.started = true;
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
    this.beat = -1;
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
  private nextFamily(): void { this.env.root.querySelector<HTMLElement>('[data-act="next"]')?.click(); }
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
  private subjectOf(b: RuntimeBeat): number[] {
    // A subject is the thing a beat is about. A room, a lawn or a street is too big to keep a card off, so for those it is the
    // part of it the camera aims at (about 1.8 m round the aim point).
    const bx = b.frame.box, f = b.frame.focus;
    if (Math.max(bx[3] - bx[0], bx[5] - bx[2]) > 3.2 || bx[4] - bx[1] > 3.2) return [f[0] - 0.9, f[1] - 0.8, f[2] - 0.9, f[0] + 0.9, f[1] + 0.9, f[2] + 0.9];
    return bx;
  }
  /** Solve the card for the current beat against the beat's rest pose. Once per beat (and again when the window or the panels change). */
  private replace(): void {
    const i = this.beat; if (i < 0) return;
    const b = this.rs.beats[i], o = this.rect();
    if (o.w < 50) return;
    const key = `${b.id}:${Math.round(o.w)}x${Math.round(o.h)}:${this.chapters.isOpen ? 1 : 0}`;
    if (key === this.placedFor) return;
    this.placedFor = key;
    const aspect = o.w / o.h, fr = trackFrameAt(this.rs.track, b.rest, aspect);
    const sub = this.subjectOf(b); this.subjectBox = sub;
    const focus = focusRect(fr.eye, fr.target, fr.fov, sub as any, o.w, o.h);
    const coreBox = this.rs.track.core;
    const core = coreBox && (b.chapter === this.rs.chapters[0].id) ? focusRect(fr.eye, fr.target, fr.fov, coreBox, o.w, o.h) : null;
    const phone = o.w <= PHONE_MAX_WIDTH;
    const width = phone ? o.w - 16 : o.w >= 1100 ? 360 : 320;
    const bars = this.barRects();
    const maxH = phone ? o.h * 0.38 : Math.max(120, o.h - 24);
    let out: ReturnType<typeof placePopup>;
    if (phone) out = this.placeSheet(o, focus, core, bars, width, maxH);
    else {
      this.card.setCompact(false);
      out = placePopup({ vw: o.w, vh: o.h, focus, core, bars, card: this.card.measure(width, maxH), phone: false, safe: { top: 12, right: 12, bottom: 12, left: 12 } });
    }
    this.card.put(out.rect, out.mode);
    this.place_ = { rect: out.rect, mode: out.mode, subject: focus, ok: out.ok, overlapFocus: out.overlapFocus };
  }

  /**
   * A phone's card is a sheet. place.ts puts it above the dock; when that covers the subject (a close shot of the Core sits low in a tall frame)
   * there are three more things to try, in this order: the same sheet under the top bar, then the card without its phone drawing (the
   * narration says what the drawing shows, and the transcript keeps its rows) at the bottom and at the top. The first that clears the
   * subject, the Core and the bars wins; if none does the least bad is used (and `ok` says so, which the placement test reports).
   */
  private placeSheet(o: { w: number; h: number }, focus: Rect | null, core: Rect | null, bars: Rect[], width: number, maxH: number): ReturnType<typeof placePopup> {
    const topEdge = bars.filter(b => b.y < o.h * 0.4).reduce((m, b) => Math.max(m, b.y + b.h), 0) + 8;
    const area = (r: Rect) => Math.max(1, r.w * r.h);
    let best: ReturnType<typeof placePopup> | null = null, bestCompact = false, bestCost = Infinity;
    for (const compact of [false, true]) {
      this.card.setCompact(compact);
      const size = this.card.measure(width, maxH);
      const bottom = placePopup({ vw: o.w, vh: o.h, focus, core, bars, card: size, phone: true, safe: { top: 12, right: 12, bottom: 12, left: 12 } });
      const h = Math.min(size.h, o.h * 0.38);
      const rt: Rect = { x: bottom.rect.x, y: topEdge, w: bottom.rect.w, h };
      const top = (() => {
        const fo = focus ? inter(rt, focus) / area(focus) : 0, co = core ? inter(rt, core) / area(core) : 0, bo = bars.reduce((a, b) => a + inter(rt, b), 0);
        return { ...bottom, rect: rt, overlapFocus: fo, overlapCore: co, overlapBars: bo / area(rt), ok: fo < 0.02 && co < 0.02 && bo === 0 } as ReturnType<typeof placePopup>;
      })();
      for (const c of [bottom, top]) {
        if (c.ok) { this.card.setCompact(compact); return c; }
        const cost = c.overlapFocus + c.overlapCore + c.overlapBars * 10 + (compact ? 0.001 : 0);
        if (cost < bestCost) { best = c; bestCompact = compact; bestCost = cost; }
      }
    }
    this.card.setCompact(bestCompact);
    return best!;
  }

  /** the subject's rectangle through the camera as it is right now (px, relative to the player), or null when it is behind it */
  private liveSubject(box: number[] | null = this.subjectBox): Rect | null {
    const sub = box; if (!sub) return null;
    const a = this.env.api, cam = a.camera, o = this.rect();
    const eye: [number, number, number] = [cam.position.x, cam.position.y, cam.position.z];
    const d = cam.getWorldDirection(new a.THREE.Vector3());
    const pb = projectBox(probeCamera(eye, [eye[0] + d.x, eye[1] + d.y, eye[2] + d.z], cam.fov, o.w / o.h), sub as any);
    if (!pb) return null;
    const x0 = (pb.minX + 1) / 2 * o.w, x1 = (pb.maxX + 1) / 2 * o.w, y0 = (1 - pb.maxY) / 2 * o.h, y1 = (1 - pb.minY) / 2 * o.h;
    const r = { x: Math.max(0, x0), y: Math.max(0, y0), w: Math.min(o.w, x1) - Math.max(0, x0), h: Math.min(o.h, y1) - Math.max(0, y0) };
    return r.w > 0 && r.h > 0 ? r : null;
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
    if (!this.started) return;
    const rs = this.rs, T = this.T;
    let playing = this.playing;
    const flying = this.flying;

    // reduced motion: the player must not run by itself; a press of its play button speaks the beat instead
    if (this.stepMode && playing) { this.env.control.setPlaying(false); playing = false; this.speakBeat(); }

    const t = this.t, ended = !flying && !playing && t >= END_EPS && (!this.stepMode || this.endMode);
    if (ended !== this.endMode && !this.stepMode) this.endMode = ended;
    let bi = this.stepMode && this.beat >= 0 && !this.scrubbed() ? this.beat : beatIndexAt(rs.beats, this.playerClock);
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
  }
  private endCaptions(): void {
    const n = this.narrator, pos = n ? n.position() : null;
    this.end.setNarration(n && n.running && this.soundOn && n.current === 'closing' && pos !== null ? pos * 1000 : null);
  }

  /** keep the leader on the thing the card is about */
  private aimLeader(): void {
    const p = this.place_; if (!p || !this.card.visible) return;
    const live = this.liveSubject();
    if (!live) { this.card.aim(null, null, p.mode); return; }
    if (p.mode === 'card') this.card.aim(leaderTo(p.rect, live), null, 'card');
    else this.card.aim(null, [live.x + live.w / 2, live.y + live.h / 2], 'sheet');
  }

  private showEnd(): void {
    const o = this.rect(), phone = o.w <= PHONE_MAX_WIDTH;
    const width = phone ? o.w - 16 : Math.min(460, o.w - 24);
    const size = this.end.measure(width);
    const fr = trackFrameAt(this.rs.track, this.T, o.w / o.h);
    const core = this.rs.track.core ? focusRect(fr.eye, fr.target, fr.fov, this.rs.track.core, o.w, o.h) : null;
    const bars = this.barRects();
    const r = phone
      ? { x: 8, y: Math.max(60, Math.min(...bars.filter(x => x.y > o.h * 0.5).map(x => x.y), o.h - 8) - size.h - 8), w: width, h: size.h }
      : placeEndCard({ vw: o.w, vh: o.h, card: size, core, bars }).rect;
    this.end.put({ ...r, w: width, h: size.h });
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
        return { beat: self.beat, mode: self.place_?.mode, card: c, live, vw: o.w, vh: o.h, visible: self.card.visible, hidden: self.card.el.hidden, overlapLive: live ? inter(c, live) / Math.max(1, live.w * live.h) : 0, overlapBars: bars.reduce((a, b) => a + b, 0), planned: self.place_ ? { ok: self.place_.ok, overlapFocus: self.place_.overlapFocus } : null };
      },
      /** Go to the end card (paused), and report where it sits and how much of the Core, as the camera sees it now, it covers. */
      async measureEnd() {
        self.finish();
        for (let k = 0; k < 6; k++) await new Promise(r => requestAnimationFrame(r));
        const card = self.end.el.getBoundingClientRect(), o = self.rect();
        const core = self.liveSubject(self.rs.track.core as any);
        const c: Rect = { x: card.left - o.x, y: card.top - o.y, w: card.width, h: card.height };
        const x = Math.max(0, Math.min(c.x + c.w, core ? core.x + core.w : 0) - Math.max(c.x, core ? core.x : 0)), y = Math.max(0, Math.min(c.y + c.h, core ? core.y + core.h : 0) - Math.max(c.y, core ? core.y : 0));
        return { visible: self.end.visible, card: c, core, vw: o.w, vh: o.h, overlapCore: core ? (x * y) / Math.max(1, core.w * core.h) : 0, bars: self.barRects().reduce((a, r) => a + Math.max(0, Math.min(c.x + c.w, r.x + r.w) - Math.max(c.x, r.x)) * Math.max(0, Math.min(c.y + c.h, r.y + r.h) - Math.max(c.y, r.y)), 0) };
      },
      goBeat: (i: number) => self.goBeat(i),
      start: (c: StartChoice) => self.begin(c),
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
    this.host.remove();
    this.btnChapters.previousElementSibling && void 0;
    for (const e of Array.from(this.env.root.querySelectorAll('.st-btn-chapters, .st-btn-sound, .st-tick'))) e.remove();
    delete this.env.root.dataset.story; delete this.env.root.dataset.started; delete this.env.root.dataset.beat; delete this.env.root.dataset.sound; delete this.env.root.dataset.chapters;
  }
}
