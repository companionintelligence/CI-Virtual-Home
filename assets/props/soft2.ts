// Soft, wave two — the new soft types the grammar makes possible and the in-place rebuilds of soft goods that live in other modules
// (SOFT stream, PLAN 5.3). Imported LAST before the baked layer (assets/props/index.ts), so a type id registered here that already exists
// is replaced IN PLACE (Map.set keeps its position: the registry order, and with it every prop's seeded stream, is untouched), and a new type
// is appended after all of them. Both kinds are built from assets/props/softkit.ts: no map, one mesh per role colour, a neutral vertex shade.
//
// New types here are DORMANT: placed by nothing until the dress phase uses them. Their PLACEMENT entries (assets/props/placement.ts, the
// `OWNER soft` block) use NEW roles only, so no existing role's candidate list changes and no pick re-rolls.
import { registerProps, PROPS } from './registry.js';
import { softkit, softMat, put, splitRng, drapeTowel, lin, smooth } from './softkit.js';

const mountY = (it: any, natural: number) => (it.y !== undefined ? 0 : natural);
/** a folded-towel colour: the bath's accent, fabric2 or linen, in a seeded order (never the same role twice in a row) */
const towelRoles = (colors: any, r: () => number) => { const all = [colors.accent, colors.linen, colors.fabric2]; const o = r() < 0.5 ? all : [all[1], all[0], all[2]]; return r() < 0.5 ? o : [o[1], o[2], o[0]]; };

// ---- in-place rebuilds of types registered elsewhere: only `create` is replaced, footprint / height / params / tags / iso stay the module's own
export function rebuild(type: string, create: (it: any, ctx: any) => any) {
  const was = PROPS.get(type);
  if (!was) throw new Error(`soft2: cannot rebuild "${type}": not registered`);
  registerProps({ [type]: { ...was, create } });
}

