// Beds — every place a house sleeps that is not the master platform-bed. See index.js for the contract and
// decor.js for a worked example. Every bed here has its head at −z and its foot at +z (facing SOUTH at rot 0),
// origin at the floor centre of its footprint. Linen from colors.linen, the duvet from colors.accent or
// colors.fabric (seeded), timber from colors.wood; `color` tints the prop's signature soft surface — the duvet
// on a bed, the headboard on the headboard-bed, the cloth on the hammock, the cushion on the daybed and pet-bed.
import { registerProps } from './registry.js';
import { patternTexture } from './patterns.js';
import { layBedding } from './softkit.js';

const CORNERS = [[-1, -1], [1, -1], [1, 1], [-1, 1]];

// the duvet colour: the spec's colour, else the accent or the house fabric (seeded per item)
const duvetColor = (it, { colors, hex, rng }) => (it.color ? hex(it.color) : rng() < 0.55 ? colors.accent : colors.fabric);

// four legs, square section, at the corners of a w × d frame
function legs(g, { box }, { w, d, h, size = 0.06, inset = 0.02, mat }) {
  for (const [sx, sz] of CORNERS) g.add(box(size, h, size, mat, sx * (w / 2 - size / 2 - inset), h / 2, sz * (d / 2 - size / 2 - inset)));
}

// a rod from a to b (ropes, angled uprights): a cylinder of radius r, or a square section when square is set
function rod({ THREE }, a, b, r, mat, { radial = 8, square = false } = {}) {
  const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b), dir = B.clone().sub(A), len = dir.length();
  const m = new THREE.Mesh(square ? new THREE.BoxGeometry(r * 2, len, r * 2) : new THREE.CylinderGeometry(r, r, len, radial), mat);
  m.position.copy(A).addScaledVector(dir, 0.5);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
  m.castShadow = true; m.receiveShadow = true; return m;
}

// mattress + duvet + throw + pillows for a bed whose mattress base sits at y (head at −z). Returns the top of the
// pillows. The grammar is assets/props/softkit.ts (SOFT stream): 2-3 merged, role-tinted, vertex-shaded meshes instead of
// five boxes. Same arguments as ever; the fitted sheet is a shade off the linen so the pillows read against it.
function bedding(g, ctx, o) { return layBedding(g, ctx, o); }

// a guard rail: a top rail at y on three short uprights rising from yBase, along z at x (length len from z0)
function guardRail(g, { box }, { x, z0, len, y, yBase, mat }) {
  g.add(box(0.04, 0.04, len, mat, x, y, z0 + len / 2));
  for (const t of [0.12, 0.5, 0.88]) g.add(box(0.03, y - yBase, 0.03, mat, x, (y + yBase) / 2, z0 + len * t));
}

// a ladder: two stiles and rungs in its local x/y plane from y0 to y1 — a group the caller places and turns
function ladder({ box, group }, { y0, y1, width = 0.4, mat, rungs = 5 }) {
  const g = group('Ladder'), h = y1 - y0;
  for (const s of [-1, 1]) g.add(box(0.035, h, 0.035, mat, s * width / 2, y0 + h / 2, 0));
  for (let i = 1; i <= rungs; i++) g.add(box(width, 0.03, 0.03, mat, 0, y0 + (h / (rungs + 1)) * i, 0));
  return g;
}

