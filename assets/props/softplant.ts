// softplant — plants v2 on the softkit grammar (PLAN 5.3 T5/T9, SOFT stream). Every houseplant is THREE or FOUR meshes (pot with its soil, leaves with their stems, an optional
// cane, an optional bloom colour), built from closed lens leaves (`leaf()`), tapered struts and a lathe-turned pot, instead of 14-51 faceted spindles and cylinders.
//
//   • opaque leaf GEOMETRY, never an alpha-cut card: GTAO turns a card into a solid quad; a lens has a real outline and a rim, so the occlusion pass sees the true silhouette;
//   • one mesh per role colour, a neutral per-vertex shade for the leaf's base-to-tip gradient and its rib, the soil as a dark shade of the pot's own colour;
//   • leaves cast shadows but do not receive them (a 5 mm lens receiving the sun map stripes with acne);
//   • the envelope: each plant is built a little generous and then `fit()` scales it about its axis so no leaf stands more than 0.03 m outside the box the composer laid its room out with
//     (assets/props/measured.ts, the baseline's box at that `h`): the first cut of the design prototype overshot by up to 0.27 m;
//   • eight families (paddle on stalk, broad leaf on a cane, arching leaflets, cordate clump, fronds, strap rosette, trailing, tuft), three pot forms (tapered terracotta, glazed with a
//     saucer, ribbed), sizes by the type's own pot and `h`. All variety is a private stream seeded by ONE ctx.rng draw (after the old pot-colour draw), so no other prop's stream moves.
import { softkit, softMat, put, splitRng, clamp, smooth } from './softkit.js';

export const GREENS = [0x2d6a4f, 0x386641, 0x40916c, 0x4f772d, 0x588157, 0x6a994e];
const TERRACOTTA = 0xc2703e, BARK = 0x5b4636, STEM_BROWN = 0x7a6248;

export interface Box { x0: number; z0: number; x1: number; z1: number; top: number; bottom?: number }
/** a row of the baseline's boxes: [h, x0, z0, x1, z1, top, bottom]; the first, 'def', is the box at the default `h` */
export type BoxRow = Array<string | number>;
/** the baseline box at `h`: the default row when the spec gives none, else interpolated (or extrapolated from the nearest two) between the probed rows */
export function boxAt(rows: BoxRow[], h: number | undefined): Box {
  const mk = (r: BoxRow): Box => ({ x0: r[1] as number, z0: r[2] as number, x1: r[3] as number, z1: r[4] as number, top: r[5] as number, bottom: r[6] as number });
  if (h === undefined || rows.length < 3) return mk(rows[0]);
  const num = rows.slice(1).sort((a, b) => (a[0] as number) - (b[0] as number));
  let i = 0; while (i < num.length - 2 && h > (num[i + 1][0] as number)) i++;
  const a = num[i], b = num[i + 1], t = (h - (a[0] as number)) / ((b[0] as number) - (a[0] as number)), L = (k: number) => (a[k] as number) + ((b[k] as number) - (a[k] as number)) * t;
  return { x0: Math.min(L(1), -0.05), z0: Math.min(L(2), -0.05), x1: Math.max(L(3), 0.05), z1: Math.max(L(4), 0.05), top: L(5), bottom: L(6) };
}

export interface PlantSpec {
  H0: number;                        // the height at default h (the old builder's `it.h || H0`)
  pot: [number, number, number];     // rt, rb, h
  rows: BoxRow[];                    // the baseline's boxes (default and at the probed `h`), see boxAt
  hasH?: boolean;                    // honours `h`
}

/** a plant's size factor for `h`: the old builders scaled everything above the pot by (h − rim)/(H0 − rim) */
export const sizeOf = (sp: PlantSpec, it: any) => { const rim = sp.pot[2], H = it.h || sp.H0; return { H, s: Math.max(0.2, (H - rim) / (sp.H0 - rim)) }; };