registerProps({
  // ---- a stack of folded towels (and, on a stack of two, a rolled washcloth) for a vanity, a shelf or a tub rim --------------------------------
  'towel-stack': {
    footprint: [0.3, 0.22], height: 0.14, surface: true, params: ['color'], tags: ['bathroom'],
    create(it, ctx) {
      const { THREE, group, colors, hex, rng } = ctx, K = softkit(THREE), g = group('Towel Stack');
      const r = splitRng(rng), order = towelRoles(colors, r), n = r() < 0.5 ? 3 : 2, H = 0.045;
      const accs = [new K.Acc(), new K.Acc(), new K.Acc()], cols = it.color ? [order[0], hex(it.color), order[2]] : order;
      for (let i = 0; i < n; i++) {
        const w = 0.28 - i * 0.012, d = 0.2 - i * 0.008, yaw = (r() - 0.5) * 0.14, rr = 0.016, hx = w / 2, hz = d / 2;
        const xf = new THREE.Matrix4().makeTranslation((r() - 0.5) * 0.012, H * i + H / 2, (r() - 0.5) * 0.012).multiply(new THREE.Matrix4().makeRotationY(yaw));
        K.shell(accs[i], { w, h: H, d, r: rr, faces: ['py', 'px', 'nx', 'pz', 'nz'], kx: [-hx, -hx + rr, hx - rr, hx], kz: [-hz, -hz + rr, hz - rr, hz], ky: [-H / 2, -H / 2 + 0.01, H / 2 - 0.01, H / 2], xf,
          shade: (_x: number, y: number, _z: number, nx: number, ny: number, nz: number) => (ny > 0.5 ? 1 : nz > 0.5 ? 0.9 - 0.08 * (0.5 + 0.5 * Math.sin(y * 150)) : 0.86) });   // the open fold edge shows its layers
      }
      if (n === 2) {   // a washcloth rolled on top, in the colour of the third towel
        const y = H * 2 + 0.026, yaw = (r() - 0.5) * 0.3, c = Math.cos(yaw), s = Math.sin(yaw);
        K.strut(accs[2], [-0.1 * c, y, -0.1 * s], [0.1 * c, y, 0.1 * s], 0.026, 0.026, 10, 0.92, 0.92);
      }
      accs.forEach((a, i) => put(g, a, softMat(ctx, cols[i], { roughness: 0.96 }), 'towel'));
      return g;
    },
    iso: [{ shape: 'box', box: [-0.14, 0, -0.1, 0.14, 0.135, 0.1], color: 'role:linen' }],
  },

  // ---- a hand towel through a ring on the wall -----------------------------------------------------------------------------------------------
  'towel-ring-set': {
    footprint: [0.2, 0.14], height: 0.4, params: ['y', 'color'], tags: ['bathroom'],
    create(it, ctx) {
      const { THREE, std, group, colors, hex, rng } = ctx, K = softkit(THREE), g = group('Towel Ring');
      const y0 = mountY(it, 0.95), L1 = 0.3, R = 0.05, rb = 0.006, by = y0 + L1 + 0.02, cy = by - rb - R, zc = 0.085;
      const hard = new K.Acc();
      K.slab(hard, 0, cy, 0.006, 0.05, 0.05, 0.012);                                  // the wall plate
      K.strut(hard, [0, cy, 0.012], [0, cy, zc], 0.008, 0.008, 8);                    // the post
      const N = 14;                                                                   // the ring: a ring of short struts, facing the room
      for (let k = 0; k < N; k++) { const a0 = (k / N) * Math.PI * 2, a1 = ((k + 1) / N) * Math.PI * 2; K.strut(hard, [Math.cos(a0) * R, cy + Math.sin(a0) * R, zc], [Math.cos(a1) * R, cy + Math.sin(a1) * R, zc], 0.006, 0.006, 6, 1, 1, false); }
      put(g, hard, std(colors.metal, { metalness: 0.85, roughness: 0.28, vertexColors: true }), 'hardware', { receive: false });
      const r = splitRng(rng), col = it.color ? hex(it.color) : r() < 0.5 ? colors.linen : colors.accent, tw = new K.Acc();
      drapeTowel(THREE, tw, { by, zb: zc, rb, tw: 0.12, L1, L2: L1 - 0.04, belly: 0.012, ph: r() * 6.28, cols: 5 });
      put(g, tw, softMat(ctx, col, { roughness: 0.96 }), 'towel');
      return g;
    },
    iso: [{ shape: 'box', box: [-0.06, 0.95, 0, 0.06, 1.35, 0.12], color: 'role:linen' }],
  },

  // ---- a robe on a wall hook -------------------------------------------------------------------------------------------------------------------
  'robe-hook': {
    footprint: [0.4, 0.2], height: 1.1, params: ['y', 'color'], tags: ['bathroom', 'bedroom'],
    create(it, ctx) {
      const { THREE, std, group, colors, hex, rng } = ctx, K = softkit(THREE), g = group('Robe Hook');
      const L1 = 0.98, L2 = 0.92, y0 = mountY(it, 0.55), by = y0 + L1 + 0.04, zb = 0.07, rb = 0.012;
      const hard = new K.Acc();
      K.slab(hard, 0, by, 0.006, 0.06, 0.06, 0.012);
      K.strut(hard, [0, by, 0.012], [0, by, zb + 0.035], rb, rb, 8);
      K.strut(hard, [0, by + 0.0, zb + 0.035], [0, by, zb + 0.05], 0.022, 0.022, 10);   // the knob
      put(g, hard, std(colors.metal, { metalness: 0.85, roughness: 0.28, vertexColors: true }), 'hardware', { receive: false });
      const r = splitRng(rng), col = it.color ? hex(it.color) : colors.linen, robe = new K.Acc();
      drapeTowel(THREE, robe, { by, zb, rb, tw: 0.36, L1, L2, belly: 0.03, ph: r() * 6.28, cols: 5, th: 0.016 });
      // two sleeves hanging at the sides (narrow lenses from the shoulder, a little forward), and a darker shawl collar down the front
      for (const sx of [-1, 1]) drapeTowel(THREE, robe, { cx: sx * 0.205, by: by - 0.03, zb: zb + 0.012, rb, tw: 0.1, L1: 0.55, L2: 0.5, belly: 0.012, ph: r() * 6.28, cols: 3, th: 0.016 });
      K.shell(robe, { cx: 0, cy: by - 0.46, cz: zb + rb + 0.017 + 0.03 * Math.sin(Math.PI * Math.min(1, (0.46 / L1) * 1.1)) + 0.008 + 0.006, w: 0.37, h: 0.05, d: 0.02, r: 0.008, faces: ['py', 'ny', 'px', 'nx', 'pz'], kx: [-0.185, 0.185], ky: [-0.025, 0.025], kz: [-0.01, 0.01], shade: () => 0.8 });   // the belt
      put(g, robe, softMat(ctx, col, { roughness: 0.97 }), 'robe');
      return g;
    },
    iso: [{ shape: 'box', box: [-0.2, 0.55, 0, 0.2, 1.6, 0.14], color: 'role:linen' }],
  },
});

