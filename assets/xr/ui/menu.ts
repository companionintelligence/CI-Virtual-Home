// assets/xr/ui/menu.ts : the menu a person opens in a headset, and the small dock that opens it.
//
// There is no DOM in a headset, so everything the 2D player's top bar offers is here, five rows to a page (more is a list the person has to
// search with a ray): the places to go (XrLocomotion.places()), the time of day, posture and height, display and comfort, and, while a tour
// plays, the tour (chapters, pause, sound, auto-advance). Exit VR is always one press from the first page.
//
// It is a world panel, not a wrist menu: it opens 1.0 m ahead on the side away from the pointing hand and stays where it opened (the person can
// lean in; a step away closes it). Controllers have an easy way to summon it (the secondary face button), and the dock, a small "Menu" pill low
// on the left of the view, is the way that exists on every device, including visionOS where there are no controllers at all.
import type { XrFrame } from '../host.js';
import type { ChapterView, PlaybackModel, PresenterEvent, V3 } from '../presenter.js';
import { XR_LEGIBILITY } from '../presenter.js';
import { across, button, row, segment, stack, toggle } from './button.js';
import { followStep, lockedPose, newFollow, type FollowState } from './caption.js';
import type { UiKit, UiSettings } from './kit.js';
import { execOps, fontOf, panelBackOp, type Layout, type Metrics, type Op, type Widget } from './paint.js';
import type { XrPanel } from './panel.js';

export interface TourBridge {
  chapters(): ChapterView[];
  model(): PlaybackModel | null;
  emit(e: PresenterEvent): void;
}
type Spec = Parameters<typeof stack>[0][number];
type Entry = { spec: Spec } | { label: string; specs: Spec[] };

const MENU_DIST = XR_LEGIBILITY.distance.menu, MENU_WIDTH_DEG = 34, ROWS = 5;
const CLOSE_STEP_M = 2.2;
const TOD_LABEL: Record<string, string> = { day: 'Day', golden: 'Golden hour', dusk: 'Dusk', night: 'Night' };
const KIND_LABEL: Record<string, string> = { room: 'Room', 'stairs-up': 'Stairs up', 'stairs-down': 'Stairs down', entry: 'Entrance', core: 'The Core' };
const pct = (n: number) => `${Math.round(n * 100)}%`;

interface PageDef { title: string; subtitle?: string; entries: Entry[]; back: string | null; footer: Spec[] }

export class Menu {
  readonly panel: XrPanel;
  readonly dock: Dock;
  private isOpen = false; private page = 'root'; private sub = 0;
  private tour: TourBridge | null = null;
  private subs = new Set<(open: boolean) => void>();
  private openedAt: V3 | null = null;
  private offRelayout: () => void; private offSettings: () => void;
  /** every activation, for the test and for debugging a headset session */
  readonly activations: string[] = [];

  constructor(private kit: UiKit) {
    this.panel = kit.panels.create({ name: 'menu', world: false, interactive: true, renderOrder: 1150 });
    this.panel.activate = (w) => this.activate(w.id);
    this.dock = new Dock(kit, () => this.toggle());
    this.offRelayout = kit.onRelayout(() => { if (this.isOpen) this.draw(); });
    this.offSettings = kit.settings.on(() => { if (this.isOpen) this.draw(); });
  }
  get open(): boolean { return this.isOpen; }
  onChange(cb: (open: boolean) => void): () => void { this.subs.add(cb); return () => { this.subs.delete(cb); }; }
  bindTour(t: TourBridge | null): void { this.tour = t; if (this.isOpen) this.draw(); }
  /** the tour's model changed (play/pause, mute): redraw the menu if it is showing them */
  refresh(): void { if (this.isOpen) this.draw(); }

  toggle(): void { if (this.isOpen) this.hide(); else this.show(); }
  show(page = 'root'): void {
    const h = this.kit.head();
    this.page = page; this.sub = 0;
    this.draw();
    const side = this.kit.settings.get().handedness === 'right' ? -1 : 1;   // away from the pointing hand
    const p = lockedPose(h.pos, h.yawDeg, side * 12, -6, MENU_DIST);
    this.panel.setPose(p.centre, p.yaw, p.tiltDeg);
    this.openedAt = h.pos.slice() as V3;
    this.isOpen = true; this.panel.show(0.15); this.dock.panel.hide(0.1);
    for (const cb of this.subs) cb(true);
  }
  hide(): void {
    if (!this.isOpen) return;
    this.isOpen = false; this.panel.hide(0.12); this.dock.panel.show(0.2); this.dock.wake();
    for (const cb of this.subs) cb(false);
  }

