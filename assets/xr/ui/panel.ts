// assets/xr/ui/panel.ts : a flat Canvas2D panel in the world. One quad, one CanvasTexture, one draw call.
//
// A panel is sized in DEGREES: `widthDeg` across at `distance` metres gives its width in metres, and its canvas is `widthDeg x texelsPerDeg`
// pixels wide, so the text on it has the same angular size wherever the panel stands (paint.ts draws in those pixels). The texture has
// mipmaps and anisotropy 8: a panel is almost never seen square-on, and without them its small text shimmers with every head movement.
//
// A panel owns its widgets' hit rectangles (from the Layout that painted it), the hover and pressed ids the ray hub sets, and its fade.
// It redraws at most once per frame and only when something changed (a layout, a hover, a pressed id): a still card costs no upload.
import type { V3 } from '../presenter.js';
import { XR_BUDGET } from '../presenter.js';
import { panelBasis, rayPanel, rectAt, uvToPx, type Basis, type PanelRayHit } from './hit.js';
import { execOps, stateOf, widgetOps, type Layout, type Metrics, type Widget } from './paint.js';
import { chordM } from './place-world.js';

export interface PanelOpts {
  name: string;
  /** world-locked cards test against the house's depth; head-locked overlays (captions, menu, toasts) draw over everything, as the HUD chip does */
  world: boolean;
  /** can the ray press things on it? A toast never takes the ray. */
  interactive: boolean;
  renderOrder: number;
}

const MIP_FACTOR = 4 / 3;

export class XrPanel {
  readonly name: string;
  readonly mesh: any;
  readonly canvas: HTMLCanvasElement;
  readonly g: CanvasRenderingContext2D;
  readonly interactive: boolean;
  tex: any; mat: any;
  widthDeg = 0; widthM = 1; heightM = 1;
  centre: V3 = [0, 0, 0]; yaw = 0; tiltDeg = 0;
  basis: Basis = panelBasis(0, 0);
  layout: Layout | null = null;
  metrics: Metrics | null = null;
  widgets: Widget[] = [];
  hover: string | null = null; pressed: string | null = null;
  uploads = 0;
  /** the owner's handler for a press-and-release on one of this panel's widgets */
  activate: ((w: Widget) => void) | null = null;
  private dirty = false;
  private opacity = 0; private fadeTo = 0; private fadeRate = 0;
  private hideAtZero = true;

  constructor(private set: PanelSet, o: PanelOpts) {
    const T = set.THREE;
    this.name = o.name; this.interactive = o.interactive;
    this.canvas = document.createElement('canvas'); this.canvas.width = 4; this.canvas.height = 4;
    this.g = this.canvas.getContext('2d')!;
    this.tex = this.makeTexture();
    this.mat = new T.MeshBasicMaterial({ map: this.tex, transparent: true, toneMapped: false, depthWrite: false, depthTest: o.world, fog: false, opacity: 0, side: T.FrontSide });
    this.mesh = new T.Mesh(set.quad, this.mat);
    this.mesh.name = `xr ui: ${o.name}`; this.mesh.renderOrder = o.renderOrder; this.mesh.frustumCulled = false; this.mesh.visible = false;
    this.mesh.rotation.order = 'YXZ'; this.mesh.userData.xrOverlay = true;
    this.mesh.raycast = () => {};   // the ray hub does the hit test (and never the scene's own raycaster: a panel is not part of the house)
  }

  private makeTexture(): any {
    const T = this.set.THREE, tex = new T.CanvasTexture(this.canvas);
    tex.colorSpace = T.SRGBColorSpace; tex.generateMipmaps = true; tex.minFilter = T.LinearMipmapLinearFilter; tex.magFilter = T.LinearFilter;
    tex.anisotropy = this.set.anisotropy;
    return tex;
  }

  /** bytes the texture holds on the GPU (RGBA8 with a full mip chain) */
  get bytes(): number { return Math.round(this.canvas.width * this.canvas.height * 4 * MIP_FACTOR); }

  /** Give the panel its content: size the canvas to the layout (angular width x texels per degree), keep the world size in step. */
  setLayout(L: Layout, m: Metrics, widthDeg: number, distance: number): void {
    const wpx = Math.max(8, Math.round(L.w)), hpx = Math.max(8, Math.round(L.h));
    if (this.canvas.width !== wpx || this.canvas.height !== hpx) {
      this.set.reserve(this, wpx * hpx * 4 * MIP_FACTOR);
      this.canvas.width = wpx; this.canvas.height = hpx;
      // a texture whose size changed must be re-created on the GPU, not re-uploaded over
      this.tex.dispose(); this.tex = this.makeTexture(); this.mat.map = this.tex; this.mat.needsUpdate = true;
    }
    this.widthDeg = widthDeg; this.widthM = chordM(widthDeg, distance); this.heightM = this.widthM * hpx / wpx;
    this.mesh.scale.set(this.widthM, this.heightM, 1);
    this.layout = L; this.metrics = m; this.widgets = L.widgets; this.dirty = true;
    this.hover = null; this.pressed = null;
  }
  /** a pose from the placement solver (or the follower): centre, yaw (rad), tilt (deg) */
  setPose(centre: V3, yaw: number, tiltDeg: number): void {
    this.centre = centre; this.yaw = yaw; this.tiltDeg = tiltDeg; this.basis = panelBasis(yaw, tiltDeg);
    this.mesh.position.set(centre[0], centre[1], centre[2]); this.mesh.rotation.set(-tiltDeg * Math.PI / 180, yaw, 0);
  }
  /** set the world size directly (the placement solver's metres), keeping the canvas as it is */
  setWorldSize(widthM: number, heightM: number): void { this.widthM = widthM; this.heightM = heightM; this.mesh.scale.set(widthM, heightM, 1); }

