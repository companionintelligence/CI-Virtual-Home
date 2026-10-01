// What this device IS and what the player should DO about it. Contract: assets/platform-types.ts (shapes and the tier DATA),
// reasons and rules: xr/contract/TIERS.md. One profile, read by the player (viewer.ts through viewer-tier.ts), the touch and
// gamepad controls, the realism ladder and the story tour, and later by the XR modules.
//
// Capability probe, never the user agent: visionOS Safari sends a Macintosh UA, an emulator overrides navigator.userAgent, and
// Chrome on a PC can drive a Quest through Link. The one string read for classification is the unmasked GPU renderer, and only
// as a hint the measured frame rate corrects in both directions (viewer-tier.ts).
//
// Two decisions, kept apart. The PAGE tier says how the 2D player draws; it is chosen at mount and moved by the frame-rate
// controllers. The XR tier says how an immersive session draws; it is chosen when a session is granted (chooseXrTier), because
// only a granted session shows input profiles, frame rates and foveation.
//
// getPlatform() is sync, memoised and safe at module evaluation (no GL, no await, no DOM it needs). refinePlatform(gl) adds the
// GPU class from the renderer's own context (about 3 ms; a throwaway canvas costs 85 ms) and may only LOWER a start tier.
// ?tier=<PageTier> forces the start and the ceiling; ?no=platform is today's behaviour on every device (desktop-high);
// ?no=xr hides the immersive entry. Nothing here runs on the editor page or in an offline render: only viewer.ts imports it.
import { PAGE_TIERS, xrBudgetFor } from './platform-types.js';
import type { Form, GpuClass, PageTier, PlatformApi, PlatformProfile, Signals, XrGen, XrSessionFacts, XrTierName } from './platform-types.js';

export { PAGE_TIERS, xrBudgetFor };

const num = (x: unknown, d = 0): number => (typeof x === 'number' && Number.isFinite(x) ? x : d);
const mq = (q: string): boolean => { try { return typeof matchMedia === 'function' && matchMedia(q).matches; } catch { return false; } };
// cost order of the page tiers: refine() may only move a start tier DOWN this list
const RANK: Record<PageTier, number> = { 'mobile-low': 0, 'desktop-mid': 1, 'mobile-high': 2, 'desktop-high': 3 };

// ------------------------------------------------------------------------------------------------ signals (what was read)
/** The env(safe-area-inset-*) of this page in CSS px (0 without viewport-fit=cover): measured on a probe element. */
export function readSafeArea(): Signals['safe'] {
  const z = { t: 0, r: 0, b: 0, l: 0 };
  if (typeof document === 'undefined' || !document.body) return z;
  const p = document.createElement('div');
  p.style.cssText = 'position:fixed;left:0;top:0;width:0;height:0;visibility:hidden;pointer-events:none;padding:env(safe-area-inset-top,0px) env(safe-area-inset-right,0px) env(safe-area-inset-bottom,0px) env(safe-area-inset-left,0px)';
  document.body.appendChild(p);
  const c = getComputedStyle(p);
  const s = { t: parseFloat(c.paddingTop) || 0, r: parseFloat(c.paddingRight) || 0, b: parseFloat(c.paddingBottom) || 0, l: parseFloat(c.paddingLeft) || 0 };
  p.remove();
  return s;
}

