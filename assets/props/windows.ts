// Window treatments (PLAN 5.3 T10, SOFT): roman-blind, roller-shade, cafe-curtain, shutters and a valance — the things a window wears besides the curtains. New, DORMANT types (no
// committed house places them; the dress phase will, through their own roles `blind`, `blind-cafe`, `shutter`, `valance`). Every one is built the way the curtain is:
// the origin at the floor under the window's centre, the wall at z = 0 and the room toward +z, `w` the width, `h` the height of the head (the rail or rod) above the floor,
// `color` the fabric (or the shutters' paint); 2-3 opaque meshes (fabric, hardware), no map, a neutral vertex shade for the folds, nothing in front of the glass but cloth or slats.
import { softkit, softMat, put, smooth, clamp } from './softkit.js';

/** how far down a treatment hangs: the old curtain's rod stands at h, a blind covers up to 1.4 m below its head, never below 0.5 m from the floor */
const dropOf = (h: number, d = 1.4) => Math.min(d, Math.max(0.3, h - 0.5));

export function romanBlind(it: any, ctx: any) {
  const { THREE, group, colors, hex } = ctx, K = softkit(THREE), g = group('Roman Blind');
  const w = it.w || 1.0, h = it.h || 2.1, D = dropOf(h), nf = Math.max(4, Math.round(D / 0.22)), fab = new K.Acc(), rail = new K.Acc();
  K.slab(rail, 0, h + 0.012, 0.025, w + 0.03, 0.03, 0.05, 0.95);                                    // the head rail, a hair wider than the cloth
  const rows = Array.from({ length: nf * 4 + 1 }, (_, i) => i / (nf * 4));
  K.sheet(fab, {
    U: [0, 0.5, 1], Vn: rows, th: 0.012, want: [0, 0, 1], rimK: 0.5,
    pos: (u: number, v: number) => {
      const f = (v * nf) % 1, fold = Math.pow(Math.sin(Math.PI * (v >= 0.999 ? 0 : f)), 1.15), sag = Math.sin(Math.PI * u) * 0.006;
      return [(u - 0.5) * (w - 0.02), h - 0.02 - D * v, 0.034 + 0.036 * fold * (1 - 0.25 * v) + sag * fold];
    },
    shade: (u: number, v: number) => { const f = (v * nf) % 1; return clamp(0.8 + 0.2 * Math.sin(Math.PI * f) * (0.9 + 0.1 * Math.sin(u * 3)), 0.55, 1); },
  });
  put(g, fab, softMat(ctx, it.color ? hex(it.color) : colors.fabric2, { roughness: 0.95 }), 'blind');
  put(g, rail, softMat(ctx, colors.wood, { roughness: 0.55 }), 'rail', { receive: false });
  return g;
}

export function rollerShade(it: any, ctx: any) {
  const { THREE, std, group, colors, hex } = ctx, K = softkit(THREE), g = group('Roller Shade');
  const w = it.w || 1.0, h = it.h || 2.1, D = dropOf(h, 1.5), fab = new K.Acc(), hard = new K.Acc();
  K.strut(fab, [-(w / 2 - 0.01), h, 0.04], [w / 2 - 0.01, h, 0.04], 0.026, 0.026, 12, 0.9, 0.9, true);          // the rolled-up fabric on its tube
  const cols = Math.max(2, Math.round(w / 0.4)), U = Array.from({ length: cols + 1 }, (_, i) => i / cols);
  K.sheet(fab, {
    U, Vn: [0, 0.25, 0.6, 0.9, 1], th: 0.01, want: [0, 0, 1], rimK: 0.5,
    pos: (u: number, v: number) => [(u - 0.5) * (w - 0.04), h - 0.02 - D * v, 0.052 + 0.004 * Math.sin(u * Math.PI * 3 + v * 4) * v],
    shade: (_u: number, v: number) => 0.97 - 0.07 * smooth(0, 1, v),
  });
  K.strut(hard, [-(w / 2 - 0.02), h - 0.02 - D - 0.012, 0.058], [w / 2 - 0.02, h - 0.02 - D - 0.012, 0.058], 0.013, 0.013, 8, 0.9, 0.9, true);   // the hem bar
  for (const s of [-1, 1]) K.slab(hard, s * (w / 2 + 0.004), h, 0.03, 0.012, 0.05, 0.06, 0.9);                       // end brackets
  put(g, fab, softMat(ctx, it.color ? hex(it.color) : colors.linen, { roughness: 0.95 }), 'blind');
  put(g, hard, std(colors.metal, { metalness: 0.7, roughness: 0.35, vertexColors: true }), 'hardware', { receive: false });
  return g;
}

