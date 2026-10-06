// Dress types for the kitchen: what a counter, an island or a hob carries (plan 5.5 SMALL). DORMANT, like every dress type.
import { registerDress, dressType, box, roundedBox, cylinder, trayShell, free, MIN_FREE } from './dress-kit.js';
import { kettle, mug, board, lump, bowl, spoon, crock, canister, bottle, pot, foldedCloth } from './tableware.js';

registerDress({
  // A stovetop kettle with a mug beside it.
  'kettle-and-mug': dressType({
    name: 'kettle-and-mug', footprint: [0.35, 0.2], height: 0.22, rolls: 2, tags: ['kitchen'],
    build(k, it, u) {
      kettle(k, { x: -0.07, ry: (u[0] - 0.5) * 0.6 });
      mug(k, { x: 0.13, z: 0.03, ry: Math.PI * (0.25 + u[1] * 0.5) }, { role: 'ceramic' });
    },
  }),
  // A chopping board with two lemons on it and a bowl of more beside it.
  'cutting-board-set': dressType({
    name: 'cutting-board-set', footprint: [0.55, 0.24], height: 0.07, rolls: 4, tags: ['kitchen'],
    build(k, it, u) {
      board(k, { x: -0.1, ry: (u[0] - 0.5) * 0.12 }, { w: 0.34, d: 0.22, h: 0.024 });
      lump(k, { x: -0.16, y: 0.024, z: 0.0 }, { r: 0.026, sy: 0.85 }); lump(k, { x: -0.08, y: 0.024, z: 0.03 }, { r: 0.025, sy: 0.85 });
      bowl(k, { x: 0.2 }, { r: 0.07, h: 0.055 });
      lump(k, { x: 0.18, y: 0.012, z: 0.01 }, { r: 0.026, sy: 0.85 }); lump(k, { x: 0.225, y: 0.012, z: -0.012 }, { r: 0.025, sy: 0.85 });
    },
  }),
  // A crock of wooden and steel utensils.
  'utensil-crock': dressType({
    name: 'utensil-crock', footprint: [0.17, 0.14], height: 0.32, rolls: 4, paint: 'ceramic', tags: ['kitchen'],
    build(k, it, u) {
      crock(k, {}, { r: 0.06, h: 0.14 });
      spoon(k, { x: -0.02, y: 0.03, z: 0.0, rz: 0.13 + u[0] * 0.05 }, { len: 0.23 });
      spoon(k, { x: 0.02, y: 0.03, z: -0.012, rz: -0.12 - u[1] * 0.05, ry: 0.5 }, { len: 0.2 });
      k.add('steel', free(box(0.045, MIN_FREE, 0.1)), { x: 0.0, y: 0.17, z: 0.02, rx: 0.12, rz: 0.04 });
      k.add('steel', free(cylinder(0.008, 0.008, 0.17, 8)), { x: 0.0, y: 0.03, z: 0.012, rz: 0.04, rx: 0.12 });
    },
  }),
  // Three canisters with wooden lids, tall to short.
  'canister-trio': dressType({
    name: 'canister-trio', footprint: [0.34, 0.12], height: 0.23, rolls: 2, paint: 'ceramic', tags: ['kitchen'],
    build(k, it, u) {
      canister(k, { x: -0.115 }, { r: 0.055, h: 0.2 }); canister(k, { x: 0.0, z: 0.004 }, { r: 0.05, h: 0.17 }); canister(k, { x: 0.112 }, { r: 0.046, h: 0.14 });
    },
  }),
  // A bread bin: a wooden box, a lid and a bar handle. (It was lacquered in the house's cabinet colour; in a dark-cabinet house that is a black block on a white counter, seraphine's cart,
  // gardennook's dishwasher top: pass 6's review.)
  'bread-bin': dressType({
    name: 'bread-bin', footprint: [0.4, 0.27], height: 0.23, rolls: 1, paint: 'wood', tags: ['kitchen'],
    build(k) {
      k.add('wood', roundedBox(0.38, 0.19, 0.24, 0.02, 1));
      k.add('wood', roundedBox(0.4, 0.04, 0.255, 0.015, 1), { y: 0.19 });
      k.add('metal', free(box(0.12, MIN_FREE, 0.014)), { y: 0.12, z: 0.127 });
    },
  }),
  // A dish rack: a steel tray, five plates standing in it.
  'dish-rack': dressType({
    name: 'dish-rack', footprint: [0.5, 0.32], height: 0.21, rolls: 2, tags: ['kitchen'],
    build(k, it, u) {
      k.add('steel', trayShell(0.44, 0.32, 0.034, { wall: 0.008, floor: 0.008, cr: 0.03, seg: 3 }));
      for (let i = 0; i < 5; i++) k.add('ceramic', cylinder(0.095, 0.095, 0.014, 16), { x: -0.15 + i * 0.075, y: 0.104, z: -0.03 + (i % 2) * 0.012, rx: Math.PI / 2 - 0.1, ry: (u[0] - 0.5) * 0.06 });
    },
  }),
  // A folded tea towel or two: linen with the house's second fabric on top.
  'tea-towel': dressType({
    name: 'tea-towel', footprint: [0.32, 0.23], height: 0.05, rolls: 3, tags: ['kitchen'],
    build(k, it, u) { foldedCloth(k, {}, { roles: ['linen', 'fabric2', 'linen'], w: 0.3, d: 0.2, layers: 3, turns: [0, (u[0] - 0.5) * 0.3, (u[1] - 0.5) * 0.2] }); },
  }),
  // An oil and a vinegar bottle, in smoked glass with metal pourers, and a dish.
  'oil-pair': dressType({
    name: 'oil-pair', footprint: [0.22, 0.08], height: 0.27, rolls: 2, tags: ['kitchen'],
    build(k, it, u) {
      bottle(k, { x: -0.06 }, { role: 'smoke', cap: 'metal', h: 0.26, r: 0.034 }); bottle(k, { x: 0.015, z: 0.01 }, { role: 'smoke', cap: 'metal', h: 0.2, r: 0.03 });
      bowl(k, { x: 0.085, z: 0.0 }, { r: 0.04, h: 0.022, role: 'ceramic' });
    },
  }),
  // A lidded pot on a burner with a wooden spoon laid across the lid.
  'pot-on-hob': dressType({
    name: 'pot-on-hob', footprint: [0.33, 0.24], height: 0.19, rolls: 3, tags: ['kitchen'],
    build(k, it, u) {
      pot(k, { ry: (u[0] - 0.5) * 0.8 }, { r: 0.1, h: 0.12 });
      spoon(k, { y: 0.158, x: 0.12, z: 0.05, ry: (u[1] - 0.5) * 0.5, rz: Math.PI / 2 }, { len: 0.24 });
    },
  }),
}, { group: 'decor' });
