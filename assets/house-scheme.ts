// House scheme v0 — the one place a house's STYLE becomes finish decisions (plan 5.2 F0, light-and-finish 4.6).
//
// `StyleBundle` (house-styles.ts) has always said what metal, floors and walls a style wants, and nothing read it: every home had the
// same black hardware, the same warm-white light, the same flat ceiling. schemeOf(spec) reads it once and answers, for the whole house
// (never per room: 18 of 30 homes mix room styles, and one metal, one light colour and one trim per house is what makes it a scheme):
//
//   metal     the kind of every interior metal (finish-roles.ts METAL_KINDS): black, brass, chrome, bronze, steel. Architecture metal
//             (window frames, rails) stays black.
//   lampK     the colour temperature of the house's lamps in kelvin, and lampColor, that temperature as the sRGB hex a light uses
//   floors    the floor kinds that suit the style (a candidate list: room-finish.ts intersects it with the program's own, F2)
//   walls     the wall treatments that suit it
//   ceiling   the ceiling kind a room with none authored takes, by room kind (existing kinds only, room-finish.ts)
//   trim      crown height in metres, a picture rail, a shadow-gap reveal, a cove strip
//   tile      the bath and kitchen tile: format and bond
//
// Pure and THREE-free (Node tests read it), no randomness, no clock: a function of the spec's style alone. Consumers land in the
// order of the plan: L3 reads lampK, F1 the metal, F2 floors, walls and ceilings, F3 trim, F4 tile. `kit.scheme` (kit-build.ts houseKit)
// carries it into the build. IDENT extends it with the identity fields (wood, fabric, accent ...) after F2; until then LIGHT owns it.
import { styleOf } from './house-styles.js';
import { metalKindOf, type MetalKindName } from './props/finish-roles.js';

export type CeilingKind = 'flat' | 'timber' | 'beams' | 'tray';
export interface HouseScheme {
  /** the style key it was read from */
  style: string;
  metal: MetalKindName;
  lampK: 2700 | 3000 | 3500;
  /** the sRGB hex of a lamp of that temperature */
  lampColor: number;
  floors: string[];
  walls: string[];
  /** by room kind (fixtures.ts roomKind); `default` for every other kind */
  ceiling: { default: CeilingKind } & Partial<Record<'living' | 'dining' | 'kitchen' | 'bed', CeilingKind>>;
  trim: { crown: number; rail: boolean; reveal: boolean; cove: boolean };
  tile: { format: 'square' | 'subway' | 'zellige' | 'penny' | 'stack'; bond: 'grid' | 'running' | 'stack' };
}

/** lamp temperature as the colour a light takes: 3000 K is today's WARM (0xffd7a8), so modern, mid-century and tropical homes keep the light they have */
export const LAMP_COLORS: Record<HouseScheme['lampK'], number> = { 2700: 0xffcb94, 3000: 0xffd7a8, 3500: 0xffe2bd };

interface Row { lampK: HouseScheme['lampK']; ceiling: HouseScheme['ceiling']; trim: HouseScheme['trim']; tile: HouseScheme['tile'] }
// the table of the design's 4.6: what the style adds beyond the bundle's own metal, floor and wall lists
const ROWS: Record<string, Row> = {
  modern: { lampK: 3000, ceiling: { default: 'flat' }, trim: { crown: 0, rail: false, reveal: true, cove: true }, tile: { format: 'square', bond: 'grid' } },
  cottage: { lampK: 2700, ceiling: { default: 'flat' }, trim: { crown: 0.13, rail: true, reveal: false, cove: false }, tile: { format: 'subway', bond: 'running' } },
  'mid-century': { lampK: 3000, ceiling: { default: 'flat', living: 'timber' }, trim: { crown: 0.04, rail: false, reveal: false, cove: true }, tile: { format: 'square', bond: 'grid' } },
  craftsman: { lampK: 2700, ceiling: { default: 'flat', dining: 'beams', living: 'tray' }, trim: { crown: 0.08, rail: true, reveal: false, cove: false }, tile: { format: 'subway', bond: 'stack' } },
  farmhouse: { lampK: 2700, ceiling: { default: 'flat', living: 'timber', kitchen: 'timber' }, trim: { crown: 0.1, rail: false, reveal: false, cove: false }, tile: { format: 'subway', bond: 'running' } },
  mediterranean: { lampK: 2700, ceiling: { default: 'flat', living: 'beams', dining: 'beams' }, trim: { crown: 0, rail: false, reveal: false, cove: false }, tile: { format: 'zellige', bond: 'grid' } },
  tropical: { lampK: 3000, ceiling: { default: 'flat', living: 'timber' }, trim: { crown: 0, rail: false, reveal: false, cove: false }, tile: { format: 'penny', bond: 'grid' } },
  industrial: { lampK: 3500, ceiling: { default: 'flat' }, trim: { crown: 0, rail: false, reveal: false, cove: false }, tile: { format: 'stack', bond: 'stack' } },
  scandi: { lampK: 3500, ceiling: { default: 'flat', bed: 'timber' }, trim: { crown: 0, rail: false, reveal: false, cove: false }, tile: { format: 'subway', bond: 'running' } },
};

/** the scheme of a house: its style (rooms[].style is a room's own, never the house's: the house's is spec.styleKey, else read off its text) */
export function schemeOf(spec: any): HouseScheme {
  const style = styleOf(spec);   // no room: the house's style
  const row = ROWS[style.key] || ROWS.modern;
  return {
    style: style.key,
    metal: metalKindOf(style.metal),
    lampK: row.lampK,
    lampColor: LAMP_COLORS[row.lampK],
    floors: [...style.finish.floor],
    walls: [...style.finish.wall],
    ceiling: { ...row.ceiling },
    trim: { ...row.trim },
    tile: { ...row.tile },
  };
}
export const SCHEME_STYLES = Object.keys(ROWS);
