// softseat — upholstered seating built on the softkit grammar (PLAN 5.3 T4 sofas, T8 armchairs; SOFT stream).
//
// A sofa, loveseat, sectional or armchair is four meshes: the upholstered SHELL (base, back, arms, the skirt of a slipcover) in the house's
// fabric, the loose CUSHIONS in the same fabric lifted 12%, one accent mesh for the pillows or bolsters, and the legs (wood or metal). Every
// part is a rounded `shell` with puffed, seamed cushions; nothing has a map, the vertex colour is a neutral shade multiplier, and every mesh is
// opaque. The envelope of each type is the one the old box-built prop had (assets/props/measured.ts, check-prop-drift 0.01 m rigid): the shell
// is exactly the old base block, and what stands above it (the back cushions, a pillow) is sized to the old top.
import { softkit, softMat, put, smooth, clamp } from './softkit.js';

/** knots for a rounded-box axis: the two ends, the two rounding knots, and `n` equal segments between the rounding knots */
export const knots = (H: number, rr: number, n = 1) => {
  const a = -H + rr, b = H - rr, k = [-H, a];
  for (let i = 1; i < n; i++) k.push(a + ((b - a) * i) / n);
  k.push(b, H);
  return k;
};

export function seatKit(THREE: any) {
  const K = softkit(THREE);
  const rot = (rx = 0, ry = 0, rz = 0) => new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(rx, ry, rz, 'YXZ'));
  const move = (x: number, y: number, z: number) => new THREE.Matrix4().makeTranslation(x, y, z);

  /** a rounded box with sensible knots: seg = [nx, ny, nz] interior segments; puff crowns the top; lean (about x, at the box's centre) and yaw/roll tilt it */
  function rbox(acc: any, o: any) {
    const { cx = 0, cy = 0, cz = 0, w, h, d, r = 0.03, seg = [1, 1, 1], faces = ['py', 'px', 'nx', 'pz', 'nz'], puff = 0, wave = null, shade = null, lean = 0, yaw = 0, roll = 0 } = o;
    const rr = Math.min(r, w * 0.45, h * 0.45, d * 0.45);
    const xf = lean || yaw || roll ? move(cx, cy, cz).multiply(rot(lean, yaw, roll)) : null;
    K.shell(acc, { cx: xf ? 0 : cx, cy: xf ? 0 : cy, cz: xf ? 0 : cz, w, h, d, r: rr, faces, puff, wave, shade, xf, kx: knots(w / 2, rr, seg[0]), ky: knots(h / 2, rr, seg[1]), kz: knots(d / 2, rr, seg[2]) });
  }

  /** a seat cushion: a puffed, rounded block between y0 and y1 (its crown stands at y1), a seam all round and a faint dimple in the middle */
  function seatCushion(acc: any, o: any) {
    const { x, z, w, d, y0, y1, r = 0.045, puff = 0.02, flat = false } = o, h = y1 - y0 - (flat ? 0 : puff);
    rbox(acc, { cx: x, cy: y0 + h / 2, cz: z, w, h, d, r, seg: [Math.max(1, Math.round(w / 0.4)), 1, 2], puff: flat ? 0 : puff,
      wave: (px: number, py: number, pz: number, nx: number, ny: number, nz: number) => [0, 0, nz > 0.5 ? 0.008 * Math.max(0, 1 - (px / (w / 2)) ** 2) * Math.max(0, 1 - ((py) / (h / 2)) ** 2) : 0],
      shade: (px: number, py: number, pz: number, nx: number, ny: number, nz: number) => (ny > 0.5 ? 0.98 - 0.08 * Math.exp(-(px * px) / (w * w * 0.03)) * 0 - 0.06 * smooth(0.7, 1, Math.max(Math.abs(px) / (w / 2), Math.abs(pz) / (d / 2))) : 0.9 - 0.06 * (1 - smooth(-h / 2, h / 2, py))) });
  }

  /** a back cushion: leaning back about its foot, a puffed front, its crown dipping a little between the corners */
  function backCushion(acc: any, o: any) {
    const { x, z, w, t = 0.13, y0, lean = -0.1, r = 0.05 } = o;
    const h = o.top !== undefined ? (o.top - y0) / (0.5 + 0.5 * Math.cos(lean)) : o.h;   // `top`: the y its crown reaches (the old box's top), the crown at its highest corners
    rbox(acc, { cx: x, cy: y0 + h / 2, cz: z, w, h, d: t, r, seg: [Math.max(1, Math.round(w / 0.4)), 1, 1], lean, faces: ['py', 'px', 'nx', 'pz', 'nz'],
      wave: (px: number, py: number, pz: number, nx: number, ny: number, nz: number) => [0, ny > 0.5 ? -0.012 * Math.exp(-(px * px) / (w * w * 0.08)) : 0, nz > 0.5 ? 0.02 * Math.max(0, 1 - (px / (w / 2)) ** 2) * Math.max(0, 1 - (py / (h / 2)) ** 2) : 0],
      shade: (px: number, py: number, pz: number, nx: number, ny: number, nz: number) => (nz > 0.5 ? 0.93 + 0.07 * Math.max(0, 1 - (px / (w / 2)) ** 2) * Math.max(0, 1 - (py / (h / 2)) ** 2) : ny > 0.5 ? 0.94 : 0.84) });
  }

  /** an arm: a rounded block from y0 to y1 and z0..z1; `round` rolls the top into a half-cylinder (a rolled arm), `flare` leans the outer face a few degrees out */
  function arm(acc: any, o: any) {
    const { x, z0, z1, w, y0, y1, round = false, r = 0.03, seg = [round ? 2 : 1, 2, 2] } = o, d = z1 - z0, h = y1 - y0;
    rbox(acc, { cx: x, cy: y0 + h / 2, cz: (z0 + z1) / 2, w, h, d, r: round ? w * 0.48 : r, seg, faces: ['py', 'px', 'nx', 'pz', 'nz'],
      shade: (px: number, py: number, pz: number, nx: number, ny: number, nz: number) => (ny > 0.4 ? 0.96 : 0.88 + 0.08 * smooth(-h / 2, h / 2, py)) });
  }

  /** a bolster: a short fat roll lying along `axis` ('x' or 'z') with round ends, a gather at each end */
  function bolster(acc: any, o: any) {
    const { x, y, z, len = 0.42, R = 0.09, axis = 'z' } = o, hl = len / 2;
    const p = (t: number) => (axis === 'z' ? [x, y, z + t] : [x + t, y, z]);
    K.strut(acc, p(-hl), p(hl), R, R, 12, 0.84, 0.84, true);   // darker ends read as the gathered ends of a roll
  }

  /** a leaning throw pillow: a closed puffed shell sitting on the seat against the back */
  function throwPillow(acc: any, o: any) {
    const { x, y, z, w = 0.38, h = 0.38, t = 0.12, lean = -0.2, yaw = 0, roll = 0.08 } = o;
    rbox(acc, { cx: x, cy: y, cz: z, w, h, d: t, r: 0.05, seg: [2, 2, 1], lean, yaw, roll, faces: ['py', 'px', 'nx', 'pz', 'nz'],
      wave: (px: number, py: number, pz: number, nx: number, ny: number, nz: number) => {
        const f = Math.max(0, 1 - (px / (w / 2)) ** 2) * Math.max(0, 1 - (py / (h / 2)) ** 2);
        return [0, -0.03 * smooth(0.5, 1, Math.abs(px) / (w / 2)) * smooth(0.2, 1, py / (h / 2)), Math.sign(pz || 1) * 0.03 * f * (Math.abs(nz) > 0.3 ? 1 : 0.3)];
      },
      shade: (px: number, py: number, pz: number, nx: number, ny: number, nz: number) => 0.86 + 0.14 * Math.max(0, 1 - (px / (w / 2)) ** 2) * Math.max(0, 1 - (py / (h / 2)) ** 2) });
  }

  /** the legs of a seat: 'block' straight, 'taper' splayed and tapering, 'metal' thin straight; `pts` are [x, z] of each; `yMin` lets the foot sit a hair under the floor */
  function legs(acc: any, kind: string, pts: number[][], h: number, yMin = 0) {
    for (const [x, z] of pts) {
      if (kind === 'taper') { const sp = 0.12 * h; K.strut(acc, [x + Math.sign(x) * sp, yMin, z + Math.sign(z) * sp], [x, h, z], 0.014, 0.025, 6, 0.85, 1); }
      else if (kind === 'metal') K.strut(acc, [x, yMin, z], [x, h, z], 0.011, 0.014, 6, 0.9, 1);
      else K.strut(acc, [x, yMin, z], [x, h, z], 0.022, 0.026, 6, 0.85, 1);
    }
  }

  return { K, rbox, seatCushion, backCushion, arm, bolster, throwPillow, legs, move, rot };
}

