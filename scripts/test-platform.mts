#!/usr/bin/env -S node --experimental-strip-types
// The platform profile's decisions, in Node: chooseTier / chooseXrTier / gpuClass over a table of devices (one row per device: a
// Signals set, as the browser would read it, and the tier and ceiling it must get), the GPU refinement that may only lower a
// start tier, the override switches, and the guard that keeps the desktop-high tier equal to what the player does today.
// @check-house quick
//
//   node --experimental-strip-types scripts/test-platform.mts     (needs `pnpm run build`)
//
// The device rows are fixtures, not readings: the renderer strings are the ones those GPUs report in Chrome (Safari says only
// "Apple GPU"), the rest is what the browser reports for such a device. Real phones and headsets are not here; the matrix test
// (scripts/test-platform-matrix.mts) drives emulated ones through the real player, and reference/XR-DEVICE-CHECKLIST.md lists
// what only a device can settle.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { chooseTier, chooseXrTier, gpuClass, formOf, getPlatform, refinePlatform, setPageTier, onPlatformChange, PAGE_TIERS, xrBudgetFor } from '../assets/platform.js';
import { PROMOTE_FPS, PROMOTE_SECONDS, capRatio } from '../assets/viewer-tier.js';
import { XR_TIERS } from '../assets/platform-types.js';
import type { PageTier, Signals, XrSessionFacts } from '../assets/platform-types.js';

const ROOT = path.resolve(import.meta.dirname, '..');
let rows = 0;

// ------------------------------------------------------------------------------------------------------------------ device rows
type Sig = { display?: Partial<Signals['display']>; input?: Partial<Signals['input']>; cpu?: Partial<Signals['cpu']>; net?: Partial<Signals['net']>; prefs?: Partial<Signals['prefs']>; gl?: Partial<Signals['gl']>; xr?: Partial<Signals['xr']> };
const dev = (o: Sig = {}): Signals => ({
  secure: true,
  display: { w: 1440, h: 900, shortSide: 900, dpr: 2, aspect: 1.6, ultrawide: false, orientation: 'landscape', ...o.display },
  safe: { t: 0, r: 0, b: 0, l: 0 }, css: { dvh: true, supportsHoverMq: true },
  input: { coarse: false, fine: true, hover: true, anyFine: true, anyHover: true, touchPoints: 0, gamepads: 0, ...o.input },
  cpu: { cores: 8, memoryGb: 8, ...o.cpu }, net: { saveData: false, effectiveType: '4g', ...o.net },
  prefs: { reducedMotion: false, reducedData: false, contrastMore: false, ...o.prefs },
  gl: { webgl2: true, renderer: '', vendor: '', maxTexture: 16384, maxSamples: 8, ext: {}, ...o.gl },
  xr: { api: false, vr: null, ar: null, inline: null, layersApi: false, handApi: false, fixedFoveationApi: false, frameRatesApi: false, ...o.xr },
  refreshHz: null,
});
const touch: Sig['input'] = { coarse: true, fine: false, hover: false, anyFine: false, anyHover: false, touchPoints: 5 };
const ADRENO740 = 'ANGLE (Qualcomm, Adreno (TM) 740, OpenGL ES 3.2)';
const M2 = 'ANGLE (Apple, ANGLE Metal Renderer: Apple M2 Max, Unspecified Version)';
const RTX = 'ANGLE (NVIDIA, NVIDIA GeForce RTX 4060 Direct3D11 vs_5_0 ps_5_0, D3D11)';
const UHD = 'ANGLE (Intel, Intel(R) UHD Graphics 620 Direct3D11 vs_5_0 ps_5_0, D3D11)';

