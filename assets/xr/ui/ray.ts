// assets/xr/ui/ray.ts : the ray hub. It turns a controller's or a hand's pointing into hover, press and release on the kit's panels.
//
//   POINTING   each XR frame, for each input source: its target-ray pose (from the XRFrame, through the rig) meets the panels in front of
//              it (hit.ts); the nearest panel and the widget under the ray are the source's hit. Only a TRACKED pointer hovers: visionOS
//              shows no hover for web content (its source exists only while the person pinches), and a gaze or screen source has none.
//   PRESSING   on `selectstart`; some runtimes send only `select` (and IWER sends `select` BEFORE `selectstart`), so a `select` with no press
//              under way presses and releases at once, and the `selectstart` and `selectend` that follow it are ignored. A press activates
//              on release over the SAME widget; released elsewhere, or cancelled, it does nothing.
//   CANCEL     a press ends, unactivated, when its source goes away (controller lost mid-press: IWER sends no event for it, the kit
//              cancels from `inputsourceschange` and from what the frame no longer contains), when the session becomes hidden or blurred,
//              and when the session ends.
//   ARBITRATION  the panels register with the locomotion module's registry (XrInput.addTarget, priority 100) so that the teleport floor
//              (priority 0) never fires while a ray is over a panel. When that registry has sources (the real module is present), IT
//              delivers press and release through the target's callbacks and this hub's own listeners stand down; with the stub it
//              has none, and the hub listens to the session itself. Either way a press goes through beginPress/endPress below.
//   HAPTICS    a short tick on hover (0.3 for 25 ms) and a firmer one on press (0.6 for 40 ms), where an actuator exists.
//
// No controller models and no CDN: the ray is a thin box, the hit point a 1.5 cm disc, and a controller is a ~200-triangle proxy.
import type { InputSourceInfo, RayHit, RayTarget, XrFrame, XrInput } from '../host.js';
import type { V3 } from '../presenter.js';
import type { Widget } from './paint.js';
import type { PanelSet, XrPanel } from './panel.js';

export type TargetKind = 'ray' | 'handRay' | 'gazePinch';

export interface HubDeps {
  THREE: any; renderer: any; group: any; rigGroup: any; input: XrInput; panels: PanelSet;
  /** a press and release on the same enabled widget */
  onActivate(panel: XrPanel, widget: Widget): void;
  /** the kind of pointing in use changed: the kit enlarges its targets */
  onKind(kind: TargetKind): void;
  log(msg: string): void;
  accent: string;
}

interface Src {
  key: string; xr: any; id: number;
  tracked: boolean; hand: boolean; mode: string;
  has: boolean; origin: V3; dir: V3;
  hit: { panel: XrPanel; widget: Widget | null; dist: number; point: V3 } | null;
  hoverPanel: XrPanel | null; hoverId: string | null;
  selectHandled: boolean; downAt: number;
  ray: any; dot: any; proxy: any; gripOk: boolean;
}
interface Press { panel: XrPanel; widget: Widget | null }

/** haptics: the two ways a runtime offers an actuator. Never throws. */
export function pulse(xr: any, intensity: number, ms: number): boolean {
  try {
    const gp = xr?.gamepad; if (!gp) return false;
    const a = gp.hapticActuators && gp.hapticActuators[0];
    if (a && typeof a.pulse === 'function') { void a.pulse(intensity, ms); return true; }
    if (gp.vibrationActuator && typeof gp.vibrationActuator.playEffect === 'function') { void gp.vibrationActuator.playEffect('dual-rumble', { duration: ms, strongMagnitude: intensity, weakMagnitude: intensity }); return true; }
  } catch { /* an actuator that throws is no actuator */ }
  return false;
}

