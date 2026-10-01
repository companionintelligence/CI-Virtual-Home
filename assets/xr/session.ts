// assets/xr/session.ts : the WebXR session of the live player: start it, run it, take it down and leave the page as it was.
// Loaded only when a person asks for VR (entry.ts imports it on the tap), so a visitor who never does downloads none of this,
// nor of the modules it pulls in (bake, locomotion, the UI kit, the rig, the loop).
//
// STATES  idle -> starting -> running -> ending -> idle. enter() is called from a click; end() from the session's own
// 'end' event, a lost WebGL context, pagehide, the offline hooks (viewer.ts beforeExternalRender) and the Exit button. end() is
// idempotent and always leaves the page in its 2D state, whatever stage the start had reached.
//
// THE START, in this order (each step is there for a reason that bites on some browser):
//   1  requestSession is called by entry.ts, synchronously in the click handler: a session needs a user gesture, the gesture
//      is spent by time and by awaits, and importing this module is an await. It arrives here as `pre`.
//   2  the session's facts choose the XR tier (platform.chooseXrTier) and so the budget: refresh rate, framebuffer scale, fixed
//      foveation, lights, LOD radius. r169 fixes the framebuffer scale at setSession, so the tier has to be known before it.
//   3  one snapshot of everything the session will change (camera, controls, renderer, scene, the player's own state); one
//      restore. three's WebXRManager overwrites the camera's fov and projection every frame and restores NEITHER (measured: a
//      different pixel hash after exit), so the page's camera is put back here, field by field.
//   4  renderer.xr.enabled, the reference space type (local-floor only when it was granted: r169 awaits requestReferenceSpace
//      with no fallback), the framebuffer scale, the foveation, then renderer.xr.setAnimationLoop(cb) BEFORE
//      await renderer.xr.setSession(session). The loop is `renderer.xr.setAnimationLoop`, never `renderer.setAnimationLoop` (that
//      also starts a window-rAF loop which calls the callback with no frame).
//   5  from the first XR frame the veil card is drawn while the headset view is built behind it (realism pinned to its cheapest
//      tier, the 2D player's helpers hidden, the bake, the shader compile, the locomotion and UI modules), then the veil lifts.
// The person is never moved except by the rig (rig.ts), and by a blink.
//
// WHAT EMULATION CANNOT PROVE (see reference/XR-DEVICE-CHECKLIST.md): the projection-layer path (Quest and Chrome 147 take it: IWER
// has no XRWebGLBinding), real frame times, the effect of foveation and viewport scale, the page's rAF being paused (IWER keeps it
// running, which is why the loop never depends on it either way).
import { getPlatform, chooseXrTier, commitXrSession } from '../platform.js';
import { xrBudgetFor } from '../platform-types.js';
import type { XrBudget, XrGen, XrSessionFacts, XrTierName } from '../platform-types.js';
import type { XrFrame, XrHost, XrMode, XrSessionApi, XrState, XrUi, XrBake, XrInput, XrLocomotion } from './host.js';
import { XR_EVENT } from './host.js';
import { createBake } from './bake.js';
import { createLocomotion } from './locomotion.js';
import { createUi } from './ui/index.js';
import { createRig, EYE_HEIGHT_M } from './rig.js';
import type { XrRigImpl } from './rig.js';
import { createHud } from './hud.js';
import type { XrHud } from './hud.js';
import { createLoop } from './loop.js';
import type { XrLoop } from './loop.js';
import { createController } from './controller.js';
import type { GateResult, XrController } from './controller.js';