export function cafeCurtain(it: any, ctx: any) {
  const { THREE, std, group, colors, hex } = ctx, K = softkit(THREE), g = group('Cafe Curtain');
  const w = it.w || 0.9, h = it.h || 1.6, D = Math.min(0.75, Math.max(0.3, h - 0.5)), fab = new K.Acc(), hard = new K.Acc();
  const n = Math.min(14, Math.max(3, Math.round(w / 0.11))), A = 0.022, zc = 0.07;   // (the pleat pitch widens on a wide panel: at most 14 pleats)
  K.strut(hard, [-(w / 2 + 0.02), h, 0.045], [w / 2 + 0.02, h, 0.045], 0.011, 0.011, 8, 1, 1, true);                // the rod
  for (const s of [-1, 1]) { K.strut(hard, [s * (w / 2 + 0.02), h, 0.045], [s * (w / 2 + 0.05), h, 0.045], 0.019, 0.019, 8, 1, 1, true); K.strut(hard, [s * (w / 2 - 0.1), h, 0], [s * (w / 2 - 0.1), h, 0.045], 0.008, 0.008, 6, 1, 1, true); }   // finials and brackets
  K.sheet(fab, {
    U: Array.from({ length: n * 3 + 1 }, (_, i) => i / (n * 3)), Vn: [0, 0.45, 1], th: 0.01, want: [0, 0, 1], rimK: 0.5,
    pos: (u: number, v: number) => [(u - 0.5) * w, h - 0.015 - D * (1 - v), zc + A * (0.55 + 0.45 * (1 - v)) * Math.cos(Math.PI * 2 * n * u)],
    shade: (u: number, v: number) => clamp(0.84 + 0.16 * (0.5 + 0.5 * Math.cos(Math.PI * 2 * n * u)), 0.6, 1) * (0.96 + 0.04 * v),
  });
  put(g, fab, softMat(ctx, it.color ? hex(it.color) : colors.fabric2, { roughness: 0.95 }), 'blind');
  put(g, hard, std(colors.metal, { metalness: 0.8, roughness: 0.3, vertexColors: true }), 'hardware', { receive: false });
  return g;
}

export function shutters(it: any, ctx: any) {
  const { THREE, group, colors, hex } = ctx, K = softkit(THREE), g = group('Shutters');
  const w = it.w || 1.0, h = it.h || 2.1, D = dropOf(h, 1.3), y0 = h - D, leaves = w > 0.9 ? 2 : 1, lw = (w - 0.02) / leaves, wood = new K.Acc();
  const stile = 0.05, t = 0.03, zc = 0.045, slab = (x: number, y: number, z: number, sw: number, sh: number, sd: number) => K.slab(wood, x, y, z, sw, sh, sd, 0.95);
  for (let l = 0; l < leaves; l++) {
    const cx = -w / 2 + 0.01 + lw * (l + 0.5);
    slab(cx - lw / 2 + stile / 2, y0 + D / 2, zc, stile, D, t); slab(cx + lw / 2 - stile / 2, y0 + D / 2, zc, stile, D, t);      // stiles
    slab(cx, y0 + 0.035, zc, lw - 2 * stile, 0.07, t); slab(cx, h - 0.035, zc, lw - 2 * stile, 0.07, t);                      // bottom and top rails
    const pitch = 0.047, nl = Math.max(4, Math.floor((D - 0.16) / pitch));
    for (let k = 0; k < nl; k++) {   // louvres: a slat tilted 0.7 rad, its front edge down
      const y = y0 + 0.09 + (k + 0.5) * ((D - 0.18) / nl), xf = new THREE.Matrix4().makeTranslation(cx, y, zc).multiply(new THREE.Matrix4().makeRotationX(0.7));
      K.shell(wood, { w: lw - 2 * stile + 0.01, h: 0.012, d: 0.056, r: 0.0005, kx: [-(lw - 2 * stile + 0.01) / 2, (lw - 2 * stile + 0.01) / 2], ky: [-0.006, 0.006], kz: [-0.028, 0.028], xf, shade: (_x: number, _y: number, _z: number, _nx: number, ny: number) => (ny > 0.5 ? 1 : 0.82) });
    }
  }
  put(g, wood, softMat(ctx, it.color ? hex(it.color) : colors.linen, { roughness: 0.6 }), 'shutter');
  return g;
}

export function valance(it: any, ctx: any) {
  const { THREE, group, colors, hex } = ctx, K = softkit(THREE), g = group('Valance');
  const w = it.w || 1.4, h = it.h || 2.3, H = 0.26, fab = new K.Acc(), swags = Math.max(2, Math.round(w / 0.45)), n = Math.min(14, Math.max(4, Math.round(w / 0.12)));
  K.sheet(fab, {
    U: Array.from({ length: n * 3 + 1 }, (_, i) => i / (n * 3)), Vn: [0, 0.35, 0.7, 1], th: 0.012, want: [0, 0, 1], rimK: 0.5,
    pos: (u: number, v: number) => {
      const swag = 0.5 - 0.5 * Math.cos(Math.PI * 2 * swags * u), hem = 1 - 0.38 * swag * smooth(0.55, 1, v);
      return [(u - 0.5) * w, h - 0.01 - H * v * hem, 0.045 + 0.016 * Math.cos(Math.PI * 2 * n * u) * (0.6 + 0.4 * v) + 0.02 * v * (1 - swag)];
    },
    shade: (u: number, v: number) => clamp(0.84 + 0.16 * (0.5 + 0.5 * Math.cos(Math.PI * 2 * n * u)), 0.6, 1) * (1 - 0.08 * v),
  });
  const rail = new K.Acc(); K.slab(rail, 0, h + 0.01, 0.035, w + 0.04, 0.03, 0.07, 0.95);
  put(g, fab, softMat(ctx, it.color ? hex(it.color) : colors.fabric2, { roughness: 0.95 }), 'valance');
  put(g, rail, softMat(ctx, colors.wood, { roughness: 0.55 }), 'rail', { receive: false });
  return g;
}
