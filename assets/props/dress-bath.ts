// Dress types for the bathroom: a vanity, a tub rim, a tank, a wall (plan 5.5 SMALL). DORMANT, like every dress type.
import { registerDress, dressType, variantOf } from './dress-kit.js';
import { soapDispenser, mug, tray, lump } from './tableware.js';

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
}, { group: 'decor' });