  invalidate(): void { this.dirty = true; }
  setHover(id: string | null): boolean { if (id === this.hover) return false; this.hover = id; this.dirty = true; return true; }
  setPressed(id: string | null): boolean { if (id === this.pressed) return false; this.pressed = id; this.dirty = true; return true; }

  /** appear / disappear over `secs` (0: at once). `hide` takes the mesh out of the scene's draw list at zero. */
  show(secs = 0.15): void { this.fadeTo = 1; this.fadeRate = secs > 0 ? 1 / secs : Infinity; this.mesh.visible = true; if (secs <= 0) this.opacity = 1; this.mat.opacity = this.opacity; }
  hide(secs = 0.15): void { this.fadeTo = 0; this.fadeRate = secs > 0 ? 1 / secs : Infinity; if (secs <= 0) { this.opacity = 0; this.mat.opacity = 0; this.mesh.visible = false; this.hover = null; this.pressed = null; } }
  /** the target opacity of a visible panel (a card steps back after it has been read) */
  dim(to: number, secs = 0.4): void { this.fadeTo = to; this.fadeRate = 1 / secs; }
  get visible(): boolean { return this.mesh.visible && this.opacity > 0.01; }
  get opacityNow(): number { return this.opacity; }
  get shown(): boolean { return this.fadeTo > 0; }

  /** per frame: the fade, then the redraw if something changed. Returns true when it uploaded a texture. */
  tick(dt: number): boolean {
    if (this.opacity !== this.fadeTo) {
      const step = this.fadeRate * dt;
      this.opacity = this.opacity < this.fadeTo ? Math.min(this.fadeTo, this.opacity + step) : Math.max(this.fadeTo, this.opacity - step);
      this.mat.opacity = this.opacity;
      if (this.opacity <= 0.001 && this.fadeTo === 0) { this.opacity = 0; this.mat.opacity = 0; this.mesh.visible = false; this.hover = null; this.pressed = null; }
    }
    if (this.dirty && this.layout && this.mesh.visible) return this.flush();
    return false;
  }
  flush(): boolean {
    const L = this.layout, m = this.metrics; if (!L || !m) return false;
    const g = this.g;
    g.clearRect(0, 0, this.canvas.width, this.canvas.height);
    execOps(g, L.ops);
    if (m.interactive) { m.hover = this.hover; m.pressed = this.pressed; for (const w of L.widgets) execOps(g, widgetOps(w, stateOf(w, m), m)); }
    this.tex.needsUpdate = true; this.dirty = false; this.uploads++;
    return true;
  }

  /** where a world ray meets this panel (front face only) and the widget under it, if any */
  hit(origin: V3, dir: V3, maxDist = Infinity): (PanelRayHit & { widget: Widget | null; px: [number, number] }) | null {
    if (!this.interactive || !this.visible || this.opacity < 0.3) return null;
    const h = rayPanel(origin, dir, this.centre, this.basis, this.widthM, this.heightM, maxDist);
    if (!h) return null;
    const px = uvToPx(h.uv, this.canvas.width, this.canvas.height);
    const slack = this.metrics ? this.metrics.gapPx * 0.4 : 0;
    return { ...h, widget: rectAt(this.widgets, px[0], px[1], slack), px };
  }

  dispose(): void {
    this.mesh.removeFromParent(); this.tex.dispose(); this.mat.dispose();
    this.set.release(this);
  }
}

export class BudgetError extends Error { constructor(msg: string) { super(msg); this.name = 'BudgetError'; } }

/** The panels of one session: they share a quad, count against the budget (8 panels, 24 MB of textures) and are disposed together. */
export class PanelSet {
  readonly panels: XrPanel[] = [];
  readonly quad: any;
  readonly anisotropy: number;
  /** the headset's centre pixels per degree and the canvas density derived from it; the kit re-lays out when they move */
  constructor(readonly THREE: any, renderer: any, readonly group: any, private onFault: (code: 'budget-exceeded' | 'texture-failed', detail: string) => void) {
    this.quad = new THREE.PlaneGeometry(1, 1);
    this.anisotropy = Math.min(8, renderer.capabilities?.getMaxAnisotropy?.() ?? 1);
  }
  create(o: PanelOpts): XrPanel {
    if (this.panels.length >= XR_BUDGET.panels) { this.onFault('budget-exceeded', `panel ${o.name}: ${XR_BUDGET.panels} panels already exist`); throw new BudgetError(`more than ${XR_BUDGET.panels} panels`); }
    const p = new XrPanel(this, o);
    this.panels.push(p); this.group.add(p.mesh);
    return p;
  }
  /** called before a panel grows: refuse a texture that would take the set over its budget */
  reserve(p: XrPanel, newBytes: number): void {
    const others = this.panels.reduce((s, q) => s + (q === p ? 0 : q.bytes), 0);
    if (others + newBytes > XR_BUDGET.textureBytes) { this.onFault('budget-exceeded', `panel ${p.name}: ${Math.round((others + newBytes) / 1048576)} MB of textures`); throw new BudgetError('texture budget'); }
  }
  release(p: XrPanel): void { const i = this.panels.indexOf(p); if (i >= 0) this.panels.splice(i, 1); }
  textureBytes(): number { return this.panels.reduce((s, p) => s + p.bytes, 0); }
  /** panels that take the ray, nearest first by the caller's own test */
  interactive(): XrPanel[] { return this.panels.filter(p => p.interactive && p.visible); }
  tick(dt: number): number { let up = 0; for (const p of this.panels) if (p.tick(dt)) up++; return up; }
  dispose(): void {
    for (const p of this.panels.slice()) p.dispose();
    this.quad.dispose();
  }
}