// [name, signals, tier, ceiling, form]
const PAGE: Array<[string, Signals, PageTier, PageTier, string]> = [
  ['MacBook Pro M2 Max, Chrome', dev({ gl: { renderer: M2 }, cpu: { cores: 12 } }), 'desktop-high', 'desktop-high', 'desktop'],
  ['MacBook Air M1, Chrome (a base M chip is discrete-class)', dev({ gl: { renderer: 'ANGLE (Apple, ANGLE Metal Renderer: Apple M1, Unspecified Version)' }, cpu: { cores: 8 } }), 'desktop-high', 'desktop-high', 'desktop'],
  ['MacBook Air, Safari (generic Apple GPU, no deviceMemory)', dev({ gl: { renderer: 'Apple GPU' }, cpu: { cores: 8, memoryGb: null } }), 'desktop-high', 'desktop-high', 'desktop'],
  ['Windows RTX 4060, Chrome at 4K', dev({ display: { w: 3840, h: 2160, shortSide: 2160, dpr: 1, aspect: 16 / 9 }, gl: { renderer: RTX }, cpu: { cores: 16, memoryGb: 8 } }), 'desktop-high', 'desktop-high', 'desktop'],
  ['Windows RTX 4060 at 5K (5120 x 2880)', dev({ display: { w: 5120, h: 2880, shortSide: 2880, dpr: 1, aspect: 16 / 9 }, gl: { renderer: RTX }, cpu: { cores: 16 } }), 'desktop-high', 'desktop-high', 'desktop'],
  ['Windows RTX 4060, ultrawide 3440 x 1440', dev({ display: { w: 3440, h: 1440, shortSide: 1440, dpr: 1, aspect: 2.39, ultrawide: true }, gl: { renderer: RTX }, cpu: { cores: 16 } }), 'desktop-high', 'desktop-high', 'desktop'],
  ['Windows laptop, Intel UHD, Edge', dev({ gl: { renderer: UHD }, cpu: { cores: 8, memoryGb: 8 } }), 'desktop-mid', 'desktop-high', 'desktop'],
  ['Chromebook, 4 GB, 4 cores', dev({ gl: { renderer: 'ANGLE (Intel, Mesa Intel(R) UHD Graphics 600 (GLK 2), OpenGL ES 3.2)' }, cpu: { cores: 4, memoryGb: 4 } }), 'desktop-mid', 'desktop-high', 'desktop'],
  ['Desktop with a narrow window (400 px) stays a desktop', dev({ display: { w: 400, h: 800, shortSide: 1080, dpr: 1 }, gl: { renderer: 'ANGLE (NVIDIA, NVIDIA GeForce RTX 3070 Direct3D11)' } }), 'desktop-high', 'desktop-high', 'desktop'],
  ['SwiftShader (CI, a VM)', dev({ gl: { renderer: 'ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero)), SwiftShader driver)' } }), 'mobile-low', 'mobile-low', 'desktop'],
  ['llvmpipe on a Linux box', dev({ gl: { renderer: 'llvmpipe (LLVM 15.0.7, 256 bits)' } }), 'mobile-low', 'mobile-low', 'desktop'],
  ['iPhone 15 Pro, Safari', dev({ display: { w: 393, h: 659, shortSide: 393, dpr: 3 }, input: touch, cpu: { cores: 6, memoryGb: null }, gl: { renderer: 'Apple GPU', maxTexture: 8192 } }), 'mobile-low', 'mobile-high', 'phone'],
  ['iPhone SE (2nd gen), Safari', dev({ display: { w: 375, h: 553, shortSide: 375, dpr: 2 }, input: touch, cpu: { cores: 6, memoryGb: null }, gl: { renderer: 'Apple GPU', maxTexture: 8192 } }), 'mobile-low', 'mobile-high', 'phone'],
  ['iPhone 8, Safari (2 cores: weak)', dev({ display: { w: 375, h: 553, shortSide: 375, dpr: 2 }, input: touch, cpu: { cores: 2, memoryGb: null }, gl: { renderer: 'Apple GPU', maxTexture: 8192 } }), 'mobile-low', 'mobile-low', 'phone'],
  ['iPad Pro M4, Safari (coarse primary pointer, trackpad attached)', dev({ display: { w: 1032, h: 1376, shortSide: 1032, dpr: 2 }, input: { ...touch, anyFine: true, anyHover: true }, cpu: { cores: 10, memoryGb: null }, gl: { renderer: 'Apple GPU', maxTexture: 16384 } }), 'mobile-low', 'mobile-high', 'tablet'],
  ['Pixel 8, Chrome (Mali-G715 Immortalis)', dev({ display: { w: 412, h: 780, shortSide: 412, dpr: 2.6 }, input: touch, cpu: { cores: 9, memoryGb: 8 }, gl: { renderer: 'ANGLE (ARM, Mali-G715-Immortalis MC10, OpenGL ES 3.2)' } }), 'mobile-low', 'mobile-high', 'phone'],
  ['Pixel 6a, Chrome (Mali-G78)', dev({ display: { w: 412, h: 780, shortSide: 412, dpr: 2.6 }, input: touch, cpu: { cores: 8, memoryGb: 6 }, gl: { renderer: 'ANGLE (ARM, Mali-G78, OpenGL ES 3.2)' } }), 'mobile-low', 'mobile-high', 'phone'],
  ['Pixel 4a, Chrome (Adreno 618)', dev({ display: { w: 393, h: 786, shortSide: 393, dpr: 2.75 }, input: touch, cpu: { cores: 8, memoryGb: 6 }, gl: { renderer: 'ANGLE (Qualcomm, Adreno (TM) 618, OpenGL ES 3.2)' } }), 'mobile-low', 'mobile-low', 'phone'],
  ['Galaxy S23, Chrome (Adreno 740)', dev({ display: { w: 360, h: 780, shortSide: 360, dpr: 3 }, input: touch, cpu: { cores: 8, memoryGb: 8 }, gl: { renderer: ADRENO740 } }), 'mobile-low', 'mobile-high', 'phone'],
  ['Galaxy A14, Chrome (Mali-G52, 4 GB)', dev({ display: { w: 360, h: 780, shortSide: 360, dpr: 2 }, input: touch, cpu: { cores: 8, memoryGb: 4 }, gl: { renderer: 'ANGLE (ARM, Mali-G52 MC2, OpenGL ES 3.2)' } }), 'mobile-low', 'mobile-low', 'phone'],
  ['Old phone, Mali-T880 (the number is not a G-series)', dev({ display: { w: 360, h: 640, shortSide: 360, dpr: 2 }, input: touch, cpu: { cores: 8, memoryGb: 6 }, gl: { renderer: 'Mali-T880' } }), 'mobile-low', 'mobile-low', 'phone'],
  ['Galaxy Tab S9 Ultra, Chrome (a tablet)', dev({ display: { w: 1848, h: 1000, shortSide: 1848, dpr: 2 }, input: touch, cpu: { cores: 8, memoryGb: 8 }, gl: { renderer: ADRENO740 } }), 'mobile-low', 'mobile-high', 'tablet'],
  ['Flagship phone with Save-Data on', dev({ display: { w: 360, h: 780, shortSide: 360, dpr: 3 }, input: touch, net: { saveData: true }, cpu: { cores: 8, memoryGb: 8 }, gl: { renderer: ADRENO740 } }), 'mobile-low', 'mobile-low', 'phone'],
  ['Flagship phone on 3g', dev({ display: { shortSide: 390 }, input: touch, net: { effectiveType: '3g' }, cpu: { cores: 8, memoryGb: 8 }, gl: { renderer: ADRENO740 } }), 'mobile-low', 'mobile-low', 'phone'],
  ['Flagship phone, prefers-reduced-data', dev({ display: { shortSide: 390 }, input: touch, prefs: { reducedData: true }, cpu: { cores: 8, memoryGb: 8 }, gl: { renderer: ADRENO740 } }), 'mobile-low', 'mobile-low', 'phone'],
  ['Quest 3 browser, 2D window', dev({ display: { w: 1280, h: 720, shortSide: 720, dpr: 1 }, input: touch, cpu: { cores: 8, memoryGb: 8 }, gl: { renderer: ADRENO740 }, xr: { api: true, vr: true, layersApi: true, handApi: true, fixedFoveationApi: true, frameRatesApi: true } }), 'mobile-low', 'mobile-high', 'tablet'],
  ['Vision Pro Safari, 2D window (Mac UA, coarse, generic Apple GPU)', dev({ display: { w: 1024, h: 998, shortSide: 540, dpr: 2 }, input: touch, cpu: { cores: 8, memoryGb: null }, gl: { renderer: 'Apple GPU', maxTexture: 8192 }, xr: { api: true, vr: true, handApi: true } }), 'mobile-low', 'mobile-high', 'phone'],
  ['Desktop, Save-Data on, discrete GPU', dev({ net: { saveData: true }, gl: { renderer: RTX } }), 'desktop-mid', 'desktop-mid', 'desktop'],
  ['Desktop on a 3g link, discrete GPU', dev({ net: { effectiveType: '3g' }, gl: { renderer: RTX } }), 'desktop-mid', 'desktop-mid', 'desktop'],
  ['Desktop, prefers-reduced-data', dev({ prefs: { reducedData: true }, gl: { renderer: RTX } }), 'desktop-mid', 'desktop-mid', 'desktop'],
  ['Desktop, 4 cores, discrete GPU (weak CPU)', dev({ cpu: { cores: 4, memoryGb: 8 }, gl: { renderer: RTX } }), 'desktop-mid', 'desktop-high', 'desktop'],
  ['Desktop, 32 GB reported (8 is not a ceiling)', dev({ cpu: { cores: 10, memoryGb: 32 }, gl: { renderer: M2 } }), 'desktop-high', 'desktop-high', 'desktop'],
  ['Ryzen laptop, Radeon Vega (an APU)', dev({ gl: { renderer: 'ANGLE (AMD, AMD Radeon(TM) Vega 8 Graphics Direct3D11 vs_5_0 ps_5_0, D3D11)' }, cpu: { cores: 8, memoryGb: 8 } }), 'desktop-mid', 'desktop-high', 'desktop'],
  ['Radeon RX 6700', dev({ gl: { renderer: 'ANGLE (AMD, AMD Radeon RX 6700 XT Direct3D11 vs_5_0 ps_5_0, D3D11)' } }), 'desktop-high', 'desktop-high', 'desktop'],
  ['Intel Arc A770 (discrete)', dev({ gl: { renderer: 'ANGLE (Intel, Intel(R) Arc(TM) A770 Graphics Direct3D11 vs_5_0 ps_5_0, D3D11)' } }), 'desktop-high', 'desktop-high', 'desktop'],
  ['Desktop, unknown GPU string (Firefox masks it)', dev({ gl: { renderer: 'Mozilla' } }), 'desktop-high', 'desktop-high', 'desktop'],
  ['Desktop, no renderer string at all', dev(), 'desktop-high', 'desktop-high', 'desktop'],
  ['Windows touchscreen laptop (the primary pointer is the mouse)', dev({ input: { touchPoints: 10 }, gl: { renderer: UHD }, cpu: { cores: 8, memoryGb: 16 } }), 'desktop-mid', 'desktop-high', 'desktop'],
  ['No WebGL 2', dev({ gl: { webgl2: false } }), 'mobile-low', 'mobile-low', 'desktop'],
];
for (const [name, s, tier, ceiling, form] of PAGE) {
  const r = chooseTier(s);
  assert.equal(r.tier, tier, `${name}: tier ${r.tier} (${r.reasons})`);
  assert.equal(r.ceiling, ceiling, `${name}: ceiling ${r.ceiling} (${r.reasons})`);
  assert.equal(r.form, form, `${name}: form ${r.form}`);
  assert.equal(formOf(s), form, `${name}: formOf`);
  assert.ok(r.reasons.length > 0, `${name}: says why`);
  rows++;
}
// the cheap tier is never above the ceiling, and a ceiling is never a tier the budget table lacks
for (const [name, s] of PAGE.map(r => [r[0], r[1]] as const)) { const r = chooseTier(s); assert.ok(r.tier in PAGE_TIERS && r.ceiling in PAGE_TIERS, name); }

