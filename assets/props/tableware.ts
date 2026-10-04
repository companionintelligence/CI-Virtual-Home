// Tableware and small goods — the PIECES the dress types (dress-table.ts, dress-kitchen.ts, dress-living.ts, dress-bed.ts, dress-bath.ts, dress-hall.ts)
// are composed of: each is a function that adds one object to a `Kit` (assets/props/dress-kit.ts) at a placement, in a role. Round goods are lathes of
// 12-22 segments from MEASURED catalog dimensions: the Cooking Assets pack (CC0, MilkAndBanana) is the dimension and silhouette SPEC, no geometry of it
// is used (the pack's round tableware is 8-12 sided; a 24-segment plate here is 100-200 triangles).
//
// The measured dimensions these follow (asset-catalog.json, `asset`: height x footprint, metres): mug 0.109 x 0.118 x 0.08, drinking glass 0.139 x 0.087,
// dinner plate 0.268 dia, side plate 0.219, rimmed plate 0.274, bowl 0.23 x 0.123 (serving), stovetop kettle 0.254 x 0.241 x 0.188, saucepan 0.12 x 0.205,
// stock pot 0.312 x 0.265, cutting board 0.345 x 0.215 x 0.024, salt shaker 0.092 x 0.038, pepper mill 0.211 x 0.06, wine bottle 0.31 x 0.092, dish-soap
// bottle 0.214 x 0.07, book 0.149 x 0.224 x 0.042, toilet roll 0.11, towel ring 0.195.
//
// Rules the pieces keep (the kit enforces the rest): nothing under MIN_PART in its thin dimension (the primitives clamp), glass is OPAQUE (a role, not a
// transparent material), no flame, no wick (6 mm), no cutlery thinner than a 6 mm slab. A piece draws no rng: variation comes from the caller's rolls.
import { Kit, lathe, vessel, cylinder, box, roundedBox, torus, trayShell, free, MIN_PART, MIN_FREE } from './dress-kit.js';
import type { Xf, PP } from './dress-kit.js';

/** lathe segments by radius: wide round things read round at 22, small ones at 12-16 (R-FACET asks 16 for radius 6 cm and up) */
export const segFor = (r: number): number => (r >= 0.06 ? 22 : r >= 0.03 ? 16 : 12);
const H = 1;   // a hard profile edge

// ---- drinkware ---------------------------------------------------------------------------------------------------------------------
/** A mug: a tapered cup and a half-ring handle on +x (turn it with `at.ry`). */
export function mug(k: Kit, at: Xf, o: { role?: string; h?: number; r?: number; handle?: boolean } = {}): void {
  const role = o.role || 'ceramic', h = o.h ?? 0.095, r = o.r ?? 0.04, seg = r >= 0.04 ? 16 : 12;
  k.with(at, () => {
    k.add(role, vessel([[r * 0.9, 0], [r * 1.04, h]], { seg, wall: 0.007, floor: 0.01 }));
    if (o.handle !== false) k.add(role, free(torus(h * 0.2, 0.006, 6, 4, Math.PI)), { x: r * 0.98, y: h * 0.52, rz: -Math.PI / 2, s: [1, 1.12, 1] });
  });
}
/** A tumbler (opaque pale glass by default). */
export function tumbler(k: Kit, at: Xf, o: { role?: string; h?: number; r?: number } = {}): void {
  const r = o.r ?? 0.037, h = o.h ?? 0.12;
  k.with(at, () => k.add(o.role || 'glass', vessel([[r * 0.82, 0], [r, h]], { seg: 14, wall: 0.006, floor: 0.012 })));
}

