// assets/platform-types.ts : the PlatformProfile contract. Types and DATA only: no DOM, no THREE, no side effect at import.
//
// Who writes what. assets/platform.ts (package platform-profile) READS the device and fills a PlatformProfile; everything else
// (viewer.ts, viewer-quality.ts, the xr/ modules, the story director) only READS one. This file is the seed both sides compile
// against: it is byte-identical in every worktree, owned by the orchestrator, and changed only through a contract change
// (announce it in the progress log). The numbers in PAGE_TIERS / XR_TIERS are STARTING VALUES: the ones marked (m) were measured
// on this repo's 30 houses (M2 Max, load 90-350, so ratios, not milliseconds), (v) come from a vendor document, (a) are assumptions
// that only a headset or a phone settles (xr/contract/REAL-DEVICE-CHECKLIST.md). Doc: TIERS.md.
//
// Capability probe, never the user agent: visionOS Safari sends a Macintosh UA, and IWER overrides navigator.userAgent.

export type Form = 'phone' | 'tablet' | 'desktop';

/** How the 2D player draws. Chosen at mount (start) and moved by the frame-rate controllers (promote / demote), never past `ceiling`. */
export type PageTier = 'desktop-high' | 'desktop-mid' | 'mobile-high' | 'mobile-low';
/** How an immersive session draws. Chosen when the person taps Enter VR, from what the granted session reports. */
export type XrTierName = 'xr-standalone' | 'xr-tethered' | 'vision';
export type XrGen = 'gen1' | 'gen2';
export type GpuClass = 'software' | 'mobile-low' | 'mobile-mid' | 'mobile-flagship' | 'integrated' | 'discrete' | 'unknown';
/** assets/viewer-quality.ts's realism ladder (0 off, 1 cheap, 2 full). Advisory here: viewer-quality stays the authority until the merge step. */
export type RealismTier = 0 | 1 | 2;

// ------------------------------------------------------------------------------------------------------------- signals (what was read)
export interface Signals {
  secure: boolean;                                   // window.isSecureContext (WebXR needs HTTPS or localhost)
  display: { w: number; h: number; shortSide: number; dpr: number; aspect: number; ultrawide: boolean; orientation: 'portrait' | 'landscape' };
  safe: { t: number; r: number; b: number; l: number };            // env(safe-area-inset-*) in CSS px, from a probe element (0 without viewport-fit=cover)
  css: { dvh: boolean; supportsHoverMq: boolean };
  input: { coarse: boolean; fine: boolean; hover: boolean; anyFine: boolean; anyHover: boolean; touchPoints: number; gamepads: number };
  cpu: { cores: number; memoryGb: number | null };                // memoryGb is capped at 8 by browsers that report it, and absent on Safari/Firefox
  net: { saveData: boolean; effectiveType: string | null };
  prefs: { reducedMotion: boolean; reducedData: boolean; contrastMore: boolean };
  gl: {
    webgl2: boolean; renderer: string; vendor: string; maxTexture: number; maxSamples: number;
    ext: Record<string, boolean>;                                   // OVR_multiview2, WEBGL_multisampled_render_to_texture, KHR_parallel_shader_compile, EXT_disjoint_timer_query_webgl2, ...
  };
  xr: {
    api: boolean;                                                   // navigator.xr exists
    vr: boolean | null; ar: boolean | null; inline: boolean | null; // isSessionSupported; null until the async probe resolves
    layersApi: boolean; handApi: boolean; fixedFoveationApi: boolean; frameRatesApi: boolean;
  };
  refreshHz: number | null;                                          // only when asked for (costs frames)
}

// ------------------------------------------------------------------------------------------------------------- budgets (what to do about it)
export interface PageBudget {
  dprStart: number;          // pixel ratio the page starts at: min(devicePixelRatio, dprCap)
  dprCap: number;            // the controller never goes above
  dprFloor: number;          // ... or below. 1 everywhere: ADAPT in viewer.ts steps 2, 1.5, 1.25, 1 and is NOT edited (realism edits it); the platform block only sets the START ratio before ADAPT reads it
  bufferMpx: number;         // drawing-buffer pixel cap: past it the ratio falls (ultrawide, 5K)
  shadowMap: number;         // sun map edge in px
  shadowRefresh: 'as-shipped' | 'on-change';   // as-shipped = viewer.ts today (cached, redrawn while moving); on-change = lighting change only
  fpsTarget: 60 | 30;
  fpsFloor: number;          // below this for a window the controller sheds; at the floor of the ratio, eco (frame cap) applies
  eco: boolean;              // allowed to cap frames at 30 when the ladder bottoms out (thermals)
  composer: 'on-demand' | 'never';
  realism: { start: RealismTier; ceiling: RealismTier };   // advisory
}

