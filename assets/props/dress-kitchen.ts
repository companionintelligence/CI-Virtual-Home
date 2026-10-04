// Dress types for the kitchen: what a counter, an island or a hob carries (plan 5.5 SMALL). DORMANT, like every dress type.
import { registerDress, dressType } from './dress-kit.js';
import { kettle, mug } from './tableware.js';

registerDress({
  // A stovetop kettle with a mug beside it.
  'kettle-and-mug': dressType({
    name: 'kettle-and-mug', footprint: [0.35, 0.2], height: 0.22, rolls: 2, tags: ['kitchen'],
    build(k, it, u) {
      kettle(k, { x: -0.07, ry: (u[0] - 0.5) * 0.6 });
      mug(k, { x: 0.13, z: 0.03, ry: Math.PI * (0.25 + u[1] * 0.5) }, { role: 'ceramic' });
    },
  }),
}, { group: 'decor' });