// ---- plates and bowls ----------------------------------------------------------------------------------------------------------------
/** A dinner plate: foot, sloped rim with a 6+ mm lip, a shallow well. 0.268 m by default. */
export function plate(k: Kit, at: Xf, o: { role?: string; r?: number; h?: number; seg?: number } = {}): void {
  const r = o.r ?? 0.134, h = Math.max(o.h ?? 0.022, MIN_PART * 2.2), seg = o.seg ?? 20;
  const prof: PP[] = [[0, 0], [r * 0.58, 0, H], [r, h * 0.62, H], [r, h, H], [r * 0.66, h * 0.56, H], [0, h * 0.56]];
  k.with(at, () => k.add(o.role || 'ceramic', lathe(prof, seg, h * 0.38)));
}
/** A stack of n plates of one size, one lathe: each plate adds a foot, a sloped rim and a 6 mm lip. */
export function plateStack(k: Kit, at: Xf, o: { role?: string; r?: number; n?: number; pitch?: number; seg?: number } = {}): void {
  const r = o.r ?? 0.134, n = Math.max(1, Math.min(6, o.n ?? 3)), pitch = o.pitch ?? 0.016, lip = MIN_PART, seg = o.seg ?? 18;
  const prof: PP[] = [[0, 0], [r * 0.6, 0, H]];
  for (let i = 0; i < n; i++) {
    const y = i * pitch;
    if (i > 0) prof.push([r * 0.6, y, H]);
    prof.push([r, y + pitch * 0.9, H], [r, y + pitch * 0.9 + lip, H]);
    if (i === n - 1) prof.push([r * 0.64, y + pitch * 0.9 + lip * 0.6, H], [0, y + pitch * 0.9 + lip * 0.6]);
    else prof.push([r * 0.66, y + pitch * 0.9 + lip * 0.4, H]);
  }
  k.with(at, () => k.add(o.role || 'ceramic', lathe(prof, seg, lip)));
}
/** A bowl: curved wall, a foot, a flat lip. */
export function bowl(k: Kit, at: Xf, o: { role?: string; r?: number; h?: number; wall?: number } = {}): void {
  const r = o.r ?? 0.09, h = o.h ?? 0.05;
  k.with(at, () => k.add(o.role || 'ceramic', vessel([[r * 0.45, 0], [r * 0.82, h * 0.42], [r, h]], { seg: segFor(r) >= 22 ? 18 : 14, wall: o.wall ?? 0.007, floor: 0.008 })));
}

// ---- cookware ------------------------------------------------------------------------------------------------------------------------
/** A stovetop kettle: a bulged steel body, a domed lid with a knob, a short tapered spout and a bail handle. Spout on +x. */
export function kettle(k: Kit, at: Xf, o: { role?: string; grip?: string; s?: number } = {}): void {
  const body = o.role || 'metal', grip = o.grip || 'rubber';
  k.with(at, () => {
    k.with({ s: o.s ?? 1 }, () => {
      k.add(body, lathe([[0, 0], [0.085, 0, H], [0.097, 0.022], [0.098, 0.085], [0.078, 0.122, H], [0.05, 0.13, H], [0.03, 0.153], [0, 0.16]], 18, MIN_PART));
      k.add(body, free(cylinder(0.019, 0.011, 0.082, 8)), { x: 0.09, y: 0.035, rz: -1.0 });                               // the spout, reaching up and out
      k.add(grip, cylinder(0.013, 0.011, 0.02, 8), { y: 0.15 });                                                    // the lid knob
      k.add(grip, free(torus(0.078, 0.0065, 8, 4, Math.PI)), { y: 0.128, ry: Math.PI / 2 });                              // the bail, over the top
    });
  });
}
/** A lidded pot (saucepan or stock pot): straight wall, a lid with a rim and a low dome, two side handles. */
export function pot(k: Kit, at: Xf, o: { role?: string; grip?: string; r?: number; h?: number } = {}): void {
  const r = o.r ?? 0.1, h = o.h ?? 0.12, body = o.role || 'metal', grip = o.grip || 'rubber', seg = segFor(r);
  k.with(at, () => {
    k.add(body, lathe([[0, 0], [r, 0, H], [r, h, H], [r * 1.04, h + 0.008, H], [r * 0.72, h + 0.024], [0, h + 0.03]], seg, MIN_PART));
    k.add(grip, cylinder(0.012, 0.01, 0.022, 8), { y: h + 0.028 });                                              // the lid knob
    k.add(grip, box(0.05, 0.016, 0.022), { x: r + 0.025, y: h * 0.78 }); k.add(grip, box(0.05, 0.016, 0.022), { x: -r - 0.025, y: h * 0.78 });
  });
}

