// Shared by scripts/fleet/compose.mts (the fleet metrics) and scripts/test-room-composer.mts (the acceptance): the dry
// run — every room of every house composed from scratch, its program read off its name — and the type-repetition
// arithmetic both report. Not a metric file (the fleet audit skips "_" files). Owner: S3 (compose).
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const ROOT = path.resolve(import.meta.dirname, '..', '..');
const load = (p: string) => import(pathToFileURL(path.join(ROOT, p)).href);

export interface DryRoom { lv: any; room: any; res: any }
export interface DryHouse { id: string; spec: any; rooms: DryRoom[] }

/** the composer modules (built: `pnpm run build`), or null when they are not built. Loaded once, at the top level, so
 *  the dry run below is synchronous (a fleet metric's compute() is). */
export async function composerModules() {
  try {
    const [composer, placement, geo, lint, styles, programs, dress] = await Promise.all([
      load('assets/room-composer.js'), load('assets/props/placement.js'), load('assets/room-geo.js'), load('assets/layout-lint.js'),
      load('assets/house-styles.js'), load('assets/room-programs.js'), load('assets/room-dress.js'),
    ]);
    return { ...composer, PLACEMENT: placement.PLACEMENT, geo, lint, styles, programs, dress } as any;
  } catch { return null; }
}
export const M: any = await composerModules();

/** the 30 houses' ids */
export const houseIds = (): string[] => fs.readdirSync(path.join(ROOT, 'content', 'houses')).filter(f => f.endsWith('.json') && f !== 'index.json' && !f.endsWith('.plan.json')).map(f => f.replace(/\.json$/, '')).sort();
export const loadSpec = (id: string) => JSON.parse(fs.readFileSync(path.join(ROOT, 'content', 'houses', `${id}.json`), 'utf8'));

/** every room of every house composed from its name, its authored items dropped (a room whose name says nothing is
 *  left as authored and not in the result). `variant` re-seeds every room (the same houses, another dice). */
export function dryRun(specs: Array<{ id: string; spec: any }>, { variant = '' as string } = {}): DryHouse[] {
  const { composeHouse, inferProgram } = M;
  const out: DryHouse[] = [];
  for (const { id, spec } of specs) {
    const s = JSON.parse(JSON.stringify(spec));
    // (the copy carries the programs it was composed as, so the layout lints — `missing-anchor` reads room.program — see them)
    for (const lv of s.levels || []) for (const r of lv.rooms || []) { r.items = []; if (variant) r.seed = variant; const p = r.bounds ? inferProgram(r, lv) : null; if (p) r.program = p; }
    const res = composeHouse(s, { program: (room: any, lv: any) => inferProgram(room, lv) });
    const rooms: DryRoom[] = [];
    for (const lv of s.levels || []) for (const room of lv.rooms || []) if (res.has(room)) rooms.push({ lv, room, res: res.get(room) });
    out.push({ id, spec: s, rooms });
  }
  return out;
}

/** the hero desk set is placed by the hero block, not furnished. It lives once, in assets/item-map.ts; the built module is
 *  loaded below, and when the assets are not built the dry run has no composer either. */
export const HERO_SET: ReadonlySet<string> = M ? (await load('assets/item-map.js')).HERO_SET : new Set<string>();
/** what counts as FURNITURE in the repetition target: what a room is furnished with. Fitted kitchens, appliances, bath
 *  fittings, lamps, ceiling fixtures and the Core's desk set are left out (a house needs a toilet and a range whatever
 *  the composer does). */
export const FUNCTIONAL = new Set(['fitted', 'appliance', 'bath', 'lighting', 'lamp', 'hero', 'structure']);

export interface Row { type: string; houses: number; items: number }
/** types by houses using them (then items), most first */
export function tally(fleet: Array<{ id: string; items: Array<{ type: string }> }>, keep: (t: string) => boolean = () => true): Row[] {
  const houses = new Map<string, Set<string>>(), n = new Map<string, number>();
  for (const h of fleet) for (const it of h.items) { if (!keep(it.type)) continue; (houses.get(it.type) || houses.set(it.type, new Set()).get(it.type)!).add(h.id); n.set(it.type, (n.get(it.type) || 0) + 1); }
  return [...houses.entries()].map(([type, s]) => ({ type, houses: s.size, items: n.get(type)! })).sort((a, b) => b.houses - a.houses || b.items - a.items || (a.type < b.type ? -1 : 1));
}
/** the plan's "top 12 types" figure: the house-uses of the 12 most repeated types */
export const top12 = (rows: Row[]) => { const t = rows.slice(0, 12); return { rows: t, houses: t.reduce((a, r) => a + r.houses, 0), items: t.reduce((a, r) => a + r.items, 0) }; };

/** the fleet's authored items per house (hero set out) */
export function authoredFleet(specs: Array<{ id: string; spec: any }>) {
  return specs.map(({ id, spec }) => ({ id, items: (spec.levels || []).flatMap((lv: any) => (lv.rooms || []).flatMap((r: any) => (r.items || []).filter((i: any) => !HERO_SET.has(i.type)))) }));
}
export const composedFleet = (dry: DryHouse[]) => dry.map(h => ({ id: h.id, items: h.rooms.flatMap(r => r.res.items) }));
