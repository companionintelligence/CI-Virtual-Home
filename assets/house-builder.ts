// HouseBuilder — compiles a HouseSpec v1 JSON (reference/HOUSE-SPEC.md) into the
// Room Creator scene: ground, floor slabs, perimeter walls with openings, partitions, stairs,
// upper slabs with voids, balustrades, roofs, site items, furniture, the Companion Core hero,
// and auto-generated camera splines (door → core, orbit, hero reveal, walkthrough).
//
// It is deliberately a *compiler* over the page's existing procedural primitives
// (ProceduralArchitecture / AssetFactory) so hand-built presets and spec-driven houses share
// one asset library, one wall-mode system and one exporter.
//
// This file is the orchestrator (plan S0 "seams"): it owns the ORDER things are built in and nothing else, and
// is frozen. Each part lives in its own module, owned by one stream:
//   build-context.ts   the page's dependencies and the shared helpers (std, box, group, hex, mix)      S0
//   item-map.ts        spec item type → AssetFactory builder, DESK_TOP, the on-surface set              S1 kit
//   hero-build.ts      the Companion Core, its surface and its cables                                  S1 kit
//   structure-build.ts slabs, walls, openings, partitions, stairs, balustrades, ceilings, roofs         S2 arch
//   rooms-build.ts     the rooms loop                                                                  S3 compose
//   site-build.ts      the lot, the world, the site builders and the site loop                         S4 site
//   shot-planner-v1.ts shotsFor, routeOn, blockedTest, clearPoint (+ core-orbit.ts, shot-path.ts)      S5 shot
// The order below is load-bearing: scene objects, materials and seeded streams are created in it, and a frame
// depends on all three (object and material ids break ties in three.js's render sort). Do not reorder.

import { createMaterialKit, restrainPalette } from './materials.js';
import { PROPS } from './props/index.js';
import { dressLevel } from './fixtures.js';
import { createBuildContext } from './build-context.js';
import { createItemMap } from './item-map.js';
import { createHeroBuild } from './hero-build.js';
import { createStructureBuild } from './structure-build.js';
import { createRoomsBuild } from './rooms-build.js';
import { createSiteBuild } from './site-build.js';
import { createShotPlannerV1 } from './shot-planner-v1.js';

