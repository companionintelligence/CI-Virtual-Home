// The plant recipes (PLAN 5.3 T5 + T9): one function per registry plant type, built on softplant.ts. plants.ts registers each type (footprint, height, params, tags,
// iso) and calls `recipes[type]` for its geometry. A recipe: pot colour (the old draw), a private stream (the one new draw), a pot form, the plant, `fit` to the old box.
import { plantKit, potColor, sizeOf, boxAt, GREENS, TERRACOTTA, BARK, STEM_BROWN, splitRng, clamp, smooth, type PlantSpec, type BoxRow } from './softplant.js';

/** the baseline boxes by type and `h` (test/review/baselines/prop-boxes.json, the 12-seed union; [h, x0, z0, x1, z1, top, bottom]) */
export const BOXES: Record<string, BoxRow[]> = {
  'bird-of-paradise': [["def", -0.574, -0.568, 0.605, 0.565, 1.74, 0], [1.31, -0.364, -0.407, 0.371, 0.324, 1.31, 0], [1.74, -0.526, -0.582, 0.52, 0.449, 1.738, 0], [2.35, -0.755, -0.83, 0.732, 0.641, 2.346, 0]],
  'rubber-plant': [["def", -0.241, -0.234, 0.245, 0.263, 1.588, 0], [1.19, -0.238, -0.231, 0.234, 0.263, 1.278, 0], [1.59, -0.238, -0.231, 0.234, 0.263, 1.678, 0], [2.14, -0.238, -0.231, 0.234, 0.263, 2.228, 0]],
  'zz-plant': [["def", -0.339, -0.347, 0.345, 0.354, 0.851, 0], [0.64, -0.213, -0.237, 0.235, 0.228, 0.633, 0], [0.85, -0.29, -0.338, 0.337, 0.326, 0.823, 0], [1.15, -0.407, -0.482, 0.482, 0.465, 1.093, 0]],
  'peace-lily': [["def", -0.465, -0.447, 0.411, 0.474, 1.111, 0], [0.83, -0.418, -0.443, 0.406, 0.445, 1.031, 0], [1.11, -0.467, -0.511, 0.474, 0.521, 1.262, 0], [1.5, -0.584, -0.611, 0.569, 0.627, 1.591, 0]],
  'indoor-palm': [["def", -0.844, -0.862, 0.842, 0.86, 1.942, 0], [1.46, -0.571, -0.624, 0.598, 0.588, 1.462, 0], [1.94, -0.81, -0.884, 0.839, 0.828, 1.941, 0], [2.62, -1.15, -1.252, 1.18, 1.168, 2.621, 0]],
  'ficus-tree': [["def", -0.582, -0.551, 0.573, 0.551, 1.79, 0], [1.34, -0.359, -0.357, 0.366, 0.357, 1.333, 0], [1.79, -0.542, -0.54, 0.552, 0.539, 1.78, 0], [2.42, -0.799, -0.796, 0.814, 0.795, 2.405, 0]],
  'olive-tree-pot': [["def", -0.493, -0.446, 0.522, 0.424, 1.568, 0], [1.18, -0.424, -0.424, 0.424, 0.424, 1.16, 0], [1.57, -0.48, -0.435, 0.481, 0.424, 1.539, 0], [2.12, -0.714, -0.646, 0.715, 0.57, 2.074, 0]],
  'snake-plant': [["def", -0.195, -0.182, 0.197, 0.184, 0.879, 0], [0.66, -0.14, -0.14, 0.161, 0.144, 0.639, 0], [0.88, -0.162, -0.144, 0.194, 0.181, 0.859, 0], [1.19, -0.215, -0.175, 0.241, 0.233, 1.167, 0]],
  'dracaena': [["def", -0.445, -0.425, 0.474, 0.495, 1.852, 0], [1.39, -0.374, -0.425, 0.449, 0.43, 1.442, 0], [1.85, -0.374, -0.425, 0.449, 0.43, 1.902, 0], [2.5, -0.374, -0.425, 0.449, 0.43, 2.552, 0]],
  'calathea': [["def", -0.367, -0.295, 0.375, 0.322, 0.809, 0], [0.61, -0.348, -0.272, 0.356, 0.285, 0.746, 0], [0.81, -0.387, -0.311, 0.397, 0.311, 0.886, 0], [1.09, -0.441, -0.367, 0.455, 0.368, 1.082, 0]],
  'ponytail-palm': [["def", -0.452, -0.436, 0.42, 0.454, 1.003, 0], [0.75, -0.17, -0.17, 0.17, 0.17, 0.694, 0], [1.0, -0.325, -0.315, 0.304, 0.315, 0.844, 0], [1.35, -0.531, -0.514, 0.496, 0.515, 1.107, 0]],
  'aloe-pot': [["def", -0.213, -0.161, 0.207, 0.205, 0.365, 0]],
  'jade-plant': [["def", -0.185, -0.194, 0.173, 0.179, 0.379, 0]],
  'fern': [["def", -0.321, -0.327, 0.319, 0.332, 0.385, 0]],
  'orchid': [["def", -0.264, -0.261, 0.261, 0.264, 0.547, 0]],
  'herb-pots': [["def", -0.21, -0.083, 0.222, 0.092, 0.244, 0]],
  'succulent-tray': [["def", -0.184, -0.108, 0.18, 0.1, 0.121, 0]],
  'trailing-ivy': [["def", -0.215, -0.295, 0.256, 0.23, 0.246, 0]],
  'hanging-plant': [["def", -0.292, -0.279, 0.278, 0.292, 2.1, 1.221]],
  'pampas-vase': [["def", -0.159, -0.165, 0.169, 0.166, 1.179, 0], [0.88, -0.106, -0.116, 0.126, 0.114, 0.871, 0], [1.18, -0.142, -0.155, 0.169, 0.153, 1.168, 0], [1.59, -0.191, -0.209, 0.228, 0.206, 1.574, 0]],
};

// (vase and flower-jug were not foliage and their MEASURED box is one default-seed build, tighter than the 12-seed union: the composer lays rooms out with MEASURED, and
// compose-parity judges a built arrangement against it, so these two clamp to MEASURED in x and z, and to the union's top at each h)
BOXES['vase'] = [["def", -0.078, -0.077, 0.081, 0.062, 0.569, 0], [0.43, -0.078, -0.077, 0.081, 0.062, 0.729, 0], [0.57, -0.078, -0.077, 0.081, 0.062, 0.869, 0], [0.77, -0.078, -0.077, 0.081, 0.062, 1.069, 0]];
BOXES['flower-jug'] = [["def", -0.089, -0.09, 0.143, 0.09, 0.465, 0], [0.35, -0.089, -0.09, 0.143, 0.09, 0.465, 0], [0.47, -0.089, -0.09, 0.143, 0.09, 0.465, 0], [0.63, -0.089, -0.09, 0.143, 0.09, 0.465, 0]];