// ---- candles and holders -----------------------------------------------------------------------------------------------------------------
/** A candle: a pillar (wide and short) or a taper (slim and tall, 22 mm). No flame and no wick: both are under 6 mm and a flame needs a light. */
export function candle(k: Kit, at: Xf, o: { role?: string; r?: number; h?: number } = {}): void {
  const r = o.r ?? 0.034, h = o.h ?? 0.12;
  k.with(at, () => k.add(o.role || 'wax', cylinder(r, r * 0.97, h, r >= 0.03 ? 14 : 10)));
}
/** A candlestick: a weighted foot, a stem and a cup, in the house metal (or any role). */
export function candlestick(k: Kit, at: Xf, o: { role?: string; h?: number } = {}): void {
  const h = o.h ?? 0.085;
  k.with(at, () => k.add(o.role || 'metal', free(lathe([[0, 0], [0.03, 0, H], [0.03, 0.007, H], [0.012, 0.014], [0.0105, h * 0.62], [0.017, h * 0.72], [0.017, h, H], [0.011, h, H], [0.011, h - 0.012, H], [0, h - 0.012]], 10, 0.021))));
}

// ---- vessels --------------------------------------------------------------------------------------------------------------------------
export type VaseKind = 'bottle' | 'round' | 'column' | 'bud';
const VASES: Record<VaseKind, { outer: PP[]; depth: number; seg: number }> = {
  bottle: { outer: [[0.034, 0], [0.056, 0.07], [0.045, 0.16], [0.02, 0.225], [0.024, 0.245]], depth: 0.04, seg: 16 },
  round: { outer: [[0.04, 0], [0.07, 0.05], [0.07, 0.1], [0.03, 0.17], [0.036, 0.185]], depth: 0.04, seg: 18 },
  column: { outer: [[0.04, 0], [0.043, 0.28]], depth: 0.05, seg: 16 },
  bud: { outer: [[0.022, 0], [0.034, 0.045], [0.014, 0.1], [0.018, 0.115]], depth: 0.03, seg: 12 },
};
/** A flowerless vase (cut flowers are the soft stream's). Heights scale with `s`. */
export function vase(k: Kit, at: Xf, o: { role?: string; kind?: VaseKind; s?: number } = {}): void {
  const v = VASES[o.kind || 'bottle'], sc = o.s ?? 1;
  // the PROFILE is scaled, not the vessel: a scaled wall would fall under the 6 mm floor
  k.with(at, () => k.add(o.role || 'ceramic', vessel(v.outer.map(q => [q[0] * sc, q[1] * sc] as PP), { seg: v.seg, wall: 0.007, floor: 0.012, depth: v.depth })));
}
/** A water carafe: a flared glass body and a narrow neck, opaque pale glass. */
export function carafe(k: Kit, at: Xf, o: { role?: string; s?: number } = {}): void {
  const sc = o.s ?? 1, prof: PP[] = [[0.04, 0], [0.056, 0.05], [0.05, 0.12], [0.026, 0.19], [0.03, 0.225]];
  k.with(at, () => k.add(o.role || 'glass', vessel(prof.map(q => [q[0] * sc, q[1] * sc] as PP), { seg: 16, wall: 0.006, floor: 0.014, depth: 0.04 })));
}
/** A bottle (oil, vinegar, perfume): a solid opaque body and a short neck, with an optional cap in another role. */
export function bottle(k: Kit, at: Xf, o: { role?: string; cap?: string; h?: number; r?: number } = {}): void {
  const r = o.r ?? 0.032, h = o.h ?? 0.2, neck = Math.max(r * 0.38, 0.011), cap = o.cap || 'metal';
  k.with(at, () => {
    k.add(o.role || 'smoke', lathe([[0, 0], [r * 0.94, 0, H], [r, 0.012], [r, h * 0.56, H], [neck, h * 0.78], [neck, h * 0.9, H], [0, h * 0.9]], segFor(r), MIN_PART));
    k.add(cap, cylinder(neck * 1.15, neck * 1.15, h * 0.12, 10), { y: h * 0.9 });
  });
}
/** A soap dispenser: a squat opaque bottle, a collar, a pump stem and a nozzle. */
export function soapDispenser(k: Kit, at: Xf, o: { role?: string; pump?: string; h?: number } = {}): void {
  const body = o.role || 'ceramic', pump = o.pump || 'metal', h = o.h ?? 0.115;
  k.with(at, () => {
    k.add(body, lathe([[0, 0], [0.032, 0, H], [0.036, 0.012], [0.036, h * 0.7, H], [0.016, h * 0.94], [0.014, h, H], [0, h]], 14, MIN_PART));
    k.add(pump, free(cylinder(0.0075, 0.0075, 0.04, 8)), { y: h });                                             // the pump stem
    k.add(pump, free(box(0.052, MIN_FREE, 0.016)), { x: 0.014, y: h + 0.04 });                                   // the nozzle, reaching out +x
  });
}

