// Dress types for the table: what a dining table, a kitchen island or a sideboard is set with (plan 5.5 SMALL). Each is DORMANT: registered with its
// placement on a new `dx-*` role (so the composer never picks it, test-compose-stability proves it) and placed only by a fixture or, later, a DRESS recipe.
// Pieces are tableware.ts's; the types merge them into one to three role meshes.
import { registerDress, dressType, variantOf, pickOf, cylinder } from './dress-kit.js';
import { plate, plateStack, napkin, cutlery, tumbler, carafe, candle, candlestick, vase, bowl, lump } from './tableware.js';

registerDress({
  // One diner's place: a dinner plate with a napkin on it, a tumbler to the upper right, a fork on the left, a knife and spoon on the right.
  'place-setting': dressType({
    name: 'place-setting', footprint: [0.42, 0.33], height: 0.11, rolls: 3, paint: 'ceramic', tags: ['dining', 'kitchen'],
    build(k, it, u) {
      plate(k, { z: 0.03 }, { seg: 18 });
      napkin(k, { y: 0.0123, z: 0.03, ry: (u[0] - 0.5) * 0.3 }, { w: 0.11, d: 0.07 });
      tumbler(k, { x: 0.17, z: -0.13 }, { r: 0.034, h: 0.11 });
      cutlery(k, { z: 0.03 }, { gap: 0.172 });
    },
  }),
  // Three candles of different heights: pillars, or tapers in metal sticks, or one pillar and two tapers.
  'candle-trio': dressType({
    name: 'candle-trio', footprint: [0.26, 0.1], height: 0.24, rolls: 3, tags: ['dining', 'living', 'kitchen', 'bedroom'],
    build(k, it, u) {
      const v = variantOf(it, u[0], 3);
      if (v === 0) { candle(k, { x: -0.085 }, { r: 0.032, h: 0.08 }); candle(k, { x: 0.0, z: 0.012 }, { r: 0.036, h: 0.13 }); candle(k, { x: 0.088 }, { r: 0.032, h: 0.105 }); }
      else if (v === 1) for (const [x, h, z] of [[-0.09, 0.19, 0], [0, 0.23, 0.012], [0.09, 0.2, 0]] as const) { candlestick(k, { x, z }, { h: h * 0.38 }); candle(k, { x, z, y: h * 0.38 - 0.012 }, { r: 0.011, h: h * 0.62 + 0.012 }); }
      else { candle(k, { x: -0.07 }, { r: 0.036, h: 0.12 }); for (const [x, h] of [[0.02, 0.2], [0.09, 0.17]] as const) { candlestick(k, { x, z: 0.01 }, { h: h * 0.4 }); candle(k, { x, z: 0.01, y: h * 0.4 - 0.012 }, { r: 0.011, h: h * 0.6 + 0.012 }); } }
    },
  }),
  // A carafe of water and two tumblers on a round wooden board.
  'carafe': dressType({
    name: 'carafe', footprint: [0.3, 0.3], height: 0.24, rolls: 2, tags: ['dining', 'kitchen', 'bedroom'],
    build(k, it, u) {
      k.add('wood', cylinder(0.15, 0.15, 0.016, 22));
      carafe(k, { x: -0.04, y: 0.016 });
      tumbler(k, { x: 0.085, z: 0.06, y: 0.016 }, { r: 0.033, h: 0.1 });
      tumbler(k, { x: 0.05, z: -0.07, y: 0.016 }, { r: 0.033, h: 0.1 });
    },
  }),
  // A centrepiece: bottle vase with two bud vases, a bowl of round fruit, or a low trio of vessels.
  'centerpiece': dressType({
    name: 'centerpiece', footprint: [0.3, 0.2], height: 0.25, rolls: 4, paint: 'ceramic', tags: ['dining', 'living', 'kitchen', 'hall'],
    build(k, it, u) {
      const v = variantOf(it, u[0], 3), role = pickOf(['ceramic', 'accent'], u[1]);
      // the three variants share one footprint (about 0.30 x 0.19), so a host is packed once whichever the roll picks
      if (v === 0) { vase(k, { x: -0.08 }, { kind: 'bottle', role }); vase(k, { x: 0.05, z: 0.065 }, { kind: 'bud', role }); vase(k, { x: 0.12, z: -0.06 }, { kind: 'bud', role, s: 0.8 }); }
      else if (v === 1) { bowl(k, { x: -0.03 }, { r: 0.1, h: 0.06, role }); lump(k, { x: -0.06, y: 0.012, z: 0.01 }, { r: 0.028 }); lump(k, { x: 0.0, y: 0.012, z: 0.02 }, { r: 0.026 }); lump(k, { x: -0.03, y: 0.04, z: -0.025 }, { r: 0.024 }); candle(k, { x: 0.115, z: 0.0 }, { role: 'paper', r: 0.034, h: 0.11 }); }
      else { vase(k, { x: -0.1, z: 0.02 }, { kind: 'column', role, s: 0.5 }); vase(k, { x: 0.0, z: 0.05 }, { kind: 'round', role, s: 0.75 }); vase(k, { x: 0.1, z: -0.05 }, { kind: 'bud', role }); }
    },
  }),
  // A stack of plates, two or three, with a bowl beside it (plain or in the house's accent glaze).
  'plate-stack': dressType({
    name: 'plate-stack', footprint: [0.44, 0.27], height: 0.06, rolls: 4, paint: 'ceramic', tags: ['dining', 'kitchen'],
    build(k, it, u) {
      const n = 2 + Math.floor(u[0] * 2), bw = pickOf(['ceramic', 'accent'], u[1]);
      plateStack(k, { x: -0.08, ry: u[2] * 6 }, { n, r: 0.134, seg: 16 });
      bowl(k, { x: 0.15, z: 0.02 }, { r: 0.075, h: 0.05, role: bw });
    },
  }),
}, { group: 'decor' });
