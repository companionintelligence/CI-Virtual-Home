// Soft, wave two — the new soft types the grammar makes possible and the in-place rebuilds of soft goods that live in other modules
// (SOFT stream, PLAN 5.3). Imported LAST before the baked layer (assets/props/index.ts), so a type id registered here that already exists
// is replaced IN PLACE (Map.set keeps its position: the registry order, and with it every prop's seeded stream, is untouched), and a new type
// is appended after all of them. Both kinds are built from assets/props/softkit.ts: no map, one mesh per role colour, a neutral vertex shade.
//
// New types here are DORMANT: placed by nothing until the dress phase uses them. Their PLACEMENT entries (assets/props/placement.ts, the
// `OWNER soft` block) use NEW roles only, so no existing role's candidate list changes and no pick re-rolls.
import { registerProps, PROPS } from './registry.js';
import { softkit, softMat, put, splitRng, drapeTowel, lin, smooth } from './softkit.js';
import { recipes as PLANT_RECIPES } from './plants2.js';
import { romanBlind, rollerShade, cafeCurtain, shutters, valance } from './windows.js';

const mountY = (it: any, natural: number) => (it.y !== undefined ? 0 : natural);
/** a folded-towel colour: the bath's accent, fabric2 or linen, in a seeded order (never the same role twice in a row) */
const towelRoles = (colors: any, r: () => number) => { const all = [colors.accent, colors.linen, colors.fabric2]; const o = r() < 0.5 ? all : [all[1], all[0], all[2]]; return r() < 0.5 ? o : [o[1], o[2], o[0]]; };

