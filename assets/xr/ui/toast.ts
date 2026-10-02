// assets/xr/ui/toast.ts : a short notice in the world, and the entry status card.
//
// A toast never takes the ray (its panel is not interactive, so a ray that points through it presses what is behind it) and never blocks
// the view: it hangs 12 degrees ABOVE the horizon at 1.5 m, follows the head lazily, and goes after a few seconds counted in XR frame
// time, so a session that is hidden (no frames) does not lose a notice unseen. One shows at a time; the rest wait (at most three).
// The status card is the same surface in the middle of the view, for "Preparing", "Ready" and "this home is too detailed for this headset".
import type { XrFrame } from '../host.js';
import { followStep, lockedPose, newFollow, type FollowState } from './caption.js';
import type { UiKit } from './kit.js';
import { layoutStatus, layoutToast, type StatusView } from './paint.js';
import type { XrPanel } from './panel.js';

interface Item { text: string; kind: 'info' | 'warn'; ms: number }
const DIST = 1.5, EL = 12, WIDTH_DEG = 30;
const STATUS_DIST = 1.6, STATUS_WIDTH_DEG = 28;

export class ToastTray {
  readonly panel: XrPanel;
  private queue: Item[] = []; private cur: Item | null = null; private left = 0;
  private fol: FollowState | null = null; private off: () => void;
  /** every toast shown, newest last (the test reads this, and the Director's debug.texts) */
  readonly shown: string[] = [];
  constructor(private kit: UiKit) {
    this.panel = kit.panels.create({ name: 'toast', world: false, interactive: false, renderOrder: 1130 });
    this.off = kit.onRelayout(() => { if (this.cur) this.draw(this.cur); });
  }
  push(text: string, kind: 'info' | 'warn' = 'info', ms = kind === 'warn' ? 6000 : 4000): void {
    if (this.cur && this.cur.text === text) { this.left = Math.max(this.left, ms / 1000); return; }   // the same words again: keep it up, do not stack
    if (this.queue.some(q => q.text === text)) return;
    this.queue.push({ text, kind, ms });
    if (this.queue.length > 3) this.queue.shift();
    if (!this.cur) this.next();
  }
  private next(): void {
    const it = this.queue.shift();
    if (!it) { this.cur = null; this.panel.hide(0.25); return; }
    this.cur = it; this.left = it.ms / 1000; this.shown.push(it.text); if (this.shown.length > 40) this.shown.shift();
    this.draw(it); this.fol = null; this.panel.show(0.2);
  }
  private draw(it: Item): void {
    const m = this.kit.metrics(DIST, { interactive: false }), W = Math.round(WIDTH_DEG * m.texelsPerDeg);
    this.panel.setLayout(layoutToast(this.kit.measure, it, m, W), m, WIDTH_DEG, DIST);
  }
  get current(): string | null { return this.cur ? this.cur.text : null; }
  tick(f: XrFrame): void {
    if (!this.cur) return;
    if (!this.fol) this.fol = newFollow(f.head.yawDeg);
    const p = lockedPose(f.head.pos, followStep(this.fol, f.head.yawDeg, f.dt), 0, EL, DIST);
    this.panel.setPose(p.centre, p.yaw, p.tiltDeg);
    this.left -= f.dt;
    if (this.left <= 0) this.next();
  }
  dispose(): void { this.off(); this.queue.length = 0; this.cur = null; this.panel.dispose(); }
}

export class StatusCard {
  readonly panel: XrPanel;
  private fol: FollowState | null = null; private on = false; private off: () => void; private view: StatusView | null = null;
  constructor(private kit: UiKit) {
    this.panel = kit.panels.create({ name: 'status', world: false, interactive: false, renderOrder: 1140 });
    this.off = kit.onRelayout(() => { if (this.view) this.draw(this.view); });
  }
  set(v: StatusView | null): void {
    this.view = v;
    if (!v) { if (this.on) { this.on = false; this.panel.hide(0.2); } return; }
    this.draw(v);
    if (!this.on) { this.on = true; this.fol = null; this.panel.show(0.2); }
  }
  get texts(): string[] { return this.panel.layout ? this.panel.layout.texts.slice() : []; }
  private draw(v: StatusView): void {
    const m = this.kit.metrics(STATUS_DIST, { interactive: false }), W = Math.round(STATUS_WIDTH_DEG * m.texelsPerDeg);
    this.panel.setLayout(layoutStatus(this.kit.measure, v, m, W), m, STATUS_WIDTH_DEG, STATUS_DIST);
  }
  tick(f: XrFrame): void {
    if (!this.on) return;
    if (!this.fol) this.fol = newFollow(f.head.yawDeg);
    const p = lockedPose(f.head.pos, followStep(this.fol, f.head.yawDeg, f.dt), 0, 0, STATUS_DIST);
    this.panel.setPose(p.centre, p.yaw, p.tiltDeg);
  }
  dispose(): void { this.off(); this.panel.dispose(); }
}