export interface XrBudget {
  refreshHz: { start: number; allowUp: number };
  framebufferScale: { start: number; min: number; max: number };   // fixed at session start in r169; the controller afterwards uses requestViewportScale
  foveation: { start: number; min: number; max: number } | null;  // null: not exposed (Vision, PC VR)
  msaa: 0 | 4;
  sunShadow: { size: number; refresh: 'static' | 'every-3rd' };
  maxSpots: number;
  /** renderer.info.render.calls of the main pass in STEREO, i.e. 2 x per eye (r169 has no multiview). By refresh rate. */
  callsSubmitted: Record<number, number>;
  trisSubmitted: number;
  programs: number;
  textureMB: number;
  shadowMB: number;
  lodRadiusM: number;        // hide bake cells whose centre is farther than this from the head (decided per teleport, not per frame)
  textureCapPx: number | null;     // XR-only copies of the canvas textures are downsampled to this (null: as built)
  realism: { start: 0; ceiling: 0 };
  composer: 'never';
}

export interface PlatformProfile {
  readonly version: 1;
  form: Form;                                         // from capabilities: touch-first and short side < 600 CSS px = phone; touch-first otherwise = tablet
  signals: Signals;
  tier: PageTier;                                     // where the page started (mutable by the controllers: use onPlatformChange)
  ceiling: PageTier;
  reasons: string[];                                  // why this tier, for the HUD and the perf log
  budget: PageBudget;
  xr: {
    supported: boolean;                               // vr || ar, and a secure context, and not ?no=xr
    vr: boolean | null; ar: boolean | null;
    /** set only while a session exists or after one has been granted this page life */
    session: null | {
      mode: 'vr' | 'ar'; tier: XrTierName; gen: XrGen | null; budget: XrBudget; reasons: string[];
      enabledFeatures: string[]; inputProfiles: string[]; targetRayModes: string[]; blend: 'opaque' | 'additive' | 'alpha-blend';
      refreshHz: number | null; supportedRates: number[]; layerPath: 'base-layer' | 'projection-layer'; hands: boolean;
    };
  };
  /** features the UI may rely on (each one is a capability test, so a missing one hides the control and says why) */
  can: { gamepad: boolean; gyro: boolean | 'needs-permission'; fullscreen: boolean; haptics: boolean; touchFly: boolean; share: boolean };
  /** ?tier= / ?no=platform / ?no=xr as parsed once at mount */
  overrides: { tier: PageTier | null; noPlatform: boolean; noXr: boolean };
}

/** The API assets/platform.ts exports. Sync reads never await and never touch GL; refinePlatform adds the GL facts once. */
export interface PlatformApi {
  getPlatform(): PlatformProfile;                                    // sync, memoised, safe at module evaluation (no GL, no await)
  refinePlatform(gl: WebGL2RenderingContext | null): PlatformProfile;   // adds signals.gl + the GPU class; may only LOWER a start tier (Intel, software)
  probeXr(): Promise<PlatformProfile>;                                // isSessionSupported x3 (about 2 ms); also re-run on navigator.xr 'devicechange'
  setPageTier(t: PageTier, why: string): void;                        // the platform block in viewer.ts calls it on promotion / eco (ADAPT itself is not edited)
  /** pure: called once a session is granted; `sess` is read off the live session by assets/xr/session.ts */
  chooseXrTier(sess: XrSessionFacts): { tier: XrTierName; gen: XrGen | null; reasons: string[] };
  commitXrSession(info: NonNullable<PlatformProfile['xr']['session']> | null): void;   // null on session end
  onPlatformChange(cb: (p: PlatformProfile, why: string) => void): () => void;         // resize / orientation, pointer capability, devicechange, tier moves, session start/end
}

export interface XrSessionFacts {
  mode: 'vr' | 'ar';
  profiles: string[];                 // every inputSource.profiles, in order: only profiles[0] counts for gen detection (Quest 3 lists oculus-touch-v3 as a fallback)
  targetRayModes: string[];
  hasFrameRates: boolean; frameRates: number[];
  hasFixedFoveation: boolean;
  blend: 'opaque' | 'additive' | 'alpha-blend';
  layerWidth: number; layerHeight: number;
  renderer: string;                   // signals.gl.renderer
}

