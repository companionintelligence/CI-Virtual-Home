// Dress types for the living room: a coffee table, a console, a shelf (plan 5.5 SMALL). DORMANT, like every dress type.
import { registerDress, dressType, variantOf, pickOf, between, box, cylinder } from './dress-kit.js';
import { tray, bookStack, candle, candlestick, bowl, book, tumbler, vase, frame, lump } from './tableware.js';

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
  // A book, a coaster and a glass: what a side table holds.
  'side-set': dressType({
    name: 'side-set', footprint: [0.28, 0.24], height: 0.11, rolls: 4, tags: ['living', 'bedroom'],
    build(k, it, u) {
      book(k, { x: -0.04, ry: (u[0] - 0.5) * 0.5 }, { w: 0.15, h: 0.03, d: 0.21 });
      k.add('paper', cylinder(0.045, 0.045, 0.008, 16), { x: 0.09, z: 0.04 });
      tumbler(k, { x: 0.09, y: 0.008, z: 0.04 }, { r: 0.034, h: 0.1 });
    },
  }),
  // A console's arrangement: a key bowl, two standing frames and a candlestick.
  'console-set': dressType({
    name: 'console-set', footprint: [0.64, 0.15], height: 0.22, rolls: 3, tags: ['hall', 'living', 'dining'],
    build(k, it, u) {
      bowl(k, { x: -0.23 }, { r: 0.075, h: 0.045, role: 'ceramic' });
      frame(k, { x: 0.02, z: -0.03, ry: 0.1 }, { w: 0.16, h: 0.21, paper: 'ceramic' }); frame(k, { x: 0.2, z: -0.02, ry: -0.08 }, { w: 0.13, h: 0.17, paper: 'ceramic' });
      candlestick(k, { x: 0.3, z: 0.01 }, { h: 0.1 });
    },
  }),
  // A shelf's styling, over `w` (default 0.6 m): a run of standing books, a bud vase, a pebble and a lying pair.
  'shelf-style': dressType({
    name: 'shelf-style', footprint: [0.58, 0.23], height: 0.26, params: ['w', 'variant'], rolls: 5, tags: ['living', 'study', 'bedroom', 'hall'],
    build(k, it, u) {
      const w = Math.max(0.3, it.w || 0.6), x0 = -w / 2;
      const ws = [0.032, 0.04, 0.028, 0.036], hs = [0.22, 0.25, 0.2, 0.24], sh = [1, 0.82, 0.92, 0.74];
      let x = x0 + 0.02;
      ws.forEach((bw, i) => { k.add('fabric2', box(bw, hs[i], 0.16), { x: x + bw / 2, z: -0.005 }, sh[i]); x += bw + 0.002; });
      vase(k, { x: x0 + w * 0.5 }, { kind: 'bud', role: 'ceramic', s: 0.9 + u[0] * 0.2 });
      lump(k, { x: x0 + w * 0.5 + 0.075, z: 0.03 }, { r: 0.028, role: 'ceramic', sy: 0.8 });
      book(k, { x: x0 + w - 0.1, ry: (u[1] - 0.5) * 0.4 }, { w: 0.15, h: 0.03, d: 0.2 }); book(k, { x: x0 + w - 0.1, y: 0.03, ry: (u[2] - 0.5) * 0.4 }, { w: 0.13, h: 0.024, d: 0.18, cover: 'fabric2' });
    },
  }),
}, { group: 'decor' });