const lift = (mix: any, c: number, t = 0.12) => mix(c, 0xffffff, t);
const quad4 = (w: number, d: number, inset: number) => [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([sx, sz]) => [sx * (w / 2 - inset), sz * (d / 2 - inset)]);

/** The sofa grammar: base, back, two arms, a seat and a back cushion per seat, a pillow or two bolsters, legs. `o` is the old sofa() option table
 *  (w d seatY backH armW armTop arm legs legH backCushions bolsters seats backD) plus `top`: the y the highest cushion reaches (the old box's top). */
export function softSofa(ctx: any, it: any, name: string, o: any, base: number) {
  const { THREE, group, colors, mix, rng } = ctx, S = seatKit(THREE), { K, rbox } = S;
  const w = it.w || o.w, d = it.d || o.d, g = group(name);
  const shellA = new K.Acc(), cushA = new K.Acc(), accA = new K.Acc(), legA = new K.Acc();
  const legH = o.legH, deckY = o.seatY - 0.12, backD = o.backD || 0.2, armW = o.armW, skirt = o.legs === 'skirt';
  const y0 = skirt ? 0.015 : legH;
  // ---- the shell: the base block over the whole footprint, the back, the arms
  rbox(shellA, { cy: (y0 + deckY) / 2, w, h: deckY - y0, d, r: 0.035, seg: [Math.max(1, Math.round(w / 0.9)), 1, 1], faces: ['py', 'px', 'nx', 'pz', 'nz'] });
  if (skirt) rbox(shellA, { cy: 0.0915, w: w + 0.01, h: 0.16, d: d + 0.01, r: 0.012, seg: [Math.max(1, Math.round(w / 0.9)), 1, 1], faces: ['px', 'nx', 'pz', 'nz'] });
  rbox(shellA, { cy: (deckY + o.backH) / 2, cz: -d / 2 + backD / 2, w, h: o.backH - deckY, d: backD, r: Math.min(0.05, backD * 0.4), seg: [Math.max(1, Math.round(w / 0.9)), 1, 1], faces: ['py', 'px', 'nx', 'pz', 'nz'] });
  const armD = o.arm === 'tux' ? d : d - backD, armZ = o.arm === 'tux' ? 0 : backD / 2, roll = o.arm === 'roll';
  // a rolled arm bulges 1.7 cm past the base block on its outside (the old roll cylinder did), so the envelope keeps its x
  const aw = roll ? armW + 0.034 : armW;
  for (const s of [-1, 1]) S.arm(shellA, { x: s * (roll ? w / 2 + 0.017 - aw / 2 : w / 2 - armW / 2), z0: armZ - armD / 2, z1: armZ + armD / 2, w: aw, y0: Math.min(y0, deckY - 0.02), y1: roll ? o.armTop + 0.02 : o.armTop, round: roll, r: o.arm === 'thin' ? 0.025 : 0.035 });
  // ---- loose cushions across the well between the arms
  const inner = w - 2 * armW - 0.02, n = o.seats || Math.max(2, Math.min(3, Math.round(inner / 0.62))), cw = inner / n - 0.015, cd = d - backD - 0.04;
  for (let i = 0; i < n; i++) {
    const cx = -inner / 2 + (inner / n) * (i + 0.5);
    S.seatCushion(cushA, { x: cx, z: backD / 2 + 0.01, w: cw, d: cd, y0: deckY, y1: o.seatY + 0.02 });
    if (o.backCushions) {
      S.backCushion(cushA, { x: cx, z: -d / 2 + backD + 0.05, w: cw, h: Math.min(0.42, o.backH - o.seatY + 0.02), top: o.top, y0: o.seatY + 0.02, lean: -0.1 });
    }
  }
  // ---- two bolsters, or one leaning pillow (the draws are the old ones, in the old order)
  if (o.bolsters) for (const s of [-1, 1]) S.bolster(accA, { x: s * (inner / 2 - 0.1), y: o.seatY + 0.11, z: backD / 2 - 0.02, axis: 'z' });
  const bolCol = o.bolsters ? [rng() < 0.5 ? colors.accent : colors.fabric2, rng() < 0.5 ? colors.accent : colors.fabric2] : null;
  let pilCol = colors.accent;
  if (!o.bolsters) {
    pilCol = rng() < 0.5 ? colors.accent : colors.fabric2;
    const side = rng() < 0.5 ? -1 : 1, py = (o.backCushions ? Math.min(o.seatY + 0.24, o.backH - 0.14) : o.top - 0.188), yaw = (rng() - 0.5) * 0.5;
    S.throwPillow(accA, { x: side * (inner / 2 - 0.24), y: py, z: -d / 2 + backD + 0.16, lean: -0.18, yaw, roll: 0.08 });
  }
  // ---- legs
  if (o.legs === 'taper') S.legs(legA, 'taper', quad4(w, d, 0.12), legH, o.footY ?? 0);
  else if (o.legs === 'metal') S.legs(legA, 'metal', quad4(w, d, 0.08), legH);
  else if (o.legs === 'block') S.legs(legA, 'block', quad4(w, d, 0.08), legH);
  put(g, shellA, softMat(ctx, base, { roughness: 0.88 }), 'upholstery');
  put(g, cushA, softMat(ctx, lift(mix, base), { roughness: 0.92 }), 'cushion');
  put(g, accA, softMat(ctx, bolCol ? bolCol[0] : pilCol, { roughness: 0.92 }), 'pillow');
  put(g, legA, o.legs === 'metal' ? softMat(ctx, colors.metal, { metalness: 0.8, roughness: 0.3 }) : softMat(ctx, colors.wood, { roughness: 0.5 }), 'legs');
  return g;
}

