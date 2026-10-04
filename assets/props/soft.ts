// Soft — textiles, art and the small living things a room reads as inhabited: a throw and cushions on the
// seating, art / mirror / clock / curtains / a wall hanging on the walls, a vase, books and fruit on the surfaces,
// a runner in the hall. Contract: index.js; decor.js is the worked example.
//   • Every prop's origin is the floor centre of its footprint, facing +z at rot 0.
//   • Wall-mounted props (wall-art, round-mirror, wall-clock, wall-hanging) have their back at z = 0 and grow into
//     +z. `y` is the MOUNT height of the piece's centre. house-builder and the iso twin lift an item's origin by
//     it.y themselves (the hanging-plant / pendant convention), so: y set → the piece is centred on the local
//     origin; no y (the sheet, the catalog, a quick spec) → it is centred at a per-prop default height above the
//     floor origin (art 1.5, mirror 1.55, clock 1.9, hanging 1.6). The iso hints are written for the no-y case.
//     Curtains stand on the floor (rail at h + 0.03) and take no y.
//   • throw-blanket / cushion-set stand on the floor at the origin; the builder's y lift (a spec `y`) puts them on
//     a seat (sofa ≈ 0.42, bed ≈ 0.48).
//   • Big surfaces take role colours (fabric, fabric2, wood, linen, rug, accent, metal) or it.color; only fruit,
//     flower heads, book spines, the clock hands and the mirror glass are literals — none of them a colour the
//     material kit's theme() reads as a role key (0x1e293b is `cabinet`, so the clock's darks are 0x1f2937 and its
//     rim is the kit's metal). Variation is ctx.rng(), seeded per item.
import { registerProps } from './registry.js';
import { patternTexture, motifTexture, RUG_PATTERNS, ART_MOTIFS } from './patterns.js';
import { hangCurtains, softkit, softMat, put, splitRng, lin } from './softkit.js';

const pick = (rng, arr) => arr[Math.floor(rng() * arr.length)];
const jit = (rng, a) => (rng() - 0.5) * 2 * a;   // ±a
// a cylinder standing along +z (its round face toward the room), centred at (x, y, z)
const disc = (THREE, r, depth, mat, x, y, z, seg = 32) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, depth, seg), mat); m.rotation.x = Math.PI / 2; m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; return m; };
// a cylinder between two points (stand legs, stems)
const strut = (THREE, a, b, r, mat, seg = 8) => { const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b), d = B.clone().sub(A), L = d.length(); const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, L, seg), mat); m.position.copy(A).add(B).multiplyScalar(0.5); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()); m.castShadow = true; return m; };
const GREENS = [0x2f6b3a, 0x3f7f45, 0x4a8a3a, 0x2b5d3a];