/** What viewer.ts adds to the XrHost: the player's own state, which only its closures can reach. */
export interface XrPlayerHost extends XrHost {
  getT(): number; seek(t: number): void; pause(): void; selectShot(key: string): void; setTod(key: string): void;
  /** the player stops moving and answering the page (the shot paused, the free camera and its panels closed, the keys cleared, the page inert); returns the inverse */
  suspend(): () => void;
  /** feat/realism's `realism.pin(tier|null)`; absent until that branch lands (integration note N2) */
  realism?: { pin(tier: 0 | 1 | 2 | null): void; reapply?(): void } | null;
}
export interface XrBus { emit(state: 'starting' | 'started' | 'ended' | 'error', detail?: any): void; frame: Set<(f: XrFrame) => void> }
export type EnterResult = Awaited<ReturnType<XrSessionApi['enter']>>;
export interface XrSessionImpl extends XrSessionApi {
  /** `pre` is the requestSession() promise entry.ts made inside the click */
  enter(mode: XrMode, pre?: Promise<any>): Promise<EnterResult>;
  debug(): any;
  /** the rig of the running session (tests and the story's director place the person through it); null when idle */
  rig(): XrRigImpl | null;
}

const wait = (ms: number) => new Promise<void>(r => setTimeout(r, ms));
const withTimeout = <T>(p: Promise<T>, ms: number, v: T): Promise<T> => Promise.race([p, wait(ms).then(() => v)]);
const MSG = {
  busy: 'VR is already starting.',
  insecure: 'VR needs a secure page (https).',
  unsupported: 'This browser cannot start VR.',
  denied: 'VR was not allowed. Choose Enter VR again and allow it.',
  tooDetailed: 'This home is too detailed for this headset. View it on your phone or computer.',
  error: 'VR could not start. Try again.',
  ended: 'VR ended before the home was ready.',
};
const TIER_PARAM: Record<string, { tier: XrTierName; gen: XrGen | null }> = {
  'standalone-gen1': { tier: 'xr-standalone', gen: 'gen1' }, 'standalone-gen2': { tier: 'xr-standalone', gen: 'gen2' },
  tethered: { tier: 'xr-tethered', gen: null }, vision: { tier: 'vision', gen: null },
};

class Cancelled extends Error {}

interface Live {
  session: any; mode: XrMode;
  snap: ReturnType<typeof takeSnapshot>;
  budget: XrBudget; tier: { name: XrTierName; gen: XrGen | null }; reasons: string[]; forced: boolean;
  rig: XrRigImpl | null; hud: XrHud | null; loop: XrLoop | null; controller: XrController | null;
  bake: XrBake | null; loco: XrLocomotion | null; input: XrInput | null; ui: XrUi | null;
  resume: (() => void) | null; cleanups: Array<() => void>;
  sessionEnded: boolean; cancel: string | null; enterDone: Promise<void>; finishEnter: () => void;
  path: 'base-layer' | 'projection-layer'; refSpace: 'local-floor' | 'local';
  held: number; promoted: boolean; started: number;
}