// =================================================================================================================
// Sectionals: a run of seats along the back and one or two chaises, built from the same parts (the old box builds' layout and envelope)
// =================================================================================================================
interface SectionalSpec { w: number; l: number; d: number; side: number; deckY: number; seatTop: number; backH: number; backD: number; legH: number; legKind: string; top: number; armW?: number; wing: number[] }

/** L- and U-sectionals: a run (width w, depth d) along the back wall of the footprint, a chaise (width d) at one end (L) or both (U), a back strip along the run,
 *  one arm (L only), a seat and back cushion per seat and a long cushion per chaise, one leaning pillow. */
export function softSectional(ctx: any, it: any, name: string, sp: SectionalSpec & { kind: 'L' | 'U' }, base: number) {
  const { THREE, group, colors, mix, rng } = ctx, S = seatKit(THREE), { K, rbox } = S;
  const { w, l, d, side, deckY, seatTop, backH, backD, legH, kind } = sp, cw = d, z0 = -l / 2, chL = l - d;
  const g = group(name), shellA = new K.Acc(), cushA = new K.Acc(), accA = new K.Acc(), legA = new K.Acc();
  const segs = (x: number) => Math.max(1, Math.round(x / 0.9));
  const chaises = kind === 'U' ? [-1, 1] : [side];
  rbox(shellA, { cy: (legH + deckY) / 2, cz: z0 + d / 2, w, h: deckY - legH, d, r: 0.03, seg: [segs(w), 1, 1] });
  // (a probe with d > l makes the chaise's length negative: the old box was mirrored, the same extent; zero-length ones had no geometry)
  if (Math.abs(chL) > 0.02) for (const s of chaises) rbox(shellA, { cx: s * (w / 2 - cw / 2), cy: (legH + deckY) / 2, cz: z0 + d + chL / 2, w: cw, h: deckY - legH, d: Math.abs(chL), r: 0.03, seg: [1, 1, segs(Math.abs(chL))] });
  rbox(shellA, { cy: (deckY + backH) / 2, cz: z0 + backD / 2, w, h: backH - deckY, d: backD, r: 0.045, seg: [segs(w), 1, 1] });
  if (kind === 'L') S.arm(shellA, { x: -side * (w / 2 - sp.armW! / 2), z0: z0 + backD, z1: z0 + d, w: sp.armW!, y0: legH, y1: 0.62, r: 0.035 });
  // seats along the run, between the arm (or the far chaise) and the chaise(s)
  const lo = kind === 'L' ? -side * (w / 2 - sp.armW! - 0.01) : -(w / 2 - cw), runIn = kind === 'L' ? w - sp.armW! - cw - 0.02 : w - 2 * cw - 0.02;
  const n = Math.max(1, Math.round(runIn / (kind === 'L' ? 0.65 : 0.7))), sw = Math.abs(runIn / n - 0.015), sdp = d - backD - 0.04;   // (|sw|: a probe with a huge d gives a negative run, and the old boxes were mirrored)
  const bcH = 0.36;
  for (let i = 0; i < n; i++) {
    const x = kind === 'L' ? lo + side * (runIn / n) * (i + 0.5) : -runIn / 2 + (runIn / n) * (i + 0.5);
    S.seatCushion(cushA, { x, z: z0 + backD + sdp / 2 + 0.02, w: sw, d: sdp, y0: deckY, y1: seatTop });
    S.backCushion(cushA, { x, z: z0 + backD + 0.05, w: sw, h: bcH, y0: seatTop, lean: -0.1 });
  }
  for (const s of chaises) {
    const x = s * (w / 2 - cw / 2);
    S.seatCushion(cushA, { x, z: z0 + backD + (l - backD) / 2, w: cw - 0.03, d: l - backD - 0.03, y0: deckY, y1: seatTop });
    S.backCushion(cushA, { x, z: z0 + backD + 0.05, w: cw - 0.03, h: bcH, y0: seatTop, lean: -0.1 });
  }
  const pCol = rng() < 0.5 ? colors.accent : colors.fabric2, pyaw = (rng() - 0.5) * 0.5;
  const px = kind === 'L' ? (side * (w / 2 - cw / 2) - side * 0.12) : -w / 2 + cw / 2 + 0.1;
  S.throwPillow(accA, { x: px, y: sp.top - 0.194, z: z0 + backD + (kind === 'L' ? 0.18 : 0.2), w: 0.4, h: 0.4, t: 0.11, lean: -0.18, yaw: pyaw, roll: 0.08 });
  const legPts = kind === 'L'
    ? [[-w / 2 + 0.08, z0 + 0.08], [w / 2 - 0.08, z0 + 0.08], [-side * (w / 2 - 0.08), z0 + d - 0.08], [side * (w / 2 - 0.08), l / 2 - 0.08], [side * (w / 2 - cw + 0.08), l / 2 - 0.08], [side * (w / 2 - cw + 0.08), z0 + d - 0.08]]
    : [[-w / 2 + 0.08, z0 + 0.08], [w / 2 - 0.08, z0 + 0.08], [-w / 2 + 0.08, l / 2 - 0.08], [w / 2 - 0.08, l / 2 - 0.08], [-w / 2 + cw - 0.08, l / 2 - 0.08], [w / 2 - cw + 0.08, l / 2 - 0.08], [-w / 2 + cw - 0.08, z0 + d - 0.08], [w / 2 - cw + 0.08, z0 + d - 0.08]];
  S.legs(legA, 'metal', legPts, legH);
  put(g, shellA, softMat(ctx, base, { roughness: 0.88 }), 'upholstery');
  put(g, cushA, softMat(ctx, lift(mix, base), { roughness: 0.92 }), 'cushion');
  put(g, accA, softMat(ctx, pCol, { roughness: 0.92 }), 'pillow');
  put(g, legA, softMat(ctx, colors.metal, { metalness: 0.8, roughness: 0.3 }), 'legs');
  return g;
}

