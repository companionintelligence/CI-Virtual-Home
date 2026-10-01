// Live-player realism: instanced grass, a living lawn and shaded, wind-moved tree crowns.
//
// The thin eager entry (the registry in assets/realism.ts loads this file for every home). It decides whether this home
// has a ground lawn, and only then loads the heavy parts: assets/viewer-bake.ts (one top-down look at the ground, kept as a
// small texture) and assets/viewer-grass.ts (the field, the lawn patch, the crown shading). Post-batch: the lawn is patched
// where the batch left it (the stand-in material of whatever merged), and nothing here calls rebatch.
//
// Tiers: 1 = mid grass (reach 4.5 m of blades, 12 m of tufts), the lawn upgrade and the crown shading; 2 = the high grass
// (7 m and 18 m); 0 = none of it (this module is not even installed). ?no=grass kills all of it, ?no=foliage only the crowns,
// ?no=lawn only the lawn patch, ?gstyle=fine|soft picks the blade look (the default is judged in README → Live realism → grass).
import type { RealismFeature, RealismHandle, RealismCtx } from './realism.js';

const feature: RealismFeature = {
  key: 'grass',
  phase: 'post-batch',
  minTier: 1,
  async install(ctx: RealismCtx): Promise<RealismHandle | null> {
    const [{ bakeSite, findGroundLawn }, G] = await Promise.all([import('./viewer-bake.js'), import('./viewer-grass.js')]);
    const { THREE, scene, renderer } = ctx;
    const ground = findGroundLawn(THREE, scene);
    if (!ground) return null;                         // sand, gravel, desert, urban: no grass here
    const lot = (ctx.house() && ctx.house().spec && ctx.house().spec.lot) || {};
    const variant = G.VARIANTS[lot.ground === 'meadow' ? 'meadow' : 'mown'];
    const style = (ctx.params.get('gstyle') === 'soft' ? 'soft' : ctx.params.get('gstyle') === 'fine' ? 'fine' : G.DEFAULT_STYLE) as 'fine' | 'soft';
    const seed = G.seedOf(ctx.houseId());
    const mean = G.meanAlbedo(THREE, (() => { for (const m of ground.meshes) { const mm = Array.isArray(m.material) ? m.material : [m.material]; const l = mm.find((x: any) => x && x.userData && x.userData.surface === 'lawn'); if (l) return l; } return null; })());
    const bake = bakeSite(THREE, renderer, scene, { maxSide: 1024 });
    if (!bake) return null;
    const h = hashDir(seed);
    let tune: Record<string, number> | undefined; try { const q = ctx.params.get('gtune'); if (q) tune = JSON.parse(q); } catch { /* ignore a bad tune */ }
    const field = ctx.no.has('grassblades') ? null : G.createField({ THREE, scene, renderer, bake, seed, variant, style, tune, mean, windDir: h }, ctx.tier() >= 2 ? 2 : 1);

    const tierNow = () => (ctx.tier() >= 2 ? 2 : 1) as 1 | 2;
    const T = G.TIERS[tierNow()];
    const lawn = ctx.no.has('lawn') ? null : G.createLawnPatch({ THREE, scene, bake, r0: T.r0, r1: T.r1 });
    const fol = ctx.no.has('foliage') ? null : G.createFoliage({ THREE, scene, windDir: h });
    let applied = false, markT = 0;
    const look = () => {
      const L = ctx.lighting();
      const preset = (L && L.preset) || 'day';
      // dusk and night lift the lawn and the blades together so neither collapses to black (also tinted with the preset)
      const lift = preset === 'night' ? 0.085 : preset === 'dusk' ? 0.035 : preset === 'golden' ? 0.006 : 0;
      const trans = preset === 'golden' ? 1.6 : preset === 'dusk' ? 0.9 : preset === 'night' ? 0.15 : 0.8;
      field && field.setLook({ lift, trans });
      lawn && lawn.setLook({ lift: lift * 0.9 });
      fol && fol.setLook({ trans: preset === 'night' ? 0.2 : preset === 'dusk' ? 0.7 : preset === 'golden' ? 1.4 : 0.8 });
    };
    const off = ctx.onLighting(() => { look(); ctx.markDirty(); });
    look();

    return {
      apply() {
        if (applied) return; applied = true;
        if (field) scene.add(field.group);
        if (lawn) lawn.apply();
        if (fol) fol.apply();
        look();
      },
      restore() {
        if (!applied) return; applied = false;
        if (field) scene.remove(field.group);
        if (lawn) lawn.restore();
        if (fol) fol.restore();
      },
      sync() { if (applied) { lawn && lawn.sync(); fol && fol.sync(); } },
      tick(_dt, tS, camera) {
        if (!applied) return;
        fol && fol.update(tS);
        if (!field) return;
        const vis = field.update(camera, tS, renderer.domElement.height || ctx.canvas.height || 700);
        // the wind moves while the grass is on screen: ask for a frame ~20 times a second even when nothing else changes
        if (vis && tS - markT > 0.05) { markT = tS; ctx.markDirty(); }
      },
      setTier(t) { if (field) field.setTier(t >= 2 ? 2 : 1); },
      dispose() { off(); if (field) field.dispose(); if (lawn) lawn.dispose(); if (fol) fol.dispose(); bake.dispose(); },
      stats: () => ({ bake: bake.stats, size: bake.size, ppm: +bake.ppm.toFixed(1), field: field ? field.stats() : null, lawn: lawn ? lawn.stats() : null, foliage: fol ? fol.stats() : null, readMask: () => bake.read(), rect: bake.rect }),
    };
  },
};

// the wind blows along a direction the house's seed picks (a fixed unit vector; nothing the offline frames read)
function hashDir(seed: number): [number, number] {
  const a = ((seed >>> 8) & 0xffff) / 0xffff * Math.PI * 2;
  return [Math.cos(a), Math.sin(a)];
}
export default feature;