/** A round lump (a fruit, a pebble, a ball): a lathe sphere, squashed by `sy`. */
export function lump(k: Kit, at: Xf, o: { role?: string; r?: number; sy?: number } = {}): void {
  const r = o.r ?? 0.035;
  k.with(at, () => k.add(o.role || 'accent', lathe([[0, 0], [r * 0.7, r * 0.3 * (o.sy ?? 1)], [r, r * (o.sy ?? 1)], [r * 0.7, r * 1.7 * (o.sy ?? 1)], [0, r * 2 * (o.sy ?? 1)]], 10, r * 2)));
}

// ---- trays, boards, books, cutlery ---------------------------------------------------------------------------------------------------
/** A rounded-rectangle tray with a 8 mm rim. */
export function tray(k: Kit, at: Xf, o: { role?: string; w?: number; d?: number; rim?: number } = {}): void {
  k.with(at, () => k.add(o.role || 'wood', trayShell(o.w ?? 0.4, o.d ?? 0.28, o.rim ?? 0.022, { wall: 0.008, floor: 0.008, cr: 0.035, seg: 3 })));
}
/** A chopping board: a rounded slab. */
export function board(k: Kit, at: Xf, o: { role?: string; w?: number; d?: number; h?: number } = {}): void {
  k.with(at, () => k.add(o.role || 'wood', roundedBox(o.w ?? 0.345, Math.max(o.h ?? 0.024, MIN_PART), o.d ?? 0.215, 0.01, 1)));
}
/** One book: top and bottom boards, a spine, and a paper block set back 4 mm from the cover edge. `at.x/z` is its centre; it sits on `at.y`. */
export function book(k: Kit, at: Xf, o: { cover?: string; paper?: string; w?: number; h?: number; d?: number } = {}): void {
  const w = o.w ?? 0.15, h = Math.max(o.h ?? 0.03, MIN_PART * 3), d = o.d ?? 0.215, b = MIN_PART, cover = o.cover || 'fabric2', paper = o.paper || 'paper';
  k.with(at, () => {
    k.add(cover, box(w, b, d), { y: 0 }); k.add(cover, box(w, b, d), { y: h - b });
    k.add(cover, box(b, h - 2 * b + 0.0002, d), { x: -w / 2 + b / 2, y: b - 0.0001 });                              // the spine
    k.add(paper, box(w - b - 0.004, h - 2 * b + 0.0002, d - 0.008), { x: (b - 0.004) / 2, y: b - 0.0001 });   // the paper block, set back from the fore-edge and the head and tail
  });
}
/** Books by the size list, stacked (each a little turned) or leaning. `sizes` are [w, h, d]; `turns` are radians per book. */
export function bookStack(k: Kit, at: Xf, o: { covers: string[]; sizes: Array<[number, number, number]>; turns: number[]; paper?: string }): void {
  let y = 0;
  k.with(at, () => o.sizes.forEach((s, i) => { book(k, { y, ry: o.turns[i] || 0, x: (i % 2 ? 0.004 : -0.003) }, { cover: o.covers[i % o.covers.length], w: s[0], h: s[1], d: s[2], paper: o.paper }); y += s[1]; }));
}
/** A place's cutlery laid parallel to +z: fork at -x, knife and spoon at +x, all MIN_FREE (10 mm) slabs: a real fork is 3 mm thick, but a 3-6 mm
 *  piece lying on a table is a faint smear from 3.5 m at the 1.5 m eye (G-READ), and at 10 mm it is a clear line to 4.5 m. */