registerProps({
  // ---- textiles on the seating -----------------------------------------------------------------------------
  'throw-blanket': {
    footprint: [0.7, 0.55], height: 0.16, params: ['w', 'd', 'y', 'color'], tags: ['living', 'bedroom', 'kids'],
    // softkit: the same fold (two layers sharing a rolled fold at −z, the open fringed end at +z, the top layer's end rolled over) in rounded,
    // gently waved cloth — one mesh for the cloth and one for the fringe, where the box throw was five
    create(it, ctx) {
      const { THREE, std, group, colors, hex, mix, rng } = ctx, K = softkit(THREE);
      const w0 = it.w || 0.7, d = it.d || 0.5, g = group('Throw Blanket'), w = w0 - 0.003;   // 3 mm of the width are what the rounded corners and the lens edges add: the box stays the old one's
      const col = it.color ? hex(it.color) : colors.fabric2;
      const t1 = 0.05, t2 = 0.045, R = (t1 + t2) / 2, z0 = -d / 2 + R;   // z0: the fold's axis; the flat layers run from there
      g.rotation.y = jit(rng, 0.08);
      const r = splitRng(rng), ph = r() * 6.28, cloth = new K.Acc(), fringe = new K.Acc();
      const L1 = d / 2 - z0, d2 = d * 0.62 - R;
      const wave = (amp: number) => (x: number, _y: number, z: number, _nx: number, ny: number) => (ny > 0.5 ? [0, amp * Math.sin(x * 11 + ph) * Math.cos(z * 9 + ph), 0] : [0, 0, 0]);
      K.shell(cloth, { cy: t1 / 2, cz: (z0 + d / 2) / 2, w, h: t1, d: L1, r: 0.006, faces: ['py', 'px', 'nx', 'pz'], kx: lin(w / 2, 8), kz: lin(L1 / 2, 4), wave: wave(0.004), shade: (x: number, _y: number, z: number, _nx: number, ny: number) => (ny > 0.5 ? 1 - 0.07 * (0.5 + 0.5 * Math.sin(x * 11 + ph)) : 0.84) });
      K.shell(cloth, { cy: t1 + t2 / 2, cz: z0 + d2 / 2, w: w * 0.97, h: t2, d: d2, r: 0.006, faces: ['py', 'px', 'nx', 'pz'], kx: lin(w * 0.485, 8), kz: lin(d2 / 2, 3), wave: wave(0.004), shade: (x: number, _y: number, _z: number, _nx: number, ny: number) => (ny > 0.5 ? 1 - 0.05 * (0.5 + 0.5 * Math.sin(x * 13 + ph)) : 0.86) });
      K.strut(cloth, [-w * 0.485, R, z0], [w * 0.485, R, z0], R, R, 12, 0.94, 0.94);                                                 // the fold
      K.strut(cloth, [-w * 0.47, t1 + t2 + 0.029, z0 + d2 - 0.02], [w * 0.47, t1 + t2 + 0.029, z0 + d2 - 0.02], 0.035, 0.035, 12, 0.96, 0.96);   // the rolled end, sunk into the top layer
      K.shell(fringe, { cy: 0.007, cz: d / 2 + 0.02 + 0.0003, w: w * 0.98, h: 0.014, d: 0.0512, r: 0.005, faces: ['py', 'px', 'nx', 'pz'], kx: lin(w * 0.49, 14), kz: [-0.025, 0.025], ky: [-0.007, 0.007], shade: (x: number, _y: number, _z: number, _nx: number, ny: number) => (ny > 0.5 ? 0.82 + 0.18 * (Math.sin(x * 160) > 0 ? 1 : 0.8) : 0.85) });   // tassels
      for (const acc of [cloth, fringe]) for (let i = 0; i < acc.pos.length; i += 3) { acc.pos[i] -= 0.0015; acc.pos[i + 2] += 0.0006; }   // pins the box to the old one's offsets
      put(g, cloth, softMat(ctx, col, { roughness: 0.96 }), 'throw');
      put(g, fringe, softMat(ctx, mix(col, 0xffffff, 0.45), { roughness: 1 }), 'fringe');
      return g;
    },
    iso: [{ shape: 'box', box: [-0.35, 0, -0.25, 0.35, 0.05, 0.27], color: 'role:fabric2' }, { shape: 'box', box: [-0.34, 0.05, -0.25, 0.34, 0.095, 0.06], color: 'role:fabric2' }, { shape: 'box', box: [-0.33, 0.09, 0.005, 0.33, 0.16, 0.075], color: 'role:fabric2' }],
  },
  'cushion-set': {
    footprint: [1.3, 0.25], height: 0.44, params: ['w', 'y', 'color'], tags: ['living', 'bedroom', 'kids'],
    // softkit: the same three cushions leaning back on the same pivots and the same rng draws (so the layout is the old one to the millimetre),
    // each a puffed, rounded cushion with a dimple; one mesh per fabric colour (3) where the slabs were 6 meshes
    create(it, ctx) {
      const { THREE, std, group, colors, hex, rng } = ctx, K = softkit(THREE);
      const w = it.w || 1.3, g = group('Cushion Set');
      const size = 0.42, t = 0.11, lean = 0.28, n = 3, step = (w - size) / (n - 1), padW = 0.0031, padD = 0.0095, sink = 0.001, nudge = [-0.0009, -0.0008];   // pad and sink: the rounded corners give back what the slab's sharp ones reached, and the pivot edge dips into the seat's give
      // three cushions leaning back, a seeded mix of the two fabrics and the accent; it.color pins the middle one
      const roles = [colors.fabric, colors.accent, colors.fabric2];
      const order = rng() < 0.5 ? [0, 1, 2] : [2, 1, 0];
      const accs = [new K.Acc(), new K.Acc(), new K.Acc()], mine = new K.Acc();
      for (let i = 0; i < n; i++) {
        const cx = -w / 2 + size / 2 + i * step + jit(rng, 0.01), yaw = jit(rng, 0.12), tilt = -lean + jit(rng, 0.04);
        // pivot at the bottom-BACK edge (z = 0): yaw on the parent so the contact edge stays on the floor, then the lean
        const xf = new THREE.Matrix4().makeTranslation(cx + nudge[0], 0, 0).multiply(new THREE.Matrix4().makeRotationY(yaw)).multiply(new THREE.Matrix4().makeRotationX(tilt))
          
          .multiply(new THREE.Matrix4().makeTranslation(0, size / 2 - sink, t / 2 + nudge[1])).multiply(new THREE.Matrix4().makeRotationX(Math.PI / 2));
        const dim = (x: number, _y: number, z: number, _nx: number, ny: number) => (ny > 0.5 ? [0, -0.012 * Math.exp(-(x * x + z * z) / 0.004), 0] : [0, 0, 0]);
        K.shell(it.color && i === 1 ? mine : accs[order[i]], { w: size + padW, h: t + 0.0268, d: size + padD, r: 0.026, faces: ['py', 'ny', 'px', 'nx', 'nz'], kx: lin((size + padW) / 2, 6), kz: lin((size + padD) / 2, 6), puff: 0.025, wave: dim, xf,
          shade: (x: number, _y: number, z: number, _nx: number, ny: number) => (ny > 0.5 ? 1 - 0.1 * Math.exp(-(x * x + z * z) / 0.003) : 0.86) });
      }
      accs.forEach((a, i) => put(g, a, softMat(ctx, roles[i], { roughness: 0.95 }), 'cushion'));
      if (it.color) put(g, mine, softMat(ctx, hex(it.color), { roughness: 0.95 }), 'cushion');
      return g;
    },
    iso: [{ shape: 'box', box: [-0.65, 0, -0.13, -0.23, 0.42, 0.06], color: 'role:fabric' }, { shape: 'box', box: [-0.21, 0, -0.13, 0.21, 0.42, 0.06], color: 'role:accent' }, { shape: 'box', box: [0.23, 0, -0.13, 0.65, 0.42, 0.06], color: 'role:fabric2' }],
  },

  // ---- on the walls ------------------------------------------------------------------------------------------
  'wall-art': {
    footprint: [0.8, 0.05], height: 0.6, params: ['w', 'h', 'y', 'color', 'motif', 'frame'], tags: ['living', 'bedroom', 'office', 'dining', 'hall'],
    create(it, { THREE, std, box, group, colors, hex, mix, rng }) {
      const w = it.w || 0.8, h = it.h || 0.6, cy = it.y !== undefined ? 0 : 1.5, g = group('Wall Art');
      const bar = 0.035, depth = 0.04, frame = std(it.frame ? hex(it.frame) : colors.wood, { roughness: 0.5 });
      g.add(box(w, bar, depth, frame, 0, cy + h / 2 - bar / 2, depth / 2));
      g.add(box(w, bar, depth, frame, 0, cy - h / 2 + bar / 2, depth / 2));
      g.add(box(bar, h - 2 * bar, depth, frame, -w / 2 + bar / 2, cy, depth / 2));
      g.add(box(bar, h - 2 * bar, depth, frame, w / 2 - bar / 2, cy, depth / 2));
      // the canvas: a pale tint of the second fabric (or it.color) with one of three flat compositions on it
      const cw = w - 2 * bar, ch = h - 2 * bar, bg = it.color ? hex(it.color) : mix(colors.fabric2, 0xffffff, 0.62);
      // a named motif (the motif library, assets/props/patterns.ts: 'landscape', 'botanical', 'story-moon' …) is a
      // painted canvas, one textured mesh; a numbered one (0 sun, 1 peaks, 2 arch — every spec before pass 4) keeps
      // its flat shapes exactly
      if (typeof it.motif === 'string' && Number.isNaN(Number(it.motif))) {
        g.add(box(cw, ch, 0.02, std(0xffffff, { roughness: 0.9, map: motifTexture(THREE, it.motif, [bg, colors.accent, colors.fabric, colors.fabric2], { w: cw, h: ch }) }), 0, cy, 0.015));
        return g;
      }
      g.add(box(cw, ch, 0.02, std(bg, { roughness: 0.9 }), 0, cy, 0.015));
      const m1 = std(colors.accent, { roughness: 0.85 }), m2 = std(colors.fabric, { roughness: 0.85 }), z = 0.028, s = Math.min(cw, ch);
      const motif = it.motif !== undefined ? Number(it.motif) % 3 : Math.floor(rng() * 3);   // 0 sun, 1 peaks, 2 arch
      if (motif === 0) {            // sun over a horizon band
        g.add(disc(THREE, s * 0.24, 0.006, m1, cw * 0.14, cy + ch * 0.1, z));
        g.add(box(cw * 0.78, ch * 0.16, 0.006, m2, 0, cy - ch * 0.3, z));
      } else if (motif === 1) {     // two peaks
        const tri = (r, mat, x, y) => { const t = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.006, 3), mat); t.rotation.x = -Math.PI / 2; t.position.set(x, y, z); return t; };
        g.add(tri(s * 0.36, m2, -cw * 0.16, cy - ch * 0.12));
        g.add(tri(s * 0.26, m1, cw * 0.2, cy - ch * 0.2));
      } else {                      // an arch and a small moon
        const arch = new THREE.Mesh(new THREE.CylinderGeometry(s * 0.3, s * 0.3, 0.006, 24, 1, false, -Math.PI / 2, Math.PI), m1);
        arch.rotation.x = -Math.PI / 2; arch.position.set(-cw * 0.08, cy - ch * 0.22, z); g.add(arch);
        g.add(disc(THREE, s * 0.09, 0.006, m2, cw * 0.28, cy + ch * 0.22, z));
      }
      return g;
    },
    iso: [{ shape: 'box', box: [-0.4, 1.2, 0, 0.4, 1.8, 0.04], color: 'role:wood' }, { shape: 'box', box: [-0.36, 1.24, 0.03, 0.36, 1.76, 0.045], color: '#e2e8f0' }, { shape: 'blob', box: [-0.02, 1.42, 0.04, 0.18, 1.62, 0.05], color: 'role:accent' }],
  },
  'round-mirror': {
    footprint: [0.6, 0.05], height: 0.6, params: ['r', 'y'], tags: ['hall', 'bedroom', 'bathroom', 'living'],
    create(it, { THREE, std, group, colors }) {
      const r = it.r || 0.3, cy = it.y !== undefined ? 0 : 1.55, g = group('Round Mirror');
      g.add(disc(THREE, r, 0.035, std(colors.wood, { roughness: 0.5 }), 0, cy, 0.0175, 40));
      g.add(disc(THREE, r - 0.035, 0.01, std(0xd4e4f0, { metalness: 1, roughness: 0.04 }), 0, cy, 0.04, 40));
      return g;
    },
    iso: [{ shape: 'blob', box: [-0.3, 1.25, 0, 0.3, 1.85, 0.05], color: 'role:wood' }, { shape: 'blob', box: [-0.26, 1.29, 0.02, 0.26, 1.81, 0.05], color: '#dbeafe' }],
  },
  'wall-clock': {
    footprint: [0.32, 0.06], height: 0.32, params: ['r', 'y', 'color'], tags: ['kitchen', 'office', 'living', 'hall', 'kids'],
    create(it, { THREE, std, box, group, colors, hex, rng }) {
      const r = it.r || 0.16, cy = it.y !== undefined ? 0 : 1.9, g = group('Wall Clock');
      const dark = std(0x1f2937, { roughness: 0.5 });   // not 0x1e293b: theme() reads that as the cabinet role
      const rim = it.color ? std(hex(it.color), { roughness: 0.4 }) : std(colors.metal, { metalness: 0.6, roughness: 0.35 });
      g.add(disc(THREE, r, 0.05, rim, 0, cy, 0.025, 40));
      g.add(disc(THREE, r - 0.022, 0.012, std(0xf8fafc, { roughness: 0.6 }), 0, cy, 0.05, 40));
      const zf = 0.058;
      for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2, d = r - 0.045, m = box(0.012, r * 0.16, 0.005, dark, Math.sin(a) * d, cy + Math.cos(a) * d, zf, false); m.rotation.z = -a; g.add(m); }
      const hand = (len, wid, a) => { const m = box(wid, len, 0.005, dark, Math.sin(a) * len / 2, cy + Math.cos(a) * len / 2, zf + 0.003, false); m.rotation.z = -a; return m; };
      const hour = rng() * Math.PI * 2, minute = rng() * Math.PI * 2;   // a seeded time of day
      g.add(hand(r * 0.5, 0.016, hour)); g.add(hand(r * 0.74, 0.011, minute));
      g.add(disc(THREE, 0.012, 0.006, dark, 0, cy, zf + 0.006, 12));
      return g;
    },
    iso: [{ shape: 'blob', box: [-0.16, 1.74, 0, 0.16, 2.06, 0.05], color: 'role:metal' }, { shape: 'blob', box: [-0.14, 1.76, 0.03, 0.14, 2.04, 0.06], color: '#f8fafc' }],
  },
  'curtains': {
    footprint: [2.1, 0.14], height: 2.44, params: ['w', 'h', 'color'], tags: ['living', 'bedroom', 'dining', 'kids', 'office'],
    // softkit.ts hangCurtains: two lens panels (pinch-pleat, wave or ring-top, a flared hem, sometimes a tie-back), the rod, brackets and
    // finials in one metal mesh, and — on a wide curtain, 40% — a transparent sheer behind. 2-3 meshes where the box curtain had 19.
    create(it, ctx) { return hangCurtains(ctx, it); },
    iso: [{ shape: 'box', box: [-1.0, 0.02, 0.06, -0.36, 2.41, 0.12], color: 'role:fabric2' }, { shape: 'box', box: [0.36, 0.02, 0.06, 1.0, 2.41, 0.12], color: 'role:fabric2' }, { shape: 'box', box: [-1.05, 2.42, 0.08, 1.05, 2.44, 0.1], color: 'role:metal' }],
  },
  'wall-hanging': {
    footprint: [0.6, 0.05], height: 0.75, params: ['w', 'y', 'color'], tags: ['bedroom', 'living', 'kids', 'hall'],
    create(it, { THREE, std, box, group, colors, hex, mix, rng }) {
      const w = it.w || 0.5, cy = it.y !== undefined ? 0 : 1.6, g = group('Wall Hanging');
      const col = it.color ? hex(it.color) : colors.linen;
      const cloth = std(col, { roughness: 1 }), stripe = std(colors.fabric2, { roughness: 1 });
      const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, w + 0.1, 10), std(colors.wood, { roughness: 0.6 })); rod.rotation.z = Math.PI / 2; rod.position.set(0, cy, 0.012); rod.castShadow = true; g.add(rod);
      // the woven body hangs from the rod, one band of the second fabric across it
      g.add(box(w, 0.28, 0.02, cloth, 0, cy - 0.15, 0.022));
      g.add(box(w, 0.05, 0.006, stripe, 0, cy - 0.18, 0.035, false));
      // fringe: strands falling to a point in the middle
      const n = 9, sw = w / n, base = cy - 0.29;
      for (let i = 0; i < n; i++) {
        const len = 0.18 + 0.27 * (1 - Math.abs(i - (n - 1) / 2) / ((n - 1) / 2)) + jit(rng, 0.015);
        g.add(box(sw - 0.008, len, 0.012, i % 3 === 1 ? std(mix(col, colors.fabric2, 0.5), { roughness: 1 }) : cloth, -w / 2 + sw * (i + 0.5), base - len / 2, 0.022));
      }
      return g;
    },
    iso: [{ shape: 'box', box: [-0.3, 1.59, 0, 0.3, 1.61, 0.025], color: 'role:wood' }, { shape: 'box', box: [-0.25, 1.31, 0.01, 0.25, 1.59, 0.03], color: 'role:linen' }, { shape: 'box', box: [-0.22, 0.86, 0.01, 0.22, 1.31, 0.03], color: 'role:linen' }],
  },

  // ---- on the surfaces ---------------------------------------------------------------------------------------
  'vase': {
    footprint: [0.18, 0.18], height: 0.55, surface: true, params: ['color', 'h'], tags: ['living', 'dining', 'bedroom', 'hall', 'office'],
    create(it, { THREE, std, group, colors, hex, rng }) {
      const h = it.h || 0.26, g = group('Vase');
      const glaze = std(it.color ? hex(it.color) : colors.accent, { roughness: 0.35, flatShading: true });
      const part = (r0, r1, hh, y) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(r0, r1, hh, 10), glaze); m.position.y = y; m.castShadow = true; g.add(m); };
      part(0.05, 0.062, h * 0.7, h * 0.35);                     // belly (top radius, bottom radius)
      part(0.032, 0.05, h * 0.16, h * 0.78);                    // shoulder
      part(0.034, 0.032, h * 0.14, h * 0.93);                   // neck
      // two or three stems leaning out of the neck, each with a pair of leaves; the tallest carries a seed head
      const stemMat = std(0x4d7c3a, { roughness: 0.9 }), leafMat = std(pick(rng, GREENS), { roughness: 0.8, flatShading: true });
      const head = std(pick(rng, [0xf59e0b, 0xf43f5e, 0xfef3c7, 0xc084fc]), { roughness: 0.7, flatShading: true });
      const n = 2 + Math.floor(rng() * 2), a0 = rng() * Math.PI * 2;
      for (let i = 0; i < n; i++) {
        const a = a0 + i * Math.PI * 2 / n + jit(rng, 0.4), lean = 0.12 + rng() * 0.14, len = 0.24 + rng() * 0.07;
        const s = group('Stem'); s.position.set(0, h - 0.03, 0); s.rotation.set(lean * Math.sin(a), 0, -lean * Math.cos(a)); g.add(s);
        s.add(strut(THREE, [0, 0, 0], [0, len, 0], 0.004, stemMat, 6));
        for (const t of [0.5, 0.78]) {
          const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.03, 6, 4), leafMat); leaf.scale.set(0.6, 0.18, 1.7);
          leaf.position.set(0, len * t, 0); leaf.rotation.set(0.25, a + (t > 0.6 ? 1.2 : 0), 0); leaf.castShadow = true; s.add(leaf);
        }
        if (i === 0) { const hd = new THREE.Mesh(new THREE.SphereGeometry(0.022, 7, 5), head); hd.position.y = len + 0.015; hd.castShadow = true; s.add(hd); }
      }
      return g;
    },
    iso: [{ shape: 'cyl', box: [-0.06, 0, -0.06, 0.06, 0.26, 0.06], color: 'role:accent' }, { shape: 'blob', box: [-0.08, 0.3, -0.08, 0.08, 0.52, 0.08], color: '#3f7f45' }],
  },
  'book-stack': {
    footprint: [0.22, 0.18], height: 0.1, surface: true, params: ['n', 'color'], tags: ['living', 'office', 'bedroom', 'kids'],
    create(it, { std, box, group, colors, hex, rng }) {
      const n = Math.max(2, Math.min(8, it.n || 3 + Math.floor(rng() * 2))), g = group('Book Stack');   // 4 meshes a book
      const covers = [colors.accent, colors.fabric, colors.fabric2, 0xb45309, 0x1e3a5f, 0x7f1d1d, 0xe7e5e4, 0x8a9a5b];
      const pages = std(colors.linen, { roughness: 0.9 }), t = 0.004;
      let y = 0;
      for (let i = 0; i < n; i++) {
        const bw = 0.17 + rng() * 0.06, bd = 0.12 + rng() * 0.05, bh = 0.022 + rng() * 0.018;
        const cover = std(it.color && i === n - 1 ? hex(it.color) : pick(rng, covers), { roughness: 0.6 });
        const b = group('Book'); b.position.set(jit(rng, 0.012), y, jit(rng, 0.012)); b.rotation.y = jit(rng, 0.18); g.add(b);
        b.add(box(bw, t, bd, cover, 0, t / 2, 0));                        // boards, spine toward +z (faces the room at rot 0)
        b.add(box(bw, t, bd, cover, 0, bh - t / 2, 0));
        b.add(box(bw, bh, t, cover, 0, bh / 2, bd / 2 - t / 2));
        b.add(box(bw - 0.012, bh - 2 * t, bd - t - 0.006, pages, 0, bh / 2, -(t - 0.006) / 2));
        y += bh;
      }
      return g;
    },
    iso: [{ shape: 'box', box: [-0.11, 0, -0.08, 0.11, 0.04, 0.08], color: 'role:accent' }, { shape: 'box', box: [-0.1, 0.04, -0.075, 0.1, 0.075, 0.075], color: 'role:fabric' }, { shape: 'box', box: [-0.105, 0.075, -0.07, 0.105, 0.11, 0.07], color: '#e7e5e4' }],
  },
  'fruit-bowl': {
    footprint: [0.3, 0.3], height: 0.19, surface: true, params: ['color'], tags: ['kitchen', 'dining'],
    create(it, { THREE, std, group, colors, hex, mix, rng }) {
      const g = group('Fruit Bowl');
      const wood = it.color ? hex(it.color) : colors.wood;
      const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.09, 0.07, 20), std(wood, { roughness: 0.5 })); bowl.position.y = 0.035; bowl.castShadow = true; g.add(bowl);
      const inner = new THREE.Mesh(new THREE.CylinderGeometry(0.135, 0.135, 0.004, 20), std(mix(wood, 0x000000, 0.3), { roughness: 0.7 })); inner.position.y = 0.072; g.add(inner);
      // a heap: five round the rim, one on top — seeded fruit colours
      const FRUIT = [0xf97316, 0xdc2626, 0x84cc16, 0xfacc15, 0x65a30d, 0xfb923c];
      const fruit = (r, x, y, z) => { const m = new THREE.Mesh(new THREE.SphereGeometry(r, 7, 5), std(pick(rng, FRUIT), { roughness: 0.55, flatShading: true })); m.position.set(x, y, z); m.rotation.y = rng() * Math.PI; m.castShadow = true; g.add(m); };
      const a0 = rng() * Math.PI * 2;
      for (let i = 0; i < 5; i++) { const a = a0 + i * Math.PI * 2 / 5, r = 0.034 + rng() * 0.008; fruit(r, Math.sin(a) * 0.065, 0.072 + r * 0.7, Math.cos(a) * 0.065); }
      fruit(0.038, jit(rng, 0.01), 0.072 + 0.032 + 0.038 * 0.85, jit(rng, 0.01));
      return g;
    },
    iso: [{ shape: 'cyl', box: [-0.15, 0, -0.15, 0.15, 0.07, 0.15], color: 'role:wood' }, { shape: 'blob', box: [-0.1, 0.07, -0.1, 0.1, 0.18, 0.1], color: '#f97316' }],
  },

  // ---- on the floor ------------------------------------------------------------------------------------------
  'plant-stand': {
    footprint: [0.4, 0.4], height: 0.95, params: ['h', 'color'], tags: ['living', 'hall', 'bedroom', 'office', 'dining'],
    create(it, { THREE, std, group, colors, hex, rng }) {
      const h = it.h || 0.55, g = group('Plant Stand');
      const metal = std(colors.metal, { metalness: 0.8, roughness: 0.3 });
      const ring = (r, y) => { const m = new THREE.Mesh(new THREE.TorusGeometry(r, 0.009, 8, 28), metal); m.rotation.x = Math.PI / 2; m.position.y = y; m.castShadow = true; g.add(m); };
      ring(0.13, h); ring(0.155, h * 0.35);
      for (let k = 0; k < 3; k++) { const a = k * Math.PI * 2 / 3 + Math.PI / 6; g.add(strut(THREE, [Math.sin(a) * 0.19, 0.003, Math.cos(a) * 0.19], [Math.sin(a) * 0.125, h + 0.01, Math.cos(a) * 0.125], 0.008, metal)); }
      // the pot sits in the top ring, a third of it below the rim
      const potMat = std(it.color ? hex(it.color) : colors.linen, { roughness: 0.6 });
      const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.085, 0.2, 14), potMat); pot.position.y = h - 0.06 + 0.1; pot.castShadow = true; g.add(pot);
      const soil = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.02, 14), std(0x2b1d14, { roughness: 1 })); soil.position.y = h + 0.13; g.add(soil);
      // a mound of foliage and two trailing sprigs down the pot's side
      const top = h + 0.14, leaf = (r, x, y, z, sx = 1, sy = 0.7, sz = 1) => { const m = new THREE.Mesh(new THREE.SphereGeometry(r, 6, 5), std(pick(rng, GREENS), { roughness: 0.8, flatShading: true })); m.position.set(x, y, z); m.scale.set(sx, sy, sz); m.rotation.y = rng() * Math.PI; m.castShadow = true; g.add(m); };
      leaf(0.11, 0, top + 0.06, 0, 1, 0.8, 1);
      const a0 = rng() * Math.PI * 2;
      for (let i = 0; i < 5; i++) { const a = a0 + i * Math.PI * 2 / 5, d = 0.09 + rng() * 0.03; leaf(0.065 + rng() * 0.02, Math.sin(a) * d, top + 0.05 + rng() * 0.05, Math.cos(a) * d); }
      leaf(0.07, 0, top + 0.18, 0, 0.9, 0.8, 0.9);
      for (const a of [a0 + 0.7, a0 + 3.5]) { leaf(0.045, Math.sin(a) * 0.13, top - 0.05, Math.cos(a) * 0.13, 0.8, 0.6, 1.2); leaf(0.035, Math.sin(a) * 0.15, top - 0.14, Math.cos(a) * 0.15, 0.8, 0.6, 1.1); }
      return g;
    },
    iso: [{ shape: 'cyl', box: [-0.19, 0, -0.19, 0.19, 0.55, 0.19], color: 'role:metal' }, { shape: 'cyl', box: [-0.12, 0.49, -0.12, 0.12, 0.69, 0.12], color: 'role:linen' }, { shape: 'blob', box: [-0.17, 0.66, -0.17, 0.17, 0.95, 0.17], color: '#3f7f45' }],
  },
  'runner-rug': {
    footprint: [0.8, 2.5], height: 0.02, params: ['w', 'd', 'color'], tags: ['hall', 'kitchen', 'bedroom'],
    create(it, { std, box, group, colors, hex, mix }) {
      const w = it.w || 0.8, d = it.d || 2.4, g = group('Runner Rug');
      const col = it.color ? hex(it.color) : colors.rug;
      g.add(box(w, 0.012, d, std(col, { roughness: 1 }), 0, 0.006, 0, false));
      const band = std(mix(col, colors.linen, 0.5), { roughness: 1 }), fringe = std(colors.linen, { roughness: 1 });
      for (const s of [-1, 1]) {
        g.add(box(w, 0.013, 0.08, band, 0, 0.0065, s * (d / 2 - 0.14), false));
        g.add(box(w * 0.96, 0.008, 0.05, fringe, 0, 0.004, s * (d / 2 + 0.025), false));
      }
      return g;
    },
    iso: [{ shape: 'box', box: [-0.4, 0, -1.25, 0.4, 0.013, 1.25], color: 'role:rug' }],
  },
});

