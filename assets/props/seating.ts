// Seating — sofas, chairs, stools and the soft things people sit on. See index.js for the contract and decor.js
// for the reference module. Every prop: floor origin at the footprint centre, the seat opens toward +z (south) at
// rot 0, big surfaces take a role colour from ctx.colors (or it.color), only trims and buttons use literals, and
// any variation comes from ctx.rng so frames stay deterministic.
import { registerProps } from './registry.js';

// a cushion is the shell's colour lifted a little; legs are the kit's wood unless the fabric is already wood-like
const lift = (mix, c, t = 0.12) => mix(c, 0xffffff, t);
const drop = (mix, c, t = 0.2) => mix(c, 0x000000, t);
const upholstery = (it, colors, hex) => (it.color ? hex(it.color) : colors.fabric);

registerProps({
  // ---------------------------------------------------------------------------------------------------------------
  // Loveseat — a two-seat sofa: plinth, back, two arms, a seat and back cushion per seat, one seeded throw pillow.
  // w ≥ 2.1 grows a third seat, so the same prop is the three-seater.
  'loveseat': {
    footprint: [1.5, 0.85], height: 0.8, params: ['w', 'd', 'color'], tags: ['living', 'bedroom', 'office'],
    create(it, { THREE, std, box, group, colors, hex, mix, rng }) {
      const w = it.w || 1.5, d = it.d || 0.85, g = group('Loveseat');
      const base = upholstery(it, colors, hex);
      const shell = std(base, { roughness: 0.85 }), cushion = std(lift(mix, base), { roughness: 0.9 });
      const legMat = std(colors.wood, { roughness: 0.5 });
      const legH = 0.1, armW = 0.14, backD = 0.2, seatY = 0.34;
      g.add(box(w, seatY - legH, d, shell, 0, legH + (seatY - legH) / 2, 0));                       // plinth
      g.add(box(w, 0.8 - seatY, backD, shell, 0, seatY + (0.8 - seatY) / 2, -d / 2 + backD / 2));   // back
      for (const s of [-1, 1]) g.add(box(armW, 0.28, d - backD, shell, s * (w / 2 - armW / 2), seatY + 0.14, backD / 2));
      for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
        const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.028, legH, 8), legMat);
        leg.position.set(sx * (w / 2 - 0.08), legH / 2, sz * (d / 2 - 0.08)); leg.castShadow = true; g.add(leg);
      }
      const n = Math.max(2, Math.round(w / 0.75)), inner = w - 2 * armW - 0.04, cw = inner / n - 0.02, cd = d - backD - 0.06;
      for (let i = 0; i < n; i++) {
        const cx = -inner / 2 + inner / n * (i + 0.5);
        g.add(box(cw, 0.12, cd, cushion, cx, seatY + 0.06, backD / 2 + 0.01));                    // seat cushion
        const bc = box(cw, 0.36, 0.1, cushion, cx, seatY + 0.12 + 0.17, -d / 2 + backD + 0.04);    // back cushion, leaning
        bc.rotation.x = -0.12; g.add(bc);
      }
      const pillow = box(0.36, 0.36, 0.11, std(rng() < 0.5 ? colors.accent : colors.fabric2, { roughness: 0.9 }), (rng() < 0.5 ? -1 : 1) * (inner / 2 - 0.22), seatY + 0.3, -d / 2 + backD + 0.14);
      pillow.rotation.set(-0.18, (rng() - 0.5) * 0.5, 0.08); g.add(pillow);
      return g;
    },
    iso: [
      { shape: 'box', box: [-0.75, 0.1, -0.425, 0.75, 0.34, 0.425], color: 'role:fabric' },
      { shape: 'box', box: [-0.75, 0.34, -0.425, 0.75, 0.8, -0.225], color: 'role:fabric' },
      { shape: 'box', box: [-0.75, 0.34, -0.225, -0.61, 0.62, 0.425], color: 'role:fabric' },
      { shape: 'box', box: [0.61, 0.34, -0.225, 0.75, 0.62, 0.425], color: 'role:fabric' },
    ],
  },

  // ---------------------------------------------------------------------------------------------------------------
  // Wingback armchair — tall back with two forward-wrapping wings, rolled arms, a loose seat cushion, turned wooden legs.
  'wingback-armchair': {
    footprint: [0.8, 0.85], height: 1.1, params: ['color'], tags: ['living', 'bedroom', 'office'],
    create(it, { THREE, std, box, group, colors, hex, mix }) {
      const w = 0.8, d = 0.85, bt = 0.16, g = group('Wingback Armchair');
      const base = upholstery(it, colors, hex);
      const shell = std(base, { roughness: 0.85 }), cushion = std(lift(mix, base), { roughness: 0.9 });
      const legMat = std(colors.wood, { roughness: 0.5 });
      const legH = 0.12, seatY = 0.38, zi = bt / 2;   // zi: centre of the seat well in front of the back
      g.add(box(w, seatY - legH, d - bt, shell, 0, legH + (seatY - legH) / 2, zi));               // plinth
      g.add(box(w, 1.1 - seatY, bt, shell, 0, seatY + (1.1 - seatY) / 2, -d / 2 + bt / 2));         // tall back
      for (const s of [-1, 1]) {
        const wing = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.5, 0.3).translate(0, 0, 0.15), shell);   // hinged at its rear face, flush with the back's side
        wing.position.set(s * (w / 2 - 0.04), 0.85, -d / 2 + bt); wing.rotation.y = -s * 0.18; wing.castShadow = true; g.add(wing);   // wing, wrapping forward and a little inward
        g.add(box(0.14, 0.26, d - bt, shell, s * (w / 2 - 0.07), seatY + 0.13, zi));               // arm
        const roll = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, d - bt, 12), shell);     // rolled arm top
        roll.rotation.x = Math.PI / 2; roll.position.set(s * (w / 2 - 0.07), seatY + 0.26, zi); roll.castShadow = true; g.add(roll);
      }
      g.add(box(w - 0.3, 0.12, d - bt - 0.04, cushion, 0, seatY + 0.06, zi + 0.01));               // seat cushion
      g.add(box(w - 0.3, 0.4, 0.08, cushion, 0, seatY + 0.34, -d / 2 + bt + 0.04));                // back pad
      for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
        const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.016, legH, 8), legMat);
        leg.position.set(sx * (w / 2 - 0.08), legH / 2, zi + sz * ((d - bt) / 2 - 0.08)); leg.castShadow = true; g.add(leg);
      }
      return g;
    },
    iso: [
      { shape: 'box', box: [-0.4, 0.12, -0.345, 0.4, 0.64, 0.425], color: 'role:fabric' },
      { shape: 'box', box: [-0.4, 0.38, -0.425, 0.4, 1.1, -0.265], color: 'role:fabric' },
    ],
  },

  // ---------------------------------------------------------------------------------------------------------------
  // Chaise lounge — a long single seat with a raked backrest at the north end and one arm on the west side.
  'chaise-lounge': {
    footprint: [0.75, 1.7], height: 0.82, params: ['color'], tags: ['living', 'bedroom'],
    create(it, { THREE, std, box, group, colors, hex, mix, rng }) {
      const w = 0.75, d = 1.7, g = group('Chaise Lounge');
      const base = upholstery(it, colors, hex);
      const shell = std(base, { roughness: 0.85 }), cushion = std(lift(mix, base), { roughness: 0.9 });
      const legMat = std(colors.wood, { roughness: 0.5 });
      const legH = 0.12, seatY = 0.36;
      g.add(box(w, seatY - legH, d, shell, 0, legH + (seatY - legH) / 2, 0));                       // plinth
      const back = new THREE.Mesh(new THREE.BoxGeometry(w, 0.46, 0.16).translate(0, 0.23, 0), shell);   // raked back, pivot at its foot
      back.position.set(0, seatY, -d / 2 + 0.25); back.rotation.x = -0.3; back.castShadow = true; g.add(back);
      g.add(box(0.14, 0.24, 1.15, shell, -w / 2 + 0.07, seatY + 0.12, -0.1));                       // one arm
      g.add(box(w - 0.2, 0.12, d - 0.5, cushion, 0.07, seatY + 0.06, 0.2));                         // seat cushion
      const bolster = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, w - 0.2, 12), std(rng() < 0.5 ? colors.accent : colors.fabric2, { roughness: 0.9 }));
      bolster.rotation.z = Math.PI / 2; bolster.position.set(0.02, seatY + 0.2, -d / 2 + 0.4); bolster.castShadow = true; g.add(bolster);
      for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
        const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.028, legH, 8), legMat);
        leg.position.set(sx * (w / 2 - 0.08), legH / 2, sz * (d / 2 - 0.1)); leg.castShadow = true; g.add(leg);
      }
      return g;
    },
    iso: [
      { shape: 'box', box: [-0.375, 0.12, -0.85, 0.375, 0.48, 0.85], color: 'role:fabric' },
      { shape: 'box', box: [-0.375, 0.36, -0.85, 0.375, 0.82, -0.55], color: 'role:fabric' },
      { shape: 'box', box: [-0.375, 0.36, -0.68, -0.235, 0.6, 0.48], color: 'role:fabric' },
    ],
  },

  // ---------------------------------------------------------------------------------------------------------------
  // Ottoman — a rectangular upholstered block with a buttoned top on stubby wooden feet.
  'ottoman': {
    footprint: [0.7, 0.5], height: 0.42, params: ['w', 'd', 'color'], tags: ['living', 'bedroom'],
    create(it, { THREE, std, box, group, colors, hex, mix }) {
      const w = it.w || 0.7, d = it.d || 0.5, g = group('Ottoman');
      const base = upholstery(it, colors, hex);
      const shell = std(base, { roughness: 0.85 }), top = std(lift(mix, base, 0.08), { roughness: 0.9 });
      const legMat = std(colors.wood, { roughness: 0.5 }), buttonMat = std(drop(mix, base, 0.35), { roughness: 0.6 });
      g.add(box(w, 0.26, d, shell, 0, 0.1 + 0.13, 0));                                             // body
      g.add(box(w - 0.04, 0.06, d - 0.04, top, 0, 0.36 + 0.03, 0));                                // top cushion
      for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
        const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.028, 0.1, 8), legMat);
        leg.position.set(sx * (w / 2 - 0.07), 0.05, sz * (d / 2 - 0.07)); leg.castShadow = true; g.add(leg);
        const button = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.008, 8), buttonMat);
        button.position.set(sx * w * 0.2, 0.424, sz * d * 0.2); g.add(button);                    // tufting buttons
      }
      return g;
    },
    iso: [{ shape: 'box', box: [-0.35, 0.1, -0.25, 0.35, 0.42, 0.25], color: 'role:fabric' }],
  },

  // ---------------------------------------------------------------------------------------------------------------
  // Pouf — a round knitted floor seat: a lathe with a flat bottom and a domed top, flat shaded, seeded fabric pick.
  'pouf': {
    footprint: [0.55, 0.55], height: 0.38, params: ['color'], tags: ['living', 'bedroom', 'kids'],
    create(it, { THREE, std, group, colors, hex, mix, rng }) {
      const g = group('Pouf');
      const base = it.color ? hex(it.color) : (rng() < 0.4 ? colors.accent : rng() < 0.5 ? colors.fabric2 : colors.fabric);
      const profile = [[0, 0], [0.2, 0], [0.26, 0.05], [0.275, 0.17], [0.26, 0.29], [0.19, 0.355], [0, 0.38]].map(([x, y]) => new THREE.Vector2(x, y));
      const body = new THREE.Mesh(new THREE.LatheGeometry(profile, 14), std(base, { roughness: 0.95, flatShading: true }));
      body.castShadow = true; body.receiveShadow = true; g.add(body);
      const button = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.012, 10), std(lift(mix, base, 0.25), { roughness: 0.9 }));
      button.position.y = 0.376; g.add(button);
      return g;
    },
    iso: [{ shape: 'blob', box: [-0.275, 0, -0.275, 0.275, 0.38, 0.275], color: 'role:fabric' }],
  },

  // ---------------------------------------------------------------------------------------------------------------
  // Bar stool — a round padded seat on a metal column with a footrest ring and a low back hoop. h is the seat
  // height (0.72 bar, 0.65 counter).
  'bar-stool': {
    footprint: [0.4, 0.4], height: 0.93, params: ['h', 'color'], tags: ['kitchen', 'dining'],
    create(it, { THREE, std, box, group, colors, hex }) {
      const h = it.h || 0.72, g = group('Bar Stool');
      const seatMat = std(it.color ? hex(it.color) : colors.fabric2, { roughness: 0.7 });
      const metal = std(colors.metal, { metalness: 0.85, roughness: 0.3 });
      const cyl = (rt, rb, hh, mat, y, seg = 16) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, hh, seg), mat); m.position.y = y; m.castShadow = true; g.add(m); return m; };
      cyl(0.19, 0.2, 0.02, metal, 0.01);                                                            // base disc
      cyl(0.024, 0.024, h - 0.05, metal, 0.02 + (h - 0.05) / 2, 10);                                // column
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.012, 8, 24), metal);
      ring.rotation.x = Math.PI / 2; ring.position.y = 0.26; ring.castShadow = true; g.add(ring);   // footrest
      cyl(0.19, 0.17, 0.06, seatMat, h);                                                            // seat pad (top at h + 0.03)
      for (const s of [-1, 1]) g.add(box(0.016, 0.21, 0.016, metal, s * 0.115, h + 0.085, -0.118));   // back uprights, rooted in the pad (radial 0.165 < pad radius)
      g.add(box(0.32, 0.1, 0.03, seatMat, 0, h + 0.16, -0.125));                                    // low back (top at h + 0.21)
      return g;
    },
    iso: [
      { shape: 'cyl', box: [-0.19, 0, -0.19, 0.19, 0.02, 0.19], color: 'role:metal' },
      { shape: 'cyl', box: [-0.024, 0.02, -0.024, 0.024, 0.69, 0.024], color: 'role:metal' },
      { shape: 'cyl', box: [-0.19, 0.69, -0.19, 0.19, 0.75, 0.19], color: 'role:fabric2' },
      { shape: 'box', box: [-0.16, 0.83, -0.14, 0.16, 0.93, -0.11], color: 'role:fabric2' },
    ],
  },

  // ---------------------------------------------------------------------------------------------------------------
  // Dining chair — a wooden frame with a slatted, slightly raked back; style 'wood' (bare seat) or 'upholstered'
  // (a fabric pad on the seat, the default).
  'dining-chair': {
    footprint: [0.45, 0.5], height: 0.9, params: ['style', 'color'], tags: ['dining', 'kitchen', 'office'],
    create(it, { THREE, std, box, group, colors, hex }) {
      const g = group('Dining Chair'), w = 0.45, d = 0.46, seatY = 0.45;
      const wood = std(colors.wood, { roughness: 0.55 });
      for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) g.add(box(0.035, seatY, 0.035, wood, sx * (w / 2 - 0.02), seatY / 2, sz * (d / 2 - 0.02)));   // legs
      g.add(box(w, 0.035, d, wood, 0, seatY - 0.0175, 0));                                         // seat board
      if (it.style !== 'wood') g.add(box(w - 0.05, 0.04, d - 0.05, std(it.color ? hex(it.color) : colors.fabric, { roughness: 0.9 }), 0, seatY + 0.02, 0));   // pad
      const back = new THREE.Group(); back.position.set(0, seatY, -d / 2 + 0.02); back.rotation.x = -0.1; g.add(back);   // raked back, pivot on the rear rail
      for (const s of [-1, 1]) back.add(box(0.035, 0.45, 0.035, wood, s * (w / 2 - 0.02), 0.225, 0));   // back uprights
      back.add(box(w, 0.08, 0.03, wood, 0, 0.41, 0));                                               // top rail
      back.add(box(w - 0.07, 0.05, 0.02, wood, 0, 0.26, 0));                                        // mid slat
      back.add(box(w - 0.07, 0.05, 0.02, wood, 0, 0.12, 0));                                        // low slat
      return g;
    },
    iso: [
      { shape: 'box', box: [-0.225, 0, 0.19, -0.19, 0.42, 0.225], color: 'role:wood' },
      { shape: 'box', box: [0.19, 0, -0.225, 0.225, 0.42, -0.19], color: 'role:wood' },
      { shape: 'box', box: [-0.225, 0.4, -0.23, 0.225, 0.47, 0.23], color: 'role:wood' },
      { shape: 'box', box: [-0.225, 0.47, -0.26, 0.225, 0.9, -0.2], color: 'role:wood' },
    ],
  },

  // ---------------------------------------------------------------------------------------------------------------
  // Rocking chair — two torus-arc rockers, four posts, a spindle back and flat arms; a thin cushion on the seat.
  'rocking-chair': {
    footprint: [0.66, 0.92], height: 1.05, params: ['color'], tags: ['living', 'bedroom', 'kids', 'outdoor'],
    create(it, { THREE, std, box, group, colors, hex }) {
      const g = group('Rocking Chair');
      const wood = std(colors.wood, { roughness: 0.55 });
      const R = 1.0, arc = 0.95, tube = 0.018, seatY = 0.44;
      for (const s of [-1, 1]) {
        const rocker = new THREE.Mesh(new THREE.TorusGeometry(R, tube, 6, 28, arc).rotateZ(-Math.PI / 2 - arc / 2).rotateY(Math.PI / 2), wood);   // arc centred under the axle, ring in the yz plane
        rocker.position.set(s * 0.27, R + tube, 0); rocker.castShadow = true; g.add(rocker);
        for (const sz of [-1, 1]) g.add(box(0.035, seatY - 0.04, 0.035, wood, s * 0.27, 0.04 + (seatY - 0.04) / 2, sz * 0.22));   // posts
      }
      g.add(box(0.6, 0.05, 0.55, wood, 0, seatY - 0.025, 0));                                      // seat
      g.add(box(0.5, 0.05, 0.46, std(it.color ? hex(it.color) : colors.fabric, { roughness: 0.9 }), 0, seatY + 0.025, 0.02));   // cushion
      const back = new THREE.Group(); back.position.set(0, seatY, -0.24); back.rotation.x = -0.15; g.add(back);
      for (const s of [-1, 1]) back.add(box(0.04, 0.58, 0.04, wood, s * 0.27, 0.29, 0));           // back posts
      for (let i = 0; i < 5; i++) {
        const sp = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.011, 0.54, 6), wood);
        sp.position.set(-0.18 + i * 0.09, 0.27, 0); sp.castShadow = true; back.add(sp);            // spindles, seat to top rail
      }
      back.add(box(0.6, 0.07, 0.04, wood, 0, 0.555, 0));                                           // top rail
      for (const s of [-1, 1]) {
        g.add(box(0.06, 0.035, 0.5, wood, s * 0.3, seatY + 0.26, -0.02));                          // arm
        g.add(box(0.03, 0.24, 0.03, wood, s * 0.3, seatY + 0.12, 0.2));                            // front arm post
      }
      return g;
    },
    iso: [
      { shape: 'box', box: [-0.3, 0.4, -0.28, 0.3, 0.5, 0.28], color: 'role:wood' },
      { shape: 'box', box: [-0.3, 0.5, -0.33, 0.3, 1.05, -0.22], color: 'role:wood' },
      { shape: 'box', box: [-0.29, 0, -0.46, -0.25, 0.04, 0.46], color: 'role:wood' },
      { shape: 'box', box: [0.25, 0, -0.46, 0.29, 0.04, 0.46], color: 'role:wood' },
    ],
  },

  // ---------------------------------------------------------------------------------------------------------------
  // Cushioned bench — a wooden frame and four legs under a full-width fabric cushion; end-of-bed or hallway.
  'cushioned-bench': {
    footprint: [1.2, 0.4], height: 0.48, params: ['w', 'd', 'color'], tags: ['bedroom', 'hall', 'dining'],
    create(it, { std, box, group, colors, hex }) {
      const w = it.w || 1.2, d = it.d || 0.4, g = group('Cushioned Bench');
      const wood = std(colors.wood, { roughness: 0.55 });
      for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) g.add(box(0.04, 0.4, 0.04, wood, sx * (w / 2 - 0.06), 0.2, sz * (d / 2 - 0.06)));   // legs
      g.add(box(w, 0.06, d, wood, 0, 0.37, 0));                                                     // frame
      g.add(box(w - 0.02, 0.08, d - 0.02, std(it.color ? hex(it.color) : colors.fabric, { roughness: 0.9 }), 0, 0.44, 0));   // cushion
      return g;
    },
    iso: [
      { shape: 'box', box: [-0.58, 0, 0.12, -0.54, 0.34, 0.16], color: 'role:wood' },
      { shape: 'box', box: [0.54, 0, -0.16, 0.58, 0.34, -0.12], color: 'role:wood' },
      { shape: 'box', box: [-0.6, 0.34, -0.2, 0.6, 0.4, 0.2], color: 'role:wood' },
      { shape: 'box', box: [-0.59, 0.4, -0.19, 0.59, 0.48, 0.19], color: 'role:fabric' },
    ],
  },

  // ---------------------------------------------------------------------------------------------------------------
  // Papasan chair — a rattan bowl on a conical rattan base, tilted so the opening faces +z, with a plush cushion and
  // a rolled rim. Organic parts are flat shaded.
  'papasan-chair': {
    footprint: [1.0, 0.95], height: 0.82, params: ['color'], tags: ['living', 'bedroom', 'kids'],
    create(it, { THREE, std, group, colors, hex, mix }) {
      const g = group('Papasan Chair');
      const rattan = std(mix(colors.wood, 0xc9a26b, 0.4), { roughness: 0.8, side: THREE.DoubleSide, flatShading: true });
      const fabric = std(it.color ? hex(it.color) : colors.fabric, { roughness: 0.95, side: THREE.DoubleSide, flatShading: true });
      const tilt = 0.4, R = 0.56, zb = 0.1;                                                        // bowl radius; the bowl centre sits at z = zb
      const cone = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.3, 0.28, 18, 1, true), rattan);
      cone.position.set(0, 0.14, zb); cone.castShadow = true; g.add(cone);                          // base
      for (const [r, y] of [[0.3, 0.015], [0.2, 0.28]]) { const ring = new THREE.Mesh(new THREE.TorusGeometry(r, 0.015, 6, 24), rattan); ring.rotation.x = Math.PI / 2; ring.position.set(0, y, zb); g.add(ring); }
      const bowl = new THREE.Group(); bowl.position.set(0, 0.28 + R, zb); g.add(bowl);   // the bowl centre; the tilt is baked into each geometry so its lowest point stays on the base
      const tilted = geo => geo.rotateX(tilt);
      const shell = new THREE.Mesh(tilted(new THREE.SphereGeometry(R, 18, 8, 0, Math.PI * 2, Math.PI * 0.65, Math.PI * 0.35)), rattan);
      shell.castShadow = true; bowl.add(shell);
      const pad = new THREE.Mesh(tilted(new THREE.SphereGeometry(R - 0.035, 18, 8, 0, Math.PI * 2, Math.PI * 0.67, Math.PI * 0.33)), fabric);
      pad.castShadow = true; bowl.add(pad);
      const rim = new THREE.Mesh(tilted(new THREE.TorusGeometry((R - 0.035) * Math.sin(Math.PI * 0.67), 0.065, 8, 24).rotateX(Math.PI / 2).translate(0, (R - 0.035) * Math.cos(Math.PI * 0.67), 0)), fabric);
      rim.castShadow = true; bowl.add(rim);
      return g;
    },
    iso: [
      { shape: 'cyl', box: [-0.3, 0, -0.2, 0.3, 0.3, 0.4], color: 'role:wood' },
      { shape: 'blob', box: [-0.5, 0.3, -0.47, 0.5, 0.82, 0.47], color: 'role:fabric' },
    ],
  },

  // ---------------------------------------------------------------------------------------------------------------
  // Bean bag — a slumped flat-shaded lathe, sheared so its peak sits back at -z (the backrest side) and the low
  // face meets the sitter at +z; the shear is baked into the geometry so the measurement stays exact.
  'bean-bag': {
    footprint: [0.8, 0.8], height: 0.58, params: ['color'], tags: ['kids', 'living'],
    create(it, { THREE, std, group, colors, hex, rng }) {
      const g = group('Bean Bag');
      const base = it.color ? hex(it.color) : (rng() < 0.5 ? colors.accent : colors.fabric2);
      const profile = [[0, 0], [0.34, 0], [0.41, 0.1], [0.4, 0.24], [0.32, 0.4], [0.2, 0.5], [0.09, 0.56], [0, 0.58]].map(([x, y]) => new THREE.Vector2(x, y));
      const geo = new THREE.LatheGeometry(profile, 12).applyMatrix4(new THREE.Matrix4().set(1, 0, 0, 0, 0, 1, 0, 0, 0, -0.3, 1, 0.06, 0, 0, 0, 1));   // z -= 0.3·y, slid so the base stays centred
      const body = new THREE.Mesh(geo, std(base, { roughness: 0.95, flatShading: true }));
      body.scale.z = 0.94; body.castShadow = true; body.receiveShadow = true; g.add(body);
      return g;
    },
    iso: [{ shape: 'blob', box: [-0.4, 0, -0.4, 0.4, 0.58, 0.4], color: 'role:accent' }],
  },

  // ---------------------------------------------------------------------------------------------------------------
  // Vanity stool — a round padded top on four splayed metal legs; dressing tables and bathrooms.
  'vanity-stool': {
    footprint: [0.4, 0.4], height: 0.45, params: ['color'], tags: ['bedroom', 'bathroom'],
    create(it, { THREE, std, group, colors, hex }) {
      const g = group('Vanity Stool');
      const metal = std(colors.metal, { metalness: 0.85, roughness: 0.3 });
      const seat = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.18, 0.1, 18), std(it.color ? hex(it.color) : colors.linen, { roughness: 0.9 }));
      seat.position.y = 0.4; seat.castShadow = true; g.add(seat);
      for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
        const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.016, 0.37, 8), metal);
        leg.position.set(sx * 0.13, 0.186, sz * 0.13); leg.rotation.set(-sz * 0.12, 0, sx * 0.12); leg.castShadow = true; g.add(leg);   // splayed; the tilted foot rim just kisses y = 0
      }
      return g;
    },
    iso: [
      { shape: 'box', box: [-0.16, 0, 0.115, -0.13, 0.35, 0.145], color: 'role:metal' },
      { shape: 'box', box: [0.13, 0, -0.145, 0.16, 0.35, -0.115], color: 'role:metal' },
      { shape: 'cyl', box: [-0.2, 0.35, -0.2, 0.2, 0.45, 0.2], color: 'role:linen' },
    ],
  },
});