// ---------------------------------------------------------------------------------------------------------- the snapshot
// Everything the session changes, in one object, restored by one function. The two halves are separate because three's own
// WebXRManager puts the pixel ratio and the size back itself, asynchronously, when the session has really ended: scene() is
// restored at once, renderer() after that.
function takeSnapshot(host: XrPlayerHost) {
  const { THREE, renderer, scene, camera, controls } = host;
  const sm = renderer.shadowMap, size = renderer.getSize(new THREE.Vector2());
  const c = {
    parent: camera.parent, position: camera.position.clone(), quaternion: camera.quaternion.clone(), scale: camera.scale.clone(),
    fov: camera.fov, near: camera.near, far: camera.far, zoom: camera.zoom, aspect: camera.aspect, view: camera.view,
    projection: camera.projectionMatrix.clone(), projectionInverse: camera.projectionMatrixInverse.clone(),
  };
  const ctl = controls ? { enabled: controls.enabled, target: controls.target.clone() } : null;
  const r = {
    shadowAuto: sm.autoUpdate, shadowNeeds: sm.needsUpdate, tone: renderer.toneMapping, exposure: renderer.toneMappingExposure,
    xrEnabled: renderer.xr.enabled, pixelRatio: renderer.getPixelRatio(), w: size.x, h: size.y, infoAutoReset: renderer.info.autoReset,
    sortObjects: renderer.sortObjects, localClipping: renderer.localClippingEnabled, outputColorSpace: renderer.outputColorSpace,
  };
  const s = { background: scene.background, fog: scene.fog, environment: scene.environment };
  // the 2D player's own overlays (the camera path, the shot's ghost camera, the look-target ring: viewer.ts marks every one of
  // them userData.isHelper) are not part of a headset's house; hidden for the session, put back exactly
  const hidden: any[] = [];
  const html = document.documentElement;
  const hadXr = html.dataset.xr;
  return {
    hideHelpers() { scene.traverse((o: any) => { if (o.userData && o.userData.isHelper && o.visible) { hidden.push(o); o.visible = false; } }); },
    /** the page's scene, camera and controls */
    scene() {
      for (const o of hidden.splice(0)) o.visible = true;
      scene.background = s.background; scene.fog = s.fog; scene.environment = s.environment;
      if (c.parent) c.parent.add(camera); else camera.removeFromParent();
      camera.position.copy(c.position); camera.quaternion.copy(c.quaternion); camera.scale.copy(c.scale);
      camera.fov = c.fov; camera.near = c.near; camera.far = c.far; camera.zoom = c.zoom; camera.aspect = c.aspect; camera.view = c.view;
      camera.projectionMatrix.copy(c.projection); camera.projectionMatrixInverse.copy(c.projectionInverse);   // (exact: not rebuilt from fov, which three has overwritten)
      camera.updateMatrixWorld(true);
      if (controls && ctl) { controls.enabled = ctl.enabled; controls.target.copy(ctl.target); controls._sphericalDelta?.set(0, 0, 0); controls._panOffset?.set(0, 0, 0); if ('_scale' in controls) controls._scale = 1; }
      const sh = renderer.shadowMap; sh.autoUpdate = r.shadowAuto; sh.needsUpdate = r.shadowNeeds;
      renderer.toneMapping = r.tone; renderer.toneMappingExposure = r.exposure; renderer.info.autoReset = r.infoAutoReset;
      renderer.sortObjects = r.sortObjects; renderer.localClippingEnabled = r.localClipping; renderer.outputColorSpace = r.outputColorSpace;
      if (hadXr === undefined) delete html.dataset.xr; else html.dataset.xr = hadXr;
    },
    /** after three has ended its side: the XR flag, the framebuffer defaults, and the pixel ratio and size (three restores those itself; this only checks) */
    renderer() {
      renderer.xr.enabled = r.xrEnabled;
      renderer.xr.setFramebufferScaleFactor(1); renderer.xr.setReferenceSpaceType('local-floor'); renderer.xr.setFoveation(1);
      if (renderer.getPixelRatio() !== r.pixelRatio) renderer.setPixelRatio(r.pixelRatio);
      const now = renderer.getSize(new THREE.Vector2());
      if (now.x !== r.w || now.y !== r.h) renderer.setSize(r.w, r.h, false);
    },
    raw: { camera: c, renderer: r },
  };
}