export const SPEC: Record<string, PlantSpec> = {
  'bird-of-paradise': { H0: 1.7, pot: [0.22, 0.18, 0.4], rows: BOXES['bird-of-paradise'] },
  'rubber-plant': { H0: 1.5, pot: [0.17, 0.14, 0.34], rows: BOXES['rubber-plant'] },
  'zz-plant': { H0: 0.85, pot: [0.15, 0.13, 0.26], rows: BOXES['zz-plant'] },
  'peace-lily': { H0: 0.85, pot: [0.15, 0.12, 0.24], rows: BOXES['peace-lily'] },
  'indoor-palm': { H0: 1.9, pot: [0.21, 0.17, 0.42], rows: BOXES['indoor-palm'] },
  'ficus-tree': { H0: 1.8, pot: [0.23, 0.18, 0.46], rows: BOXES['ficus-tree'] },
  'olive-tree-pot': { H0: 1.6, pot: [0.3, 0.25, 0.44], rows: BOXES['olive-tree-pot'] },
  'snake-plant': { H0: 0.9, pot: [0.14, 0.11, 0.28], rows: BOXES['snake-plant'] },
  'dracaena': { H0: 1.8, pot: [0.18, 0.15, 0.38], rows: BOXES['dracaena'] },
  'calathea': { H0: 0.7, pot: [0.16, 0.13, 0.25], rows: BOXES['calathea'] },
  'ponytail-palm': { H0: 1.2, pot: [0.17, 0.14, 0.26], rows: BOXES['ponytail-palm'] },
  'aloe-pot': { H0: 0.4, pot: [0.1, 0.075, 0.13], rows: BOXES['aloe-pot'] },
  'jade-plant': { H0: 0.42, pot: [0.1, 0.08, 0.12], rows: BOXES['jade-plant'] },
  'fern': { H0: 0.36, pot: [0.09, 0.07, 0.14], rows: BOXES['fern'] },
  'orchid': { H0: 0.55, pot: [0.075, 0.06, 0.13], rows: BOXES['orchid'] },
};

type Recipe = (it: any, ctx: any) => any;

/** the shared opening of every recipe: size, pot colour (the old draw), the private stream, the pot form and the pot itself */
function begin(type: string, it: any, ctx: any, name: string, potOpts: { seg?: number; kind?: string } = {}) {
  const P = plantKit(ctx), sp = SPEC[type], { H, s } = sizeOf(sp, it), g = ctx.group(name);
  const potCol = potColor(it, ctx.colors, ctx.rng, ctx.hex), r = splitRng(ctx.rng);
  const kind = potOpts.kind || P.POTS[Math.floor(r() * 3)];
  const potA = new P.K.Acc(), leafA = new P.K.Acc(), caneA = new P.K.Acc(), bloomA = new P.K.Acc();
  const rim = P.pot(potA, kind, sp.pot[0], sp.pot[1], sp.pot[2], potOpts.seg ?? 16);
  const ls = 0.7 + 0.3 * s, green = (a = 0, b = GREENS.length - 1) => GREENS[a + Math.floor(r() * (b - a + 1))];
  const done = (leafCol: number, o: any = {}) => {
    P.fit([leafA, caneA, bloomA], boxAt(sp.rows, it.h), rim);
    return P.finish(g, { pot: potA, potCol, leaf: leafA, leafCol, cane: caneA, bloom: bloomA, ...o });
  };
  return { P, K: P.K, sp, H, s, g, r, rim, potA, leafA, caneA, bloomA, ls, green, done, jit: (a: number) => P.jit(r, a) };
}

const oblong = (u: number) => Math.pow(Math.sin(Math.PI * Math.pow(u, 0.78)), 0.75);
const ovate = (u: number) => Math.sin(Math.PI * Math.pow(u, 0.62));
const cordate = (u: number) => Math.pow(Math.sin(Math.PI * Math.pow(u, 0.5)), 0.85);
const strap = (u: number) => (u < 0.8 ? 0.55 + 0.45 * Math.min(1, u * 6) : Math.max(0.05, (1 - u) / 0.2) * 1.0);
const lance = (u: number) => Math.sin(Math.PI * Math.pow(u, 0.7)) * (1 - 0.25 * u);

