// assets/xr/ui/index.ts : the in-world UI kit. Implements XrUi (assets/xr/host.ts): panels, the ray, the menu, toasts, the entry status card and the
// XR Presenter of the story tour. Loaded by xr/session.ts after the person has asked for VR, so none of it reaches a visitor who never does.
//
// WHAT IT IS. Canvas2D panels (panel.ts, paint.ts): one quad and one CanvasTexture each, drawn at 1.5x the headset's pixels per degree with
// mipmaps and anisotropy 8, sized in DEGREES of visual angle from presenter.ts (XR_LEGIBILITY, XR_COMFORT, XR_BUDGET are the only source of
// sizes). No new dependency, no font fetch (Manrope is the page's own woff2), no controller model fetch (ray.ts draws a proxy).
// WHAT IT TOUCHES. A Group added to the scene (and removed at unmount). Nothing on the renderer, the camera or the page's DOM, so there is
// nothing to restore except that Group, the textures it holds and the listeners on the session. The rig's heightOffset is the one thing it writes
// (from the menu's height setting) and it puts it back to 0.
// WHAT IT NEVER DOES. Move the person (only Rig.moveTo, in the presenter), fetch anything, read a wall clock for anything a frame draws, or take
// the ray away from the locomotion module except where a panel is under it (priority 100 in the input registry).
import type { XrFrame, XrHost, XrInput, XrLocomotion, XrRig, XrUi } from '../host.js';
import type { Presenter, PresenterFault, PresenterHost, V3 } from '../presenter.js';
import { XR_BUDGET, XR_COMFORT, XR_LEGIBILITY } from '../presenter.js';
import { coneOfEye, createSettings, metricsFor, ppdOfEye, texelsPerDegFor, type SettingsStore, type UiKit, type UiSettings } from './kit.js';
import { Menu } from './menu.js';
import { ctxMeasure, type Measure } from './paint.js';
import { PanelSet } from './panel.js';
import { RayHub, type TargetKind } from './ray.js';
import { createXrPresenter, type XrPresenterApi } from './tour-presenter.js';
import { StatusCard, ToastTray } from './toast.js';

const FONT_LOADS = ['500 32px "VH Manrope"', '600 32px "VH Manrope"', '700 32px "VH Manrope"', '800 32px "VH Manrope"'];
const DEFAULT_PPD = 20, PPD_RECHECK_FRAMES = 90;

export interface UiDebug {
  texts(): string[];
  head(): { pos: V3; dir: V3; yawDeg: number };
  world(): import('../host.js').XrLocomotion['world'] | null;
  /** metres from `from` along `dir` to the first solid surface of the scene (Infinity if none within 40 m): for the demo's choice of open spots only; slow, never per frame */
  freeDistance(from: V3, dir: V3): number;
  footprint(): { nodes: number; textureBytes: number; drawCalls: number };
  panels(): Array<{ name: string; visible: boolean; opacity: number; px: [number, number]; sizeM: [number, number]; centre: V3; widgets: Array<{ id: string; x: number; y: number; w: number; h: number; enabled: boolean }>; hover: string | null; pressed: string | null; uploads: number }>;
  hub(): ReturnType<RayHub['debug']>;
  /** canvas pixel [r,g,b,a] of a panel */
  pixel(panel: string, x: number, y: number): number[] | null;
  /** the centre of a widget in the TRACKING space (what an emulated controller aims at), and in the world */
  widget(panel: string, id: string, fx?: number): { tracking: V3; world: V3 } | null;
  press(panel: string, id: string): boolean;
  ppd(): { ppd: number; texelsPerDeg: number; targetDeg: number; cone: { azHalf: number; elMin: number; elMax: number } };
  menu(): { open: boolean; page: string; texts: string[]; activations: string[] };
  toasts(): string[];
  status(): string[];
  motionLog(): Array<{ frame: number; fade: number; moved: boolean }>;
  /** the demo flow (demo.ts) loaded on demand: nothing of it is in a visitor's download */
  demo(): Promise<typeof import('./demo.js')>;
}
export type XrUiImpl = XrUi & { settings: SettingsStore; menu: Menu | null; debug: UiDebug; presenter(host?: PresenterHost): XrPresenterApi | null };

