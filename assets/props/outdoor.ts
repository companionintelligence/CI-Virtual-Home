// Outdoor — what a deck, a patio and a lawn are furnished with: seating sets, a hammock, the grill and the fire
// bowl, play things, the mailbox at the kerb, a tiered fountain. These are room items like any other (a "Garden"
// room whose bounds cover the yard): origin at the floor centre of the footprint, facing SOUTH (+z) at rot 0 — a
// chair's seat opens toward +z, the grill's knobs and the kennel's door face +z, the bicycle's front wheel is at +z.
// Big surfaces take role colours from ctx.colors (or it.color); flames, sand, water, rope and rubber are literals.
// Any variation (which cushion is the accent, where the toys landed) comes from ctx.rng, never Math.random.
import { registerProps } from './registry.js';

const SAND = 0xe8d5a6, WATER = 0x7dd3fc, STONE = 0xb8b2a7, ROPE = 0xd9c9a3, RUBBER = 0x1c1917, EMBER = 0xf97316, FLAME = 0xfbbf24;
const pick = (rng, arr) => arr[Math.floor(rng() * arr.length)];

// Per-prop toolkit over the ctx helpers.
function kit({ THREE, std }) {
  const add = (g, m, x, y, z) => { m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; g.add(m); return m; };
  const cyl = (g, rt, rb, h, mat, x, y, z, seg = 16) => add(g, new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat), x, y, z);
  // a faceted blob (soil heaps, a ball, a bird), scaled to shape
  const blob = (g, r, mat, x, y, z, sx = 1, sy = 1, sz = 1) => { const m = add(g, new THREE.Mesh(new THREE.IcosahedronGeometry(r, 1), mat), x, y, z); m.scale.set(sx, sy, sz); return m; };
  // a member from a to b: round (a tube, a chain, a rope) or square (timber)
  const strut = (g, a, b, r, mat, seg = 8, square = false) => {
    const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b), d = B.clone().sub(A), L = d.length();
    const m = new THREE.Mesh(square ? new THREE.BoxGeometry(2 * r, L, 2 * r) : new THREE.CylinderGeometry(r, r, L, seg), mat);
    m.position.copy(A).add(B).multiplyScalar(0.5); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
    m.castShadow = true; m.receiveShadow = true; g.add(m); return m;
  };
  // a ring: flat (rx = π/2, lying in the xz plane) or standing (ry = π/2, a wheel in the yz plane)
  const ring = (g, R, tube, mat, x, y, z, rx = 0, ry = 0, seg = 28) => { const m = add(g, new THREE.Mesh(new THREE.TorusGeometry(R, tube, 8, seg), mat), x, y, z); m.rotation.set(rx, ry, 0); return m; };
  const metal = (colors, extra = {}) => std(colors.metal, { metalness: 0.7, roughness: 0.35, ...extra });
  const wood = (colors, extra = {}) => std(colors.wood, { roughness: 0.6, ...extra });
  const water = () => std(WATER, { roughness: 0.12, metalness: 0.15, transparent: true, opacity: 0.85 });
  const stone = it => std(it.color ? it.color : STONE, { roughness: 0.9 });
  return { add, cyl, blob, strut, ring, metal, wood, water, stone };
}

// A slatted garden chair (seat opens toward +z): 4 legs, seat slab, back slab, a cushion — 7 meshes.
function gardenChair(ctx, frameMat, slatMat, cushionMat) {
  const { box, group } = ctx, K = kit(ctx), c = group('Garden Chair');
  for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) K.cyl(c, 0.014, 0.014, 0.44, frameMat, sx * 0.19, 0.22, sz * 0.19, 8);
  c.add(box(0.44, 0.03, 0.44, slatMat, 0, 0.455, 0));
  c.add(box(0.44, 0.42, 0.03, slatMat, 0, 0.66, -0.205));
  c.add(box(0.38, 0.035, 0.38, cushionMat, 0, 0.488, 0.01));
  return c;
}