export const recipes: Record<string, Recipe> = {
  // ---- F1 paddle on stalk -------------------------------------------------------------------------------------------------------------------------
  'bird-of-paradise'(it, ctx) {
    const B = begin('bird-of-paradise', it, ctx, 'Bird of Paradise'), { P, r, rim, s, leafA, caneA } = B;
    const n = 11 + Math.floor(r() * 3), col = B.green(0, 2);
    for (let i = 0; i < n; i++) {
      const a = i * 2.399 + B.jit(0.25), t = 0.1 + r() * 0.3, Ls = (0.42 + 0.34 * r()) * s;
      const tip = [Math.sin(a) * Math.sin(t) * Ls, rim + Math.cos(t) * Ls, Math.cos(a) * Math.sin(t) * Ls];
      P.stalk(leafA, [0, rim - 0.01, 0], tip, 0.012, 0.007, 0.5, 0.7);
      P.leaf(leafA, { x: tip[0], y: tip[1] - 0.02, z: tip[2], a, t: t + 0.25, L: (0.5 + 0.2 * r()) * (0.7 + 0.3 * s), W: 0.23 * B.ls, droop: 0.55 + 0.3 * r(), fold: 0.12, rows: 5, profile: oblong, baseS: 0.5 + 0.12 * r() });
    }
    return B.done(col);
  },
  // ---- F2 broad leaf on a cane ----------------------------------------------------------------------------------------------------------------------
  'rubber-plant'(it, ctx) {
    const B = begin('rubber-plant', it, ctx, 'Rubber Plant'), { P, K, r, rim, H, leafA, caneA } = B;
    const top = H - 0.08, n = 14, burgundy = r() < 0.2, col = burgundy ? 0x3b2a2e : [0x1f3d2b, 0x24442f, 0x2a4a35][Math.floor(r() * 3)];
    K.strut(caneA, [0, rim - 0.02, 0], [0.02, top, 0], 0.017, 0.008, 6, 0.8, 0.95, true);
    for (let i = 0; i < n; i++) {
      const u = i / (n - 1), y = rim + 0.1 + u * (top - rim - 0.14), a = i * 2.2 + B.jit(0.3);
      P.leaf(leafA, { x: Math.sin(a) * 0.02, y, z: Math.cos(a) * 0.02, a, t: 0.85 + B.jit(0.12) - 0.25 * u, L: (0.31 - 0.08 * u) * B.ls, W: 0.16 * B.ls, droop: 0.4, fold: 0.22, rows: 4, profile: ovate, baseS: 0.55 });
    }
    P.leaf(leafA, { x: 0.02, y: top - 0.02, z: 0, a: 0.5, t: 0.2, L: 0.15, W: 0.07, droop: 0.15, fold: 0.15, rows: 3, profile: ovate, baseS: 0.6 });   // the new leaf at the tip, upright
    return B.done(col, { caneCol: BARK, leafRough: 0.3 });
  },
  'ficus-tree'(it, ctx) {
    const B = begin('ficus-tree', it, ctx, 'Ficus Tree'), { P, K, r, rim, s, leafA, caneA } = B;
    const lean = B.jit(0.06), top = [Math.sin(lean) * 0.85 * s, rim - 0.02 + 0.85 * s, 0], col = B.green(1, 3);
    K.strut(caneA, [0, rim - 0.02, 0], top, 0.035, 0.022, 7, 0.8, 0.95, true);
    const br: number[][] = [[0.25, 0.85, 0.1], [-0.22, 0.95, -0.12], [0.05, 0.9, 0.26]].map(([x, y, z]) => [x * s, rim + (y - 0.46) * s + 0.46 * 0 + 0.3 * s, z * s]);
    br.forEach(b => K.strut(caneA, [top[0] * 0.85, rim + 0.65 * s, 0], b, 0.018, 0.01, 5, 0.8, 0.9, true));
    const tips = [top, ...br];
    for (let i = 0; i < 40; i++) {   // a rounded canopy of ovate leaves round the trunk top and the branch ends
      const c = tips[i % 4], a = i * 2.399 + B.jit(0.3), d = 0.06 + r() * 0.26 * s, y = c[1] + (r() - 0.35) * 0.38 * s;
      P.leaf(leafA, { x: c[0] * 0.8 + Math.sin(a) * d * 0.2, y, z: c[2] * 0.8 + Math.cos(a) * d * 0.2, a, t: 0.9 + B.jit(0.45), L: 0.21 * (0.7 + 0.3 * s), W: 0.105 * (0.7 + 0.3 * s), droop: 0.5, fold: 0.2, rows: 2, profile: ovate, baseS: 0.55 + 0.1 * r() });
    }
    return B.done(col, { leafRough: 0.35 });
  },
  'olive-tree-pot'(it, ctx) {
    const B = begin('olive-tree-pot', it, ctx, 'Olive Tree', { kind: 'square' }), { P, K, r, rim, s, leafA, caneA } = B;
    const k1 = [0.05, 0.44 + 0.5 * s, -0.03], k2 = [-0.02, 0.44 + 0.85 * s, 0.04];
    K.strut(caneA, [0, 0.42, 0], k1, 0.04, 0.03, 7, 0.8, 0.9, false); K.strut(caneA, k1, k2, 0.03, 0.02, 7, 0.85, 0.95, true);
    const twigs = [[0.26, 1.1, 0.1], [-0.24, 1.05, -0.12], [0.06, 1.12, -0.26], [-0.1, 1.08, 0.24]].map(([x, y, z]) => [x * s, 0.44 + (y - 0.44) * s, z * s]);
    twigs.forEach(t => K.strut(caneA, k2, t, 0.014, 0.008, 5, 0.85, 0.95, true));
    const tipsO = [k2, ...twigs];
    for (let i = 0; i < 60; i++) {   // small silver-green lanceolate leaves in a loose uneven cloud
      const c = tipsO[i % 5], a = i * 2.399 + B.jit(0.3), d = 0.05 + r() * 0.3 * s;
      P.leaf(leafA, { x: c[0] + Math.sin(a) * d * 0.5, y: c[1] + (r() - 0.35) * 0.34 * s, z: c[2] + Math.cos(a) * d * 0.5, a, t: 0.8 + B.jit(0.5), L: 0.12 * (0.7 + 0.3 * s), W: 0.04 * (0.7 + 0.3 * s), droop: 0.35, fold: 0.2, rows: 2, profile: lance, baseS: 0.6 + 0.2 * r(), th: 0.007 });
    }
    return B.done([0x5c6e57, 0x6b7f62, 0x74876a, 0x7d8f6f][Math.floor(r() * 4)], { caneCol: 0x8b7d6b, leafRough: 0.55 });
  },
  'jade-plant'(it, ctx) {
    const B = begin('jade-plant', it, ctx, 'Jade Plant'), { P, K, r, rim, leafA, caneA } = B;
    const col = [0x3f7f45, 0x4a8a4f, 0x558f55][Math.floor(r() * 3)];
    for (let i = 0; i < 5; i++) {
      const a = i * 1.3 + B.jit(0.4), lean = 0.06 + r() * 0.09, top = 0.16 + r() * 0.1, x = Math.sin(a) * lean, z = Math.cos(a) * lean;
      K.strut(caneA, [0, rim - 0.01, 0], [x, rim + top, z], 0.01, 0.007, 5, 0.8, 0.95, true);
      for (let k = 0; k < 9; k++) { const u = 0.3 + (k / 9) * 0.7, aa = k * 2.4 + i; P.leaf(leafA, { x: x * u + Math.sin(aa) * 0.01, y: rim + top * u + 0.01 * (k % 3), z: z * u + Math.cos(aa) * 0.01, a: aa, t: 1.1 + B.jit(0.3), L: 0.08, W: 0.06, droop: 0.4, fold: 0.3, th: 0.014, rows: 2, profile: ovate, baseS: 0.7 }); }
    }
    return B.done(col, { caneCol: 0x7a5f45, leafRough: 0.35 });
  },
  // ---- F3 arching leaflets -------------------------------------------------------------------------------------------------------------------------------
  'zz-plant'(it, ctx) {
    const B = begin('zz-plant', it, ctx, 'ZZ Plant'), { P, r, rim, H, leafA } = B;
    const col = [0x2d5a3a, 0x2f6240, 0x326845][Math.floor(r() * 3)];
    for (let i = 0; i < 6; i++) {
      const a = i * 2.399 + B.jit(0.3), t = 0.28 + r() * 0.4, len = (H - rim) * (0.8 + 0.3 * r());
      const tip = [Math.sin(a) * Math.sin(t) * len * 1.0, rim + Math.cos(t) * len * 0.82, Math.cos(a) * Math.sin(t) * len * 1.0];
      const mid = [tip[0] * 0.3, rim + len * 0.6, tip[2] * 0.3];
      P.arc(leafA, [0, rim - 0.01, 0], mid, tip, 0.011, 0.005, 2, 0.55, 0.75, 4);
      const at = (u: number) => [0, 1, 2].map(k => (1 - u) * (1 - u) * (k === 1 ? rim - 0.01 : 0) + 2 * (1 - u) * u * mid[k] + u * u * tip[k]);
      for (let k = 0; k < 4; k++) {
        const u = 0.34 + (k / 3) * 0.64, p = at(u);
        for (const sd of [-1, 1]) P.leaf(leafA, { x: p[0], y: p[1], z: p[2], a: a + sd * 1.15, t: 1.0 - 0.3 * u, L: 0.15 - 0.035 * u, W: 0.085, droop: 0.4, fold: 0.35, th: 0.012, rows: 1, profile: (u2: number) => Math.pow(Math.sin(Math.PI * Math.pow(u2, 0.75)), 0.8), baseS: 0.5 + 0.2 * u });
      }
    }
    return B.done(col, { leafRough: 0.28 });
  },
  // ---- F4 cordate clump -------------------------------------------------------------------------------------------------------------------------------------
  'peace-lily'(it, ctx) {
    const B = begin('peace-lily', it, ctx, 'Peace Lily'), { P, r, rim, H, leafA, bloomA } = B;
    const col = [0x1f4d2e, 0x255a35, 0x2a6038][Math.floor(r() * 3)], n = 11;
    for (let i = 0; i < n; i++) {
      const a = i * 2.399 + B.jit(0.25), t = 0.4 + r() * 0.5, L = (0.3 + 0.12 * r()) * B.ls, reach = (H - rim) * (0.45 + 0.4 * r());
      const px = Math.sin(a) * reach * 0.35, pz = Math.cos(a) * reach * 0.35;
      P.stalk(leafA, [0, rim - 0.01, 0], [px, rim + reach, pz], 0.006, 0.005, 0.5, 0.65);
      P.leaf(leafA, { x: px, y: rim + reach - 0.02, z: pz, a, t, L, W: 0.15 * B.ls, droop: 0.5, fold: 0.38, rows: 4, profile: cordate, baseS: 0.5 + 0.12 * r() });
    }
    for (let i = 0; i < 3; i++) {   // white spathes on tall stalks
      const a = i * 2.1 + r(), reach = 0.07 + r() * 0.06, top = H - 0.02 - r() * 0.12, x = Math.sin(a) * reach, z = Math.cos(a) * reach;
      P.stalk(leafA, [0, rim, 0], [x, top - 0.06, z], 0.004, 0.0035, 0.55, 0.6);
      P.leaf(bloomA, { x, y: top - 0.07, z, a, t: 0.3, L: 0.13, W: 0.075, droop: 0.2, fold: 0.3, rows: 3, th: 0.009, profile: cordate, baseS: 0.8 });
    }
    return B.done(col, { bloomCol: 0xf6f4ee, leafRough: 0.3 });
  },
  'calathea'(it, ctx) {
    const B = begin('calathea', it, ctx, 'Calathea'), { P, r, rim, H, leafA, bloomA } = B;
    const n = 12;
    for (let i = 0; i < n; i++) {
      const a = i * 2.399 + B.jit(0.2), t = 0.35 + (i % 4) * 0.2 + r() * 0.1, reach = (H - rim) * (0.45 + (0.5 * ((i * 7) % n)) / n);
      const x = Math.sin(a) * reach * 0.3, z = Math.cos(a) * reach * 0.3, y = rim + reach;
      P.stalk(leafA, [0, rim - 0.01, 0], [x, y, z], 0.005, 0.004, 0.5, 0.6);
      const o = { x, y: y - 0.01, z, a, t, droop: 0.4, fold: 0.3 };
      P.leaf(leafA, { ...o, L: 0.3, W: 0.17, rows: 4, profile: ovate, baseS: 0.5 });
      P.leaf(bloomA, { ...o, y: y - 0.004, L: 0.26, W: 0.04, rows: 3, th: 0.011, fold: 0.34, profile: (u: number) => Math.sin(Math.PI * u) * 0.9, baseS: 0.7 });   // the pale midrib stripe, a hair proud of the blade
    }
    return B.done(0x2f5d3a, { bloomCol: 0x7fae6a, leafRough: 0.4 });
  },
  'orchid'(it, ctx) {
    const B = begin('orchid', it, ctx, 'Orchid'), { P, K, r, rim, leafA, caneA, bloomA } = B;
    for (let i = 0; i < 4; i++) { const a = i * 1.6 + r() * 0.5; P.leaf(leafA, { x: Math.sin(a) * 0.03, y: rim - 0.01, z: Math.cos(a) * 0.03, a, t: 1.2 + r() * 0.2, L: 0.2 + r() * 0.04, W: 0.09, droop: 0.4, fold: 0.3, rows: 3, th: 0.012, profile: oblong, baseS: 0.5 }); }
    const knee = [0.02, rim + 0.24, 0.01], end = [knee[0] + 0.16, knee[1] + 0.14, knee[2] + 0.05];
    K.strut(caneA, [0.01, rim, 0], knee, 0.0045, 0.0035, 5, 0.7, 0.8, false); K.strut(caneA, knee, end, 0.0035, 0.003, 5, 0.8, 0.85, true);
    K.strut(caneA, [-0.01, rim, -0.01], [-0.01, rim + 0.34, -0.01], 0.003, 0.003, 4, 0.9, 0.9, true);
    const petal = [0xf4c2d7, 0xffffff, 0xb392c9, 0xf9e3ee, 0xe6a1b8][Math.floor(r() * 5)];
    for (let k = 0; k < 5; k++) { const f = 0.15 + k * 0.2, side = k % 2 ? 1 : -1; P.leaf(bloomA, { x: knee[0] + 0.16 * f, y: knee[1] + 0.14 * f + 0.01, z: knee[2] + 0.05 * f + side * 0.02, a: k + 1.57, t: 1.3, L: 0.06, W: 0.07, droop: 0.5, fold: 0.5, rows: 2, th: 0.009, profile: (u: number) => Math.pow(Math.sin(Math.PI * Math.pow(u, 0.6)), 0.7), baseS: 0.8 }); }
    return B.done(0x2d6a4f, { caneCol: 0x5a7a3a, bloomCol: petal, leafRough: 0.4 });
  },
  // ---- F5 fronds ---------------------------------------------------------------------------------------------------------------------------------------------------
  'indoor-palm'(it, ctx) {
    const B = begin('indoor-palm', it, ctx, 'Kentia Palm'), { P, r, rim, s, leafA, caneA } = B;
    const g0 = B.green(0, 3), pinnate = (u: number) => Math.max(0.1, Math.sin(Math.PI * Math.pow(u, 0.7))) * (0.72 + 0.28 * Math.abs(Math.cos(u * Math.PI * 7)));
    for (let i = 0; i < 3; i++) {
      const a = (i + 0.5) * (Math.PI * 2 / 3) + B.jit(0.4), lean = 0.08 + r() * 0.08, len = (1.0 + r() * 0.25) * s;
      const top = [Math.sin(a) * (0.08 + Math.sin(lean) * len), rim + Math.cos(lean) * len, Math.cos(a) * (0.08 + Math.sin(lean) * len)];
      P.arc(caneA, [Math.sin(a) * 0.08, rim - 0.02, Math.cos(a) * 0.08], [top[0] * 0.5, rim + len * 0.5, top[2] * 0.5], top, 0.015, 0.009, 3, 0.7, 0.9, 5);
      for (let k = 0; k < 6; k++) {
        const fa = a + (k - 2.5) * 0.65 + B.jit(0.15);
        P.leaf(leafA, { x: top[0], y: top[1] - 0.02, z: top[2], a: fa, t: 0.5 + Math.abs(k - 2.5) * 0.18 + B.jit(0.1), L: (0.68 + r() * 0.1) * s, W: 0.17, droop: 1.35 + B.jit(0.15), fold: 0.2, rows: 5, th: 0.006, profile: pinnate, baseS: 0.5 + 0.1 * r() });
      }
    }
    return B.done(g0, { caneCol: 0x4f6b3a, leafRough: 0.5 });
  },
  'fern'(it, ctx) {
    const B = begin('fern', it, ctx, 'Fern'), { P, r, rim, leafA } = B;
    const tiers = [[4, 0.3, 0.25, 1.1], [6, 0.28, 0.65, 1.25], [7, 0.28, 1.05, 1.35]], pinnate = (u: number) => Math.max(0.12, Math.sin(Math.PI * Math.pow(u, 0.7))) * (0.7 + 0.3 * Math.abs(Math.cos(u * Math.PI * 8)));
    tiers.forEach(([n, L0, t0, b0], tier) => { for (let i = 0; i < n; i++) { const a = (i * Math.PI * 2) / n + tier * 0.35 + B.jit(0.12); P.leaf(leafA, { x: Math.sin(a) * 0.025, y: rim - 0.01, z: Math.cos(a) * 0.025, a, t: t0 + B.jit(0.12), L: L0 + r() * 0.05, W: 0.085, droop: b0 + B.jit(0.15), fold: 0.15, rows: 5, th: 0.006, profile: pinnate, baseS: 0.55 + 0.1 * (tier / 2) }); } });
    return B.done([0x4f772d, 0x588157, 0x6a994e][Math.floor(r() * 3)], { leafRough: 0.55 });
  },
  'ponytail-palm'(it, ctx) {
    const B = begin('ponytail-palm', it, ctx, 'Ponytail Palm'), { P, K, r, rim, H, s, leafA, caneA } = B;
    const trunkH = Math.max(0.4, H * 0.42);
    K.lathe(caneA, [[0.001, rim, 0.8], [0.13, rim + 0.04, 0.9], [0.15, rim + 0.13, 1], [0.12, rim + 0.22, 0.96], [0.05, rim + 0.28, 0.9], [0.045, rim + trunkH, 0.9], [0.001, rim + trunkH, 0.9]], 16);
    for (let i = 0; i < 16; i++) { const a = i * 2.399 + B.jit(0.15), t0 = 0.15 + r() * 0.5, L = (H - rim - trunkH) * (1.0 + r() * 0.3); P.leaf(leafA, { x: 0, y: rim + trunkH - 0.02, z: 0, a, t: t0, L, W: 0.03, droop: 1.9 + r() * 0.6, fold: 0.15, rows: 5, th: 0.007, profile: (u: number) => 1 - u * 0.75, baseS: 0.6 }); }
    return B.done(0x5a8f3f, { caneCol: 0x8b6f4e, leafRough: 0.5 });
  },
  // ---- F6 strap rosettes -------------------------------------------------------------------------------------------------------------------------------------
  'snake-plant'(it, ctx) {
    const B = begin('snake-plant', it, ctx, 'Snake Plant'), { P, r, rim, H, leafA } = B;
    const col = [0x2d6a4f, 0x386641, 0x4f772d][Math.floor(r() * 3)], n = 12 + Math.floor(r() * 3);
    for (let i = 0; i < n; i++) { const a = i * 2.399 + B.jit(0.3), d = 0.02 + r() * 0.07, L = (H - rim) * (0.6 + r() * 0.4); P.leaf(leafA, { x: Math.sin(a) * d, y: rim - 0.02, z: Math.cos(a) * d, a, t: 0.06 + r() * 0.14, L, W: 0.075, droop: 0.04, fold: 0.3, rows: 4, th: 0.012, profile: strap, baseS: 0.45 + 0.25 * r(), tipS: 0.8 + 0.2 * r() }); }
    return B.done(col, { leafRough: 0.4 });
  },
  'aloe-pot'(it, ctx) {
    const B = begin('aloe-pot', it, ctx, 'Aloe Pot'), { P, r, rim, leafA } = B;
    for (let i = 0; i < 12; i++) P.leaf(leafA, { x: 0, y: rim - 0.015, z: 0, a: i * 2.399 + B.jit(0.2), t: 0.3 + (i % 3) * 0.3 + r() * 0.1, L: 0.17 + r() * 0.09, W: 0.055, droop: 0.15, fold: 0.5, rows: 3, th: 0.014, profile: (u: number) => Math.pow(Math.sin(Math.PI * Math.pow(u, 0.5)), 0.7) * (1 - 0.3 * u), baseS: 0.55 });
    return B.done([0x5f8f5a, 0x6a9a62, 0x4f8a5f][Math.floor(r() * 3)], { leafRough: 0.5 });
  },
  'dracaena'(it, ctx) {
    const B = begin('dracaena', it, ctx, 'Dracaena'), { P, K, r, rim, H, leafA, caneA } = B;
    [1, 0.78, 0.6].forEach((f, i) => {
      const a = i * 2.1 + B.jit(0.3), top = [Math.sin(a) * 0.1, rim + (H - rim - 0.3) * f, Math.cos(a) * 0.1];
      K.strut(caneA, [Math.sin(a) * 0.04, rim - 0.02, Math.cos(a) * 0.04], top, 0.022, 0.016, 6, 0.8, 0.9, true);
      for (let k = 0; k < 8; k++) P.leaf(leafA, { x: top[0], y: top[1] - 0.01, z: top[2], a: k * 0.8 + B.jit(0.2), t: 0.5 + r() * 0.9, L: 0.36 + r() * 0.08, W: 0.05, droop: 0.5, fold: 0.25, rows: 3, th: 0.008, profile: strap, baseS: 0.5 + 0.2 * r() });
    });
    return B.done([0x4f772d, 0x588157, 0x6a994e][Math.floor(r() * 3)], { caneCol: 0x8b7355 });
  },
};

