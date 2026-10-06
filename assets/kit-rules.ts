// The kit's rules as pure functions — no THREE, no DOM, no clock — so the builder (kit-build.ts, fixtures.ts,
// environment.ts), the validator (scripts/validate/kit.mts), the fleet audit (scripts/fleet/kit.mts) and the Node
// test (scripts/test-kit.mts) all ask ONE place how a spec's palette, doors, light and fixtures come out.
//
//   kitPalette(spec)             the palette as the house is built: restraint (palette.restraint 0..1; default 1 =
//                                today's clamp under defaults 1, D2_RESTRAINT under defaults 2), palette.keep
//                                exempting named roles
//   levelWall(spec, lv)          one storey's cladding colour and kind (levels[].material / wallColor), or null
//                                when the storey wears the house's own cladding
//   doorColour(spec, role, ctx)  a hinged leaf's colour: the opening's own, palette.door, or (defaults 2) derived
//                                from trim or timber by style — never teal
//   lightingOf(spec)             { preset, alias, sunBearing, swing, look } — the preset, where the sun stands, and
//                                the look generation (defaults 2: the seeded swing and the true-white look)
//   fanPlan(spec) / lampPlan     which rooms get a ceiling fan (defaults 2: a seeded minority of the rooms one can
//                                hang in) and which lamp head each room's lamps take (the registry's floor, arc,
//                                tripod and table lamps, and the halo lamp)
//   programKind(program)         S3's rooms[].program → the fixtures' room kind (plan Completeness C2)
// Owner: S1 (kit). Everything is seeded with mulberry32(fnv1a(`${spec.id}:<purpose>`)).
import { mulberry32, fnv1a, restrainPalette, colourMath } from './materials.js';
import { specDefaults } from './spec/index.js';
import { LIGHTING_ALIASES, TIME_OF_DAY } from './environment.js';

const { hex, css, lum, mix, restrain } = colourMath;

// ---- palette ------------------------------------------------------------------------------------------------
/** the roles palette.keep may name ('interior' too: the inside paint is restrained like the wall) */
export const KEEP_ROLES = ['wall', 'trim', 'accent', 'roof', 'door', 'interior'] as const;
export type KeepRole = typeof KEEP_ROLES[number];
/** the palette every house starts from (house-builder.ts's defaults before S1) */
export const BASE_PALETTE = { wall: '#f8fafc', trim: '#1e293b', roof: '#3f2a1d', accent: '#0f766e' };

export const keepSet = (spec: any): Set<string> => new Set(Array.isArray(spec && spec.palette && spec.palette.keep) ? spec.palette.keep : []);
/** how much of restrainPalette's clamp a house without palette.restraint gets under defaults 2 (defaults 1: all of it) */
export const D2_RESTRAINT = 0.4;
/** palette.restraint clamped to 0..1; default 1 (today's restraint exactly) under defaults 1, D2_RESTRAINT under defaults 2 —
 *  a cobalt wall keeps most of its saturation without a `keep` line, and a neon one is still tamed */
export const restraintOf = (spec: any): number => {
  const r = spec && spec.palette && spec.palette.restraint;
  return typeof r === 'number' && Number.isFinite(r) ? Math.max(0, Math.min(1, r)) : specDefaults(spec) >= 2 ? D2_RESTRAINT : 1;
};

// a colour between its authored value (restraint 0) and today's restrained one (restraint 1); integer channels
const toward = (orig: string, restrained: string, r: number): string => r >= 1 ? restrained : r <= 0 ? css(hex(orig)) : css(mix(hex(orig), hex(restrained), r));

/**
 * The palette as the house is built. With no palette.restraint / palette.keep this is exactly
 * restrainPalette({ ...BASE_PALETTE, ...spec.palette }) — today's palette, byte for byte.
 */
export function kitPalette(spec: any): any {
  const authored = { ...BASE_PALETTE, ...((spec && spec.palette) || {}) };
  const restrained = restrainPalette(authored);
  const keep = keepSet(spec), r = restraintOf(spec);
  if (!keep.size && r >= 1) return restrained;
  const out: any = { ...restrained };
  for (const role of ['wall', 'roof', 'interior'] as const) {
    if (authored[role] === undefined) continue;
    out[role] = keep.has(role) ? css(hex(authored[role])) : toward(authored[role], restrained[role], r);
  }
  return out;
}

