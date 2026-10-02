// assets/xr/ui/card.ts : the popup card in the world, and the leader line from it to the thing it is about.
//
// A CardSurface is one panel that the placement solver positions (place-world.ts). It is world-locked beside the subject; its yaw follows
// the head LAZILY (the same follow as the caption bar, on the bearing from the card to the head), so a person who walks around the card
// keeps reading it without it spinning at every step. The 'sheet' fallback is not world-locked: it hangs under the horizon and follows
// the head like the caption does.
//
// The LeaderLine is a ribbon 0.6 degree wide (so it is a hairline at any distance, never a bar), from the card's nearest edge to the
// subject, ending in a ring. It is dashed when the house hides the subject from the head, so a line that runs through a wall says so.
import type { XrFrame } from '../host.js';
import type { PlaceWorldOut, V3 } from '../presenter.js';
import { followStep, lockedPose, newFollow, type FollowState } from './caption.js';
import type { UiKit } from './kit.js';
import type { Layout, Metrics } from './paint.js';
import type { XrPanel } from './panel.js';

const RAD = Math.PI / 180;

export class LeaderLine {
  readonly ribbon: any; readonly pin: any;
  private solid: any; private dashed: any; private geo: any; private ringGeo: any; private mat: any; private pinMat: any;
  private from: V3 = [0, 0, 0]; private to: V3 = [0, 0, 0]; private on = false; private isDashed = false;
  private T: any; private v = [0, 0, 0] as V3;
  constructor(kit: UiKit) {
    const T = (this.T = kit.THREE);
    const tex = (dash: boolean) => {
      const c = document.createElement('canvas'); c.width = 64; c.height = 8; const g = c.getContext('2d')!;
      g.fillStyle = '#ffffff'; if (dash) { g.fillRect(0, 0, 36, 8); } else g.fillRect(0, 0, 64, 8);
      const t = new T.CanvasTexture(c); t.wrapS = T.RepeatWrapping; t.colorSpace = T.SRGBColorSpace; t.magFilter = T.NearestFilter; t.minFilter = T.LinearFilter; t.generateMipmaps = false;
      return t;
    };
    this.solid = tex(false); this.dashed = tex(true);
    const accent = kit.settings.get().contrast === 'high' ? '#ffe14d' : '#c5e8dc';
    this.geo = new T.PlaneGeometry(1, 1); this.ringGeo = new T.RingGeometry(0.62, 1, 28);
    this.mat = new T.MeshBasicMaterial({ color: accent, map: this.solid, transparent: true, opacity: 0.92, depthTest: false, depthWrite: false, toneMapped: false, fog: false, side: T.DoubleSide });
    this.pinMat = new T.MeshBasicMaterial({ color: accent, transparent: true, opacity: 0.95, depthTest: false, depthWrite: false, toneMapped: false, fog: false, side: T.DoubleSide });
    this.ribbon = new T.Mesh(this.geo, this.mat); this.pin = new T.Mesh(this.ringGeo, this.pinMat);
    for (const o of [this.ribbon, this.pin]) { o.visible = false; o.frustumCulled = false; o.renderOrder = 1250; o.raycast = () => {}; o.userData.xrOverlay = true; kit.group.add(o); }
    this.ribbon.name = 'xr ui: leader'; this.pin.name = 'xr ui: leader pin';
  }
  get visible(): boolean { return this.on; }
  get dashedNow(): boolean { return this.isDashed; }
  set(l: { from: V3; to: V3; dashed: boolean } | null): void {
    this.on = !!l;
    this.ribbon.visible = this.pin.visible = this.on;
    if (!l) return;
    this.from = l.from; this.to = l.to; this.isDashed = l.dashed;
    this.mat.map = l.dashed ? this.dashed : this.solid; this.mat.needsUpdate = true;
  }
  /** orient the ribbon and the ring toward the head, and size them in degrees (so they are the same hairline near and far) */
  update(head: V3): void {
    if (!this.on) return;
    const { from, to } = this, T = this.T;
    const dx = to[0] - from[0], dy = to[1] - from[1], dz = to[2] - from[2], len = Math.hypot(dx, dy, dz) || 1e-6;
    const mx = (from[0] + to[0]) / 2, my = (from[1] + to[1]) / 2, mz = (from[2] + to[2]) / 2;
    const hx = head[0] - mx, hy = head[1] - my, hz = head[2] - mz, hd = Math.hypot(hx, hy, hz) || 1;
    // x along the line; z toward the head, made perpendicular to x; y completes the frame
    const ex = dx / len, ey = dy / len, ez = dz / len;
    let zx = hx / hd, zy = hy / hd, zz = hz / hd; const k = zx * ex + zy * ey + zz * ez;
    zx -= k * ex; zy -= k * ey; zz -= k * ez; const zl = Math.hypot(zx, zy, zz) || 1; zx /= zl; zy /= zl; zz /= zl;
    const yx = zy * ez - zz * ey, yy = zz * ex - zx * ez, yz = zx * ey - zy * ex;
    const m = this.m4 || (this.m4 = new T.Matrix4()), q = this.q4 || (this.q4 = new T.Quaternion());
    m.makeBasis(this.tv(ex, ey, ez), this.tv2(yx, yy, yz), this.tv3(zx, zy, zz)); q.setFromRotationMatrix(m);
    const w = Math.max(0.004, hd * Math.tan(0.6 * RAD));
    this.ribbon.position.set(mx, my, mz); this.ribbon.quaternion.copy(q); this.ribbon.scale.set(len, w, 1);
    this.mat.map.repeat.set(len / 0.05, 1);
    // the ring at the subject: about 1.1 degrees across, facing the head
    const pd = Math.hypot(head[0] - to[0], head[1] - to[1], head[2] - to[2]) || 1, r = Math.max(0.012, pd * Math.tan(1.1 * RAD));
    this.pin.position.set(to[0], to[1], to[2]); this.pin.scale.set(r, r, 1);
    this.pin.lookAt(head[0], head[1], head[2]);
  }
  private m4: any; private q4: any; private a: any; private b: any; private c: any;
  private tv(x: number, y: number, z: number) { return (this.a || (this.a = new this.T.Vector3())).set(x, y, z); }
  private tv2(x: number, y: number, z: number) { return (this.b || (this.b = new this.T.Vector3())).set(x, y, z); }
  private tv3(x: number, y: number, z: number) { return (this.c || (this.c = new this.T.Vector3())).set(x, y, z); }
  dispose(): void {
    this.ribbon.removeFromParent(); this.pin.removeFromParent();
    for (const d of [this.geo, this.ringGeo, this.mat, this.pinMat, this.solid, this.dashed]) d.dispose();
  }
}

