// Tables — the flat surfaces a room gathers round. Every prop: origin at the floor centre of its footprint, faces
// SOUTH (+z) at rot 0 (drawer fronts, knee-holes and mirrors open toward +z; a console's back sits at −z, against
// the wall). Tops at ~0.75 m, bar height ~1.05 m. Big surfaces take role colours (ctx.colors) or it.color; only
// knobs, glass and bowls use literals. Seeded variation comes from ctx.rng — never Math.random.
import { registerProps } from './registry.js';

// four legs at the corners of a w × d top, inset from the edges
const corners = (w, d, inset) => [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([sx, sz]) => [sx * (w / 2 - inset), sz * (d / 2 - inset)]);
const cyl = (THREE, r0, r1, h, mat, x, y, z, seg = 16) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(r0, r1, h, seg), mat); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; return m; };
// a pale metallic disc that reads as glass — the IBL gives it its reflections
const mirrorMat = (std, THREE) => std(0xdbe7ee, { metalness: 0.95, roughness: 0.04 });
// a small dining chair whose seat opens toward +z: seat, back, one pedestal leg on a disc (4 meshes)
function diningChair({ THREE, std, box, group, colors }, fabricMat, legMat) {
  const c = group('Chair');
  c.add(box(0.42, 0.04, 0.4, fabricMat, 0, 0.45, 0));
  c.add(box(0.42, 0.4, 0.04, fabricMat, 0, 0.66, -0.18));
  c.add(cyl(THREE, 0.015, 0.015, 0.43, legMat, 0, 0.215, 0, 8));
  c.add(cyl(THREE, 0.16, 0.18, 0.015, legMat, 0, 0.0075, 0, 16));
  return c;
}