export function createHouseBuilder(deps) {
  const bctx = createBuildContext(deps);
  const { THREE, addItemToScene, registerCeiling, fitShadow, setLightingPreset, std, box, group, hex, mix } = bctx;
  const { ITEMS, DESK_TOP, ON_SURFACE } = createItemMap(bctx);
  const site = createSiteBuild(bctx);
  const structure = createStructureBuild(bctx);   // (makes the graph-wall compiler, when deps.useGraphWalls)
  const rooms = createRoomsBuild(bctx, { ITEMS, DESK_TOP, ON_SURFACE });
  const hero = createHeroBuild(bctx, { DESK_TOP });
  const planner = createShotPlannerV1({ THREE });

  // ---------------------------------------------------------------------------------------
  // Build
  // ---------------------------------------------------------------------------------------
  function build(spec) {
    const palette = restrainPalette({ wall: '#f8fafc', trim: '#1e293b', roof: '#3f2a1d', accent: '#0f766e', ...(spec.palette || {}) });   // saturated walls/roofs pulled toward restraint
    const anchors: Record<string, any> = { spec: spec.id, entry: null, hero: null, stairs: [], levels: {}, bounds: null, lot: spec.lot, solids: {} };
    if (typeof fitShadow === 'function') fitShadow({ w: (spec.lot || {}).w || 30, d: (spec.lot || {}).d || 24 });   // the page fits the sun's shadow box to this lot
    // the material kit compiles the palette: exterior cladding, floor textures the page lacks, and role colours
    // (fabric, wood, cabinet, rug, accent) that theme every prop — seeded by the house id
    const kit = createMaterialKit({ THREE, palette, seed: spec.id });
    site.setKit(kit);
    const siteKit = site.siteKitFor(spec);
    const propCtx = rooms.propContextFor(kit);
    anchors.kit = { colors: kit.colors, cladding: kit.cladding().userData.cladding };
    const placed = [];
    // shotsFor(spec, anchors) probes the built scene round the Core (assets/core-orbit.ts); non-enumerable, so
    // anything that serialises anchors (build-house-plan.mts) never walks the scene graph
    Object.defineProperty(anchors, 'placed', { value: placed, enumerable: false });
    const graphs = {};   // level id → { graph, compiled } when useGraphWalls
    // `role` is one word for what a thing IS — ground, floor, structure, item, site, hero. The QA gate used to
    // sort the scene with a twenty-term regex over display names, which missed anything a builder renamed and
    // caught anything whose label happened to contain "arch". Walls, roofs and ceilings carry their own flags
    // and the page derives their role from those.
    const put = (fn: any, x?: any, z?: any, y?: any, name?: any, role?: any) => { const o = addItemToScene(fn, x, z, y); if (name) o.name = name; if (role) o.userData.role = role; placed.push(o); return o; };

    // ---- ground and world (site-build.ts)
    const water = site.buildGround({ spec, kit, put });

    // ---- levels
    const levelById = Object.fromEntries((spec.levels || []).map(l => [l.id, l]));
    for (const lv of spec.levels || []) {
      // slab, walls, partitions, stairs, balustrades (structure-build.ts), then the rooms (rooms-build.ts)
      const { y, H } = structure.buildLevel({ spec, lv, levelById, palette, kit, anchors, put, graphs });
      rooms.buildRooms({ spec, lv, y, H, palette, kit, anchors, put, propCtx });
      // ceiling fixtures, pendants, fans and each room's warm light; window glass tagged for the dusk glow (assets/fixtures.ts)
      dressLevel({ THREE, spec, lv, y, H, put, placed, anchors, registerCeiling });
    }

    // ---- hero (Companion Core: hero-build.ts)
    hero.buildHero({ spec, levelById, put, anchors });
    // ---- ceilings and roofs (structure-build.ts)
    structure.buildCeilings({ spec, put });
    structure.placeRoofs({ spec, kit, palette, put });
    // ---- site (site-build.ts)
    site.buildSite({ spec, kit, siteKit, put, anchors, water });

    // The preset says what the light is made of; the house says where it stands — the sun swings round
    // from the bearing the entry faces, so the façade the shots open on is the lit one. A spec without a
    // `lighting` still gets its sun aimed; it just keeps the default preset.
    if (setLightingPreset) setLightingPreset(spec.lighting, {
      front: anchors.entry ? anchors.entry.out : [0, 1],
      centre: anchors.bounds ? [(anchors.bounds.minX + anchors.bounds.maxX) / 2, (anchors.bounds.minZ + anchors.bounds.maxZ) / 2] : [0, 0],
    });
    return { anchors, placed, graphs };
  }

  // ---------------------------------------------------------------------------------------
  // Camera splines derived from anchors: shot-planner-v1.ts
  // ---------------------------------------------------------------------------------------
  const { shotsFor } = planner;

  // One prop on its own, themed by a palette (the prop sheet, the catalog builder): registry props and the
  // page's ITEMS alike
  function buildProp(type, params = {}, palette = {}, seed = 'sheet') {
    const kit = createMaterialKit({ THREE, palette, seed });
    const it = { type, at: [0, 0], ...params };
    const prop = PROPS.get(type);
    const ctx = { THREE, std, box, group, mix, hex, colors: kit.colors, rng: kit.itemRng(type) };
    const o = prop ? prop.create(it, ctx) : ITEMS[type] ? ITEMS[type](it, { H: 2.8, y: 0, palette }) : null;
    if (o && !prop) kit.theme(o, { skip: HERO_SET_PUBLIC.has(type) });
    return o;
  }
  const HERO_SET_PUBLIC = new Set(['walnut-desk', 'task-chair', 'curved-monitor', 'chalk-tower', 'charcoal-tower', 'strix-mini', 'speakers', 'core-shelf']);
  const { SITE } = site;
  return { build, shotsFor, buildProp, ITEMS, SITE, PROPS };
}