// ---- the plants that do not stand in one pot at the origin: a vase of dried stems, a hanging pot, trays and a trailing pot ---------------------------------------------------------------
/** a recipe that builds its own pot(s): `spec` for the envelope, no SPEC pot */
function bare(it: any, ctx: any, name: string, type: string) {
  const P = plantKit(ctx), g = ctx.group(name), potCol = potColor(it, ctx.colors, ctx.rng, ctx.hex), r = splitRng(ctx.rng);
  const potA = new P.K.Acc(), leafA = new P.K.Acc(), caneA = new P.K.Acc(), bloomA = new P.K.Acc();
  const box = boxAt(BOXES[type], it.h);
  // (0.02 of the 0.03 the drift gate allows: the composer's sizeOf is the symmetrised box and parity, 0.03 on foliage, is judged against it)
  const done = (leafCol: number, o: any = {}) => { P.fit([leafA, caneA, bloomA], box, 0, 0.02, box.bottom ? box.bottom - 0.02 : 0.002); return P.finish(g, { pot: potA, potCol, leaf: leafA, leafCol, cane: caneA, bloom: bloomA, ...o }); };
  return { P, K: P.K, g, r, potA, leafA, caneA, bloomA, potCol, done, jit: (a: number) => P.jit(r, a), green: (a = 0, b = GREENS.length - 1) => GREENS[a + Math.floor(r() * (b - a + 1))] };
}