/** The proxy controller: a handle and a tracking ring, ~190 triangles in ONE geometry, shaded into vertex colours (no lights, no textures). */
export function buildProxyGeometry(T: any): any {
  const parts: Array<{ g: any; m: any }> = [];
  const handle = new T.CylinderGeometry(0.019, 0.014, 0.115, 10, 1, false);   // 40 triangles
  parts.push({ g: handle, m: new T.Matrix4().makeRotationX(Math.PI / 2).setPosition(0, 0, 0.01) });
  const ring = new T.TorusGeometry(0.046, 0.0075, 6, 12);                      // 144 triangles
  parts.push({ g: ring, m: new T.Matrix4().makeRotationX(Math.PI / 2.6).setPosition(0, 0.012, -0.075) });
  const pos: number[] = [], col: number[] = [];
  const v = new T.Vector3(), n = new T.Vector3(), nm = new T.Matrix3(), L = new T.Vector3(0.4, 0.8, 0.45).normalize();
  const base = new T.Color('#9fb4ba'); let tris = 0;
  for (const { g, m } of parts) {
    const ng = g.index ? g.toNonIndexed() : g, p = ng.attributes.position, nrm = ng.attributes.normal;
    nm.getNormalMatrix(m);
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i).applyMatrix4(m); n.fromBufferAttribute(nrm, i).applyMatrix3(nm).normalize();
      const s = 0.5 + 0.5 * Math.max(0, n.dot(L));
      pos.push(v.x, v.y, v.z); col.push(base.r * s, base.g * s, base.b * s);
    }
    tris += p.count / 3; if (ng !== g) ng.dispose(); g.dispose();
  }
  const out = new T.BufferGeometry();
  out.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); out.setAttribute('color', new T.Float32BufferAttribute(col, 3));
  out.userData.triangles = tris;
  return out;
}

export class RayHub {
  private srcs = new Map<any, Src>();
  private nextId = 1;
  private pressed = new Map<string, Press>();
  private hits = new WeakMap<object, { panel: XrPanel; widget: Widget | null }>();
  private offs: Array<() => void> = [];
  private session: any = null;
  private kind: TargetKind = 'ray';
  private T: any; private tmpV: any; private tmpQ: any; private tmpD: any; private mat: any;
  private rayGeo: any; private dotGeo: any; private proxyGeo: any;
  private rayMat: any; private dotMat: any; private proxyMat: any;
  private eventHit: { origin: V3; dir: V3 } = { origin: [0, 0, 0], dir: [0, 0, -1] };
  private haptics = { hover: 0, press: 0 };
  private unregister: (() => void) | null = null;
  pointingAtPanel = false;
  readonly log: Array<{ ev: string; src: string; id?: string | null }> = [];

