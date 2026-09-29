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
// is frozen. Each part lives in its own module, owned by one stream — the whole list, so a stream knows its files:
//
//   S0  build-context.ts, item-meta.ts, hero-frame.ts (shared), house-builder.ts, spec/index.ts + spec/base.ts,
//       scene-qa/registry.ts, plan-export/index.ts, the validator's core (scripts/validate-house-spec.mts) and the
//       fixture, golden-ledger, fleet and perf harnesses
//   S1 kit          kit-build.ts (palette and kit, and the spec → parameters every other module asks it for: doors and
//                   windows, partition doors, cladding, ceilings, theming, lighting), item-map.ts (spec item type →
//                   AssetFactory builder, ITEM_PARAMS, DESK_TOP, the on-surface and hero sets), hero-build.ts and
//                   hero-frame.ts, materials.ts, textures.ts, fixtures.ts, environment.ts, props/lighting.ts;
//                   the room-creator.html door / window / furniture builders (its OWNER banners)
//   S2 architecture structure-build.ts (slabs, walls, openings, partitions, stairs, balustrades, ceilings, roofs),
//                   roofs.ts, wall-compiler.ts, floorplan-graph.ts, house-geometry.ts; the page's stair, slab and
//                   wall builders
//   S3 compose      rooms-build.ts (the rooms loop) and room-composer.ts, props/*.ts except lighting.ts and
//                   outdoor.ts, props/page-place.ts (page items' placement), props/registry.ts,
//                   scripts/build-prop-catalog.mts
//   S4 site         site-build.ts (the lot, the world, the site builders and the site loop), site.ts (the kit),
//                   site-planting.ts (the planting generator), site-geom.ts (curves, offsets, Poisson discs),
//                   site-species.ts (the plants' drawing), site-species-masks.ts (generated: what each species hides, and costs), site-structures.ts (stairs, rails, fences, walls),
//                   world.ts, props/outdoor.ts; the page's pool / fence / garden / cabana builders
//   S5 shot         shot-planner-v1.ts (shotsFor, routeOn, blockedTest, clearPoint), core-orbit.ts, shot-path.ts,
//                   shot-track.ts (the baked track and the roof-fade rule)
//   S6 ui           visibility.ts (wall modes, the shot's cutaway, shotHidden / shotPose), viewer.ts, home-names.ts,
//                   the page's editor UI and overlays
// Every stream also owns its spec fragment (spec/<stream>.ts), validator plugin (scripts/validate/<stream>.mts),
// scene checks (scene-qa/<stream>.ts), fleet metrics (scripts/fleet/<stream>.mts) and plan.json key
// (plan-export/<stream>.ts). room-creator.html's shared builders alternate between streams: read its OWNER banners.
//
// The order below is load-bearing: scene objects, materials and seeded streams are created in it, and a frame
// depends on all three (object and material ids break ties in three.js's render sort). Do not reorder.

import { createMaterialKit } from './materials.js';
import { PROPS } from './props/index.js';
import { dressLevel } from './fixtures.js';
import { createBuildContext } from './build-context.js';
import { createKitBuild } from './kit-build.js';
import { createItemMap, HERO_SET } from './item-map.js';
import { createHeroBuild } from './hero-build.js';
import { createStructureBuild } from './structure-build.js';
import { createRoomsBuild } from './rooms-build.js';
import { createSiteBuild } from './site-build.js';
import { createShotPlannerV1 } from './shot-planner-v1.js';

export function createHouseBuilder(deps) {
  const bctx = createBuildContext(deps);
  const { THREE, addItemToScene, registerCeiling, fitShadow, std, box, group, hex, mix } = bctx;
  const kitb = createKitBuild(bctx);
  const { ITEMS, DESK_TOP, ON_SURFACE } = createItemMap(bctx);
  const site = createSiteBuild(bctx);
  const structure = createStructureBuild(bctx, { kitb });   // (makes the graph-wall compiler, when deps.useGraphWalls)
  const rooms = createRoomsBuild(bctx, { ITEMS, DESK_TOP, ON_SURFACE, kitb });
  const hero = createHeroBuild(bctx, { DESK_TOP });
  const planner = createShotPlannerV1(bctx);   // the whole context: a dep the page adds (bctx.extra) reaches it

  // ---------------------------------------------------------------------------------------
  // Build
  // ---------------------------------------------------------------------------------------
  function build(spec) {
    const palette = kitb.housePalette(spec);   // saturated walls/roofs pulled toward restraint (kit-build.ts)
    const anchors: Record<string, any> = { spec: spec.id, entry: null, hero: null, stairs: [], levels: {}, bounds: null, lot: spec.lot, solids: {} };
    if (typeof fitShadow === 'function') fitShadow({ w: (spec.lot || {}).w || 30, d: (spec.lot || {}).d || 24 });   // the page fits the sun's shadow box to this lot
    // the material kit compiles the palette: exterior cladding, floor textures the page lacks, and role colours
    // (fabric, wood, cabinet, rug, accent) that theme every prop — seeded by the house id
    const kit = kitb.houseKit(spec, palette);
    site.setKit(kit);
    const siteKit = site.siteKitFor(spec);
    const propCtx = rooms.propContextFor(kit);
    anchors.kit = kitb.kitAnchors(kit, spec);
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

    // ---- the whole house is built: S1's end-of-build hook (kit-build.ts), then the light
    kitb.finishBuild({ spec, defaults: kitb.specDefaults(spec), anchors, kit, placed });
    // ---- the light: the spec's preset, the sun aimed from the entry's bearing (kit-build.ts)
    kitb.lightHouse({ spec, anchors });
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
    if (o && !prop) kit.theme(o, { skip: HERO_SET.has(type) || type === 'core-shelf' });
    return o;
  }
  const { SITE } = site;
  return { build, shotsFor, buildProp, ITEMS, SITE, PROPS };
}