registerProps({
  // ---------------------------------------------------------------------------------------------------------------
  // Patio set — a round pedestal table with four slatted chairs pulled up to it. r: the table-top radius; the
  // chairs add 0.54 m all round.
  'patio-set': {
    footprint: [2.2, 2.2], height: 0.87, params: ['r', 'color'], tags: ['garden', 'patio', 'outdoor', 'deck', 'porch'],
    create(it, ctx) {
      const { THREE, std, group, colors, hex, rng } = ctx, K = kit(ctx);
      const r = it.r || 0.55, g = group('Patio Set');
      const top = std(it.color ? hex(it.color) : colors.wood, { roughness: 0.5 }), frame = K.metal(colors);
      K.cyl(g, r, r, 0.04, top, 0, 0.72, 0, 36);                       // top
      K.cyl(g, 0.04, 0.04, 0.68, frame, 0, 0.36, 0, 12);               // pedestal
      K.cyl(g, 0.22, 0.27, 0.04, frame, 0, 0.02, 0, 24);               // base disc
      const accentSeat = rng() < 0.5;
      const cushion = std(accentSeat ? colors.accent : colors.fabric, { roughness: 0.9 });
      const D = r + 0.32;
      for (let i = 0; i < 4; i++) {
        const a = i * Math.PI / 2, c = gardenChair(ctx, frame, top, cushion);
        c.position.set(Math.sin(a) * D, 0, Math.cos(a) * D); c.rotation.y = a + Math.PI;   // seat opens toward the table
        g.add(c);
      }
      return g;
    },
    iso: [
      { shape: 'cyl', box: [-0.55, 0.68, -0.55, 0.55, 0.74, 0.55], color: 'role:wood' },
      { shape: 'box', box: [-0.22, 0.44, 0.65, 0.22, 0.87, 1.09], color: 'role:wood' },
      { shape: 'box', box: [-0.22, 0.44, -1.09, 0.22, 0.87, -0.65], color: 'role:wood' },
      { shape: 'box', box: [0.65, 0.44, -0.22, 1.09, 0.87, 0.22], color: 'role:wood' },
      { shape: 'box', box: [-1.09, 0.44, -0.22, -0.65, 0.87, 0.22], color: 'role:wood' },
    ],
  },

  // ---------------------------------------------------------------------------------------------------------------
  // Lounger set — two slatted loungers (head at −z, backrest raised) either side of a little drinks table; a rolled
  // towel on one of them, seeded.
  'lounger-set': {
    footprint: [2.05, 1.9], height: 0.82, params: ['color'], tags: ['garden', 'patio', 'outdoor', 'deck', 'pool'],
    create(it, ctx) {
      const { THREE, std, box, group, colors, hex, mix, rng } = ctx, K = kit(ctx);
      const g = group('Lounger Set');
      const teak = std(mix(colors.wood, 0xb08a5a, 0.4), { roughness: 0.6 }), frame = K.metal(colors);
      const pad = std(it.color ? hex(it.color) : colors.linen, { roughness: 0.9 });
      const towelSide = rng() < 0.5 ? -1 : 1, towelMat = std(rng() < 0.5 ? colors.accent : colors.fabric2, { roughness: 0.95 });
      for (const s of [-1, 1]) {
        const x = s * 0.675;
        g.add(box(0.7, 0.1, 1.9, teak, x, 0.3, 0));                                                   // slat bed
        for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) K.cyl(g, 0.02, 0.02, 0.25, frame, x + sx * 0.3, 0.125, sz * 0.85, 8);
        g.add(box(0.64, 0.08, 1.2, pad, x, 0.39, 0.3));                                              // seat pad
        const back = box(0.64, 0.08, 0.7, pad, x, 0.39 + 0.35 * Math.sin(0.6), -0.3 - 0.35 * Math.cos(0.6));
        back.rotation.x = 0.6; g.add(back);                                                           // raised backrest
        if (s === towelSide) { const t = K.cyl(g, 0.07, 0.07, 0.5, towelMat, x, 0.5, 0.6, 12); t.rotation.z = Math.PI / 2; }
      }
      K.cyl(g, 0.2, 0.2, 0.03, teak, 0, 0.445, 0, 24);                                                  // drinks table
      K.cyl(g, 0.025, 0.025, 0.43, frame, 0, 0.215, 0, 10);
      K.cyl(g, 0.14, 0.16, 0.02, frame, 0, 0.01, 0, 20);
      K.cyl(g, 0.035, 0.03, 0.11, std(0xbae6fd, { roughness: 0.1, transparent: true, opacity: 0.6 }), 0.06, 0.515, 0.02, 10);   // a tumbler
      return g;
    },
    iso: [
      { shape: 'box', box: [-1.025, 0.25, -0.95, -0.325, 0.43, 0.95], color: 'role:linen' },
      { shape: 'box', box: [0.325, 0.25, -0.95, 1.025, 0.43, 0.95], color: 'role:linen' },
      { shape: 'box', box: [-1.0, 0.43, -0.95, -0.35, 0.82, -0.3], color: 'role:linen' },
      { shape: 'box', box: [0.35, 0.43, -0.95, 1.0, 0.82, -0.3], color: 'role:linen' },
    ],
  },

  // ---------------------------------------------------------------------------------------------------------------
  // Hammock — a canvas sling slung between two posts along x, gathered to a rope at each end, one pillow.
  'hammock': {
    footprint: [3.4, 1.0], height: 1.5, params: ['color'], tags: ['garden', 'outdoor', 'porch'],
    create(it, ctx) {
      const { THREE, std, box, group, colors, hex, rng } = ctx, K = kit(ctx);
      const g = group('Hammock');
      const post = K.wood(colors), rope = std(ROPE, { roughness: 0.95 });
      for (const s of [-1, 1]) {
        K.cyl(g, 0.06, 0.06, 1.5, post, s * 1.6, 0.75, 0, 10);
        K.cyl(g, 0.1, 0.1, 0.03, post, s * 1.6, 0.015, 0, 12);                                          // ground plate
        K.strut(g, [s * 1.6, 1.44, 0], [s * 1.2, 1.0, 0], 0.012, rope);                                  // hanging rope
      }
      // the sling: a plane sagging along x (1.0 m at the ends, 0.55 m in the middle), pinched to a gather at the
      // ends and curled up along its long edges
      const geo = new THREE.BoxGeometry(2.4, 0.04, 1.0, 18, 1, 5), p = geo.attributes.position;
      for (let i = 0; i < p.count; i++) {
        const x = p.getX(i), z = p.getZ(i), u = x / 1.2, k = 1 - u * u;
        const pz = z * (0.32 + 0.68 * k);
        p.setXYZ(i, x, p.getY(i) + 1.0 - 0.45 * k + 0.12 * (pz / 0.5) * (pz / 0.5) * k, pz);
      }
      geo.computeVertexNormals();
      K.add(g, new THREE.Mesh(geo, std(it.color ? hex(it.color) : colors.fabric2, { roughness: 0.9, flatShading: true, side: THREE.DoubleSide })), 0, 0, 0);
      const px = (rng() < 0.5 ? -1 : 1) * 0.72, ky = 1 - (px / 1.2) ** 2;
      const pillow = box(0.42, 0.11, 0.3, std(colors.accent, { roughness: 0.9 }), px, 1.0 - 0.45 * ky + 0.075, 0);
      pillow.rotation.z = -Math.sign(px) * 0.35; g.add(pillow);
      return g;
    },
    iso: [
      { shape: 'cyl', box: [-1.66, 0, -0.06, -1.54, 1.5, 0.06], color: 'role:wood' },
      { shape: 'cyl', box: [1.54, 0, -0.06, 1.66, 1.5, 0.06], color: 'role:wood' },
      { shape: 'blob', box: [-1.2, 0.55, -0.5, 1.2, 1.0, 0.5], color: 'role:fabric2' },
    ],
  },

  // ---------------------------------------------------------------------------------------------------------------
  // BBQ grill — a cart grill: enamel body and lid on four legs (wheels on the left), a wire shelf under, timber
  // side shelves, three knobs and a lid handle on the front.
  'bbq-grill': {
    footprint: [1.1, 0.6], height: 1.05, params: ['color'], tags: ['garden', 'patio', 'outdoor', 'deck'],
    create(it, ctx) {
      const { THREE, std, box, group, colors, hex, mix } = ctx, K = kit(ctx);
      const g = group('BBQ Grill');
      const enamel = std(it.color ? hex(it.color) : colors.metal, { metalness: 0.4, roughness: 0.35 });
      const frame = K.metal(colors), shelf = K.wood(colors), black = std(RUBBER, { roughness: 0.6 });
      for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) K.cyl(g, 0.02, 0.02, 0.6, frame, sx * 0.32, 0.3, sz * 0.2, 8);
      for (const sz of [-1, 1]) { const w = K.cyl(g, 0.09, 0.09, 0.04, black, -0.36, 0.09, sz * 0.2, 16); w.rotation.z = Math.PI / 2; }   // wheels
      g.add(box(0.7, 0.02, 0.44, frame, 0, 0.25, 0));                                                    // wire shelf
      g.add(box(0.7, 0.3, 0.5, enamel, 0, 0.75, 0));                                                     // fire box
      g.add(box(0.7, 0.09, 0.5, enamel, 0, 0.945, 0));                                                   // lid
      g.add(box(0.6, 0.06, 0.4, enamel, 0, 1.02, 0));                                                    // lid dome
      const handle = K.cyl(g, 0.014, 0.014, 0.34, shelf, 0, 0.965, 0.29, 10); handle.rotation.z = Math.PI / 2;
      for (const sx of [-1, 1]) K.cyl(g, 0.01, 0.01, 0.05, frame, sx * 0.15, 0.965, 0.265, 6).rotation.x = Math.PI / 2;   // handle stand-offs
      const gauge = K.cyl(g, 0.035, 0.035, 0.012, std(0xf1f5f9, { roughness: 0.3 }), 0.2, 0.945, 0.255, 16); gauge.rotation.x = Math.PI / 2;
      for (const x of [-0.16, 0, 0.16]) K.cyl(g, 0.022, 0.022, 0.025, black, x, 0.68, 0.26, 12).rotation.x = Math.PI / 2;   // knobs
      for (const sx of [-1, 1]) g.add(box(0.2, 0.03, 0.44, shelf, sx * 0.45, 0.885, 0));                 // side shelves
      return g;
    },
    iso: [
      { shape: 'box', box: [-0.35, 0.6, -0.25, 0.35, 1.05, 0.25], color: 'role:metal' },
      { shape: 'box', box: [-0.55, 0.87, -0.22, -0.35, 0.9, 0.22], color: 'role:wood' },
      { shape: 'box', box: [0.35, 0.87, -0.22, 0.55, 0.9, 0.22], color: 'role:wood' },
    ],
  },

  // ---------------------------------------------------------------------------------------------------------------
  // Fire bowl — an open steel bowl on three legs, an ash bed and embers down inside it, logs across, three faceted
  // flames of different heights. r: the bowl radius.
  'fire-bowl': {
    footprint: [0.9, 0.9], height: 0.78, params: ['r'], tags: ['garden', 'patio', 'outdoor', 'deck'],
    create(it, ctx) {
      const { THREE, std, group, colors, rng } = ctx, K = kit(ctx);
      const r = it.r || 0.45, g = group('Fire Bowl');
      const steel = std(0x3f3f46, { metalness: 0.5, roughness: 0.55 }), log = std(0x3b2a1e, { roughness: 0.95 });
      for (let i = 0; i < 3; i++) { const a = i * Math.PI * 2 / 3 + Math.PI / 6; K.strut(g, [Math.cos(a) * r * 0.85, 0.008, Math.sin(a) * r * 0.85], [Math.cos(a) * r * 0.5, 0.3, Math.sin(a) * r * 0.5], 0.016, steel); }   // feet 8 mm up: a tilted tube's cap edge dips r·sinθ
      K.ring(g, r * 0.82, 0.015, steel, 0, 0.02, 0, Math.PI / 2);                                       // base ring
      // the bowl is open (both faces drawn) with its own floor, so the ash bed sits down inside it
      K.add(g, new THREE.Mesh(new THREE.CylinderGeometry(r, r * 0.55, 0.22, 28, 1, true), std(0x3f3f46, { metalness: 0.5, roughness: 0.55, side: THREE.DoubleSide })), 0, 0.36, 0);
      K.cyl(g, r * 0.55, r * 0.55, 0.02, steel, 0, 0.26, 0, 28);                                       // bowl floor
      K.cyl(g, r * 0.82, r * 0.82, 0.02, std(0x1c1917, { roughness: 1 }), 0, 0.4, 0, 24);               // ash bed
      K.cyl(g, r * 0.5, r * 0.5, 0.03, std(EMBER, { emissive: EMBER, emissiveIntensity: 1.2, roughness: 1 }), 0, 0.42, 0, 20);
      for (let i = 0; i < 3; i++) { const l = K.cyl(g, 0.035, 0.035, r * 1.3, log, 0, 0.465 + i * 0.02, 0, 8); l.rotation.set(0, i * Math.PI / 3 + rng() * 0.3, Math.PI / 2); }
      const flame = (R, h, c, x, z) => { const m = K.add(g, new THREE.Mesh(new THREE.ConeGeometry(R, h, 5), std(c, { emissive: c, emissiveIntensity: 0.9, flatShading: true, roughness: 1 })), x, 0.48 + h / 2, z); m.castShadow = false; return m; };
      flame(0.13, 0.3, EMBER, 0.02, 0.01); flame(0.08, 0.2, FLAME, -0.12, 0.06); flame(0.07, 0.16, EMBER, 0.11, -0.1);
      return g;
    },
    iso: [
      { shape: 'cyl', box: [-0.45, 0.25, -0.45, 0.45, 0.47, 0.45], color: '#3f3f46' },
      { shape: 'blob', box: [-0.13, 0.48, -0.13, 0.13, 0.78, 0.13], color: '#f97316' },
    ],
  },

  // ---------------------------------------------------------------------------------------------------------------
  // Outdoor sofa — a weatherproof teak-frame sofa with wide flat arms and thick cushions; one accent pillow, seeded.
  'outdoor-sofa': {
    footprint: [1.9, 0.85], height: 0.9, params: ['w', 'd', 'color'], tags: ['garden', 'patio', 'outdoor', 'deck', 'porch'],
    create(it, ctx) {
      const { THREE, std, box, group, colors, hex, mix, rng } = ctx, K = kit(ctx);
      const w = it.w || 1.9, d = it.d || 0.85, g = group('Outdoor Sofa');
      const teak = std(mix(colors.wood, 0xb08a5a, 0.4), { roughness: 0.6 }), frame = K.metal(colors);
      const base = it.color ? hex(it.color) : colors.fabric, cushion = std(base, { roughness: 0.92 });
      const bd = 0.14, seatY = 0.38;
      for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) g.add(box(0.06, 0.06, 0.06, frame, sx * (w / 2 - 0.05), 0.03, sz * (d / 2 - 0.05)));
      g.add(box(w, seatY - 0.06, d, teak, 0, 0.06 + (seatY - 0.06) / 2, 0));                          // plinth
      g.add(box(w, 0.34, bd, teak, 0, seatY + 0.17, -d / 2 + bd / 2));                                 // back
      for (const s of [-1, 1]) g.add(box(0.12, 0.2, d - bd, teak, s * (w / 2 - 0.06), seatY + 0.1, bd / 2));   // flat arms
      const n = Math.max(2, Math.round((w - 0.24) / 0.7)), inner = w - 0.24 - 0.04, cw = inner / n - 0.02;
      for (let i = 0; i < n; i++) {
        const cx = -inner / 2 + inner / n * (i + 0.5);
        g.add(box(cw, 0.13, d - bd - 0.08, cushion, cx, seatY + 0.065, bd / 2 + 0.01));
        const bc = box(cw, 0.32, 0.11, cushion, cx, seatY + 0.13 + 0.15, -d / 2 + bd + 0.05); bc.rotation.x = -0.1; g.add(bc);
      }
      const pillow = box(0.38, 0.38, 0.11, std(rng() < 0.5 ? colors.accent : colors.fabric2, { roughness: 0.9 }), (rng() < 0.5 ? -1 : 1) * (inner / 2 - 0.22), seatY + 0.32, -d / 2 + bd + 0.16);
      pillow.rotation.set(-0.16, (rng() - 0.5) * 0.4, 0.06); g.add(pillow);
      return g;
    },
    iso: [
      { shape: 'box', box: [-0.95, 0.06, -0.425, 0.95, 0.38, 0.425], color: 'role:wood' },
      { shape: 'box', box: [-0.95, 0.38, -0.425, 0.95, 0.72, -0.285], color: 'role:wood' },
      { shape: 'box', box: [-0.83, 0.38, -0.285, 0.83, 0.51, 0.425], color: 'role:fabric' },
    ],
  },

  // ---------------------------------------------------------------------------------------------------------------
  // Umbrella table — a pedestal table with a parasol through it: an 8-panel canopy on ribs, a valance, a finial.
  // The footprint is the canopy's (2.2 m); the table underneath is 1.0 m across.
  'umbrella-table': {
    footprint: [2.2, 2.2], height: 2.5, params: ['color'], tags: ['garden', 'patio', 'outdoor', 'deck', 'pool'],
    create(it, ctx) {
      const { THREE, std, group, colors, hex } = ctx, K = kit(ctx);
      const g = group('Umbrella Table');
      const top = std(colors.wood, { roughness: 0.5 }), frame = K.metal(colors);
      const canvas = std(it.color ? hex(it.color) : colors.accent, { roughness: 0.9, flatShading: true, side: THREE.DoubleSide });
      K.cyl(g, 0.5, 0.5, 0.04, top, 0, 0.72, 0, 36);
      K.cyl(g, 0.035, 0.035, 0.7, frame, 0, 0.35, 0, 12);
      K.cyl(g, 0.24, 0.29, 0.04, frame, 0, 0.02, 0, 28);
      K.cyl(g, 0.02, 0.02, 1.68, frame, 0, 0.74 + 0.84, 0, 10);                                          // pole above the table
      const R = 1.1, rimY = 2.06;
      K.add(g, new THREE.Mesh(new THREE.ConeGeometry(R, 0.36, 8), canvas), 0, rimY + 0.18, 0);           // canopy
      K.add(g, new THREE.Mesh(new THREE.CylinderGeometry(R, R, 0.1, 8, 1, true), canvas), 0, rimY - 0.05, 0);   // valance
      // ribs run under the seams (the octagon's corners, radius R — a panel's centre is only R·cos(π/8) out) and end
      // below the canvas (its surface at radius ρ is rimY + 0.36·(1 − ρ/R)), so nothing pokes through the canopy or valance
      for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; K.strut(g, [0, rimY + 0.03, 0], [Math.cos(a) * (R - 0.06), rimY - 0.008, Math.sin(a) * (R - 0.06)], 0.008, frame, 6); }
      K.cyl(g, 0.025, 0.025, 0.06, frame, 0, rimY + 0.39, 0, 8); K.blob(g, 0.03, frame, 0, rimY + 0.42, 0);   // finial
      return g;
    },
    iso: [
      { shape: 'cyl', box: [-0.5, 0.7, -0.5, 0.5, 0.74, 0.5], color: 'role:wood' },
      { shape: 'cyl', box: [-1.1, 2.0, -1.1, 1.1, 2.4, 1.1], color: 'role:accent' },
    ],
  },

  // ---------------------------------------------------------------------------------------------------------------
  // Bird bath — a turned stone pedestal, a shallow basin of water, a small bird on the rim.
  'bird-bath': {
    footprint: [0.6, 0.6], height: 0.92, params: ['color'], tags: ['garden', 'outdoor'],
    create(it, ctx) {
      const { THREE, std, group, colors, hex, rng } = ctx, K = kit(ctx);
      const g = group('Bird Bath'), stone = K.stone(it);
      K.cyl(g, 0.2, 0.26, 0.06, stone, 0, 0.03, 0, 20);
      K.cyl(g, 0.07, 0.1, 0.62, stone, 0, 0.37, 0, 14);
      K.cyl(g, 0.12, 0.1, 0.03, stone, 0, 0.695, 0, 14);
      // the basin is open (both faces drawn) with its own floor, so the water sits down inside it and shows
      K.add(g, new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.18, 0.12, 24, 1, true), std(it.color ? it.color : STONE, { roughness: 0.9, side: THREE.DoubleSide })), 0, 0.77, 0);
      K.cyl(g, 0.18, 0.18, 0.02, stone, 0, 0.72, 0, 24);                                                // basin floor
      K.cyl(g, 0.265, 0.265, 0.012, K.water(), 0, 0.80, 0, 24);                                          // water, 3 cm below the rim
      const a = rng() * Math.PI * 2, bx = Math.cos(a) * 0.29, bz = Math.sin(a) * 0.29;                    // the bird perches on the rim
      const feather = std(pick(rng, [0x475569, 0x7c2d12, 0x1e3a5f, 0x6b7280]), { roughness: 0.85, flatShading: true });
      K.blob(g, 0.04, feather, bx, 0.87, bz, 1.5, 0.9, 1);                                              // body
      K.blob(g, 0.025, feather, bx + Math.cos(a + Math.PI / 2) * 0.05, 0.91, bz + Math.sin(a + Math.PI / 2) * 0.05);   // head
      return g;
    },
    iso: [
      { shape: 'cyl', box: [-0.1, 0, -0.1, 0.1, 0.7, 0.1], color: '#b8b2a7' },
      { shape: 'cyl', box: [-0.3, 0.7, -0.3, 0.3, 0.83, 0.3], color: '#b8b2a7' },
    ],
  },

  // ---------------------------------------------------------------------------------------------------------------
  // Mailbox — a rural box on a timber post, door toward +z (the street), flag up, a number plaque on the post.
  'mailbox': {
    footprint: [0.22, 0.51], height: 1.28, params: ['color'], tags: ['garden', 'outdoor', 'entry', 'porch'],
    create(it, ctx) {
      const { THREE, std, box, group, colors, hex, mix } = ctx, K = kit(ctx);
      const g = group('Mailbox');
      const post = K.wood(colors), body = std(it.color ? hex(it.color) : colors.cabinet, { metalness: 0.3, roughness: 0.4 });
      g.add(box(0.09, 1.05, 0.09, post, 0, 0.525, 0));
      g.add(box(0.14, 0.03, 0.44, post, 0, 1.035, 0));                                                  // saddle
      g.add(box(0.2, 0.12, 0.48, body, 0, 1.11, 0));
      const barrel = K.cyl(g, 0.1, 0.1, 0.48, body, 0, 1.17, 0, 20); barrel.rotation.x = Math.PI / 2;    // rounded top
      const door = std(mix(it.color ? hex(it.color) : colors.cabinet, 0x000000, 0.25), { metalness: 0.3, roughness: 0.4 });
      g.add(box(0.21, 0.12, 0.015, door, 0, 1.11, 0.245));
      K.cyl(g, 0.105, 0.105, 0.015, door, 0, 1.17, 0.245, 20).rotation.x = Math.PI / 2;
      K.cyl(g, 0.012, 0.012, 0.03, K.metal(colors), 0, 1.09, 0.26, 8).rotation.x = Math.PI / 2;         // latch
      g.add(box(0.012, 0.17, 0.035, std(0xdc2626, { roughness: 0.5 }), 0.112, 1.2, -0.06));             // flag, up
      g.add(box(0.07, 0.11, 0.012, std(colors.linen, { roughness: 0.6 }), 0, 0.82, 0.05));               // number plaque
      return g;
    },
    iso: [
      { shape: 'box', box: [-0.045, 0, -0.045, 0.045, 1.05, 0.045], color: 'role:wood' },
      { shape: 'box', box: [-0.1, 1.05, -0.24, 0.1, 1.27, 0.24], color: 'role:cabinet' },
    ],
  },

  // ---------------------------------------------------------------------------------------------------------------
  // Bicycle — a diamond-frame bike, front wheel at +z, leaning a little onto its kickstand on the left.
  'bicycle': {
    footprint: [0.6, 1.75], height: 1.05, params: ['color'], tags: ['garden', 'outdoor', 'garage', 'entry', 'porch'],
    create(it, ctx) {
      const { THREE, std, box, group, colors, hex } = ctx, K = kit(ctx);
      const g = group('Bicycle'), b = new THREE.Group(); g.add(b);
      const tube = std(it.color ? hex(it.color) : colors.accent, { metalness: 0.4, roughness: 0.35 });
      const chrome = std(0xd4d4d8, { metalness: 0.9, roughness: 0.25 }), rubber = std(RUBBER, { roughness: 0.9 });
      const spokes = std(0xd4d4d8, { metalness: 0.6, roughness: 0.4, transparent: true, opacity: 0.3, side: THREE.DoubleSide });
      const R = 0.34, rz = -0.52, fz = 0.53;
      for (const z of [rz, fz]) {
        K.ring(b, R - 0.022, 0.022, rubber, 0, R, z, 0, Math.PI / 2, 36);                                // tyre
        const disc = K.cyl(b, R - 0.04, R - 0.04, 0.004, spokes, 0, R, z, 28); disc.rotation.z = Math.PI / 2; disc.castShadow = false;
        K.cyl(b, 0.03, 0.03, 0.07, chrome, 0, R, z, 10).rotation.z = Math.PI / 2;                        // hub
      }
      const B = [0, 0.29, -0.08], Hb = [0, 0.62, 0.4], Ht = [0, 0.92, 0.3], S = [0, 0.86, -0.19], A = [0, R, rz], F = [0, R, fz];
      K.strut(b, B, [0, 0.9, -0.2], 0.018, tube); K.strut(b, S, Ht, 0.018, tube); K.strut(b, B, Hb, 0.018, tube); K.strut(b, Hb, Ht, 0.02, tube);
      for (const s of [-1, 1]) { K.strut(b, [s * 0.04, R, rz], B, 0.012, tube); K.strut(b, [s * 0.03, R, rz], S, 0.012, tube); K.strut(b, [s * 0.04, R, fz], Hb, 0.012, tube); }
      K.strut(b, Ht, [0, 0.98, 0.34], 0.014, chrome);                                                   // stem
      K.cyl(b, 0.013, 0.013, 0.56, chrome, 0, 0.98, 0.34, 8).rotation.z = Math.PI / 2;                 // handlebar
      for (const s of [-1, 1]) K.cyl(b, 0.018, 0.018, 0.1, rubber, s * 0.24, 0.98, 0.34, 8).rotation.z = Math.PI / 2;
      K.add(b, new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.05, 0.27), rubber), 0, 0.925, -0.21);       // saddle
      K.cyl(b, 0.02, 0.02, 0.14, chrome, 0, 0.29, -0.08, 8).rotation.z = Math.PI / 2;                   // bottom bracket
      K.cyl(b, 0.09, 0.09, 0.008, chrome, 0.05, 0.29, -0.08, 24).rotation.z = Math.PI / 2;              // chainring
      for (const s of [-1, 1]) { K.strut(b, [s * 0.08, 0.29, -0.08], [s * 0.08, 0.29 + s * 0.12, -0.08 + s * 0.08], 0.01, chrome); K.add(b, new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.02, 0.05), rubber), s * 0.12, 0.29 + s * 0.12, -0.08 + s * 0.08); }
      K.strut(b, [-0.03, 0.3, -0.3], [-0.2, 0.035, -0.22], 0.01, chrome);                                // kickstand (its foot meets the floor once the lean is applied)
      b.rotation.z = 0.12;                                                                              // the lean
      return g;
    },
    iso: [
      { shape: 'box', box: [-0.05, 0.02, -0.87, 0.05, 0.66, -0.17], color: '#1c1917' },
      { shape: 'box', box: [-0.05, 0.02, 0.17, 0.05, 0.66, 0.87], color: '#1c1917' },
      { shape: 'box', box: [-0.03, 0.3, -0.25, 0.03, 0.92, 0.4], color: 'role:accent' },
    ],
  },

  // ---------------------------------------------------------------------------------------------------------------
  // Swing set — a timber A-frame with two chain swings. w: the beam length.
  'swing-set': {
    footprint: [2.8, 1.7], height: 2.25, params: ['w', 'color'], tags: ['garden', 'outdoor', 'kids'],
    create(it, ctx) {
      const { THREE, std, box, group, colors, hex } = ctx, K = kit(ctx);
      const w = it.w || 2.8, g = group('Swing Set');
      const timber = std(it.color ? hex(it.color) : colors.wood, { roughness: 0.65 }), chain = K.metal(colors, { metalness: 0.8 });
      g.add(box(w, 0.1, 0.1, timber, 0, 2.2, 0));                                                        // beam
      const dip = 0.045 * 0.8 / Math.hypot(0.8, 2.16);                                                   // a tilted square timber's low corner sits r·sinθ under its end point
      for (const sx of [-1, 1]) {
        const x = sx * (w / 2 - 0.1);
        for (const sz of [-1, 1]) K.strut(g, [x, 2.16, 0], [x, dip, sz * 0.8], 0.045, timber, 8, true);  // A legs, corner on the floor
        K.strut(g, [x, 0.95, -0.44], [x, 0.95, 0.44], 0.03, timber, 8, true);                            // brace
      }
      const seat = std(colors.accent, { roughness: 0.7 });
      for (const sx of [-1, 1]) {
        const x = sx * w / 4;
        g.add(box(0.46, 0.03, 0.18, seat, x, 0.45, 0));
        for (const s of [-1, 1]) K.strut(g, [x + s * 0.2, 2.15, 0], [x + s * 0.2, 0.45, 0], 0.008, chain, 6);
      }
      return g;
    },
    iso: [
      { shape: 'box', box: [-1.4, 2.15, -0.05, 1.4, 2.25, 0.05], color: 'role:wood' },
      { shape: 'box', box: [-1.35, 0, -0.85, -1.25, 2.15, 0.85], color: 'role:wood' },
      { shape: 'box', box: [1.25, 0, -0.85, 1.35, 2.15, 0.85], color: 'role:wood' },
      { shape: 'box', box: [-0.93, 0.44, -0.09, -0.47, 0.47, 0.09], color: 'role:accent' },
      { shape: 'box', box: [0.47, 0.44, -0.09, 0.93, 0.47, 0.09], color: 'role:accent' },
    ],
  },

  // ---------------------------------------------------------------------------------------------------------------
  // Sandbox — a timber frame full of sand, with a bucket, a spade, a ball and a sandcastle where the rng left them.
  'sandbox': {
    footprint: [1.5, 1.5], height: 0.35, params: ['w', 'color'], tags: ['garden', 'outdoor', 'kids'],
    create(it, ctx) {
      const { THREE, std, box, group, colors, hex, mix, rng } = ctx, K = kit(ctx);
      const w = it.w || 1.5, g = group('Sandbox');
      const timber = std(it.color ? hex(it.color) : colors.wood, { roughness: 0.7 }), sand = std(SAND, { roughness: 1 });
      for (const s of [-1, 1]) { g.add(box(w, 0.25, 0.1, timber, 0, 0.125, s * (w / 2 - 0.05))); g.add(box(0.1, 0.25, w - 0.2, timber, s * (w / 2 - 0.05), 0.125, 0)); }
      g.add(box(w - 0.2, 0.17, w - 0.2, sand, 0, 0.085, 0));
      // the three toys land in three sectors (a third of the circle each, seeded within it) so they never stack
      const q = w / 2 - 0.3, spot = i => { const a = i * Math.PI * 2 / 3 + rng() * 1.2, R = q * (0.55 + 0.45 * rng()); return [Math.cos(a) * R, Math.sin(a) * R]; };
      const [bx, bz] = spot(0), [kx, kz] = spot(1), [lx, lz] = spot(2);
      K.cyl(g, 0.08, 0.06, 0.14, std(colors.accent, { roughness: 0.5 }), bx, 0.24, bz, 14);              // bucket
      K.ring(g, 0.08, 0.008, K.metal(colors), bx, 0.32, bz, Math.PI / 2, 0, 16);
      K.cyl(g, 0.1, 0.13, 0.12, std(mix(SAND, 0x000000, 0.12), { roughness: 1 }), kx, 0.23, kz, 8);      // sandcastle
      K.cyl(g, 0.05, 0.07, 0.08, std(mix(SAND, 0x000000, 0.12), { roughness: 1 }), kx, 0.33, kz, 8);
      K.blob(g, 0.1, std(rng() < 0.5 ? colors.fabric2 : 0xdc2626, { roughness: 0.6, flatShading: true }), lx, 0.25, lz);   // ball
      const sa = rng() * Math.PI * 2, sx = (rng() - 0.5) * 0.8 * q, sz = (rng() - 0.5) * 0.8 * q;      // handle + blade reach ≤ 0.4·q + 0.44 < the sand's edge
      K.strut(g, [sx, 0.185, sz], [sx + Math.cos(sa) * 0.3, 0.2, sz + Math.sin(sa) * 0.3], 0.01, K.wood(colors));     // spade handle
      const blade = K.add(g, new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.012, 0.13), std(0xdc2626, { roughness: 0.5 })), sx + Math.cos(sa) * 0.375, 0.185, sz + Math.sin(sa) * 0.375);
      blade.rotation.y = -sa + Math.PI / 2;
      return g;
    },
    iso: [
      { shape: 'box', box: [-0.75, 0, -0.75, 0.75, 0.25, 0.75], color: 'role:wood' },
      { shape: 'box', box: [-0.65, 0, -0.65, 0.65, 0.17, 0.65], color: '#e8d5a6' },
    ],
  },

  // ---------------------------------------------------------------------------------------------------------------
  // Trampoline — a round mat on six legs with a padded rim, safety net on six padded poles. r: the outer radius.
  'trampoline': {
    footprint: [3.6, 3.6], height: 2.7, params: ['r', 'color'], tags: ['garden', 'outdoor', 'kids'],
    create(it, ctx) {
      const { THREE, std, group, colors, hex } = ctx, K = kit(ctx);
      const r = it.r || 1.8, g = group('Trampoline');
      const pad = std(it.color ? hex(it.color) : colors.accent, { roughness: 0.7 }), frame = K.metal(colors, { metalness: 0.8 });
      const mat = std(RUBBER, { roughness: 0.95 });
      K.cyl(g, r - 0.3, r - 0.3, 0.02, mat, 0, 0.9, 0, 40);                                                // mat
      K.ring(g, r - 0.16, 0.16, pad, 0, 0.9, 0, Math.PI / 2, 0, 40);                                       // padded rim
      K.ring(g, r - 0.22, 0.025, frame, 0, 0.84, 0, Math.PI / 2, 0, 36);                                   // frame ring
      for (let i = 0; i < 3; i++) {
        const a = i * Math.PI * 2 / 3, R0 = r - 0.26;
        for (const da of [-0.14, 0.14]) K.cyl(g, 0.02, 0.02, 0.84, frame, Math.cos(a + da) * R0, 0.42, Math.sin(a + da) * R0, 8);
        K.strut(g, [Math.cos(a - 0.14) * R0, 0.02, Math.sin(a - 0.14) * R0], [Math.cos(a + 0.14) * R0, 0.02, Math.sin(a + 0.14) * R0], 0.02, frame);   // W-leg foot
      }
      const net = K.add(g, new THREE.Mesh(new THREE.CylinderGeometry(r - 0.3, r - 0.3, 1.75, 30, 1, true), std(0x64748c, { roughness: 0.9, transparent: true, opacity: 0.28, side: THREE.DoubleSide, depthWrite: false })), 0, 0.9 + 0.875, 0);   // not 0x64748b: theme() reads that as the fabric2 role, which would tint a deliberately neutral net
      net.castShadow = false;
      for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3 + Math.PI / 6, R0 = r - 0.24; K.cyl(g, 0.02, 0.02, 1.8, pad, Math.cos(a) * R0, 1.8, Math.sin(a) * R0, 8); }   // padded poles
      K.ring(g, r - 0.3, 0.012, frame, 0, 2.66, 0, Math.PI / 2, 0, 36);                                   // top ring
      return g;
    },
    iso: [
      { shape: 'cyl', box: [-1.8, 0.75, -1.8, 1.8, 1.05, 1.8], color: 'role:accent' },
      { shape: 'cyl', box: [-1.5, 0.9, -1.5, 1.5, 0.92, 1.5], color: '#1c1917' },
      { shape: 'cyl', box: [-1.5, 2.6, -1.5, 1.5, 2.7, 1.5], color: 'role:metal' },
    ],
  },

  // ---------------------------------------------------------------------------------------------------------------
  // Dog house — a gabled kennel on a plinth, arched doorway toward +z, a name plate over it. w, d: the body.
  'dog-house': {
    footprint: [1.1, 1.2], height: 1.05, params: ['w', 'd', 'color'], tags: ['garden', 'outdoor', 'porch'],
    create(it, ctx) {
      const { THREE, std, box, group, colors, hex } = ctx, K = kit(ctx);
      const w = it.w || 0.9, d = it.d || 1.0, g = group('Dog House');
      const wall = std(it.color ? hex(it.color) : colors.cabinet, { roughness: 0.8 }), roof = std(colors.roof, { roughness: 0.7 }), plinth = K.wood(colors);
      const wallTop = 0.65, ridge = 1.0, over = 0.08;
      g.add(box(w + 0.04, 0.05, d + 0.04, plinth, 0, 0.025, 0));
      g.add(box(w, wallTop - 0.05, d, wall, 0, 0.05 + (wallTop - 0.05) / 2, 0));
      const tri = new THREE.Shape(); tri.moveTo(-w / 2, wallTop); tri.lineTo(w / 2, wallTop); tri.lineTo(0, ridge); tri.closePath();
      const gable = new THREE.ExtrudeGeometry(tri, { depth: d - 0.02, bevelEnabled: false }); gable.translate(0, 0, -(d - 0.02) / 2);
      K.add(g, new THREE.Mesh(gable, wall), 0, 0, 0);
      const ex = w / 2 + over, ey = ridge + 0.02 - (ridge - wallTop) * ex / (w / 2), L = Math.hypot(ex, ridge + 0.02 - ey), ang = Math.atan2(ridge + 0.02 - ey, ex);
      for (const s of [-1, 1]) { const slab = box(L + 0.02, 0.04, d + 0.2, roof, s * ex / 2, (ridge + 0.02 + ey) / 2, 0); slab.rotation.z = -s * ang; g.add(slab); }
      const dark = std(0x10172a, { roughness: 1 });   // not 0x0f172a: theme() reads that as the cabinet role, the same one `wall` resolves to — the doorway would vanish into the wall
      g.add(box(0.3, 0.32, 0.03, dark, 0, 0.05 + 0.16, d / 2 + 0.005));                                   // doorway (arch top at 0.52)
      K.cyl(g, 0.15, 0.15, 0.03, dark, 0, 0.37, d / 2 + 0.005, 20).rotation.x = Math.PI / 2;
      g.add(box(0.26, 0.06, 0.02, std(colors.linen, { roughness: 0.6 }), 0, 0.585, d / 2 + 0.01));         // name plate, clear of the arch
      return g;
    },
    iso: [
      { shape: 'box', box: [-0.45, 0, -0.5, 0.45, 0.65, 0.5], color: 'role:cabinet' },
      { shape: 'box', box: [-0.53, 0.63, -0.6, 0.53, 1.06, 0.6], color: 'role:roof' },
    ],
  },

  // ---------------------------------------------------------------------------------------------------------------
  // Wheelbarrow — a steel tray on two rails, one wheel at the front (+z), handles and legs at the back, a heap of
  // soil in it.
  'wheelbarrow': {
    footprint: [0.6, 1.4], height: 0.66, params: ['color'], tags: ['garden', 'outdoor'],
    create(it, ctx) {
      const { THREE, std, box, group, colors, hex } = ctx, K = kit(ctx);
      const g = group('Wheelbarrow');
      const tray = std(it.color ? hex(it.color) : colors.accent, { metalness: 0.3, roughness: 0.45 }), frame = K.metal(colors), rubber = std(RUBBER, { roughness: 0.9 });
      const t = new THREE.Group(); t.position.set(0, 0.33, 0.02); t.rotation.x = -0.1; g.add(t);           // the tray, nose up
      t.add(box(0.6, 0.02, 0.72, tray, 0, 0.01, 0));                                                     // hollow tray: floor + 4 sides
      for (const s of [-1, 1]) { t.add(box(0.02, 0.26, 0.72, tray, s * 0.29, 0.13, 0)); t.add(box(0.56, 0.26, 0.02, tray, 0, 0.13, s * 0.35)); }
      K.blob(t, 0.18, std(0x3b2a1e, { roughness: 1, flatShading: true }), 0, 0.2, -0.05, 1.3, 0.55, 1.5);    // soil heap, down in the tray
      K.ring(g, 0.13, 0.04, rubber, 0, 0.17, 0.44, 0, Math.PI / 2, 24);                                   // wheel
      K.cyl(g, 0.035, 0.035, 0.1, frame, 0, 0.17, 0.44, 10).rotation.z = Math.PI / 2;
      for (const s of [-1, 1]) {
        K.strut(g, [s * 0.06, 0.17, 0.44], [s * 0.24, 0.58, -0.66], 0.016, frame);                        // rail
        K.cyl(g, 0.02, 0.02, 0.14, rubber, s * 0.245, 0.585, -0.68, 8).rotation.x = Math.PI / 2;          // grip
        K.strut(g, [s * 0.18, 0.4, -0.2], [s * 0.2, 0.005, -0.32], 0.014, frame);                         // leg (cap edge just clears the floor)
      }
      K.strut(g, [-0.2, 0.014, -0.32], [0.2, 0.014, -0.32], 0.014, frame);
      return g;
    },
    iso: [
      { shape: 'box', box: [-0.3, 0.33, -0.34, 0.3, 0.6, 0.38], color: 'role:accent' },
      { shape: 'cyl', box: [-0.04, 0, 0.27, 0.04, 0.34, 0.61], color: '#1c1917' },
    ],
  },

  // ---------------------------------------------------------------------------------------------------------------
  // Garden fountain — three stone tiers on pedestals, water in each, streams spilling from tier to tier.
  'garden-fountain': {
    footprint: [1.6, 1.6], height: 1.52, params: ['r', 'color'], tags: ['garden', 'outdoor', 'entry'],
    create(it, ctx) {
      const { THREE, std, group, colors } = ctx, K = kit(ctx);
      const R = it.r || 0.8, g = group('Garden Fountain'), stone = K.stone(it), water = K.water();
      K.cyl(g, R, R * 0.92, 0.35, stone, 0, 0.175, 0, 28);                                                 // basin
      K.cyl(g, R - 0.08, R - 0.08, 0.02, water, 0, 0.345, 0, 28);
      K.cyl(g, 0.12, 0.17, 0.4, stone, 0, 0.55, 0, 14);
      K.cyl(g, 0.45, 0.25, 0.14, stone, 0, 0.82, 0, 24);                                                   // middle bowl
      K.cyl(g, 0.4, 0.4, 0.015, water, 0, 0.89, 0, 24);
      K.cyl(g, 0.08, 0.12, 0.3, stone, 0, 1.04, 0, 12);
      K.cyl(g, 0.25, 0.14, 0.1, stone, 0, 1.24, 0, 20);                                                    // top bowl
      K.cyl(g, 0.21, 0.21, 0.015, water, 0, 1.29, 0, 20);
      K.cyl(g, 0.03, 0.05, 0.12, stone, 0, 1.35, 0, 10); K.blob(g, 0.055, stone, 0, 1.46, 0);              // finial
      const stream = std(WATER, { roughness: 0.1, transparent: true, opacity: 0.55 });
      for (let i = 0; i < 3; i++) {
        const a = i * Math.PI * 2 / 3 + Math.PI / 6;
        K.cyl(g, 0.014, 0.018, 0.55, stream, Math.cos(a) * 0.42, 0.615, Math.sin(a) * 0.42, 6).castShadow = false;   // middle → basin
        K.cyl(g, 0.011, 0.014, 0.4, stream, Math.cos(a + Math.PI / 3) * 0.23, 1.09, Math.sin(a + Math.PI / 3) * 0.23, 6).castShadow = false;   // top → middle
      }
      return g;
    },
    iso: [
      { shape: 'cyl', box: [-0.8, 0, -0.8, 0.8, 0.35, 0.8], color: '#b8b2a7' },
      { shape: 'cyl', box: [-0.45, 0.75, -0.45, 0.45, 0.9, 0.45], color: '#b8b2a7' },
      { shape: 'cyl', box: [-0.25, 1.19, -0.25, 0.25, 1.52, 0.25], color: '#b8b2a7' },
    ],
  },

  // ---------------------------------------------------------------------------------------------------------------
  // Picnic table — the classic A-frame table with its benches attached, planked top. w: the length along x.
  'picnic-table': {
    footprint: [1.8, 1.4], height: 0.78, params: ['w', 'color'], tags: ['garden', 'outdoor', 'patio'],
    create(it, ctx) {
      const { THREE, std, box, group, colors, hex, mix, rng } = ctx, K = kit(ctx);
      const w = it.w || 1.8, g = group('Picnic Table');
      const base = it.color ? hex(it.color) : colors.wood;
      const plank = () => { const j = (rng() - 0.5) * 0.1; return std(mix(base, j > 0 ? 0xffffff : 0x000000, Math.abs(j)), { roughness: 0.7 }); };
      for (let i = 0; i < 5; i++) g.add(box(w, 0.04, 0.13, plank(), 0, 0.76, -0.3 + i * 0.15));            // top planks
      for (const s of [-1, 1]) g.add(box(w, 0.04, 0.28, plank(), 0, 0.45, s * 0.56));                       // benches
      const timber = std(base, { roughness: 0.7 });
      for (const sx of [-1, 1]) {
        const x = sx * (w / 2 - 0.3);
        g.add(box(0.05, 0.04, 0.72, timber, x, 0.72, 0));                                                  // top cleat
        g.add(box(0.05, 0.04, 1.36, timber, x, 0.41, 0));                                                  // bench rail
        const dip = 0.03 * 0.92 / Math.hypot(0.92, 0.72);                                                  // a tilted square timber's low corner sits r·sinθ under its end point
        K.strut(g, [x, 0.72, -0.3], [x, dip, 0.62], 0.03, timber, 8, true);                                // X legs, corner on the floor
        K.strut(g, [x, 0.72, 0.3], [x, dip, -0.62], 0.03, timber, 8, true);
      }
      g.add(box(w - 0.7, 0.05, 0.08, timber, 0, 0.7, 0));                                                  // stretcher
      return g;
    },
    iso: [
      { shape: 'box', box: [-0.9, 0.72, -0.37, 0.9, 0.78, 0.37], color: 'role:wood' },
      { shape: 'box', box: [-0.9, 0.43, -0.7, 0.9, 0.47, -0.42], color: 'role:wood' },
      { shape: 'box', box: [-0.9, 0.43, 0.42, 0.9, 0.47, 0.7], color: 'role:wood' },
    ],
  },

  // ---------------------------------------------------------------------------------------------------------------
  // Patio heater — a mushroom heater: gas-bottle base, pole, glowing burner under a wide reflector.
  'patio-heater': {
    footprint: [0.9, 0.9], height: 2.24, params: ['color'], tags: ['patio', 'outdoor', 'deck', 'garden'],
    create(it, ctx) {
      const { THREE, std, group, colors, hex } = ctx, K = kit(ctx);
      const g = group('Patio Heater');
      const steel = std(it.color ? hex(it.color) : 0xb4b4b8, { metalness: 0.85, roughness: 0.3 });
      K.cyl(g, 0.25, 0.28, 0.06, steel, 0, 0.03, 0, 24);
      K.cyl(g, 0.2, 0.22, 0.5, steel, 0, 0.31, 0, 24);                                                     // bottle housing
      K.cyl(g, 0.035, 0.035, 1.4, steel, 0, 1.26, 0, 12);
      K.cyl(g, 0.12, 0.09, 0.22, std(EMBER, { emissive: EMBER, emissiveIntensity: 0.8, roughness: 0.6 }), 0, 2.07, 0, 16);   // burner
      K.cyl(g, 0.45, 0.1, 0.06, steel, 0, 2.21, 0, 28);                                                    // reflector
      return g;
    },
    iso: [
      { shape: 'cyl', box: [-0.2, 0, -0.2, 0.2, 0.56, 0.2], color: '#b4b4b8' },
      { shape: 'cyl', box: [-0.45, 2.18, -0.45, 0.45, 2.24, 0.45], color: '#b4b4b8' },
    ],
  },
});