recipes['pampas-vase'] = (it, ctx) => {
  const s = (it.h || 1.18) / 1.18, B = bare(it, ctx, 'Pampas Vase', 'pampas-vase'), { P, K, r, caneA, bloomA } = B;
  // the vase: a turned body with a narrow neck (a lathe, 16 sides)
  K.lathe(B.potA, [[0.001, 0, 0.7], [0.095 * 0.9, 0, 0.78], [0.1, 0.1 * s, 1], [0.085, 0.26 * s, 1], [0.052, 0.44 * s, 0.98], [0.058, 0.5 * s, 1], [0.04, 0.5 * s, 0.85], [0.04, 0.46 * s, 0.35], [0.001, 0.46 * s, 0.35]], 16);
  const plume = (u: number) => Math.max(0.08, Math.sin(Math.PI * Math.pow(u, 0.5))) * (1 - 0.35 * u) * (0.85 + 0.15 * Math.sin(u * 40));
  for (let i = 0; i < 8; i++) {
    const a = i * 0.785 + r() * 0.5, lean = 0.06 + r() * 0.16, L = (0.3 + r() * 0.1) * s, dx = Math.sin(a) * Math.sin(lean), dz = Math.cos(a) * Math.sin(lean);
    const top = [dx * L, 0.5 * s + Math.cos(lean) * L, dz * L];
    K.strut(caneA, [Math.sin(a) * 0.02, 0.47 * s, Math.cos(a) * 0.02], top, 0.004, 0.003, 4, 0.85, 0.9, true);
    P.leaf(bloomA, { x: top[0], y: top[1] - 0.03, z: top[2], a, t: lean, L: 0.38 * (0.7 + 0.3 * s), W: 0.085, droop: 0.45 + r() * 0.35, fold: 0, rows: 6, th: 0.02, profile: plume, baseS: 0.7 + 0.1 * r(), tipS: 1 });
  }
  const vaseCol = it.color ? ctx.hex(it.color) : r() < 0.5 ? ctx.colors.accent : 0xd6d3d1;
  return B.done(0xe8d9c0, { potCol: vaseCol, caneCol: 0xc9a26b, bloomCol: [0xe8d9c0, 0xdccbb0, 0xf0e4d0][Math.floor(r() * 3)] });
};