  // ------------------------------------------------------------------------------------------------------------------ the pages
  private places() { try { return this.kit.loco ? this.kit.loco.places() : []; } catch { return []; } }
  private tod(): { keys: string[]; cur: string } | null {
    const a = this.kit.host.api; if (!a || !a.TIME_OF_DAY) return null;
    let cur = ''; try { cur = a.lighting?.() ?? ''; } catch { /* unknown */ }
    return { keys: Object.keys(a.TIME_OF_DAY), cur };
  }
  private build(): PageDef {
    const s = this.kit.settings.get(), page = this.page;
    const paged = (items: Spec[], title: string, back: string, subtitle?: string): PageDef => {
      const pages = Math.max(1, Math.ceil(items.length / ROWS)); this.sub = Math.min(this.sub, pages - 1);
      const entries: Entry[] = items.slice(this.sub * ROWS, this.sub * ROWS + ROWS).map(spec => ({ spec }));
      const footer: Spec[] = [];
      if (pages > 1) footer.push(button('pg:prev', 'Earlier', { icon: 'up', enabled: this.sub > 0 }), button('pg:next', 'More', { icon: 'down', enabled: this.sub < pages - 1 }));
      return { title, subtitle: pages > 1 ? `${subtitle ? subtitle + ' · ' : ''}Page ${this.sub + 1} of ${pages}` : subtitle, entries, back, footer };
    };
    if (page === 'places') {
      const ps = this.places();
      return paged(ps.length ? ps.map(p => row('place:' + p.id, p.label, KIND_LABEL[p.kind] || '', 'next')) : [row('none', 'No places yet', '', undefined, { enabled: false })], 'Places', 'root');
    }
    if (page === 'tod') {
      const t = this.tod();
      return paged((t ? t.keys : []).map(k => segment('tod:' + k, TOD_LABEL[k] || this.kit.host.api.TIME_OF_DAY[k]?.label || k, k === t!.cur, { kind: 'segment' })), 'Time of day', 'root');
    }
    if (page === 'posture') {
      return {
        title: 'Posture and height', subtitle: `Eye height ${s.heightCm >= 0 ? '+' : ''}${s.heightCm} cm`, back: 'root', footer: [],
        entries: [
          { spec: toggle('set:seated', 'Seated', s.posture === 'seated') },
          { label: 'Height', specs: [button('height:down', 'Lower', { icon: 'down', enabled: s.heightCm > -60 }), button('height:up', 'Higher', { icon: 'up', enabled: s.heightCm < 60 })] },
          { spec: button('height:reset', 'Reset height', { enabled: s.heightCm !== 0 }) },
        ],
      };
    }
    if (page === 'display') {
      return {
        title: 'Display and comfort', back: 'root', footer: [],
        entries: [
          { label: 'Text size', specs: ([1, 1.25, 1.5] as const).map(v => segment('text:' + v, pct(v), s.textScale === v)) },
          { spec: toggle('set:contrast', 'High contrast', s.contrast === 'high') },
          { label: 'Pointing hand', specs: [segment('hand:left', 'Left', s.handedness === 'left'), segment('hand:right', 'Right', s.handedness === 'right')] },
          { label: 'Snap turn', specs: ([15, 30, 45] as const).map(v => segment('snap:' + v, `${v}°`, s.snapTurnDeg === v)) },
          { spec: toggle('set:vignette', 'Comfort vignette', s.vignette) },
        ],
      };
    }
    if (page === 'tour' && this.tour) {
      const m = this.tour.model();
      return {
        title: 'Tour', subtitle: m ? `Stop ${m.beatIndex + 1} of ${m.beatCount}` : undefined, back: 'root', footer: [],
        entries: [
          { spec: row('page:chapters', 'Chapters', m ? `${m.chapterIndex + 1} of ${this.tour.chapters().length}` : '', 'next') },
          { spec: toggle('tour:play', 'Tour playing', !!m?.playing) },
          { spec: toggle('tour:sound', 'Sound', !!m && !m.muted, { enabled: !!m?.hasAudio && !m?.audioFailed }) },
          { spec: toggle('tour:auto', 'Move on by itself', s.autoAdvance === 'guided') },
        ],
      };
    }
    if (page === 'chapters' && this.tour) {
      const m = this.tour.model();
      return paged(this.tour.chapters().map(c => row('chapter:' + c.id, c.title, m && c.index === m.chapterIndex ? 'Now' : '', 'next')), 'Chapters', 'tour');
    }
    // root
    const m = this.tour?.model() || null, ps = this.places(), t = this.tod();
    const rows: Spec[] = [];
    if (this.tour) rows.push(row('page:tour', 'Tour', m ? `Stop ${m.beatIndex + 1} of ${m.beatCount}` : '', 'next'));
    rows.push(row('page:places', 'Places', ps.length ? `${ps.length}` : '', 'next', { enabled: ps.length > 0 }));
    rows.push(row('page:tod', 'Time of day', t ? (TOD_LABEL[t.cur] || t.cur) : '', 'next', { enabled: !!t }));
    rows.push(row('page:posture', 'Posture and height', s.posture === 'seated' ? 'Seated' : 'Standing', 'next'));
    rows.push(row('page:display', 'Display and comfort', `Text ${pct(s.textScale)}`, 'next'));
    return { title: 'Menu', entries: rows.slice(0, ROWS).map(spec => ({ spec })), back: null, footer: [button('exit', 'Exit VR', { icon: 'exit' }), button('close', 'Close', { primary: true, icon: 'close' })] };
  }

