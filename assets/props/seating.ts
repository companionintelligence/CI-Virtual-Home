// Seating — sofas, chairs, stools and the soft things people sit on. See index.js for the contract and decor.js
// for the reference module. Every prop: floor origin at the footprint centre, the seat opens toward +z (south) at
// rot 0, big surfaces take a role colour from ctx.colors (or it.color), only trims and buttons use literals, and
// any variation comes from ctx.rng so frames stay deterministic.
import { registerProps } from './registry.js';
import { softkit, softMat, put, lin, smooth } from './softkit.js';

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
    // softkit: a rounded body and a puffed, buttoned top in ONE upholstery mesh, the four feet one timber mesh: 2 meshes where there were 10
    create(it, ctx) {
      const { THREE, std, group, colors, hex } = ctx, K = softkit(THREE);
      const w = it.w || 0.7, d = it.d || 0.5, g = group('Ottoman'), base = upholstery(it, colors, hex);
      const fab = new K.Acc(), feet = new K.Acc(), tw = w - 0.04, td = d - 0.04;
      K.shell(fab, { cy: 0.23, w, h: 0.26, d, r: 0.04, faces: ['px', 'nx', 'pz', 'nz', 'py'], kx: lin(w / 2, 4), kz: lin(d / 2, 3), shade: (_x: number, y: number, _z: number, nx: number, _ny: number, nz: number) => 0.9 - 0.06 * (1 - smooth(-0.13, 0.13, y)) + 0.02 * (Math.abs(nx) + Math.abs(nz) > 0.5 ? 0 : 1) });
      const buttons = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([sx, sz]) => [sx * w * 0.2, sz * d * 0.2]);
      K.shell(fab, { cy: 0.36, w: tw, h: 0.06, d: td, r: 0.025, faces: ['py', 'px', 'nx', 'pz', 'nz'], kx: lin(tw / 2, 8), kz: lin(td / 2, 6), puff: 0.038,
        wave: (x: number, _y: number, z: number, _nx: number, ny: number) => (ny > 0.5 ? [0, -0.012 * buttons.reduce((a, [bx, bz]) => a + Math.exp(-((x - bx) ** 2 + (z - bz) ** 2) / 0.0006), 0), 0] : [0, 0, 0]),
        shade: (x: number, _y: number, z: number, _nx: number, ny: number) => (ny > 0.5 ? 1 - 0.14 * buttons.reduce((a, [bx, bz]) => a + Math.exp(-((x - bx) ** 2 + (z - bz) ** 2) / 0.0006), 0) : 0.9) });   // the tufting buttons are dimples
      for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) K.strut(feet, [sx * (w / 2 - 0.07), 0, sz * (d / 2 - 0.07)], [sx * (w / 2 - 0.07), 0.1, sz * (d / 2 - 0.07)], 0.028, 0.02, 8);
      put(g, fab, softMat(ctx, base, { roughness: 0.9 }), 'upholstery');
      put(g, feet, softMat(ctx, colors.wood, { roughness: 0.5 }), 'feet');
      return g;
    },
    iso: [{ shape: 'box', box: [-0.35, 0.1, -0.25, 0.35, 0.42, 0.25], color: 'role:fabric' }],
  },

  // ---------------------------------------------------------------------------------------------------------------
  // Pouf — a round knitted floor seat: a lathe with a flat bottom and a domed top, flat shaded, seeded fabric pick.
  'pouf': {
    footprint: [0.55, 0.55], height: 0.38, params: ['color'], tags: ['living', 'bedroom', 'kids'],
    // softkit: a turned, knitted-looking floor seat — smooth, gored by neutral shade, a dimpled top — in ONE mesh (the button is part of it): 1 mesh where there were 2
    create(it, ctx) {
      const { THREE, group, colors, hex, rng } = ctx, K = softkit(THREE);
      const g = group('Pouf');
      const base = it.color ? hex(it.color) : (rng() < 0.4 ? colors.accent : rng() < 0.5 ? colors.fabric2 : colors.fabric);
      const acc = new K.Acc();
      K.lathe(acc, [[0.001, 0, 0.84], [0.2, 0, 0.84], [0.26, 0.05, 0.94], [0.275, 0.17, 1], [0.26, 0.29, 1], [0.19, 0.355, 1], [0.1, 0.377, 1], [0.035, 0.382, 0.94], [0.001, 0.367, 0.78]], 16, 0, 1, (x: number, y: number, z: number) => [x * 0.9745, y, z], (ph: number) => 0.9 + 0.1 * Math.abs(Math.cos(ph * 3)));
      put(g, acc, softMat(ctx, base, { roughness: 0.95 }), 'pouf');
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
    // softkit: legs and frame are one timber mesh, the cushion one puffed, channelled mesh: 2 meshes where there were 6
    create(it, ctx) {
      const { THREE, group, colors, hex } = ctx, K = softkit(THREE);
      const w = it.w || 1.2, d = it.d || 0.4, g = group('Cushioned Bench'), wood = new K.Acc(), fab = new K.Acc();
      for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) K.slab(wood, sx * (w / 2 - 0.06), 0.2, sz * (d / 2 - 0.06), 0.04, 0.4, 0.04);   // legs
      K.slab(wood, 0, 0.37, 0, w, 0.06, d);                                                                                                       // frame
      const cw = w - 0.02, cd = d - 0.02, ch = Math.max(2, Math.round(cw / 0.3));
      K.shell(fab, { cy: 0.432, w: cw, h: 0.07, d: cd, r: 0.02, faces: ['py', 'px', 'nx', 'pz', 'nz'], kx: lin(cw / 2, ch * 4), kz: lin(cd / 2, 3), puff: 0.01,
        wave: (x: number, _y: number, _z: number, _nx: number, ny: number) => (ny > 0.5 ? [0, 0.004 * Math.cos((x / cw) * Math.PI * 2 * ch), 0] : [0, 0, 0]),
        shade: (x: number, _y: number, _z: number, _nx: number, ny: number) => (ny > 0.5 ? 0.94 + 0.06 * (0.5 + 0.5 * Math.cos((x / cw) * Math.PI * 2 * ch)) : 0.88) });   // channels
      put(g, wood, softMat(ctx, colors.wood, { roughness: 0.55 }), 'frame');
      put(g, fab, softMat(ctx, it.color ? hex(it.color) : colors.fabric, { roughness: 0.9 }), 'cushion');
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
    // softkit: the same slumped turn — the peak back at −z, the low face meeting the sitter at +z, the shear baked into the vertices — smooth and creased by shade
    create(it, ctx) {
      const { THREE, group, colors, hex, rng } = ctx, K = softkit(THREE);
      const g = group('Bean Bag');
      const base = it.color ? hex(it.color) : (rng() < 0.5 ? colors.accent : colors.fabric2);
      const acc = new K.Acc();
      K.lathe(acc, [[0.001, 0, 0.8], [0.34, 0, 0.84], [0.395, 0.05, 0.92], [0.41, 0.1, 1], [0.405, 0.17, 1], [0.4, 0.24, 1], [0.37, 0.32, 1], [0.32, 0.4, 1], [0.26, 0.46, 1], [0.2, 0.5, 1], [0.09, 0.56, 0.96], [0.001, 0.58, 0.9]], 16, 0, 1,
        (x: number, y: number, z: number) => [x, y, (z - 0.3 * y + 0.06) * 0.94], (ph: number) => 0.92 + 0.08 * Math.cos(ph * 5 + 0.6));
      put(g, acc, softMat(ctx, base, { roughness: 0.95 }), 'beanbag');
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

// =================================================================================================================
// Pass 4 (S3 compose): the sofa family, armchairs and dining chairs the composer varies by seed and style — the
// fleet had one sofa (loveseat, in all 30 houses) and one armchair it reached for (wingback, 29). Same contract as
// above: floor origin at the footprint centre, the seat opens toward +z, big surfaces from ctx.colors or it.color.
// =================================================================================================================
const legsAt = (THREE, g, mat, pts, h, rTop, rBot, splay = 0, seg = 8) => {
  for (const [x, z] of pts) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(rTop, rBot, h, seg), mat);
    leg.position.set(x, h / 2, z);
    if (splay) leg.rotation.set(-Math.sign(z) * splay, 0, Math.sign(x) * splay);   // the foot swings outward
    leg.castShadow = true; g.add(leg);
  }
};
const quad = (w, d, inset) => [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([sx, sz]) => [sx * (w / 2 - inset), sz * (d / 2 - inset)]);

// One upholstered sofa, parametrised by its arm, its legs and its cushions. deckY is the top of the base (the seat
// cushions sit on it), backH the top of the back, armTop the top of the arms (a roll adds its radius on top).
function sofa(ctx, it, name, o) {
  const { THREE, std, box, group, colors, hex, mix, rng } = ctx;
  const w = it.w || o.w, d = it.d || o.d, g = group(name);
  const base = upholstery(it, colors, hex);
  const shell = std(base, { roughness: o.leather ? 0.45 : 0.85 }), cushion = std(lift(mix, base, o.leather ? 0.06 : 0.12), { roughness: o.leather ? 0.5 : 0.9 });
  const legMat = o.legs === 'metal' ? std(colors.metal, { metalness: 0.8, roughness: 0.3 }) : std(colors.wood, { roughness: 0.5 });
  const legH = o.legH, deckY = o.seatY - 0.12, backD = o.backD || 0.2, armW = o.armW;
  const bodyY0 = o.legs === 'skirt' ? 0.015 : legH;
  g.add(box(w, deckY - bodyY0, d, shell, 0, bodyY0 + (deckY - bodyY0) / 2, 0));                       // base
  g.add(box(w, o.backH - deckY, backD, shell, 0, deckY + (o.backH - deckY) / 2, -d / 2 + backD / 2));   // back
  const armD = o.arm === 'tux' ? d : d - backD, armZ = o.arm === 'tux' ? 0 : backD / 2;
  for (const s of [-1, 1]) {
    const top = o.arm === 'roll' ? o.armTop - armW / 2 : o.armTop;
    g.add(box(armW, top - bodyY0, armD, shell, s * (w / 2 - armW / 2), bodyY0 + (top - bodyY0) / 2, armZ));
    if (o.arm === 'roll') {
      const roll = new THREE.Mesh(new THREE.CylinderGeometry(armW / 2 + 0.02, armW / 2 + 0.02, armD, 14), shell);
      roll.rotation.x = Math.PI / 2; roll.position.set(s * (w / 2 - armW / 2), top, armZ); roll.castShadow = true; g.add(roll);
    }
  }
  if (o.legs === 'skirt') g.add(box(w + 0.01, 0.16, d + 0.01, shell, 0, 0.095, 0));                     // the skirt, to the floor
  else if (o.legs === 'bun') for (const [x, z] of quad(w, d, 0.1)) { const b = new THREE.Mesh(new THREE.SphereGeometry(legH / 2 + 0.005, 10, 8), legMat); b.position.set(x, legH / 2, z); b.castShadow = true; g.add(b); }
  else if (o.legs === 'taper') legsAt(THREE, g, legMat, quad(w, d, 0.12), legH, 0.025, 0.014, 0.12);
  else legsAt(THREE, g, legMat, quad(w, d, 0.08), legH, 0.022, 0.022, 0);
  // seat cushions across the well between the arms
  const inner = w - 2 * armW - 0.02, n = o.seats || Math.max(2, Math.min(3, Math.round(inner / 0.62))), cw = inner / n - 0.015, cd = d - backD - 0.04;
  for (let i = 0; i < n; i++) {
    const cx = -inner / 2 + inner / n * (i + 0.5);
    g.add(box(cw, o.seatY + 0.02 - deckY, cd, cushion, cx, deckY + (o.seatY + 0.02 - deckY) / 2, backD / 2 + 0.01));
    if (o.backCushions) {
      const bh = Math.min(0.42, o.backH - o.seatY + 0.02), bc = box(cw, bh, 0.12, cushion, cx, o.seatY + 0.02 + bh / 2, -d / 2 + backD + 0.05);
      bc.rotation.x = -0.1; g.add(bc);
    }
  }
  if (o.tufted) {   // deep buttons across the back and arms, the chesterfield's signature (8 meshes)
    const btn = std(drop(mix, base, 0.3), { roughness: 0.5 }), geo = new THREE.SphereGeometry(0.016, 8, 6);
    for (let i = 0; i < 6; i++) { const m = new THREE.Mesh(geo, btn); m.position.set(-w * 0.36 + i * w * 0.144, o.backH - 0.13, -d / 2 + backD + 0.004); g.add(m); }
    for (const s of [-1, 1]) { const m = new THREE.Mesh(geo, btn); m.position.set(s * (w / 2 - armW - 0.004), o.armTop - 0.15, 0.05); g.add(m); }
  }
  if (o.bolsters) for (const s of [-1, 1]) {
    const b = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.42, 12), std(rng() < 0.5 ? colors.accent : colors.fabric2, { roughness: 0.9 }));
    b.rotation.x = Math.PI / 2; b.position.set(s * (inner / 2 - 0.1), o.seatY + 0.11, backD / 2 - 0.02); b.castShadow = true; g.add(b);
  } else {
    const py = Math.min(o.seatY + 0.24, o.backH - 0.14);   // leaning on the back, never over its top
    const pillow = box(0.38, 0.38, 0.11, std(rng() < 0.5 ? colors.accent : colors.fabric2, { roughness: 0.9 }), (rng() < 0.5 ? -1 : 1) * (inner / 2 - 0.24), py, -d / 2 + backD + 0.16);
    pillow.rotation.set(-0.18, (rng() - 0.5) * 0.5, 0.08); g.add(pillow);
  }
  return g;
}
const sofaIso = (w, d, backH, armW, backD = 0.2) => [
  { shape: 'box', box: [-w / 2, 0.1, -d / 2, w / 2, 0.44, d / 2], color: 'role:fabric' },
  { shape: 'box', box: [-w / 2, 0.32, -d / 2, w / 2, backH, -d / 2 + backD], color: 'role:fabric' },
  { shape: 'box', box: [-w / 2, 0.32, -d / 2, -w / 2 + armW, 0.64, d / 2], color: 'role:fabric' },
  { shape: 'box', box: [w / 2 - armW, 0.32, -d / 2, w / 2, 0.64, d / 2], color: 'role:fabric' },
];