// ---- soft goods registered in other modules (decor.ts floor-cushion, kids.ts beanbag), rebuilt in place by type id ---------------------------------
// The rng draws the old builders made are made again, in the same order, before the one draw that seeds the cloth: a spec's colour pick and yaw are unchanged.
rebuild('floor-cushion', (it, ctx) => {
  const { THREE, group, colors, hex, rng } = ctx, K = softkit(THREE), g = group('Floor Cushion');
  const col = it.color ? hex(it.color) : (rng() < 0.5 ? colors.fabric : colors.accent), yaw = (rng() - 0.5) * 0.4, acc = new K.Acc();
  const puff = 0.03;   // the crown stands `puff` over the 0.15 top of the body: 0.18 in all, the old box's height; the body dips 2 cm into the floor so its rounded bottom edge meets it
  K.shell(acc, { cy: 0.065, w: 0.63, h: 0.17, d: 0.63, r: 0.05, faces: ['py', 'px', 'nx', 'pz', 'nz'], kx: lin(0.315, 8), kz: lin(0.315, 8), puff,
    wave: (x: number, _y: number, z: number, _nx: number, ny: number) => (ny > 0.5 ? [0, -0.018 * Math.exp(-(x * x + z * z) / 0.006), 0] : [0, 0, 0]),
    shade: (x: number, _y: number, z: number, _nx: number, ny: number) => (ny > 0.5 ? 1 - 0.12 * Math.exp(-(x * x + z * z) / 0.004) : 0.86),
    xf: new THREE.Matrix4().makeRotationY(yaw) });
  put(g, acc, softMat(ctx, col, { roughness: 0.95 }), 'cushion');
  return g;
});

rebuild('beanbag', (it, ctx) => {
  const { THREE, group, colors, hex, rng } = ctx, K = softkit(THREE), g = group('Beanbag');
  const col = it.color ? hex(it.color) : (rng() < 0.5 ? colors.fabric : colors.fabric2), acc = new K.Acc();
  // one turn: flat base, full hips, a dimpled top; the heights scale with z so the back rises and the front sinks into a seat (the old shear, kept)
  K.lathe(acc, [[0.001, 0, 0.8], [0.34, 0, 0.84], [0.395, 0.05, 0.93], [0.41, 0.09, 1], [0.408, 0.16, 1], [0.405, 0.22, 1], [0.38, 0.28, 1], [0.35, 0.34, 1], [0.3, 0.39, 1], [0.25, 0.43, 1], [0.13, 0.48, 0.96], [0.05, 0.45, 0.88], [0.001, 0.44, 0.84]], 16, 0, 1,
    (x: number, y: number, z: number) => [x, y * (1 - 0.32 * z / 0.42), z - 0.12 * y * y], (ph: number) => 0.92 + 0.08 * Math.cos(ph * 5 + 1.1));
  put(g, acc, softMat(ctx, col, { roughness: 0.95 }), 'beanbag');
  return g;
});