recipes['hanging-plant'] = (it, ctx) => {
  const B = bare(it, ctx, 'Hanging Plant', 'hanging-plant'), { P, K, r, caneA, leafA } = B;
  const hook = it.y !== undefined ? 0 : 2.1, potR = 0.15, rimY = hook - 0.44;
  K.slab(caneA, 0, hook - 0.006, 0, 0.09, 0.012, 0.09);                                                            // the ceiling plate
  K.band(caneA, 0, hook - 0.045, 0, 0.028, 0.012, 8, 0.006, 0.9);                                                   // the hook ring
  for (let i = 0; i < 3; i++) { const a = (i * Math.PI * 2) / 3 + 0.5; K.strut(caneA, [0, hook - 0.07, 0], [Math.sin(a) * (potR - 0.01), rimY, Math.cos(a) * (potR - 0.01)], 0.004, 0.004, 4, 1, 1, false); }   // three chains
  P.pot(B.potA, 'glazed', potR, 0.1, 0.16, 18, [0, rimY - 0.16, 0]);
  const col = B.green(0, 4);
  for (let i = 0; i < 16; i++) { const a = i * 2.399 + r(), d = i < 6 ? 0.02 : 0.07; P.leaf(leafA, { x: Math.sin(a) * d, y: rimY - 0.01, z: Math.cos(a) * d, a, t: 0.8 + r() * 0.6, L: 0.15 + r() * 0.04, W: 0.095, droop: 0.55, fold: 0.3, rows: 2, th: 0.01, profile: ovate, baseS: 0.5 + 0.15 * r() }); }   // the mound
  for (let i = 0; i < 5; i++) {   // five strands: over the rim, turn down and hang, leaves along them
    const a = (i * Math.PI * 2) / 5 + B.jit(0.25), L = 0.22 + r() * 0.08, x0 = Math.sin(a) * (potR - 0.03), z0 = Math.cos(a) * (potR - 0.03);
    const pts = P.arc(leafA, [x0, rimY + 0.01, z0], [Math.sin(a) * (potR + 0.06), rimY + 0.0, Math.cos(a) * (potR + 0.06)], [Math.sin(a) * (potR + 0.07), rimY - L, Math.cos(a) * (potR + 0.07)], 0.006, 0.004, 3, 0.45, 0.45, 4);
    for (let k = 1; k <= 6; k++) { const p = pts[Math.min(pts.length - 1, Math.round((k * 3) / 6.3))], side = k % 2 ? 1 : -1; P.leaf(leafA, { x: p[0], y: p[1], z: p[2], a: a + side * 1.2 + B.jit(0.3), t: Math.PI - 0.7, L: 0.1, W: 0.07, droop: 0.2, fold: 0.25, rows: 1, th: 0.01, profile: ovate, baseS: 0.55 + 0.2 * r() }); }
  }
  return B.done(col, { caneCol: ctx.colors.metal, caneExtra: { metalness: 0.7, roughness: 0.35, vertexColors: false } });
};

recipes['herb-pots'] = (it, ctx) => {
  const B = bare(it, ctx, 'Herb Pots', 'herb-pots'), { P, K, r, leafA, caneA } = B;
  const wd = (x: number, y: number, z: number, w: number, h: number, d: number) => K.slab(caneA, x, y, z, w, h, d, 0.95);
  wd(0, 0.01, 0, 0.42, 0.02, 0.16); wd(0, 0.0175, -0.074, 0.42, 0.035, 0.012); wd(0, 0.0175, 0.074, 0.42, 0.035, 0.012); wd(-0.204, 0.0175, 0, 0.012, 0.035, 0.16); wd(0.204, 0.0175, 0, 0.012, 0.035, 0.16);   // the lipped tray
  const order = r() < 0.5 ? [0, 1, 2] : [2, 0, 1];
  [-0.13, 0, 0.13].forEach((x, i) => {
    const rim = P.pot(B.potA, 'terracotta', 0.055, 0.045, 0.1, 12, [x, 0.02, 0]) + 0.008, kind = order[i];
    if (kind === 0) for (let k = 0; k < 6; k++) { const a = k * 1.1; P.leaf(leafA, { x: x + Math.sin(a) * 0.012, y: rim - 0.012, z: Math.cos(a) * 0.012, a, t: 0.55 + (k % 2) * 0.35, L: 0.095, W: 0.075, droop: 0.45, fold: 0.3, rows: 2, th: 0.01, profile: ovate, baseS: 0.65 + 0.1 * r() }); }   // basil
    else if (kind === 1) for (let k = 0; k < 14; k++) { const a = k * 0.9, t = 0.12 + r() * 0.4; K.strut(leafA, [x + Math.sin(a) * 0.01, rim - 0.015, Math.cos(a) * 0.01], [x + Math.sin(a) * Math.sin(t) * 0.13, rim - 0.015 + Math.cos(t) * 0.13, Math.cos(a) * Math.sin(t) * 0.13], 0.004, 0.0025, 4, 0.7, 0.95, true); }   // rosemary: needles
    else for (let k = 0; k < 8; k++) { const a = k * 0.8 + 0.8; P.leaf(leafA, { x: x + Math.sin(a) * 0.02, y: rim - 0.012, z: Math.cos(a) * 0.02, a, t: 1.15 + r() * 0.2, L: 0.065, W: 0.05, droop: 0.2, fold: 0.2, rows: 1, th: 0.008, profile: ovate, baseS: 0.7 + 0.1 * r() }); }   // mint
  });
  return B.done(0x4f9d3f, { caneCol: ctx.colors.wood, caneExtra: { roughness: 0.6 } });
};