/** today's restraint of a wall colour, for a cladding kind (materials.ts restrainPalette's wall rule) */
export const restrainWall = (c: string, kind?: string): string => css(kind === 'brick' ? restrain(c, 0.3, 0.35) : restrain(c, 0.18, 0.2));

/**
 * One storey's own cladding: { kind, color } when the storey asks for its own (levels[].material, or under
 * defaults 2 a levels[].wallColor), else null — it wears the house's cladding (kit.cladding()). wallColor alone
 * without defaults 2 keeps today's meaning (the storey's stucco band, eaves and default interior, not its cladding).
 */
export function levelWall(spec: any, lv: any, palette: any = kitPalette(spec)): { kind: string; color: string } | null {
  if (!lv) return null;
  const own = !!lv.material || (specDefaults(spec) >= 2 && !!lv.wallColor);
  if (!own) return null;
  const kind = lv.material || (spec.palette && spec.palette.material) || 'stucco';
  const keep = keepSet(spec), r = restraintOf(spec);
  const c = lv.wallColor ? (keep.has('wall') ? css(hex(lv.wallColor)) : toward(lv.wallColor, restrainWall(lv.wallColor, kind), r)) : palette.wall;
  return { kind, color: c };
}

// ---- doors ---------------------------------------------------------------------------------------------------
/** today's leaf (room-creator.html createParametricWall: a hinged leaf without a colour is teal) */
export const LEGACY_LEAF = '#0f766e';
const TRADITIONAL = /cottage|farm|craftsman|colonial|traditional|rustic|cabin|tudor|victorian|country|bungalow|barn|chalet|mediterranean|spanish|georgian|storybook|lake/i;

/**
 * The door family's timber-or-trim rule (plan S1 "palette.door … derived from trim or timber by style"):
 *   'trim'    a modern house with a dark trim: the leaf is the trim (one dark line round the openings)
 *   'timber'  a traditional house, a masonry or timber house, or a light trim: a wood leaf (the kit's seeded wood)
 */
export function doorStyleOf(spec: any, palette: any = kitPalette(spec)): 'trim' | 'timber' {
  const trim = hex(palette.trim || BASE_PALETTE.trim), mat = spec && spec.palette && spec.palette.material;
  if (TRADITIONAL.test(String((spec && spec.style) || ''))) return 'timber';
  if (mat === 'brick' || mat === 'stone' || mat === 'timber') return 'timber';
  return lum(trim) < 0.35 ? 'trim' : 'timber';
}

/**
 * A hinged leaf's colour, '#rrggbb', or undefined for the page's own default (teal: defaults 1 only).
 *   role 'entry' | 'exterior'   a door in a perimeter wall; 'interior' a partition door
 *   own                          the opening's `color` / the partition's `doorColor` (always wins)
 *   wood                         the kit's seeded wood role (0xRRGGBB), for the timber rule
 */
export function doorColour(spec: any, role: 'entry' | 'exterior' | 'interior', { own, wood, palette = kitPalette(spec) }: { own?: string; wood?: number; palette?: any } = {}): string | undefined {
  if (own) return css(hex(own));
  const door = spec && spec.palette && spec.palette.door;
  if (door && role !== 'interior') return css(hex(door));
  if (specDefaults(spec) < 2) return undefined;   // today's teal
  const style = doorStyleOf(spec, palette);
  // a timber leaf never reads black: the seeded wood role is lifted to luma 0.18 at least
  const timber = (w: number) => { let c = w; for (let k = 0; k < 8 && lum(c) < 0.18; k++) c = mix(c, 0xb08a64, 0.25); return css(c); };
  const woodC = typeof wood === 'number' ? wood : 0x7d6147;
  if (role === 'interior') {
    // inside, a painted house hangs painted leaves (the casing white); a timber house its wood
    return style === 'timber' ? timber(woodC) : css(mix(hex(palette.interior || palette.wall || BASE_PALETTE.wall), 0xffffff, 0.5));
  }
  if (door) return css(hex(door));
  return style === 'trim' ? css(hex(palette.trim || BASE_PALETTE.trim)) : timber(woodC);
}

