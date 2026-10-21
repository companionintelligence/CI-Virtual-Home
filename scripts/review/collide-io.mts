// What collide.mts and its self-test share: the catalog's placement metadata, and the scene dump the page hands over, decoded into the
// engine's input (collide-lib.mts).
import fs from 'node:fs';
import path from 'node:path';
import { decodeF32, decodeIdx } from './geom-report.mts';
import type { GeoPage } from './geom-page.mts';
import type { SceneDump, Catalog } from './collide-lib.mts';
import { ROOT } from '../portal-lib.mts';

export function loadCatalog(): Catalog {
  const raw = JSON.parse(fs.readFileSync(path.join(ROOT, 'content', 'house-catalog.json'), 'utf8')).types as Record<string, any>;
  const out: Catalog = {};
  for (const [k, v] of Object.entries(raw)) if (v && v.place) out[k] = { group: v.place.group, against: v.place.against, hangs: v.place.hangs, mountY: v.place.mountY, onSurface: !!v.place.onSurface || !!v.surface, surfaces: v.place.surfaces, tucks: !!v.place.tucks, top: v.place.top };
  return out;
}

/** What the page sends, decoded into the engine's input. */
export async function extractDump(h: GeoPage): Promise<{ dump: SceneDump; raw: any }> {
  const ex = await h.page.evaluate(() => (window as any).__geo.extract({ doors: true, idx: true, dressing: { walls: 'up', roof: 'on' } }));
  const meta = await h.page.evaluate(() => (window as any).__geo.sceneMeta());
  const parts = ex.meshes.map((m: any) => ({ id: m.id, e: m.e, unit: m.unit, wp: m.wp, glass: m.glass, geom: m.geom, box: m.box, posF: m.pos ? decodeF32(m.pos) : undefined, idx: m.idx ? decodeIdx(m.idx, m.idxBits) : null }));
  return { dump: { entities: ex.entities, parts, doors: ex.doors, levels: meta.levels, rooms: meta.rooms, voids: meta.voids }, raw: ex };
}