registerProps({
  // r: top radius; seats: chairs pulled up round it (0 by default — chairs add ~0.5 m to the footprint all round)
  'round-dining-table': {
    footprint: [1.2, 1.2], height: 0.75, params: ['r', 'seats', 'color'], tags: ['dining', 'kitchen'],
    create(it, ctx) {
      const { THREE, std, group, colors, hex } = ctx;
      const r = it.r || 0.6, seats = Math.min(8, Math.max(0, it.seats | 0)), g = group('Round Dining Table');
      const wood = std(it.color ? hex(it.color) : colors.wood, { roughness: 0.4 });
      const metal = std(colors.metal, { metalness: 0.8, roughness: 0.3 });
      g.add(cyl(THREE, r, r, 0.04, wood, 0, 0.73, 0, 40));                     // top
      g.add(cyl(THREE, r - 0.05, r - 0.05, 0.05, wood, 0, 0.685, 0, 40));      // thick edge under it
      g.add(cyl(THREE, 0.05, 0.075, 0.64, metal, 0, 0.34, 0, 20));            // pedestal column
      g.add(cyl(THREE, r * 0.5, r * 0.58, 0.03, metal, 0, 0.015, 0, 36));     // base disc
      if (seats) {
        const fabric = std(colors.fabric, { roughness: 0.8 });
        for (let i = 0; i < seats; i++) {
          const a = (i / seats) * Math.PI * 2 + Math.PI / 2, R = r + 0.3;
          const c = diningChair(ctx, fabric, metal);
          c.position.set(Math.cos(a) * R, 0, Math.sin(a) * R);
          c.rotation.y = Math.atan2(-Math.cos(a), -Math.sin(a));   // seat opens toward the table
          g.add(c);
        }
      }
      return g;
    },
    iso: [
      { shape: 'cyl', box: [-0.6, 0.69, -0.6, 0.6, 0.75, 0.6], color: 'role:wood' },
      { shape: 'cyl', box: [-0.08, 0, -0.08, 0.08, 0.69, 0.08], color: 'role:metal' },
    ],
  },

  // w: length; slim top on four legs with a low shelf, back to the wall at −z
  'console-table': {
    footprint: [1.2, 0.35], height: 0.8, params: ['w', 'color'], tags: ['living', 'hall', 'bedroom', 'dining'],
    create(it, { THREE, std, box, group, colors, hex, rng }) {
      const w = it.w || 1.2, d = 0.35, g = group('Console Table');
      const wood = std(it.color ? hex(it.color) : colors.wood, { roughness: 0.45 });
      const metal = std(colors.metal, { metalness: 0.8, roughness: 0.3 });
      g.add(box(w, 0.035, d, wood, 0, 0.7825, 0));                              // top
      g.add(box(w - 0.12, 0.02, d - 0.1, wood, 0, 0.16, 0));                    // low shelf
      for (const [x, z] of corners(w, d, 0.04)) g.add(box(0.03, 0.765, 0.03, metal, x, 0.3825, z));
      for (const z of [-1, 1]) g.add(box(w - 0.08, 0.02, 0.02, metal, 0, 0.16, z * (d / 2 - 0.04)));   // shelf rails
      // a bowl toward one end, where the rng puts it
      const bowl = cyl(THREE, 0.11, 0.07, 0.05, std(colors.accent, { roughness: 0.35 }), (rng() - 0.5) * (w - 0.5), 0.825, 0, 24);
      g.add(bowl);
      return g;
    },
    iso: [
      { shape: 'box', box: [-0.6, 0.76, -0.175, 0.6, 0.8, 0.175], color: 'role:wood' },
      { shape: 'box', box: [-0.54, 0.15, -0.125, 0.54, 0.17, 0.125], color: 'role:wood' },
    ],
  },

  // bedside cabinet: two drawer fronts on +z, a timber top, a book the rng leaves on it
  'nightstand': {
    footprint: [0.5, 0.4], height: 0.55, params: ['color'], tags: ['bedroom', 'guest', 'kids'],
    create(it, { THREE, std, box, group, colors, hex, mix, rng }) {
      const w = 0.5, d = 0.4, g = group('Nightstand');
      const body = it.color ? hex(it.color) : colors.cabinet;
      const cab = std(body, { roughness: 0.6 });
      const drawer = std(mix(body, 0xffffff, 0.08), { roughness: 0.55 });
      const wood = std(colors.wood, { roughness: 0.45 });
      const metal = std(colors.metal, { metalness: 0.8, roughness: 0.3 });
      g.add(box(w, 0.4, d, cab, 0, 0.32, 0));                                   // carcass 0.12–0.52
      g.add(box(w + 0.02, 0.03, d + 0.02, wood, 0, 0.535, 0));                  // top 0.52–0.55
      for (const y of [0.42, 0.22]) {                                            // two drawer fronts on the +z face
        g.add(box(w - 0.06, 0.16, 0.015, drawer, 0, y, d / 2 + 0.0075));
        g.add(box(0.1, 0.014, 0.014, metal, 0, y, d / 2 + 0.022));             // bar pull
      }
      for (const [x, z] of corners(w, d, 0.05)) g.add(cyl(THREE, 0.018, 0.012, 0.12, metal, x, 0.06, z, 8));   // feet taper to the floor
      // a paperback, colour drawn from a small seeded set
      const bookColors = [0xb45309, 0x1e3a5f, 0x8a9a5b, 0xb5654a, 0xf1f5f9];
      const book = box(0.13, 0.025, 0.18, std(bookColors[Math.floor(rng() * bookColors.length)], { roughness: 0.85 }), (rng() - 0.5) * 0.2, 0.5625, (rng() - 0.5) * 0.1);
      book.rotation.y = (rng() - 0.5) * 0.5; g.add(book);
      return g;
    },
    iso: [
      { shape: 'box', box: [-0.25, 0.12, -0.2, 0.25, 0.52, 0.2], color: 'role:cabinet' },
      { shape: 'box', box: [-0.26, 0.52, -0.21, 0.26, 0.55, 0.21], color: 'role:wood' },
    ],
  },

  // three U-frame tables, the smaller two pulled out toward +z so the set reads as one piece
  'nesting-tables': {
    footprint: [0.6, 0.65], height: 0.5, params: ['color'], tags: ['living', 'bedroom'],
    create(it, { THREE, std, box, group, colors, hex, mix, rng }) {
      const g = group('Nesting Tables');
      const base = it.color ? hex(it.color) : colors.wood;
      const metal = std(colors.metal, { metalness: 0.8, roughness: 0.3 });
      // [w, d, h, centre z] — footprint runs z −0.325 … 0.325
      const sizes = [[0.6, 0.45, 0.5, -0.1], [0.5, 0.4, 0.44, 0.025], [0.4, 0.35, 0.38, 0.15]];
      const graded = rng() < 0.5;                                              // sometimes a graded set, lighter toward the front
      sizes.forEach(([w, d, h, cz], i) => {
        const top = std(mix(base, 0xffffff, graded ? i * 0.1 : 0), { roughness: 0.45 });
        g.add(box(w, 0.03, d, top, 0, h - 0.015, cz));
        for (const sx of [-1, 1]) g.add(box(0.025, h - 0.03, d, metal, sx * (w / 2 - 0.0125), (h - 0.03) / 2, cz));   // side slabs
      });
      return g;
    },
    iso: [
      { shape: 'box', box: [-0.3, 0.47, -0.325, 0.3, 0.5, 0.125], color: 'role:wood' },
      { shape: 'box', box: [-0.25, 0.41, -0.175, 0.25, 0.44, 0.225], color: 'role:wood' },
      { shape: 'box', box: [-0.2, 0.35, -0.025, 0.2, 0.38, 0.325], color: 'role:wood' },
    ],
  },

  // w: length; plain top on tapered legs with one slim pencil drawer facing +z
  'writing-desk': {
    footprint: [1.2, 0.6], height: 0.75, params: ['w', 'd', 'color'], tags: ['office', 'bedroom', 'guest', 'kids', 'teen'],
    create(it, { THREE, std, box, group, colors, hex, mix }) {
      const w = it.w || 1.2, d = it.d || 0.6, g = group('Writing Desk');
      const base = it.color ? hex(it.color) : colors.wood;
      const wood = std(base, { roughness: 0.4 });
      const apron = std(mix(base, 0x000000, 0.15), { roughness: 0.55 });
      const metal = std(colors.metal, { metalness: 0.8, roughness: 0.3 });
      g.add(box(w, 0.035, d, wood, 0, 0.7325, 0));                              // top
      g.add(box(w - 0.12, 0.08, d - 0.12, apron, 0, 0.675, 0));                 // apron
      g.add(box(w * 0.4, 0.06, 0.012, wood, 0, 0.675, d / 2 - 0.06 + 0.006));  // pencil drawer front
      g.add(box(0.08, 0.012, 0.012, metal, 0, 0.675, d / 2 - 0.06 + 0.018));   // its pull
      for (const [x, z] of corners(w, d, 0.06)) g.add(cyl(THREE, 0.028, 0.018, 0.715, wood, x, 0.3575, z, 10));   // tapered legs, thick at the apron
      return g;
    },
    iso: [
      { shape: 'box', box: [-0.6, 0.63, -0.3, 0.6, 0.75, 0.3], color: 'role:wood' },
      { shape: 'box', box: [-0.55, 0, -0.25, -0.5, 0.63, -0.2], color: 'role:wood' },
      { shape: 'box', box: [0.5, 0, 0.2, 0.55, 0.63, 0.25], color: 'role:wood' },
    ],
  },

  // dressing table: two drawers facing +z, a round mirror standing at the back, a jar or two on top
  'vanity-desk': {
    footprint: [1.1, 0.5], height: 1.45, params: ['w', 'color'], tags: ['bedroom'],
    create(it, { THREE, std, box, group, colors, hex, mix, rng }) {
      const w = it.w || 1.1, d = 0.5, g = group('Vanity Desk');
      const base = it.color ? hex(it.color) : colors.cabinet;
      const cab = std(base, { roughness: 0.55 });
      const drawer = std(mix(base, 0xffffff, 0.08), { roughness: 0.5 });
      const wood = std(colors.wood, { roughness: 0.4 });
      const metal = std(colors.metal, { metalness: 0.8, roughness: 0.3 });
      g.add(box(w, 0.035, d, wood, 0, 0.7325, 0));                              // top
      g.add(box(w - 0.1, 0.1, d - 0.1, cab, 0, 0.665, 0));                      // drawer band
      const dw = (w - 0.1) / 2 - 0.03;
      for (const sx of [-1, 1]) {                                                // two drawer fronts on +z
        g.add(box(dw, 0.07, 0.012, drawer, sx * (dw / 2 + 0.02), 0.665, d / 2 - 0.05 + 0.006));
        const knob = cyl(THREE, 0.012, 0.012, 0.02, metal, sx * (dw / 2 + 0.02), 0.665, d / 2 - 0.05 + 0.02, 10); knob.rotation.x = Math.PI / 2; g.add(knob);
      }
      for (const [x, z] of corners(w, d, 0.06)) g.add(cyl(THREE, 0.028, 0.018, 0.715, wood, x, 0.3575, z, 10));   // tapered legs, thick at the apron
      // mirror: a stem from the top, a wood ring, a pale mirror disc facing +z
      const mz = -d / 2 + 0.08;
      g.add(cyl(THREE, 0.014, 0.018, 0.12, metal, 0, 0.81, mz, 10));
      const ring = cyl(THREE, 0.3, 0.3, 0.025, wood, 0, 1.15, mz, 36); ring.rotation.x = Math.PI / 2; g.add(ring);
      const glass = cyl(THREE, 0.27, 0.27, 0.012, mirrorMat(std, THREE), 0, 1.15, mz + 0.014, 36); glass.rotation.x = Math.PI / 2; g.add(glass);
      // a jar and a bottle, where the rng puts them
      const jx = (rng() < 0.5 ? -1 : 1) * (w / 2 - 0.15);
      g.add(cyl(THREE, 0.04, 0.04, 0.07, std(colors.accent, { roughness: 0.3 }), jx, 0.785, 0.05, 16));
      g.add(cyl(THREE, 0.02, 0.025, 0.12, std(0xdbe7ee, { roughness: 0.1, metalness: 0.2 }), jx + (jx < 0 ? 0.11 : -0.11), 0.81, -0.02, 12));
      return g;
    },
    iso: [
      { shape: 'box', box: [-0.55, 0.61, -0.25, 0.55, 0.75, 0.25], color: 'role:wood' },
      { shape: 'box', box: [-0.5, 0, -0.2, 0.5, 0.61, 0.2], color: 'role:cabinet' },
      { shape: 'box', box: [-0.3, 0.85, -0.2, 0.3, 1.45, -0.16], color: '#dbe7ee' },   // the mirror: an upright slab
    ],
  },

  // w, d: plank top on chunky square legs with a trestle stretcher; legs painted half the time
  'farmhouse-table': {
    footprint: [2.0, 0.95], height: 0.76, params: ['w', 'd', 'color'], tags: ['dining', 'kitchen'],
    create(it, { THREE, std, box, group, colors, hex, mix, rng }) {
      const w = it.w || 2.0, d = it.d || 0.95, g = group('Farmhouse Table');
      const base = it.color ? hex(it.color) : colors.wood;
      const painted = rng() < 0.5;
      const legMat = std(painted ? colors.linen : mix(base, 0x000000, 0.1), { roughness: painted ? 0.7 : 0.55 });
      // four planks, each a shade off the base so the top reads as boards
      const n = 4, gap = 0.008, pw = (d - gap * (n - 1)) / n;
      for (let i = 0; i < n; i++) {
        const j = (rng() - 0.5) * 0.16;
        g.add(box(w, 0.06, pw, std(mix(base, j > 0 ? 0xffffff : 0x000000, Math.abs(j)), { roughness: 0.5 }), 0, 0.73, -d / 2 + pw / 2 + i * (pw + gap)));
      }
      g.add(box(w - 0.3, 0.1, d - 0.24, legMat, 0, 0.65, 0));                  // apron
      for (const [x, z] of corners(w, d, 0.16)) g.add(box(0.09, 0.7, 0.09, legMat, x, 0.35, z));
      g.add(box(w - 0.32, 0.06, 0.06, legMat, 0, 0.18, 0));                     // long stretcher
      for (const sx of [-1, 1]) g.add(box(0.06, 0.06, d - 0.32, legMat, sx * (w / 2 - 0.16), 0.18, 0));   // end stretchers
      return g;
    },
    iso: [
      { shape: 'box', box: [-1.0, 0.6, -0.475, 1.0, 0.76, 0.475], color: 'role:wood' },
      { shape: 'box', box: [-0.88, 0, -0.36, -0.8, 0.6, -0.28], color: 'role:wood' },
      { shape: 'box', box: [0.8, 0, 0.28, 0.88, 0.6, 0.36], color: 'role:wood' },
    ],
  },

  // r: top radius; a pedestal poseur table with a footrest ring
  'bar-table': {
    footprint: [0.6, 0.6], height: 1.05, params: ['r', 'color'], tags: ['kitchen', 'dining', 'living', 'outdoor', 'patio'],
    create(it, { THREE, std, box, group, colors, hex }) {
      const r = it.r || 0.3, g = group('Bar Table');
      const wood = std(it.color ? hex(it.color) : colors.wood, { roughness: 0.4 });
      const metal = std(colors.metal, { metalness: 0.8, roughness: 0.3 });
      g.add(cyl(THREE, r, r, 0.035, wood, 0, 1.0325, 0, 36));                  // top
      g.add(cyl(THREE, 0.028, 0.028, 0.995, metal, 0, 0.5175, 0, 16));        // column
      g.add(cyl(THREE, r * 0.7, r * 0.8, 0.02, metal, 0, 0.01, 0, 36));       // base
      const rr = Math.min(r * 0.6, 0.2), ring = new THREE.Mesh(new THREE.TorusGeometry(rr, 0.011, 8, 32), metal);
      ring.rotation.x = Math.PI / 2; ring.position.y = 0.28; ring.castShadow = true; g.add(ring);
      for (const rot of [0, Math.PI / 2]) { const spoke = box(rr * 2, 0.012, 0.012, metal, 0, 0.28, 0); spoke.rotation.y = rot; g.add(spoke); }   // four spokes tie it to the column
      return g;
    },
    iso: [
      { shape: 'cyl', box: [-0.3, 1.0, -0.3, 0.3, 1.05, 0.3], color: 'role:wood' },
      { shape: 'cyl', box: [-0.04, 0, -0.04, 0.04, 1.0, 0.04], color: 'role:metal' },
    ],
  },

  // w, d: slatted top (the slats run the long way) on square legs — teak-warmed wood on a metal frame
  'outdoor-table': {
    footprint: [1.6, 0.8], height: 0.74, params: ['w', 'd', 'color'], tags: ['outdoor', 'patio', 'garden'],
    create(it, { THREE, std, box, group, colors, hex, mix, rng }) {
      const w = it.w || 1.6, d = it.d || 0.8, g = group('Outdoor Table');
      const base = it.color ? hex(it.color) : mix(colors.wood, 0xb08a5a, 0.45);   // the house wood, lifted toward teak
      const metal = std(colors.metal, { metalness: 0.6, roughness: 0.5 });
      const n = Math.max(4, Math.round(d / 0.1)), gap = 0.018, sw = (d - gap * (n - 1)) / n;
      for (let i = 0; i < n; i++) {
        const j = (rng() - 0.5) * 0.12;
        g.add(box(w, 0.03, sw, std(mix(base, j > 0 ? 0xffffff : 0x000000, Math.abs(j)), { roughness: 0.65 }), 0, 0.725, -d / 2 + sw / 2 + i * (sw + gap)));
      }
      for (const sz of [-1, 1]) g.add(box(w - 0.1, 0.06, 0.035, metal, 0, 0.68, sz * (d / 2 - 0.05)));   // long rails
      for (const sx of [-1, 1]) g.add(box(0.035, 0.06, d - 0.1, metal, sx * (w / 2 - 0.05), 0.68, 0));   // end rails
      for (const [x, z] of corners(w, d, 0.05)) g.add(box(0.045, 0.71, 0.045, metal, x, 0.355, z));
      return g;
    },
    iso: [
      { shape: 'box', box: [-0.8, 0.65, -0.4, 0.8, 0.74, 0.4], color: 'role:wood' },
      { shape: 'box', box: [-0.78, 0, -0.38, -0.73, 0.65, -0.33], color: 'role:metal' },
      { shape: 'box', box: [0.73, 0, 0.33, 0.78, 0.65, 0.38], color: 'role:metal' },
    ],
  },

  // a low round play table in the accent colour on pale legs
  'kids-table': {
    footprint: [0.7, 0.7], height: 0.5, params: ['r', 'color'], tags: ['kids', 'nursery'],
    create(it, { THREE, std, group, colors, hex, rng }) {
      const r = it.r || 0.35, g = group('Kids Table');
      const top = std(it.color ? hex(it.color) : (rng() < 0.6 ? colors.accent : colors.fabric2), { roughness: 0.5 });
      const leg = std(colors.linen, { roughness: 0.6 });
      g.add(cyl(THREE, r, r, 0.04, top, 0, 0.48, 0, 32));
      g.add(cyl(THREE, r - 0.08, r - 0.08, 0.035, leg, 0, 0.4425, 0, 32));      // pale apron under the top
      for (let i = 0; i < 4; i++) {
        const a = i * Math.PI / 2 + Math.PI / 4, R = r - 0.1;
        g.add(cyl(THREE, 0.024, 0.016, 0.44, leg, Math.cos(a) * R, 0.22, Math.sin(a) * R, 10));   // tapered legs, thick at the apron
      }
      return g;
    },
    iso: [{ shape: 'cyl', box: [-0.35, 0.42, -0.35, 0.35, 0.5, 0.35], color: 'role:accent' }],
  },

  // r: top radius; a two-seat café table — pale top on a cross-foot pedestal
  'bistro-table': {
    footprint: [0.6, 0.6], height: 0.72, params: ['r', 'color'], tags: ['kitchen', 'outdoor', 'patio', 'dining'],
    create(it, { THREE, std, box, group, colors, hex }) {
      const r = it.r || 0.3, g = group('Bistro Table');
      const top = std(it.color ? hex(it.color) : colors.linen, { roughness: 0.3 });
      const metal = std(colors.metal, { metalness: 0.7, roughness: 0.4 });
      g.add(cyl(THREE, r, r, 0.03, top, 0, 0.705, 0, 36));
      g.add(cyl(THREE, r - 0.01, r - 0.01, 0.02, metal, 0, 0.68, 0, 36));      // rim band under the top
      g.add(cyl(THREE, 0.022, 0.022, 0.67, metal, 0, 0.335, 0, 14));           // column
      for (const rot of [0, Math.PI / 2]) {                                    // cross foot
        const bar = box(r * 1.6, 0.03, 0.04, metal, 0, 0.015, 0); bar.rotation.y = rot; g.add(bar);
      }
      return g;
    },
    iso: [
      { shape: 'cyl', box: [-0.3, 0.68, -0.3, 0.3, 0.72, 0.3], color: 'role:linen' },
      { shape: 'cyl', box: [-0.03, 0, -0.03, 0.03, 0.68, 0.03], color: 'role:metal' },
    ],
  },
});