// ---- in-place rebuilds of types registered elsewhere: only `create` is replaced, footprint / height / params / tags / iso stay the module's own
export function rebuild(type: string, create: (it: any, ctx: any) => any, extra: any = {}) {
  const was = PROPS.get(type);
  if (!was) throw new Error(`soft2: cannot rebuild "${type}": not registered`);
  registerProps({ [type]: { ...was, create, ...extra } });
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

  // ---- a hand towel through a ring on the wall: the ring hangs from a post at its top and the towel is hung over its BOTTOM arc, so the whole ring shows above the towel --------
  'towel-ring-set': {
    footprint: [0.2, 0.14], height: 0.4, params: ['y', 'color'], tags: ['bathroom'],
    create(it, ctx) {
      const { THREE, std, group, colors, hex, rng } = ctx, K = softkit(THREE), g = group('Towel Ring');
      const y0 = mountY(it, 0.95), L1 = 0.27, R = 0.055, rb = 0.006, by = y0 + L1, cy = by + R, zc = 0.085;
      const hard = new K.Acc();
      K.slab(hard, 0, cy + R, 0.006, 0.05, 0.07, 0.012);                              // the wall plate, behind the top of the ring
      K.strut(hard, [0, cy + R, 0.012], [0, cy + R, zc], 0.009, 0.009, 8);            // the post out to the ring
      const N = 16;                                                                   // the ring: short struts round a circle in the plane parallel to the wall, facing the room
      for (let k = 0; k < N; k++) { const a0 = (k / N) * Math.PI * 2, a1 = ((k + 1) / N) * Math.PI * 2; K.strut(hard, [Math.cos(a0) * R, cy + Math.sin(a0) * R, zc], [Math.cos(a1) * R, cy + Math.sin(a1) * R, zc], 0.0065, 0.0065, 6, 1, 1, false); }
      put(g, hard, std(colors.metal, { metalness: 0.85, roughness: 0.28, vertexColors: true }), 'hardware', { receive: false });
      const r = splitRng(rng), col = it.color ? hex(it.color) : r() < 0.5 ? colors.linen : colors.accent, tw = new K.Acc();
      drapeTowel(THREE, tw, { by, zb: zc, rb, tw: 0.13, L1, L2: L1 - 0.05, belly: 0.014, ph: r() * 6.28, cols: 5 });   // through the ring: a back leaf toward the wall, the front leaf hangs in the room
      put(g, tw, softMat(ctx, col, { roughness: 0.96 }), 'towel');
      return g;
    },
    iso: [{ shape: 'box', box: [-0.065, 0.95, 0, 0.065, 1.4, 0.12], color: 'role:linen' }],
  },

  // ---- a robe on a wall hook: an A-line body with sloped shoulders, a rolled shawl collar down the front, sleeves hanging at the sides, a tied belt with two loose ends ---------------------
  'robe-hook': {
    footprint: [0.4, 0.2], height: 1.1, params: ['y', 'color'], tags: ['bathroom', 'bedroom'],
    create(it, ctx) {
      const { THREE, std, group, colors, hex, rng } = ctx, K = softkit(THREE), g = group('Robe Hook');
      const L1 = 0.98, L2 = 0.92, y0 = mountY(it, 0.55), by = y0 + L1 + 0.04, zb = 0.07, rb = 0.012, Ra = rb + 0.017;
      const hard = new K.Acc();
      K.slab(hard, 0, by, 0.006, 0.06, 0.06, 0.012);
      K.strut(hard, [0, by, 0.012], [0, by, zb + 0.035], rb, rb, 8);
      K.strut(hard, [0, by, zb + 0.035], [0, by, zb + 0.05], 0.022, 0.022, 10);   // the knob
      put(g, hard, std(colors.metal, { metalness: 0.85, roughness: 0.28, vertexColors: true }), 'hardware', { receive: false });
      const r = splitRng(rng), col = it.color ? hex(it.color) : colors.linen, robe = new K.Acc();
      const ph = r() * 6.28, zf = zb + Ra;                                           // zf: the front leaf's surface at the bar
      // the body: one cloth over the hook, narrower at the shoulders than at the hem (an A-line)
      drapeTowel(THREE, robe, { by, zb, rb, tw: 0.4, L1, L2, belly: 0.034, ph, cols: 4, th: 0.016, taper: (d: number) => 0.72 + 0.28 * Math.min(1, d * 1.6) });
      // two sleeves: narrow lenses from the shoulder hanging a little outward and forward of the body, with a turned cuff
      for (const sx of [-1, 1]) drapeTowel(THREE, robe, { cx: sx * 0.205, by: by - 0.035, zb: zb + 0.02, rb, tw: 0.11, L1: 0.6, L2: 0.5, belly: 0.016, ph: ph + sx, cols: 2, th: 0.016, taper: (d: number) => 1 - 0.18 * d });
      // the rolled shawl collar: a thick tube from each side of the neck, crossing down to the belt in a V
      const front = (y: number) => zf + 0.034 * Math.sin(Math.PI * Math.min(1, ((by - y) / L1) * 1.1)) + 0.012;
      const yb = by - 0.5, yn = by - 0.02;
      for (const sx of [-1, 1]) K.strut(robe, [sx * 0.085, yn, front(yn) + 0.004], [-sx * 0.012, yb, front(yb) + 0.004], 0.021, 0.015, 7, 0.82, 0.78);
      // the belt: a band round the waist, a knot, two ends hanging unequal
      K.shell(robe, { cx: 0, cy: yb - 0.01, cz: front(yb - 0.01) - 0.004, w: 0.355, h: 0.05, d: 0.026, r: 0.01, faces: ['py', 'ny', 'px', 'nx', 'pz'], kx: [-0.1775, 0.1775], ky: [-0.025, 0.025], kz: [-0.013, 0.013], shade: () => 0.76 });
      K.slab(robe, 0, yb - 0.01, front(yb - 0.01) + 0.018, 0.06, 0.06, 0.03, 0.72);   // the knot
      for (const [sx, len] of [[-0.018, 0.2], [0.022, 0.15]]) K.strut(robe, [sx, yb - 0.035, front(yb - 0.035) + 0.022], [sx * 1.6, yb - 0.035 - len, front(yb - 0.035 - len) + 0.026], 0.016, 0.014, 6, 0.74, 0.7);
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
  const puff = 0.031;   // the crown stands `puff` over the 0.15 top of the body: 0.18 in all, the old box's height; the body dips 2 cm into the floor so its rounded bottom edge meets it
  K.shell(acc, { cy: 0.07, w: 0.619, h: 0.17, d: 0.619, r: 0.05, faces: ['py', 'px', 'nx', 'pz', 'nz'], kx: lin(0.3095, 8), kz: lin(0.3095, 8), puff,
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
    (x: number, y: number, z: number) => [x * 0.9976, y * (1 - 0.32 * z / 0.42), (z - 0.12 * y * y) * 1.0245], (ph: number) => 0.92 + 0.08 * Math.cos(ph * 5 + 1.1));
  put(g, acc, softMat(ctx, col, { roughness: 0.95 }), 'beanbag');
  return g;
});

// ---- cut flowers (T9): the vase and the jug of stems, in place; a flower arrangement is foliage (a stem's box is not its shape), which also moves their drift check to the one-sided rule ------------
rebuild('vase', PLANT_RECIPES['vase'], { foliage: true });
rebuild('flower-jug', PLANT_RECIPES['flower-jug'], { foliage: true });

registerProps({
  // a trough planter for the floor along a wall or under a window, three clumps of strap leaves; dormant until the dress phase places it
  // (the id is 'trough-planter': 'planter' is the outdoor site kit's, and house-builder asks the page's items first)
  'trough-planter': {
    footprint: [0.7, 0.24], height: 0.62, params: ['w', 'color'], tags: ['living', 'entry', 'sunroom', 'kitchen'],
    create: PLANT_RECIPES['trough-planter'],
    iso: [{ shape: 'box', box: [-0.35, 0, -0.12, 0.35, 0.32, 0.12], color: 'role:accent' }, { shape: 'blob', box: [-0.33, 0.3, -0.1, 0.33, 0.62, 0.1], color: '#4f772d' }],
  },
  // a pothos in a small pot on a shelf or a counter, vines trailing over the rim; dormant
  'pothos': {
    footprint: [0.34, 0.34], height: 0.3, surface: true, params: ['color'], tags: ['living', 'kitchen', 'bedroom', 'office'],
    create: PLANT_RECIPES['pothos'],
    iso: [{ shape: 'cyl', box: [-0.085, 0, -0.085, 0.085, 0.12, 0.085], color: 'role:accent' }, { shape: 'blob', box: [-0.15, 0, -0.15, 0.15, 0.3, 0.15], color: '#40916c' }],
  },
}, { foliage: true });

// ---- window treatments (T10): five new dormant types, built like the curtain (origin at the floor under the window, the wall at z = 0, w the width, h the height of the head) -------------------------
registerProps({
  'roman-blind': { footprint: [1.0, 0.1], height: 2.15, params: ['w', 'h', 'color'], tags: ['living', 'bedroom', 'dining', 'kitchen'], create: romanBlind, iso: [{ shape: 'box', box: [-0.5, 0.8, 0, 0.5, 2.1, 0.07], color: 'role:fabric2' }] },
  'roller-shade': { footprint: [1.0, 0.08], height: 2.15, params: ['w', 'h', 'color'], tags: ['living', 'bedroom', 'office', 'kitchen', 'bathroom'], create: rollerShade, iso: [{ shape: 'box', box: [-0.5, 0.6, 0, 0.5, 2.1, 0.06], color: 'role:linen' }] },
  'cafe-curtain': { footprint: [0.9, 0.12], height: 1.65, params: ['w', 'h', 'color'], tags: ['kitchen', 'bathroom', 'dining'], create: cafeCurtain, iso: [{ shape: 'box', box: [-0.45, 0.85, 0, 0.45, 1.6, 0.09], color: 'role:fabric2' }] },
  'shutters': { footprint: [1.0, 0.08], height: 2.15, params: ['w', 'h', 'color'], tags: ['living', 'bedroom', 'dining', 'kitchen'], create: shutters, iso: [{ shape: 'box', box: [-0.5, 0.8, 0, 0.5, 2.1, 0.07], color: 'role:linen' }] },
  'valance': { footprint: [1.4, 0.1], height: 2.35, params: ['w', 'h', 'color'], tags: ['living', 'bedroom', 'dining', 'kitchen'], create: valance, iso: [{ shape: 'box', box: [-0.7, 2.05, 0, 0.7, 2.32, 0.07], color: 'role:fabric2' }] },
});
