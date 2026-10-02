// assets/xr/ui/kit.ts : what the kit's parts share (panels, the ray hub, settings, the sizes) and the small things they all need.
// Types and four pure helpers; index.ts builds the one KitImpl and hands it to the caption, card, menu, toast and presenter.
import type { Handedness, XrFrame, XrHost, XrInput, XrLocomotion, XrRig } from '../host.js';
import type { PresenterFault, V3 } from '../presenter.js';
import { XR_LEGIBILITY } from '../presenter.js';
import type { Measure, Metrics } from './paint.js';
import { makeMetrics } from './paint.js';
import type { RayHub } from './ray.js';
import type { PanelSet } from './panel.js';

/** What the person chose in the menu. Kept in localStorage (try/catch: private windows throw) and mirrored to the story Director through PresenterHost.settings when a tour runs. */
export interface UiSettings {
  textScale: 1 | 1.25 | 1.5;
  contrast: 'normal' | 'high';
  posture: 'standing' | 'seated';
  handedness: Exclude<Handedness, 'none'>;
  /** extra eye height in cm (the rig's heightOffset), for a person whose floor is not the real one */
  heightCm: number;
  snapTurnDeg: 15 | 30 | 45;
  vignette: boolean;
  autoAdvance: 'guided' | 'step';
}
export const DEFAULT_SETTINGS: UiSettings = { textScale: 1, contrast: 'normal', posture: 'standing', handedness: 'right', heightCm: 0, snapTurnDeg: 30, vignette: true, autoAdvance: 'guided' };
const KEY = 'vh.xr.ui.v1';

export interface SettingsStore {
  get(): UiSettings;
  set(patch: Partial<UiSettings>): void;
  on(cb: (s: UiSettings, changed: Array<keyof UiSettings>) => void): () => void;
}
export function createSettings(initial?: Partial<UiSettings>, persist = true): SettingsStore {
  let s: UiSettings = { ...DEFAULT_SETTINGS };
  if (persist) { try { const raw = localStorage.getItem(KEY); if (raw) s = { ...s, ...sane(JSON.parse(raw)) }; } catch { /* private window: the defaults */ } }
  if (initial) s = { ...s, ...sane(initial) };
  const subs = new Set<(s: UiSettings, c: Array<keyof UiSettings>) => void>();
  return {
    get: () => s,
    set(patch) {
      const p = sane(patch), changed = (Object.keys(p) as Array<keyof UiSettings>).filter(k => p[k] !== s[k]);
      if (!changed.length) return;
      s = { ...s, ...p };
      if (persist) { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* not stored */ } }
      for (const cb of [...subs]) { try { cb(s, changed); } catch (e) { console.warn('xr ui: a settings listener threw', e); } }
    },
    on(cb) { subs.add(cb); return () => { subs.delete(cb); }; },
  };
}
/** keep only well-formed values (a stored blob from an older version or another site must not break the menu) */
function sane(o: any): Partial<UiSettings> {
  const out: Partial<UiSettings> = {};
  if (!o || typeof o !== 'object') return out;
  if (o.textScale === 1 || o.textScale === 1.25 || o.textScale === 1.5) out.textScale = o.textScale;
  if (o.contrast === 'normal' || o.contrast === 'high') out.contrast = o.contrast;
  if (o.posture === 'standing' || o.posture === 'seated') out.posture = o.posture;
  if (o.handedness === 'left' || o.handedness === 'right') out.handedness = o.handedness;
  if (typeof o.heightCm === 'number' && isFinite(o.heightCm)) out.heightCm = Math.max(-60, Math.min(60, Math.round(o.heightCm / 5) * 5));
  if (o.snapTurnDeg === 15 || o.snapTurnDeg === 30 || o.snapTurnDeg === 45) out.snapTurnDeg = o.snapTurnDeg;
  if (typeof o.vignette === 'boolean') out.vignette = o.vignette;
  if (o.autoAdvance === 'guided' || o.autoAdvance === 'step') out.autoAdvance = o.autoAdvance;
  return out;
}