/** The part of the device that needs no GL context and no await. The GL facts come from readGl, the XR support from probeXr. */
export function collectSignals(): Signals {
  const w: any = typeof window !== 'undefined' ? window : {}, nav: any = typeof navigator !== 'undefined' ? navigator : {};
  const scr: any = typeof screen !== 'undefined' ? screen : {};
  const iw = num(w.innerWidth, 1), ih = num(w.innerHeight, 1), conn = nav.connection;
  let pads = 0;
  try { pads = typeof nav.getGamepads === 'function' ? Array.from(nav.getGamepads() || []).filter(Boolean).length : 0; } catch { /* a policy that blocks the Gamepad API */ }
  return {
    secure: !!w.isSecureContext,
    // (the screen's short side, not the window's: a desktop window can be 400 px wide, and a phone's is the screen)
    display: { w: iw, h: ih, shortSide: Math.min(num(scr.width, iw), num(scr.height, ih)) || Math.min(iw, ih), dpr: num(w.devicePixelRatio, 1), aspect: iw / ih, ultrawide: iw / ih > 2.1, orientation: iw >= ih ? 'landscape' : 'portrait' },
    safe: readSafeArea(),
    css: { dvh: typeof CSS !== 'undefined' && !!CSS.supports && CSS.supports('height', '100dvh'), supportsHoverMq: mq('(hover: hover), (hover: none)') },
    input: { coarse: mq('(pointer: coarse)'), fine: mq('(pointer: fine)'), hover: mq('(hover: hover)'), anyFine: mq('(any-pointer: fine)'), anyHover: mq('(any-hover: hover)'), touchPoints: num(nav.maxTouchPoints), gamepads: pads },
    cpu: { cores: num(nav.hardwareConcurrency), memoryGb: typeof nav.deviceMemory === 'number' ? nav.deviceMemory : null },
    net: { saveData: !!(conn && conn.saveData), effectiveType: (conn && conn.effectiveType) || null },
    prefs: { reducedMotion: mq('(prefers-reduced-motion: reduce)'), reducedData: mq('(prefers-reduced-data: reduce)'), contrastMore: mq('(prefers-contrast: more)') },
    // (webgl2 is assumed until readGl: the player only mounts on a page whose renderer exists)
    gl: { webgl2: true, renderer: '', vendor: '', maxTexture: 0, maxSamples: 0, ext: {} },
    xr: {
      api: !!nav.xr, vr: null, ar: null, inline: null,
      layersApi: typeof w.XRWebGLBinding === 'function' && typeof w.XRWebGLBinding.prototype.createProjectionLayer === 'function',
      handApi: typeof w.XRHand === 'function',
      fixedFoveationApi: typeof w.XRWebGLLayer === 'function' && 'fixedFoveation' in w.XRWebGLLayer.prototype,
      frameRatesApi: typeof w.XRSession === 'function' && 'supportedFrameRates' in w.XRSession.prototype,
    },
    refreshHz: null,
  };
}

/** The GL facts, read from an existing WebGL2 context (the renderer's own). A lost or blocked context reads as 'no WebGL2'. */
export function readGl(c: WebGL2RenderingContext | null, into: Signals['gl'] = { webgl2: false, renderer: '', vendor: '', maxTexture: 0, maxSamples: 0, ext: {} }): Signals['gl'] {
  try {
    if (!c) throw 0;
    into.webgl2 = typeof WebGL2RenderingContext !== 'undefined' && c instanceof WebGL2RenderingContext;
    const info = c.getExtension('WEBGL_debug_renderer_info');
    into.renderer = String(c.getParameter(info ? info.UNMASKED_RENDERER_WEBGL : c.RENDERER) || '');
    into.vendor = String(c.getParameter(info ? info.UNMASKED_VENDOR_WEBGL : c.VENDOR) || '');
    into.maxTexture = num(c.getParameter(c.MAX_TEXTURE_SIZE));
    into.maxSamples = into.webgl2 ? num(c.getParameter(c.MAX_SAMPLES)) : 0;
    // OVR_multiview2 is read for the record: r169 has no multiview path, so a headset's stereo costs two draws
    for (const e of ['OVR_multiview2', 'OCULUS_multiview', 'WEBGL_multisampled_render_to_texture', 'KHR_parallel_shader_compile', 'EXT_disjoint_timer_query_webgl2']) into.ext[e] = !!c.getExtension(e);
  } catch { into.webgl2 = false; }
  return into;
}