// ------------------------------------------------------------------------------------------------------------------ the GPU hints
const G: Array<[string, boolean, string]> = [
  ['Adreno (TM) 740', true, 'mobile-flagship'], ['Adreno (TM) 730', true, 'mobile-flagship'], ['Adreno (TM) 650', true, 'mobile-mid'], ['Adreno (TM) 618', true, 'mobile-low'],
  ['Mali-G715-Immortalis MC11', true, 'mobile-flagship'], ['Mali-G720', true, 'mobile-flagship'], ['Mali-G78 MP14', true, 'mobile-mid'], ['Mali-G52 MC2', true, 'mobile-low'], ['Mali-T880', true, 'mobile-low'],
  ['PowerVR Rogue GE8320', true, 'mobile-low'], ['Apple GPU', true, 'mobile-mid'], ['Apple GPU', false, 'unknown'],
  [M2, false, 'discrete'], ['ANGLE (Apple, ANGLE Metal Renderer: Apple M1, Unspecified Version)', false, 'discrete'], [RTX, false, 'discrete'], ['ANGLE (AMD, AMD Radeon RX 7900 XTX, D3D11)', false, 'discrete'],
  [UHD, false, 'integrated'], ['ANGLE (Intel, Intel(R) Iris(R) Xe Graphics, D3D11)', false, 'integrated'], ['AMD Radeon(TM) Graphics', false, 'integrated'],
  ['SwiftShader Device', false, 'software'], ['llvmpipe', false, 'software'], ['Microsoft Basic Render Driver', false, 'software'], ['', false, 'unknown'], ['WebKit WebGL', false, 'unknown'],
];
for (const [r, coarse, want] of G) { assert.equal(gpuClass(r, { coarse }), want, `gpuClass(${r}, coarse ${coarse})`); rows++; }