  constructor(private d: HubDeps) {
    const T = (this.T = d.THREE);
    this.tmpV = new T.Vector3(); this.tmpQ = new T.Quaternion(); this.tmpD = new T.Vector3(); this.mat = new T.Matrix4();
    this.rayGeo = new T.BoxGeometry(1, 1, 1);
    this.dotGeo = new T.CircleGeometry(0.0075, 16);                       // 1.5 cm across
    this.proxyGeo = buildProxyGeometry(T);
    this.rayMat = new T.MeshBasicMaterial({ color: d.accent, transparent: true, opacity: 0.85, depthTest: false, depthWrite: false, toneMapped: false, fog: false });
    this.dotMat = new T.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 1, depthTest: false, depthWrite: false, toneMapped: false, fog: false, side: T.DoubleSide });
    this.proxyMat = new T.MeshBasicMaterial({ vertexColors: true, toneMapped: false, fog: false });
  }

  get proxyTriangles(): number { return this.proxyGeo.userData.triangles | 0; }

  // ---------------------------------------------------------------------------------------------------------------------- lifecycle
  attach(): void {
    const session = this.session = this.d.renderer.xr.getSession?.();
    this.unregister = this.d.input.addTarget(this.target());
    if (session) {
      const on = (n: string, f: (e: any) => void) => { session.addEventListener(n, f); this.offs.push(() => session.removeEventListener(n, f)); };
      on('selectstart', e => this.onSelectStart(e));
      on('select', e => this.onSelect(e));
      on('selectend', e => this.onSelectEnd(e));
      on('inputsourceschange', e => this.onSourcesChange(e));
      on('visibilitychange', () => { if (session.visibilityState !== 'visible') this.cancelAll('visibility'); });
      on('end', () => this.cancelAll('session-end'));
    }
    this.offs.push(this.d.input.on('cancel', () => this.cancelAll('input-cancel')));
  }
  detach(): void {
    this.cancelAll('detach');
    for (const f of this.offs.splice(0)) { try { f(); } catch { /* gone already */ } }
    this.unregister?.(); this.unregister = null;
    for (const s of this.srcs.values()) this.dropVisuals(s);
    this.srcs.clear();
    for (const g of [this.rayGeo, this.dotGeo, this.proxyGeo, this.rayMat, this.dotMat, this.proxyMat]) g.dispose();
  }

  /** The registry's target: the panels, at priority 100. hit() is called by the locomotion module with each source's ray. */
  private target(): RayTarget {
    return {
      id: 'xr-ui: panels', priority: 100, enabled: true,
      hit: (ray) => {
        const h = this.nearest(ray.origin, ray.dir); if (!h) return null;
        const out: RayHit = { dist: h.dist, point: h.point, uv: h.uv, normal: h.panel.basis.n };
        this.hits.set(out, { panel: h.panel, widget: h.widget });
        return out;
      },
      onPress: (id, hit) => { const r = this.resolve(hit); if (r) this.beginPress('r' + id, r.panel, r.widget); },
      onRelease: (id, hit, cancelled) => { const r = hit ? this.resolve(hit) : null; this.endPress('r' + id, r, cancelled); },
    };
  }
  private resolve(h: RayHit): { panel: XrPanel; widget: Widget | null } | null {
    const k = this.hits.get(h); if (k) return k;
    // a hit the registry rebuilt: find the panel the point lies on
    for (const p of this.d.panels.interactive()) {
      const hh = p.hit([h.point[0] - p.basis.n[0] * 0.01, h.point[1] - p.basis.n[1] * 0.01, h.point[2] - p.basis.n[2] * 0.01], [-p.basis.n[0], -p.basis.n[1], -p.basis.n[2]]);
      if (hh) return { panel: p, widget: hh.widget };
    }
    return null;
  }
  /** the registry has sources: the locomotion module is present and delivers presses itself */
  private viaRegistry(): boolean { try { return this.d.input.sources().length > 0; } catch { return false; } }

  private nearest(o: V3, dir: V3) {
    let best: ReturnType<XrPanel['hit']> = null, bp: XrPanel | null = null;
    for (const p of this.d.panels.interactive()) { const h = p.hit(o, dir); if (h && (!best || h.dist < best.dist)) { best = h; bp = p; } }
    return best && bp ? { panel: bp, widget: best.widget, dist: best.dist, point: best.point, uv: best.uv } : null;
  }

  // ---------------------------------------------------------------------------------------------------------------------- per frame
  update(f: XrFrame): void {
    const session = this.session ?? this.d.renderer.xr.getSession?.(); if (!session) return;
    const frame = f.xrFrame, ref = this.d.renderer.xr.getReferenceSpace?.();
    this.d.rigGroup.updateMatrixWorld(true);
    // sources come and go without an event on some runtimes: sync with the session's own list
    const live = new Set<any>();
    for (const x of session.inputSources) { live.add(x); if (!this.srcs.has(x)) this.addSource(x); }
    for (const [x, s] of this.srcs) if (!live.has(x)) this.removeSource(x, s, 'gone');
    let pointing = false;
    for (const s of this.srcs.values()) {
      s.has = !!(frame && ref && this.readRay(s, frame, ref));
      if (!s.has) { this.hideVisuals(s); continue; }
      const h = this.nearest(s.origin, s.dir);
      s.hit = h ? { panel: h.panel, widget: h.widget, dist: h.dist, point: h.point } : null;
      if (s.hit) pointing = true;
      this.updateHover(s);
      this.updateVisuals(s, frame, ref);
    }
    this.pointingAtPanel = pointing;
    this.setKind();
  }

  private readRay(s: Src, frame: any, ref: any): boolean {
    const pose = frame.getPose(s.xr.targetRaySpace, ref); if (!pose) return false;
    const t = pose.transform, T = this.T, v = this.tmpV, q = this.tmpQ, m = this.d.rigGroup.matrixWorld;
    v.set(t.position.x, t.position.y, t.position.z).applyMatrix4(m);
    q.set(t.orientation.x, t.orientation.y, t.orientation.z, t.orientation.w);
    s.origin[0] = v.x; s.origin[1] = v.y; s.origin[2] = v.z;
    this.tmpD.set(0, 0, -1).applyQuaternion(q).transformDirection(m);
    s.dir[0] = this.tmpD.x; s.dir[1] = this.tmpD.y; s.dir[2] = this.tmpD.z;
    void T; return true;
  }

  private updateHover(s: Src): void {
    // only a tracked pointer hovers, and not while it is pressing (a press shows the pressed state instead)
    const pressing = this.pressed.has(s.key);
    let id: string | null = null, panel: XrPanel | null = null;
    if (s.tracked && !pressing && s.hit && s.hit.widget && s.hit.widget.enabled) { id = s.hit.widget.id; panel = s.hit.panel; }
    if (s.hoverPanel && (s.hoverPanel !== panel || s.hoverId !== id)) { s.hoverPanel.setHover(null); }
    if (panel) panel.setHover(id);
    if (id && id !== s.hoverId) { if (pulse(s.xr, 0.3, 25)) this.haptics.hover++; }
    s.hoverPanel = panel; s.hoverId = id;
    // the pressed look follows the ray: pressed while it is still over the widget that took the press, plain when it has slid off
    const pr = this.pressed.get(s.key);
    if (pr && pr.widget) pr.panel.setPressed(s.hit && s.hit.panel === pr.panel && s.hit.widget === pr.widget ? pr.widget.id : null);
  }

  private setKind(): void {
    let k: TargetKind = 'ray';
    for (const s of this.srcs.values()) { if (s.mode === 'transient-pointer' || s.mode === 'gaze') k = 'gazePinch'; else if (s.hand && k === 'ray') k = 'handRay'; }
    if (k !== this.kind) { this.kind = k; this.d.onKind(k); }
  }
  /** called by the kit once at mount (the tier says `vision` before any pinch exists) */
  forceKind(k: TargetKind): void { if (k !== this.kind) { this.kind = k; this.d.onKind(k); } }

  // ---------------------------------------------------------------------------------------------------------------------- sources
  private addSource(x: any): Src {
    const T = this.T;
    const s: Src = {
      key: 's' + this.nextId, xr: x, id: this.nextId++, tracked: x.targetRayMode === 'tracked-pointer', hand: !!x.hand, mode: x.targetRayMode,
      has: false, origin: [0, 0, 0], dir: [0, 0, -1], hit: null, hoverPanel: null, hoverId: null, selectHandled: false, downAt: -1,
      ray: new T.Mesh(this.rayGeo, this.rayMat), dot: new T.Mesh(this.dotGeo, this.dotMat), proxy: null, gripOk: false,
    };
    for (const o of [s.ray, s.dot]) { o.visible = false; o.frustumCulled = false; o.renderOrder = 1300; o.raycast = () => {}; o.userData.xrOverlay = true; this.d.group.add(o); }
    s.ray.name = 'xr ui: ray'; s.dot.name = 'xr ui: hit dot';
    // a controller gets the proxy; a hand, a gaze or a transient pointer has no body of its own to draw
    if (s.tracked && !s.hand && x.gripSpace) {
      s.proxy = new T.Mesh(this.proxyGeo, this.proxyMat); s.proxy.name = 'xr ui: controller proxy'; s.proxy.visible = false; s.proxy.frustumCulled = false; s.proxy.renderOrder = 1290; s.proxy.matrixAutoUpdate = false; s.proxy.raycast = () => {};
      this.d.group.add(s.proxy);
    }
    this.srcs.set(x, s); this.log.push({ ev: 'add', src: `${x.handedness}/${x.targetRayMode}` });
    return s;
  }
  private removeSource(x: any, s: Src, why: string): void {
    this.cancelKey(s.key, why);
    s.hoverPanel?.setHover(null);
    this.dropVisuals(s); this.srcs.delete(x); this.log.push({ ev: 'remove:' + why, src: `${x.handedness}/${x.targetRayMode}` });
  }
  private dropVisuals(s: Src): void { for (const o of [s.ray, s.dot, s.proxy]) o?.removeFromParent(); }
  private hideVisuals(s: Src): void { s.ray.visible = false; s.dot.visible = false; if (s.proxy) s.proxy.visible = false; }

  private updateVisuals(s: Src, frame: any, ref: any): void {
    const h = s.hit, show = !!h && s.tracked;
    s.ray.visible = show; s.dot.visible = show;
    if (show && h) {
      const d = h.dist;
      s.ray.position.set(s.origin[0] + s.dir[0] * d / 2, s.origin[1] + s.dir[1] * d / 2, s.origin[2] + s.dir[2] * d / 2);
      s.ray.quaternion.setFromUnitVectors(this.tmpD.set(0, 0, -1), this.tmpV.set(s.dir[0], s.dir[1], s.dir[2]));
      s.ray.scale.set(0.004, 0.004, d);
      const n = h.panel.basis.n;
      s.dot.position.set(h.point[0] + n[0] * 0.004, h.point[1] + n[1] * 0.004, h.point[2] + n[2] * 0.004);
      s.dot.quaternion.copy(h.panel.mesh.quaternion);
      const sc = this.pressed.has(s.key) ? 1.5 : 1; s.dot.scale.set(sc, sc, 1);
    }
    if (s.proxy) {
      const gp = s.xr.gripSpace ? frame.getPose(s.xr.gripSpace, ref) : null;
      if (gp) {
        const t = gp.transform; this.tmpQ.set(t.orientation.x, t.orientation.y, t.orientation.z, t.orientation.w);
        this.mat.compose(this.tmpV.set(t.position.x, t.position.y, t.position.z), this.tmpQ, this.tmpD.set(1, 1, 1)).premultiply(this.d.rigGroup.matrixWorld);
        s.proxy.matrix.copy(this.mat); s.proxy.matrixWorldNeedsUpdate = true; s.proxy.visible = true;
      } else s.proxy.visible = false;
    }
  }

  // ---------------------------------------------------------------------------------------------------------------------- events
  private src(e: any): Src | null { return e?.inputSource ? (this.srcs.get(e.inputSource) || this.addSource(e.inputSource)) : null; }
  /** the hit of this source at the time of the event: from the event's own frame when it has one (a pinch's ray is only valid in that frame) */
  private hitAt(s: Src, e: any) {
    const ref = this.d.renderer.xr.getReferenceSpace?.();
    if (e.frame && ref) { this.d.rigGroup.updateMatrixWorld(true); if (this.readRay(s, e.frame, ref)) { const h = this.nearest(s.origin, s.dir); s.hit = h ? { panel: h.panel, widget: h.widget, dist: h.dist, point: h.point } : null; return s.hit; } }
    return s.hit;
  }
  private onSelectStart(e: any): void {
    if (this.viaRegistry()) return;
    const s = this.src(e); if (!s) return;
    if (s.selectHandled) return;                    // IWER: `select` came first and did the whole press
    const h = this.hitAt(s, e); if (!h) return;
    this.beginPress(s.key, h.panel, h.widget);
  }
  private onSelect(e: any): void {
    if (this.viaRegistry()) return;
    const s = this.src(e); if (!s) return;
    if (this.pressed.has(s.key)) return;            // the usual order: selectstart pressed, selectend will release
    const h = this.hitAt(s, e); if (!h) return;
    s.selectHandled = true;
    this.beginPress(s.key, h.panel, h.widget);
    this.endPress(s.key, { panel: h.panel, widget: h.widget }, false);
  }
  private onSelectEnd(e: any): void {
    if (this.viaRegistry()) return;
    const s = this.src(e); if (!s) return;
    if (s.selectHandled) { s.selectHandled = false; return; }
    if (!this.pressed.has(s.key)) return;
    const h = this.hitAt(s, e);
    this.endPress(s.key, h ? { panel: h.panel, widget: h.widget } : null, false);
  }
  private onSourcesChange(e: any): void {
    for (const x of e.removed || []) { const s = this.srcs.get(x); if (s) this.removeSource(x, s, 'removed'); }
    for (const x of e.added || []) if (!this.srcs.has(x)) this.addSource(x);
  }

  // ---------------------------------------------------------------------------------------------------------------------- press
  beginPress(key: string, panel: XrPanel, widget: Widget | null): void {
    this.cancelKey(key, 'new-press');
    this.pressed.set(key, { panel, widget });
    if (widget && widget.enabled) { panel.setPressed(widget.id); this.buzz(key, 0.6, 40, 'press'); }
    this.log.push({ ev: 'press', src: key, id: widget?.id ?? null });
  }
  endPress(key: string, now: { panel: XrPanel; widget: Widget | null } | null, cancelled: boolean): void {
    const p = this.pressed.get(key); if (!p) return;
    this.pressed.delete(key);
    p.panel.setPressed(null);
    const hit = !cancelled && now && now.panel === p.panel && p.widget && now.widget && now.widget.id === p.widget.id && p.widget.enabled;
    this.log.push({ ev: hit ? 'activate' : 'release', src: key, id: p.widget?.id ?? null });
    if (hit && p.widget) this.d.onActivate(p.panel, p.widget);
  }
  private cancelKey(key: string, why: string): void {
    const p = this.pressed.get(key); if (!p) return;
    this.pressed.delete(key); p.panel.setPressed(null);
    this.log.push({ ev: 'cancel:' + why, src: key, id: p.widget?.id ?? null });
  }
  cancelAll(why: string): void { for (const k of [...this.pressed.keys()]) this.cancelKey(k, why); }

  private buzz(key: string, intensity: number, ms: number, kind: 'hover' | 'press'): void {
    const s = [...this.srcs.values()].find(x => x.key === key);
    // a press delivered by the registry names a source by the registry's id, not ours: ask the registry's own actuator
    if (s) { if (pulse(s.xr, intensity, ms)) this.haptics[kind]++; return; }
    if (key[0] === 'r') { try { this.d.input.haptic(Number(key.slice(1)), intensity, ms); this.haptics[kind]++; } catch { /* no actuator */ } }
  }

  // ---------------------------------------------------------------------------------------------------------------------- test hooks
  debug() {
    return {
      kind: this.kind, pointing: this.pointingAtPanel, haptics: { ...this.haptics }, pressed: [...this.pressed.entries()].map(([k, v]) => ({ key: k, id: v.widget?.id ?? null })),
      sources: [...this.srcs.values()].map(s => ({ id: s.id, mode: s.mode, tracked: s.tracked, hand: s.hand, has: s.has, hover: s.hoverId, hit: s.hit ? { panel: s.hit.panel.name, id: s.hit.widget?.id ?? null, dist: s.hit.dist } : null })),
      log: this.log.slice(-40),
    };
  }
}
export type { InputSourceInfo };
