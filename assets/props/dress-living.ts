// Dress types for the living room: a coffee table, a console, a shelf (plan 5.5 SMALL). DORMANT, like every dress type.
import { registerDress, dressType, variantOf, pickOf, between } from './dress-kit.js';
import { tray, bookStack, candle, bowl } from './tableware.js';

registerDress({
  // A tray with a short stack of books and a candle or a bowl: a wood, a metal or a ceramic tray.
  'tray-vignette': dressType({
    name: 'tray-vignette', footprint: [0.42, 0.3], height: 0.13, rolls: 8, tags: ['living', 'bedroom', 'hall'],
    build(k, it, u) {
      const v = variantOf(it, u[0], 3), tr = (['wood', 'metal', 'ceramic'] as const)[v];
      tray(k, {}, { role: tr, w: 0.42, d: 0.3, rim: 0.02 });
      const n = 2 + Math.floor(u[1] * 2);
      const sizes: Array<[number, number, number]> = [[0.16, 0.034, 0.215], [0.14, 0.026, 0.2], [0.13, 0.022, 0.19]].slice(0, n) as any;
      bookStack(k, { x: -0.1, y: 0.016, z: 0.0 }, { covers: ['fabric2'], sizes, turns: [(u[2] - 0.5) * 0.3, (u[3] - 0.5) * 0.3, (u[4] - 0.5) * 0.3] });
      if (u[5] < 0.5) candle(k, { x: 0.09, y: 0.016, z: -0.03 }, { role: 'paper', r: 0.034, h: between(u[6], 0.08, 0.12) });
      else bowl(k, { x: 0.09, y: 0.016, z: 0.0 }, { role: tr, r: 0.07, h: 0.04 });
    },
  }),
}, { group: 'decor' });
