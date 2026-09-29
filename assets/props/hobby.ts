// Hobby — the gym, the garage workshop and the potting corner of a sunroom or greenhouse: the rooms the composer's
// gym, garage, sunroom and greenhouse programs furnish. Contract: index.js; decor.js is the worked example (floor
// origin at the footprint centre, facing +z at rot 0, role colours from ctx.colors or it.color, ctx.rng for
// variation).
//
// Owner: S3 (compose).
import { registerProps } from './registry.js';

const cyl = (THREE, rt, rb, h, mat, x = 0, y = 0, z = 0, seg = 14) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; return m; };
const TERRACOTTA = 0xc2703e, RUBBER = 0x27272a;

registerProps({
  // Exercise bike — a flywheel at the front (+z), the saddle post at the back, handlebars over the flywheel.
  'exercise-bike': {
    footprint: [0.56, 1.1], height: 1.2, params: ['color'], tags: ['gym', 'garage', 'bedroom'],
    create(it, { THREE, std, box, group, colors, hex }) {
      const g = group('Exercise Bike'), frame = std(it.color ? hex(it.color) : colors.metal, { metalness: 0.6, roughness: 0.35 }), rubber = std(RUBBER, { roughness: 0.8 });
      for (const z of [-0.45, 0.45]) g.add(box(0.56, 0.05, 0.08, frame, 0, 0.025, z));                          // feet
      g.add(box(0.06, 0.06, 0.9, frame, 0, 0.1, 0));
      const fly = cyl(THREE, 0.24, 0.24, 0.05, std(0x9ca3af, { metalness: 0.8, roughness: 0.3 }), 0, 0.36, 0.28, 28); fly.rotation.z = Math.PI / 2; g.add(fly);
      const post = box(0.05, 0.8, 0.05, frame, 0, 0.5, -0.18); post.rotation.x = 0.25; g.add(post);            // saddle post
      g.add(box(0.2, 0.06, 0.28, rubber, 0, 0.94, -0.28));                                                         // saddle
      const bar = box(0.05, 0.75, 0.05, frame, 0, 0.62, 0.3); bar.rotation.x = -0.2; g.add(bar);
      g.add(box(0.5, 0.04, 0.05, rubber, 0, 1.0, 0.38));                                                          // handlebars
      g.add(box(0.16, 0.1, 0.03, std(0x111827, { roughness: 0.3 }), 0, 1.08, 0.36));                              // console
      return g;
    },
    iso: [{ shape: 'box', box: [-0.28, 0, -0.55, 0.28, 1.1, 0.55], color: 'role:metal' }],
  },
  // Weight bench — a padded flat bench on a steel frame with an upright rack and a barbell at its head (−z).
  'weight-bench': {
    footprint: [1.3, 1.3], height: 1.2, params: ['color'], tags: ['gym', 'garage'],
    create(it, { THREE, std, box, group, colors, hex }) {
      const g = group('Weight Bench'), steel = std(colors.metal, { metalness: 0.7, roughness: 0.35 }), pad = std(it.color ? hex(it.color) : 0x2b2622, { roughness: 0.6 });
      g.add(box(0.3, 0.08, 1.1, pad, 0, 0.44, 0.1)); g.add(box(0.06, 0.4, 0.06, steel, 0, 0.2, 0.55)); g.add(box(0.4, 0.05, 0.06, steel, 0, 0.025, 0.55));
      for (const s of [-1, 1]) { g.add(box(0.06, 1.1, 0.06, steel, s * 0.45, 0.55, -0.5)); g.add(box(0.06, 0.05, 0.5, steel, s * 0.45, 0.025, -0.5)); }   // rack uprights
      const bar = cyl(THREE, 0.014, 0.014, 1.3, std(0xd1d5db, { metalness: 0.9, roughness: 0.2 }), 0, 1.0, -0.5, 10); bar.rotation.z = Math.PI / 2; g.add(bar);
      for (const s of [-1, 1]) for (const k of [0, 1]) { const p = cyl(THREE, 0.2 - k * 0.04, 0.2 - k * 0.04, 0.04, std(RUBBER, { roughness: 0.7 }), s * (0.55 + k * 0.045), 1.0, -0.5, 24); p.rotation.z = Math.PI / 2; g.add(p); }
      return g;
    },
    iso: [{ shape: 'box', box: [-0.15, 0, -0.45, 0.15, 0.48, 0.65], color: '#2b2622' }, { shape: 'box', box: [-0.65, 0, -0.55, 0.65, 1.2, -0.45], color: 'role:metal' }],
  },
  // Yoga mat — a rolled-out mat with a block at its head (gym, a bedroom or sunroom corner).
  'yoga-mat': {
    footprint: [0.62, 1.83], height: 0.1, params: ['color'], tags: ['gym', 'bedroom', 'sunroom'],
    create(it, { std, box, group, colors, hex, mix }) {
      const g = group('Yoga Mat'), c = it.color ? hex(it.color) : colors.accent;
      g.add(box(0.61, 0.006, 1.83, std(c, { roughness: 0.9 }), 0, 0.003, 0, false));
      g.add(box(0.23, 0.08, 0.15, std(mix(c, 0xffffff, 0.35), { roughness: 0.8 }), 0.1, 0.046, -0.75));   // a block
      return g;
    },
    iso: [{ shape: 'box', box: [-0.31, 0, -0.915, 0.31, 0.01, 0.915], color: 'role:accent' }],
  },
  // Workbench — a butcher-block top on a steel frame with a lower shelf, a pegboard with tools against the wall
  // (−z) behind it, a vice at one end (garage, laundry, studio).
  'workbench': {
    footprint: [1.8, 0.72], height: 1.9, params: ['w', 'color'], tags: ['garage', 'laundry', 'studio'],
    create(it, { THREE, std, box, group, colors, hex, rng }) {
      const w = it.w || 1.8, d = 0.7, g = group('Workbench'), top = std(it.color ? hex(it.color) : colors.wood, { roughness: 0.6 }), steel = std(colors.metal, { metalness: 0.6, roughness: 0.4 });
      g.add(box(w, 0.05, d, top, 0, 0.9, 0));
      g.add(box(w - 0.1, 0.03, d - 0.1, top, 0, 0.2, 0));
      for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) g.add(box(0.05, 0.875, 0.05, steel, sx * (w / 2 - 0.05), 0.4375, sz * (d / 2 - 0.05)));
      g.add(box(w, 0.95, 0.02, std(0xc8b08a, { roughness: 0.9 }), 0, 1.42, -d / 2 + 0.01));   // pegboard
      const TOOLS = [0xb91c1c, 0x1d4ed8, 0xca8a04, 0x374151, 0x15803d];
      for (let i = 0; i < 7; i++) { const t = box(0.03 + rng() * 0.05, 0.14 + rng() * 0.16, 0.02, std(TOOLS[Math.floor(rng() * TOOLS.length)], { roughness: 0.5 }), -w / 2 + 0.2 + i * (w - 0.4) / 6, 1.45 + (rng() - 0.5) * 0.3, -d / 2 + 0.03); g.add(t); }
      g.add(box(0.14, 0.1, 0.16, steel, w / 2 - 0.15, 0.97, d / 2 - 0.1));   // vice
      return g;
    },
    iso: [{ shape: 'box', box: [-0.9, 0, -0.35, 0.9, 0.93, 0.35], color: 'role:wood' }, { shape: 'box', box: [-0.9, 0.93, -0.35, 0.9, 1.9, -0.33], color: '#c8b08a' }],
  },
  // Potting bench — a slatted timber bench with a back shelf of terracotta pots and seedlings (greenhouse, sunroom,
  // a potting counter).
  'potting-bench': {
    footprint: [1.2, 0.52], height: 1.35, params: ['w', 'color'], tags: ['greenhouse', 'sunroom', 'garden'],
    create(it, { THREE, std, box, group, colors, hex, rng }) {
      const w = it.w || 1.2, d = 0.5, g = group('Potting Bench'), wood = std(it.color ? hex(it.color) : colors.wood, { roughness: 0.7 });
      for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) g.add(box(0.05, sz < 0 ? 1.35 : 0.88, 0.05, wood, sx * (w / 2 - 0.03), (sz < 0 ? 1.35 : 0.88) / 2, sz * (d / 2 - 0.03)));
      for (let k = 0; k < 5; k++) g.add(box(w, 0.025, d / 5 - 0.012, wood, 0, 0.88, -d / 2 + (k + 0.5) * d / 5));   // slatted top
      g.add(box(w - 0.06, 0.02, d - 0.06, wood, 0, 0.25, 0));
      g.add(box(w, 0.02, 0.18, wood, 0, 1.2, -d / 2 + 0.09));                                          // back shelf
      const pot = std(TERRACOTTA, { roughness: 0.8 }), leaf = std(0x4f772d, { roughness: 0.8, flatShading: true });
      for (let i = 0; i < 4; i++) {
        const x = -w / 2 + 0.15 + i * (w - 0.3) / 3, y = i % 2 ? 1.21 : 0.9, z = i % 2 ? -d / 2 + 0.09 : 0.05 * (rng() - 0.5);
        g.add(cyl(THREE, 0.07, 0.05, 0.12, pot, x, y + 0.06, z, 12));
        const f = new THREE.Mesh(new THREE.IcosahedronGeometry(0.07, 0), leaf); f.position.set(x, y + 0.17, z); f.castShadow = true; g.add(f);
      }
      return g;
    },
    iso: [{ shape: 'box', box: [-0.6, 0, -0.25, 0.6, 0.9, 0.25], color: 'role:wood' }, { shape: 'box', box: [-0.6, 0.9, -0.25, 0.6, 1.35, -0.2], color: 'role:wood' }],
  },
});