/** The modular sectional: an L of armless modules, each a low block with a hairline gap, a thin pad and a low back, on its own tapered legs. */
export function softModular(ctx: any, it: any, name: string, base: number) {
  const { THREE, group, colors, mix, rng } = ctx, S = seatKit(THREE), { K, rbox } = S;
  const w = it.w || 2.5, l = it.l || 1.65, d = it.d || 0.92, side = it.hand === 'right' ? -1 : 1, g = group(name);
  const shellA = new K.Acc(), cushA = new K.Acc(), accA = new K.Acc(), legA = new K.Acc();
  const legH = 0.13, seatTop = 0.42, backTop = 0.7, backD = 0.16, gap = 0.012, z0 = -l / 2;
  const mod = (mw: number, md: number, x: number, z: number, back: boolean) => {
    const sgn = md, ad = Math.abs(md);   // (a probe with d near or over l gives the chaise a zero or negative length: the old box was mirrored or empty, but its legs stood where they stood)
    const by0 = legH, by1 = seatTop - 0.05;
    if (ad >= 0.04) {
      rbox(shellA, { cx: x, cy: (by0 + by1) / 2, cz: z, w: mw - gap, h: by1 - by0, d: ad - gap, r: 0.03, seg: [Math.max(1, Math.round(mw / 0.9)), 1, 1] });
      S.seatCushion(cushA, { x, z: z + (back ? backD / 2 : 0), w: mw - gap - 0.02, d: ad - gap - 0.02 - (back ? backD : 0), y0: by1, y1: seatTop, r: 0.025, puff: 0.012 });
      if (back) rbox(shellA, { cx: x, cy: (by1 + backTop) / 2, cz: z - ad / 2 + backD / 2, w: mw - gap, h: backTop - by1, d: backD, r: 0.04, seg: [Math.max(1, Math.round(mw / 0.9)), 1, 1] });
    }
    S.legs(legA, 'taper', [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([sx, sz]) => [x + sx * (mw / 2 - 0.1), z + sz * (sgn / 2 - 0.1)]), legH, -0.004);
  };
  const cw = d, n = Math.max(2, Math.round((w - cw) / 0.85)), mw = (w - cw) / n;
  for (let i = 0; i < n; i++) mod(mw, d, -side * (w / 2) + side * (mw * (i + 0.5)), z0 + d / 2, true);
  mod(cw, d, side * (w / 2 - cw / 2), z0 + d / 2, true);
  mod(cw, l - d, side * (w / 2 - cw / 2), z0 + d + (l - d) / 2, false);
  const pCol = rng() < 0.5 ? colors.accent : colors.fabric2, pyaw = (rng() - 0.5) * 0.4;
  S.throwPillow(accA, { x: -side * (w / 2 - 0.5), y: 0.654, z: z0 + backD + 0.12, w: 0.42, h: 0.42, t: 0.1, lean: -0.2, yaw: pyaw, roll: 0.1 });
  put(g, shellA, softMat(ctx, base, { roughness: 0.9 }), 'upholstery');
  put(g, cushA, softMat(ctx, lift(mix, base, 0.1), { roughness: 0.92 }), 'cushion');
  put(g, accA, softMat(ctx, pCol, { roughness: 0.92 }), 'pillow');
  put(g, legA, softMat(ctx, colors.wood, { roughness: 0.5 }), 'legs');
  return g;
}

