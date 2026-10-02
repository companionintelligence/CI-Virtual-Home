// Live realism feature "ao": a baked ambient-occlusion volume for every lit material (viewer-ao.ts) and a soft contact
// shadow under each piece of furniture and plant (viewer-contact.ts). Tier 1 and up (the registry's tier 0 is today's page): the volume is one 3D texture
// tap per lit fragment (measured 0.99 to 1.01 of the frame time), the decals are one to three draw calls.
//
// Installed after the batch (phase 'post-batch'), because it reads the batched scene's triangles for the stale check and
// puts the decals in after the static meshes were merged. Its data (content/ao/manifest.json and the house's volume) is
// fetched from `prefetch`, as the player learns which house it is opening, so it travels while the house builds; install
// waits for it at most WAIT_MS, and a house without a volume (or with a stale one, or on a failed download) is simply
// drawn as it was. ?no=ao switches the whole feature off (both halves), ?no=contact only the decals.
import type { RealismCtx, RealismFeature, RealismHandle } from './realism.js';
import type { Box } from './viewer-ao.js';

const WAIT_MS = 1200;
const MANIFEST_URL = './content/ao/manifest.json';

type Entry = { file: string; bytes: number; fp: any };
type Loaded = { entry: Entry; buf: ArrayBuffer };
const pending = new Map<string, Promise<Loaded | null>>();

async function load(houseId: string): Promise<Loaded | null> {
  try {
    const mr = await fetch(MANIFEST_URL);
    if (!mr.ok) return null;
    const manifest = await mr.json();
    const entry: Entry | undefined = manifest && manifest.houses && manifest.houses[houseId];
    if (!entry) return null;
    const vr = await fetch(`./content/ao/${entry.file}`);
    if (!vr.ok) return null;
    return { entry, buf: await vr.arrayBuffer() };
  } catch { return null; }
}

/** Resolve to `p`, or to null after `ms`: a slow download never holds the first frame longer than that. */
const within = <T>(p: Promise<T>, ms: number): Promise<T | null> => new Promise(res => { const t = setTimeout(() => res(null), ms); p.then(v => { clearTimeout(t); res(v); }, () => { clearTimeout(t); res(null); }); });

const aoFeature: RealismFeature = {
  key: 'ao',
  phase: 'post-batch',
  minTier: 1,
  prefetch(houseId: string, ctx: RealismCtx) {
    // the exporter (scripts/bake-ao.mts) loads no volume: it is what makes them
    if (ctx.params.has('aoexport') || pending.has(houseId)) return;
    pending.set(houseId, load(houseId));
  },
  async install(ctx: RealismCtx): Promise<RealismHandle | null> {
    const { THREE, scene } = ctx;
    const V = await import('./viewer-ao.js');
    const house = ctx.house();
    if (ctx.params.has('aoexport')) {
      // the bake's input: the occluding triangles of this very scene (the one the volume will be drawn on) and the box to bake
      // (triangles whose box reaches the volume's box grown by the ray radius: the bake's rays can hit those)
      const box = V.volumeBox(house), reach: Box = { min: box.min.map(v => v - V.RADIUS) as any, max: box.max.map(v => v + V.RADIUS) as any };
      const tris: number[] = [];
      V.walkOccluders(THREE, scene, reach, (ax, ay, az, bx, by, bz, cx, cy, cz) => {
        if (Math.max(ax, bx, cx) < reach.min[0] || Math.min(ax, bx, cx) > reach.max[0] || Math.max(ay, by, cy) < reach.min[1] || Math.min(ay, by, cy) > reach.max[1] || Math.max(az, bz, cz) < reach.min[2] || Math.min(az, bz, cz) > reach.max[2]) return;
        tris.push(ax, ay, az, bx, by, bz, cx, cy, cz);
      });
      (window as any).__vhAoExport = { id: house.id, tris: new Float32Array(tris), box, fp: V.fingerprint(THREE, scene, box) };
      return null;
    }

    type Part = Omit<RealismHandle, 'tick'> & { tick?: (dt: number, t: number, cam: any) => void | boolean };
    const handles: Part[] = [];
    const stats: Record<string, any> = {};

    // ---- the volume
    const shared = V.installShaders(THREE);
    if (shared) {
      const t0 = ctx.now();
      if (!pending.has(house.id)) pending.set(house.id, load(house.id));
      const got = await within(pending.get(house.id)!, WAIT_MS);
      if (!got) stats.volume = 'none';
      else {
        try {
          const vol = V.parseVolume(got.buf);
          const fp = V.fingerprint(THREE, scene, V.volumeBox(house));
          if (!V.sameFingerprint(got.entry.fp, fp)) { stats.volume = 'stale'; console.info(`ao: ${house.id}'s volume was baked from other geometry (${got.entry.fp.n} triangles, now ${fp.n}); drawn without it. Run: pnpm run ao --house ${house.id}`); }
          else {
            // (?aok=<exponent> is a tuning knob for looking at stills; the shipped strength is V.DEFAULTS)
            const aok = Number(ctx.params.get('aok')), aos = Number(ctx.params.get('aos')), ao = V.createAo(THREE, scene, shared, vol, { ...V.DEFAULTS, ...(aok > 0 ? { strength: aok } : {}), ...(aos > 0 ? { slack: aos } : {}) });
            handles.push({ apply: () => ao.apply(), restore: () => ao.restore(), setHq: v => ao.setHq(v), dispose: () => ao.dispose() });
            stats.volume = 'on'; stats.ao = ao.stats(); stats.aoStats = ao.stats;
          }
        } catch (err) { stats.volume = 'error'; console.warn('ao: the volume could not be used', err); }
      }
      stats.volumeMs = Math.round((ctx.now() - t0) * 10) / 10;
    } else stats.volume = 'unsupported';

    // ---- the contact shadows
    if (ctx.tier() >= 1 && !ctx.no.has('contact')) {
      try {
        const C = await import('./viewer-contact.js');
        const c = C.createContact(THREE, scene, ctx.house());
        if (c) { handles.push({ apply: () => c.apply(), restore: () => c.restore(), tick: () => c.tick(), dispose: () => c.dispose() }); stats.contact = c.stats(); }
      } catch (err) { console.warn('ao: the contact shadows could not be made', err); }
    }

    if (!handles.length) return null;
    return {
      apply() { for (const h of handles) h.apply(); ctx.markDirty(); },
      sync() { for (const h of handles) h.sync?.(); },
      restore() { for (const h of handles) h.restore(); },
      setHq(on: boolean) { for (const h of handles) h.setHq?.(on); ctx.markDirty(); },
      tick(dt: number, t: number, cam: any) { let d = false; for (const h of handles) if (h.tick?.(dt, t, cam) === true) d = true; if (d) ctx.markDirty(); },
      dispose() { for (const h of handles) h.dispose(); handles.length = 0; },
      stats() { return { ...stats, ao: stats.aoStats ? stats.aoStats() : undefined, aoStats: undefined }; },
    };
  },
};
export default aoFeature;