export function cutlery(k: Kit, at: Xf, o: { role?: string; gap?: number } = {}): void {
  const role = o.role || 'steel', t = MIN_FREE, g = o.gap ?? 0.17;
  k.with(at, () => {
    k.add(role, free(box(0.024, t, 0.19)), { x: -g });                                                            // fork
    k.add(role, free(box(0.018, t, 0.2)), { x: g });                                                              // knife
    k.add(role, free(box(0.014, t, 0.1)), { x: g + 0.03, z: 0.045 });                                            // spoon handle...
    k.add(role, free(cylinder(0.02, 0.02, t, 10)), { x: g + 0.03, z: -0.04 });                                 // ...and bowl
  });
}
/** A folded napkin: a slab. */
export function napkin(k: Kit, at: Xf, o: { role?: string; w?: number; d?: number } = {}): void {
  k.with(at, () => k.add(o.role || 'ceramic', roundedBox(o.w ?? 0.11, 0.012, o.d ?? 0.07, 0.004, 1)));
}
/** A canister with a lid: a cylinder and a lid in another role. */
export function canister(k: Kit, at: Xf, o: { role?: string; lid?: string; r?: number; h?: number } = {}): void {
  const r = o.r ?? 0.055, h = o.h ?? 0.18, seg = segFor(r) >= 22 ? 16 : 14;
  k.with(at, () => { k.add(o.role || 'ceramic', cylinder(r, r, h, seg)); k.add(o.lid || 'wood', cylinder(r * 1.04, r * 1.04, 0.022, seg), { y: h }); });
}
/** A picture frame leaning back a little: a wood frame and a paper panel set 2 mm proud of it, pivoting on the bottom of its back face. */
export function frame(k: Kit, at: Xf, o: { role?: string; w?: number; h?: number; paper?: string } = {}): void {
  const w = o.w ?? 0.15, h = o.h ?? 0.2, t = 0.02;
  k.with(at, () => k.with({ rx: -0.1 }, () => { k.add(o.role || 'wood', box(w, h, t), { z: t / 2 }); k.add(o.paper || 'paper', box(w - 0.036, h - 0.036, t + 0.002), { y: 0.018, z: t / 2 + 0.001 }); }));   // pivot at the bottom of the back face: nothing dips under the host
}

