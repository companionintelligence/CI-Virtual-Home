// assets/xr/bake.ts : SEED STUB (a no-op). Package xr-bake REPLACES this file. apply() reports zeros so xr-session runs end to end without it.
import type { XrBake, BakeReport, XrHost } from './host.js';
export function createBake(_host: XrHost): XrBake {
  let last: BakeReport | null = null;
  return {
    async apply() { last = { ms: 0, calls: 0, tris: 0, perEyeDraws: 0, programs: 0, textureMB: 0, cells: 0, hiddenMeshes: 0, mergedMeshes: 0, lightsKept: 0, overBudget: null }; return last; },
    refocus() {}, restore() { last = null; }, shadowNeedsUpdate() {}, report: () => last,
  };
}