// ------------------------------------------------------------------------------------------------------------------ the XR sessions
const sess = (o: Partial<XrSessionFacts>): XrSessionFacts => ({ mode: 'vr', profiles: [], targetRayModes: ['tracked-pointer'], hasFrameRates: false, frameRates: [], hasFixedFoveation: false, blend: 'opaque', layerWidth: 0, layerHeight: 0, renderer: '', ...o });
const XR: Array<[string, XrSessionFacts, string, string | null]> = [
  ['Quest 3 (meta-quest-touch-plus first)', sess({ renderer: ADRENO740, profiles: ['meta-quest-touch-plus', 'oculus-touch-v3', 'oculus-touch-v2', 'oculus-touch'], hasFrameRates: true, frameRates: [72, 80, 90, 120], hasFixedFoveation: true }), 'xr-standalone', 'gen2'],
  ['Quest 2 (oculus-touch-v3 first, Adreno 650)', sess({ renderer: 'ANGLE (Qualcomm, Adreno (TM) 650, OpenGL ES 3.2)', profiles: ['oculus-touch-v3', 'oculus-touch-v2', 'oculus-touch', 'generic-trigger-squeeze-thumbstick'], hasFrameRates: true, hasFixedFoveation: true }), 'xr-standalone', 'gen1'],
  ['Quest, hands only, GPU string masked (no gen2 evidence is gen1)', sess({ renderer: 'WebKit WebGL', hasFrameRates: true, hasFixedFoveation: true }), 'xr-standalone', 'gen1'],
  ['Quest 3 passthrough (immersive-ar)', sess({ mode: 'ar', renderer: ADRENO740, blend: 'alpha-blend', profiles: ['meta-quest-touch-plus'], hasFrameRates: true }), 'xr-standalone', 'gen2'],
  ['Quest 3, profile unknown but a flagship Adreno string', sess({ renderer: ADRENO740, hasFrameRates: true }), 'xr-standalone', 'gen2'],
  ['Quest 3, Oculus v3 listed first (a Quest 2 profile) on a masked string', sess({ renderer: 'WebKit WebGL', profiles: ['oculus-touch-v3', 'meta-quest-touch-plus'], hasFrameRates: true }), 'xr-standalone', 'gen1'],
  ['Pico 4', sess({ renderer: ADRENO740, profiles: ['pico-4'], hasFrameRates: true }), 'xr-standalone', 'gen2'],
  ['Galaxy XR (Chrome, hands)', sess({ renderer: 'ANGLE (Qualcomm, Adreno (TM) 750, OpenGL ES 3.2)', profiles: ['samsung-galaxyxr'] }), 'xr-standalone', 'gen2'],
  ['PC VR, Index, RTX', sess({ renderer: 'ANGLE (NVIDIA, NVIDIA GeForce RTX 3080 Direct3D11)', profiles: ['valve-index', 'generic-trigger-squeeze-thumbstick'] }), 'xr-tethered', null],
  ['PC VR, Quest Link in Chrome (touch-plus, no standalone hint)', sess({ renderer: 'ANGLE (NVIDIA, NVIDIA GeForce RTX 4070 Direct3D11)', profiles: ['meta-quest-touch-plus'] }), 'xr-tethered', null],
  ['Vision Pro (transient-pointer)', sess({ renderer: 'Apple GPU', targetRayModes: ['gaze', 'transient-pointer'] }), 'vision', null],
  ['Vision Pro with a tracked-pointer too', sess({ renderer: 'Apple GPU', targetRayModes: ['tracked-pointer', 'transient-pointer'] }), 'vision', null],
];
for (const [name, f, tier, gen] of XR) {
  const r = chooseXrTier(f);
  assert.equal(r.tier, tier, `${name}: ${r.tier} (${r.reasons})`);
  assert.equal(r.gen, gen, `${name}: gen ${r.gen} (${r.reasons})`);
  assert.ok(r.reasons.length, `${name}: says why`);
  const b = xrBudgetFor(r.tier, r.gen);
  assert.ok(b === (tier === 'vision' ? XR_TIERS.vision : tier === 'xr-tethered' ? XR_TIERS.tethered : gen === 'gen2' ? XR_TIERS['standalone-gen2'] : XR_TIERS['standalone-gen1']), `${name}: budget`);
  rows++;
}