// ------------------------------------------------------------------------------------------------ GPU class (a hint, never a verdict)
export function gpuClass(renderer: string, { coarse = false }: { coarse?: boolean } = {}): GpuClass {
  const r = String(renderer || '');
  if (!r) return 'unknown';
  if (/swiftshader|llvmpipe|softpipe|software|microsoft basic render/i.test(r)) return 'software';
  const adreno = /adreno[^0-9]*(\d{3})/i.exec(r);
  if (adreno) return Number(adreno[1]) >= 730 ? 'mobile-flagship' : Number(adreno[1]) >= 650 ? 'mobile-mid' : 'mobile-low';
  // (G-series only: a Mali-T880 is a 2015 part whatever its number says)
  const mali = /mali-?g(\d{2,3})/i.exec(r);
  if (/immortalis/i.test(r) || (mali && Number(mali[1]) >= 715)) return 'mobile-flagship';
  if (mali) return Number(mali[1]) >= 78 ? 'mobile-mid' : 'mobile-low';
  if (/powervr|mali/i.test(r)) return 'mobile-low';
  // every Apple M chip is discrete-class for a house: the base M1 draws the heaviest home well past 60 fps
  if (/nvidia|geforce|rtx|gtx|radeon rx|radeon pro|arc(\(tm\))?\s?[ab]\d|apple m\d/i.test(r)) return 'discrete';
  if (/intel|uhd|iris|radeon\(tm\)|radeon graphics|vega|\bapu\b/i.test(r)) return 'integrated';
  // Safari says only "Apple GPU" on every iPhone, iPad, Mac and Vision Pro: nothing to learn from the string except touch-first
  if (/^apple gpu$/i.test(r.trim())) return coarse ? 'mobile-mid' : 'unknown';
  return 'unknown';
}

// ------------------------------------------------------------------------------------------------ the page tier
/** touch-first = the PRIMARY pointer is coarse (an iPad with a trackpad is still a tablet; a desktop window 400 px wide is still a desktop) */
export function formOf(s: Signals): Form {
  return s.input.coarse ? (s.display.shortSide < 600 ? 'phone' : 'tablet') : 'desktop';
}
/** weak = cores <= 4 or memory <= 4 GB (browsers report at most 8 and many nothing: 8 is not a ceiling); frugal = data saver or a slow link */
export const isWeak = (s: Signals): boolean => (s.cpu.cores > 0 && s.cpu.cores <= 4) || (s.cpu.memoryGb !== null && s.cpu.memoryGb <= 4);
export const isFrugal = (s: Signals): boolean => s.net.saveData || s.prefs.reducedData || (!!s.net.effectiveType && s.net.effectiveType !== '4g');

/** Where the page starts and the best tier a controller may promote it to. Pure: every device row is a unit test (scripts/test-platform.mts). */
export function chooseTier(s: Signals): { tier: PageTier; ceiling: PageTier; form: Form; reasons: string[] } {
  const form = formOf(s), reasons: string[] = [];
  if (!s.gl.webgl2) return { tier: 'mobile-low', ceiling: 'mobile-low', form, reasons: ['no WebGL2'] };
  const g = gpuClass(s.gl.renderer, { coarse: s.input.coarse }), weak = isWeak(s), frugal = isFrugal(s);
  if (g === 'software') return { tier: 'mobile-low', ceiling: 'mobile-low', form, reasons: [`software renderer (${s.gl.renderer})`] };
  if (frugal) reasons.push('data saver or slow network');
  if (weak) reasons.push(`cores ${s.cpu.cores}, memory ${s.cpu.memoryGb ?? '?'} GB`);
  if (form !== 'desktop') {
    // every phone and tablet starts cheap; the frame rate promotes it (viewer-tier.ts). The ceiling needs a GPU that can hold 60
    const strong = (g === 'mobile-flagship' || (g === 'mobile-mid' && s.cpu.cores >= 6)) && !weak && !frugal;
    return { tier: 'mobile-low', ceiling: strong ? 'mobile-high' : 'mobile-low', form, reasons: reasons.concat(`touch-first ${form}, gpu ${g}`) };
  }
  // desktop: today's behaviour unless there is positive evidence of weakness. An unknown GPU is desktop-high; ADAPT demotes it.
  if (g === 'integrated' || weak || frugal) return { tier: 'desktop-mid', ceiling: frugal ? 'desktop-mid' : 'desktop-high', form, reasons: reasons.concat(`gpu ${g}`) };
  return { tier: 'desktop-high', ceiling: 'desktop-high', form, reasons: reasons.concat(`gpu ${g}`) };
}

