// Kitchen — the fitted run and the appliances that make a room read as a kitchen: fridge, range, range hood, sink
// run, dishwasher, upper cabinets, pantry, breakfast bar, kitchen cart, microwave, plus a plain counter run (the
// filler between appliances) and a coffee maker. Contract: index.js; decor.js is the worked example.
//   • Origin at the floor centre of the footprint, facing +z at rot 0: doors and appliance fronts open toward +z.
//     breakfast-bar is the one exception in spirit — its SEATING side (the overhang) faces +z and its doors face the
//     kitchen at −z, so a bar-stool placed in front of it at rot 180 sits under the overhang.
//   • Counters are 0.9 m to the worktop: a 0.1 recessed plinth, a dark carcass to 0.86, a 0.04 light-stone top.
//     Fronts take colors.cabinet (or it.color); the darker carcass shows through the gaps between fronts, which is
//     what makes flat boxes read as doors. Appliances are stainless unless finish: 'cabinet' (integrated) or it.color.
//   • Wall-mounted props (range-hood, upper-cabinets) have their back at z = 0 and grow into +z. The spec's `y` is
//     the height of their BOTTOM edge: house-builder and the iso twin lift the origin by it.y themselves, so with y
//     set the prop is built with its bottom at local 0; with no y it is built at a default mount (hood 1.5, uppers
//     1.4) so a bare spec, the sheet and the catalog still see it on the wall. Iso hints are written bottom-at-0.
//   • surface: true — microwave and coffee-maker sit on a counter (their origin is the worktop).
//   • Role colours for every big face; literals only for stainless, stone, glass, knobs and burner rings.
//     ctx.rng picks which counter unit is the drawer stack and what rides on the cart.
import { registerProps } from './registry.js';

const STONE = 0xf1f5f9, STEEL = 0xcbd5e1, CHROME = 0xe2e8f0, GLASS = 0x111827, PLINTH = 0x27272a, KNOB = 0x3f3f46;
const stoneMat = std => std(STONE, { roughness: 0.25, metalness: 0.05 });
const chromeMat = std => std(CHROME, { metalness: 0.95, roughness: 0.12 });
const glassMat = std => std(GLASS, { roughness: 0.15, metalness: 0.5 });
const plinthMat = std => std(PLINTH, { roughness: 0.85 });
// the worktop: `top` names a material; without one it is today's pale stone, exactly (pass 4 S3: countertop material)
const TOPS = { marble: [0xeceae4, { roughness: 0.18, metalness: 0.02 }], butcher: [0xa0724a, { roughness: 0.55 }], concrete: [0x9c9b97, { roughness: 0.8 }], quartz: [0x2b2b2e, { roughness: 0.2, metalness: 0.08 }], terrazzo: [0xe3ddd2, { roughness: 0.3 }] };
const topMat = (std, it) => { const t = it && TOPS[it.top]; return t ? std(t[0], { ...t[1] }) : stoneMat(std); };
const handleMatOf = ({ std, colors }) => std(colors.metal, { metalness: 0.7, roughness: 0.3 });

const cyl = (THREE, rt, rb, h, mat, x = 0, y = 0, z = 0, seg = 16) => {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; return m;
};
// a knob / dial standing proud of a +z face: a short cylinder with its axis along z
const knob = (THREE, r, len, mat, x, y, zf) => { const k = cyl(THREE, r, r, len, mat, x, y, zf + len / 2, 12); k.rotation.x = Math.PI / 2; return k; };
// A tapered block (a hood canopy): a box whose top face is shrunk to kx × kz of its bottom, the back face kept
// flat at local z = 0 so it still sits against a wall. One mesh; the faces stay planar so per-face normals hold.
const wedge = (THREE, w, h, d, kx, kz, mat, x, y, z) => {
  const geo = new THREE.BoxGeometry(1, 1, 1), p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) if (p.getY(i) > 0) { p.setX(i, p.getX(i) * kx); p.setZ(i, -0.5 + (p.getZ(i) + 0.5) * kz); }
  geo.computeVertexNormals(); geo.scale(w, h, d); geo.translate(0, 0, d / 2);
  const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; return m;
};

// An appliance face: stainless by default; finish: 'cabinet' integrates it into the run; it.color paints it.
function faceOf(it, { colors, hex }) {
  const finish = it.finish || (it.color ? 'paint' : 'steel');
  const color = finish === 'cabinet' ? colors.cabinet : finish === 'steel' ? STEEL : it.color ? hex(it.color) : STEEL;
  return { color, extra: finish === 'steel' ? { metalness: 0.85, roughness: 0.3 } : { roughness: 0.55 } };
}

