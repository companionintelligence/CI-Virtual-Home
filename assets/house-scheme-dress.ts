// A house's dress palette (plan 5.6 D2): one set of choices per HOUSE for the loose layer, so a home's small goods read as one hand and the next home's as
// another (the way the composer's `prefer` does it for lamps and plants). Drawn once per house from a stream of its own, `${spec.id}:dress-scheme`, never from
// the composer's or any prop's: reading it moves nothing.
//
//   glaze     the colour of the house's tableware, painted on the `ceramic` role of the types that take a `color` (plates, canisters, crocks, vanity sets):
//               'white' (the role's own linen-white), 'accent' (the spec's palette accent, pale), 'dark' (the accent pulled to charcoal). G-READ saw white
//               plates vanish on a white top, so a house is white only a quarter of the time
//   tray      the variant a tray vignette favours (0 wood, 1 metal, 2 ceramic), used in three of four trays
//   candle    the variant a candle trio favours (0 pillars, 1 tapers, 2 mixed)
//   curtain   the fabric of the house's café curtains: the house linen drawn a little toward the spec's accent (a pale, warm cloth that reads as cloth against a
//               light wall; the role's own navy or olive read as a dark slab). The draw is the last of the stream, so no earlier choice moves
//   mix(...)  the colour maths, exported for the tests
//
// THREE-free. Owner: DRESS (LIGHT's assets/house-scheme.ts, when it lands, may feed `glaze` from its own palette; this file keeps the dress-only picks).
import { mulberry32, fnv1a } from './materials.js';

export interface DressScheme { glazeKind: 'white' | 'accent' | 'dark'; glaze: string | null; tray: number; candle: number; curtain: string }

const HEX = /^#?([0-9a-fA-F]{6})$/;
const rgb = (h: string): [number, number, number] => { const m = HEX.exec(h); const n = m ? parseInt(m[1], 16) : 0x6d8a74; return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
const hex2 = (v: number) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0');
/** `a` toward `b` by t (0..1), as '#rrggbb' */
export function mix(a: string, b: string, t: number): string { const x = rgb(a), y = rgb(b); return '#' + [0, 1, 2].map(i => hex2(x[i] + (y[i] - x[i]) * t)).join(''); }

const memo = new WeakMap<object, { id: string; accent: string; s: DressScheme }>();
export function dressSchemeOf(spec: any): DressScheme {
  const accent = (spec.palette && spec.palette.accent) || '#6d8a74', id = String(spec.id);
  const hit = memo.get(spec); if (hit && hit.id === id && hit.accent === accent) return hit.s;
  const r = mulberry32(fnv1a(`${id}:dress-scheme`));
  const u = r(), glazeKind: DressScheme['glazeKind'] = u < 0.25 ? 'white' : u < 0.75 ? 'accent' : 'dark';
  const glaze = glazeKind === 'white' ? null : glazeKind === 'accent' ? mix(accent, '#e6e0d4', 0.42) : mix(accent, '#26292d', 0.62);
  const tray = Math.floor(r() * 3), candle = Math.floor(r() * 3), curtain = mix('#efe8d8', accent, 0.12 + 0.16 * r());
  const s: DressScheme = { glazeKind, glaze, tray, candle, curtain };
  memo.set(spec, { id, accent, s });
  return s;
}