recipes['succulent-tray'] = (it, ctx) => {
  const B = bare(it, ctx, 'Succulent Tray', 'succulent-tray'), { P, K, r, leafA, caneA } = B;
  const trayCol = it.color ? ctx.hex(it.color) : r() < 0.5 ? ctx.colors.wood : 0x9a9a94;
  const wd = (x: number, y: number, z: number, w: number, h: number, d: number) => K.slab(B.potA, x, y, z, w, h, d, 0.95);
  wd(0, 0.01, 0, 0.36, 0.02, 0.2); wd(0, 0.02, -0.094, 0.36, 0.04, 0.012); wd(0, 0.02, 0.094, 0.36, 0.04, 0.012); wd(-0.174, 0.02, 0, 0.012, 0.04, 0.2); wd(0.174, 0.02, 0, 0.012, 0.04, 0.2);
  K.slab(caneA, 0, 0.026, 0, 0.33, 0.012, 0.17, 0.78);                                                             // the gravel (a shade darker than the stone: it is in the tray's shadow)
  const y = 0.032, rosette = (x: number, z: number, n: number, L: number) => { for (let k = 0; k < n; k++) P.leaf(leafA, { x, y, z, a: k * 2.399, t: 0.5 + (k % 3) * 0.3, L, W: L * 0.55, droop: 0.2, fold: 0.4, rows: 1, th: 0.012, profile: ovate, baseS: 0.5 + 0.12 * (k % 3) }); };
  rosette(-0.12, 0.03, 8, 0.05); rosette(0.0, 0.06, 6, 0.032);
  for (let k = 0; k < 5; k++) P.leaf(leafA, { x: -0.03 + Math.sin(k) * 0.01, y, z: -0.045 + Math.cos(k) * 0.01, a: k * 1.26 + r(), t: 0.25 + r() * 0.3, L: 0.09, W: 0.036, droop: 0.15, fold: 0.5, rows: 2, th: 0.014, profile: ovate, baseS: 0.7 });   // an aloe
  K.lathe(leafA, [[0.001, y, 0.6], [0.03, y, 0.7], [0.036, y + 0.03, 1], [0.025, y + 0.058, 1], [0.001, y + 0.07, 0.9]], 12, 0, 1, (x: number, yy: number, z: number) => [x + 0.05, yy, z + 0.045]);   // a barrel
  K.strut(leafA, [0.12, y, -0.03], [0.12, y + 0.05, -0.03], 0.008, 0.006, 5, 0.5, 0.6, false);
  for (let k = 0; k < 4; k++) P.leaf(leafA, { x: 0.12, y: y + 0.05, z: -0.03, a: k * 1.57 + r(), t: 1.0, L: 0.04, W: 0.03, droop: 0.2, fold: 0.3, rows: 1, th: 0.012, profile: ovate, baseS: 0.7 });   // a jade
  return B.done(0x6a994e, { potCol: trayCol, caneCol: 0xa89f91, leafRough: 0.5 });
};

recipes['trailing-ivy'] = (it, ctx) => {
  const B = bare(it, ctx, 'Trailing Ivy', 'trailing-ivy'), { P, K, r, leafA } = B;
  const pz = -0.13, rim = P.pot(B.potA, ['terracotta', 'glazed', 'ribbed'][Math.floor(r() * 3)], 0.1, 0.08, 0.14, 16, [0, 0, pz]), col = B.green(0, 3);
  for (let i = 0; i < 6; i++) { const a = i * 2.1 + r(); P.leaf(leafA, { x: Math.sin(a) * 0.04, y: rim - 0.01, z: pz + Math.cos(a) * 0.04, a, t: 1.0 + r() * 0.5, L: 0.12, W: 0.07, droop: 0.5, fold: 0.3, rows: 1, th: 0.01, profile: ovate, baseS: 0.5 + 0.2 * r() }); }
  for (let i = 0; i < 4; i++) {   // four vines: over the rim, down to the surface, then a run along it
    const a = (i - 1.5) * 0.36 + B.jit(0.1), r2 = 0.3 + r() * 0.06, p0 = [Math.sin(a) * 0.08, rim - 0.005, pz + Math.cos(a) * 0.08], p1 = [Math.sin(a) * 0.12, 0.015, pz + Math.cos(a) * 0.12], p2 = [Math.sin(a) * r2 + B.jit(0.03), 0.012, pz + Math.cos(a) * r2];
    const pts = P.arc(leafA, p0, [Math.sin(a) * 0.115, rim - 0.01, pz + Math.cos(a) * 0.115], p1, 0.005, 0.004, 3, 0.7, 0.7, 4);
    K.strut(leafA, p1, p2, 0.004, 0.004, 4, 0.7, 0.7, true);
    [pts[2], pts[3]].forEach((p, k) => P.leaf(leafA, { x: p[0], y: p[1], z: p[2], a: a + (k % 2 ? 1 : -1) * 1.1 + B.jit(0.3), t: 2.0 + B.jit(0.3), L: 0.085, W: 0.062, droop: 0.2, fold: 0.25, rows: 2, th: 0.009, profile: ovate, baseS: 0.55 + 0.2 * r() }));
    [0.3, 0.55, 0.8].forEach((t, k) => P.leaf(leafA, { x: p1[0] + (p2[0] - p1[0]) * t, y: 0.013, z: p1[2] + (p2[2] - p1[2]) * t, a: a + (k % 2 ? 1 : -1) * 1.1 + B.jit(0.3), t: 1.45, L: 0.085, W: 0.062, droop: 0.1, fold: 0.2, rows: 2, th: 0.009, profile: ovate, baseS: 0.55 + 0.2 * r() }));
  }
  return B.done(col);
};

// ---- cut flowers (T9): a vase and a jug of stems, a leaf mesh and one bloom colour: 3 meshes, 600 triangles at most ---------------------------------------------------------------
const BLOOMS = [0xf59e0b, 0xf43f5e, 0xfef3c7, 0xc084fc], WILD = [0xf9a8d4, 0xfde68a, 0xffffff, 0xc4b5fd, 0xfdba74];
/** a bloom: a squat dome of `seg` sides (a flower head seen from above is a disc with a boss), at (x, y, z) leaning with the stem */
function bloom(K: any, acc: any, x: number, y: number, z: number, r: number, seg = 6) {
  K.lathe(acc, [[r, 0, 0.8], [r * 0.85, r * 0.45, 1], [r * 0.4, r * 0.8, 0.95], [0.001, r * 0.85, 0.9]], seg, 0, 1, (px: number, py: number, pz: number) => [px + x, py + y, pz + z]);
}

recipes['vase'] = (it, ctx) => {
  const B = bare(it, ctx, 'Vase', 'vase'), { P, K, r, leafA, bloomA } = B, h = it.h || 0.26;
  K.lathe(B.potA, [[0.056, 0, 0.8], [0.062, 0.1 * h, 0.95], [0.05, 0.7 * h, 1], [0.033, 0.92 * h, 0.98], [0.037, h, 1], [0.028, h, 0.85], [0.001, h - 0.02, 0.3]], 16);
  const col = B.green(), n = 2 + Math.floor(r() * 2), a0 = r() * Math.PI * 2, headCol = BLOOMS[Math.floor(r() * 4)];
  for (let i = 0; i < n; i++) {   // two or three stems leaning out of the neck, a pair of leaves each, a bloom on the tallest (and a bud on the others)
    const a = a0 + (i * Math.PI * 2) / n + B.jit(0.4), lean = 0.12 + r() * 0.14, len = 0.24 + r() * 0.07;
    const dx = Math.sin(a) * Math.sin(lean), dz = Math.cos(a) * Math.sin(lean), c = Math.cos(lean);
    const p0 = [0, h - 0.03, 0], tip = [dx * len, h - 0.03 + c * len, dz * len];
    K.strut(leafA, p0, tip, 0.004, 0.003, 5, 0.5, 0.65, false);
    for (const t of [0.5, 0.78]) P.leaf(leafA, { x: dx * len * t, y: h - 0.03 + c * len * t, z: dz * len * t, a: a + (t > 0.6 ? 1.2 : -0.4), t: 1.2, L: 0.075, W: 0.04, droop: 0.4, fold: 0.3, rows: 2, th: 0.008, profile: ovate, baseS: 0.55 });
    bloom(K, bloomA, tip[0], tip[1], tip[2], i === 0 ? 0.03 : 0.02, 6);
  }
  return B.done(col, { potCol: it.color ? ctx.hex(it.color) : ctx.colors.accent, bloomCol: headCol, leafRough: 0.7 });
};