registerProps({
  // ---- the everyday bed: timber frame, headboard, one pillow
  'single-bed': {
    footprint: [1.0, 2.0], height: 0.9, params: ['w', 'd', 'color'], tags: ['bedroom', 'kids', 'guest'],
    create(it, ctx) {
      const { std, box, group, colors } = ctx;
      const w = it.w || 1.0, d = it.d || 2.0, g = group('Single Bed');
      const wood = std(colors.wood, { roughness: 0.5 });
      legs(g, ctx, { w, d, h: 0.3, mat: wood });
      g.add(box(w, 0.12, d, wood, 0, 0.3, 0));                              // rails + slat deck
      g.add(box(w, 0.5, 0.05, wood, 0, 0.65, -d / 2 + 0.025));             // headboard
      g.add(box(w, 0.14, 0.05, wood, 0, 0.43, d / 2 - 0.025));             // footboard
      bedding(g, ctx, { w: w - 0.06, d: d - 0.1, y: 0.36, duvet: duvetColor(it, ctx), pillows: w > 1.3 ? 2 : 1 });
      return g;
    },
    iso: [
      { shape: 'box', box: [-0.5, 0.24, -1.0, 0.5, 0.36, 1.0], color: 'role:wood' },
      { shape: 'box', box: [-0.47, 0.36, -0.95, 0.47, 0.62, 0.95], color: 'role:linen' },
      { shape: 'box', box: [-0.47, 0.56, -0.2, 0.47, 0.62, 0.95], color: 'role:accent' },
      { shape: 'box', box: [-0.5, 0.4, -1.0, 0.5, 0.9, -0.95], color: 'role:wood' },
    ],
  },

  // ---- two tiers on four posts, a ladder hung on the right side, guard rail up top
  'bunk-bed': {
    footprint: [1.08, 2.0], height: 1.7, params: ['w', 'd', 'color'], tags: ['kids', 'bunkroom', 'cabin'],
    create(it, ctx) {
      const { std, box, group, colors, rng } = ctx;
      const w = it.w || 1.0, d = it.d || 2.0, H = 1.7, g = group('Bunk Bed');
      const wood = std(colors.wood, { roughness: 0.5 });
      for (const [sx, sz] of CORNERS) g.add(box(0.07, H, 0.07, wood, sx * (w / 2 - 0.035), H / 2, sz * (d / 2 - 0.035)));
      const duvet = duvetColor(it, ctx), other = duvet === colors.accent ? colors.fabric : colors.accent;
      const swap = rng() < 0.5;
      for (const [i, y] of [[0, 0.25], [1, 1.2]]) {
        g.add(box(w, 0.12, d, wood, 0, y + 0.06, 0));                                          // tier frame
        g.add(box(w, 0.3, 0.04, wood, 0, y + 0.12 + 0.15, -d / 2 + 0.02));                     // head panel
        g.add(box(w, 0.18, 0.04, wood, 0, y + 0.12 + 0.09, d / 2 - 0.02));                     // foot panel
        bedding(g, ctx, { w: w - 0.1, d: d - 0.1, y: y + 0.12, duvet: (i === 0) === swap ? duvet : other, pillows: 1, thick: 0.16 });
      }
      guardRail(g, ctx, { x: -w / 2 + 0.02, z0: -d / 2 + 0.07, len: d - 0.14, y: 1.62, yBase: 1.32, mat: wood });          // full rail, far side
      guardRail(g, ctx, { x: w / 2 - 0.02, z0: -d / 2 + 0.07, len: (d - 0.14) * 0.55, y: 1.62, yBase: 1.32, mat: wood });   // near side stops for the ladder
      const l = ladder(ctx, { y0: 0, y1: 1.64, width: 0.4, mat: wood, rungs: 5 });         // near side, foot end, standing on the floor
      l.position.set(w / 2 + 0.06, 0, d / 2 - 0.45); l.rotation.y = Math.PI / 2; g.add(l);
      return g;
    },
    iso: [
      { shape: 'box', box: [-0.5, 0.25, -1.0, 0.5, 0.37, 1.0], color: 'role:wood' },
      { shape: 'box', box: [-0.45, 0.37, -0.95, 0.45, 0.59, 0.95], color: 'role:linen' },
      { shape: 'box', box: [-0.5, 1.2, -1.0, 0.5, 1.32, 1.0], color: 'role:wood' },
      { shape: 'box', box: [-0.45, 1.32, -0.95, 0.45, 1.54, 0.95], color: 'role:accent' },
    ],
  },

  // ---- sofa by day, bed by night: timber frame, mattress in fabric, a bolster at each end, back cushions
  'daybed': {
    footprint: [1.9, 0.9], height: 0.8, params: ['w', 'd', 'color'], tags: ['living', 'guest', 'sunroom', 'office'],
    create(it, ctx) {
      const { THREE, std, box, group, colors, hex, rng, mix } = ctx;
      const w = it.w || 1.9, d = it.d || 0.9, g = group('Daybed');
      const wood = std(colors.wood, { roughness: 0.5 });
      const fab = std(it.color ? hex(it.color) : colors.fabric, { roughness: 0.9 });
      const fab2 = std(colors.fabric2, { roughness: 0.9 });
      legs(g, ctx, { w, d, h: 0.18, size: 0.05, mat: wood });
      g.add(box(w, 0.1, d, wood, 0, 0.2, 0));                                       // platform
      g.add(box(w, 0.55, 0.06, wood, 0, 0.25 + 0.275, -d / 2 + 0.03));               // back panel to 0.8
      for (const s of [-1, 1]) g.add(box(0.06, 0.4, d, wood, s * (w / 2 - 0.03), 0.45, 0));   // arms to 0.65
      g.add(box(w - 0.12, 0.18, d - 0.06, fab, 0, 0.34, 0.03));                     // mattress 0.25..0.43
      const bolsterR = 0.11;
      for (const s of [-1, 1]) {                                                    // bolsters along z at each end
        const b = new THREE.Mesh(new THREE.CylinderGeometry(bolsterR, bolsterR, d - 0.2, 14), fab2);
        b.rotation.x = Math.PI / 2; b.position.set(s * (w / 2 - 0.06 - bolsterR - 0.02), 0.43 + bolsterR, 0.02); b.castShadow = true; g.add(b);
      }
      const n = 3, cw = (w - 0.12 - 2 * (bolsterR * 2 + 0.06)) / n - 0.04;         // back cushions between the bolsters
      for (let i = 0; i < n; i++) {
        const c = box(cw, 0.34, 0.1, std(rng() < 0.4 ? colors.accent : mix(colors.fabric2, colors.linen, 0.3), { roughness: 0.9 }), (i - (n - 1) / 2) * (cw + 0.04), 0.43 + 0.17, -d / 2 + 0.06 + 0.06);
        c.rotation.x = -0.12; g.add(c);
      }
      return g;
    },
    iso: [
      { shape: 'box', box: [-0.95, 0.15, -0.45, 0.95, 0.43, 0.45], color: 'role:fabric' },
      { shape: 'box', box: [-0.95, 0.25, -0.45, 0.95, 0.8, -0.39], color: 'role:wood' },
      { shape: 'box', box: [-0.9, 0.43, -0.35, -0.68, 0.65, 0.35], color: 'role:fabric2' },
      { shape: 'box', box: [0.68, 0.43, -0.35, 0.9, 0.65, 0.35], color: 'role:fabric2' },
    ],
  },

  // ---- four turned posts with top rails and finials, a panel headboard
  'four-poster-bed': {
    footprint: [1.6, 2.1], height: 2.1, params: ['w', 'd', 'h', 'color'], tags: ['bedroom', 'guest', 'master'],
    create(it, ctx) {
      const { THREE, std, box, group, colors } = ctx;
      const w = it.w || 1.6, d = it.d || 2.1, H = it.h || 2.1, g = group('Four-Poster Bed');
      const wood = std(colors.wood, { roughness: 0.45 });
      const pr = 0.045, pi = pr * 1.4;                                                 // posts inset by the finial radius: the finials are the outer edge
      for (const [sx, sz] of CORNERS) {
        const p = new THREE.Mesh(new THREE.CylinderGeometry(pr, pr * 1.2, H - 0.08, 10), wood);
        p.position.set(sx * (w / 2 - pi), (H - 0.08) / 2, sz * (d / 2 - pi)); p.castShadow = true; g.add(p);
        const f = new THREE.Mesh(new THREE.SphereGeometry(pi, 10, 8), wood);
        f.position.set(sx * (w / 2 - pi), H - 0.06, sz * (d / 2 - pi)); f.castShadow = true; g.add(f);
      }
      for (const s of [-1, 1]) {                                                        // top rails
        g.add(box(w - 2 * pi, 0.05, 0.05, wood, 0, H - 0.12, s * (d / 2 - pi)));
        g.add(box(0.05, 0.05, d - 2 * pi, wood, s * (w / 2 - pi), H - 0.12, 0));
      }
      g.add(box(w - 2 * pi, 0.2, d - 2 * pi, wood, 0, 0.36, 0));                        // frame 0.26..0.46
      g.add(box(w - 2 * pi, 0.62, 0.05, wood, 0, 0.46 + 0.31, -d / 2 + pi));             // headboard to 1.08
      g.add(box(w - 2 * pi, 0.2, 0.05, wood, 0, 0.56, d / 2 - pi));                      // footboard
      bedding(g, ctx, { w: w - 2 * pi - 0.1, d: d - 2 * pi - 0.1, y: 0.46, duvet: duvetColor(it, ctx), pillows: 2 });
      return g;
    },
    iso: [
      { shape: 'box', box: [-0.8, 0.26, -1.05, 0.8, 0.46, 1.05], color: 'role:wood' },
      { shape: 'box', box: [-0.72, 0.46, -0.98, 0.72, 0.72, 0.98], color: 'role:linen' },
      { shape: 'box', box: [-0.72, 0.66, -0.15, 0.72, 0.72, 0.98], color: 'role:accent' },
      { shape: 'box', box: [-0.8, 1.95, -1.05, 0.8, 2.1, 1.05], color: 'role:wood' },
    ],
  },

  // ---- slim metal posts carrying a linen canopy sheet, drapes gathered at the head posts
  'canopy-bed': {
    footprint: [1.7, 2.2], height: 2.2, params: ['w', 'd', 'h', 'color'], tags: ['bedroom', 'master', 'guest'],
    create(it, ctx) {
      const { THREE, std, box, group, colors, mix } = ctx;
      const w = it.w || 1.6, d = it.d || 2.1, H = it.h || 2.2, g = group('Canopy Bed');
      const wood = std(colors.wood, { roughness: 0.5 });
      const metal = std(colors.metal, { metalness: 0.75, roughness: 0.35 });
      const linen = std(colors.linen, { roughness: 0.95, side: THREE.DoubleSide });
      const pr = 0.02;
      for (const [sx, sz] of CORNERS) {
        const p = new THREE.Mesh(new THREE.CylinderGeometry(pr, pr, H - 0.02, 8), metal);
        p.position.set(sx * (w / 2 - pr), (H - 0.02) / 2, sz * (d / 2 - pr)); p.castShadow = true; g.add(p);
      }
      for (const s of [-1, 1]) {                                                        // top frame
        g.add(box(w, 0.03, 0.03, metal, 0, H - 0.06, s * (d / 2 - pr)));
        g.add(box(0.03, 0.03, d, metal, s * (w / 2 - pr), H - 0.06, 0));
      }
      g.add(box(w + 0.1, 0.02, d + 0.1, linen, 0, H - 0.01, 0));                        // the canopy sheet, overhanging
      for (const s of [-1, 1]) g.add(box(w + 0.1, 0.08, 0.02, linen, 0, H - 0.06, s * (d / 2 + 0.04)));   // valance
      for (const s of [-1, 1]) {                                                        // gathered drapes at the head posts
        const dr = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.09, H - 0.35, 9), std(mix(colors.linen, colors.fabric2, 0.3), { roughness: 0.95 }));
        dr.position.set(s * (w / 2 - 0.1), (H - 0.35) / 2 + 0.05, -d / 2 + 0.1); dr.castShadow = true; g.add(dr);
      }
      legs(g, ctx, { w: w - 0.1, d: d - 0.1, h: 0.22, size: 0.05, mat: wood });
      g.add(box(w - 0.06, 0.16, d - 0.06, wood, 0, 0.28, 0));                            // frame 0.2..0.36
      g.add(box(w - 0.06, 0.55, 0.06, std(colors.fabric2, { roughness: 0.9 }), 0, 0.36 + 0.275, -d / 2 + 0.03));   // upholstered headboard to 0.91
      bedding(g, ctx, { w: w - 0.16, d: d - 0.16, y: 0.36, duvet: duvetColor(it, ctx), pillows: 2 });
      return g;
    },
    iso: [
      { shape: 'box', box: [-0.77, 0.2, -1.02, 0.77, 0.36, 1.02], color: 'role:wood' },
      { shape: 'box', box: [-0.72, 0.36, -0.97, 0.72, 0.62, 0.97], color: 'role:linen' },
      { shape: 'box', box: [-0.72, 0.56, -0.15, 0.72, 0.62, 0.97], color: 'role:accent' },
      { shape: 'box', box: [-0.85, 2.04, -1.1, 0.85, 2.2, 1.1], color: 'role:linen' },
    ],
  },

  // ---- a mattress straight on the floor, duvet thrown back, pillows flat
  'mattress-on-floor': {
    footprint: [1.4, 2.0], height: 0.32, params: ['w', 'd', 'color'], tags: ['bedroom', 'studio', 'teen', 'guest'],
    create(it, ctx) {
      const { std, box, group, colors, rng, mix } = ctx;
      const w = it.w || 1.4, d = it.d || 2.0, g = group('Mattress on the Floor');
      const sheet = std(mix(colors.linen, 0xd6d3d1, 0.3), { roughness: 0.9 });
      const duvet = std(duvetColor(it, ctx), { roughness: 0.85 });
      const linen = std(colors.linen, { roughness: 0.95 });
      g.add(box(w, 0.22, d, sheet, 0, 0.11, 0));
      const bl = d * 0.62;
      const dv = box(w + 0.04, 0.06, bl, duvet, 0.03, 0.25, d / 2 - bl / 2 + 0.02); dv.rotation.y = (rng() - 0.5) * 0.08; g.add(dv);   // thrown back, a little askew
      const fold = box(w * 0.7, 0.05, 0.22, duvet, w * 0.12, 0.305, d / 2 - bl + 0.1); fold.rotation.y = (rng() - 0.5) * 0.2; g.add(fold);
      for (const s of [-1, 1]) { const p = box(Math.min(0.6, w / 2 - 0.06), 0.1, 0.42, linen, s * (w / 4 + 0.02), 0.27, -d / 2 + 0.28); p.rotation.x = 0.08; p.rotation.y = s * (rng() - 0.5) * 0.15; g.add(p); }
      return g;
    },
    iso: [
      { shape: 'box', box: [-0.7, 0, -1.0, 0.7, 0.22, 1.0], color: 'role:linen' },
      { shape: 'box', box: [-0.7, 0.22, -0.25, 0.7, 0.28, 1.0], color: 'role:accent' },
    ],
  },

  // ---- low frame with head and foot panels and a slatted safety rail on the front half of each side
  'toddler-bed': {
    footprint: [0.75, 1.45], height: 0.55, params: ['w', 'd', 'color'], tags: ['kids', 'nursery'],
    create(it, ctx) {
      const { std, box, group, colors, hex, mix, rng } = ctx;
      const w = it.w || 0.75, d = it.d || 1.45, g = group('Toddler Bed');
      const wood = std(colors.wood, { roughness: 0.5 });
      const pastel = mix(rng() < 0.5 ? colors.accent : colors.fabric2, 0xffffff, 0.5);   // a nursery pastel, still the house's own colour
      const duvet = it.color ? hex(it.color) : rng() < 0.5 ? colors.accent : pastel;
      legs(g, ctx, { w, d, h: 0.14, size: 0.05, mat: wood });
      g.add(box(w, 0.08, d, wood, 0, 0.16, 0));                                  // frame 0.12..0.2
      g.add(box(w, 0.43, 0.04, wood, 0, 0.12 + 0.215, -d / 2 + 0.02));           // head panel to 0.55
      g.add(box(w, 0.3, 0.04, wood, 0, 0.12 + 0.15, d / 2 - 0.02));              // foot panel to 0.42
      const rl = d * 0.55;
      for (const s of [-1, 1]) {                                                 // safety rails, head end
        const x = s * (w / 2 - 0.02);
        g.add(box(0.03, 0.03, rl, wood, x, 0.5, -d / 2 + 0.04 + rl / 2));
        for (let i = 0; i <= 3; i++) g.add(box(0.02, 0.3, 0.02, wood, x, 0.35, -d / 2 + 0.08 + (rl - 0.08) * (i / 3)));
      }
      bedding(g, ctx, { w: w - 0.08, d: d - 0.1, y: 0.2, duvet, pillows: 1, thick: 0.13, pillowD: 0.28, cover: 0.55 });
      return g;
    },
    iso: [
      { shape: 'box', box: [-0.375, 0.12, -0.725, 0.375, 0.2, 0.725], color: 'role:wood' },
      { shape: 'box', box: [-0.33, 0.2, -0.68, 0.33, 0.4, 0.68], color: 'role:linen' },
      { shape: 'box', box: [-0.33, 0.33, -0.05, 0.33, 0.4, 0.68], color: 'role:accent' },
      { shape: 'box', box: [-0.375, 0.12, -0.725, 0.375, 0.55, -0.68], color: 'role:wood' },
    ],
  },

  // ---- a tall channel-tufted upholstered headboard over a platform base
  'headboard-bed': {
    footprint: [1.8, 2.1], height: 1.3, params: ['w', 'd', 'h', 'color'], tags: ['bedroom', 'master', 'guest', 'hotel'],
    create(it, ctx) {
      const { std, box, group, colors, hex, mix, rng } = ctx;
      const w = it.w || 1.6, d = it.d || 2.1, H = it.h || 1.3, g = group('Headboard Bed');
      const fabric = it.color ? hex(it.color) : colors.fabric;
      const fab = std(fabric, { roughness: 0.92 });
      const metal = std(colors.metal, { metalness: 0.7, roughness: 0.35 });
      const hw = w + 0.2, hz = -d / 2 + 0.06;
      g.add(box(hw, H - 0.1, 0.08, fab, 0, 0.1 + (H - 0.1) / 2, hz - 0.02));                // headboard slab
      const n = 5, cw = (hw - 0.1) / n - 0.03;
      for (let i = 0; i < n; i++) g.add(box(cw, H - 0.24, 0.05, std(mix(fabric, 0xffffff, 0.06), { roughness: 0.92 }), (i - (n - 1) / 2) * (cw + 0.03), 0.17 + (H - 0.24) / 2, hz + 0.045));   // channels
      legs(g, ctx, { w: w - 0.1, d: d - 0.2, h: 0.1, size: 0.05, mat: metal });
      g.add(box(w, 0.26, d - 0.08, fab, 0, 0.1 + 0.13, 0.04));                             // upholstered base 0.1..0.36
      bedding(g, ctx, { w: w - 0.1, d: d - 0.2, y: 0.36, z: 0.04, duvet: duvetColor(it, ctx), pillows: 2 });
      const flip = rng() < 0.5;
      for (const s of [-1, 1]) {                                                            // two cushions in front of the pillows, one accent, one fabric2
        const c = box(0.42, 0.1, 0.3, std((s < 0) === flip ? colors.accent : colors.fabric2, { roughness: 0.95 }), s * (w / 4 - 0.02), 0.56 + 0.05, -d / 2 + 0.6);
        c.rotation.x = 0.3; g.add(c);
      }
      return g;
    },
    iso: [
      { shape: 'box', box: [-0.8, 0.1, -1.0, 0.8, 0.36, 1.0], color: 'role:fabric' },
      { shape: 'box', box: [-0.75, 0.36, -0.95, 0.75, 0.62, 0.95], color: 'role:linen' },
      { shape: 'box', box: [-0.75, 0.56, -0.12, 0.75, 0.62, 0.95], color: 'role:accent' },
      { shape: 'box', box: [-0.9, 0.1, -1.05, 0.9, 1.3, -0.95], color: 'role:fabric' },
    ],
  },

  // ---- a spreader-bar hammock slung on a free-standing timber arc stand, spanning x
  'hammock-indoor': {
    footprint: [3.0, 0.9], height: 1.1, params: ['w', 'color'], tags: ['living', 'sunroom', 'porch', 'teen'],
    create(it, ctx) {
      const { THREE, std, box, group, colors, hex, mix } = ctx;
      const w = it.w || 3.0, g = group('Indoor Hammock');
      const wood = std(colors.wood, { roughness: 0.5 });
      const rope = std(0xd6cbb4, { roughness: 0.9 });
      const base = it.color ? hex(it.color) : colors.fabric;
      const cloth = [std(base, { roughness: 0.95, side: THREE.DoubleSide }), std(mix(base, 0xffffff, 0.45), { roughness: 0.95, side: THREE.DoubleSide })];
      const hx = w / 2 - 0.06, hy = 1.05;                     // hook positions
      g.add(box(w * 0.78, 0.07, 0.09, wood, 0, 0.035, 0));                                 // ground rail
      for (const s of [-1, 1]) {
        g.add(box(0.09, 0.07, 0.9, wood, s * w * 0.33, 0.035, 0));                          // feet
        g.add(rod(ctx, [s * w * 0.33, 0.05, 0], [s * hx, hy, 0], 0.035, wood, { square: true }));   // angled upright
        const hook = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 6), std(colors.metal, { metalness: 0.7, roughness: 0.35 }));
        hook.position.set(s * hx, hy + 0.02, 0); g.add(hook);
      }
      // the cloth: a catenary from bar to bar, drawn as flat segments
      const bx = w * 0.37, by = 0.86, sag = 0.3, N = 11, cw = 0.9;
      const yAt = x => by - sag * (1 - (x / bx) ** 2);
      for (let i = 0; i < N; i++) {
        const x0 = -bx + (2 * bx) * (i / N), x1 = -bx + (2 * bx) * ((i + 1) / N), y0 = yAt(x0), y1 = yAt(x1);
        const len = Math.hypot(x1 - x0, y1 - y0), m = new THREE.Mesh(new THREE.BoxGeometry(len + 0.01, 0.025, cw), cloth[i % 2]);
        m.position.set((x0 + x1) / 2, (y0 + y1) / 2, 0); m.rotation.z = Math.atan2(y1 - y0, x1 - x0); m.castShadow = true; g.add(m);
      }
      for (const s of [-1, 1]) {                                                           // spreader bars and their ropes
        const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, cw + 0.08, 8), wood);
        bar.rotation.x = Math.PI / 2; bar.position.set(s * bx, by, 0); bar.castShadow = true; g.add(bar);
        for (const z of [-cw / 2, cw / 2]) g.add(rod(ctx, [s * bx, by, z], [s * hx, hy, 0], 0.008, rope, { radial: 5 }));
      }
      const p = box(0.45, 0.1, 0.35, std(colors.linen, { roughness: 0.95 }), -bx * 0.6, yAt(-bx * 0.6) + 0.06, 0.02); p.rotation.z = 0.35; g.add(p);   // a pillow at the head end
      return g;
    },
    iso: [
      { shape: 'box', box: [-1.2, 0, -0.45, 1.2, 0.07, 0.45], color: 'role:wood' },
      { shape: 'box', box: [-1.1, 0.55, -0.45, 1.1, 0.88, 0.45], color: 'role:fabric' },
      { shape: 'box', box: [-1.5, 0.05, -0.05, -1.35, 1.1, 0.05], color: 'role:wood' },
      { shape: 'box', box: [1.35, 0.05, -0.05, 1.5, 1.1, 0.05], color: 'role:wood' },
    ],
  },

  // ---- a teen's loft: the bed up top, a desk slab beneath, ladder at the foot
  'loft-bed': {
    footprint: [1.0, 2.1], height: 1.75, params: ['w', 'd', 'color'], tags: ['kids', 'teen', 'studio'],
    create(it, ctx) {
      const { std, box, group, colors } = ctx;
      const w = it.w || 1.0, d = it.d || 2.0, H = 1.75, g = group('Loft Bed');
      const wood = std(colors.wood, { roughness: 0.5 });
      for (const [sx, sz] of CORNERS) g.add(box(0.07, H, 0.07, wood, sx * (w / 2 - 0.035), H / 2, sz * (d / 2 - 0.035)));
      const y = 1.2;
      g.add(box(w, 0.12, d, wood, 0, y + 0.06, 0));                                             // bed frame
      g.add(box(w, 0.32, 0.04, wood, 0, y + 0.12 + 0.16, -d / 2 + 0.02));                        // head panel
      bedding(g, ctx, { w: w - 0.1, d: d - 0.1, y: y + 0.12, duvet: duvetColor(it, ctx), pillows: 1, thick: 0.16 });
      for (const s of [-1, 1]) guardRail(g, ctx, { x: s * (w / 2 - 0.02), z0: -d / 2 + 0.07, len: d - 0.14, y: H - 0.13, yBase: y + 0.12, mat: wood });
      const l = ladder(ctx, { y0: 0, y1: y + 0.4, width: 0.42, mat: wood, rungs: 4 }); l.position.z = d / 2 + 0.03; g.add(l);      // at the foot, standing on the floor
      g.add(box(w - 0.14, 0.04, 0.6, wood, 0, 0.74, -d / 2 + 0.07 + 0.3));                       // desk slab under the head end
      g.add(box(w - 0.14, 0.03, 0.22, wood, 0, 1.0, -d / 2 + 0.07 + 0.11));                      // a shelf above it
      return g;
    },
    iso: [
      { shape: 'box', box: [-0.5, 1.2, -1.0, 0.5, 1.32, 1.0], color: 'role:wood' },
      { shape: 'box', box: [-0.45, 1.32, -0.95, 0.45, 1.54, 0.95], color: 'role:linen' },
      { shape: 'box', box: [-0.45, 1.48, -0.2, 0.45, 1.54, 0.95], color: 'role:accent' },
      { shape: 'box', box: [-0.43, 0.72, -0.93, 0.43, 0.76, -0.33], color: 'role:wood' },
    ],
  },

  // ---- a bolster-rimmed pet bed, open at the front
  'pet-bed': {
    footprint: [0.7, 0.55], height: 0.2, params: ['w', 'd', 'color'], tags: ['living', 'bedroom', 'kitchen', 'mudroom'],
    create(it, ctx) {
      const { THREE, std, box, group, colors, hex, mix } = ctx;
      const w = it.w || 0.7, d = it.d || 0.55, g = group('Pet Bed');
      const fab = std(it.color ? hex(it.color) : colors.fabric2, { roughness: 0.95 });
      const r = 0.08;
      g.add(box(w, 0.06, d, fab, 0, 0.03, 0));                                                     // base
      g.add(box(w - 2 * r, 0.03, d - 2 * r, std(mix(colors.linen, colors.fabric2, 0.15), { roughness: 0.95 }), 0, 0.075, 0));   // cushion
      const ry = 0.06 + r * 0.75;
      const back = new THREE.Mesh(new THREE.CylinderGeometry(r, r, w - 2 * r, 10), fab); back.rotation.z = Math.PI / 2; back.position.set(0, ry, -d / 2 + r); back.castShadow = true; g.add(back);
      for (const s of [-1, 1]) {
        const side = new THREE.Mesh(new THREE.CylinderGeometry(r, r, d - 2 * r, 10), fab); side.rotation.x = Math.PI / 2; side.position.set(s * (w / 2 - r), ry, 0); side.castShadow = true; g.add(side);
        for (const sz of [-1, 1]) { const cap = new THREE.Mesh(new THREE.SphereGeometry(r, 10, 8), fab); cap.position.set(s * (w / 2 - r), ry, sz * (d / 2 - r)); cap.castShadow = true; g.add(cap); }
      }
      const front = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.55, r * 0.55, w - 2 * r, 10), fab); front.rotation.z = Math.PI / 2; front.position.set(0, 0.06 + r * 0.45, d / 2 - r * 0.55); front.castShadow = true; g.add(front);
      return g;
    },
    iso: [
      { shape: 'blob', box: [-0.35, 0, -0.275, 0.35, 0.2, 0.275], color: 'role:fabric2' },
      { shape: 'box', box: [-0.27, 0.06, -0.19, 0.27, 0.09, 0.2], color: 'role:linen' },
    ],
  },
});

