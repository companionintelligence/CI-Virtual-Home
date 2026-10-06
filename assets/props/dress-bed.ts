// Dress types for the bedroom: a nightstand, a dresser, the floor beside the bed (plan 5.5 SMALL). DORMANT, like every dress type.
import { registerDress, dressType, roundedBox as rb } from './dress-kit.js';
import { book, tumbler, candle, tray, bottle, frame, slipper } from './tableware.js';

registerDress({
  // A bedside: a book, a glass of water and a candle.
  'nightstand-set': dressType({
    name: 'nightstand-set', footprint: [0.28, 0.25], height: 0.1, rolls: 3, tags: ['bedroom'],
    build(k, it, u) {
      book(k, { x: -0.05, ry: (u[0] - 0.5) * 0.6 }, { w: 0.15, h: 0.03, d: 0.21 });
      tumbler(k, { x: 0.09, z: -0.04 }, { r: 0.033, h: 0.1 });
      candle(k, { x: 0.1, z: 0.06 }, { role: 'paper', r: 0.028, h: 0.07 + u[1] * 0.03 });
    },
  }),
  // A dresser top: a ceramic tray with two scent bottles and a small box, and a standing frame.
  'dresser-set': dressType({
    name: 'dresser-set', footprint: [0.5, 0.19], height: 0.21, rolls: 3, tags: ['bedroom', 'hall'],
    build(k, it, u) {
      tray(k, { x: -0.1 }, { role: 'ceramic', w: 0.3, d: 0.18, rim: 0.014 });
      bottle(k, { x: -0.16, y: 0.008, z: 0.0 }, { role: 'smoke', cap: 'smoke', h: 0.12, r: 0.027 }); bottle(k, { x: -0.09, y: 0.008, z: 0.02 }, { role: 'smoke', cap: 'smoke', h: 0.16, r: 0.025 });
      k.add('ceramic', rb(0.07, 0.04, 0.05, 0.008, 1), { x: -0.03, y: 0.008, z: -0.02, ry: u[0] });
      frame(k, { x: 0.17, z: -0.02, ry: -0.2 }, { w: 0.15, h: 0.2, paper: 'ceramic' });
    },
  }),
  // A pair of slippers on the floor by the bed, splayed a little.
  'slippers': dressType({
    name: 'slippers', footprint: [0.26, 0.29], height: 0.085, rolls: 3, tags: ['bedroom'], surface: false,
    build(k, it, u) { slipper(k, { x: -0.07, ry: 0.12 + u[0] * 0.1 }); slipper(k, { x: 0.075, z: 0.01, ry: -0.1 - u[1] * 0.1 }); },
  }),
}, { group: 'decor' });