// =================================================================================================================
// Armchairs (T8): wingback, slipper, mission, barrel, rattan, rocking. Same parts as the sofas, 3-4 meshes, 900 triangles at most. None of them draws the rng.
// =================================================================================================================
const finish = (ctx: any, g: any, parts: Array<[any, number, string, any?]>) => { for (const [acc, col, role, extra] of parts) put(g, acc, softMat(ctx, col, { roughness: 0.9, ...(extra || {}) }), role); return g; };

/** Wingback: a tall upholstered back with two wings wrapping forward, rolled arms, a loose seat cushion and back pad, four turned legs. */
export function softWingback(ctx: any, it: any, base: number) {
  const { THREE, group, colors, mix } = ctx, S = seatKit(THREE), { K, rbox } = S;
  const w = 0.8, d = 0.85, bt = 0.16, legH = 0.12, seatY = 0.38, zi = bt / 2, g = group('Wingback Armchair');
  const sh = new K.Acc(), cu = new K.Acc(), lg = new K.Acc();
  rbox(sh, { cy: (legH + seatY) / 2, cz: zi, w, h: seatY - legH, d: d - bt, r: 0.03, seg: [1, 1, 1] });                                 // plinth
  rbox(sh, { cy: (seatY + 1.1) / 2, cz: -d / 2 + bt / 2, w, h: 1.1 - seatY, d: bt, r: 0.05, seg: [2, 1, 1] });                          // the tall back, a crowned top
  for (const s of [-1, 1]) {
    rbox(sh, { cx: s * (w / 2 - 0.06), cy: 0.85, cz: -d / 2 + bt + 0.15 * Math.cos(0.18), w: 0.08, h: 0.5, d: 0.3, r: 0.03, seg: [1, 1, 1], yaw: -s * 0.18 });   // a wing, hinged at the back, wrapping in
    S.arm(sh, { x: s * (w / 2 - 0.07), z0: zi - (d - bt) / 2, z1: zi + (d - bt) / 2, w: 0.14, y0: legH, y1: seatY + 0.26 + 0.07, round: true, seg: [1, 1, 2] });   // a rolled arm
  }
  S.seatCushion(cu, { x: 0, z: zi + 0.01, w: w - 0.3, d: d - bt - 0.04, y0: seatY, y1: seatY + 0.12, r: 0.045, puff: 0.02 });
  S.backCushion(cu, { x: 0, z: -d / 2 + bt + 0.04, w: w - 0.3, h: 0.4, t: 0.09, y0: seatY + 0.12, lean: -0.08 });
  S.legs(lg, 'block', [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([sx, sz]) => [sx * (w / 2 - 0.08), zi + sz * ((d - bt) / 2 - 0.08)]), legH);
  return finish(ctx, g, [[sh, base, 'upholstery'], [cu, mix(base, 0xffffff, 0.12), 'cushion'], [lg, colors.wood, 'legs', { roughness: 0.5 }]]);
}