// ------------------------------------------------------------------------------------------------------------------------ the shared kit
export interface UiKit {
  THREE: any; host: XrHost; rig: XrRig; input: XrInput; loco: XrLocomotion | null;
  group: any;
  panels: PanelSet; hub: RayHub;
  settings: SettingsStore;
  measure: Measure;
  /** the head this frame (world) */
  head(): { pos: V3; dir: V3; yawDeg: number };
  /** the XR frame counter and clock (ms) the kit has seen */
  frame(): number; now(): number;
  /** device pixels per degree at the centre of the view, and the canvas density derived from it */
  ppd(): number; texelsPerDeg(): number;
  /** the part of the view a card must sit inside, from the eye's projection (the headset's field of view less a margin) */
  viewCone(): { azHalf: number; elMin: number; elMax: number };
  /** the least target size in degrees for the pointing in use */
  targetDeg(): number;
  /** metrics for a panel `distanceM` away with the person's current settings */
  metrics(distanceM: number, o?: { interactive?: boolean }): Metrics;
  fault(code: PresenterFault, detail?: string): void;
  /** per-frame callbacks, run in ui.tick after the ray hub and before the panels upload */
  onFrame(cb: (f: XrFrame) => void): () => void;
  /** settings changed: re-lay out whatever you draw */
  onRelayout(cb: () => void): () => void;
  /** the session is going away (unmount): tell your listeners before the panels are disposed */
  onEnd(cb: () => void): () => void;
  exit(): void;
  toast(text: string, kind?: 'info' | 'warn', ms?: number): void;
  fontsOk(): boolean;
  /** nodes the kit owns, the bytes of its textures and the draw calls its visible meshes cost */
  footprint(): { nodes: number; textureBytes: number; drawCalls: number };
  /** the frames on which the person's viewpoint moved, with the fade alpha at that frame (the comfort test) */
  motionLog(): Array<{ frame: number; fade: number; moved: boolean }>;
  /** the session's visibility: 'visible' | 'blurred' (system menu over the app) | 'hidden' (headset off) */
  onVisibility(cb: (state: 'visible' | 'blurred' | 'hidden') => void): () => void;
}

// ------------------------------------------------------------------------------------------------------------------------ pure helpers
const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
/** canvas texels per degree: 1.5x the device's centre pixels per degree (oversampled so minification and a little head movement do not shimmer), between 24 and 40 */
export const texelsPerDegFor = (ppd: number) => clamp(1.5 * ppd, 24, 40);

/** Pixels per degree at the centre of a stereo eye, from its viewport width and projection matrix (a rectilinear image is coarsest in the middle, so this is the number text lives or dies by). */
export function ppdOfEye(viewportW: number, proj: ArrayLike<number>): number {
  const m0 = proj[0], m8 = proj[8];
  if (!(m0 > 0) || !(viewportW > 0)) return 0;
  const tanR = (m8 + 1) / m0, tanL = (1 - m8) / m0;   // tangents of the half angles right and left of the axis
  return viewportW / (tanR + tanL) * Math.PI / 180;
}

/** The part of the view a card must sit inside, from an eye's projection matrix: the narrower of its left and right half angles less 4 degrees, and its up and down less 5, within sane limits. */
export function coneOfEye(proj: ArrayLike<number>): { azHalf: number; elMin: number; elMax: number } | null {
  const m0 = proj[0], m5 = proj[5], m8 = proj[8], m9 = proj[9];
  if (!(m0 > 0) || !(m5 > 0)) return null;
  const D = 180 / Math.PI, left = Math.atan((1 - m8) / m0) * D, right = Math.atan((1 + m8) / m0) * D, up = Math.atan((1 + m9) / m5) * D, down = Math.atan((1 - m9) / m5) * D;
  return { azHalf: clamp(Math.min(left, right) - 4, 28, 56), elMin: -clamp(down - 5, 18, 38), elMax: clamp(up - 5, 18, 32) };
}

/** the sizes a kit part asks the metrics for, in one place */
export function metricsFor(kit: { settings: SettingsStore; ppd(): number; texelsPerDeg(): number; targetDeg(): number }, distanceM: number, o: { interactive?: boolean } = {}): Metrics {
  const s = kit.settings.get();
  return makeMetrics({ texelsPerDeg: kit.texelsPerDeg(), distanceM, textScale: s.textScale, ppd: kit.ppd(), contrast: s.contrast, targetDeg: kit.targetDeg(), interactive: o.interactive });
}
export const TARGET_DEG = XR_LEGIBILITY.targetDeg;