// ------------------------------------------------------------------------------------------------------------- the tier tables (DATA)
// PAGE TIERS. desktop-high is TODAY'S behaviour (viewer.ts at 03edd3b), bit for bit: a desktop never starts lower than it does now unless
// there is positive evidence of weakness (integrated/software GPU, <= 4 cores or <= 4 GB, data saver). An unknown GPU on a desktop is
// desktop-high and the existing ADAPT controller demotes it on evidence. Phones start cheap and are promoted by measurement.
export const PAGE_TIERS: Record<PageTier, PageBudget> = {
  'desktop-high': { dprStart: 2, dprCap: 2, dprFloor: 1,    bufferMpx: 8.3, shadowMap: 4096, shadowRefresh: 'as-shipped', fpsTarget: 60, fpsFloor: 42, eco: false, composer: 'on-demand', realism: { start: 1, ceiling: 2 } },
  'desktop-mid':  { dprStart: 1.5, dprCap: 1.5, dprFloor: 1, bufferMpx: 4.1, shadowMap: 2048, shadowRefresh: 'as-shipped', fpsTarget: 60, fpsFloor: 42, eco: false, composer: 'on-demand', realism: { start: 0, ceiling: 1 } },
  'mobile-high':  { dprStart: 2, dprCap: 2, dprFloor: 1, bufferMpx: 2.2, shadowMap: 2048, shadowRefresh: 'as-shipped', fpsTarget: 60, fpsFloor: 42, eco: true,  composer: 'never',     realism: { start: 0, ceiling: 0 } },
  'mobile-low':   { dprStart: 1.25, dprCap: 1.25, dprFloor: 1, bufferMpx: 1.2, shadowMap: 1024, shadowRefresh: 'on-change', fpsTarget: 30, fpsFloor: 24, eco: true,  composer: 'never',     realism: { start: 0, ceiling: 0 } },
};
// dprStart is a CAP: the page starts at min(devicePixelRatio, dprStart), then buffer <= bufferMpx.

// XR TIERS. Per-eye = callsSubmitted / 2. Derivation of callsSubmitted (m)+(a): allowance_ms / (us per stereo call x CPU factor), allowance 7.5 ms at
// 72 Hz, 6 ms at 90 Hz, 3.5 ms at 120 Hz; 4.2 to 5.8 us per stereo call measured on an M2 Max; CPU factor ASSUMED: Quest 3 x4, Quest 2 x6.5, desktop x1.3,
// Vision Pro x1.0. The first headset run recalibrates these (checklist step 2-3); until then treat them as the thresholds the XR module ENFORCES.
export const XR_TIERS: Record<'standalone-gen2' | 'standalone-gen1' | 'tethered' | 'vision', XrBudget> = {
  'standalone-gen2': {   // Quest 3, 3S, Pro, Pico 4, Galaxy XR
    refreshHz: { start: 72, allowUp: 90 }, framebufferScale: { start: 0.85, min: 0.7, max: 1.0 }, foveation: { start: 0.66, min: 0.33, max: 1.0 }, msaa: 4,
    sunShadow: { size: 2048, refresh: 'static' }, maxSpots: 4, callsSubmitted: { 72: 300, 90: 250, 120: 150 }, trisSubmitted: 800_000, programs: 40, textureMB: 48, shadowMB: 16,
    lodRadiusM: 22, textureCapPx: 512, realism: { start: 0, ceiling: 0 }, composer: 'never',
  },
  'standalone-gen1': {   // Quest 2, Pico Neo 3, and the SAFE DEFAULT when a standalone session shows no gen2 evidence
    refreshHz: { start: 72, allowUp: 72 }, framebufferScale: { start: 0.8, min: 0.65, max: 0.9 }, foveation: { start: 0.8, min: 0.5, max: 1.0 }, msaa: 4,
    sunShadow: { size: 1024, refresh: 'static' }, maxSpots: 3, callsSubmitted: { 72: 190, 90: 150 }, trisSubmitted: 450_000, programs: 30, textureMB: 32, shadowMB: 4,
    lodRadiusM: 16, textureCapPx: 512, realism: { start: 0, ceiling: 0 }, composer: 'never',
  },
  'tethered': {          // PC VR through Chrome / Edge + OpenXR (SteamVR, Meta Link, WMR)
    refreshHz: { start: 90, allowUp: 144 }, framebufferScale: { start: 1.0, min: 0.7, max: 1.4 }, foveation: null, msaa: 4,
    sunShadow: { size: 2048, refresh: 'every-3rd' }, maxSpots: 8, callsSubmitted: { 72: 1100, 90: 1000, 120: 700 }, trisSubmitted: 3_000_000, programs: 60, textureMB: 256, shadowMB: 16,
    lodRadiusM: 40, textureCapPx: null, realism: { start: 0, ceiling: 0 }, composer: 'never',
  },
  'vision': {            // visionOS Safari: immersive-vr only, transient-pointer + optional hands, no layers, foveation system-managed
    refreshHz: { start: 90, allowUp: 90 }, framebufferScale: { start: 1.0, min: 0.6, max: 1.0 }, foveation: null, msaa: 4,
    sunShadow: { size: 2048, refresh: 'static' }, maxSpots: 6, callsSubmitted: { 90: 800 }, trisSubmitted: 2_000_000, programs: 50, textureMB: 128, shadowMB: 16,
    lodRadiusM: 30, textureCapPx: null, realism: { start: 0, ceiling: 0 }, composer: 'never',
  },
};

/** the XR budget for a tier/gen pair */
export function xrBudgetFor(tier: XrTierName, gen: XrGen | null): XrBudget {
  if (tier === 'vision') return XR_TIERS.vision;
  if (tier === 'xr-tethered') return XR_TIERS.tethered;
  return gen === 'gen2' ? XR_TIERS['standalone-gen2'] : XR_TIERS['standalone-gen1'];
}