/** the leaf kind a door gets: the opening's `leaf`; under defaults 2 a 1.2–1.8 m door gets a pair; else single
 *  up to 1.1 m and none (a cased opening) above — today's rule */
export function leafKindOf(spec: any, op: any): 'single' | 'double' | 'french' | 'glazed' | 'none' {
  if (op && op.leaf) return op.leaf;
  const w = (op && op.w) || 0.9;
  if (w <= 1.1) return 'single';
  if (specDefaults(spec) >= 2 && w <= 1.8) return 'double';
  return 'none';
}

// ---- lighting (plan Completeness A1) ------------------------------------------------------------------------
export const DEFAULT_PRESET = 'day';
/** the preset's name as authored (a string, or lighting.preset) */
export const presetAuthored = (spec: any): string | undefined => { const l = spec && spec.lighting; return typeof l === 'string' ? l : l && typeof l === 'object' ? l.preset : undefined; };
/** is this preset name a legacy alias (pascal-daylight, ci-twilight …) rather than a TIME_OF_DAY key? */
export const isLegacyAlias = (n: any): boolean => typeof n === 'string' && !TIME_OF_DAY[n] && !!LIGHTING_ALIASES[n];
export const presetName = (n: any): string => (typeof n === 'string' && TIME_OF_DAY[n] ? n : (typeof n === 'string' && LIGHTING_ALIASES[n]) || DEFAULT_PRESET);

/**
 * Where the light comes from, for one house:
 *   preset      a TIME_OF_DAY key (aliases resolved)
 *   sunBearing  lighting.sunBearing when authored: the sun's compass bearing in degrees (0 = north, the page's −Z;
 *               90 = east, +X; 180 = south, +Z — the street), else null
 *   swing       degrees round from the entry's facing (environment.ts sunDirection): the preset's own under
 *               defaults 1; under defaults 2 a seeded swing per house, 18–70° either side of the front, so no two
 *               houses whose entries face one way share one sun
 *   look        1 | 2 — 2 is the defaults-2 look (the true-white variant of the preset, environment.ts lookOf)
 */
export function lightingOf(spec: any): { preset: string; alias: string | null; sunBearing: number | null; swing: number; look: 1 | 2 } {
  const authored = presetAuthored(spec), preset = presetName(authored);
  const l = spec && spec.lighting, sb = l && typeof l === 'object' && typeof l.sunBearing === 'number' && Number.isFinite(l.sunBearing) ? ((l.sunBearing % 360) + 360) % 360 : null;
  const d2 = specDefaults(spec) >= 2;
  let swing = TIME_OF_DAY[preset].sun.swing;
  if (d2 && preset !== 'night') {
    const rng = mulberry32(fnv1a(`${(spec && spec.id) || 'house'}:sun`));
    const side = rng() < 0.5 ? -1 : 1, mag = 18 + rng() * 52;
    swing = +(side * mag).toFixed(1);
  }
  return { preset, alias: isLegacyAlias(authored) ? authored : null, sunBearing: sb, swing, look: d2 ? 2 : 1 };
}
/** the compass bearing the sun stands at for a house whose entry faces `front` ([x, z]), given lightingOf's result */
export function sunBearingOf(light: { sunBearing: number | null; swing: number }, front: [number, number] = [0, 1]): number {
  if (light.sunBearing !== null) return light.sunBearing;
  const az = Math.atan2(front[0], front[1]) * 180 / Math.PI + light.swing;   // environment.ts sunDirection's azimuth
  return ((180 - az) % 360 + 360) % 360;
}
/** a compass bearing → the swing sunDirection() takes for an entry facing `front` */
export function swingForBearing(bearing: number, front: [number, number] = [0, 1]): number {
  return (180 - bearing) - Math.atan2(front[0], front[1]) * 180 / Math.PI;
}