recipes['flower-jug'] = (it, ctx) => {
  const B = bare(it, ctx, 'Flower Jug', 'flower-jug'), { P, K, r, leafA, bloomA } = B;
  K.lathe(B.potA, [[0.06, 0, 0.8], [0.085, 0.05, 0.95], [0.09, 0.1, 1], [0.07, 0.16, 1], [0.06, 0.2, 0.98], [0.075, 0.22, 1], [0.058, 0.22, 0.85], [0.001, 0.2, 0.3]], 14);
  // the handle: half a ring on the +x side, three struts
  for (let k = 0; k < 3; k++) { const a0 = -Math.PI / 2 + (k * Math.PI) / 3, a1 = -Math.PI / 2 + ((k + 1) * Math.PI) / 3; K.strut(B.potA, [0.085 + Math.cos(a0) * 0.05, 0.12 + Math.sin(a0) * 0.05, 0], [0.085 + Math.cos(a1) * 0.05, 0.12 + Math.sin(a1) * 0.05, 0], 0.008, 0.008, 5, 0.9, 0.9, false); }
  const col = B.green(), n = 5 + Math.floor(r() * 3), a0 = r() * Math.PI * 2, headCol = WILD[Math.floor(r() * 5)];
  for (let i = 0; i < n; i++) {
    const a = a0 + i * 2.4, lean = 0.1 + r() * 0.32, len = 0.14 + r() * 0.1, dx = Math.sin(a) * Math.sin(lean), dz = Math.cos(a) * Math.sin(lean), c = Math.cos(lean), tip = [dx * len, 0.2 + c * len, dz * len];
    K.strut(leafA, [0, 0.2, 0], tip, 0.0035, 0.003, 4, 0.5, 0.65, false);
    if (i < 4) P.leaf(leafA, { x: dx * len * 0.45, y: 0.2 + c * len * 0.45, z: dz * len * 0.45, a, t: 1.2, L: 0.06, W: 0.032, droop: 0.4, fold: 0.3, rows: 2, th: 0.008, profile: ovate, baseS: 0.55 });
    bloom(K, bloomA, tip[0], tip[1] + 0.005, tip[2], 0.026 + r() * 0.012, 6);
  }
  return B.done(col, { potCol: it.color ? ctx.hex(it.color) : ctx.colors.accent, bloomCol: headCol, leafRough: 0.7 });
};

// ---- two new dormant surface types (T9): a trough planter for the floor and a pothos for a shelf ---------------------------------------------------------------------------------------
recipes['trough-planter'] = (it, ctx) => {
  const P = plantKit(ctx), { K } = P, g = ctx.group('Planter'), r = splitRng(ctx.rng), w = it.w || 0.7, d = 0.24, h = 0.32;
  const trough = new K.Acc(), leafA = new K.Acc(), potCol = it.color ? ctx.hex(it.color) : r() < 0.5 ? ctx.colors.accent : TERRACOTTA;
  K.shell(trough, { cy: h / 2, w, h, d, r: 0.025, faces: ['py', 'px', 'nx', 'pz', 'nz'], kx: [-w / 2, -w / 2 + 0.025, w / 2 - 0.025, w / 2], ky: [-h / 2, -h / 2 + 0.025, h / 2 - 0.05, h / 2], kz: [-d / 2, -d / 2 + 0.025, d / 2 - 0.025, d / 2], shade: (_x: number, y: number, _z: number, _nx: number, ny: number) => (ny > 0.5 ? 0.32 : 0.82 + 0.18 * smooth(-h / 2, h / 2, y)) });
  const n = Math.max(3, Math.round(w / 0.17)), col = GREENS[Math.floor(r() * GREENS.length)];
  for (let c = 0; c < n; c++) { const x = -w / 2 + 0.1 + ((w - 0.2) * c) / (n - 1); for (let k = 0; k < 6; k++) { const a = k * 1.05 + c, t = 0.15 + r() * 0.5; P.leaf(leafA, { x: x + Math.sin(a) * 0.02, y: h - 0.02, z: Math.cos(a) * 0.02, a, t, L: 0.2 + r() * 0.12, W: 0.055, droop: 0.5, fold: 0.3, rows: 2, th: 0.008, profile: strap, baseS: 0.5 + 0.2 * r() }); } }
  return P.finish(g, { pot: trough, potCol, leaf: leafA, leafCol: col });
};

recipes['pothos'] = (it, ctx) => {
  const B = bare(it, ctx, 'Pothos', 'trailing-ivy'), { P, K, r, leafA } = B;
  const rim = P.pot(B.potA, ['terracotta', 'glazed', 'ribbed'][Math.floor(r() * 3)], 0.085, 0.065, 0.12, 16), col = B.green(0, 3);
  const heart = (u: number) => Math.pow(Math.sin(Math.PI * Math.pow(u, 0.45)), 0.9);
  for (let i = 0; i < 8; i++) { const a = i * 2.399, t = 0.5 + r() * 0.5; P.leaf(leafA, { x: Math.sin(a) * 0.03, y: rim - 0.01, z: Math.cos(a) * 0.03, a, t, L: 0.12, W: 0.1, droop: 0.5, fold: 0.3, rows: 3, th: 0.009, profile: heart, baseS: 0.55 + 0.2 * r() }); }
  for (let i = 0; i < 4; i++) {   // vines over the rim and out along the surface, a heart leaf every few cm
    const a = i * 1.6 + 0.4, p0 = [Math.sin(a) * 0.07, rim, Math.cos(a) * 0.07], p1 = [Math.sin(a) * 0.115, 0.018, Math.cos(a) * 0.115], p2 = [Math.sin(a) * (0.24 + 0.05 * r()), 0.012, Math.cos(a) * (0.24 + 0.05 * r())];
    const pts = P.arc(leafA, p0, [Math.sin(a) * 0.105, rim - 0.01, Math.cos(a) * 0.105], p1, 0.005, 0.004, 3, 0.7, 0.7, 4);
    K.strut(leafA, p1, p2, 0.004, 0.004, 4, 0.7, 0.7, true);
    [pts[2]].forEach(p => P.leaf(leafA, { x: p[0], y: p[1], z: p[2], a: a + 1.3, t: 2.0, L: 0.09, W: 0.075, droop: 0.2, fold: 0.25, rows: 2, th: 0.008, profile: heart, baseS: 0.6 }));
    [0.25, 0.5, 0.78].forEach((t, k) => P.leaf(leafA, { x: p1[0] + (p2[0] - p1[0]) * t, y: 0.013, z: p1[2] + (p2[2] - p1[2]) * t, a: a + (k % 2 ? 1.2 : -1.2), t: 1.5, L: 0.095, W: 0.08, droop: 0.1, fold: 0.2, rows: 2, th: 0.008, profile: heart, baseS: 0.6 + 0.2 * r() }));
  }
  return B.done(col, { leafRough: 0.4 });
};