// ------------------------------------------------------------------------------------------------------------------ the buffer cap
// 4K at ratio 1 is the cap's own size (8.3 Mpx); a 5K screen at ratio 2 and an ultrawide at ratio 2 fall to what fits
assert.equal(capRatio(2, 1280, 720, 8.3), 2, '1280 x 720 at ratio 2 is 3.7 Mpx: untouched');
assert.equal(capRatio(1, 3840, 2160, 8.3), 1, '4K at ratio 1 sits at the cap');
assert.ok(Math.abs(capRatio(2, 2560, 1440, 8.3) - 1.5) < 0.01, '5K retina falls to about 1.5');
assert.ok(Math.abs(capRatio(2, 3440, 1440, 8.3) - 1.3) < 0.02, `ultrawide at ratio 2 falls to ${capRatio(2, 3440, 1440, 8.3)}`);
assert.ok(Math.abs(capRatio(3, 393, 852, PAGE_TIERS['mobile-low'].bufferMpx) - 1.893) < 0.01, 'a 3x phone at the cap alone (the tier holds it to 1.25 before this)');
assert.equal(capRatio(2, 0, 0, 8.3), 2, 'no size yet: untouched');
rows += 6;

// ------------------------------------------------------------------------------------------------------------------ drift guards
// desktop-high is what the player does today. Its numbers are read from the sources that set them, so a change there fails here.
const html = fs.readFileSync(path.join(ROOT, 'room-creator.html'), 'utf8'), viewer = fs.readFileSync(path.join(ROOT, 'assets', 'viewer.ts'), 'utf8');
const dprLit = /renderer\.setPixelRatio\(Math\.min\(window\.devicePixelRatio, (\d+(?:\.\d+)?)\)\)/.exec(html);
const mapLit = /sunLight\.shadow\.mapSize\.width = (\d+)/.exec(html);
const adapt = /: \{ window: 0\.75, frames: 30, low: (\d+), gain: [\d.]+, upAfter: (\d+), upFps: (\d+) \}/.exec(viewer);
const H = PAGE_TIERS['desktop-high'];
assert.ok(dprLit && mapLit && adapt, 'the literals this test reads are still where it looks (room-creator.html l.2003 / l.2085, viewer.ts ADAPT)');
assert.equal(H.dprStart, Number(dprLit![1]), 'desktop-high pixel ratio = room-creator.html setPixelRatio(min(dpr, N))');
assert.equal(H.dprCap, H.dprStart, 'desktop-high never starts above its cap');
assert.equal(H.shadowMap, Number(mapLit![1]), 'desktop-high sun map = room-creator.html sunLight.shadow.mapSize');
assert.equal(H.fpsFloor, Number(adapt![1]), 'desktop-high fps floor = ADAPT.low');
assert.equal(PROMOTE_SECONDS, Number(adapt![2]), 'promotion waits as long as ADAPT.upAfter');
assert.equal(PROMOTE_FPS, Number(adapt![3]), 'promotion needs ADAPT.upFps');
assert.equal(H.shadowRefresh, 'as-shipped'); assert.equal(H.eco, false);
for (const [k, b] of Object.entries(PAGE_TIERS)) { assert.ok(b.dprFloor === 1 && b.dprStart <= b.dprCap && b.fpsFloor < b.fpsTarget, `${k}: sane`); }
// the mobile tiers are strictly cheaper than desktop-high in everything a phone pays for
const L = PAGE_TIERS['mobile-low'];
assert.ok(L.dprStart < H.dprStart && L.bufferMpx < H.bufferMpx && L.shadowMap < H.shadowMap, 'mobile-low is cheaper');
assert.ok(PAGE_TIERS['mobile-high'].bufferMpx < H.bufferMpx, 'mobile-high is cheaper');
rows += 12;