// ---- rooms and fixtures (plan Completeness C2, C9) ----------------------------------------------------------
/** S3's programs (assets/spec/compose.ts owns the list) → the fixtures' room kind */
export const PROGRAM_KIND: Record<string, string> = {
  living: 'living', den: 'living', media: 'living', playroom: 'living', sunroom: 'living', bar: 'living',
  kitchen: 'kitchen', 'kitchen-dining': 'kitchen', dining: 'dining',
  'bed-primary': 'bed', 'bed-kid': 'bed', 'bed-guest': 'bed', nursery: 'bed',
  bath: 'bath', ensuite: 'bath', powder: 'bath',
  study: 'work', library: 'work', studio: 'work',
  foyer: 'hall', hall: 'hall',
  laundry: 'service', garage: 'service', gym: 'service', greenhouse: 'service',
  outdoor: 'outdoor',
};
export const programKind = (program: any): string | null => (typeof program === 'string' && PROGRAM_KIND[program]) || null;

export const LAMP_KINDS = ['drum', 'globe', 'cone', 'mushroom', 'tripod'] as const;
export type LampKind = typeof LAMP_KINDS[number];

/** the room the hero stands in (its level's first room whose bounds hold hero.at), or null */
export function heroRoom(spec: any): { lv: any; room: any; ri: number } | null {
  const h = spec && spec.hero; if (!h || !Array.isArray(h.at)) return null;
  const lv = (spec.levels || []).find(l => l.id === h.level); if (!lv) return null;
  const ri = (lv.rooms || []).findIndex(r => r.bounds && h.at[0] >= r.bounds.x - 0.01 && h.at[0] <= r.bounds.x + r.bounds.w + 0.01 && h.at[1] >= r.bounds.z - 0.01 && h.at[1] <= r.bounds.z + r.bounds.d + 0.01);
  return ri < 0 ? null : { lv, room: lv.rooms[ri], ri };
}

// what hangs from a ceiling and keeps a fan off its centre (fixtures.ts HUNG)
const HUNG_ITEMS = new Set(['pendant-lamp', 'chandelier', 'ceiling-light']);
/**
 * Could a fan hang in this room at all, judging by the spec alone? Mirrors fixtures.ts's placement: its centre and
 * four nearby spots along the long axis, each 0.87 m off the walls, at least 1.17 m from anything the room already
 * hangs (`pendant-lamp`, `chandelier`, `ceiling-light` items; fixtures.ceiling 'chandelier') and 0.82 m off a
 * partition. A seeded winner that cannot hang one would spend the room's share of fans on nothing.
 */
export function fanSpot(room: any, lv?: any): boolean {
  const b = room && room.bounds; if (!b) return false;
  const f = room.fixtures || {};
  if (f.ceiling === 'chandelier') return false;
  const hung = (room.items || []).filter(it => HUNG_ITEMS.has(it.type) && Array.isArray(it.at));
  const walls = ((lv && lv.partitions) || []).filter(p => Array.isArray(p.from) && Array.isArray(p.to));
  const R = 0.72, m = R + 0.15, alongX = b.w >= b.d, cx = b.x + b.w / 2, cz = b.z + b.d / 2;
  const segDist = (px: number, pz: number, a: number[], c: number[]) => { const dx = c[0] - a[0], dz = c[1] - a[1], l2 = dx * dx + dz * dz || 1e-9, t = Math.max(0, Math.min(1, ((px - a[0]) * dx + (pz - a[1]) * dz) / l2)); return Math.hypot(px - (a[0] + t * dx), pz - (a[1] + t * dz)); };
  return [0, -0.18, 0.18, -0.3, 0.3].some(k => {
    const x = cx + (alongX ? k * b.w : 0), z = cz + (alongX ? 0 : k * b.d);
    if (!(x > b.x + m && x < b.x + b.w - m && z > b.z + m && z < b.z + b.d - m)) return false;
    if (hung.some(it => Math.hypot(it.at[0] - x, it.at[1] - z) < 0.45 + R)) return false;
    return walls.every(w => segDist(x, z, w.from, w.to) > R + 0.1);
  });
}

/**
 * Which rooms may hang a ceiling fan: key `${lv.id}#${ri}` → true (may) | false (never). A room absent from the
 * map follows the geometry alone (today's rule: fixtures.ts). rooms[].fixtures.fan wins either way. Under defaults 2
 * the eligible rooms (`eligible(room)`: a fan kind, big enough — and a fan can hang there: fanSpot) are cut to a
 * seeded minority, never a kitchen, a bath or the hero's room: a quarter of them, rounded down, and a house with
 * fewer than four such rooms gets ONE with a seeded chance of a quarter of its rooms' worth (n / 4) — so the
 * fleet's share stays a quarter, and no small house is fanless by arithmetic alone. rooms[].fixtures.fan: true is the
 * lever for a fan the photo shows.
 */
