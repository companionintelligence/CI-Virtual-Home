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
    create(it, { THREE, std, box, group, colors, hex, mix, rng }) {
      const w = it.w || 0.7, d = it.d || 0.5, g = group('Throw Blanket');
      const col = it.color ? hex(it.color) : colors.fabric2;
      const fab = std(col, { roughness: 0.95 }), fringe = std(mix(col, 0xffffff, 0.45), { roughness: 1 });
      // folded in half and in half again: two layers sharing one rounded fold at −z, the open (fringed) end at +z,
      // the top layer's end rolled over — the rolls are what make a box stack read as cloth
      const t1 = 0.05, t2 = 0.045, R = (t1 + t2) / 2, z0 = -d / 2 + R;   // z0: the fold's axis; the flat layers run from there
      const roll = (r, len, y, z) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 14), fab); m.rotation.z = Math.PI / 2; m.position.set(0, y, z); m.castShadow = true; m.receiveShadow = true; return m; };
      g.add(box(w, t1, d / 2 - z0, fab, 0, t1 / 2, (z0 + d / 2) / 2));            // bottom layer, fold to fringe
      const d2 = d * 0.62 - R;                                                       // top layer, fold to its rolled end
      g.add(box(w * 0.97, t2, d2, fab, 0, t1 + t2 / 2, z0 + d2 / 2));
      g.add(roll(R, w * 0.97, R, z0));                                               // the fold
      g.add(roll(0.035, w * 0.94, t1 + t2 + 0.03, z0 + d2 - 0.02));                 // the rolled end, sunk 5 mm into the top layer
      g.add(box(w * 0.98, 0.014, 0.05, fringe, 0, 0.007, d / 2 + 0.02));            // tassel fringe on the open end
      g.rotation.y = jit(rng, 0.08);
      return g;
    },
    iso: [{ shape: 'box', box: [-0.35, 0, -0.25, 0.35, 0.05, 0.27], color: 'role:fabric2' }, { shape: 'box', box: [-0.34, 0.05, -0.25, 0.34, 0.095, 0.06], color: 'role:fabric2' }, { shape: 'box', box: [-0.33, 0.09, 0.005, 0.33, 0.16, 0.075], color: 'role:fabric2' }],
  },
  'cushion-set': {
    footprint: [1.3, 0.25], height: 0.44, params: ['w', 'y', 'color'], tags: ['living', 'bedroom', 'kids'],
    create(it, { std, box, group, colors, hex, rng }) {
      const w = it.w || 1.3, g = group('Cushion Set');
      const size = 0.42, t = 0.11, lean = 0.28, n = 3, step = (w - size) / (n - 1);
      // three cushions leaning back, a seeded mix of the two fabrics and the accent; it.color pins the middle one
      const mats = [colors.fabric, colors.accent, colors.fabric2].map(c => std(c, { roughness: 0.95 }));
      const order = rng() < 0.5 ? [0, 1, 2] : [2, 1, 0];
      const gap = t * Math.sin(lean), foot = t * Math.cos(lean);   // a leaning slab touches along its back edge; its front edge sits `gap` up
      for (let i = 0; i < n; i++) {
        const mat = it.color && i === 1 ? std(hex(it.color), { roughness: 0.95 }) : mats[order[i]];
        const c = group('Cushion'), s = group('Slab');
        c.position.set(-w / 2 + size / 2 + i * step + jit(rng, 0.01), 0, 0);
        c.rotation.y = jit(rng, 0.12);                        // yaw on the parent, so the contact edge stays on the floor
        s.rotation.x = -lean + jit(rng, 0.04);                // pivot at the bottom-BACK edge (z = 0): tips back toward −z, nothing below y = 0
        s.add(box(size, size, t, mat, 0, size / 2, t / 2));
        // a piped band on the accent cushion
        if (order[i] === 1 && !(it.color && i === 1)) s.add(box(size * 0.9, 0.05, 0.006, std(colors.linen, { roughness: 0.9 }), 0, size * 0.5, t + 0.003));
        c.add(s);
        c.add(box(size * 0.9, gap, foot * 0.8, mat, 0, gap / 2, foot * 0.4, false));   // the squashed bottom fills the wedge under the lean
        g.add(c);
      }
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
    create(it, { THREE, std, box, group, colors, hex }) {
      const w = it.w || 2.0, h = it.h || 2.4, g = group('Curtains');
      const fab = std(it.color ? hex(it.color) : colors.fabric2, { roughness: 0.95 });
      const metal = std(colors.metal, { metalness: 0.8, roughness: 0.3 });
      const zr = 0.09, ry = h + 0.03;   // the rail stands 9 cm off the wall, just above the panels
      const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, w + 0.06, 10), metal); rail.rotation.z = Math.PI / 2; rail.position.set(0, ry, zr); rail.castShadow = true; g.add(rail);
      for (const s of [-1, 1]) {
        const fin = new THREE.Mesh(new THREE.SphereGeometry(0.022, 10, 8), metal); fin.position.set(s * (w / 2 + 0.03), ry, zr); g.add(fin);
        g.add(box(0.02, 0.02, zr, metal, s * (w / 2 - 0.12), ry, zr / 2));
      }
      // two pleated panels drawn to the sides: alternating pleats straddle the rail line
      const pw = Math.min(0.32 * w, 0.75), n = Math.max(4, Math.round(pw / 0.09)), pleat = pw / n;
      for (const s of [-1, 1]) for (let i = 0; i < n; i++) {
        const x = s * (w / 2 - (i + 0.5) * pleat);
        g.add(box(pleat + 0.004, h - 0.01, 0.05, fab, x, (h + 0.03) / 2, zr + (i % 2 ? 0.015 : -0.015)));
      }
      return g;
    },
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
});
export { RUG_PATTERNS, ART_MOTIFS };