// A grid of n × rows fronts across [x0, x0 + w] between y0 and y0 + h, each `t` proud of the plane z = zf (dir −1
// for a front that faces −z), separated by `gap` so the carcass behind shows as a dark line. handle: 'v' a vertical
// bar near the meeting edge (pairs meet in the middle), 'h' a horizontal bar near the top (drawers, oven doors),
// 'hb' one along the bottom edge (upper cabinets), null none. hlen overrides the bar length.
function fronts(ctx, g, { x0, w, y0, h, zf, n = 1, rows = 1, mat, handleMat, gap = 0.014, t = 0.02, handle = 'v', hlen = null, dir = 1 }) {
  const { box } = ctx, pw = w / n, rh = h / rows;
  for (let r = 0; r < rows; r++) for (let i = 0; i < n; i++) {
    const x = x0 + (i + 0.5) * pw, y = y0 + (r + 0.5) * rh;
    g.add(box(pw - gap, rh - gap, t, mat, x, y, zf + dir * t / 2));
    if (!handle) continue;
    const hz = zf + dir * (t + 0.011);
    if (handle === 'v') { const len = hlen || Math.min(0.3, (rh - gap) * 0.45), side = n === 1 ? 1 : (i % 2 === 0 ? 1 : -1); g.add(box(0.014, len, 0.022, handleMat, x + side * (pw / 2 - gap / 2 - 0.05), y, hz)); }
    else { const len = hlen || Math.min(0.3, (pw - gap) * 0.5), hy = handle === 'h' ? y + rh / 2 - gap / 2 - 0.045 : y - rh / 2 + gap / 2 + 0.035; g.add(box(len, 0.014, 0.022, handleMat, x, hy, hz)); }
  }
}

// A base unit: recessed plinth, dark carcass, optional stone worktop at `top` and an upstand along the back.
// Fronts go on afterwards with fronts() at the returned zf. Returns the materials and the front plane.
function baseUnit(ctx, g, { w, d, top = 0.9, color, worktop = true, upstand = false, surface = null }) {
  const { std, box, mix } = ctx;
  const dark = std(mix(color, 0x000000, 0.45), { roughness: 0.75 }), front = std(color, { roughness: 0.55 }), handle = handleMatOf(ctx);
  const ph = 0.1, ch = top - 0.04 - ph;
  g.add(box(w - 0.02, ph, d - 0.07, plinthMat(std), 0, ph / 2, -0.035));                 // plinth, toe-kick recessed at the front
  g.add(box(w, ch, d - 0.02, dark, 0, ph + ch / 2, -0.01));                                 // carcass, front face at d/2 − 0.02
  if (worktop) g.add(box(w, 0.04, d, surface ? surface() : stoneMat(std), 0, top - 0.02, 0));
  if (upstand) g.add(box(w, 0.06, 0.02, surface ? surface() : stoneMat(std), 0, top + 0.03, -d / 2 + 0.01));
  return { dark, front, handle, zf: d / 2 - 0.02, y0: ph, h: ch };
}