// =================================================================================================================
// Pass 4 (S3 compose): dining and coffee tables beside the farmhouse table — the only sized dining table the fleet
// had — so the composer can match a table to the style (trestle, glass, pedestal, oval) and vary it by seed.
// =================================================================================================================
const glassTopMat = std => std(0xcfe3e8, { roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.38 });

registerProps({
  // Trestle table — a thick plank top on two trestle ends (post, foot, cleat) tied by a stretcher (farmhouse,
  // craftsman, mediterranean). w × d; chairs are separate items.
  'trestle-table': {
    footprint: [2.0, 0.9], height: 0.76, params: ['w', 'd', 'color'], tags: ['dining', 'kitchen'],
    create(it, { std, box, group, colors, hex }) {
      const w = it.w || 2.0, d = it.d || 0.9, g = group('Trestle Table'), wood = std(it.color ? hex(it.color) : colors.wood, { roughness: 0.55 });
      g.add(box(w, 0.055, d, wood, 0, 0.7325, 0));
      for (const s of [-1, 1]) {
        const x = s * (w / 2 - 0.3);
        g.add(box(0.1, 0.61, 0.12, wood, x, 0.395, 0));          // post
        g.add(box(0.1, 0.07, d - 0.1, wood, x, 0.035, 0));       // foot
        g.add(box(0.08, 0.06, d - 0.16, wood, x, 0.675, 0));     // cleat under the top
      }
      g.add(box(w - 0.6, 0.08, 0.06, wood, 0, 0.3, 0));          // stretcher
      return g;
    },
    iso: [{ shape: 'box', box: [-1, 0.705, -0.45, 1, 0.76, 0.45], color: 'role:wood' }, { shape: 'box', box: [-0.75, 0, -0.4, -0.65, 0.7, 0.4], color: 'role:wood' }, { shape: 'box', box: [0.65, 0, -0.4, 0.75, 0.7, 0.4], color: 'role:wood' }],
  },
  // Glass dining table — a clear glass top on two blackened-steel sled frames (modern, industrial).
  'glass-dining-table': {
    footprint: [1.8, 0.9], height: 0.75, params: ['w', 'd', 'color'], tags: ['dining'],
    create(it, { std, box, group, colors, hex }) {
      const w = it.w || 1.8, d = it.d || 0.9, g = group('Glass Dining Table');
      const metal = std(it.color ? hex(it.color) : colors.metal, { metalness: 0.8, roughness: 0.3 });
      const top = box(w, 0.012, d, glassTopMat(std), 0, 0.744, 0, false); top.receiveShadow = false; g.add(top);
      for (const s of [-1, 1]) {
        const x = s * (w / 2 - 0.2);
        g.add(box(0.04, 0.04, d - 0.08, metal, x, 0.718, 0));                     // top rail
        g.add(box(0.04, 0.04, d - 0.08, metal, x, 0.02, 0));                      // floor rail
        for (const z of [-1, 1]) g.add(box(0.04, 0.66, 0.04, metal, x, 0.37, z * (d / 2 - 0.06)));
      }
      return g;
    },
    iso: [{ shape: 'box', box: [-0.9, 0.738, -0.45, 0.9, 0.75, 0.45], color: '#cfe3e8' }, { shape: 'box', box: [-0.72, 0, -0.41, -0.68, 0.74, 0.41], color: 'role:metal' }, { shape: 'box', box: [0.68, 0, -0.41, 0.72, 0.74, 0.41], color: 'role:metal' }],
  },
  // Pedestal dining table — a round top on one turned column spreading into four feet (scandi, cottage, a breakfast
  // corner). r: top radius (0.6 seats four, 0.75 six).
  'pedestal-dining-table': {
    footprint: [1.2, 1.2], height: 0.76, params: ['r', 'color'], tags: ['dining', 'kitchen'],
    create(it, { THREE, std, box, group, colors, hex }) {
      const r = it.r || 0.6, g = group('Pedestal Dining Table'), wood = std(it.color ? hex(it.color) : colors.wood, { roughness: 0.5 });
      g.add(cyl(THREE, r, r, 0.045, wood, 0, 0.7375, 0, 48));
      const profile = [[0.0, 0.1], [0.14, 0.1], [0.11, 0.2], [0.07, 0.32], [0.085, 0.5], [0.06, 0.64], [0.1, 0.715], [0.0, 0.715]].map(([x, y]) => new THREE.Vector2(x, y));
      const col = new THREE.Mesh(new THREE.LatheGeometry(profile, 20), wood); col.castShadow = true; g.add(col);
      for (let k = 0; k < 4; k++) { const f = box(Math.min(0.9, r * 1.4), 0.06, 0.09, wood, 0, 0.05, 0); f.position.set(Math.cos(k * Math.PI / 2 + Math.PI / 4) * r * 0.33, 0.05, Math.sin(k * Math.PI / 2 + Math.PI / 4) * r * 0.33); f.rotation.y = -(k * Math.PI / 2 + Math.PI / 4); g.add(f); }
      return g;
    },
    iso: [{ shape: 'cyl', box: [-0.6, 0.715, -0.6, 0.6, 0.76, 0.6], color: 'role:wood' }, { shape: 'cyl', box: [-0.1, 0, -0.1, 0.1, 0.715, 0.1], color: 'role:wood' }],
  },
  // Oval dining table — an oval top on four splayed tapered legs (mid-century, scandi, modern). w × d.
  'oval-dining-table': {
    footprint: [2.0, 1.0], height: 0.75, params: ['w', 'd', 'color'], tags: ['dining'],
    create(it, { THREE, std, box, group, colors, hex }) {
      const w = it.w || 2.0, d = it.d || 1.0, g = group('Oval Dining Table'), wood = std(it.color ? hex(it.color) : colors.wood, { roughness: 0.45 });
      const top = cyl(THREE, 0.5, 0.5, 0.04, wood, 0, 0.73, 0, 48); top.scale.set(w, 1, d); g.add(top);
      const apron = cyl(THREE, 0.5, 0.5, 0.06, wood, 0, 0.68, 0, 48); apron.scale.set(w - 0.2, 1, d - 0.2); g.add(apron);
      for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
        const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.016, 0.7, 10), wood);
        leg.position.set(sx * (w / 2 - 0.34), 0.35, sz * (d / 2 - 0.18)); leg.rotation.set(-sz * 0.1, 0, sx * 0.1); leg.castShadow = true; g.add(leg);
      }
      return g;
    },
    iso: [{ shape: 'cyl', box: [-1, 0.71, -0.5, 1, 0.75, 0.5], color: 'role:wood' }],
  },
  // Round coffee table — a round top over a lower shelf on three legs (scandi, mid-century, cottage). r.
  'round-coffee-table': {
    footprint: [0.9, 0.9], height: 0.42, params: ['r', 'color'], tags: ['living', 'den'],
    create(it, { THREE, std, group, colors, hex }) {
      const r = it.r || 0.45, g = group('Round Coffee Table'), wood = std(it.color ? hex(it.color) : colors.wood, { roughness: 0.45 });
      g.add(cyl(THREE, r, r, 0.035, wood, 0, 0.4025, 0, 40));
      g.add(cyl(THREE, r * 0.78, r * 0.78, 0.025, wood, 0, 0.12, 0, 36));
      for (let k = 0; k < 3; k++) { const a = k * Math.PI * 2 / 3 + Math.PI / 2; g.add(cyl(THREE, 0.022, 0.018, 0.385, wood, Math.cos(a) * r * 0.72, 0.1925, Math.sin(a) * r * 0.72, 10)); }
      return g;
    },
    iso: [{ shape: 'cyl', box: [-0.45, 0.385, -0.45, 0.45, 0.42, 0.45], color: 'role:wood' }, { shape: 'cyl', box: [-0.35, 0.1, -0.35, 0.35, 0.13, 0.35], color: 'role:wood' }],
  },
  // Trunk coffee table — a steamer trunk with iron straps and corners (farmhouse, industrial, craftsman). w.
  'trunk-coffee-table': {
    footprint: [1.0, 0.6], height: 0.46, params: ['w', 'color'], tags: ['living', 'den', 'bedroom'],
    create(it, { std, box, group, colors, hex, mix }) {
      const w = it.w || 1.0, d = 0.6, g = group('Trunk Coffee Table'), wood = std(it.color ? hex(it.color) : colors.wood, { roughness: 0.6 });
      const iron = std(colors.metal, { metalness: 0.7, roughness: 0.45 });
      g.add(box(w, 0.4, d, wood, 0, 0.22, 0));
      g.add(box(w + 0.01, 0.06, d + 0.01, std(mix(it.color ? hex(it.color) : colors.wood, 0x000000, 0.2), { roughness: 0.6 }), 0, 0.43, 0));   // lid
      for (const s of [-1, 1]) g.add(box(0.05, 0.47, d + 0.02, iron, s * w * 0.28, 0.235, 0));   // straps
      for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) g.add(box(0.04, 0.04, 0.04, iron, sx * (w / 2 - 0.015), 0.04, sz * (d / 2 - 0.015)));   // corner caps
      g.add(box(0.12, 0.05, 0.02, iron, 0, 0.36, d / 2 + 0.01));   // hasp
      return g;
    },
    iso: [{ shape: 'box', box: [-0.5, 0.02, -0.3, 0.5, 0.46, 0.3], color: 'role:wood' }],
  },

  // ---- more nightstands and side tables (plan S3: the fleet's 98 nightstands were one type) --------------------------------------
  // Drum nightstand — a round drum on a plinth, one door with a leather pull (mid-century, modern, tropical, mediterranean).
  'drum-nightstand': {
    footprint: [0.42, 0.42], height: 0.56, params: ['color'], tags: ['bedroom', 'guest', 'living'],
    create(it, { THREE, std, box, group, colors, hex, mix }) {
      const g = group('Drum Nightstand'), body = it.color ? hex(it.color) : colors.cabinet;
      g.add(cyl(THREE, 0.17, 0.17, 0.04, std(mix(body, 0x000000, 0.4), { roughness: 0.6 }), 0, 0.02, 0, 28));   // plinth
      g.add(cyl(THREE, 0.2, 0.2, 0.47, std(body, { roughness: 0.55 }), 0, 0.275, 0, 32));                       // the drum
      g.add(cyl(THREE, 0.215, 0.215, 0.03, std(colors.wood, { roughness: 0.45 }), 0, 0.545, 0, 32));            // top
      g.add(box(0.004, 0.36, 0.006, std(mix(body, 0x000000, 0.25), { roughness: 0.6 }), 0, 0.28, 0.2));          // door seam
      g.add(box(0.014, 0.1, 0.014, std(colors.metal, { metalness: 0.7, roughness: 0.4 }), 0.05, 0.3, 0.208));    // pull
      return g;
    },
    iso: [{ shape: 'cyl', box: [-0.21, 0, -0.21, 0.21, 0.56, 0.21], color: 'role:cabinet' }],
  },
  // Bedside cabinet — a narrow cabinet on tapered legs: a drawer over a door (scandi, cottage, farmhouse, craftsman).
  'bedside-cabinet': {
    footprint: [0.44, 0.38], height: 0.62, params: ['color'], tags: ['bedroom', 'guest', 'kids'],
    create(it, { THREE, std, box, group, colors, hex, mix }) {
      const g = group('Bedside Cabinet'), body = it.color ? hex(it.color) : colors.cabinet, w = 0.44, d = 0.38;
      const cab = std(body, { roughness: 0.6 }), front = std(mix(body, 0xffffff, 0.08), { roughness: 0.55 }), wood = std(colors.wood, { roughness: 0.45 }), knob = std(colors.metal, { metalness: 0.7, roughness: 0.4 });
      g.add(box(w, 0.4, d, cab, 0, 0.38, 0));
      g.add(box(w + 0.02, 0.025, d + 0.02, wood, 0, 0.5875, 0));
      g.add(box(w - 0.05, 0.14, 0.015, front, 0, 0.5, d / 2 + 0.0075)); g.add(box(w - 0.05, 0.2, 0.015, front, 0, 0.29, d / 2 + 0.0075));
      for (const y of [0.5, 0.35]) { const k = cyl(THREE, 0.012, 0.012, 0.02, knob, 0.12 * (y > 0.4 ? 0 : 1), y, d / 2 + 0.025, 10); k.rotation.x = Math.PI / 2; g.add(k); }
      for (const [x, z] of corners(w, d, 0.05)) g.add(cyl(THREE, 0.014, 0.022, 0.18, wood, x, 0.09, z, 8));
      return g;
    },
    iso: [{ shape: 'box', box: [-0.22, 0.18, -0.19, 0.22, 0.6, 0.19], color: 'role:cabinet' }, { shape: 'box', box: [-0.2, 0, -0.17, 0.2, 0.18, 0.17], color: 'role:wood' }],
  },
  // Drum side table — a round pedestal side table with a disc foot (modern, mid-century, tropical, industrial).
  'drum-table': {
    footprint: [0.46, 0.46], height: 0.52, params: ['color'], tags: ['living', 'bedroom'],
    create(it, { THREE, std, group, colors, hex }) {
      const g = group('Drum Table'), col = it.color ? hex(it.color) : colors.wood;
      g.add(cyl(THREE, 0.2, 0.22, 0.03, std(colors.metal, { metalness: 0.7, roughness: 0.4 }), 0, 0.015, 0, 28));
      g.add(cyl(THREE, 0.16, 0.16, 0.45, std(col, { roughness: 0.5 }), 0, 0.255, 0, 28));
      g.add(cyl(THREE, 0.23, 0.23, 0.035, std(col, { roughness: 0.45 }), 0, 0.5, 0, 32));
      return g;
    },
    iso: [{ shape: 'cyl', box: [-0.23, 0, -0.23, 0.23, 0.52, 0.23], color: 'role:wood' }],
  },
  // C table — a C-shaped side table whose base slides under a sofa or bed, the top overhanging it (modern, industrial, scandi).
  'c-table': {
    footprint: [0.5, 0.4], height: 0.6, params: ['color'], tags: ['living', 'bedroom', 'study'],
    create(it, { THREE, std, box, group, colors, hex }) {
      const g = group('C Table'), metal = std(it.color ? hex(it.color) : colors.metal, { metalness: 0.7, roughness: 0.35 }), wood = std(colors.wood, { roughness: 0.45 });
      g.add(box(0.46, 0.02, 0.34, metal, 0.02, 0.01, 0)); g.add(box(0.03, 0.56, 0.03, metal, -0.2, 0.3, 0)); g.add(box(0.44, 0.03, 0.4, wood, 0.03, 0.585, 0));
      return g;
    },
    iso: [{ shape: 'box', box: [-0.22, 0.56, -0.2, 0.25, 0.6, 0.2], color: 'role:wood' }, { shape: 'box', box: [-0.22, 0, -0.17, 0.25, 0.03, 0.17], color: 'role:metal' }],
  },
});