export class CardSurface {
  readonly panel: XrPanel;
  readonly leader: LeaderLine;
  private fol: FollowState | null = null;
  private mode: 'card' | 'sheet' = 'card';
  private placed: PlaceWorldOut | null = null;
  private widthDeg = 0; private sheetDist = 1.5;

  constructor(private kit: UiKit, name: string, interactive = true) {
    this.panel = kit.panels.create({ name, world: true, interactive, renderOrder: 1120 });
    this.leader = new LeaderLine(kit);
  }

  /** Put `L` on the panel at the solver's pose and fade it in (or leave it hidden: `reveal` false, for a card that waits for the blink). */
  present(L: Layout, m: Metrics, widthDeg: number, p: PlaceWorldOut, reveal = true): void {
    this.widthDeg = widthDeg; this.placed = p; this.mode = p.mode; this.fol = null;
    // the panel's world size is the solver's (it chose the distance); the canvas is the layout's
    this.panel.setLayout(L, m, widthDeg, m.distanceM);
    this.panel.setWorldSize(p.widthM, p.heightM);
    this.panel.setPose(p.centre, p.yaw, p.tiltDeg);
    this.leader.set(p.leader);
    if (reveal) this.reveal();
  }
  reveal(): void { this.panel.show(0.18); this.leader.set(this.placed ? this.placed.leader : null); }
  /** change the content without moving it (a hover is not a re-layout: this is for the countdown label, a language, a settings change) */
  relayout(L: Layout, m: Metrics, widthDeg: number): void {
    const p = this.placed; if (!p) return;
    const keepW = this.panel.widthM; this.panel.setLayout(L, m, widthDeg, m.distanceM); this.panel.setWorldSize(keepW, keepW * L.h / L.w);
  }
  hide(secs = 0.15): void { this.panel.hide(secs); this.leader.set(null); this.placed = null; }
  dim(to: number): void { this.panel.dim(to, 0.25); }
  get visible(): boolean { return this.panel.shown; }
  get pose(): PlaceWorldOut | null { return this.placed; }

  tick(f: XrFrame): void {
    const p = this.placed; if (!p || !this.panel.shown) return;
    if (this.mode === 'sheet') {
      if (!this.fol) this.fol = newFollow(f.head.yawDeg);
      const yaw = followStep(this.fol, f.head.yawDeg, f.dt);
      const q = lockedPose(f.head.pos, yaw, 0, -11 + (Math.atan2(this.panel.heightM / 2, this.sheetDist) / RAD), this.sheetDist);
      this.panel.setPose(q.centre, q.yaw, q.tiltDeg);
    } else {
      // lazy billboard: the yaw follows the bearing from the card to the head
      const c = this.panel.centre, bearing = Math.atan2(c[0] - f.head.pos[0], c[2] - f.head.pos[2]) / RAD;   // the card's yaw toward the head, as a three.js yaw (deg)
      const want = bearing + 180;
      if (!this.fol) this.fol = newFollow(p.yaw / RAD);
      const yaw = followStep(this.fol, want, f.dt);
      const hdist = Math.hypot(f.head.pos[0] - c[0], f.head.pos[2] - c[2]);
      const tilt = Math.max(-15, Math.min(15, Math.atan2(f.head.pos[1] - c[1], Math.max(hdist, 0.05)) / RAD));
      this.panel.setPose(c, yaw * RAD, tilt);
    }
    this.leader.update(f.head.pos);
  }
  dispose(): void { this.leader.dispose(); this.panel.dispose(); }
}
