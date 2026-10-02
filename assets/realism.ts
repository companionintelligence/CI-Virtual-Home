// Live-player realism: the registry that installs, tiers, restores and removes the player's look-only effects.
//
// WHAT THIS IS. The portal's player (assets/viewer.ts, ?mode=view) can draw a home better than the product frames
// do: baked ambient occlusion, water, a procedural sky, grass, CC0 detail textures and props, temporal accumulation.
// Each of those is a FEATURE in its own file (assets/realism-<key>.ts; the heavy part in a viewer-<x>.ts it imports
// lazily), listed once in TABLE below. This module owns the part they share, so no feature edits viewer.ts:
//
//   - the order and the lifecycle: install (prefetch → install → apply), tick, render, idle, setHq, restore, dispose
//   - isolation: a failed lazy import or a throw anywhere leaves the house as it was built (the feature is dropped)
//   - the tier: 0 = today's page, 1 = cheap effects, 2 = the full set (assets/viewer-quality.ts decides which)
//   - the kill switches: ?no=<key>[,<key>…], ?no=realism for all of them
//
// WHY IT IS LIVE-ONLY. A rendered PRODUCT frame (the goldens, the fixtures, __houseRender*, films, stills) must stay
// a pure function of the tree. Nothing here runs outside ?mode=view; every handle's restore() puts the scene back
// exactly as built before an offline hook runs (viewer.beforeExternalRender), and apply() puts the effect back after.
//
// THE CONTRACT A FEATURE FOLLOWS (the README's "Live realism" section has the long form):
//   install(ctx)  builds what it needs (imports, textures, buffers) and returns a handle. It does NOT touch the scene:
//                 this module calls handle.apply() when it returns (also when it returns late, see BUDGET_MS).
//   apply()/restore() are idempotent and exact inverses: restore() leaves no trace (materials, defines, lights,
//                 children, ShaderChunk text). They may run with the static batch undone or redone around them.
//   dispose()     frees GPU memory; called after restore() when the house goes.
//   Patch materials by clone or by define, never in place without an undo; no Math.random / Date.now / performance.now
//   in anything an offline frame can depend on (the player's clock is ctx.now()).
import type { Tier } from './viewer-quality.js';
import { createLadder, probeDevice, readRenderer, type Probe } from './viewer-quality.js';

export type { Tier };
export type FeatureKey = 'ao' | 'water' | 'sky' | 'grass' | 'assets' | 'frame';
// pre-batch: installed (and applied) before viewer-batch merges the static meshes, for features that change what the
// merge sees (materials, which props exist). post-batch: after it and BEFORE the first compile, so every program
// is compiled once, with the feature's defines already in place.
export type Phase = 'pre-batch' | 'post-batch';

export type RealismCtx = {
  THREE: any; scene: any; renderer: any; camera: any; canvas: HTMLCanvasElement;
  params: URLSearchParams;
  no: Set<string>;
  tier(): Tier;
  houseId(): string;
  house(): any;
  /** window.__houseLighting (preset, sun, sky, lampGain, …), null before the first lighting */
  lighting(): any;
  /** the page's 'house:lighting' event; the returned function stops listening (dispose does it for you) */
  onLighting(cb: (detail: any) => void): () => void;
  /** draw a frame even while paused */
  markDirty(): void;
  /** the player's clock in seconds: the sum of the frame deltas. The only clock a feature may read. */
  now(): number;
  /** undo the static batch, run fn, bake again (the merged meshes are new objects afterwards: sync() follows) */
  withUnbatched<T>(fn: () => T): T;
};

export type RealismHandle = {
  apply(): void;
  restore(): void;
  /** the scene changed under the handle (a rebake made new merged meshes): find your targets again */
  sync?(): void;
  /** before every drawn frame; dtS is clamped to 0.25 s. May call ctx.markDirty() to keep frames coming. */
  tick?(dtS: number, tS: number, camera: any): void;
  /** nothing is changing and the last frame was idleMs ago: return true to have another frame drawn (accumulation) */
  idle?(idleMs: number): boolean;
  /** draw the frame yourself (a composer, an accumulation buffer); return false to leave it to the plain path */
  render?(hq: boolean): boolean;
  /** true while the handle draws panes itself: Best quality then keeps the opaque-pass glass */
  keepsOpaqueGlass?(): boolean;
  /** the tier changed to t (≥ the feature's minTier): lighten or restore yourself */
  setTier?(t: Tier): void;
  setHq?(on: boolean): void;
  dispose(): void;
  stats?(): Record<string, unknown>;
};