// =================================================================================================================
// Pass 4 (S3 compose): two more grown-up beds (a sleigh bed, a tall upholstered bed) and a kid's house-frame bed, so
// the bedrooms of one house can differ in bed as well as in linen. `quilt` (a pattern from assets/props/patterns.ts:
// check, stripe, dots, diamond, kilim, border …) paints the duvet as a patterned textile.
// =================================================================================================================
// bedding() with the duvet painted by a pattern when the item names one. The duvet mesh is found by its role
// (userData.role = 'duvet'), not by comparing colours, and carries planar UVs only when a quilt was asked for.
function beddingQuilt(g, ctx, it, o) {
  const before = g.children.length, duvet = o.duvet;
  const top = bedding(g, ctx, it.quilt ? { ...o, quilt: true } : o);
  if (it.quilt) {
    const { THREE, std, colors } = ctx;
    const map = patternTexture(THREE, String(it.quilt), [duvet, colors.linen, colors.accent, colors.fabric2], { w: o.w, d: o.d * 0.6 });
    const mat = std(0xffffff, { roughness: 0.88, map, vertexColors: true });
    for (const m of g.children.slice(before)) if (m.userData.role === 'duvet') m.material = mat;
  }
  return top;
}

registerProps({
  // Sleigh bed — a scrolled headboard and a lower scrolled footboard in timber, the rails between them
  // (craftsman, farmhouse, traditional primaries). color is the duvet.
  'sleigh-bed': {
    footprint: [1.76, 2.3], height: 1.12, params: ['w', 'd', 'color', 'quilt'], tags: ['bedroom', 'master', 'guest'],
    create(it, ctx) {
      const { THREE, std, box, group, colors } = ctx;
      const w = it.w || 1.6, d = it.d || 2.3, g = group('Sleigh Bed'), wood = std(colors.wood, { roughness: 0.45 });
      const scroll = (y0, h, z, dir) => {   // a board curling outward at its top: a slab and a half-cylinder roll
        g.add(box(w + 0.16, h, 0.06, wood, 0, y0 + h / 2, z));
        const roll = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, w + 0.16, 16, 1, false, 0, Math.PI), wood);
        roll.rotation.z = Math.PI / 2; roll.rotation.x = dir > 0 ? 0 : Math.PI; roll.position.set(0, y0 + h, z + dir * 0.03); roll.castShadow = true; g.add(roll);
      };
      scroll(0, 1.05, -d / 2 + 0.03, -1);
      scroll(0, 0.62, d / 2 - 0.03, 1);
      for (const s of [-1, 1]) g.add(box(0.06, 0.22, d - 0.12, wood, s * (w / 2 + 0.02), 0.3, 0));   // side rails
      g.add(box(w, 0.08, d - 0.12, std(colors.wood, { roughness: 0.7 }), 0, 0.3, 0));                     // deck
      beddingQuilt(g, ctx, it, { w: w - 0.04, d: d - 0.24, y: 0.34, duvet: duvetColor(it, ctx), pillows: 2 });
      return g;
    },
    iso: [
      { shape: 'box', box: [-0.88, 0, -1.15, 0.88, 1.12, -1.09], color: 'role:wood' },
      { shape: 'box', box: [-0.88, 0, 1.09, 0.88, 0.69, 1.15], color: 'role:wood' },
      { shape: 'box', box: [-0.78, 0.34, -1.03, 0.78, 0.6, 1.03], color: 'role:linen' },
    ],
  },
  // Upholstered bed — a tall wingback headboard with a stitched border, an upholstered frame on slim legs
  // (modern, mid-century, scandi primaries). color is the upholstery; the duvet is seeded.
  'upholstered-bed': {
    footprint: [1.84, 2.18], height: 1.35, params: ['w', 'd', 'color', 'quilt'], tags: ['bedroom', 'master', 'guest'],
    create(it, ctx) {
      const { std, box, group, colors, hex, mix, rng } = ctx;
      const w = it.w || 1.6, d = it.d || 2.1, g = group('Upholstered Bed');
      const up = it.color ? hex(it.color) : colors.fabric2, fab = std(up, { roughness: 0.9 }), seam = std(mix(up, 0x000000, 0.18), { roughness: 0.9 });
      const hw = w + 0.24, hz = -d / 2 + 0.04;
      g.add(box(hw, 1.25, 0.1, fab, 0, 0.1 + 0.625, hz));                                  // headboard
      g.add(box(hw - 0.12, 1.13, 0.012, seam, 0, 0.1 + 0.625, hz + 0.056));                 // its stitched panel
      g.add(box(hw - 0.16, 1.09, 0.02, fab, 0, 0.1 + 0.625, hz + 0.066));
      for (const s of [-1, 1]) g.add(box(0.12, 1.2, 0.3, fab, s * (hw / 2 - 0.06), 0.1 + 0.6, hz + 0.1));   // wings
      legs(g, ctx, { w: w - 0.1, d: d - 0.2, h: 0.1, size: 0.04, mat: std(colors.wood, { roughness: 0.5 }) });
      g.add(box(w + 0.04, 0.26, d - 0.1, fab, 0, 0.23, 0.05));
      const duvet = rng() < 0.5 ? colors.linen : mix(colors.accent, colors.linen, 0.45);
      beddingQuilt(g, ctx, it, { w: w - 0.06, d: d - 0.22, y: 0.36, z: 0.06, duvet: it.quilt ? colors.accent : duvet, pillows: 2 });
      return g;
    },
    iso: [
      { shape: 'box', box: [-0.92, 0.1, -1.05, 0.92, 1.35, -0.95], color: 'role:fabric2' },
      { shape: 'box', box: [-0.82, 0.1, -1.0, 0.82, 0.36, 1.09], color: 'role:fabric2' },
      { shape: 'box', box: [-0.77, 0.36, -0.95, 0.77, 0.62, 1.05], color: 'role:linen' },
    ],
  },
  // House bed — a kid's single bed under a timber house frame (two gable posts and a ridge), low to the floor
  // (scandi, modern kids' rooms). color is the duvet; quilt paints it.
  'house-bed': {
    footprint: [1.02, 2.08], height: 1.6, params: ['w', 'd', 'color', 'quilt'], tags: ['kids', 'bedroom'],
    create(it, ctx) {
      const { std, box, group, colors } = ctx;
      const w = it.w || 0.96, d = it.d || 2.0, g = group('House Bed'), wood = std(colors.wood, { roughness: 0.5 });
      const t = 0.045, H = 1.6;
      g.add(box(w, 0.1, d, wood, 0, 0.12, 0));
      for (const s of [-1, 1]) g.add(box(t, 0.14, d, wood, s * (w / 2 - t / 2), 0.13, 0));
      for (const z of [-d / 2 + t / 2, d / 2 - t / 2]) {
        for (const s of [-1, 1]) g.add(box(t, 1.1, t, wood, s * (w / 2 - t / 2), 0.55, z));   // posts
        for (const s of [-1, 1]) { const r = box(t, Math.hypot(w / 2, H - 1.1) + 0.03, t, wood, s * w / 4, (1.1 + H) / 2, z); r.rotation.z = s * Math.atan2(w / 2, H - 1.1); g.add(r); }   // rafters
      }
      g.add(box(t, t, d, wood, 0, H - t / 2, 0));                                                    // ridge
      beddingQuilt(g, ctx, it, { w: w - 0.1, d: d - 0.1, y: 0.17, duvet: duvetColor(it, ctx), pillows: 1, thick: 0.16 });
      return g;
    },
    iso: [
      { shape: 'box', box: [-0.48, 0.07, -1.0, 0.48, 0.5, 1.0], color: 'role:linen' },
      { shape: 'box', box: [-0.5, 0, -1.0, -0.45, 1.6, 1.0], color: 'role:wood' },
      { shape: 'box', box: [0.45, 0, -1.0, 0.5, 1.6, 1.0], color: 'role:wood' },
    ],
  },
});