  private layout(def: PageDef, m: Metrics, W: number): Layout {
    const t = m.theme, pad = m.padPx, cw = W - 2 * pad, back = panelBackOp(W, m);
    const ops: Op[] = [back]; const widgets: Widget[] = []; const texts: string[] = [];
    let y = pad;
    const emT = m.px('title'), emS = m.px('small');
    // header: a back button or nothing, the title, a close button
    const hb = m.targetPx;
    if (def.back) widgets.push({ id: 'back:' + def.back, kind: 'button', label: '', x: pad, y, w: hb, h: hb, enabled: true, icon: 'back' });
    ops.push({ k: 'text', x: pad + (def.back ? hb + m.gapPx : 0), y: y + hb / 2 + emT * 0.34, s: def.title, font: fontOf(emT, 800), fill: t.text }); texts.push(def.title);
    widgets.push({ id: 'close', kind: 'button', label: '', x: W - pad - hb, y, w: hb, h: hb, enabled: true, icon: 'close' });
    y += hb + m.gapPx * 0.6;
    if (def.subtitle) { ops.push({ k: 'text', x: pad, y: y + emS, s: def.subtitle, font: fontOf(emS, 600), fill: t.muted }); texts.push(def.subtitle); y += emS * 1.6; }
    for (const e of def.entries) {
      if ('spec' in e) { const r = stack([e.spec], pad, y, cw, m); widgets.push(...r.widgets); texts.push(e.spec.label); y = r.y + m.gapPx; }
      else {
        ops.push({ k: 'text', x: pad, y: y + emS, s: e.label, font: fontOf(emS, 700), fill: t.muted }); texts.push(e.label); y += emS * 1.45;
        widgets.push(...across(e.specs, pad, y, cw, m)); for (const sp of e.specs) texts.push(sp.label); y += m.targetPx + m.gapPx;
      }
    }
    if (def.footer.length) { y += m.gapPx * 0.4; widgets.push(...across(def.footer, pad, y, cw, m)); for (const sp of def.footer) texts.push(sp.label); y += m.targetPx + m.gapPx; }
    y = y - m.gapPx + pad; back.h = Math.round(y) - 2;
    return { w: W, h: Math.round(y), ops, widgets, texts: [], chrome: texts, overflow: false, lines: { title: 1, body: def.entries.length } };
  }

  private draw(): void {
    const m = this.kit.metrics(MENU_DIST), W = Math.round(MENU_WIDTH_DEG * m.texelsPerDeg);
    const L = this.layout(this.build(), m, W);
    this.panel.setLayout(L, m, MENU_WIDTH_DEG, MENU_DIST);
    // keep the world position of the panel's centre (its height changed with the page)
    if (this.isOpen) { /* the pose was set at show(); the size changed in place */ }
  }
  get texts(): string[] { return this.panel.layout ? this.panel.layout.chrome.slice() : []; }
  get currentPage(): string { return this.page; }