/** Slipper chair: armless, a body block with a tall raked back, a seat pad, four short splayed legs. */
export function softSlipper(ctx: any, it: any, base: number) {
  const { THREE, group, colors, mix } = ctx, S = seatKit(THREE), { K, rbox } = S;
  const w = 0.62, d = 0.72, g = group('Slipper Chair'), sh = new K.Acc(), cu = new K.Acc(), lg = new K.Acc();
  S.legs(lg, 'taper', [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([sx, sz]) => [sx * (w / 2 - 0.08), sz * (d / 2 - 0.08)]), 0.15, -0.004);
  rbox(sh, { cy: 0.25, w, h: 0.2, d, r: 0.04, seg: [1, 1, 1] });
  rbox(sh, { cx: 0, cy: 0.35 + 0.2574, cz: -d / 2 + 0.07 - 0.0363, w, h: 0.53, d: 0.14, r: 0.05, seg: [2, 1, 1], lean: -0.14, faces: ['py', 'px', 'nx', 'pz', 'nz'] });   // the raked back: pivot at its foot
  S.seatCushion(cu, { x: 0, z: 0.05, w: w - 0.04, d: d - 0.14, y0: 0.35, y1: 0.43, r: 0.035, puff: 0.014 });
  return finish(ctx, g, [[sh, base, 'upholstery'], [cu, mix(base, 0xffffff, 0.1), 'cushion'], [lg, colors.wood, 'legs', { roughness: 0.5 }]]);
}

/** Mission armchair: an oak frame (posts, flat arms, side rails and slats, seat frame, back slats, a crest rail) in ONE timber mesh, a seat cushion and a back pad. */
export function softMission(ctx: any, it: any, base: number) {
  const { THREE, group, colors, mix } = ctx, S = seatKit(THREE), { K } = S;
  const w = 0.78, d = 0.84, g = group('Mission Armchair'), wd = new K.Acc(), cu = new K.Acc(), fa = new K.Acc();
  const post = 0.05, armY = 0.62, slab = (x: number, y: number, z: number, sw: number, sh: number, sd: number) => K.slab(wd, x, y, z, sw, sh, sd, 0.95);
  for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) { const hh = sz < 0 ? 0.95 : armY; slab(sx * (w / 2 - post / 2), hh / 2, sz * (d / 2 - post / 2), post, hh, post); }
  for (const s of [-1, 1]) {
    slab(s * (w / 2 - 0.03), armY + 0.015, 0.02, 0.11, 0.03, d + 0.04);                          // the flat arm
    slab(s * (w / 2 - post / 2), 0.22, 0, 0.03, 0.05, d - 2 * post);                              // a low side rail
    for (let k = 0; k < 3; k++) slab(s * (w / 2 - post / 2), 0.25 + (armY - 0.25) / 2, -0.2 + k * 0.2, 0.012, armY - 0.25, 0.05);   // side slats
  }
  slab(0, 0.33, 0, w - 2 * post, 0.05, d - 2 * post);                                             // the seat frame
  for (let k = 0; k < 5; k++) slab(-0.24 + k * 0.12, 0.62, -d / 2 + post / 2, 0.05, 0.48, 0.012);   // back slats
  slab(0, 0.91, -d / 2 + post / 2, w - 2 * post, 0.07, 0.03);                                     // the crest rail
  S.seatCushion(cu, { x: 0, z: 0.03, w: w - 2 * post - 0.02, d: d - 2 * post - 0.06, y0: 0.355, y1: 0.475, r: 0.04, puff: 0.02 });
  S.backCushion(fa, { x: 0, z: -d / 2 + post + 0.07, w: w - 2 * post - 0.04, h: 0.44, t: 0.1, y0: 0.475, lean: -0.12 });
  return finish(ctx, g, [[wd, colors.wood, 'frame', { roughness: 0.55 }], [cu, base, 'cushion'], [fa, mix(base, 0xffffff, 0.08), 'backpad']]);
}