export type RealismFeature = {
  key: FeatureKey;
  phase: Phase;
  /** the lowest tier the feature runs at; it is not even installed (or downloaded) below it */
  minTier: Tier;
  /** its apply()/restore() must run with the static batch undone (the module wraps them in withUnbatched) */
  batchSensitive?: boolean;
  /** called as soon as the house id is known (before the build finishes): start downloads here, touch nothing else */
  prefetch?(houseId: string, ctx: RealismCtx): void;
  install(ctx: RealismCtx): Promise<RealismHandle | null>;
};

// One line per feature, in install order. A package edits its own realism-<key>.ts and never this table.
const TABLE: { key: FeatureKey; load: () => Promise<{ default: RealismFeature }> }[] = [
  { key: 'ao', load: () => import('./realism-ao.js') },
  { key: 'water', load: () => import('./realism-water.js') },
  { key: 'sky', load: () => import('./realism-sky.js') },
  { key: 'grass', load: () => import('./realism-grass.js') },
  { key: 'assets', load: () => import('./realism-assets.js') },
  { key: 'frame', load: () => import('./realism-frame.js') },
];

// A feature that has not finished installing when the loader would lift (all phases share this) is not waited for
// any longer: it applies itself, with a redraw, when it is ready.
export const BUDGET_MS = 1500;

export type RealismHost = {
  THREE: any; scene: any; renderer: any; camera: any; canvas: HTMLCanvasElement;
  params: URLSearchParams;
  no: Set<string>;
  houseId(): string;
  house(): any;
  markDirty(): void;
  /** undo the static batch; true when there was one to undo */
  unbatch(): boolean;
  rebatch(): void;
};

type Active = { f: RealismFeature; ctx: RealismCtx; handle: RealismHandle; applied: boolean; unsub: (() => void)[] };

export type Realism = ReturnType<typeof createRealism>;

