// The unit of an apartment: which storeys and which rooms of an apartment spec are the family's own flat, and which are the block's.
//
// An apartment spec draws the whole BUILDING (reference/APARTMENTS.md, 1 and 2.1): every storey the block has, one rectangle per bay, the neighbours' bays as closed rooms, the
// stair core, the shops and parking of the podium, a roof stair head. `levels.length` is the block's storeys and the plan's rooms are the block's rooms, so a page that counts them
// ("6 storeys, 27 rooms" for a one-bedroom flat) says what the building has, not what the family lives in. `areaSqm` is already the unit's (the recipe sets it).
//
// The specs mark no unit, and adding a field to a baked spec would move the bake's bytes, so the unit is read from what the recipe already guarantees:
//   - the unit's rooms carry a `program` (2.1 step 6); a closed bay is "one authored room, no program, nothing else" (2.1 step 4); the core's room is a `hall`;
//   - so on a storey the unit's own rooms are the programmed rooms that are not halls (the bedrooms, the kitchen, the living room, the balcony ...), a storey with none of them is
//     not the unit's (the podium, the floors above, the roof), and
//   - the unit's halls (an entry hall, a passage, the family's own stair) and its unprogrammed passage lie inside the box those rooms span, whereas the core, the neighbours and the
//     podium's shops lie beside it. A room belongs to the unit when its centre is inside that box.
// scripts/test-apartment-unit.mts pins the result for the six apartments and proves that the neighbours, the core and the podium are out of it.
//
// Only an apartment is read this way. Any other home keeps every storey and every room (`unitOf` returns the whole spec), so nothing a page says of the 30 homes moves.
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');

type Box = { x: number; z: number; w: number; d: number };
export type UnitRoom = { level: string; name: string };
export interface Unit {
  /** the spec's level ids that are the unit's, in order */
  levels: string[];
  /** the unit's rooms as `${level id}/${room name}` */
  rooms: Set<string>;
  /** true when the spec was read as an apartment; false when it is a whole home and everything is "the unit" */
  apartment: boolean;
}

const box = (b: any): Box | null => (b && ['x', 'z', 'w', 'd'].every(k => typeof b[k] === 'number' && Number.isFinite(b[k])) && b.w > 0 && b.d > 0 ? b : null);
/** the box tolerance, metres: a room whose centre is within it of the box is inside it (a balcony hangs off a wall; a room on the box's edge is the unit's) */
const SLACK = 0.05;

/** The ids of the homes that are an apartment: `types.apartment` of the lander plan (content/story/lander.json), the one authored list of what kind of place each home is. */
export function apartmentIds(root: string = ROOT): Set<string> {
  try {
    const plan = JSON.parse(fs.readFileSync(path.join(root, 'content', 'story', 'lander.json'), 'utf8'));
    return new Set<string>(Array.isArray(plan?.types?.apartment) ? plan.types.apartment : []);
  } catch { return new Set(); }
}

/** The unit of a spec read as an apartment (whatever its id): see the header. */
export function readUnit(spec: any): Unit {
  const levels: string[] = [], rooms = new Set<string>();
  for (const [i, l] of (Array.isArray(spec?.levels) ? spec.levels : []).entries()) {
    const id = String(l?.id ?? `l${i + 1}`);
    const here = (Array.isArray(l?.rooms) ? l.rooms : []).map((r: any) => ({ r, b: box(r?.bounds) })).filter((x: any) => x.b && x.r?.name);
    // the family's own rooms: programmed, not a hall (the core's room is a hall, and a hall on its own is not a flat)
    const living = here.filter((x: any) => x.r.program && x.r.program !== 'hall');
    if (!living.length) continue;
    const x0 = Math.min(...living.map((x: any) => x.b.x)), z0 = Math.min(...living.map((x: any) => x.b.z));
    const x1 = Math.max(...living.map((x: any) => x.b.x + x.b.w)), z1 = Math.max(...living.map((x: any) => x.b.z + x.b.d));
    levels.push(id);
    for (const x of here) {
      const cx = x.b.x + x.b.w / 2, cz = x.b.z + x.b.d / 2;
      if (cx >= x0 - SLACK && cx <= x1 + SLACK && cz >= z0 - SLACK && cz <= z1 + SLACK) rooms.add(`${id}/${x.r.name}`);
    }
  }
  return { levels, rooms, apartment: true };
}

/** The unit of a home: an apartment's own storeys and rooms, or, for any other home, all of them. */
export function unitOf(spec: any, apartments: ReadonlySet<string> = apartmentIds()): Unit {
  if (!apartments.has(String(spec?.id))) {
    const levels = (Array.isArray(spec?.levels) ? spec.levels : []).map((l: any, i: number) => String(l?.id ?? `l${i + 1}`));
    const rooms = new Set<string>();
    for (const [i, l] of (Array.isArray(spec?.levels) ? spec.levels : []).entries()) for (const r of Array.isArray(l?.rooms) ? l.rooms : []) rooms.add(`${String(l?.id ?? `l${i + 1}`)}/${r?.name}`);
    return { levels, rooms, apartment: false };
  }
  return readUnit(spec);
}

/** How many storeys the unit has (the spec's `levels.length` for any other home). */
export const unitStoreys = (spec: any, apartments?: ReadonlySet<string>): number => unitOf(spec, apartments).levels.length;

/** How many rooms the unit has (every room of the spec for any other home). */
export const unitRoomCount = (spec: any, apartments?: ReadonlySet<string>): number => unitOf(spec, apartments).rooms.size;

/**
 * The spec as the family's page draws it. An apartment is cut down to its unit: only the unit's storeys, only the unit's rooms on them, and, for the outline a storey is drawn
 * inside, the box those rooms span (not the block's bays, which are the neighbours' too). Any other home is returned as it is (the same object).
 */
export function unitSpec(spec: any, apartments: ReadonlySet<string> = apartmentIds()): any {
  const unit = unitOf(spec, apartments);
  if (!unit.apartment) return spec;
  const levels = (Array.isArray(spec?.levels) ? spec.levels : []).flatMap((l: any, i: number) => {
    const id = String(l?.id ?? `l${i + 1}`);
    if (!unit.levels.includes(id)) return [];
    const rooms = (Array.isArray(l?.rooms) ? l.rooms : []).filter((r: any) => unit.rooms.has(`${id}/${r?.name}`));
    const bs = rooms.map((r: any) => box(r?.bounds)).filter(Boolean) as Box[];
    const x0 = Math.min(...bs.map(b => b.x)), z0 = Math.min(...bs.map(b => b.z));
    const x1 = Math.max(...bs.map(b => b.x + b.w)), z1 = Math.max(...bs.map(b => b.z + b.d));
    return [{ ...l, rooms, footprint: bs.length ? [{ x: x0, z: z0, w: x1 - x0, d: z1 - z0 }] : [] }];
  });
  return { ...spec, levels };
}