// ------------------------------------------------------------------------------------------------ the XR tier
const GEN2_PROFILE = /^(meta-quest-touch-(plus|pro)|pico-4u?|samsung-galaxyxr|htc-vive-focus-3)$/;
const GEN2_GPU = /adreno[^0-9]*(7[3-9]\d|[89]\d\d)|immortalis|mali-?g(7[1-9]\d|[89]\d\d)/i;
/** From what a GRANTED session reports. Vision: any transient-pointer source. Standalone: a hint only a headset SoC gives. Else a PC headset.
 *  gen2 needs positive evidence in profiles[0] (Quest 3 lists oculus-touch-v3 further down as a fallback) or the GPU string; none (hands only, masked
 *  string) is gen1, the safe default. */
export function chooseXrTier(f: XrSessionFacts): { tier: XrTierName; gen: XrGen | null; reasons: string[] } {
  if (f.targetRayModes.includes('transient-pointer')) return { tier: 'vision', gen: null, reasons: ['transient-pointer input'] };
  const hints = [f.hasFixedFoveation && 'fixedFoveation', f.hasFrameRates && 'supportedFrameRates', /adreno|mali|immortalis|powervr/i.test(f.renderer) && 'mobile GPU', f.mode === 'ar' && f.blend !== 'opaque' && 'passthrough'].filter(Boolean) as string[];
  if (!hints.length) return { tier: 'xr-tethered', gen: null, reasons: ['no standalone-only capability reported', `gpu ${gpuClass(f.renderer)}`] };
  const first = f.profiles[0] || '', gen2 = GEN2_PROFILE.test(first) || GEN2_GPU.test(f.renderer);
  return { tier: 'xr-standalone', gen: gen2 ? 'gen2' : 'gen1', reasons: hints.concat(gen2 ? `gen2 (${first || f.renderer})` : `gen1 (${first || 'no gen2 evidence'})`) };
}

// ------------------------------------------------------------------------------------------------ the profile
const listeners = new Set<(p: PlatformProfile, why: string) => void>();
let P: PlatformProfile | null = null, refined = false, listening = false, xrWatch = false;

function overridesOf(): PlatformProfile['overrides'] {
  const q = typeof location !== 'undefined' ? new URLSearchParams(location.search) : new URLSearchParams();
  const no = (q.get('no') || '').split(',');
  const t = q.get('tier') as PageTier | null;
  return { tier: t && t in PAGE_TIERS ? t : null, noPlatform: no.includes('platform'), noXr: no.includes('xr') };
}
function canOf(s: Signals): PlatformProfile['can'] {
  const nav: any = typeof navigator !== 'undefined' ? navigator : {}, doc: any = typeof document !== 'undefined' ? document : {};
  const DOE: any = typeof DeviceOrientationEvent !== 'undefined' ? DeviceOrientationEvent : null;
  return {
    gamepad: typeof nav.getGamepads === 'function',
    // a desktop browser exposes DeviceOrientationEvent and never fires it: gyro is a touch-first feature
    gyro: !!DOE && s.input.coarse ? (typeof DOE.requestPermission === 'function' ? 'needs-permission' : true) : false,
    fullscreen: !!(doc.fullscreenEnabled || doc.webkitFullscreenEnabled),
    haptics: typeof nav.vibrate === 'function',
    touchFly: s.input.coarse,
    share: typeof nav.share === 'function',
  };
}
function apply(p: PlatformProfile, r: { tier: PageTier; ceiling: PageTier; reasons: string[] }): void {
  const o = p.overrides;
  if (o.noPlatform) { p.tier = p.ceiling = 'desktop-high'; p.reasons = ['?no=platform']; }
  else if (o.tier) { p.tier = p.ceiling = o.tier; p.reasons = [`?tier=${o.tier}`]; }
  else { p.tier = r.tier; p.ceiling = r.ceiling; p.reasons = r.reasons; }
  p.budget = PAGE_TIERS[p.tier];
}
function emit(why: string): void { for (const l of listeners) { try { l(P!, why); } catch (e) { console.warn('platform: listener threw', e); } } }

