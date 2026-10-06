// Dress types for the bathroom: a vanity, a tub rim, a tank, a wall (plan 5.5 SMALL). DORMANT, like every dress type.
import { registerDress, dressType, box, cylinder, lathe, roundedBox, vessel, free, MIN_FREE } from './dress-kit.js';
import { soapDispenser, mug, tray, lump, tissueBox, candle } from './tableware.js';

registerDress({
  // A vanity set: a soap dispenser, a cup and a soap dish with a bar, on a small ceramic dish.
  'vanity-set': dressType({
    name: 'vanity-set', footprint: [0.3, 0.16], height: 0.175, rolls: 3, paint: 'ceramic', tags: ['bathroom'],
    build(k, it, u) {
      tray(k, {}, { role: 'ceramic', w: 0.3, d: 0.16, rim: 0.012 });
      soapDispenser(k, { x: -0.085, y: 0.008 }, { role: 'ceramic', pump: 'metal' });
      mug(k, { x: 0.02, z: 0.01, y: 0.008, ry: 1.2 }, { role: 'ceramic', r: 0.032, h: 0.09, handle: false });
      lump(k, { x: 0.1, z: 0.02, y: 0.008 }, { role: 'paper', r: 0.03, sy: 0.55 });
    },
  }),
  // A tissue box and a candle in a jar: what sits on a tank or a vanity corner.
  'tissue-candle': dressType({
    name: 'tissue-candle', footprint: [0.34, 0.15], height: 0.14, rolls: 2, tags: ['bathroom'],
    build(k, it, u) {
      tissueBox(k, { x: -0.06, ry: (u[0] - 0.5) * 0.3 });
      k.add('glass', vessel([[0.036, 0], [0.04, 0.075]], { seg: 16, wall: 0.006, floor: 0.01, depth: 0.05 }), { x: 0.11, z: 0.01 });
      candle(k, { x: 0.11, y: 0.01, z: 0.01 }, { role: 'paper', r: 0.032, h: 0.05 });
    },
  }),
  // A bath caddy across the tub: a wooden board with end rails, a candle, a cup and a bar of soap.
  'tub-tray': dressType({
    name: 'tub-tray', footprint: [0.7, 0.3], height: 0.13, rolls: 3, tags: ['bathroom'],
    build(k, it, u) {
      k.add('wood', roundedBox(0.7, 0.02, 0.17, 0.006, 1), { y: 0.016 });
      for (const sx of [-0.33, 0.33]) k.add('wood', box(0.04, 0.02, 0.3), { x: sx });
      candle(k, { x: -0.2, y: 0.036, z: 0.0 }, { role: 'paper', r: 0.032, h: 0.08 });
      mug(k, { x: 0.02, y: 0.036, z: 0.0, ry: u[0] * 3 }, { role: 'ceramic', r: 0.032, h: 0.09, handle: false });
      lump(k, { x: 0.2, y: 0.036, z: 0.02 }, { role: 'paper', r: 0.03, sy: 0.55 });
    },
  }),
}, { group: 'decor' });

// A wall-mounted toilet roll holder with a roll on it: the back at the wall (z = 0), 0.75 m up by default.
registerDress({
  'roll-holder': dressType({
    name: 'roll-holder', footprint: [0.17, 0.17], height: 0.14, rolls: 1, tags: ['bathroom'], surface: false, mountY: 0.75,
    build(k) {
      k.add('metal', box(0.03, 0.14, MIN_FREE + 0.002), { x: -0.065 });                                                // the back plate, on the wall
      k.add('metal', free(box(MIN_FREE + 0.002, MIN_FREE + 0.002, 0.075)), { x: -0.065, y: 0.065 });                    // the arm out to the rod
      k.add('metal', free(cylinder(0.006, 0.006, 0.15, 8)), { x: -0.07, y: 0.07, z: 0.075, rz: -Math.PI / 2 });         // the rod, along the wall
      k.add('paper', lathe([[0.02, 0], [0.055, 0, 1], [0.055, 0.1, 1], [0.02, 0.1, 1], [0.02, 0, 1]], 16, 0.035), { x: -0.045, y: 0.07, z: 0.075, rz: -Math.PI / 2 });   // the roll, hollow
    },
  }),
}, { group: 'decor', surface: false });