registerProps({
  // ---- fridge: a tall french-door fridge — two doors over a freezer drawer, long bar handles meeting in the middle
  'fridge': {
    footprint: [0.9, 0.72], height: 1.8, params: ['w', 'd', 'h', 'color', 'finish'], tags: ['kitchen'],
    create(it, ctx) {
      const { std, box, group, mix } = ctx;
      const w = it.w || 0.9, d = it.d || 0.72, h = it.h || 1.8, g = group('Fridge'), f = faceOf(it, ctx);
      const body = std(mix(f.color, 0x000000, 0.4), f.extra), panel = std(f.color, f.extra), handle = handleMatOf(ctx);
      g.add(box(w - 0.06, 0.08, d - 0.12, plinthMat(std), 0, 0.04, -0.05));
      g.add(box(w, h - 0.08, d - 0.02, body, 0, 0.08 + (h - 0.08) / 2, -0.01));
      const zf = d / 2 - 0.02, split = 0.08 + (h - 0.08) * 0.36;
      fronts(ctx, g, { x0: -w / 2, w, y0: 0.08, h: split - 0.08, zf, mat: panel, handleMat: handle, handle: 'h', hlen: w * 0.55 });
      fronts(ctx, g, { x0: -w / 2, w, y0: split, h: h - split, zf, n: 2, mat: panel, handleMat: handle, handle: 'v', hlen: (h - split) * 0.55 });
      return g;
    },
    iso: [{ shape: 'box', box: [-0.45, 0, -0.36, 0.45, 1.8, 0.36], color: '#cbd5e1' }],
  },

  // ---- range: a slide-in cooker — storage drawer, glass-fronted oven door, a knob strip, four gas rings on black glass
  'range': {
    footprint: [0.6, 0.64], height: 0.92, params: ['w', 'd', 'color', 'finish'], tags: ['kitchen'],
    create(it, ctx) {
      const { THREE, std, box, group, mix } = ctx;
      const w = it.w || 0.6, d = it.d || 0.62, g = group('Range'), f = faceOf(it, ctx);
      const body = std(mix(f.color, 0x000000, 0.35), f.extra), panel = std(f.color, f.extra), chrome = chromeMat(std);
      g.add(box(w - 0.04, 0.08, d - 0.1, plinthMat(std), 0, 0.04, -0.04));
      g.add(box(w, 0.82, d - 0.02, body, 0, 0.49, -0.01));                                   // 0.08 … 0.9
      const zf = d / 2 - 0.02;
      fronts(ctx, g, { x0: -w / 2, w, y0: 0.08, h: 0.1, zf, mat: panel, handleMat: chrome, handle: 'h', hlen: w * 0.5 });        // drawer
      fronts(ctx, g, { x0: -w / 2, w, y0: 0.18, h: 0.56, zf, mat: panel, handleMat: chrome, handle: 'h', hlen: w - 0.1 });       // oven door
      g.add(box(w - 0.14, 0.28, 0.006, glassMat(std), 0, 0.43, zf + 0.023));                                                     // its window
      g.add(box(w, 0.14, 0.02, body, 0, 0.83, zf + 0.01));                                                                       // control strip
      const knobMat = std(KNOB, { metalness: 0.6, roughness: 0.35 }), nk = 5;
      for (let i = 0; i < nk; i++) g.add(knob(THREE, 0.018, 0.025, knobMat, -w / 2 + (i + 0.5) * (w / nk), 0.83, zf + 0.02));
      // the hob: black glass with four rings, each a plate and a torus
      g.add(box(w - 0.04, 0.012, d - 0.1, glassMat(std), 0, 0.906, -0.02));
      const ring = std(KNOB, { metalness: 0.7, roughness: 0.35 }), plate = std(0x18181b, { roughness: 0.6 });
      for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
        const x = sx * w * 0.23, z = -0.02 + sz * (d - 0.1) * 0.25;
        g.add(cyl(THREE, 0.048, 0.048, 0.008, plate, x, 0.916, z));
        const t = new THREE.Mesh(new THREE.TorusGeometry(0.056, 0.008, 8, 20), ring); t.rotation.x = Math.PI / 2; t.position.set(x, 0.918, z); t.castShadow = true; g.add(t);
      }
      return g;
    },
    iso: [{ shape: 'box', box: [-0.3, 0, -0.32, 0.3, 0.9, 0.32], color: '#cbd5e1' }, { shape: 'box', box: [-0.28, 0.9, -0.28, 0.28, 0.92, 0.24], color: '#111827' }],
  },

  // ---- range hood (wall-mounted): a chimney hood — a thin lip with the control strip on its front edge, a canopy
  //      that tapers up to the chimney, and the chimney up the wall
  'range-hood': {
    footprint: [0.6, 0.5], height: 0.6, params: ['w', 'd', 'h', 'y', 'color', 'finish'], tags: ['kitchen'],
    create(it, ctx) {
      const { THREE, std, box, group } = ctx;
      const w = it.w || 0.6, d = it.d || 0.5, h = it.h || 0.6, y0 = it.y !== undefined ? 0 : 1.5, g = group('Range Hood'), f = faceOf(it, ctx);
      const mat = std(f.color, f.extra), cw = Math.min(0.26, w * 0.45), ch = Math.min(0.16, h * 0.3);   // chimney width, canopy height
      g.add(box(w, 0.04, d, mat, 0, y0 + 0.02, d / 2));                                                                  // lip, back at z = 0
      g.add(wedge(THREE, w - 0.02, ch, d - 0.01, (cw + 0.12) / (w - 0.02), (cw + 0.08) / (d - 0.01), mat, 0, y0 + 0.04 + ch / 2, 0));   // canopy
      g.add(box(w - 0.06, 0.025, 0.012, plinthMat(std), 0, y0 + 0.02, d + 0.006));                                       // control strip on the lip
      g.add(box(cw, h - 0.04 - ch, cw, mat, 0, y0 + 0.04 + ch + (h - 0.04 - ch) / 2, cw / 2));                            // chimney
      return g;
    },
    iso: [{ shape: 'box', box: [-0.3, 0, 0, 0.3, 0.2, 0.5], color: '#cbd5e1' }, { shape: 'box', box: [-0.13, 0.2, 0, 0.13, 0.6, 0.26], color: '#cbd5e1' }],
  },

  // ---- sink run: a base run with a steel basin let into the worktop, a gooseneck tap behind it, an upstand at the back
  'sink-run': {
    footprint: [1.8, 0.62], height: 1.2, params: ['w', 'd', 'color', 'top'], tags: ['kitchen', 'laundry'],
    create(it, ctx) {
      const { THREE, std, box, group, colors, hex } = ctx;
      const w = it.w || 1.8, d = it.d || 0.62, g = group('Sink Run'), color = it.color ? hex(it.color) : colors.cabinet;
      const u = baseUnit(ctx, g, { w, d, color, worktop: false, upstand: true, surface: it.top ? () => topMat(std, it) : null });
      fronts(ctx, g, { x0: -w / 2, w, y0: u.y0, h: u.h, zf: u.zf, n: Math.max(2, Math.round(w / 0.45)), mat: u.front, handleMat: u.handle });
      // the worktop in four pieces around the cut-out
      const stone = topMat(std, it), bw = Math.min(0.56, w * 0.4), bd = d * 0.62, bz = 0.02, ty = 0.88, sideW = (w - bw) / 2;
      g.add(box(sideW, 0.04, d, stone, -(bw + sideW) / 2, ty, 0)); g.add(box(sideW, 0.04, d, stone, (bw + sideW) / 2, ty, 0));
      const backD = bz - bd / 2 + d / 2, frontD = d / 2 - (bz + bd / 2);
      g.add(box(bw, 0.04, backD, stone, 0, ty, -d / 2 + backD / 2)); g.add(box(bw, 0.04, frontD, stone, 0, ty, d / 2 - frontD / 2));
      // the basin: a steel tray, walls flush with the worktop
      const steel = std(STEEL, { metalness: 0.85, roughness: 0.3 }), depth = 0.17, t = 0.012, iw = bw - 0.006, id = bd - 0.006;
      g.add(box(iw, 0.01, id, steel, 0, 0.9 - depth + 0.005, bz));
      g.add(box(t, depth, id, steel, -iw / 2 + t / 2, 0.9 - depth / 2, bz)); g.add(box(t, depth, id, steel, iw / 2 - t / 2, 0.9 - depth / 2, bz));
      g.add(box(iw, depth, t, steel, 0, 0.9 - depth / 2, bz - id / 2 + t / 2)); g.add(box(iw, depth, t, steel, 0, 0.9 - depth / 2, bz + id / 2 - t / 2));
      // the tap: a riser, a gooseneck arm out over the basin, a spout down
      const chrome = chromeMat(std), tz = bz - bd / 2 - 0.05;
      g.add(cyl(THREE, 0.014, 0.017, 0.28, chrome, 0, 1.04, tz));
      const arm = cyl(THREE, 0.012, 0.012, 0.18, chrome, 0, 1.18, tz + 0.09, 12); arm.rotation.x = Math.PI / 2; g.add(arm);
      g.add(cyl(THREE, 0.011, 0.011, 0.06, chrome, 0, 1.15, tz + 0.17, 12));
      return g;
    },
    iso: [{ shape: 'box', box: [-0.9, 0, -0.31, 0.9, 0.86, 0.31], color: 'role:cabinet' }, { shape: 'box', box: [-0.9, 0.86, -0.31, 0.9, 0.9, 0.31], color: '#f1f5f9' }, { shape: 'box', box: [-0.28, 0.9, -0.17, 0.28, 0.91, 0.21], color: '#cbd5e1' }],
  },

  // ---- counter run: the plain filler between appliances — doors, with one unit (seeded) a stack of three drawers
  'counter-run': {
    footprint: [1.8, 0.6], height: 0.96, params: ['w', 'd', 'color', 'top'], tags: ['kitchen', 'laundry'],
    create(it, ctx) {
      const { group, colors, hex, rng } = ctx;
      const w = it.w || 1.8, d = it.d || 0.6, g = group('Counter Run'), color = it.color ? hex(it.color) : colors.cabinet;
      const u = baseUnit(ctx, g, { w, d, color, upstand: true, surface: it.top ? () => topMat(ctx.std, it) : null });
      const n = Math.max(1, Math.round(w / 0.5)), uw = w / n, drawerAt = n > 1 ? Math.floor(rng() * n) : -1;
      for (let i = 0; i < n; i++) {
        const x0 = -w / 2 + i * uw;
        if (i === drawerAt) fronts(ctx, g, { x0, w: uw, y0: u.y0, h: u.h, zf: u.zf, rows: 3, mat: u.front, handleMat: u.handle, handle: 'h' });
        else fronts(ctx, g, { x0, w: uw, y0: u.y0, h: u.h, zf: u.zf, mat: u.front, handleMat: u.handle, handle: 'v' });
      }
      return g;
    },
    iso: [{ shape: 'box', box: [-0.9, 0, -0.3, 0.9, 0.86, 0.3], color: 'role:cabinet' }, { shape: 'box', box: [-0.9, 0.86, -0.3, 0.9, 0.9, 0.3], color: '#f1f5f9' }],
  },

  // ---- dishwasher: a counter-height unit with a stainless door and a control strip along its top
  'dishwasher': {
    footprint: [0.6, 0.6], height: 0.9, params: ['w', 'd', 'color', 'finish'], tags: ['kitchen'],
    create(it, ctx) {
      const { std, box, group, colors } = ctx;
      const w = it.w || 0.6, d = it.d || 0.6, g = group('Dishwasher'), f = faceOf(it, ctx);
      const u = baseUnit(ctx, g, { w, d, color: colors.cabinet });
      const door = std(f.color, f.extra);
      fronts(ctx, g, { x0: -w / 2, w, y0: u.y0, h: u.h, zf: u.zf, mat: door, handleMat: chromeMat(std), handle: 'h', hlen: w - 0.12 });
      g.add(box(w - 0.06, 0.05, 0.004, plinthMat(std), 0, u.y0 + u.h - 0.04, u.zf + 0.022));
      return g;
    },
    iso: [{ shape: 'box', box: [-0.3, 0, -0.3, 0.3, 0.86, 0.3], color: '#cbd5e1' }, { shape: 'box', box: [-0.3, 0.86, -0.3, 0.3, 0.9, 0.3], color: '#f1f5f9' }],
  },

  // ---- upper cabinets (wall-mounted): a run of wall units, bar handles along the bottom edges
  'upper-cabinets': {
    footprint: [1.2, 0.35], height: 0.7, params: ['w', 'd', 'h', 'y', 'color', 'glass'], tags: ['kitchen', 'laundry'],
    create(it, ctx) {
      const { std, box, group, mix, colors, hex } = ctx;
      const w = it.w || 1.2, d = it.d || 0.35, h = it.h || 0.7, y0 = it.y !== undefined ? 0 : 1.4, g = group('Upper Cabinets');
      const color = it.color ? hex(it.color) : colors.cabinet;
      g.add(box(w, h, d - 0.02, std(mix(color, 0x000000, 0.45), { roughness: 0.75 }), 0, y0 + h / 2, (d - 0.02) / 2));     // carcass, back at z = 0
      if (it.glass) {   // glass-fronted (pass 4 S3): a pale lit interior, two shelves of crockery, framed glass doors
        const n = Math.max(1, Math.round(w / 0.4)), pw = w / n, zf = d - 0.02, frame = std(color, { roughness: 0.55 });
        g.add(box(w - 0.04, h - 0.04, 0.01, std(mix(color, 0xffffff, 0.55), { roughness: 0.8 }), 0, y0 + h / 2, zf - 0.02));
        for (const f of [1 / 3, 2 / 3]) g.add(box(w - 0.04, 0.015, d - 0.06, std(mix(color, 0xffffff, 0.45), { roughness: 0.7 }), 0, y0 + h * f, zf / 2));
        const crock = std(colors.linen, { roughness: 0.3 });
        for (let i = 0; i < n * 2; i++) for (const f of [1 / 3, 2 / 3]) g.add(box(pw * 0.3, 0.1, 0.1, crock, -w / 2 + (i + 0.5) * pw / 2, y0 + h * f + 0.06, zf / 2));
        for (let i = 0; i < n; i++) {
          const x = -w / 2 + (i + 0.5) * pw, fw = pw - 0.014, bar = 0.035;
          for (const yy of [y0 + bar / 2 + 0.007, y0 + h - bar / 2 - 0.007]) g.add(box(fw, bar, 0.02, frame, x, yy, zf + 0.01));
          for (const xx of [x - fw / 2 + bar / 2, x + fw / 2 - bar / 2]) g.add(box(bar, h - 0.014, 0.02, frame, xx, y0 + h / 2, zf + 0.01));
          g.add(box(fw - 2 * bar, h - 0.014 - 2 * bar, 0.006, std(0xd9e6ea, { roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.3 }), x, y0 + h / 2, zf + 0.012));
          g.add(box(0.014, 0.1, 0.02, handleMatOf(ctx), x + (i % 2 ? -1 : 1) * (fw / 2 - bar - 0.02), y0 + 0.12, zf + 0.03));
        }
        return g;
      }
      fronts(ctx, g, { x0: -w / 2, w, y0, h, zf: d - 0.02, n: Math.max(1, Math.round(w / 0.4)), mat: std(color, { roughness: 0.55 }), handleMat: handleMatOf(ctx), handle: 'hb' });
      return g;
    },
    iso: [{ shape: 'box', box: [-0.6, 0, 0, 0.6, 0.7, 0.35], color: 'role:cabinet' }],
  },

  // ---- pantry: a tall larder cabinet — a pair of tall doors under a pair of top boxes
  'pantry': {
    footprint: [0.9, 0.6], height: 2.1, params: ['w', 'd', 'h', 'color'], tags: ['kitchen', 'laundry'],
    create(it, ctx) {
      const { std, box, group, mix, colors, hex } = ctx;
      const w = it.w || 0.9, d = it.d || 0.6, h = it.h || 2.1, g = group('Pantry'), color = it.color ? hex(it.color) : colors.cabinet;
      const dark = std(mix(color, 0x000000, 0.45), { roughness: 0.75 }), front = std(color, { roughness: 0.55 }), handle = handleMatOf(ctx);
      g.add(box(w - 0.02, 0.1, d - 0.07, plinthMat(std), 0, 0.05, -0.035));
      g.add(box(w, h - 0.1, d - 0.02, dark, 0, 0.1 + (h - 0.1) / 2, -0.01));
      const zf = d / 2 - 0.02, n = w >= 0.75 ? 2 : 1, split = 0.1 + (h - 0.1) * 0.72;
      fronts(ctx, g, { x0: -w / 2, w, y0: 0.1, h: split - 0.1, zf, n, mat: front, handleMat: handle, handle: 'v', hlen: 0.4 });
      fronts(ctx, g, { x0: -w / 2, w, y0: split, h: h - split, zf, n, mat: front, handleMat: handle, handle: 'hb' });
      return g;
    },
    iso: [{ shape: 'box', box: [-0.45, 0, -0.3, 0.45, 2.1, 0.3], color: 'role:cabinet' }],
  },

  // ---- breakfast bar: a base run between two stone waterfall ends, the worktop overhanging toward +z for stools;
  //      the doors face the kitchen at −z
  'breakfast-bar': {
    footprint: [1.8, 0.75], height: 0.9, params: ['w', 'd', 'color', 'top'], tags: ['kitchen', 'dining'],
    create(it, ctx) {
      const { std, box, group, mix, colors, hex } = ctx;
      const w = it.w || 1.8, d = it.d || 0.75, g = group('Breakfast Bar'), color = it.color ? hex(it.color) : colors.cabinet;
      const stone = topMat(std, it), dark = std(mix(color, 0x000000, 0.45), { roughness: 0.75 }), front = std(color, { roughness: 0.55 }), handle = handleMatOf(ctx);
      const bd = Math.min(0.5, d * 0.62), zc = -d / 2 + bd / 2, bw = w - 0.08;      // base depth and centre; the rest overhangs toward +z
      g.add(box(bw - 0.02, 0.1, bd - 0.06, plinthMat(std), 0, 0.05, zc + 0.03));
      g.add(box(bw, 0.76, bd - 0.02, dark, 0, 0.48, zc + 0.01));                                   // carcass 0.1 … 0.86, back face at −d/2 + 0.02
      fronts(ctx, g, { x0: -bw / 2, w: bw, y0: 0.1, h: 0.76, zf: -d / 2 + 0.02, n: Math.max(2, Math.round(bw / 0.45)), mat: front, handleMat: handle, dir: -1 });
      g.add(box(bw, 0.76, 0.02, front, 0, 0.48, zc + bd / 2 + 0.01));                             // the seating face: a plain panel
      for (const sx of [-1, 1]) g.add(box(0.04, 0.86, d, stone, sx * (w / 2 - 0.02), 0.43, 0));  // waterfall ends
      g.add(box(w, 0.04, d, stone, 0, 0.88, 0));                                                    // worktop with the overhang
      // a chrome foot rail along the seating face, on two stand-offs
      const chrome = chromeMat(ctx.std), rz = zc + bd / 2 + 0.02;
      for (const sx of [-1, 1]) { const s = cyl(ctx.THREE, 0.008, 0.008, 0.07, chrome, sx * (bw / 2 - 0.15), 0.2, rz + 0.035, 8); s.rotation.x = Math.PI / 2; g.add(s); }
      const rail = cyl(ctx.THREE, 0.012, 0.012, bw - 0.2, chrome, 0, 0.2, rz + 0.07, 10); rail.rotation.z = Math.PI / 2; g.add(rail);
      return g;
    },
    iso: [
      { shape: 'box', box: [-0.86, 0, -0.375, 0.86, 0.86, 0.09], color: 'role:cabinet' },
      { shape: 'box', box: [-0.9, 0, -0.375, -0.86, 0.86, 0.375], color: '#f1f5f9' }, { shape: 'box', box: [0.86, 0, -0.375, 0.9, 0.86, 0.375], color: '#f1f5f9' },
      { shape: 'box', box: [-0.9, 0.86, -0.375, 0.9, 0.9, 0.375], color: '#f1f5f9' },
    ],
  },

  // ---- kitchen cart: a butcher-block top on a steel frame with two shelves, a drawer, a towel rail and casters;
  //      a crate (seeded fabric colour) rides on the middle shelf
  'kitchen-cart': {
    footprint: [0.7, 0.45], height: 0.9, params: ['w', 'd', 'color'], tags: ['kitchen', 'dining'],
    create(it, ctx) {
      const { THREE, std, box, group, colors, hex, rng } = ctx;
      const w = it.w || 0.7, d = it.d || 0.45, g = group('Kitchen Cart');
      const wood = std(it.color ? hex(it.color) : colors.wood, { roughness: 0.5 }), frame = std(colors.metal, { metalness: 0.8, roughness: 0.3 }), rubber = std(PLINTH, { roughness: 0.9 });
      g.add(box(w, 0.04, d, wood, 0, 0.88, 0));                                                    // top
      g.add(box(w - 0.08, 0.1, d - 0.08, wood, 0, 0.8, 0));                                        // drawer box under it
      g.add(box(0.1, 0.012, 0.02, frame, 0, 0.8, d / 2 - 0.03));                                    // its pull
      for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
        g.add(box(0.03, 0.8, 0.03, frame, sx * (w / 2 - 0.03), 0.46, sz * (d / 2 - 0.03)));         // posts 0.06 … 0.86
        g.add(cyl(THREE, 0.03, 0.03, 0.06, rubber, sx * (w / 2 - 0.03), 0.03, sz * (d / 2 - 0.03), 12));   // casters
      }
      for (const y of [0.14, 0.48]) g.add(box(w - 0.06, 0.02, d - 0.06, wood, 0, y, 0));            // shelves
      const rz = d / 2 - 0.03;                                                                        // towel rail off the +x end
      for (const z of [-rz, rz]) { const s = cyl(THREE, 0.006, 0.006, 0.06, frame, w / 2 + 0.03, 0.78, z, 8); s.rotation.z = Math.PI / 2; g.add(s); }
      const rail = cyl(THREE, 0.007, 0.007, 2 * rz + 0.012, frame, w / 2 + 0.06, 0.78, 0, 8); rail.rotation.x = Math.PI / 2; g.add(rail);
      const crate = box(0.26, 0.14, 0.22, std(rng() < 0.5 ? colors.fabric : colors.fabric2, { roughness: 0.9 }), -w / 2 + 0.2, 0.56, 0.02); crate.rotation.y = (rng() - 0.5) * 0.3; g.add(crate);
      return g;
    },
    iso: [
      { shape: 'box', box: [-0.35, 0.86, -0.225, 0.35, 0.9, 0.225], color: 'role:wood' }, { shape: 'box', box: [-0.31, 0.75, -0.185, 0.31, 0.85, 0.185], color: 'role:wood' },
      { shape: 'box', box: [-0.32, 0.47, -0.195, 0.32, 0.49, 0.195], color: 'role:wood' }, { shape: 'box', box: [-0.32, 0.13, -0.195, 0.32, 0.15, 0.195], color: 'role:wood' },
      { shape: 'box', box: [-0.335, 0, -0.21, -0.305, 0.86, -0.18], color: 'role:metal' }, { shape: 'box', box: [0.305, 0, -0.21, 0.335, 0.86, -0.18], color: 'role:metal' },
      { shape: 'box', box: [-0.335, 0, 0.18, -0.305, 0.86, 0.21], color: 'role:metal' }, { shape: 'box', box: [0.305, 0, 0.18, 0.335, 0.86, 0.21], color: 'role:metal' },
    ],
  },

  // ---- microwave (surface): a countertop oven — glass door with a bar handle, a control strip with a dial
  'microwave': {
    footprint: [0.5, 0.4], height: 0.3, surface: true, params: ['w', 'color', 'finish'], tags: ['kitchen', 'office'],
    create(it, ctx) {
      const { THREE, std, box, group } = ctx;
      const w = it.w || 0.5, d = 0.38, h = 0.3, g = group('Microwave'), f = faceOf(it, ctx);
      const body = std(f.color, f.extra), dark = plinthMat(std);
      g.add(box(w, h - 0.02, d, body, 0, 0.02 + (h - 0.02) / 2, 0));
      for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) g.add(cyl(THREE, 0.012, 0.012, 0.02, dark, sx * (w / 2 - 0.04), 0.01, sz * (d / 2 - 0.04), 8));
      const zf = d / 2, cw = 0.11;                                                                    // door on the left, controls on the right
      g.add(box(w - cw - 0.03, h - 0.06, 0.02, dark, -cw / 2 - 0.005, 0.16, zf + 0.01));             // door frame
      g.add(box(w - cw - 0.09, h - 0.12, 0.006, glassMat(std), -cw / 2 - 0.005, 0.16, zf + 0.023));   // its window
      g.add(box(0.012, h - 0.12, 0.02, chromeMat(std), -cw / 2 - 0.005 + (w - cw - 0.03) / 2 - 0.03, 0.16, zf + 0.03));   // bar handle
      g.add(box(cw - 0.03, h - 0.06, 0.02, dark, w / 2 - cw / 2, 0.16, zf + 0.01));                    // control strip
      g.add(knob(THREE, 0.02, 0.014, std(KNOB, { metalness: 0.6, roughness: 0.35 }), w / 2 - cw / 2, 0.12, zf + 0.02));
      for (const y of [0.2, 0.235]) g.add(box(0.04, 0.012, 0.006, std(0x52525b, { roughness: 0.6 }), w / 2 - cw / 2, y, zf + 0.023));
      return g;
    },
    iso: [{ shape: 'box', box: [-0.25, 0, -0.19, 0.25, 0.3, 0.19], color: '#cbd5e1' }],
  },

  // ---- coffee maker (surface): a bean-to-cup machine — hopper on top, spout over a cup on the drip tray
  'coffee-maker': {
    footprint: [0.24, 0.36], height: 0.36, surface: true, params: ['color', 'finish'], tags: ['kitchen', 'office'],
    create(it, ctx) {
      const { THREE, std, box, group, colors } = ctx;
      const g = group('Coffee Maker'), f = it.color || it.finish ? faceOf(it, ctx) : { color: PLINTH, extra: { roughness: 0.5, metalness: 0.2 } };
      const body = std(f.color, f.extra), steel = std(STEEL, { metalness: 0.85, roughness: 0.3 });
      g.add(box(0.24, 0.32, 0.24, body, 0, 0.16, -0.06));                                            // body, z −0.18 … 0.06
      g.add(cyl(THREE, 0.06, 0.05, 0.04, glassMat(std), 0, 0.34, -0.1, 14));                            // bean hopper
      g.add(box(0.2, 0.025, 0.12, steel, 0, 0.0125, 0.12));                                              // drip tray, to z 0.18
      g.add(box(0.07, 0.05, 0.1, steel, 0, 0.2, 0.09));                                                  // spout head over the cup
      g.add(box(0.14, 0.06, 0.006, steel, 0, 0.27, 0.063));                                              // control panel
      g.add(knob(THREE, 0.014, 0.012, std(KNOB, { metalness: 0.6, roughness: 0.35 }), 0.045, 0.27, 0.066));
      g.add(cyl(THREE, 0.034, 0.028, 0.07, std(colors.linen, { roughness: 0.6 }), 0, 0.06, 0.12, 14));     // the cup
      return g;
    },
    iso: [{ shape: 'box', box: [-0.12, 0, -0.18, 0.12, 0.34, 0.06], color: '#27272a' }, { shape: 'box', box: [-0.1, 0, 0.06, 0.1, 0.03, 0.18], color: '#cbd5e1' }],
  },
});