/** Barrel chair: a plinth, a round seat drum, a domed seat pad and a 240-degree wrap round the back — outer wall, inner wall, a rolled top — as closed surfaces. */
export function softBarrel(ctx: any, it: any, base: number) {
  const { THREE, group, colors, mix } = ctx, S = seatKit(THREE), { K } = S;
  const R = 0.39, g = group('Barrel Chair'), sh = new K.Acc(), cu = new K.Acc(), pl = new K.Acc();
  K.lathe(pl, [[0.001, 0, 0.7], [R - 0.06, 0, 0.8], [R - 0.04, 0.08, 1], [0.001, 0.08, 1]], 28);
  K.lathe(sh, [[0.001, 0.08, 0.8], [R - 0.02, 0.08, 0.85], [R - 0.02, 0.2, 1], [R - 0.02, 0.38, 1], [R - 0.05, 0.4, 0.95], [0.001, 0.4, 0.9]], 28);                       // the seat drum
  K.lathe(cu, [[0.001, 0.36, 0.9], [R - 0.1, 0.38, 0.92], [R - 0.08, 0.43, 1], [R - 0.14, 0.475, 1], [0.15, 0.49, 1], [0.001, 0.485, 0.95]], 28, 0, 1, (x: number, y: number, z: number) => [x, y, z + 0.03]);   // a domed pad
  // the wrap: a grid over (angle, height) for the outer wall, the inner wall one wall-thickness in, and a rolled top joining them, plus the two end faces
  const arc = Math.PI * 4 / 3, a0 = Math.PI - arc / 2, N = 16, wallT = 0.08, ho = [0.26, 0.5, 0.76], hi = [0.4, 0.58, 0.76];
  const ring = (r: number, hs: number[], sK: number) => hs.map(y => Array.from({ length: N + 1 }, (_, i) => { const a = a0 + (arc * i) / N; return sh.v(Math.sin(a) * r, y, Math.cos(a) * r, sK * (0.9 + 0.1 * Math.cos(a * 5))); }));
  const outer = ring(R, ho, 1), inner = ring(R - wallT, hi, 0.82);
  const ids = (rows: number[][]) => rows.flat();
  sh.grid(ids(outer), N, 2, [0, 0, -1]);                                  // outer wall: the arc is centred on −z, so its mean outward normal is −z
  sh.grid(ids(inner), N, 2, [0, 0, 1]);                                   // inner wall faces the sitter
  sh.grid(ids([inner[2], outer[2]]), N, 1, [0, 1, 0]);                    // the top rim
  for (const [i, sgn] of [[0, -1], [N, 1]] as Array<[number, number]>) {   // the two ends of the wrap
    const a = a0 + (arc * i) / N, t = [Math.cos(a) * sgn, 0, -Math.sin(a) * sgn];
    sh.grid([outer[0][i], inner[0][i], outer[1][i], inner[1][i], outer[2][i], inner[2][i]], 1, 2, t);
  }
  return finish(ctx, g, [[sh, base, 'upholstery', { side: THREE.DoubleSide }], [cu, mix(base, 0xffffff, 0.1), 'cushion'], [pl, colors.wood, 'plinth', { roughness: 0.5 }]]);
}

