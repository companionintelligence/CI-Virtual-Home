// TEMPORARY SCAFFOLD (package ao-contact). realism-core owns this file; this is the smallest thing that implements
// the agreed interface so the ao package can be built and tested before core's scaffold commit exists. The assembler
// drops the commit that adds it ("scaffold: temporary realism registry ...") and merges core's real one; the ao
// package only relies on the types and the registry shape below, which are the plan's, word for word.
//
// Live realism features for the portal's player: each one is installed only in view mode, after the house is built;
// restored before any __houseRender* call (a film or still is a product frame); killed by ?no=<key>; and a throw
// leaves the house as built.
import { aoFeature } from './realism-ao.js';

export type Tier = 0 | 1 | 2;

export type RealismCtx = {
  THREE: any; scene: any; renderer: any; camera: any; canvas: HTMLCanvasElement;
  params: URLSearchParams; no: Set<string>;
  tier(): Tier; houseId(): string; house(): any; lighting(): string;
  onLighting(cb: (name: string) => void): void;
  markDirty(): void; now(): number;
  withUnbatched<T>(fn: () => T): T;
};

export type RealismHandle = {
  apply(): void; restore(): void; sync?(): void;
  tick?(dtS: number, tS: number, camera: any): void | boolean;   // (scaffold: a true return marks the frame dirty)
  idle?(idleMs: number): boolean;
  render?(hq: boolean): boolean;
  keepsOpaqueGlass?(): boolean;
  setTier?(t: Tier): void; setHq?(on: boolean): void;
  dispose(): void; stats?(): any;
};

export type RealismFeature = {
  key: 'ao' | 'water' | 'sky' | 'grass' | 'assets' | 'frame';
  phase: 'pre-batch' | 'post-batch';
  minTier: Tier;
  batchSensitive?: boolean;
  prefetch?(houseId: string, ctx: RealismCtx): void;
  install(ctx: RealismCtx): Promise<RealismHandle | null>;
};

// the registry: one line per feature, listed once
const FEATURES: RealismFeature[] = [aoFeature];

export type RealismHost = {
  THREE: any; scene: any; renderer: any; camera: any; canvas: HTMLCanvasElement; params: URLSearchParams; no: Set<string>;
  houseId(): string; house(): any; lighting(): string; markDirty(): void; coarse: boolean;
  withUnbatched<T>(fn: () => T): T;
};

export function createRealism(host: RealismHost) {
  const lightingCbs: ((n: string) => void)[] = [];
  const tierParam = host.params.get('tier');
  const tier = (): Tier => (tierParam === '0' || tierParam === '1' || tierParam === '2' ? (Number(tierParam) as Tier) : host.coarse ? 0 : 1);
  const ctx: RealismCtx = {
    THREE: host.THREE, scene: host.scene, renderer: host.renderer, camera: host.camera, canvas: host.canvas, params: host.params, no: host.no,
    tier, houseId: host.houseId, house: host.house, lighting: host.lighting, onLighting: cb => { lightingCbs.push(cb); },
    markDirty: host.markDirty, now: () => performance.now(), withUnbatched: host.withUnbatched,
  };
  let handles: { f: RealismFeature; h: RealismHandle }[] = [];
  let on = true, hq = false;
  const warn = (f: RealismFeature, what: string, err: unknown) => console.warn(`realism: ${f.key} ${what}`, err);

  return {
    /** start the features' downloads (the house id is known before its build is) */
    prefetch(houseId: string) {
      for (const f of FEATURES) { if (host.no.has(f.key) || tier() < f.minTier) continue; try { f.prefetch?.(houseId, ctx); } catch (e) { warn(f, 'prefetch failed', e); } }
    },
    /** a new house is on screen: drop the last house's handles; install the features of this phase */
    async install(phase: 'pre-batch' | 'post-batch') {
      if (phase === 'pre-batch') { for (const x of handles) { try { x.h.dispose(); } catch (e) { warn(x.f, 'dispose failed', e); } } handles = []; }
      for (const f of FEATURES) {
        if (f.phase !== phase || host.no.has(f.key) || tier() < f.minTier) continue;
        try {
          const h = await f.install(ctx);
          if (!h) continue;
          handles.push({ f, h });
          h.setHq?.(hq);
          if (on) h.apply();
        } catch (e) { warn(f, 'install failed; the house is left as built', e); }
      }
    },
    /** before a film or still (a product frame) */
    restore() { on = false; for (const x of handles) { try { x.h.restore(); } catch (e) { warn(x.f, 'restore failed', e); } } },
    reapply() { on = true; for (const x of handles) { try { x.h.apply(); } catch (e) { warn(x.f, 'apply failed', e); } } },
    setHq(v: boolean) { hq = v; for (const x of handles) { try { x.h.setHq?.(v); } catch (e) { warn(x.f, 'setHq failed', e); } } },
    onLighting(name: string) { for (const cb of lightingCbs) cb(name); for (const x of handles) { try { x.h.sync?.(); } catch (e) { warn(x.f, 'sync failed', e); } } },
    /** once per frame; true when a feature changed what is drawn */
    tick(dtS: number): boolean { let d = false; if (!on) return d; for (const x of handles) { try { if (x.h.tick?.(dtS, 0, host.camera) === true) d = true; } catch (e) { warn(x.f, 'tick failed', e); } } return d; },
    stats() { const o: Record<string, any> = {}; for (const x of handles) { try { o[x.f.key] = x.h.stats?.() ?? true; } catch { o[x.f.key] = 'error'; } } return o; },
    get ctx() { return ctx; },
  };
}
export type Realism = ReturnType<typeof createRealism>;