// ------------------------------------------------------------------------------------------------------------------ the live profile in Node (no window, no GL: the defaults)
{
  const p = getPlatform();
  assert.equal(p, getPlatform(), 'memoised');
  assert.equal(p.tier, 'desktop-high'); assert.equal(p.form, 'desktop');
  const seen: string[] = [];
  const off = onPlatformChange((q, why) => { seen.push(`${q.tier}:${why}`); });
  // a context the way the renderer's reads: an Intel renderer lowers the start tier, and only lowers it
  (globalThis as any).WebGL2RenderingContext = class {};
  const fake = Object.assign(new (globalThis as any).WebGL2RenderingContext(), {
    getExtension: (n: string) => (n === 'WEBGL_debug_renderer_info' ? { UNMASKED_RENDERER_WEBGL: 1, UNMASKED_VENDOR_WEBGL: 2 } : null),
    getParameter: (k: number) => (k === 1 ? UHD : k === 2 ? 'Google Inc. (Intel)' : k === 7 ? 16384 : k === 8 ? 8 : ''),
    RENDERER: 3, VENDOR: 4, MAX_TEXTURE_SIZE: 7, MAX_SAMPLES: 8,
  });
  const r = refinePlatform(fake);
  assert.equal(r.tier, 'desktop-mid', `an integrated GPU lowers the start tier (${r.reasons})`);
  assert.equal(r.budget, PAGE_TIERS['desktop-mid']); assert.equal(r.signals.gl.renderer, UHD);
  refinePlatform(fake);
  setPageTier('desktop-high', 'test');
  assert.equal(getPlatform().tier, 'desktop-high', 'setPageTier moves it (the controllers promote)');
  assert.deepEqual(seen, ['desktop-mid:refine', 'desktop-high:test']);
  off();
  rows += 6;
}

console.log(`test-platform: ${rows} rows OK (${PAGE.length} page devices, ${G.length} GPU strings, ${XR.length} XR sessions, the buffer cap, the drift guards, the live profile)`);