export function plantKit(ctx: any) {
  const { THREE, rng, colors, hex } = ctx, K = softkit(THREE);
  const jit = (r: () => number, a: number) => (r() - 0.5) * 2 * a;

  /** the pot and its soil as one lathe: kind 'terracotta' (tapered, lipped), 'glazed' (cylinder on a saucer), 'ribbed' (fluted), 'square' (a tapered planter on its corner). Returns the rim height. */
  function pot(acc: any, kind: string, rt: number, rb: number, h: number, seg = 16, at: number[] | null = null) {
    const soil = 0.3;
    let prof: number[][], rib: ((ph: number, j: number) => number) | null = null, bend: ((x: number, y: number, z: number) => number[]) | null = null, sg = seg;
    const move = (f: ((x: number, y: number, z: number) => number[]) | null) => (at ? (x: number, y: number, z: number) => { const m = f ? f(x, y, z) : [x, y, z]; return [m[0] + at[0], m[1] + at[1], m[2] + at[2]]; } : f);
    if (kind === 'glazed') prof = [[rb * 1.12, 0, 0.8], [rb * 1.12, 0.012, 0.92], [rb * 0.92, 0.014, 0.88], [rt * 0.98, h * 0.35, 1], [rt, h, 1], [rt * 0.88, h, 0.9], [rt * 0.86, h - 0.02, soil], [0.001, h - 0.02, soil]];
    else if (kind === 'ribbed') { sg = 24; prof = [[rb, 0, 0.8], [rt * 0.94, h * 0.55, 1], [rt * 1.02, h, 1], [rt * 0.88, h, 0.9], [rt * 0.86, h - 0.02, soil], [0.001, h - 0.02, soil]]; rib = (ph: number, j: number) => (j >= 4 ? 1 : 0.86 + 0.14 * (0.5 + 0.5 * Math.cos(ph * 8))); }
    else if (kind === 'square') { sg = 4; prof = [[rb, 0, 0.8], [rt, h, 1], [rt * 0.88, h, 0.9], [rt * 0.86, h - 0.02, soil], [0.001, h - 0.02, soil]]; bend = (x: number, y: number, z: number) => [(x - z) * Math.SQRT1_2, y, (x + z) * Math.SQRT1_2]; }
    else prof = [[rb * 0.92, 0, 0.76], [rb, 0.03, 0.9], [rt * 0.96, h - 0.05, 1], [rt * 1.05, h - 0.046, 1], [rt * 1.05, h, 1], [rt * 0.86, h, 0.9], [rt * 0.84, h - 0.018, soil], [0.001, h - 0.018, soil]];
    K.lathe(acc, prof, sg, 0, 1, move(bend), rib);
    return (at ? at[1] : 0) + h;
  }
  const POTS = ['terracotta', 'glazed', 'ribbed'];

  /** a leaf: closed lens from its base (x, y, z) heading a, tilted t from vertical and drooping, length L, width W */
  const leaf = (acc: any, o: any) => K.leaf(acc, { rows: 4, th: 0.007, ...o, rows2: undefined, ...(o.rows !== undefined ? { rows: Math.max(2, o.rows) } : {}) });   // (rows 1 has width only at its two pointed ends: a needle; two rows is the least that is a leaf)
  /** a stalk: a straight tapered strut, 5 sides, open at the base and capped at the tip */
  const stalk = (acc: any, a: number[], b: number[], r0: number, r1: number, s0 = 0.55, s1 = 0.8) => K.strut(acc, a, b, r0, r1, 5, s0, s1, true);
  /** a curved stalk of `n` struts through the points of a quadratic arc from `a` over `mid` to `b` */
  const arc = (acc: any, a: number[], mid: number[], b: number[], r0: number, r1: number, n = 4, s0 = 0.55, s1 = 0.8, sides = 5) => {
    const at = (t: number) => [0, 1, 2].map(k => (1 - t) * (1 - t) * a[k] + 2 * (1 - t) * t * mid[k] + t * t * b[k]);
    const pts: number[][] = []; for (let i = 0; i <= n; i++) pts.push(at(i / n));
    for (let i = 0; i < n; i++) K.strut(acc, pts[i], pts[i + 1], r0 + (r1 - r0) * (i / n), r0 + (r1 - r0) * ((i + 1) / n), sides, s0 + (s1 - s0) * (i / n), s0 + (s1 - s0) * ((i + 1) / n), i === n - 1);
    return pts;
  };

  /** scale a set of accumulators about the pot axis so none stands more than `over` outside the box {x0, z0, x1, z1, top, bottom?}, each side on its own (the baseline's boxes are
   *  not symmetric); never grows anything, never moves the pot (it is not passed in), and no vertex ends below `floorY` (a drooping leaf never sinks through the surface it stands on) */
  function fit(accs: any[], box: Box, rim: number, over = 0.03, floorY: number | null = 0.002) {
    let mxp = 0, mxn = 0, mzp = 0, mzn = 0, my = -Infinity;
    for (const a of accs) { const P = a.pos; for (let i = 0; i < P.length; i += 3) { mxp = Math.max(mxp, P[i]); mxn = Math.max(mxn, -P[i]); mzp = Math.max(mzp, P[i + 2]); mzn = Math.max(mzn, -P[i + 2]); my = Math.max(my, P[i + 1]); } }
    const f = (m: number, lim: number) => (m > lim + over ? (lim + over) / m : 1);
    const fxp = f(mxp, box.x1), fxn = f(mxn, -box.x0), fzp = f(mzp, box.z1), fzn = f(mzn, -box.z0), fy = my > box.top + over ? (box.top + over - rim) / (my - rim) : 1;
    for (const a of accs) {
      const P = a.pos;
      for (let i = 0; i < P.length; i += 3) {
        P[i] *= P[i] >= 0 ? fxp : fxn; P[i + 2] *= P[i + 2] >= 0 ? fzp : fzn;
        if (fy < 1 && P[i + 1] > rim) P[i + 1] = rim + (P[i + 1] - rim) * fy;
        if (floorY !== null && P[i + 1] < floorY) P[i + 1] = floorY;
      }
    }
    return { fxp, fxn, fzp, fzn, fy };
  }

  /** the finished plant group: pot (house pot colour), leaves (a green), optional cane (bark) and bloom (a colour) */
  function finish(g: any, o: { pot: any; potCol: number; leaf: any; leafCol: number; cane?: any; caneCol?: number; caneExtra?: any; bloom?: any; bloomCol?: number; leafRough?: number }) {
    put(g, o.pot, softMat(ctx, o.potCol, { roughness: 0.62 }), 'pot');
    if (o.cane && o.cane.tris) put(g, o.cane, softMat(ctx, o.caneCol ?? BARK, { roughness: 0.85, ...(o.caneExtra || {}) }), 'cane', { receive: !!o.caneExtra });
    put(g, o.leaf, softMat(ctx, o.leafCol, { roughness: o.leafRough ?? 0.42 }), 'leaf', { receive: false });
    if (o.bloom && o.bloom.tris) put(g, o.bloom, softMat(ctx, o.bloomCol ?? 0xf6f4ee, { roughness: 0.5 }), 'bloom', { receive: false });
    return g;
  }
  return { K, jit, pot, POTS, leaf, stalk, arc, fit, finish, rng, colors, hex };
}

export const potColor = (it: any, colors: any, rng: () => number, hex: any) => (it.color ? hex(it.color) : rng() < 0.5 ? colors.accent : TERRACOTTA);
export { TERRACOTTA, BARK, STEM_BROWN, clamp, smooth, splitRng };