// ---- wave 1 pieces: kitchen, bedroom, bath, hall ---------------------------------------------------------------------------------------
/** A wooden spoon or spatula: a round handle (free: 16 mm) and a flat oval head, standing on its handle end at the origin (lean it with `at.rz`). */
export function spoon(k: Kit, at: Xf, o: { role?: string; len?: number; head?: string } = {}): void {
  const len = o.len ?? 0.24;
  k.with(at, () => {
    k.add(o.role || 'wood', free(cylinder(0.008, 0.007, len, 8)));
    k.add(o.head || o.role || 'wood', free(cylinder(0.026, 0.026, MIN_FREE, 10)), { y: len + 0.02, rx: Math.PI / 2, s: [1, 1, 1.4] });   // the head, a flat oval facing the front
  });
}
/** A crock: a straight ceramic pot with a short collar inside (the utensils hide the rest). */
export function crock(k: Kit, at: Xf, o: { role?: string; r?: number; h?: number } = {}): void {
  const r = o.r ?? 0.06, h = o.h ?? 0.14;
  k.with(at, () => k.add(o.role || 'ceramic', vessel([[r * 0.88, 0], [r, h]], { seg: 16, wall: 0.008, floor: 0.012, depth: 0.04 })));
}
/** A folded cloth: n stacked slabs, each a little turned and shifted (the stand-in for the soft stream's towels until they land). */
export function foldedCloth(k: Kit, at: Xf, o: { roles: string[]; w?: number; d?: number; layers?: number; turns?: number[] } = { roles: ['linen'] }): void {
  const w = o.w ?? 0.3, d = o.d ?? 0.2, n = o.layers ?? 2, t = 0.016;
  k.with(at, () => { for (let i = 0; i < n; i++) k.add(o.roles[i % o.roles.length], roundedBox(w - i * 0.012, t, d - i * 0.008, 0.005, 1), { y: i * t * 0.94, ry: (o.turns ? o.turns[i] : 0) || 0, x: i * 0.004 }); });
}
/** A shoe: a rubber sole with a heel block and a domed upper tilted toe-down (the heel stands higher), toe toward +z. */
export function shoe(k: Kit, at: Xf, o: { upper?: string; sole?: string; shade?: number } = {}): void {
  const upper = o.upper || 'leather', sole = o.sole || 'rubber';
  k.with(at, () => {
    k.add(sole, cylinder(0.046, 0.046, 0.016, 10), { s: [1, 1, 2.93] });                                            // an elliptical sole, 0.092 x 0.27
    k.add(sole, box(0.066, 0.014, 0.06), { y: 0.016, z: -0.092 });                                                 // the heel block
    k.add(upper, lathe([[0, 0], [0.046 * 0.7, 0.085 * 0.3], [0.046, 0.085 * 0.6], [0.046 * 0.7, 0.085 * 0.9], [0, 0.085]], 8, 0.085), { y: 0.022, z: 0.0, rx: -0.14, s: [1, 1, 2.35] }, o.shade ?? 1);
  });
}
/** A slipper: a cork sole and a low fabric toe-cap, toe toward +z. */
export function slipper(k: Kit, at: Xf, o: { upper?: string; sole?: string } = {}): void {
  k.with(at, () => {
    k.add(o.sole || 'cork', cylinder(0.046, 0.046, 0.014, 12), { s: [1, 1, 2.87] });                              // an elliptical sole, 0.092 x 0.265
    k.add(o.upper || 'fabric', lathe([[0, 0], [0.044 * 0.8, 0.07 * 0.3], [0.044, 0.07 * 0.65], [0.044 * 0.5, 0.07 * 0.95], [0, 0.07]], 10, 0.07), { y: 0.014, z: 0.05, s: [1.04, 1, 2.0] });
  });
}
/** A furled umbrella standing on its canopy end at the origin: canopy, shaft and a hooked handle on +x... (the stand it stands in is the caller's). */
export function umbrella(k: Kit, at: Xf, o: { role?: string; handle?: string } = {}): void {
  const R = 0.03;
  k.with(at, () => {
    k.add(o.role || 'fabric', cylinder(0.03, 0.017, 0.34, 8), { x: R });
    k.add(o.handle || 'wood', free(cylinder(0.008, 0.008, 0.26, 6)), { x: R, y: 0.34 });
    k.add(o.handle || 'wood', free(torus(R, 0.007, 8, 5, Math.PI)), { y: 0.6 });
  });
}
/** A mat: a pile slab with an inner panel in a second role. */
export function mat(k: Kit, at: Xf, o: { role?: string; inner?: string; w?: number; d?: number } = {}): void {
  const w = o.w ?? 0.75, d = o.d ?? 0.45;
  k.with(at, () => { k.add(o.role || 'rug', roundedBox(w, 0.016, d, 0.006, 1)); k.add(o.inner || 'fabric2', roundedBox(w - 0.1, 0.018, d - 0.1, 0.005, 1)); });
}
/** A tissue box: a pale box with a tuft of tissue standing out of its slot. */
export function tissueBox(k: Kit, at: Xf, o: { role?: string } = {}): void {
  const role = o.role || 'paper';
  k.with(at, () => { k.add(role, roundedBox(0.24, 0.085, 0.12, 0.012, 1)); k.add(role, lathe([[0, 0], [0.022, 0.012], [0.03, 0.034], [0.016, 0.052], [0, 0.058]], 8, 0.058), { y: 0.082, s: [2.4, 1, 0.7] }); });
}