  // ------------------------------------------------------------------------------------------------------------------ doing things
  activate(id: string): void {
    this.activations.push(id);
    const k = this.kit, s = k.settings.get();
    const [a, b] = [id.split(':')[0], id.slice(id.indexOf(':') + 1)];
    switch (a) {
      case 'close': this.hide(); return;
      case 'exit': this.hide(); k.exit(); return;
      case 'back': this.page = b; this.sub = 0; this.draw(); return;
      case 'page': this.page = b; this.sub = 0; this.draw(); return;
      case 'pg': this.sub += b === 'next' ? 1 : -1; this.sub = Math.max(0, this.sub); this.draw(); return;
      case 'place': {
        this.hide();
        k.loco?.goToPlace(b).catch(e => { console.warn('xr ui: could not go to place', b, e); k.toast('That place cannot be reached from here.', 'warn'); });
        return;
      }
      case 'tod': {
        try { k.host.api.setLighting(b); } catch (e) { console.warn('xr ui: setLighting failed', e); k.toast('The time of day could not be changed.', 'warn'); return; }
        // the sun's shadow map is static in a headset: one redraw for the new light
        try { k.host.renderer.shadowMap.needsUpdate = true; } catch { /* no renderer in a unit test */ }
        try { window.dispatchEvent(new CustomEvent('vh:xr-lighting', { detail: { preset: b } })); } catch { /* not in a page */ }
        this.draw(); return;
      }
      case 'text': k.settings.set({ textScale: Number(b) as UiSettings['textScale'] }); return;
      case 'hand': k.settings.set({ handedness: b as UiSettings['handedness'] }); return;
      case 'snap': k.settings.set({ snapTurnDeg: Number(b) as UiSettings['snapTurnDeg'] }); return;
      case 'set':
        if (b === 'contrast') k.settings.set({ contrast: s.contrast === 'high' ? 'normal' : 'high' });
        else if (b === 'seated') k.settings.set({ posture: s.posture === 'seated' ? 'standing' : 'seated' });
        else if (b === 'vignette') k.settings.set({ vignette: !s.vignette });
        return;
      case 'height':
        k.settings.set({ heightCm: b === 'reset' ? 0 : s.heightCm + (b === 'up' ? 5 : -5) }); return;
      case 'chapter': this.tour?.emit({ type: 'chapter', id: b }); this.hide(); return;
      case 'tour': {
        const m = this.tour?.model(); if (!this.tour || !m) return;
        if (b === 'play') this.tour.emit({ type: m.playing ? 'pause' : 'play' });
        else if (b === 'sound') this.tour.emit({ type: 'mute', muted: !m.muted });
        else if (b === 'auto') { const v = s.autoAdvance === 'guided' ? 'step' : 'guided'; k.settings.set({ autoAdvance: v }); this.tour.emit({ type: 'setting', key: 'autoAdvance', value: v }); }
        return;
      }
    }
  }

  tick(f: XrFrame): void {
    this.dock.tick(f);
    if (!this.isOpen || !this.openedAt) return;
    const o = this.openedAt;
    if (Math.hypot(f.head.pos[0] - o[0], f.head.pos[2] - o[2]) > CLOSE_STEP_M) this.hide();
  }
  dispose(): void { this.offRelayout(); this.offSettings(); this.dock.dispose(); this.panel.dispose(); this.subs.clear(); }
}

/** The "Menu" pill: low on the left of the view, lazy-following, dimmed after a few seconds, one press from the menu. */
export class Dock {
  readonly panel: XrPanel;
  private fol: FollowState | null = null; private idle = 0; private lastHover: string | null = null; private off: () => void;
  constructor(private kit: UiKit, private onOpen: () => void) {
    this.panel = kit.panels.create({ name: 'dock', world: false, interactive: true, renderOrder: 1145 });
    this.panel.activate = () => this.onOpen();
    this.off = kit.onRelayout(() => this.draw());
    this.draw();
  }
  private static readonly DIST = 1.1; private static readonly W_DEG = 12;
  private draw(): void {
    const m = this.kit.metrics(Dock.DIST), W = Math.round(Dock.W_DEG * m.texelsPerDeg), pad = Math.round(m.padPx * 0.4);
    const back = panelBackOp(W, m), ops: Op[] = [back];
    const w: Widget = { id: 'menu', kind: 'button', label: 'Menu', x: pad, y: pad, w: W - 2 * pad, h: m.targetPx, enabled: true, icon: 'menu' };
    back.h = m.targetPx + 2 * pad - 2;
    this.panel.setLayout({ w: W, h: m.targetPx + 2 * pad, ops, widgets: [w], texts: [], chrome: ['Menu'], overflow: false, lines: { title: 0, body: 0 } }, m, Dock.W_DEG, Dock.DIST);
  }
  show(): void { this.panel.show(0.25); this.wake(); }
  wake(): void { this.idle = 0; this.panel.dim(1, 0.2); }
  tick(f: XrFrame): void {
    if (!this.panel.shown) return;
    if (!this.fol) this.fol = newFollow(f.head.yawDeg);
    const p = lockedPose(f.head.pos, followStep(this.fol, f.head.yawDeg, f.dt), -24, -27, Dock.DIST);
    this.panel.setPose(p.centre, p.yaw, p.tiltDeg);
    if (this.panel.hover !== this.lastHover || this.panel.pressed) { this.lastHover = this.panel.hover; this.wake(); }
    this.idle += f.dt;
    if (this.idle > 6) this.panel.dim(0.5, 0.8);
  }
  dispose(): void { this.off(); this.panel.dispose(); }
}
export { execOps };
