// The kit's share of every build — how the spec's colours, doors and finishes become the builders' parameters.
// Owner: S1 (kit). The other seam modules call these at the spot they build the thing, so S1's spec plumbing
// (door family, per-level cladding, partition doors, ceiling tint, theming, lighting, `defaults: 2`) lives in
// S1's file while the geometry around each call stays with its owner:
//
//   housePalette(spec)                       house-builder.ts   the restrained palette, before anything is built
//   houseKit(spec, palette)                  house-builder.ts   the material kit (seeded by the house id)
//   kitAnchors(kit, spec)                    house-builder.ts   anchors.kit → <id>.plan.json's `kit`
//   openingParams(op, height, isEntry, ctx)  structure-build.ts one opening → createParametricWall's opening
//   noteOpening(ctx)                         structure-build.ts every opening as its wall places it (anchors.doors …)
//   wallCladding(kit, ctx)                   structure-build.ts a perimeter wall's exterior material
//   partitionParams(p, ctx)                  structure-build.ts a partition's colours and its door unit
//   ceilingMaterial(ctx)                     structure-build.ts an upper slab's underside, a top storey's ceiling
//   themeItem(kit, o, it)                    rooms-build.ts     a room item takes the house's role colours
//   lightHouse({ spec, anchors })            house-builder.ts   the preset and the sun's aim (the page's
//                                                               setLightingPreset: environment.ts createLighting)
// Every ctx carries `spec`, and `defaults` (specDefaults(spec)): a look-changing default applies only under 2.
//
// Seam module (plan S0): the bodies are the lines they replace, moved verbatim; each is called exactly where that
// line was, so no material is created in a different order (material ids break ties in three.js's render sort).
import { createMaterialKit, restrainPalette } from './materials.js';
import { hex } from './build-context.js';
import { specDefaults } from './spec/index.js';
import { HERO_SET } from './item-map.js';

export function createKitBuild(bctx) {
  const { THREE, std, setLightingPreset } = bctx;

  // ---- the house's palette and kit
  function housePalette(spec) {
    return restrainPalette({ wall: '#f8fafc', trim: '#1e293b', roof: '#3f2a1d', accent: '#0f766e', ...(spec.palette || {}) });   // saturated walls/roofs pulled toward restraint
  }
  // the material kit compiles the palette: exterior cladding, floor textures the page lacks, and role colours
  // (fabric, wood, cabinet, rug, accent) that theme every prop — seeded by the house id
  function houseKit(spec, palette) {
    return createMaterialKit({ THREE, palette, seed: spec.id });
  }
  function kitAnchors(kit, spec) {
    return { colors: kit.colors, cladding: kit.cladding().userData.cladding };
  }

  // ---- walls and openings
  // ctx: { spec, defaults, lv }
  function openingParams(op, height, isEntry, ctx?) {
    if (op.type === 'window') return { type: 'window', width: op.w, height: op.h || 1.2, sillY: op.sill ?? 0.9 };
    if (op.type === 'glass')  return { type: 'window', width: op.w, height: Math.min(op.h || height - 0.1, height - 0.1), sillY: 0.05 };
    if (op.type === 'slider') return { type: 'door', width: op.w, height: op.h || 2.2, style: 'glass-slider', entry: !!isEntry };
    if (op.type === 'garage') return { type: 'door', width: op.w, height: op.h || 2.2, style: 'garage' };
    return { type: 'door', width: op.w, height: op.h || 2.1, style: op.style || 'entry', open: isEntry || op.open === true, entry: !!isEntry, leafColor: op.color ? hex(op.color) : undefined };
  }
  // ctx: { spec, defaults, lv, anchors, op, param, side, y, isEntry } — called once per opening a perimeter wall
  // places, after its wall is built. Records nothing yet (S1: anchors.doors / anchors.openings).
  function noteOpening(ctx) {}
  // ctx: { spec, defaults, lv, edge } — the exterior material of one perimeter wall
  function wallCladding(kit, ctx?) {
    return kit.cladding();
  }
  // ctx: { spec, defaults, lv, interior, trimColor } — a partition's paint, trim and door unit
  function partitionParams(p, { interior, trimColor }) {
    return { wallColor: hex(p.color || interior), trimColor, doorWidth: p.doorW || 0.9 };
  }
  // ctx: { spec, defaults, lv, where: 'slab-underside' | 'ceiling' } — a fresh material each call
  function ceilingMaterial({ where }) {
    return where === 'slab-underside' ? std(0xf1f5f9, { side: THREE.DoubleSide }) : std(0xf1f5f9, { side: THREE.DoubleSide, roughness: 0.9 });
  }

  // ---- room items: props take the house's role colours; the Core and explicitly coloured items keep theirs
  function themeItem(kit, o, it) {
    kit.theme(o, { skip: HERO_SET.has(it.type) || it.type === 'core-shelf' || it.color !== undefined });
  }

  // ---- lighting (plan Completeness A1)
  // The preset says what the light is made of; the house says where it stands — the sun swings round
  // from the bearing the entry faces, so the façade the shots open on is the lit one. A spec without a
  // `lighting` still gets its sun aimed; it just keeps the default preset.
  function lightHouse({ spec, anchors }) {
    if (setLightingPreset) setLightingPreset(spec.lighting, {
      front: anchors.entry ? anchors.entry.out : [0, 1],
      centre: anchors.bounds ? [(anchors.bounds.minX + anchors.bounds.maxX) / 2, (anchors.bounds.minZ + anchors.bounds.maxZ) / 2] : [0, 0],
    });
  }

  return { housePalette, houseKit, kitAnchors, openingParams, noteOpening, wallCladding, partitionParams, ceilingMaterial, themeItem, lightHouse, specDefaults };
}
export type KitBuild = ReturnType<typeof createKitBuild>;