/** Rattan armchair: a woven bowl — a 220-degree wrap of cane round the back and arms with a rolled rim, a seat drum, short legs — the weave a neutral shade pattern, a linen seat cushion. */
export function softRattan(ctx: any, it: any, base: number) {
  const { THREE, group, colors, mix } = ctx, S = seatKit(THREE), { K, rbox } = S;
  const R = 0.38, g = group('Rattan Armchair'), cane = new K.Acc(), cu = new K.Acc();
  const caneC = mix(colors.wood, 0xc9a26b, 0.5);
  S.legs(cane, 'block', [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([sx, sz]) => [sx * 0.26, sz * 0.26]), 0.12);
  const weave = (a: number, y: number) => 0.84 + 0.16 * (0.5 + 0.5 * Math.sin(a * 22 + y * 60)) * (0.5 + 0.5 * Math.cos(a * 22 - y * 60));
  K.lathe(cane, [[0.001, 0.12, 0.8], [R - 0.04, 0.12, 0.88], [R - 0.04, 0.2, 1], [0.001, 0.2, 0.94]], 24, 0, 1, null, (ph: number, j: number) => weave(ph, j * 0.05));
  const arc = Math.PI * 11 / 9, a0 = Math.PI - arc / 2, N = 14, rows = [0.2, 0.45, 0.7], Rt = [R - 0.02, R, R - 0.005];
  const outer = rows.map((y, j) => Array.from({ length: N + 1 }, (_, i) => { const a = a0 + (arc * i) / N; return cane.v(Math.sin(a) * Rt[j], y, Math.cos(a) * Rt[j], weave(a, y)); }));
  const inner = rows.map((y, j) => Array.from({ length: N + 1 }, (_, i) => { const a = a0 + (arc * i) / N; return cane.v(Math.sin(a) * (Rt[j] - 0.035), y + 0.0, Math.cos(a) * (Rt[j] - 0.035), 0.8 * weave(a, y + 0.3)); }));
  cane.grid(outer.flat(), N, 2, [0, 0, -1]); cane.grid(inner.flat(), N, 2, [0, 0, 1]);
  cane.grid([inner[2], outer[2]].flat(), N, 1, [0, 1, 0]);                     // the rim: a flat band over the top (the rolled tube below sits on it)
  // the rolled rim: a tube along the top edge of the wrap (struts between the arc's top points)
  for (let i = 0; i < N; i++) { const a = a0 + (arc * i) / N, b = a0 + (arc * (i + 1)) / N, r2 = R - 0.03; K.strut(cane, [Math.sin(a) * r2, 0.67, Math.cos(a) * r2], [Math.sin(b) * r2, 0.67, Math.cos(b) * r2], 0.03, 0.03, 6, 0.95, 0.95, false); }
  rbox(cu, { cy: 0.25, cz: 0.04, w: 0.56, h: 0.1, d: 0.5, r: 0.04, seg: [2, 1, 2], puff: 0.012, faces: ['py', 'px', 'nx', 'pz', 'nz'] });
  return finish(ctx, g, [[cane, caneC, 'cane', { roughness: 0.8, side: THREE.DoubleSide }], [cu, it.color ? ctx.hex(it.color) : colors.linen, 'cushion', { roughness: 0.95 }]]);
}

/** Rocking chair: two curved rockers, four posts, a seat, spindle back with a top rail, flat arms and front arm posts — one timber mesh — and a thin seat cushion. */
export function softRocking(ctx: any, it: any, base: number) {
  const { THREE, group, colors } = ctx, S = seatKit(THREE), { K, rbox } = S;
  const g = group('Rocking Chair'), wd = new K.Acc(), cu = new K.Acc();
  const R = 1.0, arc = 0.95, tube = 0.018, seatY = 0.44, slab = (x: number, y: number, z: number, w: number, h: number, d: number) => K.slab(wd, x, y, z, w, h, d, 0.95);
  const NS = 10;
  for (const s of [-1, 1]) {
    // a rocker: a tube of 6 sides along an arc in the yz plane, centred under the axle (the old torus), the lowest point on the floor
    const pt = (k: number) => { const a = -arc / 2 + (arc * k) / NS; return [s * 0.27, R + tube - R * Math.cos(a), R * Math.sin(a)]; };
    for (let k = 0; k < NS; k++) K.strut(wd, pt(k), pt(k + 1), tube, tube, 6, 0.9, 0.9, k === 0 || k === NS - 1);
    for (const sz of [-1, 1]) slab(s * 0.27, 0.04 + (seatY - 0.04) / 2, sz * 0.22, 0.035, seatY - 0.04, 0.035);   // posts
  }
  slab(0, seatY - 0.025, 0, 0.6, 0.05, 0.55);                                                                      // the seat
  const lean = -0.15, cy = Math.cos(lean), sy = Math.sin(lean), bz = -0.24;                                      // the back group: pivot (0, seatY, -0.24), leaning back 0.15
  const bk = (x: number, y: number, w: number, h: number, d: number) => { const Y = seatY + y * cy - 0 * sy, Z = bz + y * sy; K.slab(wd, x, Y, Z, w, h * cy + d * Math.abs(sy), d * cy + h * Math.abs(sy), 0.95); };
  for (const s of [-1, 1]) bk(s * 0.27, 0.29, 0.04, 0.58, 0.04);                                                  // back posts
  for (let i = 0; i < 5; i++) bk(-0.18 + i * 0.09, 0.27, 0.02, 0.54, 0.02);                                         // spindles
  bk(0, 0.555, 0.6, 0.07, 0.04);                                                                                   // the top rail
  for (const s of [-1, 1]) { slab(s * 0.3, seatY + 0.26, -0.02, 0.06, 0.035, 0.5); slab(s * 0.3, seatY + 0.12, 0.2, 0.03, 0.24, 0.03); }   // arms and front arm posts
  rbox(cu, { cy: seatY + 0.025, cz: 0.02, w: 0.5, h: 0.05, d: 0.46, r: 0.02, seg: [2, 1, 2], puff: 0.012, faces: ['py', 'px', 'nx', 'pz', 'nz'] });
  return finish(ctx, g, [[wd, colors.wood, 'frame', { roughness: 0.55 }], [cu, it.color ? ctx.hex(it.color) : colors.fabric, 'cushion']]);
}