// ---------------------------------------------------------------------------------------------------------- the session
export function createSession(host: XrPlayerHost, bus: XrBus): XrSessionImpl {
  const { THREE, renderer, scene, camera, canvas } = host;
  let state: XrState = 'idle', mode: XrMode | null = null, L: Live | null = null, endP: Promise<void> | null = null;
  const log = (...a: any[]) => console.info('[xr]', ...a);
  const reducedMotion = (() => { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; } })();
  const callsOverride = (() => { const n = Number(host.params.get('xrcalls')); return Number.isFinite(n) && n > 0 ? n : null; })();
  const fire = (s: 'starting' | 'started' | 'ended' | 'error', extra: any = {}) => bus.emit(s, { mode, tier: L ? L.tier : null, ...extra });
  const fail = (reason: 'unsupported' | 'insecure' | 'denied' | 'too-detailed' | 'error', message: string) => ({ ok: false as const, reason, message });

  // ---- the tier
  function debugRenderer(): string {
    const p = getPlatform().signals.gl.renderer; if (p) return p;
    try { const gl = renderer.getContext(), e = gl.getExtension('WEBGL_debug_renderer_info'); return e ? String(gl.getParameter(e.UNMASKED_RENDERER_WEBGL)) : ''; } catch { return ''; }
  }
  function readFacts(session: any, m: XrMode): XrSessionFacts {
    const src: any[] = Array.from(session.inputSources || []);
    const rates: number[] = session.supportedFrameRates ? Array.from(session.supportedFrameRates) : [];
    const G: any = globalThis, fov = (k: string) => !!(G[k] && G[k].prototype && 'fixedFoveation' in G[k].prototype);
    const layer: any = renderer.xr.getBaseLayer?.();
    return {
      mode: m, profiles: src.flatMap(s => Array.from(s.profiles || []) as string[]), targetRayModes: src.map(s => s.targetRayMode),
      hasFrameRates: rates.length > 0, frameRates: rates, hasFixedFoveation: fov('XRWebGLLayer') || fov('XRProjectionLayer'),
      blend: session.environmentBlendMode || 'opaque',
      layerWidth: layer ? (layer.framebufferWidth ?? layer.textureWidth ?? 0) : 0, layerHeight: layer ? (layer.framebufferHeight ?? layer.textureHeight ?? 0) : 0,
      renderer: debugRenderer(),
    };
  }
  const budgetFor = (t: XrTierName, g: XrGen | null): XrBudget => structuredClone(xrBudgetFor(t, g));
  function describe(l: Live) {
    const s = l.session, sources: any[] = Array.from(s.inputSources || []);
    return {
      mode: l.mode, tier: l.tier, reasons: l.reasons, enabledFeatures: s.enabledFeatures ? Array.from(s.enabledFeatures) : [],
      renderStateLayers: s.renderState && s.renderState.layers !== undefined, path: l.path, referenceSpace: l.refSpace,
      framebuffer: (() => { const b: any = renderer.xr.getBaseLayer?.(); return b ? [b.framebufferWidth ?? b.textureWidth, b.framebufferHeight ?? b.textureHeight] : null; })(),
      frameRate: s.frameRate ?? null, supportedFrameRates: s.supportedFrameRates ? Array.from(s.supportedFrameRates) : [],
      inputProfiles: sources.flatMap(x => Array.from(x.profiles || [])), targetRayModes: sources.map(x => x.targetRayMode), blend: s.environmentBlendMode ?? null,
      budget: l.budget,
    };
  }
  function commit(l: Live) {
    const d = describe(l), s = l.session;
    commitXrSession({
      mode: l.mode, tier: l.tier.name, gen: l.tier.gen, budget: l.budget, reasons: l.reasons, enabledFeatures: d.enabledFeatures as unknown as string[], inputProfiles: d.inputProfiles as unknown as string[],
      targetRayModes: d.targetRayModes, blend: (d.blend || 'opaque') as any, refreshHz: d.frameRate, supportedRates: d.supportedFrameRates as unknown as number[], layerPath: l.path,
      hands: (d.enabledFeatures as string[]).includes('hand-tracking'),
    });
    void s;
  }
  /** a later look at the facts (a controller arrived, a pinch showed a transient-pointer): the tier may be a different one */
  function reclassify(l: Live, why: string) {
    if (l.forced || !l.session || l.sessionEnded) return;
    const c = chooseXrTier(readFacts(l.session, l.mode));
    if (c.tier === l.tier.name && c.gen === l.tier.gen) return;
    // never demote a standalone gen2 on a thin read; a gen1 start is promoted, and a headset that turns out to be a vision / tethered one is moved
    if (l.tier.name === 'xr-standalone' && l.tier.gen === 'gen2' && c.tier === 'xr-standalone') return;
    const was = l.tier;
    const next = budgetFor(c.tier, c.gen);
    next.lodRadiusM = Math.max(l.budget.lodRadiusM, next.lodRadiusM);   // (the controller may have shrunk it; a promotion does not grow it back by itself)
    Object.assign(l.budget, next);
    l.tier = { name: c.tier, gen: c.gen }; l.reasons = c.reasons; l.promoted = true;
    l.controller?.setBudget(l.budget);
    log('tier', was, '->', l.tier, `(${why})`, c.reasons);
    commit(l);
  }

  // ---- entry
  async function enter(m: XrMode, pre?: Promise<any>): Promise<EnterResult> {
    if (state !== 'idle') return fail('error', MSG.busy);
    if (m !== 'vr') { pre?.then((s: any) => s.end(), () => {}); return fail('unsupported', 'Augmented reality is not available yet.'); }   // (the mode parameter stays: AR is additive)
    if (!(globalThis as any).isSecureContext) { pre?.then((s: any) => s.end(), () => {}); return fail('insecure', MSG.insecure); }
    state = 'starting'; mode = m;
    let session: any;
    try {
      session = await (pre ?? (navigator as any).xr.requestSession('immersive-vr', { optionalFeatures: ['local-floor', 'bounded-floor', 'hand-tracking'] }));
    } catch (e: any) {
      state = 'idle'; mode = null;
      const n = e && e.name;
      const r = n === 'NotSupportedError' ? fail('unsupported', MSG.unsupported) : n === 'NotAllowedError' || n === 'SecurityError' ? fail('denied', MSG.denied) : fail('error', MSG.error);
      fire('error', { reason: r.reason }); return r;
    }

    // ---- 2. the tier, from what the granted session reports
    const forced = TIER_PARAM[host.params.get('xrtier') || ''];
    const facts = readFacts(session, m);
    const choice = forced ? { ...forced, reasons: ['?xrtier=' + host.params.get('xrtier')] } : chooseXrTier(facts);
    const budget = budgetFor(choice.tier, choice.gen);
    let finishEnter!: () => void; const enterDone = new Promise<void>(r => { finishEnter = r; });
    const l: Live = L = {
      session, mode: m, snap: takeSnapshot(host), budget, tier: { name: choice.tier, gen: choice.gen }, reasons: choice.reasons, forced: !!forced,
      rig: null, hud: null, loop: null, controller: null, bake: null, loco: null, input: null, ui: null, resume: null, cleanups: [],
      sessionEnded: false, cancel: null, enterDone, finishEnter, path: 'base-layer', refSpace: 'local', held: 0, promoted: false, started: performance.now(),
    };
    const cancelled = () => { if (l.cancel || l.sessionEnded) throw new Cancelled(l.cancel || 'session-ended'); };
    fire('starting');
    try {
      // the system can end the session at any moment (a crown press, the Meta button, taking the headset off for good)
      const onEnd = () => { l.sessionEnded = true; void end('session-ended'); };
      session.addEventListener('end', onEnd);
      const onLost = () => { void end('context-lost'); }, onHide = () => { void end('pagehide'); };
      canvas.addEventListener('webglcontextlost', onLost); window.addEventListener('pagehide', onHide);
      l.cleanups.push(() => { canvas.removeEventListener('webglcontextlost', onLost); window.removeEventListener('pagehide', onHide); });
      session.addEventListener('inputsourceschange', () => reclassify(l, 'inputsourceschange'));
      l.refSpace = session.enabledFeatures
        ? (Array.from(session.enabledFeatures).includes('local-floor') ? 'local-floor' : 'local')
        : await session.requestReferenceSpace('local-floor').then(() => 'local-floor' as const, () => 'local' as const);

      // ---- 3. the page stops (viewer.ts: the shot paused, the free camera closed, the page inert), the snapshot is already taken
      l.resume = host.suspend();
      document.documentElement.dataset.xr = 'vr';
      host.controls && (host.controls.enabled = false);
      if ((m as XrMode) === 'ar') scene.background = null;    // (written for the AR pass; unreachable: enter('ar') returns above)
      host.realism?.pin?.(0);                     // the cheapest realism tier, applied or not (integration note N2)
      l.snap.hideHelpers();

      // ---- 4. the renderer and the session
      const xr = renderer.xr;
      xr.enabled = true;
      xr.setReferenceSpaceType(l.refSpace);
      xr.setFramebufferScaleFactor(budget.framebufferScale.start);
      xr.setFoveation(budget.foveation ? budget.foveation.start : 0);
      camera.near = Math.min(camera.near, 0.1);   // a headset leans into things; the fade quad sits at 0.3 m, inside the frustum. (restored with the camera)
      renderer.info.autoReset = true;

      const rig = l.rig = createRig({ THREE, renderer, scene, camera, reducedMotion });
      rig.attach();
      const hud = l.hud = createHud({ THREE, renderer, scene, camera, group: rig.group, onExit: () => { void end('exit-button'); } });
      const bake = l.bake = createBake(host);
      const subs = bus.frame;
      let gateResolve: ((r: GateResult) => void) | null = null;
      const gateP = new Promise<GateResult>(r => { gateResolve = r; });
      const loop = l.loop = createLoop({
        renderer, scene, camera, rig, hud, frameSubs: subs,
        modules: () => (l.loco && l.input && l.ui && l.bake ? { input: l.input, loco: l.loco, ui: l.ui, bake: l.bake } : null),
        controller: () => l.controller, budget: () => l.budget,
        onGate: r => gateResolve?.(r),
        onError: (where, e) => { console.error(`xr ${where}:`, e); if (where === 'render') void end('render-error'); },
      });
      l.controller = createController({
        renderer, session, budget, bake, head: () => rig.head().pos, notice: t => hud.notice(t), log, callsOverride,
      });
      // 90 frames at the target rate with no evidence of a gen2 device: a gen1 start is promoted (the budget only; the bake is not redone)
      const held: (f: XrFrame) => void = f => {
        if (l.tier.name !== 'xr-standalone' || l.tier.gen !== 'gen1' || l.promoted || l.forced) return;
        l.held = f.dt * 1000 <= 1.15 * (1000 / (session.frameRate || budget.refreshHz.start)) ? l.held + 1 : 0;
        if (l.held >= 90) { l.promoted = true; const nx = budgetFor('xr-standalone', 'gen2'); nx.lodRadiusM = Math.max(l.budget.lodRadiusM, nx.lodRadiusM); Object.assign(l.budget, nx); l.tier = { name: 'xr-standalone', gen: 'gen2' }; l.reasons = [...l.reasons, '90 frames held']; l.controller?.setBudget(l.budget); log('tier gen1 -> gen2 (90 held frames)'); commit(l); }
      };
      subs.add(held); l.cleanups.push(() => subs.delete(held));
      session.addEventListener('select', (e: any) => { hud.onSelect(e); });
      xr.setAnimationLoop((t: number, f: any) => loop.callback(t, f));    // r169: this and not renderer.setAnimationLoop (see the header)
      cancelled();
      await xr.setSession(session);
      cancelled();
      l.path = xr.getBinding && xr.getBinding() ? 'projection-layer' : 'base-layer';
      // the tier's starting refresh rate where the runtime offers it (a PC runtime keeps the rate it chose)
      const offered: number[] = session.supportedFrameRates ? Array.from(session.supportedFrameRates) : [];
      if (l.tier.name !== 'xr-tethered' && typeof session.updateTargetFrameRate === 'function' && offered.includes(budget.refreshHz.start)) {
        try { void session.updateTargetFrameRate(budget.refreshHz.start).catch?.(() => {}); } catch { /* the rate stays the runtime's */ }
      }
      reclassify(l, 'layer');
      commit(l);
      log('session', describe(l));

      // ---- 5. behind the veil: wait for the pose, put the person at the door, build the headset view
      await withTimeout(loop.firstFrame, 4000, undefined);
      cancelled();
      if (loop.stats().frames === 0) throw new Error('the headset did not start drawing');
      await loop.after(2);
      cancelled();
      const eyes = xr.getCamera().cameras;
      if (l.refSpace === 'local' && eyes.length) rig.setEyeBase(eyes.reduce((s: number, e: any) => s + e.position.y, 0) / eyes.length);
      const at = entryPose(host);
      rig.placeInstant(at);
      await loop.after(2);
      cancelled();
      hud.setStatus('Preparing your home', 'Building the headset view.');
      await loop.after(1);
      const rep = await bake.apply(l.budget, rig.head().pos);
      cancelled();
      log('bake', rep);
      renderer.shadowMap.autoUpdate = false; renderer.shadowMap.needsUpdate = true;
      await withTimeout(Promise.resolve(renderer.compileAsync ? renderer.compileAsync(scene, camera) : null).catch((e: unknown) => console.warn('xr: precompile skipped', e)), 4000, undefined);
      cancelled();
      const made = createLocomotion(host, rig); l.input = made.input; l.loco = made.loco;
      const ui = l.ui = createUi(host);
      await ui.mount(rig, made.input, made.loco);
      cancelled();
      await made.loco.start();
      cancelled();
      loop.collect();

      // ---- the veil lifts
      // the first stereo frames are drawn under black, and renderer.info is read against the budget before anyone sees the house
      rig.fade.set(1);
      loop.setPhase('live');
      const verdict = await withTimeout(gateP, 4000, 'unmeasured' as GateResult);
      cancelled();
      log('gate', verdict, loop.stats());
      if (verdict === 'too-detailed') {
        l.cancel = 'too-detailed';
        hud.setStatus('This home is too detailed for this headset', 'View it on your phone or computer.');
        loop.setPhase('veil');
        await wait(3500);
        throw new Cancelled('too-detailed');
      }
      hud.placeChip(rig.head(), loop.now());
      state = 'running';
      // the black lifts over 350 ms of XR time, from the first live frame (it hides the first frame's shader links)
      { let t0 = -1; const off = (f: XrFrame) => { if (t0 < 0) t0 = f.time; rig.fade.set(1 - (f.time - t0) / 350); if (rig.fade.get() <= 0) subs.delete(off); }; subs.add(off); l.cleanups.push(() => subs.delete(off)); }
      fire('started');
      finishEnter();
      return { ok: true as const };
    } catch (e: any) {
      const stop = e instanceof Cancelled;
      const why = stop ? e.message : 'error';
      if (!stop) console.error('xr: could not start', e);
      const tooDetail = l.cancel === 'too-detailed';
      if (!stop || !tooDetail) bus.emit('error', { mode: m, tier: l.tier, reason: why });
      await doEnd(why);
      finishEnter();
      if (tooDetail) return fail('too-detailed', MSG.tooDetailed);
      return stop ? fail('error', MSG.ended) : fail('error', MSG.error);
    }
  }

  // ---- leaving
  function end(why: string): Promise<void> {
    if (!L || state === 'idle') return Promise.resolve();
    if (endP) return endP;
    const l = L;
    if (!l.cancel) l.cancel = why;     // enter() sees it at its next checkpoint and unwinds through doEnd itself
    if (state === 'starting') { try { void l.session.end().catch?.(() => {}); } catch { /* already ended */ } return l.enterDone; }
    return doEnd(why);
  }
  function doEnd(why: string): Promise<void> {
    if (endP) return endP;
    // (endP exists before the body runs: session.end() below fires the session's own 'end' event synchronously in some runtimes,
    // and that listener calls end() again)
    let done!: () => void; endP = new Promise<void>(r => { done = r; });
    void (async () => {
      const l = L; if (!l) { done(); return; }
      state = 'ending';
      const step = (name: string, fn: () => void) => { try { fn(); } catch (e) { console.warn(`xr: ${name} failed while ending`, e); } };
      // 1. stop drawing; the XR animation callback is ours alone
      step('loop', () => { l.loop?.setPhase('stopped'); renderer.xr.setAnimationLoop(null); });
      // 2. the modules, then the page's scene. None of it needs the GL context, so a lost one is no obstacle.
      step('locomotion', () => l.loco?.stop());
      step('ui', () => l.ui?.unmount());
      step('bake', () => l.bake?.restore());
      step('hud', () => l.hud?.dispose());
      step('rig', () => l.rig?.detach());
      step('realism', () => { host.realism?.pin?.(null); host.realism?.reapply?.(); });
      step('scene', () => l.snap.scene());
      for (const c of l.cleanups.splice(0)) step('cleanup', c);
      // 3. the session itself, and three's side of it (pixel ratio, size and render target are put back by WebXRManager)
      const threeDone = new Promise<void>(res => {
        if (renderer.xr.getSession() === null) return res();
        const on = () => { renderer.xr.removeEventListener('sessionend', on); res(); };
        renderer.xr.addEventListener('sessionend', on);
      });
      if (!l.sessionEnded) { l.sessionEnded = true; try { await withTimeout(Promise.resolve(l.session.end()), 2000, undefined); } catch { /* ended already */ } }
      await withTimeout(threeDone, 2000, undefined);
      // 4. the renderer, the page, the platform
      step('renderer', () => { renderer.xr.enabled = l.snap.raw.renderer.xrEnabled; renderer.setAnimationLoop(null); l.snap.renderer(); });
      step('player', () => { l.resume?.(); });
      step('platform', () => commitXrSession(null));
      // a lost context comes back by itself; the page needs a frame when it does
      if (why === 'context-lost') { const back = () => { canvas.removeEventListener('webglcontextrestored', back); host.markDirty(); }; canvas.addEventListener('webglcontextrestored', back); }
      step('resync', () => { window.dispatchEvent(new Event('resize')); host.markDirty(); });
      const was = L; const tier = was ? was.tier : null;
      L = null; state = 'idle'; mode = null; endP = null;
      log('ended', why);
      bus.emit('ended', { mode: 'vr', tier, reason: why });
      if (why === 'too-detailed') host.toast(MSG.tooDetailed);
      else if (why === 'render-error') host.toast('VR stopped because of an error. The home is back on the page.');
      was?.finishEnter();
      done();
    })();
    return endP;
  }

  function entryPose(h: XrPlayerHost): { feet: [number, number, number]; yawDeg: number } {
    const e = (h.anchors() || {}).entry;
    if (e && Number.isFinite(e.x) && Number.isFinite(e.z)) {
      const ox = e.out ? e.out[0] : 0, oz = e.out ? e.out[1] : 1;
      return { feet: [e.x - ox * 1.4, e.y || 0, e.z - oz * 1.4], yawDeg: (Math.atan2(ox, oz) * 180) / Math.PI };   // just inside the front door, facing in
    }
    const p = camera.position; return { feet: [p.x, 0, p.z], yawDeg: 0 };
  }

  const api: XrSessionImpl = {
    get state() { return state; },
    get mode() { return mode; },
    get tier() { return L ? L.tier : null; },
    set tier(_v) { /* read-only: the tier is chosen from the granted session */ },
    enter, end,
    on: (ev, cb) => { const f = (e: Event) => { const d = (e as CustomEvent).detail; if (d && d.state === ev) cb(d); }; window.addEventListener(XR_EVENT, f); return () => window.removeEventListener(XR_EVENT, f); },
    onFrame: cb => { bus.frame.add(cb); return () => { bus.frame.delete(cb); }; },
    ui: () => (L && L.ui) || null,
    locomotion: () => (L && L.loco) || null,
    rig: () => (L && L.rig) || null,
    debug() {
      const l = L; if (!l) return null;
      return { state, ...describe(l), controller: l.controller?.state(), loop: l.loop?.stats(), phase: l.loop?.phase(), bake: l.bake?.report(), rigY: l.rig?.group.position.y, fade: l.rig?.fade.get() };
    },
  };
  return api;
}
