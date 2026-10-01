// assets/platform.ts : SEED STUB. Package platform-profile REPLACES this file wholesale (the contract is assets/platform-types.ts).
// It exists so xr-session, xr-bake, xr-ui and xr-locomotion compile and run before platform-profile lands: it reports today's desktop
// behaviour (desktop-high) on every device and implements chooseXrTier from TIERS.md section 6.
import { PAGE_TIERS, xrBudgetFor } from './platform-types.js';
import type { PlatformApi, PlatformProfile, XrSessionFacts, Signals } from './platform-types.js';

const listeners = new Set<(p: PlatformProfile, why: string) => void>();
const emptySignals = (): Signals => ({
  secure: typeof isSecureContext !== 'undefined' && isSecureContext,
  display: { w: 0, h: 0, shortSide: 0, dpr: 1, aspect: 1.78, ultrawide: false, orientation: 'landscape' },
  safe: { t: 0, r: 0, b: 0, l: 0 }, css: { dvh: true, supportsHoverMq: true },
  input: { coarse: false, fine: true, hover: true, anyFine: true, anyHover: true, touchPoints: 0, gamepads: 0 },
  cpu: { cores: 8, memoryGb: null }, net: { saveData: false, effectiveType: null }, prefs: { reducedMotion: false, reducedData: false, contrastMore: false },
  gl: { webgl2: true, renderer: '', vendor: '', maxTexture: 0, maxSamples: 0, ext: {} },
  xr: { api: typeof navigator !== 'undefined' && !!(navigator as any).xr, vr: null, ar: null, inline: null, layersApi: false, handApi: false, fixedFoveationApi: false, frameRatesApi: false },
  refreshHz: null,
});
let profile: PlatformProfile | null = null;
const build = (): PlatformProfile => ({
  version: 1, form: 'desktop', signals: emptySignals(), tier: 'desktop-high', ceiling: 'desktop-high', reasons: ['seed stub'], budget: PAGE_TIERS['desktop-high'],
  xr: { supported: false, vr: null, ar: null, session: null },
  can: { gamepad: true, gyro: false, fullscreen: true, haptics: false, touchFly: false, share: false },
  overrides: { tier: null, noPlatform: false, noXr: false },
});
const emit = (why: string) => { for (const l of listeners) l(profile!, why); };

const api: PlatformApi = {
  getPlatform: () => (profile ??= build()),
  refinePlatform: () => api.getPlatform(),
  async probeXr() {
    const p = api.getPlatform(); const x: any = (navigator as any).xr;
    if (x?.isSessionSupported) {
      const ask = (m: string) => x.isSessionSupported(m).catch(() => false);
      [p.xr.vr, p.xr.ar] = await Promise.all([ask('immersive-vr'), ask('immersive-ar')]);
      p.xr.supported = !!(p.xr.vr && p.signals.secure);
    }
    emit('xr-probe'); return p;
  },
  setPageTier(t, why) { const p = api.getPlatform(); p.tier = t; p.budget = PAGE_TIERS[t]; emit(why); },
  chooseXrTier(s: XrSessionFacts) {
    if (s.targetRayModes.includes('transient-pointer')) return { tier: 'vision', gen: null, reasons: ['transient-pointer input'] };
    const hints = [s.hasFixedFoveation && 'fixedFoveation', s.hasFrameRates && 'supportedFrameRates', /adreno|mali|immortalis|powervr/i.test(s.renderer) && 'mobile GPU'].filter(Boolean) as string[];
    if (hints.length) {
      const first = s.profiles[0] || '';
      const gen2 = /^(meta-quest-touch-(plus|pro)|pico-4u?|samsung-galaxyxr|htc-vive-focus-3)$/.test(first);
      return { tier: 'xr-standalone', gen: gen2 ? 'gen2' : 'gen1', reasons: hints.concat(gen2 ? `gen2 (${first})` : 'gen1 (no gen2 evidence)') };
    }
    return { tier: 'xr-tethered', gen: null, reasons: ['no standalone-only capability reported'] };
  },
  commitXrSession(info) { api.getPlatform().xr.session = info; emit(info ? 'xr-start' : 'xr-end'); },
  onPlatformChange(cb) { listeners.add(cb); return () => { listeners.delete(cb); }; },
};
export const { getPlatform, refinePlatform, probeXr, setPageTier, chooseXrTier, commitXrSession, onPlatformChange } = api;
export { xrBudgetFor };