/** window changes that the profile follows: the size and safe area (turning a tablet), the pointer (a keyboard clipped on an iPad), pads */
function listen(): void {
  if (listening || typeof window === 'undefined') return;
  listening = true;
  let timer = 0;
  const reread = (why: string) => {
    clearTimeout(timer);
    timer = window.setTimeout(() => {
      const p = P!, s = collectSignals();
      Object.assign(p.signals, { display: s.display, safe: s.safe, input: s.input, net: s.net, prefs: s.prefs });
      p.form = formOf(p.signals); p.can = canOf(p.signals);
      emit(why);
    }, 120);
  };
  addEventListener('resize', () => reread('resize'));
  addEventListener('orientationchange', () => reread('orientation'));
  addEventListener('gamepadconnected', () => reread('gamepad'));
  addEventListener('gamepaddisconnected', () => reread('gamepad'));
  try { matchMedia('(pointer: coarse)').addEventListener('change', () => reread('pointer')); } catch { /* an old Safari */ }
}

export function getPlatform(): PlatformProfile {
  if (P) return P;
  const signals = collectSignals(), r = chooseTier(signals);
  P = {
    version: 1, form: r.form, signals, tier: r.tier, ceiling: r.ceiling, reasons: r.reasons, budget: PAGE_TIERS[r.tier],
    xr: { supported: false, vr: null, ar: null, session: null }, can: canOf(signals), overrides: overridesOf(),
  };
  apply(P, r);
  listen();
  return P;
}

/** Adds the GL facts (once). New evidence may lower a start tier (an integrated GPU, a software renderer) and sets the ceiling; it never raises a tier. */
export function refinePlatform(gl: WebGL2RenderingContext | null): PlatformProfile {
  const p = getPlatform();
  if (refined || !gl) return p;
  refined = true;
  readGl(gl, p.signals.gl);
  const r = chooseTier(p.signals);
  if (p.overrides.noPlatform || p.overrides.tier) return p;
  p.ceiling = r.ceiling; p.reasons = r.reasons;
  if (RANK[r.tier] < RANK[p.tier]) { p.tier = r.tier; p.budget = PAGE_TIERS[r.tier]; p.reasons = r.reasons.concat('lowered by the GPU'); }
  emit('refine');
  return p;
}

/** isSessionSupported for vr, ar and inline (about 2 ms, no gesture, starts nothing). Re-run when a headset is plugged in later. */
export async function probeXr(): Promise<PlatformProfile> {
  const p = getPlatform(), x: any = typeof navigator !== 'undefined' ? (navigator as any).xr : null;
  if (!x || typeof x.isSessionSupported !== 'function' || p.overrides.noXr) return p;
  // (a browser whose promise never settles must not hold the Enter VR button back: 2 s, then "no")
  const ask = (m: string) => Promise.race([x.isSessionSupported(m).catch(() => false), new Promise<boolean>(res => setTimeout(res, 2000, false))]);
  const [vr, ar, inline] = await Promise.all([ask('immersive-vr'), ask('immersive-ar'), ask('inline')]);
  const xr = p.signals.xr;
  xr.vr = !!vr; xr.ar = !!ar; xr.inline = !!inline;
  p.xr.vr = xr.vr; p.xr.ar = xr.ar; p.xr.supported = (xr.vr || xr.ar) && p.signals.secure;
  if (!xrWatch) { xrWatch = true; try { x.addEventListener('devicechange', () => { probeXr(); }); } catch { /* no events on this runtime */ } }
  emit('xr-probe');
  return p;
}

/** The platform block (viewer-tier.ts) calls this on promotion and eco, so the HUD, the story and the XR entry read the live tier. */
export function setPageTier(t: PageTier, why: string): void {
  const p = getPlatform();
  if (p.tier === t) return;
  p.tier = t; p.budget = PAGE_TIERS[t];
  emit(why);
}
export function commitXrSession(info: NonNullable<PlatformProfile['xr']['session']> | null): void {
  getPlatform().xr.session = info;
  emit(info ? 'xr-start' : 'xr-end');
}
export function onPlatformChange(cb: (p: PlatformProfile, why: string) => void): () => void {
  listeners.add(cb);
  return () => { listeners.delete(cb); };
}

// (a compile-time check that the exports above are the contract's API)
const _api: PlatformApi = { getPlatform, refinePlatform, probeXr, setPageTier, chooseXrTier, commitXrSession, onPlatformChange };
void _api;