export function createUi(host: XrHost): XrUiImpl {
  const T = host.THREE;
  let mounted = false, group: any = null, panels: PanelSet | null = null, hub: RayHub | null = null, menu: Menu | null = null, toasts: ToastTray | null = null, status: StatusCard | null = null;
  let rig: XrRig | null = null, input: XrInput | null = null, loco: XrLocomotion | null = null;
  let presenter: XrPresenterApi | null = null;
  let settings: SettingsStore = createSettings(undefined, false);
  let frameNo = 0, nowMs = 0, headNow: { pos: V3; dir: V3; yawDeg: number } = { pos: [0, 1.6, 0], dir: [0, 0, -1], yawDeg: 0 };
  let ppd = DEFAULT_PPD, fixedPpd = false, fonts = false, tKind: TargetKind = 'ray';
  let cone = { azHalf: 50, elMin: -38, elMax: 32 };
  const frameCbs = new Set<(f: XrFrame) => void>(), relayoutCbs = new Set<() => void>(), endCbs = new Set<() => void>(), visCbs = new Set<(s: 'visible' | 'blurred' | 'hidden') => void>();
  const offs: Array<() => void> = [];
  const motion: Array<{ frame: number; fade: number; moved: boolean }> = [];
  let prevHead: V3 | null = null;
  const prevBtn = new WeakMap<object, boolean>();
  const scratch = document.createElement('canvas').getContext('2d')!;
  const measure: Measure = ctxMeasure(scratch);
  const faults: Array<{ code: PresenterFault; detail?: string }> = [];

  const kit: UiKit = {
    THREE: T, host, get rig() { return rig!; }, get input() { return input!; }, get loco() { return loco; },
    get group() { return group; }, get panels() { return panels!; }, get hub() { return hub!; },
    get settings() { return settings; }, measure,
    head: () => headNow, frame: () => frameNo, now: () => nowMs,
    ppd: () => ppd, texelsPerDeg: () => texelsPerDegFor(ppd), viewCone: () => cone,
    targetDeg: () => (tKind === 'gazePinch' ? XR_LEGIBILITY.targetDeg.gazePinch : tKind === 'handRay' ? XR_LEGIBILITY.targetDeg.handRay : XR_LEGIBILITY.targetDeg.ray),
    metrics: (d, o) => metricsFor(kit, d, o),
    fault(code, detail) { faults.push({ code, detail }); if (faults.length > 50) faults.shift(); console.warn(`xr ui: ${code}${detail ? ' ' + detail : ''}`); },
    onFrame: (cb) => { frameCbs.add(cb); return () => { frameCbs.delete(cb); }; },
    onRelayout: (cb) => { relayoutCbs.add(cb); return () => { relayoutCbs.delete(cb); }; },
    onEnd: (cb) => { endCbs.add(cb); return () => { endCbs.delete(cb); }; },
    onVisibility: (cb) => { visCbs.add(cb); return () => { visCbs.delete(cb); }; },
    exit() { try { void (window as any).__houseViewer?.xr?.end('user'); } catch (e) { console.warn('xr ui: could not end the session', e); } },
    toast: (text, kind, ms) => { toasts?.push(text, kind, ms); },
    fontsOk: () => fonts,
    motionLog: () => motion.slice(),
    footprint() {
      let calls = 0; if (group) group.traverseVisible((o: any) => { if (o.isMesh) calls++; });
      return { nodes: group ? group.children.length : 0, textureBytes: panels ? panels.textureBytes() : 0, drawCalls: calls };
    },
  };
  const relayout = () => { for (const cb of [...relayoutCbs]) { try { cb(); } catch (e) { console.warn('xr ui: relayout failed', e); } } };

  function measurePpd(): void {
    const o = host.params.get('xrppd');
    if (o && +o > 0) { ppd = Math.min(80, Math.max(6, +o)); fixedPpd = true; return; }
    try {
      const cams = host.renderer.xr.getCamera().cameras, eye = cams && cams[0];
      if (eye && eye.viewport && eye.viewport.z > 0) {
        const c = coneOfEye(eye.projectionMatrix.elements); if (c) cone = c;
        const v = ppdOfEye(eye.viewport.z, eye.projectionMatrix.elements);
        if (v > 0) {
          const next = Math.min(80, Math.max(6, v));
          // re-lay out only when the number really moved (the frame-rate controller changes the framebuffer scale in steps)
          if (Math.abs(next - ppd) / ppd > 0.12) { ppd = next; relayout(); } else if (frameNo < 3) ppd = next;
        }
      }
    } catch { /* keep the last */ }
  }

  async function loadFonts(): Promise<boolean> {
    try {
      const fs = (document as any).fonts; if (!fs || !fs.load) return false;
      const done = await Promise.race([Promise.all(FONT_LOADS.map(f => fs.load(f))), new Promise<null>(r => setTimeout(() => r(null), 2500))]);
      return !!done && (done as FontFace[][]).some(a => a.length > 0);
    } catch { return false; }
  }

  const ui: XrUiImpl = {
    get settings() { return settings; }, get menu() { return menu; },

    async mount(r, inp, lo) {
      if (mounted) return;
      rig = r; input = inp; loco = lo;
      fonts = await loadFonts();
      settings = createSettings();
      group = new T.Group(); group.name = 'xr ui'; host.scene.add(group);
      const accent = settings.get().contrast === 'high' ? '#ffffff' : '#c5e8dc';
      panels = new PanelSet(T, host.renderer, group, (code, detail) => kit.fault(code, detail));
      hub = new RayHub({
        THREE: T, renderer: host.renderer, group, rigGroup: r.group, input: inp, panels, accent,
        onActivate: (panel, w) => { try { panel.activate?.(w); } catch (e) { console.warn('xr ui: a widget handler threw', e); } },
        onKind: (k) => { if (k !== tKind) { tKind = k; relayout(); } },
        log: (m) => console.debug('xr ui:', m),
      });
      measurePpd();
      // visionOS: no controller exists until the first pinch, but the tier tells us the pointing is gaze + pinch from the start
      try { if ((window as any).__houseViewer?.xr?.tier?.name === 'vision') hub.forceKind('gazePinch'); } catch { /* unknown */ }
      toasts = new ToastTray(kit); status = new StatusCard(kit);
      menu = new Menu(kit);
      menu.dock.show();
      hub.attach();
      // the dominant hand's height and the other settings the locomotion module reads
      const apply = (s: UiSettings, changed: Array<keyof UiSettings>) => {
        if (changed.includes('heightCm') && rig) rig.heightOffset = s.heightCm / 100;
        if (changed.includes('textScale') || changed.includes('contrast')) relayout();
        try { window.dispatchEvent(new CustomEvent('vh:xr-settings', { detail: { ...s, changed } })); } catch { /* not in a page */ }
      };
      offs.push(settings.on(apply));
      if (settings.get().heightCm) rig.heightOffset = settings.get().heightCm / 100;
      if (settings.get().handedness) { /* read by the menu when it opens */ }
      offs.push(inp.on('menu', () => menu?.toggle()));
      const session = host.renderer.xr.getSession?.();
      if (session) {
        const vis = () => { const st = session.visibilityState; for (const cb of [...visCbs]) cb(st === 'visible' ? 'visible' : st === 'hidden' ? 'hidden' : 'blurred'); };
        session.addEventListener('visibilitychange', vis); offs.push(() => session.removeEventListener('visibilitychange', vis));
      }
      mounted = true;
    },

    tick(f) {
      if (!mounted || !panels || !hub || !menu) return;
      frameNo++; nowMs = f.time; headNow = f.head;
      if (!fixedPpd && (frameNo === 1 || frameNo % PPD_RECHECK_FRAMES === 0)) measurePpd();
      // the comfort record: the head moved, and how black the view was at that moment
      if (prevHead) {
        const d = Math.hypot(f.head.pos[0] - prevHead[0], f.head.pos[1] - prevHead[1], f.head.pos[2] - prevHead[2]);
        if (d > XR_COMFORT.headStepM) { motion.push({ frame: frameNo, fade: rig ? rig.fade.get() : 0, moved: true }); if (motion.length > 400) motion.shift(); }
      }
      prevHead = f.head.pos;
      hub.update(f);
      pollMenuButton(f);
      for (const cb of [...frameCbs]) { try { cb(f); } catch (e) { console.warn('xr ui: a frame callback threw', e); } }
      menu.tick(f); toasts?.tick(f); status?.tick(f);
      panels.tick(f.dt);
    },

    toast(text, kind, ms) { toasts?.push(text, kind, ms); },
    showStatus(s) { status?.set(s ? { title: s.title, body: s.body, progress: s.progress } : null); },

    presenter(h?: PresenterHost) {
      if (!mounted || !menu) return null;
      if (!presenter || presenter.disposed) presenter = createXrPresenter(kit, menu);
      if (h) presenter.attach(h);
      return presenter;
    },

    unmount() {
      if (!mounted && !group) return;
      mounted = false;
      for (const cb of [...endCbs]) { try { cb(); } catch { /* gone */ } }
      endCbs.clear(); frameCbs.clear(); relayoutCbs.clear(); visCbs.clear();
      try { presenter?.dispose(); } catch { /* gone */ } presenter = null;
      for (const f of offs.splice(0)) { try { f(); } catch { /* gone */ } }
      try { hub?.detach(); } catch { /* gone */ }
      try { menu?.dispose(); toasts?.dispose(); status?.dispose(); } catch { /* gone */ }
      try { panels?.dispose(); } catch { /* gone */ }
      if (rig && settings.get().heightCm) { try { rig.heightOffset = 0; } catch { /* the rig is gone */ } }
      group?.removeFromParent(); group = null; panels = null; hub = null; menu = null; toasts = null; status = null; rig = null; input = null; loco = null;
      prevHead = null; motion.length = 0;
    },

    debug: {
      texts: () => {
        const out: string[] = [];
        if (presenter) out.push(...presenter.debug.texts());
        if (menu?.open) out.push(...menu.texts);
        if (toasts?.current) out.push(toasts.current);
        if (status) out.push(...status.texts);
        return out;
      },
      head: () => headNow,
      world: () => (loco ? loco.world : null),
      freeDistance(from, dir) {
        const rc = new T.Raycaster(new T.Vector3(...from), new T.Vector3(...dir).normalize(), 0.05, 40);
        const hits = rc.intersectObjects(host.scene.children.filter((o: any) => o !== group && !o.userData.xrOverlay && o.name !== 'xr: rig'), true);
        for (const h of hits) { const m = h.object.material; if (h.object.visible && !(m && (m.transparent && m.opacity < 0.3))) return h.distance; }
        return Infinity;
      },
      footprint: () => kit.footprint(),
      panels: () => (panels ? panels.panels.map(p => ({
        name: p.name, visible: p.visible, opacity: p.opacityNow, px: [p.canvas.width, p.canvas.height] as [number, number], sizeM: [p.widthM, p.heightM] as [number, number], centre: p.centre,
        widgets: p.widgets.map(w => ({ id: w.id, x: w.x, y: w.y, w: w.w, h: w.h, enabled: w.enabled })), hover: p.hover, pressed: p.pressed, uploads: p.uploads,
      })) : []),
      hub: () => (hub ? hub.debug() : { kind: 'ray', pointing: false, haptics: { hover: 0, press: 0 }, pressed: [], sources: [], log: [] }),
      pixel(panel, x, y) {
        const p = panels?.panels.find(q => q.name === panel); if (!p) return null;
        try { return Array.from(p.g.getImageData(Math.round(x), Math.round(y), 1, 1).data); } catch { return null; }
      },
      widget(panel, id, fx = 0.5) {
        const p = panels?.panels.find(q => q.name === panel), w = p?.widgets.find(q => q.id === id); if (!p || !w || !rig) return null;
        const u = (w.x + w.w * fx) / p.canvas.width - 0.5, v = 0.5 - (w.y + w.h / 2) / p.canvas.height, b = p.basis;
        const world: V3 = [p.centre[0] + b.r[0] * u * p.widthM + b.u[0] * v * p.heightM, p.centre[1] + b.r[1] * u * p.widthM + b.u[1] * v * p.heightM, p.centre[2] + b.r[2] * u * p.widthM + b.u[2] * v * p.heightM];
        rig.group.updateMatrixWorld(true);
        const t = new T.Vector3(world[0], world[1], world[2]).applyMatrix4(rig.group.matrixWorld.clone().invert());
        return { tracking: [t.x, t.y, t.z] as V3, world };
      },
      press(panel, id) { const p = panels?.panels.find(q => q.name === panel), w = p?.widgets.find(q => q.id === id); if (!p || !w || !p.activate) return false; p.activate(w); return true; },
      ppd: () => ({ ppd, texelsPerDeg: texelsPerDegFor(ppd), targetDeg: kit.targetDeg(), cone }),
      menu: () => ({ open: !!menu?.open, page: menu ? menu.currentPage : '', texts: menu ? menu.texts : [], activations: menu ? menu.activations.slice() : [] }),
      toasts: () => (toasts ? toasts.shown.slice() : []),
      status: () => (status ? status.texts : []),
      motionLog: () => motion.slice(),
      demo: () => import('./demo.js'),
    },
  };

  /** controllers: the secondary face button (Y on the left, B on the right) opens and closes the menu */
  function pollMenuButton(_f: XrFrame): void {
    const session = host.renderer.xr.getSession?.(); if (!session || !menu) return;
    for (const s of session.inputSources) {
      const gp = s.gamepad; if (!gp || s.hand || s.targetRayMode !== 'tracked-pointer') continue;
      const b = gp.buttons && gp.buttons[5], now = !!(b && b.pressed), was = prevBtn.get(s) || false;
      prevBtn.set(s, now);
      if (now && !was) menu.toggle();
    }
  }

  void XR_BUDGET;
  return ui;
}