export function createRealism(host: RealismHost) {
  const { no, params } = host;
  const killed = (k: string): boolean => no.has('realism') || no.has(k);
  // the device probe runs even with every effect off: it is the report's first line (0.1 ms here; its one GPU query is made later)
  const r = host.renderer, ext = r.extensions;
  const probe: Probe = probeDevice({
    gl: r.getContext?.() ?? null,
    maxTexture: r.capabilities?.maxTextureSize,
    floatTargets: ext?.has ? !!(ext.has('EXT_color_buffer_float') || ext.has('EXT_color_buffer_half_float')) : undefined,
  }, params);
  const actives: Active[] = [];
  const failed: { key: string; error: string }[] = [];
  const loaded = new Map<FeatureKey, Promise<RealismFeature | null>>();
  let generation = 0;           // bumped when a house goes: an install still running for the old one disposes itself
  let playerT = 0;              // ctx.now(): the sum of the frame deltas
  let hqOn = false;
  let deadline = 0;             // performance.now() when this house's install budget ends
  const closed: Record<Phase, boolean> = { 'pre-batch': false, 'post-batch': false };

  const moduleCache = new Map<FeatureKey, RealismFeature>();
  const tried = new Set<FeatureKey>();   // install() was run (it returned a handle, null or threw)
  // a feature the tier it stood at was too low for, whose module is fetched and which has not been installed: a promotion to
  // `to` installs it (one that was tried and declined, or failed, is not waiting for anything)
  const pending = (from: Tier, to: Tier): boolean => TABLE.some(e => { const f = moduleCache.get(e.key); return !!f && !killed(f.key) && f.minTier > from && f.minTier <= to && !tried.has(f.key) && !actives.some(a => a.f.key === f.key); });
  const ladder = createLadder({
    probe,
    // a step changes something only if a handle would switch or lighten itself, or a feature waits for the tier
    changes: (from, to) => actives.some(a => !!a.handle.setTier || (a.f.minTier > Math.min(from, to) && a.f.minTier <= Math.max(from, to))) || (to > from && pending(from, to)),
    apply: (to) => onTier(to),
  });

  const makeCtx = (key: FeatureKey): { ctx: RealismCtx; unsub: (() => void)[] } => {
    const unsub: (() => void)[] = [];
    const ctx: RealismCtx = {
      THREE: host.THREE, scene: host.scene, renderer: host.renderer, camera: host.camera, canvas: host.canvas, params, no,
      tier: () => ladder.tier,
      houseId: () => host.houseId(),
      house: () => host.house(),
      lighting: () => (window as any).__houseLighting || null,
      onLighting(cb) {
        const fn = (e: Event) => { try { cb((e as CustomEvent).detail); } catch (err) { fault(key, err); } };
        window.addEventListener('house:lighting', fn);
        const off = () => window.removeEventListener('house:lighting', fn);
        unsub.push(off);
        return off;
      },
      markDirty: () => host.markDirty(),
      now: () => playerT,
      withUnbatched<T>(fn: () => T): T {
        const did = host.unbatch();
        try { return fn(); } finally { if (did) { host.rebatch(); syncAll(); } }
      },
    };
    return { ctx, unsub };
  };

  // ---- loading the feature modules (once; a failed import drops that feature for the session)
  function load(key: FeatureKey): Promise<RealismFeature | null> {
    let p = loaded.get(key);
    if (!p) {
      const entry = TABLE.find(e => e.key === key)!;
      p = entry.load().then(m => { const f = m.default; if (f) moduleCache.set(key, f); return f || null; }, err => { failed.push({ key, error: `import: ${msg(err)}` }); console.warn(`realism: ${key} could not be loaded`, err); return null; });
      loaded.set(key, p);
    }
    return p;
  }
  const msg = (e: unknown): string => String((e as Error)?.message || e);
  const wanted = (f: RealismFeature): boolean => !killed(f.key) && f.minTier <= ladder.tier && !actives.some(a => a.f.key === f.key);

  // a throw anywhere in a feature takes that feature out and leaves the house as built
  function fault(key: string, err: unknown): void {
    failed.push({ key, error: msg(err) });
    console.warn(`realism: ${key} failed and was removed`, err);
    const a = actives.find(x => x.f.key === key);
    if (a) remove(a);
    host.markDirty();
  }
  function guarded(a: Active, fn: () => void): void {
    if (a.f.batchSensitive) { try { a.ctx.withUnbatched(fn); } catch (e) { fault(a.f.key, e); } return; }
    try { fn(); } catch (e) { fault(a.f.key, e); }
  }
  function applyOne(a: Active): void { if (a.applied) return; a.applied = true; guarded(a, () => a.handle.apply()); }
  function restoreOne(a: Active): void { if (!a.applied) return; a.applied = false; guarded(a, () => a.handle.restore()); }
  function remove(a: Active): void {
    const i = actives.indexOf(a);
    if (i >= 0) actives.splice(i, 1);
    try { if (a.applied) { a.applied = false; a.handle.restore(); } } catch { /* already broken */ }
    try { a.handle.dispose(); } catch { /* ditto */ }
    for (const u of a.unsub) { try { u(); } catch { /* ditto */ } }
  }
  function syncAll(): void { for (const a of actives.slice()) if (a.handle.sync) { try { a.handle.sync(); } catch (e) { fault(a.f.key, e); } } }

  // ---- prefetch: as soon as the house id is known (mount, goHouse). Downloads only; nothing is touched.
  function prefetch(houseId: string): void {
    for (const e of TABLE) {
      if (killed(e.key)) continue;
      load(e.key).then(f => {
        if (!f || f.minTier > ladder.ceiling || !f.prefetch) return;
        try { f.prefetch(houseId, makeCtx(f.key).ctx); } catch (err) { console.warn(`realism: ${f.key} prefetch failed`, err); }
      });
    }
  }

  // ---- install one phase of this house's features
  async function install(phase: Phase): Promise<void> {
    if (phase === 'pre-batch') {
      closed['pre-batch'] = closed['post-batch'] = false; deadline = performance.now() + BUDGET_MS;
      // the renderer string (the one probe query that asks the GPU) is read here, once the house is built, not at mount
      if (!probe.renderer) { readRenderer(probe, host.renderer.getContext?.() ?? null); ladder.restart(); }
    }
    const gen = generation;
    const jobs: Promise<void>[] = [];
    for (const e of TABLE) {
      if (killed(e.key)) continue;
      jobs.push(load(e.key).then(f => {
        if (!f || f.phase !== phase || !wanted(f)) return;
        return startOne(f, gen);
      }));
    }
    let timer = 0;
    const budget = new Promise<void>(r => { timer = window.setTimeout(r, Math.max(0, deadline - performance.now())); });
    await Promise.race([Promise.allSettled(jobs), budget]);
    window.clearTimeout(timer);
    closed[phase] = true;
  }
  async function startOne(f: RealismFeature, gen: number, forceLate = false): Promise<void> {
    if (actives.some(a => a.f.key === f.key)) return;
    tried.add(f.key);
    const { ctx, unsub } = makeCtx(f.key);
    let handle: RealismHandle | null = null;
    try { handle = await f.install(ctx); } catch (err) { failed.push({ key: f.key, error: msg(err) }); console.warn(`realism: ${f.key} install failed`, err); for (const u of unsub) u(); return; }
    if (!handle) { for (const u of unsub) u(); return; }
    if (gen !== generation || actives.some(a => a.f.key === f.key)) { try { handle.dispose(); } catch { /* gone anyway */ } for (const u of unsub) u(); return; }
    const a: Active = { f, ctx, handle, applied: false, unsub };
    // keep table order (the draw order of render()/idle() follows it)
    const order = (k: string): number => TABLE.findIndex(e => e.key === k);
    let at = actives.length;
    while (at > 0 && order(actives[at - 1].f.key) > order(f.key)) at--;
    actives.splice(at, 0, a);
    const late = forceLate || closed[f.phase];
    if (ladder.tier >= f.minTier) {
      // late: the loader has lifted and (for a pre-batch feature) the batch has been baked. Apply anyway, around the batch.
      if (late && f.phase === 'pre-batch') { try { ctx.withUnbatched(() => applyOne(a)); } catch (e) { fault(f.key, e); } }
      else applyOne(a);
      if (late) host.markDirty();
    }
  }

  // ---- the tier moved (a step of the ladder, or the first one): switch features on, off, lighter
  function onTier(to: Tier): void {
    for (const a of actives.slice()) {
      if (to < a.f.minTier) restoreOne(a);
      else { applyOne(a); if (a.handle.setTier) { try { a.handle.setTier(to); } catch (e) { fault(a.f.key, e); } } }
    }
    // a feature the start tier was too low for is installed now (its module is already fetched; its own assets are lazy)
    const gen = generation;
    for (const e of TABLE) {
      const f = moduleCache.get(e.key);
      if (f && wanted(f) && !tried.has(f.key)) void startOne(f, gen, true);
    }
    host.markDirty();
  }

  // ---- per frame
  function tick(dtS: number, camera: any): void {
    playerT += dtS;
    for (const a of actives.slice()) if (a.applied && a.handle.tick) { try { a.handle.tick(dtS, playerT, camera); } catch (e) { fault(a.f.key, e); } }
  }
  function render(hq: boolean): boolean {
    for (const a of actives.slice()) if (a.applied && a.handle.render) { try { if (a.handle.render(hq)) return true; } catch (e) { fault(a.f.key, e); return false; } }
    return false;
  }
  function idle(ms: number): boolean {
    let again = false;
    for (const a of actives) if (a.applied && a.handle.idle) { try { again = a.handle.idle(ms) || again; } catch (e) { fault(a.f.key, e); } }
    return again;
  }
  function setHq(on: boolean): void {
    hqOn = on;
    for (const a of actives.slice()) if (a.handle.setHq) { try { a.handle.setHq(on); } catch (e) { fault(a.f.key, e); } }
  }
  const keepsOpaqueGlass = (): boolean => actives.some(a => a.applied && a.handle.keepsOpaqueGlass?.());

  // ---- the page's offline hooks (and the harness): everything off, exactly as built; then back
  function restore(): void {
    if (actives.some(a => a.f.batchSensitive)) host.unbatch();
    for (const a of actives.slice().reverse()) {
      if (!a.applied) continue;
      a.applied = false;
      try { a.handle.restore(); } catch (e) { fault(a.f.key, e); }
    }
  }
  function reapply(): void {
    if (hqOn) return;   // Best quality draws through the recorder's composer: the effects stay off until it is left
    // pre-batch features first, while the scene is unbatched, then the batch, then the rest
    const sensitive = actives.some(a => a.f.batchSensitive && !a.applied);
    if (sensitive) host.unbatch();
    for (const a of actives.slice()) if (a.f.phase === 'pre-batch') applyOne(a);
    if (sensitive) host.rebatch();
    for (const a of actives.slice()) if (a.f.phase !== 'pre-batch') applyOne(a);
    syncAll();
    host.markDirty();
  }

  // ---- a house goes (goHouse, before the scene is cleared)
  function dispose(): void {
    generation++;
    tried.clear();
    for (const a of actives.slice().reverse()) remove(a);
    closed['pre-batch'] = closed['post-batch'] = false;
  }

  const report = {
    get tier(): Tier { return ladder.tier; },
    get probe(): Probe { return probe; },
    get ladder() { return ladder.stats(); },
    get installed(): string[] { return actives.map(a => a.f.key); },
    get failed() { return failed.slice(); },
    get features(): Record<string, unknown> {
      const out: Record<string, unknown> = {};
      for (const a of actives) { try { out[a.f.key] = { applied: a.applied, ...(a.handle.stats?.() || {}) }; } catch { out[a.f.key] = { applied: a.applied }; } }
      return out;
    },
  };

  return {
    get tier(): Tier { return ladder.tier; },
    get active(): boolean { return actives.length > 0; },
    prefetch, install, dispose, tick, render, idle, setHq, keepsOpaqueGlass, restore, reapply, report,
    /** the adaptive controller (viewer.ts ADAPT): a miss window sheds a rung before the pixel ratio is touched */
    shed: (fps: number): boolean => ladder.shed(fps),
    /** …and a long run at full speed tries the rung above */
    promote: (): boolean => ladder.promote(),
  };
}