// =================================================================================================================
// Pass 4 (S3 compose): patterned rugs and a gallery wall, both painted by assets/props/patterns.ts (the rug
// patterns and the art-motif library), so a room's textiles and art vary by style and seed instead of repeating one
// runner and one sun-over-horizon print.
// =================================================================================================================
registerProps({
  // Patterned rug — pattern: solid | border | stripe | check | diamond | kilim | medallion | dots | abstract | play
  // (a kid's road rug); shape 'round' makes it a disc of diameter w. color is the ground; the figure takes the
  // house's rug, accent and fabric colours. One textured mesh (plus two fringes on a rectangle).
  'patterned-rug': {
    footprint: [2.0, 1.4], height: 0.02, params: ['w', 'd', 'pattern', 'shape', 'color'], tags: ['living', 'bedroom', 'dining', 'kids', 'study'],
    create(it, { THREE, std, box, group, colors, hex, mix }) {
      const round = it.shape === 'round', w = it.w || 2.0, d = round ? w : (it.d || 1.4), g = group(`Patterned Rug (${it.pattern || 'solid'})`);
      const ground = it.color ? hex(it.color) : mix(colors.linen, colors.rug, 0.35);
      const map = patternTexture(THREE, String(it.pattern || 'solid'), [ground, colors.rug, colors.accent, colors.fabric2], { w, d });
      const mat = std(0xffffff, { roughness: 1, map });
      if (round) { const m = new THREE.Mesh(new THREE.CylinderGeometry(w / 2, w / 2, 0.012, 48), mat); m.position.y = 0.006; m.receiveShadow = true; g.add(m); return g; }
      g.add(box(w, 0.012, d, mat, 0, 0.006, 0, false));
      const fringe = std(colors.linen, { roughness: 1 });
      for (const s of [-1, 1]) g.add(box(w * 0.96, 0.008, 0.05, fringe, 0, 0.004, s * (d / 2 + 0.025), false));
      return g;
    },
    iso: [{ shape: 'box', box: [-1, 0, -0.7, 1, 0.013, 0.7], color: 'role:rug' }],
  },
  // Gallery wall — three to five framed pieces hung as one cluster over a sofa, a bed or a console: w × h is the
  // cluster's extent, motifs a list (or a comma string) from the motif library, frame their colour. Wall-mounted
  // like wall-art: back at z = 0, `y` the cluster's centre height (default 1.5 above the floor origin).
  'gallery-wall': {
    footprint: [1.6, 0.04], height: 0.9, params: ['w', 'h', 'y', 'motifs', 'frame', 'color'], tags: ['living', 'bedroom', 'hall', 'dining', 'study'],
    create(it, { THREE, std, box, group, colors, hex, mix, rng }) {
      const W = it.w || 1.6, H = it.h || 0.9, cy = it.y !== undefined ? 0 : 1.5, g = group('Gallery Wall');
      const list = Array.isArray(it.motifs) ? it.motifs.map(String) : typeof it.motifs === 'string' ? it.motifs.split(',').map(x => x.trim()).filter(Boolean) : [];
      const pool = list.length ? list : ['botanical', 'line', 'abstract', 'landscape', 'geometric'];
      const frame = std(it.frame ? hex(it.frame) : colors.metal, { roughness: 0.45 });
      const bg = it.color ? hex(it.color) : mix(colors.fabric2, 0xffffff, 0.7);
      // a layout of frames on a 12 × 8 grid of the cluster (x0, y0, x1, y1), picked by the rng: a big piece and two or
      // three small ones round it, all on shared edges the way a hung gallery lines up
      const LAYOUTS = [
        [[0, 0, 7, 8], [7.5, 0, 12, 3.8], [7.5, 4.2, 12, 8]],
        [[0, 1, 3.6, 7], [4, 0, 8, 8], [8.4, 1, 12, 4.4], [8.4, 4.8, 12, 7]],
        [[0, 0, 5.6, 3.8], [0, 4.2, 5.6, 8], [6, 0, 12, 8]],
        [[0, 2, 3.4, 6], [3.8, 0, 8.2, 3.8], [3.8, 4.2, 8.2, 8], [8.6, 2, 12, 6]],
      ];
      const lay = LAYOUTS[Math.floor(rng() * LAYOUTS.length)];
      lay.forEach(([x0, y0, x1, y1], i) => {
        const fw = (x1 - x0) / 12 * W, fh = (y1 - y0) / 8 * H, fx = -W / 2 + (x0 + x1) / 24 * W, fy = cy + H / 2 - (y0 + y1) / 16 * H;
        g.add(box(fw, fh, 0.03, frame, fx, fy, 0.015));
        const motif = pool[(i + Math.floor(rng() * pool.length)) % pool.length];
        g.add(box(fw - 0.05, fh - 0.05, 0.01, std(0xffffff, { roughness: 0.9, map: motifTexture(THREE, motif, [bg, colors.accent, colors.fabric, colors.fabric2], { w: fw - 0.05, h: fh - 0.05 }) }), fx, fy, 0.033));
      });
      return g;
    },
    iso: [{ shape: 'box', box: [-0.8, 1.05, 0, 0.8, 1.95, 0.04], color: 'role:metal' }],
  },

  // ---- more of the small things on a surface (plan S3: the fleet's 84 vases were one type) ---------------------------------
  // Ceramic bowl — a wide low bowl, glazed in the accent (or it.color), empty.
  'ceramic-bowl': {
    footprint: [0.32, 0.32], height: 0.1, surface: true, params: ['color', 'r'], tags: ['living', 'dining', 'kitchen', 'hall'],
    create(it, { THREE, std, group, colors, hex }) {
      const r = it.r || 0.16, k = r / 0.16, g = group('Ceramic Bowl'), V = (x, y) => new THREE.Vector2(x * k, y);
      const glaze = std(it.color ? hex(it.color) : colors.accent, { roughness: 0.3, side: THREE.DoubleSide });
      const m = new THREE.Mesh(new THREE.LatheGeometry([V(0, 0), V(0.07, 0), V(0.1, 0.03), V(0.15, 0.08), V(0.16, 0.1), V(0.15, 0.1), V(0.14, 0.09), V(0.09, 0.045), V(0, 0.04)], 28), glaze);
      m.castShadow = true; m.receiveShadow = true; g.add(m); return g;
    },
    iso: [{ shape: 'cyl', box: [-0.16, 0, -0.16, 0.16, 0.1, 0.16], color: 'role:accent' }],
  },
  // Sculpture — a stack of three pebbles, or a ring on a plinth, in stone tones (modern, industrial, mid-century).
  'sculpture': {
    footprint: [0.22, 0.22], height: 0.36, surface: true, params: ['color'], tags: ['living', 'study', 'hall', 'office'],
    create(it, { THREE, std, box, group, colors, hex, mix, rng }) {
      const g = group('Sculpture'), stone = it.color ? hex(it.color) : mix(colors.fabric2, 0xffffff, 0.25), dark = mix(colors.wood, 0x000000, 0.2);
      g.add(box(0.16, 0.03, 0.16, std(dark, { roughness: 0.5 }), 0, 0.015, 0));
      if (rng() < 0.5) {
        for (const [r, y, sx, x] of [[0.08, 0.1, 1.15, 0], [0.06, 0.2, 1, 0.012], [0.04, 0.27, 0.9, -0.006]] as number[][]) {
          const m = new THREE.Mesh(new THREE.SphereGeometry(r, 14, 10), std(stone, { roughness: 0.75 })); m.scale.set(sx, 0.78, 1); m.position.set(x, y, 0); m.castShadow = true; g.add(m);
        }
      } else {
        const m = new THREE.Mesh(new THREE.TorusGeometry(0.085, 0.022, 10, 26), std(colors.metal, { metalness: 0.8, roughness: 0.3 })); m.position.set(0, 0.145, 0); m.castShadow = true; g.add(m);
        g.add(box(0.03, 0.09, 0.03, std(dark, { roughness: 0.5 }), 0, 0.075, 0));
      }
      return g;
    },
    iso: [{ shape: 'box', box: [-0.08, 0, -0.08, 0.08, 0.03, 0.08], color: 'role:wood' }, { shape: 'blob', box: [-0.09, 0.03, -0.09, 0.09, 0.32, 0.09], color: 'role:fabric2' }],
  },
  // Candelabra — a brass stem with three arms and tapers (traditional, mediterranean, cottage).
  'candelabra': {
    footprint: [0.32, 0.1], height: 0.36, surface: true, params: ['color'], tags: ['living', 'dining', 'hall'],
    create(it, { THREE, std, group, colors, hex }) {
      const g = group('Candelabra'), brass = std(colors.metal, { metalness: 0.8, roughness: 0.3 }), wax = std(it.color ? hex(it.color) : colors.linen, { roughness: 0.85 });
      const disc = (rt, rb, h, mat, x, y, z) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, 14), mat); m.position.set(x, y, z); m.castShadow = true; g.add(m); };
      disc(0.05, 0.06, 0.02, brass, 0, 0.01, 0); disc(0.012, 0.018, 0.16, brass, 0, 0.1, 0);
      for (const s of [-1, 0, 1]) {
        const x = s * 0.13, top = s ? 0.19 : 0.25, h = s ? 0.15 : 0.2;
        if (s) { const a = new THREE.Vector3(0, 0.12, 0), b = new THREE.Vector3(x, top - 0.02, 0), d = b.clone().sub(a); const m = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, d.length(), 6), brass); m.position.copy(a).add(b).multiplyScalar(0.5); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()); g.add(m); }
        disc(0.02, 0.014, 0.015, brass, x, top - 0.01, 0); disc(0.011, 0.011, h, wax, x, top + h / 2 - 0.005, 0);
      }
      return g;
    },
    iso: [{ shape: 'box', box: [-0.15, 0, -0.05, 0.15, 0.3, 0.05], color: 'role:metal' }],
  },
  // Flower jug — an enamelled jug with wildflowers (cottage, farmhouse, tropical).
  'flower-jug': {
    footprint: [0.26, 0.2], height: 0.42, surface: true, params: ['color', 'h'], tags: ['living', 'dining', 'kitchen', 'bedroom'],
    create(it, { THREE, std, group, colors, hex, rng }) {
      const g = group('Flower Jug'), V = (x, y) => new THREE.Vector2(x, y);
      const enamel = std(it.color ? hex(it.color) : colors.accent, { roughness: 0.35 });
      const jug = new THREE.Mesh(new THREE.LatheGeometry([V(0, 0), V(0.06, 0), V(0.085, 0.05), V(0.09, 0.1), V(0.07, 0.16), V(0.06, 0.2), V(0.075, 0.22)], 18), enamel); jug.castShadow = true; g.add(jug);
      const handle = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.008, 6, 14, Math.PI), enamel); handle.rotation.z = -Math.PI / 2; handle.position.set(0.085, 0.12, 0); g.add(handle);
      const stem = std(0x4d7c3a, { roughness: 0.9 }), leaf = std(pick(rng, GREENS), { roughness: 0.8, flatShading: true });
      const PETALS = [0xf9a8d4, 0xfde68a, 0xffffff, 0xc4b5fd, 0xfdba74];
      const n = 5 + Math.floor(rng() * 3), a0 = rng() * Math.PI * 2;
      for (let i = 0; i < n; i++) {
        const a = a0 + i * 2.4, lean = 0.1 + rng() * 0.32, len = 0.14 + rng() * 0.1, sx = Math.sin(a) * lean, sz = Math.cos(a) * lean;
        const s = group('Stem'); s.position.set(0, 0.2, 0); s.rotation.set(sz, 0, -sx); g.add(s);
        s.add(strut(THREE, [0, 0, 0], [0, len, 0], 0.003, stem, 5));
        const hd = new THREE.Mesh(new THREE.SphereGeometry(0.026 + rng() * 0.012, 8, 6), std(pick(rng, PETALS), { roughness: 0.7, flatShading: true })); hd.position.y = len; hd.scale.y = 0.7; hd.castShadow = true; s.add(hd);
        const lf = new THREE.Mesh(new THREE.SphereGeometry(0.025, 6, 4), leaf); lf.scale.set(0.5, 0.15, 1.6); lf.position.y = len * 0.45; lf.rotation.y = a; s.add(lf);
      }
      return g;
    },
    iso: [{ shape: 'cyl', box: [-0.09, 0, -0.09, 0.09, 0.22, 0.09], color: 'role:accent' }, { shape: 'blob', box: [-0.15, 0.22, -0.15, 0.15, 0.4, 0.15], color: '#f9a8d4' }],
  },
  // Terrarium — a glazed geometric case round three succulents on pebbles (modern, scandi, industrial).
  'terrarium': {
    footprint: [0.24, 0.24], height: 0.3, surface: true, params: ['color'], tags: ['living', 'study', 'kitchen', 'office'],
    create(it, { THREE, std, box, group, colors, hex, rng }) {
      const g = group('Terrarium'), frame = std(it.color ? hex(it.color) : colors.metal, { metalness: 0.7, roughness: 0.35 });
      const glass = std(0xdbeafe, { transparent: true, opacity: 0.16, roughness: 0.05, metalness: 0 });
      const s = 0.2, h = 0.24;
      for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) g.add(box(0.008, h, 0.008, frame, sx * s / 2, h / 2 + 0.02, sz * s / 2));
      for (const y of [0.02, h + 0.02]) for (const [w, d, x, z] of [[s, 0.008, 0, -s / 2], [s, 0.008, 0, s / 2], [0.008, s, -s / 2, 0], [0.008, s, s / 2, 0]] as number[][]) g.add(box(w, 0.008, d, frame, x, y, z));
      const panes = box(s, h, s, glass, 0, h / 2 + 0.02, 0, false); panes.receiveShadow = false; g.add(panes);
      g.add(box(s - 0.01, 0.03, s - 0.01, std(0xd6d3d1, { roughness: 1 }), 0, 0.035, 0));
      const leaf = std(pick(rng, [0x6a994e, 0x7fa66a, 0x588157]), { roughness: 0.6, flatShading: true });
      for (const [x, z, r] of [[-0.04, -0.03, 0.045], [0.045, 0.02, 0.038], [-0.02, 0.05, 0.03]] as number[][]) {
        const m = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 1), leaf); m.scale.y = 0.8; m.position.set(x, 0.05 + r * 0.7, z); m.castShadow = true; g.add(m);
      }
      return g;
    },
    iso: [{ shape: 'box', box: [-0.1, 0, -0.1, 0.1, 0.26, 0.1], color: '#dbeafe' }, { shape: 'blob', box: [-0.08, 0.04, -0.08, 0.08, 0.13, 0.08], color: '#6a994e' }],
  },
  // Table clock — an arched wooden mantel clock, a white dial and brass hands.
  'table-clock': {
    footprint: [0.2, 0.09], height: 0.26, surface: true, params: ['color'], tags: ['living', 'study', 'bedroom', 'hall'],
    create(it, { THREE, std, box, group, colors, hex }) {
      const g = group('Table Clock'), wood = std(it.color ? hex(it.color) : colors.wood, { roughness: 0.45 });
      g.add(box(0.2, 0.015, 0.09, wood, 0, 0.0075, 0));
      g.add(box(0.17, 0.13, 0.08, wood, 0, 0.08, 0));
      const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.085, 0.08, 20, 1, false, Math.PI / 2, Math.PI), wood); cap.rotation.x = Math.PI / 2; cap.position.set(0, 0.145, 0); cap.castShadow = true; g.add(cap);
      const dial = new THREE.Mesh(new THREE.CylinderGeometry(0.068, 0.068, 0.006, 24), std(0xf1efe8, { roughness: 0.6 })); dial.rotation.x = Math.PI / 2; dial.position.set(0, 0.145, 0.041); g.add(dial);
      const hand = std(colors.metal, { metalness: 0.6, roughness: 0.4 });
      g.add(box(0.005, 0.05, 0.004, hand, 0, 0.17, 0.046)); const h2 = box(0.004, 0.035, 0.004, hand, 0.014, 0.14, 0.046); h2.rotation.z = -1.0; g.add(h2);
      return g;
    },
    iso: [{ shape: 'box', box: [-0.1, 0, -0.045, 0.1, 0.16, 0.045], color: 'role:wood' }, { shape: 'cyl', box: [-0.085, 0.08, -0.04, 0.085, 0.23, 0.04], color: 'role:wood' }],
  },
  // Desk globe — a globe tilted in a brass meridian ring on a round foot (study, library, traditional).
  'desk-globe': {
    footprint: [0.3, 0.3], height: 0.38, surface: true, params: ['color'], tags: ['study', 'living', 'office'],
    create(it, { THREE, std, group, colors, hex }) {
      const g = group('Desk Globe'), brass = std(colors.metal, { metalness: 0.8, roughness: 0.3 });
      const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.085, 0.025, 20), std(colors.wood, { roughness: 0.5 })); foot.position.y = 0.0125; g.add(foot);
      const axis = group('Tilted'); axis.position.set(0, 0.2, 0); axis.rotation.z = 0.41; g.add(axis);
      const ocean = std(it.color ? hex(it.color) : 0x3f6f8f, { roughness: 0.5 }), land = std(0xb9a878, { roughness: 0.7 });
      axis.add(new THREE.Mesh(new THREE.SphereGeometry(0.13, 24, 16), ocean));
      for (const [ps, pl, ts, tl] of [[0.3, 1.5, 0.9, 0.9], [2.4, 1.3, 0.5, 1.0], [4.2, 1.6, 1.3, 0.8]]) { const c = new THREE.Mesh(new THREE.SphereGeometry(0.1315, 12, 8, ps, pl, ts, tl), land); axis.add(c); }
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.145, 0.006, 6, 30), brass); ring.rotation.y = Math.PI / 2; axis.add(ring);
      for (const s of [-1, 1]) { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.02, 8), brass); p.position.y = s * 0.15; axis.add(p); }
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.18, 8), brass); post.position.set(0.02, 0.1, 0); post.rotation.z = -0.1; g.add(post);
      return g;
    },
    iso: [{ shape: 'cyl', box: [-0.085, 0, -0.085, 0.085, 0.03, 0.085], color: 'role:wood' }, { shape: 'blob', box: [-0.14, 0.07, -0.14, 0.14, 0.34, 0.14], color: '#3f6f8f' }],
  },

  // ---- more art (the motif library is in patterns.ts) ---------------------------------------------------------------------
  // Arch mirror — a tall arched wall mirror in a slim frame (bedroom, hall, bath). w × h, `y` the centre's mount height.
  'arch-mirror': {
    footprint: [0.7, 0.05], height: 1.3, params: ['w', 'h', 'y', 'color'], tags: ['hall', 'bedroom', 'bathroom', 'living'],
    create(it, { THREE, std, group, colors, hex }) {
      const w = it.w || 0.7, h = it.h || 1.3, cy = it.y !== undefined ? 0 : 1.5, g = group('Arch Mirror');
      const shapeOf = (ww: number, hh: number) => { const sh = new THREE.Shape(), r = ww / 2, yb = -hh / 2, yc = hh / 2 - r; sh.moveTo(-r, yb); sh.lineTo(r, yb); sh.lineTo(r, yc); sh.absarc(0, yc, r, 0, Math.PI, false); sh.lineTo(-r, yb); return sh; };
      const frame = new THREE.Mesh(new THREE.ExtrudeGeometry(shapeOf(w, h), { depth: 0.035, bevelEnabled: false, curveSegments: 20 }), std(it.color ? hex(it.color) : colors.metal, { metalness: 0.6, roughness: 0.4 }));
      frame.position.set(0, cy, 0); frame.castShadow = true; g.add(frame);
      const glass = new THREE.Mesh(new THREE.ExtrudeGeometry(shapeOf(w - 0.05, h - 0.05), { depth: 0.006, bevelEnabled: false, curveSegments: 20 }), std(0xd4e4f0, { metalness: 1, roughness: 0.04 }));
      glass.position.set(0, cy, 0.036); g.add(glass);
      return g;
    },
    iso: [{ shape: 'box', box: [-0.35, 0.85, 0, 0.35, 2.15, 0.04], color: 'role:metal' }, { shape: 'box', box: [-0.31, 0.89, 0.03, 0.31, 2.1, 0.045], color: '#dbeafe' }],
  },
  // Triptych — three tall canvases hung as one, each its own motif (living, bedroom, dining). w is the whole width.
  'triptych': {
    footprint: [1.5, 0.04], height: 0.7, params: ['w', 'h', 'y', 'motif', 'frame'], tags: ['living', 'bedroom', 'dining', 'hall'],
    create(it, { THREE, std, box, group, colors, hex, mix, rng }) {
      const W = it.w || 1.5, H = it.h || 0.7, cy = it.y !== undefined ? 0 : 1.5, g = group('Triptych');
      const gap = 0.03, pw = (W - 2 * gap) / 3, frame = std(it.frame ? hex(it.frame) : colors.wood, { roughness: 0.5 });
      const bg = mix(colors.fabric2, 0xffffff, 0.62);
      const start = Math.floor(rng() * ART_MOTIFS.length), same = typeof it.motif === 'string' && ART_MOTIFS.includes(it.motif);
      for (let i = 0; i < 3; i++) {
        const x = -W / 2 + pw / 2 + i * (pw + gap), motif = same ? it.motif : ART_MOTIFS[(start + i * 3) % ART_MOTIFS.length];
        g.add(box(pw, H, 0.035, frame, x, cy, 0.0175));
        g.add(box(pw - 0.04, H - 0.04, 0.01, std(0xffffff, { roughness: 0.9, map: motifTexture(THREE, motif, [bg, colors.accent, colors.fabric, colors.fabric2], { w: pw - 0.04, h: H - 0.04 }) }), x, cy, 0.038));
      }
      return g;
    },
    iso: [{ shape: 'box', box: [-0.75, 1.15, 0, 0.75, 1.85, 0.04], color: 'role:wood' }],
  },

  // ---- more rugs (patterned-rug takes the pattern; these have shapes and piles of their own) ---------------------------------
  // Shag rug — a deep pile, a soft rounded edge (modern, scandi, mid-century). w × d.
  'shag-rug': {
    footprint: [2.4, 1.7], height: 0.04, params: ['w', 'd', 'color'], tags: ['living', 'bedroom', 'kids'],
    create(it, { THREE, std, box, group, colors, hex, mix }) {
      const w = it.w || 2.4, d = it.d || 1.7, g = group('Shag Rug');
      const ground = it.color ? hex(it.color) : mix(colors.linen, colors.rug, 0.25);
      const mat = std(0xffffff, { roughness: 1, map: patternTexture(THREE, 'shag', [ground, mix(ground, 0xffffff, 0.3), colors.accent, colors.fabric2], { w, d }) });
      g.add(box(w, 0.034, d, mat, 0, 0.017, 0, false));
      g.add(box(w - 0.06, 0.012, d - 0.06, mat, 0, 0.038, 0, false));   // the pile stands proud of a tapered edge
      return g;
    },
    iso: [{ shape: 'box', box: [-1.2, 0, -0.85, 1.2, 0.04, 0.85], color: 'role:rug' }],
  },
  // Flatweave rug — a dhurrie: banded border, two centre bands, tassels at both ends (farmhouse, tropical, industrial). w × d.
  'flatweave-rug': {
    footprint: [2.4, 1.78], height: 0.012, params: ['w', 'd', 'color'], tags: ['living', 'bedroom', 'hall', 'kitchen'],
    create(it, { THREE, std, box, group, colors, hex, mix }) {
      const w = it.w || 2.4, d = it.d || 1.6, g = group('Flatweave Rug');
      const ground = it.color ? hex(it.color) : mix(colors.linen, colors.rug, 0.4);
      const mat = std(0xffffff, { roughness: 1, map: patternTexture(THREE, 'flatweave', [ground, colors.rug, colors.accent, colors.fabric2], { w, d }) });
      g.add(box(w, 0.012, d, mat, 0, 0.006, 0, false));
      const tassel = std(colors.linen, { roughness: 1 });
      for (const s of [-1, 1]) g.add(box(w * 0.98, 0.006, 0.09, tassel, 0, 0.003, s * (d / 2 + 0.045), false));   // the tassels, as one strip an end
      return g;
    },
    iso: [{ shape: 'box', box: [-1.2, 0, -0.8, 1.2, 0.013, 0.8], color: 'role:rug' }],
  },
  // Hide rug — a cowhide: an irregular outline, cream with dark patches (industrial, mid-century, tropical). w × d.
  'hide-rug': {
    footprint: [1.6, 2.0], height: 0.014, params: ['w', 'd', 'color'], tags: ['living', 'bedroom', 'study'],
    create(it, { THREE, std, group, colors, hex, mix, rng }) {
      const w = it.w || 1.6, d = it.d || 2.0, g = group('Hide Rug'), n = 44;
      const ground = it.color ? hex(it.color) : mix(colors.linen, 0xf3ead8, 0.6);
      // the outline: an ellipse, its radius wobbling, two hind and two fore "legs" pulling it out at the corners
      const pts = [], ph = rng() * 6;
      for (let i = 0; i < n; i++) {
        const t = i / n * Math.PI * 2, lobe = 0.14 * Math.max(0, Math.cos(2 * t - Math.PI / 2)) * Math.max(0, Math.abs(Math.sin(t)) > 0.3 ? 1 : 0.3);
        const r = 0.5 * (1 + 0.06 * Math.sin(3 * t + ph) + 0.04 * Math.sin(7 * t + ph * 2) + lobe * 0.4) / 1.06;
        pts.push(new THREE.Vector2(Math.cos(t) * r, Math.sin(t) * r));
      }
      const shape = new THREE.Shape(pts), geo = new THREE.ShapeGeometry(shape, 1), uv = geo.attributes.uv, pos = geo.attributes.position;
      for (let i = 0; i < pos.count; i++) { uv.setXY(i, pos.getX(i) + 0.5, pos.getY(i) + 0.5); pos.setXYZ(i, pos.getX(i) * w, pos.getY(i) * d, 0); }
      geo.rotateX(-Math.PI / 2); geo.computeVertexNormals();
      const map = patternTexture(THREE, 'hide', [ground, colors.rug, colors.accent, colors.wood], { w, d });
      const m = new THREE.Mesh(geo, std(0xffffff, { roughness: 0.9, map })); m.position.y = 0.012; m.receiveShadow = true; g.add(m);
      return g;
    },
    iso: [{ shape: 'blob', box: [-0.8, 0, -1, 0.8, 0.014, 1], color: 'role:rug' }],
  },
  // Bath rug — a small round shag rug (the bath mat's alternative). r is its radius.
  'bath-rug': {
    footprint: [0.7, 0.7], height: 0.03, params: ['r', 'color'], tags: ['bathroom'],
    create(it, { THREE, std, group, colors, hex, mix }) {
      const r = it.r || 0.35, g = group('Bath Rug');
      const ground = it.color ? hex(it.color) : mix(colors.linen, colors.accent, 0.25);
      const mat = std(0xffffff, { roughness: 1, map: patternTexture(THREE, 'shag', [ground, mix(ground, 0xffffff, 0.3), colors.accent, colors.fabric2], { w: 2 * r, d: 2 * r }) });
      const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.028, 32), mat); m.position.y = 0.014; m.receiveShadow = true; g.add(m); return g;
    },
    iso: [{ shape: 'cyl', box: [-0.35, 0, -0.35, 0.35, 0.03, 0.35], color: 'role:rug' }],
  },

  // Framed print — a small picture in a thin frame with a wide white mount (cottage, farmhouse, scandi, craftsman).
  'framed-print': {
    footprint: [0.6, 0.04], height: 0.8, params: ['w', 'h', 'y', 'motif', 'frame'], tags: ['living', 'bedroom', 'hall', 'study', 'dining'],
    create(it, { THREE, std, box, group, colors, hex, mix, rng }) {
      const w = it.w || 0.6, h = it.h || 0.8, cy = it.y !== undefined ? 0 : 1.5, g = group('Framed Print');
      const bar = 0.02, mount = 0.07, frame = std(it.frame ? hex(it.frame) : colors.metal, { roughness: 0.45, metalness: 0.3 });
      g.add(box(w, h, 0.03, frame, 0, cy, 0.015));
      g.add(box(w - 2 * bar, h - 2 * bar, 0.01, std(0xf3f1ea, { roughness: 0.95 }), 0, cy, 0.031));
      const pw = w - 2 * (bar + mount), ph = h - 2 * (bar + mount), motif = typeof it.motif === 'string' && ART_MOTIFS.includes(it.motif) ? it.motif : ART_MOTIFS[Math.floor(rng() * ART_MOTIFS.length)];
      g.add(box(pw, ph, 0.006, std(0xffffff, { roughness: 0.9, map: motifTexture(THREE, motif, [mix(colors.fabric2, 0xffffff, 0.62), colors.accent, colors.fabric, colors.fabric2], { w: pw, h: ph }) }), 0, cy, 0.038));
      return g;
    },
    iso: [{ shape: 'box', box: [-0.3, 1.1, 0, 0.3, 1.9, 0.04], color: 'role:metal' }],
  },
  // Canvas art — a frameless gallery-wrapped canvas, deep on the wall (modern, industrial, mid-century). w × h.
  'canvas-art': {
    footprint: [0.9, 0.05], height: 0.6, params: ['w', 'h', 'y', 'motif'], tags: ['living', 'bedroom', 'study', 'dining'],
    create(it, { THREE, std, box, group, colors, hex, mix, rng }) {
      const w = it.w || 0.9, h = it.h || 0.6, cy = it.y !== undefined ? 0 : 1.5, g = group('Canvas Art');
      const motif = typeof it.motif === 'string' && ART_MOTIFS.includes(it.motif) ? it.motif : ART_MOTIFS[Math.floor(rng() * ART_MOTIFS.length)];
      const map = motifTexture(THREE, motif, [mix(colors.fabric2, 0xffffff, 0.55), colors.accent, colors.fabric, colors.fabric2], { w, h });
      g.add(box(w, h, 0.04, std(mix(colors.fabric2, 0xffffff, 0.5), { roughness: 0.95 }), 0, cy, 0.02));      // the wrapped edge
      g.add(box(w - 0.004, h - 0.004, 0.004, std(0xffffff, { roughness: 0.9, map }), 0, cy, 0.042));
      return g;
    },
    iso: [{ shape: 'box', box: [-0.45, 1.2, 0, 0.45, 1.8, 0.045], color: 'role:fabric2' }],
  },
  // Plate set — a cluster of decorative plates on the wall (farmhouse, cottage, mediterranean, craftsman). w × h is the cluster.
  'plate-set': {
    footprint: [0.9, 0.04], height: 0.8, params: ['w', 'h', 'y', 'color'], tags: ['dining', 'kitchen', 'living', 'hall'],
    create(it, { THREE, std, group, colors, hex, mix, rng }) {
      const w = it.w || 0.9, h = it.h || 0.8, cy = it.y !== undefined ? 0 : 1.5, g = group('Plate Set');
      const tones = [it.color ? hex(it.color) : colors.linen, colors.accent, mix(colors.fabric2, 0xffffff, 0.4), colors.wood];
      // a big plate and five round it, on a loose ring
      const rings = [[0, 0, 0.16], [-0.3, 0.06, 0.1], [0.28, 0.1, 0.11], [-0.14, -0.28, 0.09], [0.16, -0.27, 0.1], [0.02, 0.29, 0.085]];
      for (const [x, y, r] of rings) {
        const R = r * Math.min(w / 0.9, h / 0.8) * 1.0, px = x * w / 0.9, py = y * h / 0.8, tone = tones[Math.floor(rng() * tones.length)];
        g.add(disc(THREE, R, 0.02, std(tone, { roughness: 0.3 }), px, cy + py, 0.01));
        g.add(disc(THREE, R * 0.62, 0.006, std(mix(tone, 0x000000, 0.12), { roughness: 0.35 }), px, cy + py, 0.022));
      }
      return g;
    },
    iso: [{ shape: 'blob', box: [-0.45, 1.1, 0, 0.45, 1.9, 0.03], color: 'role:linen' }],
  },
  // Bath runner — a long shag runner along a double vanity or a tub (the bath mat's alternative). w × d.
  'bath-runner': {
    footprint: [0.55, 1.3], height: 0.03, params: ['w', 'd', 'color'], tags: ['bathroom'],
    create(it, { THREE, std, box, group, colors, hex, mix }) {
      const w = it.w || 0.55, d = it.d || 1.3, g = group('Bath Runner');
      const ground = it.color ? hex(it.color) : mix(colors.linen, colors.rug, 0.3);
      const mat = std(0xffffff, { roughness: 1, map: patternTexture(THREE, 'shag', [ground, mix(ground, 0xffffff, 0.3), colors.accent, colors.fabric2], { w, d }) });
      g.add(box(w, 0.028, d, mat, 0, 0.014, 0, false)); return g;
    },
    iso: [{ shape: 'box', box: [-0.275, 0, -0.65, 0.275, 0.03, 0.65], color: 'role:rug' }],
  },

  // Play rug — a kid's road-and-hopscotch rug with a soft rounded border (kids' rooms, playrooms). w × d.
  'play-rug': {
    footprint: [2.0, 1.4], height: 0.02, params: ['w', 'd', 'color'], tags: ['kids', 'living'],
    create(it, { THREE, std, box, group, colors, hex, mix }) {
      const w = it.w || 2.0, d = it.d || 1.4, g = group('Play Rug');
      const ground = it.color ? hex(it.color) : mix(colors.linen, colors.rug, 0.35);
      g.add(box(w, 0.012, d, std(0xffffff, { roughness: 1, map: patternTexture(THREE, 'play', [ground, colors.rug, colors.accent, colors.fabric2], { w, d }) }), 0, 0.006, 0, false));
      return g;
    },
    iso: [{ shape: 'box', box: [-1, 0, -0.7, 1, 0.013, 0.7], color: 'role:rug' }],
  },
});
export { RUG_PATTERNS, ART_MOTIFS };
