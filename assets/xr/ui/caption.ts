// assets/xr/ui/caption.ts : the caption bar, and the lazy follow every head-following panel uses.
//
// LAZY FOLLOW. A panel glued to the head is nauseating and unreadable (it moves with every small head turn); a panel that never moves is
// left behind. The compromise (the comfort literature's "lazy follow"): it stays where it is until the head has turned more than
// XR_LEGIBILITY.caption.deadzoneDeg (18 degrees) away from it for 0.4 s, then eases to the new heading over about XR_LEGIBILITY.caption.followS
// (0.6 s) and stops. It follows YAW only; its height below the horizon is fixed (16 degrees at 1.7 m) so it never rides up and down with the head.
// Its distance and its offset from the head's position follow the head every frame, so walking or leaning does not leave it behind.
//
// KARAOKE. The bar shows two lines of the line being spoken, the spoken words lit, the current word underlined. It is redrawn only when the
// word changes (or the beat's progress moves one step): a still frame costs nothing and a word costs one upload of a 1000 x 220 canvas.
import type { XrFrame } from '../host.js';
import type { V3 } from '../presenter.js';
import { XR_LEGIBILITY } from '../presenter.js';
import type { UiKit } from './kit.js';
import { layoutCaption, type CaptionView } from './paint.js';
import type { XrPanel } from './panel.js';

const RAD = Math.PI / 180;
const wrapDeg = (d: number) => ((d + 540) % 360) - 180;

export interface FollowState { yaw: number; off: number; easing: boolean }
export const FOLLOW = { deadDeg: XR_LEGIBILITY.caption.deadzoneDeg, holdS: 0.4, easeS: XR_LEGIBILITY.caption.followS, stopDeg: 1 } as const;
export const newFollow = (yawDeg: number): FollowState => ({ yaw: yawDeg, off: 0, easing: false });
/** One step of the follow. Pure: (state, the head's yaw, dt) in, the panel's yaw out (degrees, three.js convention: 0 = -z, positive turns left). */
export function followStep(st: FollowState, headYawDeg: number, dt: number): number {
  const diff = wrapDeg(headYawDeg - st.yaw);
  if (!st.easing) {
    if (Math.abs(diff) > FOLLOW.deadDeg) st.off += dt; else st.off = 0;
    if (st.off >= FOLLOW.holdS) { st.easing = true; st.off = 0; }
    else return st.yaw;
  }
  // an exponential approach whose time constant makes ~95 % of the turn in easeS
  const k = 1 - Math.exp(-dt * 3 / FOLLOW.easeS);
  st.yaw = wrapDeg(st.yaw + diff * k);
  if (Math.abs(wrapDeg(headYawDeg - st.yaw)) < FOLLOW.stopDeg) st.easing = false;
  return st.yaw;
}

/** A panel hung `dist` m from the head along (yaw - az), `el` degrees above the horizon (negative: below), facing the head. Pure. */
export function lockedPose(head: V3, yawDeg: number, azDeg: number, elDeg: number, dist: number): { centre: V3; yaw: number; tiltDeg: number } {
  const d = (yawDeg - azDeg) * RAD, ce = Math.cos(elDeg * RAD), se = Math.sin(elDeg * RAD);
  return {
    centre: [head[0] - Math.sin(d) * ce * dist, head[1] + se * dist, head[2] - Math.cos(d) * ce * dist],
    yaw: d, tiltDeg: Math.max(-15, Math.min(15, -elDeg)),
  };
}

export class CaptionBar {
  readonly panel: XrPanel;
  private fol: FollowState | null = null;
  private key = ''; private view: CaptionView = { words: [], wordIndex: -1, speaker: null, fictional: 'Fictional', progress: null };
  private shown = false; private offRelayout: () => void;
  /** frames on which the bar was redrawn (the test: it must not redraw on a still frame) */
  redraws = 0;

  constructor(private kit: UiKit) {
    this.panel = kit.panels.create({ name: 'caption', world: false, interactive: false, renderOrder: 1110 });
    this.offRelayout = kit.onRelayout(() => { this.key = ''; if (this.shown) this.set(this.view); });
  }
  get visible(): boolean { return this.shown; }

  show(): void { if (this.shown) return; this.shown = true; this.fol = null; this.key = ''; this.set(this.view); this.panel.show(0.2); }
  hide(): void { if (!this.shown) return; this.shown = false; this.panel.hide(0.15); }

  /** Draw `v` unless it is what is already drawn. Returns whether it drew. */
  set(v: CaptionView): boolean {
    this.view = v;
    const prog = v.progress == null ? -1 : Math.round(v.progress * 50);
    const key = `${v.words.length}|${v.words[0] ?? ''}|${v.wordIndex}|${v.speaker ?? ''}|${v.fictional}|${prog}`;
    if (key === this.key && this.panel.layout) return false;
    this.key = key;
    const d = XR_LEGIBILITY.distance.caption, m = this.kit.metrics(d, { interactive: false });
    const W = Math.round(XR_LEGIBILITY.caption.widthDeg * m.texelsPerDeg);
    const L = layoutCaption(this.kit.measure, v, m, W);
    this.panel.setLayout(L, m, XR_LEGIBILITY.caption.widthDeg, d);
    this.redraws++;
    return true;
  }
  /** every string the bar has shown so far this line (debug.texts) */
  texts(): string[] { return this.panel.layout ? this.panel.layout.texts.slice() : []; }

  tick(f: XrFrame): void {
    if (!this.shown) return;
    if (!this.fol) this.fol = newFollow(f.head.yawDeg);
    const yaw = followStep(this.fol, f.head.yawDeg, f.dt);
    const p = lockedPose(f.head.pos, yaw, 0, -XR_LEGIBILITY.caption.belowHorizonDeg, XR_LEGIBILITY.distance.caption);
    this.panel.setPose(p.centre, p.yaw, p.tiltDeg);
  }
  dispose(): void { this.offRelayout(); this.panel.dispose(); }
}