// =================================================================================================================
// Pass 4 (S3 compose): the corner of an L or U run (assets/room-units.ts packs runs round it), so a fitted kitchen
// turns a corner in one piece instead of two runs overlapping.
// =================================================================================================================
registerProps({
  // Corner run — a blind-corner base unit, one worktop square filling the corner. hand 'left': the walls are behind
  // (−z) and to its left (−x), a door on the +z face; 'right': the side wall is at +x. top and color as counter-run.
  'corner-run': {
    footprint: [0.62, 0.62], height: 0.96, params: ['w', 'hand', 'color', 'top'], tags: ['kitchen', 'laundry'],
    create(it, ctx) {
      const { std, box, group, colors, hex } = ctx;
      const w = it.w || 0.62, g = group(`Corner Run (${it.hand === 'right' ? 'right' : 'left'})`), color = it.color ? hex(it.color) : colors.cabinet;
      const side = it.hand === 'right' ? 1 : -1;
      const u = baseUnit(ctx, g, { w, d: w, color, upstand: true, surface: it.top ? () => topMat(std, it) : null });
      g.add(box(0.02, 0.06, w, it.top ? topMat(std, it) : stoneMat(std), side * (w / 2 - 0.01), 0.93, 0));   // the upstand on the side wall
      fronts(ctx, g, { x0: -w / 2 + (side < 0 ? 0.02 : 0), w: w - 0.02, y0: u.y0, h: u.h, zf: u.zf, mat: u.front, handleMat: u.handle, handle: 'v' });
      return g;
    },
    iso: [{ shape: 'box', box: [-0.31, 0, -0.31, 0.31, 0.86, 0.31], color: 'role:cabinet' }, { shape: 'box', box: [-0.31, 0.86, -0.31, 0.31, 0.9, 0.31], color: '#f1f5f9' }],
  },

  // ---- two more counter appliances (plan S3: every kitchen had the same coffee maker or microwave) -----------------------------
  // Toaster — a two-slot steel toaster with a lever and a browning dial.
  'toaster': {
    footprint: [0.3, 0.17], height: 0.2, surface: true, params: ['color', 'finish'], tags: ['kitchen'],
    create(it, ctx) {
      const { THREE, std, box, group, colors } = ctx;
      const g = group('Toaster'), f = it.color || it.finish ? faceOf(it, ctx) : { color: STEEL, extra: { roughness: 0.3, metalness: 0.85 } };
      g.add(box(0.3, 0.17, 0.16, std(f.color, f.extra), 0, 0.105, 0)); g.add(box(0.3, 0.02, 0.16, std(PLINTH, { roughness: 0.5 }), 0, 0.01, 0));
      for (const x of [-0.07, 0.07]) g.add(box(0.1, 0.006, 0.012, std(0x141414, { roughness: 0.9 }), x, 0.192, 0));
      g.add(box(0.02, 0.008, 0.03, std(KNOB, { metalness: 0.5, roughness: 0.4 }), 0.13, 0.12, 0.085));      // the lever
      g.add(knob(THREE, 0.014, 0.012, std(KNOB, { metalness: 0.6, roughness: 0.35 }), -0.12, 0.13, 0.08));
      return g;
    },
    iso: [{ shape: 'box', box: [-0.15, 0, -0.08, 0.15, 0.19, 0.08], color: '#cbd5e1' }],
  },
  // Kettle — a steel electric kettle on its base, a black handle and a spout.
  'kettle': {
    footprint: [0.24, 0.2], height: 0.26, surface: true, params: ['color', 'finish'], tags: ['kitchen'],
    create(it, ctx) {
      const { THREE, std, box, group } = ctx;
      const g = group('Kettle'), f = it.color || it.finish ? faceOf(it, ctx) : { color: STEEL, extra: { roughness: 0.28, metalness: 0.85 } };
      g.add(cyl(THREE, 0.1, 0.1, 0.02, std(PLINTH, { roughness: 0.5 }), 0, 0.01, 0, 22));
      const body = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.095, 0.2, 22), std(f.color, f.extra)); body.position.y = 0.12; body.castShadow = true; g.add(body);
      g.add(cyl(THREE, 0.045, 0.07, 0.03, std(f.color, f.extra), 0, 0.235, 0, 22));
      const handle = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.008, 6, 14, Math.PI), std(0x141414, { roughness: 0.6 })); handle.rotation.set(0, 0, 0); handle.position.set(-0.075, 0.15, 0); handle.rotation.z = Math.PI / 2; g.add(handle);
      const spout = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.022, 0.07, 8), std(f.color, f.extra)); spout.position.set(0.09, 0.19, 0); spout.rotation.z = -1.0; g.add(spout);
      return g;
    },
    iso: [{ shape: 'cyl', box: [-0.1, 0, -0.1, 0.1, 0.24, 0.1], color: '#cbd5e1' }],
  },
});