registerProps({
  // ---- sofas: a three-seater in five characters; w and d resize every one (w ≥ 2.4 keeps three seats wide)
  // Track-arm sofa — square low arms, loose seat and back cushions on short block legs (modern, scandi).
  'sofa': {
    footprint: [2.2, 0.95], height: 0.82, params: ['w', 'd', 'color'], tags: ['living', 'den', 'media'],
    create: (it, ctx) => sofa(ctx, it, 'Sofa', { w: 2.2, d: 0.95, seatY: 0.44, backH: 0.82, armW: 0.16, armTop: 0.62, arm: 'track', legs: 'block', legH: 0.1, backCushions: true }),
    iso: sofaIso(2.2, 0.95, 0.82, 0.16),
  },
  // Slipcover sofa — a skirt to the floor, rolled arms, loose back cushions (farmhouse, cottage).
  'slipcover-sofa': {
    footprint: [2.1, 0.97], height: 0.86, params: ['w', 'd', 'color'], tags: ['living', 'den'],
    create: (it, ctx) => sofa(ctx, it, 'Slipcover Sofa', { w: 2.1, d: 0.95, seatY: 0.46, backH: 0.86, armW: 0.2, armTop: 0.7, arm: 'roll', legs: 'skirt', legH: 0.14, backCushions: true }),
    iso: sofaIso(2.1, 0.95, 0.86, 0.22),
  },
  // Chesterfield — arms rolled to the height of the back, deep-buttoned, on bun feet; leather sheen (library,
  // craftsman, industrial).
  'chesterfield-sofa': {
    footprint: [2.24, 0.96], height: 0.77, params: ['w', 'd', 'color'], tags: ['living', 'library', 'den'],
    create: (it, ctx) => sofa(ctx, it, 'Chesterfield Sofa', { w: 2.2, d: 0.92, seatY: 0.44, backH: 0.76, armW: 0.2, armTop: 0.77, arm: 'roll', legs: 'bun', legH: 0.1, tufted: true, leather: true, seats: 3 }),
    iso: sofaIso(2.24, 0.96, 0.77, 0.24),
  },
  // Mid-century sofa — thin arms, two long seat cushions and bolsters on splayed tapered legs (mid-century, scandi).
  'mid-century-sofa': {
    footprint: [2.0, 0.89], height: 0.78, params: ['w', 'd', 'color'], tags: ['living', 'den', 'study'],
    create: (it, ctx) => sofa(ctx, it, 'Mid-century Sofa', { w: 2.0, d: 0.85, seatY: 0.43, backH: 0.78, armW: 0.07, armTop: 0.58, arm: 'thin', legs: 'taper', legH: 0.2, seats: 2, backCushions: true, bolsters: true, backD: 0.14 }),
    iso: sofaIso(2.0, 0.85, 0.78, 0.07, 0.14),
  },
  // Tuxedo sofa — arms and back one height, a tight crisp box on slim metal legs (modern, industrial).
  'tuxedo-sofa': {
    footprint: [2.2, 0.9], height: 0.72, params: ['w', 'd', 'color'], tags: ['living', 'den', 'media'],
    create: (it, ctx) => sofa(ctx, it, 'Tuxedo Sofa', { w: 2.2, d: 0.9, seatY: 0.43, backH: 0.72, armW: 0.16, armTop: 0.72, arm: 'tux', legs: 'metal', legH: 0.1, seats: 3 }),
    iso: sofaIso(2.2, 0.9, 0.72, 0.16),
  },

  // ---- L-sectional: a run of seats along the back (w) and a chaise (l deep) at one end. `hand` is the chaise's side
  // as you sit on it facing +z: 'left' puts it at +x, 'right' at −x. Footprint w × l, origin at its centre.
  'l-sectional': {
    footprint: [2.8, 1.7], height: 0.82, params: ['w', 'l', 'd', 'hand', 'color'], tags: ['living', 'den', 'media'],
    create(it, ctx) {
      const { THREE, std, box, group, colors, hex, mix, rng } = ctx;
      const w = it.w || 2.8, l = it.l || 1.7, d = it.d || 0.95, g = group(`L-Sectional (${it.hand === 'right' ? 'right' : 'left'})`);
      const side = it.hand === 'right' ? -1 : 1;   // the chaise's end
      const base = upholstery(it, colors, hex), shell = std(base, { roughness: 0.85 }), cushion = std(lift(mix, base), { roughness: 0.9 });
      const legMat = std(colors.metal, { metalness: 0.8, roughness: 0.3 });
      const legH = 0.1, deckY = 0.32, seatTop = 0.46, backD = 0.2, armW = 0.16, cw = d;   // the chaise is one seat deep wide
      const z0 = -l / 2, runZ = z0 + d / 2;                                                    // the run's centre line
      g.add(box(w, deckY - legH, d, shell, 0, legH + (deckY - legH) / 2, runZ));                // run base
      const chX = side * (w / 2 - cw / 2), chL = l - d;                                          // the chaise's extension toward +z
      g.add(box(cw, deckY - legH, chL, shell, chX, legH + (deckY - legH) / 2, z0 + d + chL / 2));
      g.add(box(w, 0.82 - deckY, backD, shell, 0, deckY + (0.82 - deckY) / 2, z0 + backD / 2));   // back along the run
      g.add(box(armW, 0.62 - legH, d - backD, shell, -side * (w / 2 - armW / 2), legH + (0.62 - legH) / 2, z0 + backD + (d - backD) / 2));   // the far arm
      legsAt(THREE, g, legMat, [[-w / 2 + 0.08, z0 + 0.08], [w / 2 - 0.08, z0 + 0.08], [-side * (w / 2 - 0.08), z0 + d - 0.08], [side * (w / 2 - 0.08), l / 2 - 0.08], [side * (w / 2 - cw + 0.08), l / 2 - 0.08], [side * (w / 2 - cw + 0.08), z0 + d - 0.08]], legH, 0.02, 0.02);
      // seats along the run (from the arm to the chaise), then the chaise's long cushion
      const runIn = w - armW - cw - 0.02, n = Math.max(1, Math.round(runIn / 0.65)), sw = runIn / n - 0.015, sd = d - backD - 0.04;
      for (let i = 0; i < n; i++) {
        const x = -side * (w / 2 - armW - 0.01) + side * (runIn / n) * (i + 0.5);
        g.add(box(sw, seatTop - deckY, sd, cushion, x, deckY + (seatTop - deckY) / 2, z0 + backD + sd / 2 + 0.02));
        const bc = box(sw, 0.36, 0.12, cushion, x, seatTop + 0.18, z0 + backD + 0.05); bc.rotation.x = -0.1; g.add(bc);
      }
      g.add(box(cw - 0.03, seatTop - deckY, l - backD - 0.03, cushion, chX, deckY + (seatTop - deckY) / 2, z0 + backD + (l - backD) / 2));
      const bc = box(cw - 0.03, 0.36, 0.12, cushion, chX, seatTop + 0.18, z0 + backD + 0.05); bc.rotation.x = -0.1; g.add(bc);
      const pillow = box(0.4, 0.4, 0.11, std(rng() < 0.5 ? colors.accent : colors.fabric2, { roughness: 0.9 }), chX - side * 0.12, seatTop + 0.22, z0 + backD + 0.18);
      pillow.rotation.set(-0.18, (rng() - 0.5) * 0.5, 0.08); g.add(pillow);
      return g;
    },
    iso: [
      { shape: 'box', box: [-1.4, 0.1, -0.85, 1.4, 0.46, 0.1], color: 'role:fabric' },
      { shape: 'box', box: [0.45, 0.1, 0.1, 1.4, 0.46, 0.85], color: 'role:fabric' },
      { shape: 'box', box: [-1.4, 0.32, -0.85, 1.4, 0.82, -0.65], color: 'role:fabric' },
    ],
  },

  // ---- armchairs ----------------------------------------------------------------------------------------------
  // Mission armchair — an oak frame with slatted sides and back, flat wide arms, loose seat and back cushions
  // (craftsman, farmhouse, mediterranean).
  'mission-armchair': {
    footprint: [0.78, 0.84], height: 0.95, params: ['color'], tags: ['living', 'library', 'study', 'den'],
    create(it, { THREE, std, box, group, colors, hex, mix }) {
      const w = 0.78, d = 0.84, g = group('Mission Armchair');
      const wood = std(colors.wood, { roughness: 0.55 }), fab = std(upholstery(it, colors, hex), { roughness: 0.88 });
      const post = 0.05, armY = 0.62;
      for (const [x, z] of quad(w, d, post / 2)) g.add(box(post, z < 0 ? 0.95 : armY, post, wood, x, (z < 0 ? 0.95 : armY) / 2, z));   // back posts run up to the crest
      for (const s of [-1, 1]) {
        g.add(box(0.11, 0.03, d + 0.04, wood, s * (w / 2 - 0.03), armY + 0.015, 0.02));                     // flat arm
        g.add(box(0.03, 0.05, d - 2 * post, wood, s * (w / 2 - post / 2), 0.22, 0));                        // low side rail
        for (let k = 0; k < 3; k++) g.add(box(0.012, armY - 0.25, 0.05, wood, s * (w / 2 - post / 2), 0.25 + (armY - 0.25) / 2, -0.2 + k * 0.2));   // side slats
      }
      g.add(box(w - 2 * post, 0.05, d - 2 * post, wood, 0, 0.33, 0));                                        // seat frame
      for (let k = 0; k < 5; k++) g.add(box(0.05, 0.48, 0.012, wood, -0.24 + k * 0.12, 0.62, -d / 2 + post / 2));   // back slats
      g.add(box(w - 2 * post, 0.07, 0.03, wood, 0, 0.91, -d / 2 + post / 2));                                // crest rail
      g.add(box(w - 2 * post - 0.02, 0.12, d - 2 * post - 0.06, fab, 0, 0.415, 0.03));                        // seat cushion
      const bc = box(w - 2 * post - 0.04, 0.44, 0.1, std(lift(mix, upholstery(it, colors, hex), 0.08), { roughness: 0.9 }), 0, 0.7, -d / 2 + post + 0.07); bc.rotation.x = -0.12; g.add(bc);
      return g;
    },
    iso: [
      { shape: 'box', box: [-0.39, 0, -0.42, 0.39, 0.65, 0.44], color: 'role:wood' },
      { shape: 'box', box: [-0.34, 0.36, -0.36, 0.34, 0.48, 0.36], color: 'role:fabric' },
      { shape: 'box', box: [-0.39, 0.3, -0.42, 0.39, 0.95, -0.37], color: 'role:wood' },
    ],
  },
  // Barrel chair — a curved back wrapping round a round seat, on a low plinth (modern, mid-century).
  'barrel-chair': {
    footprint: [0.78, 0.78], height: 0.76, params: ['color'], tags: ['living', 'bedroom', 'study'],
    create(it, { THREE, std, group, colors, hex, mix }) {
      const R = 0.39, g = group('Barrel Chair'), base = upholstery(it, colors, hex);
      const shell = std(base, { roughness: 0.85, side: THREE.DoubleSide }), cushion = std(lift(mix, base, 0.1), { roughness: 0.9 });
      const plinth = new THREE.Mesh(new THREE.CylinderGeometry(R - 0.06, R - 0.04, 0.08, 28), std(colors.wood, { roughness: 0.5 }));
      plinth.position.y = 0.04; plinth.castShadow = true; g.add(plinth);
      const seat = new THREE.Mesh(new THREE.CylinderGeometry(R - 0.02, R - 0.02, 0.3, 28), shell); seat.position.y = 0.23; seat.castShadow = true; g.add(seat);
      const pad = new THREE.Mesh(new THREE.CylinderGeometry(R - 0.1, R - 0.08, 0.1, 28), cushion); pad.position.set(0, 0.43, 0.03); pad.castShadow = true; g.add(pad);
      // the wrap: an open arc round the back 240° wide, thick enough to read (outer + inner walls and a top band)
      const arc = Math.PI * 4 / 3, start = Math.PI - arc / 2;   // centred on −z (a cylinder's θ 0 is +z)
      for (const [r, h, y] of [[R, 0.5, 0.51], [R - 0.08, 0.36, 0.58]]) {
        const wall = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 32, 1, true, start, arc), shell); wall.position.y = y; wall.castShadow = true; g.add(wall);
      }
      const rim = new THREE.Mesh(new THREE.RingGeometry(R - 0.08, R, 32, 1, start - Math.PI / 2, arc).rotateX(-Math.PI / 2), shell); rim.position.y = 0.76; g.add(rim);
      return g;
    },
    iso: [{ shape: 'cyl', box: [-0.39, 0, -0.39, 0.39, 0.46, 0.39], color: 'role:fabric' }, { shape: 'box', box: [-0.39, 0.46, -0.39, 0.39, 0.76, -0.1], color: 'role:fabric' }],
  },
  // Slipper chair — armless, a tall slightly raked back, on short tapered legs (cottage, scandi, bedroom corners).
  'slipper-chair': {
    footprint: [0.62, 0.74], height: 0.88, params: ['color'], tags: ['living', 'bedroom'],
    create(it, { THREE, std, box, group, colors, hex, mix }) {
      const w = 0.62, d = 0.72, g = group('Slipper Chair'), base = upholstery(it, colors, hex);
      const shell = std(base, { roughness: 0.85 }), cushion = std(lift(mix, base, 0.1), { roughness: 0.9 });
      legsAt(THREE, g, std(colors.wood, { roughness: 0.5 }), quad(w, d, 0.08), 0.15, 0.022, 0.014, 0.1);
      g.add(box(w, 0.2, d, shell, 0, 0.25, 0));
      g.add(box(w - 0.04, 0.08, d - 0.14, cushion, 0, 0.39, 0.05));
      const back = new THREE.Group(); back.position.set(0, 0.35, -d / 2 + 0.07); back.rotation.x = -0.14; g.add(back);
      back.add(box(w, 0.52, 0.14, shell, 0, 0.26, 0));
      return g;
    },
    iso: [{ shape: 'box', box: [-0.31, 0.15, -0.36, 0.31, 0.43, 0.36], color: 'role:fabric' }, { shape: 'box', box: [-0.31, 0.35, -0.37, 0.31, 0.88, -0.2], color: 'role:fabric' }],
  },
  // Lounge chair — moulded wooden shells (seat and raked back) with leather cushions on a five-spoke swivel base
  // (mid-century, modern, a library's reading chair).
  'lounge-chair': {
    footprint: [0.84, 0.86], height: 0.86, params: ['color'], tags: ['living', 'library', 'study', 'bedroom'],
    create(it, { THREE, std, box, group, colors, hex, mix }) {
      const g = group('Lounge Chair'), wood = std(colors.wood, { roughness: 0.45 }), metal = std(colors.metal, { metalness: 0.8, roughness: 0.3 });
      const hide = std(it.color ? hex(it.color) : mix(colors.fabric, 0x000000, 0.35), { roughness: 0.5 });
      for (let k = 0; k < 5; k++) { const a = k * Math.PI * 2 / 5, s = box(0.36, 0.03, 0.05, metal, Math.sin(a) * 0.16, 0.03, Math.cos(a) * 0.16); s.rotation.y = a + Math.PI / 2; g.add(s); }
      const col = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.035, 0.26, 10), metal); col.position.y = 0.17; g.add(col);
      const seat = new THREE.Group(); seat.position.set(0, 0.3, 0.06); seat.rotation.x = -0.1; g.add(seat);
      seat.add(box(0.72, 0.04, 0.6, wood, 0, 0.02, 0));
      seat.add(box(0.62, 0.1, 0.56, hide, 0, 0.09, 0.01));
      for (const s of [-1, 1]) seat.add(box(0.1, 0.05, 0.4, hide, s * 0.33, 0.2, 0));   // arm pads
      const back = new THREE.Group(); back.position.set(0, 0.34, -0.22); back.rotation.x = -0.32; g.add(back);
      back.add(box(0.72, 0.52, 0.04, wood, 0, 0.26, -0.02));
      back.add(box(0.62, 0.48, 0.1, hide, 0, 0.27, 0.05));
      return g;
    },
    iso: [{ shape: 'box', box: [-0.36, 0.28, -0.3, 0.36, 0.46, 0.4], color: 'role:fabric' }, { shape: 'box', box: [-0.36, 0.34, -0.43, 0.36, 0.86, -0.2], color: 'role:wood' }],
  },
  // Rattan armchair — a woven frame whose arms and back are one rolled hoop, a skirt of cane, a loose seat cushion
  // (tropical, mediterranean, cottage, sunrooms).
  'rattan-armchair': {
    footprint: [0.8, 0.8], height: 0.8, params: ['color'], tags: ['living', 'sunroom', 'bedroom'],
    create(it, { THREE, std, box, group, colors, hex, mix }) {
      const g = group('Rattan Armchair'), R = 0.38;
      const cane = std(mix(colors.wood, 0xc9a26b, 0.5), { roughness: 0.8, side: THREE.DoubleSide, flatShading: true });
      legsAt(THREE, g, cane, quad(0.6, 0.6, 0.04), 0.12, 0.02, 0.02);
      const seat = new THREE.Mesh(new THREE.CylinderGeometry(R - 0.04, R - 0.04, 0.08, 24), cane); seat.position.y = 0.16; seat.castShadow = true; g.add(seat);
      // the wrap of cane round the back and arms (220°, open to +z), and a rolled rim along its top edge
      const arc = Math.PI * 11 / 9, start = Math.PI - arc / 2;
      const wrap = new THREE.Mesh(new THREE.CylinderGeometry(R, R - 0.02, 0.5, 28, 1, true, start, arc), cane); wrap.position.y = 0.45; wrap.castShadow = true; g.add(wrap);
      const rim = new THREE.Mesh(new THREE.TorusGeometry(R, 0.035, 8, 28, arc).rotateX(Math.PI / 2), cane); rim.rotation.y = Math.PI / 2 + arc / 2;   // the arc (after rotateX) spans θ π/2 − arc … π/2; turn it onto π ± arc/2 rim.position.y = 0.72; rim.castShadow = true; g.add(rim);
      g.add(box(0.56, 0.1, 0.5, std(it.color ? hex(it.color) : colors.linen, { roughness: 0.95 }), 0, 0.25, 0.04));
      return g;
    },
    iso: [{ shape: 'cyl', box: [-0.4, 0, -0.4, 0.4, 0.76, 0.4], color: 'role:wood' }, { shape: 'box', box: [-0.28, 0.2, -0.21, 0.28, 0.3, 0.29], color: 'role:linen' }],
  },

  // ---- dining chairs (the composer's seats round a table; a desk chair in a study) -------------------------------
  // Windsor chair — a saddle seat on splayed turned legs, a spindle back under a bowed crest (farmhouse, cottage).
  'windsor-chair': {
    footprint: [0.5, 0.5], height: 0.96, params: ['color'], tags: ['dining', 'kitchen', 'study'],
    create(it, { THREE, std, box, group, colors, hex }) {
      const g = group('Windsor Chair'), wood = std(it.color ? hex(it.color) : colors.wood, { roughness: 0.55 });
      legsAt(THREE, g, wood, quad(0.4, 0.38, 0.03), 0.44, 0.02, 0.016, 0.1);
      g.add(box(0.46, 0.045, 0.44, wood, 0, 0.455, 0.01));
      // the bowed crest: an arc of 0.8π centred on −z, 0.24 round a point 0.02 in front of the seat's middle
      const arc = Math.PI * 0.8, cz = 0.02, R = 0.23;
      const crest = new THREE.Mesh(new THREE.TorusGeometry(R, 0.022, 8, 20, arc).rotateX(Math.PI / 2), wood);
      crest.rotation.y = Math.PI / 2 + arc / 2; crest.position.set(0, 0.93, cz); crest.castShadow = true; g.add(crest);
      for (let k = 0; k < 7; k++) {   // spindles from the seat's back edge up to the crest
        const phi = Math.PI - arc * 0.42 + k * arc * 0.84 / 6;
        const sp = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.011, 0.46, 6), wood); sp.position.set(Math.sin(phi) * R, 0.7, cz + Math.cos(phi) * R); g.add(sp);
      }
      return g;
    },
    iso: [{ shape: 'box', box: [-0.23, 0, -0.21, 0.23, 0.48, 0.23], color: 'role:wood' }, { shape: 'box', box: [-0.22, 0.48, -0.25, 0.22, 0.96, -0.1], color: 'role:wood' }],
  },
  // Bentwood chair — a round seat, a steam-bent loop back and a bent ring between the legs (scandi, bistro, cottage).
  'bentwood-chair': {
    footprint: [0.44, 0.5], height: 0.88, params: ['color'], tags: ['dining', 'kitchen', 'study'],
    create(it, { THREE, std, group, colors, hex }) {
      const g = group('Bentwood Chair'), wood = std(it.color ? hex(it.color) : colors.wood, { roughness: 0.5 });
      legsAt(THREE, g, wood, [[-0.15, 0.12], [0.15, 0.12], [-0.13, -0.13], [0.13, -0.13]], 0.44, 0.016, 0.014, 0.06);
      const seat = new THREE.Mesh(new THREE.CylinderGeometry(0.21, 0.21, 0.035, 28), wood); seat.position.set(0, 0.455, 0.01); seat.castShadow = true; g.add(seat);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.01, 6, 24), wood); ring.rotation.x = Math.PI / 2; ring.position.y = 0.2; g.add(ring);
      const loop = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.016, 8, 24, Math.PI), wood); loop.position.set(0, 0.64, -0.2); loop.rotation.x = -0.12; loop.scale.y = 1.4; loop.castShadow = true; g.add(loop);
      for (const s of [-1, 1]) { const up = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.2, 8), wood); up.position.set(s * 0.17, 0.56, -0.19); g.add(up); }
      return g;
    },
    iso: [{ shape: 'cyl', box: [-0.21, 0.42, -0.2, 0.21, 0.47, 0.22], color: 'role:wood' }, { shape: 'box', box: [-0.19, 0.47, -0.25, 0.19, 0.88, -0.17], color: 'role:wood' }],
  },
  // Ladder-back chair — tall back posts joined by four curved slats, a rush seat (farmhouse, mediterranean, craftsman).
  'ladderback-chair': {
    footprint: [0.46, 0.46], height: 1.02, params: ['color'], tags: ['dining', 'kitchen', 'bedroom'],
    create(it, { std, box, group, colors, hex, mix }) {
      const g = group('Ladder-back Chair'), wood = std(it.color ? hex(it.color) : colors.wood, { roughness: 0.55 });
      const w = 0.46, d = 0.46;
      for (const [x, z] of quad(w, d, 0.02)) g.add(box(0.04, z < 0 ? 1.02 : 0.47, 0.04, wood, x, (z < 0 ? 1.02 : 0.47) / 2, z));
      g.add(box(w - 0.04, 0.035, d - 0.04, std(mix(colors.wood, 0xd6b98c, 0.6), { roughness: 0.95 }), 0, 0.45, 0));   // rush seat
      for (const s of [-1, 1]) g.add(box(0.02, 0.03, d - 0.08, wood, s * (w / 2 - 0.02), 0.18, 0));   // stretchers
      for (let k = 0; k < 4; k++) g.add(box(w - 0.06, 0.06, 0.018, wood, 0, 0.58 + k * 0.12, -d / 2 + 0.02));   // the ladder
      return g;
    },
    iso: [{ shape: 'box', box: [-0.23, 0.43, -0.23, 0.23, 0.47, 0.23], color: 'role:wood' }, { shape: 'box', box: [-0.23, 0, -0.23, 0.23, 1.02, -0.19], color: 'role:wood' }],
  },
  // Shell chair — one moulded seat-and-back shell on splayed wooden dowel legs (mid-century, modern, scandi).
  'shell-chair': {
    footprint: [0.48, 0.52], height: 0.8, params: ['color'], tags: ['dining', 'kitchen', 'study', 'office'],
    create(it, { THREE, std, box, group, colors, hex }) {
      const g = group('Shell Chair'), shellMat = std(it.color ? hex(it.color) : colors.fabric2, { roughness: 0.45, side: THREE.DoubleSide });
      legsAt(THREE, g, std(colors.wood, { roughness: 0.5 }), quad(0.4, 0.4, 0.03), 0.42, 0.016, 0.012, 0.12);
      g.add(box(0.44, 0.03, 0.4, shellMat, 0, 0.44, 0.03));
      const back = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.24, 0.36, 20, 1, true, Math.PI * 0.62, Math.PI * 0.76), shellMat);
      back.position.set(0, 0.62, 0.06); back.rotation.x = -0.14; back.castShadow = true; g.add(back);
      return g;
    },
    iso: [{ shape: 'box', box: [-0.22, 0.42, -0.17, 0.22, 0.46, 0.23], color: 'role:fabric2' }, { shape: 'box', box: [-0.24, 0.44, -0.24, 0.24, 0.8, -0.1], color: 'role:fabric2' }],
  },

  // ---- two more counter stools (plan S3: every island had the same bar stool) ---------------------------------------------------
  // Wood stool — a backless four-legged stool with a dished seat and a rung (farmhouse, cottage, craftsman, scandi).
  'wood-stool': {
    footprint: [0.36, 0.36], height: 0.74, params: ['h', 'color'], tags: ['kitchen', 'dining'],
    create(it, { THREE, std, box, group, colors, hex }) {
      const h = it.h || 0.7, g = group('Wood Stool'), wood = std(it.color ? hex(it.color) : colors.wood, { roughness: 0.55 });
      const seat = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.16, 0.04, 24), wood); seat.position.y = h + 0.02; seat.castShadow = true; g.add(seat);
      for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
        const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.024, h, 8), wood); leg.position.set(sx * 0.115, h / 2, sz * 0.115); leg.rotation.set(sz * 0.06, 0, -sx * 0.06); leg.castShadow = true; g.add(leg);
      }
      g.add(box(0.26, 0.02, 0.02, wood, 0, h * 0.36, 0.13)); g.add(box(0.26, 0.02, 0.02, wood, 0, h * 0.36, -0.13));
      g.add(box(0.02, 0.02, 0.26, wood, 0.13, h * 0.36, 0)); g.add(box(0.02, 0.02, 0.26, wood, -0.13, h * 0.36, 0));
      return g;
    },
    iso: [{ shape: 'cyl', box: [-0.17, 0.7, -0.17, 0.17, 0.74, 0.17], color: 'role:wood' }, { shape: 'box', box: [-0.13, 0, -0.13, 0.13, 0.7, 0.13], color: 'role:wood' }],
  },
  // Saddle stool — a moulded leather saddle seat on a slim tubular frame with a footring (modern, industrial, mid-century).
  'saddle-stool': {
    footprint: [0.4, 0.4], height: 0.76, params: ['h', 'color'], tags: ['kitchen', 'dining', 'bar'],
    create(it, { THREE, std, box, group, colors, hex }) {
      const h = it.h || 0.72, g = group('Saddle Stool'), metal = std(colors.metal, { metalness: 0.85, roughness: 0.3 });
      const seat = new THREE.Mesh(new THREE.SphereGeometry(0.19, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), std(it.color ? hex(it.color) : colors.fabric2, { roughness: 0.55 }));
      seat.scale.set(1, 0.22, 0.9); seat.position.y = h; seat.castShadow = true; g.add(seat);
      for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) { const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, h, 8), metal); leg.position.set(sx * 0.14, h / 2, sz * 0.12); leg.rotation.set(sz * 0.08, 0, -sx * 0.1); leg.castShadow = true; g.add(leg); }
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.14, 0.009, 6, 24), metal); ring.rotation.x = Math.PI / 2; ring.position.y = h * 0.34; g.add(ring);
      return g;
    },
    iso: [{ shape: 'cyl', box: [-0.19, 0.7, -0.19, 0.19, 0.76, 0.19], color: 'role:fabric2' }, { shape: 'box', box: [-0.14, 0, -0.12, 0.14, 0.7, 0.12], color: 'role:metal' }],
  },

  // ---- two more sectionals: sectionals come in sizes (plan S3 "sectionals by size") -------------------------------------------------
  // U-sectional — a run of seats along the back with a chaise at BOTH ends, a well between them: the big room's sofa.
  // Footprint w × l (the wings' reach), origin at its centre.
  'u-sectional': {
    footprint: [3.6, 1.9], height: 0.82, params: ['w', 'l', 'd', 'color'], tags: ['living', 'den', 'media'],
    create(it, ctx) {
      const { THREE, std, box, group, colors, hex, mix, rng } = ctx;
      const w = it.w || 3.6, l = it.l || 1.9, d = it.d || 0.95, g = group('U-Sectional');
      const base = upholstery(it, colors, hex), shell = std(base, { roughness: 0.85 }), cushion = std(lift(mix, base), { roughness: 0.9 });
      const legMat = std(colors.metal, { metalness: 0.8, roughness: 0.3 });
      const legH = 0.1, deckY = 0.32, seatTop = 0.46, backD = 0.2, cw = d, z0 = -l / 2, wing = l - d;
      g.add(box(w, deckY - legH, d, shell, 0, legH + (deckY - legH) / 2, z0 + d / 2));                       // the run's base
      for (const s of [-1, 1]) g.add(box(cw, deckY - legH, wing, shell, s * (w / 2 - cw / 2), legH + (deckY - legH) / 2, z0 + d + wing / 2));   // the two chaises
      g.add(box(w, 0.82 - deckY, backD, shell, 0, deckY + (0.82 - deckY) / 2, z0 + backD / 2));               // the back
      legsAt(THREE, g, legMat, [[-w / 2 + 0.08, z0 + 0.08], [w / 2 - 0.08, z0 + 0.08], [-w / 2 + 0.08, l / 2 - 0.08], [w / 2 - 0.08, l / 2 - 0.08], [-w / 2 + cw - 0.08, l / 2 - 0.08], [w / 2 - cw + 0.08, l / 2 - 0.08], [-w / 2 + cw - 0.08, z0 + d - 0.08], [w / 2 - cw + 0.08, z0 + d - 0.08]], legH, 0.02, 0.02);
      const runIn = w - 2 * cw - 0.02, n = Math.max(1, Math.round(runIn / 0.7)), sw = runIn / n - 0.015, sd = d - backD - 0.04;
      for (let i = 0; i < n; i++) {
        const x = -runIn / 2 + runIn / n * (i + 0.5);
        g.add(box(sw, seatTop - deckY, sd, cushion, x, deckY + (seatTop - deckY) / 2, z0 + backD + sd / 2 + 0.02));
        const bc = box(sw, 0.36, 0.12, cushion, x, seatTop + 0.18, z0 + backD + 0.05); bc.rotation.x = -0.1; g.add(bc);
      }
      for (const s of [-1, 1]) {
        const x = s * (w / 2 - cw / 2);
        g.add(box(cw - 0.03, seatTop - deckY, l - backD - 0.03, cushion, x, deckY + (seatTop - deckY) / 2, z0 + backD + (l - backD) / 2));
        const bc = box(cw - 0.03, 0.36, 0.12, cushion, x, seatTop + 0.18, z0 + backD + 0.05); bc.rotation.x = -0.1; g.add(bc);
      }
      const pillow = box(0.4, 0.4, 0.11, std(rng() < 0.5 ? colors.accent : colors.fabric2, { roughness: 0.9 }), -w / 2 + cw / 2 + 0.1, seatTop + 0.22, z0 + backD + 0.2);
      pillow.rotation.set(-0.18, (rng() - 0.5) * 0.5, 0.08); g.add(pillow);
      return g;
    },
    iso: [
      { shape: 'box', box: [-1.8, 0.1, -0.95, 1.8, 0.46, 0.0], color: 'role:fabric' },
      { shape: 'box', box: [-1.8, 0.1, 0.0, -0.85, 0.46, 0.95], color: 'role:fabric' },
      { shape: 'box', box: [0.85, 0.1, 0.0, 1.8, 0.46, 0.95], color: 'role:fabric' },
      { shape: 'box', box: [-1.8, 0.32, -0.95, 1.8, 0.82, -0.75], color: 'role:fabric' },
    ],
  },
  // Modular sectional — an L of armless modules, each a low block on its own tapered legs with a hair's gap between,
  // and a matching ottoman module to pull up: the compact, low-slung one (mid-century, scandi, modern). `hand` as the
  // L-sectional's. Footprint w × l.
  'modular-sectional': {
    footprint: [2.5, 1.65], height: 0.86, params: ['w', 'l', 'd', 'hand', 'color'], tags: ['living', 'den', 'media'],
    create(it, ctx) {
      const { THREE, std, box, group, colors, hex, mix, rng } = ctx;
      const w = it.w || 2.5, l = it.l || 1.65, d = it.d || 0.92, side = it.hand === 'right' ? -1 : 1, g = group(`Modular Sectional (${it.hand === 'right' ? 'right' : 'left'})`);
      const base = upholstery(it, colors, hex), shell = std(base, { roughness: 0.9 }), cushion = std(lift(mix, base, 0.1), { roughness: 0.92 });
      const wood = std(colors.wood, { roughness: 0.5 }), legH = 0.13, seatTop = 0.42, backTop = 0.7, backD = 0.16, gap = 0.012, z0 = -l / 2;
      const module = (mw, md, x, z, back) => {
        g.add(box(mw - gap, seatTop - 0.05 - legH, md - gap, shell, x, legH + (seatTop - 0.05 - legH) / 2, z));
        g.add(box(mw - gap - 0.02, 0.05, md - gap - 0.02 - (back ? backD : 0), cushion, x, seatTop - 0.025, z + (back ? backD / 2 : 0)));
        if (back) g.add(box(mw - gap, backTop - (seatTop - 0.05), backD, shell, x, seatTop - 0.05 + (backTop - seatTop + 0.05) / 2, z - md / 2 + backD / 2));
        for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
          const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.014, legH, 8), wood);
          leg.position.set(x + sx * (mw / 2 - 0.1), legH / 2, z + sz * (md / 2 - 0.1)); leg.rotation.set(-sz * 0.1, 0, sx * 0.1); leg.castShadow = true; g.add(leg);
        }
      };
      const cw = d, n = Math.max(2, Math.round((w - cw) / 0.85)), mw = (w - cw) / n;
      for (let i = 0; i < n; i++) module(mw, d, -side * (w / 2) + side * (mw * (i + 0.5)), z0 + d / 2, true);   // the run, from the far end toward the chaise
      module(cw, d, side * (w / 2 - cw / 2), z0 + d / 2, true);                                                    // the corner module
      module(cw, l - d, side * (w / 2 - cw / 2), z0 + d + (l - d) / 2, false);                                     // the chaise
      const pillow = box(0.42, 0.42, 0.1, std(rng() < 0.5 ? colors.accent : colors.fabric2, { roughness: 0.9 }), -side * (w / 2 - 0.5), seatTop + 0.2, z0 + backD + 0.12);
      pillow.rotation.set(-0.2, (rng() - 0.5) * 0.4, 0.1); g.add(pillow);
      return g;
    },
    iso: [
      { shape: 'box', box: [-1.25, 0.13, -0.825, 1.25, 0.42, 0.08], color: 'role:fabric' },
      { shape: 'box', box: [0.3, 0.13, 0.08, 1.25, 0.42, 0.825], color: 'role:fabric' },
      { shape: 'box', box: [-1.25, 0.37, -0.825, 1.25, 0.7, -0.67], color: 'role:fabric' },
    ],
  },
});