export function fanPlan(spec: any, eligible: (room: any) => boolean): Map<string, boolean> {
  const out = new Map<string, boolean>();
  const d2 = specDefaults(spec) >= 2, hr = heroRoom(spec);
  const cands: Array<{ key: string; score: number }> = [];
  (spec.levels || []).forEach(lv => (lv.rooms || []).forEach((room, ri) => {
    const key = `${lv.id}#${ri}`, f = room.fixtures || {};
    if (f.fan === true || f.fan === false) { out.set(key, f.fan); return; }
    if (!d2) return;
    const isHero = !!hr && hr.lv === lv && hr.ri === ri;
    if (isHero || !eligible(room) || !fanSpot(room, lv)) { out.set(key, false); return; }
    cands.push({ key, score: mulberry32(fnv1a(`${spec.id}:fan:${key}`))() });
  }));
  if (d2) {
    const n = cands.length >= 4 ? Math.floor(cands.length * 0.25) : cands.length && mulberry32(fnv1a(`${spec.id}:fans`))() < cands.length * 0.25 ? 1 : 0;
    const keep = new Set(cands.slice().sort((a, b) => a.score - b.score || (a.key < b.key ? -1 : 1)).slice(0, n).map(c => c.key));
    for (const c of cands) out.set(c.key, keep.has(c.key));
  }
  return out;
}

/** the items that are a lamp with a head to vary (fixtures.ts): the catalog's halo lamp, and the registry's lamps */
export const REGISTRY_LAMPS: ReadonlySet<string> = new Set(['floor-lamp', 'arc-floor-lamp', 'tripod-floor-lamp', 'table-lamp']);
export const LAMP_ITEMS: ReadonlySet<string> = new Set(['halo-lamp', ...REGISTRY_LAMPS]);

/**
 * The lamp kind a room's lamps become: rooms[].fixtures.lamp, else under defaults 2 a seeded pick, else null (today's
 * drum). The rooms that HAVE a lamp in their items walk in order through a seeded permutation of the five kinds, so
 * any five rooms with lamps show all five kinds and three rooms three (a room without a lamp does not spend a kind; nor does one whose only lamp is the dress
 * phase's, src 'dress@1': baking dress items into a house must not re-roll the head of a lamp the layout already had, so such a room takes its own seeded pick, as a room with none listed does);
 * a room with none listed (S3's composer will place them) gets its own seeded pick.
 */
export function lampPlan(spec: any): Map<string, LampKind | null> {
  const out = new Map<string, LampKind | null>();
  const d2 = specDefaults(spec) >= 2;
  const id = (spec && spec.id) || 'house';
  const rng = mulberry32(fnv1a(`${id}:lamps`));
  const perm = [...LAMP_KINDS];
  for (let i = perm.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [perm[i], perm[j]] = [perm[j], perm[i]]; }
  let k = 0;
  (spec.levels || []).forEach(lv => (lv.rooms || []).forEach((room, ri) => {
    const key = `${lv.id}#${ri}`, f = room.fixtures || {};
    let kind: LampKind | null = null;
    if (LAMP_KINDS.includes(f.lamp)) kind = f.lamp;
    else if (d2) kind = (room.items || []).some(it => LAMP_ITEMS.has(it.type) && it.src !== 'dress@1') ? perm[k++ % perm.length] : LAMP_KINDS[Math.floor(mulberry32(fnv1a(`${id}:lamps:${key}`))() * LAMP_KINDS.length)];
    out.set(key, kind);
  }));
  return out;
}

// ---- the seeded role colours (materials.ts) under defaults 2 -------------------------------------------------
/** lift a colour until its luma is at least `min` (defaults 2: no accidental black or navy wood and fabric) */
export function liftLuma(c: number, min = 0.12): number {
  let x = c;
  for (let k = 0; k < 12 && lum(x) < min; k++) x = mix(x, 0xffffff, 0.12);
  return x;
}
