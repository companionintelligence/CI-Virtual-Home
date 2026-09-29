// The kit's share of every build — how the spec's colours, doors and finishes become the builders' parameters.
// Owner: S1 (kit). The other seam modules call these at the spot they build the thing, so S1's spec plumbing
// (door family, per-level cladding, partition doors, ceiling tint, theming, lighting, `defaults: 2`) lives in
// S1's file while the geometry around each call stays with its owner:
//
//   housePalette(spec)                       house-builder.ts   the restrained palette, before anything is built
//   houseKit(spec, palette)                  house-builder.ts   the material kit (seeded by the house id)
//   kitAnchors(kit, spec)                    house-builder.ts   anchors.kit → <id>.plan.json's `kit`
//   openingParams(op, height, isEntry, ctx)  structure-build.ts one opening → createParametricWall's opening
//   noteOpening(ctx)                         structure-build.ts every opening as its wall places it (anchors.openings)
//   notePartition(ctx)                       structure-build.ts every partition as it is placed (its door leaf …)
//   finishBuild(ctx)                         house-builder.ts   once, when everything is built, before the light:
//                                                               anchors.doors
//   wallCladding(kit, ctx)                   structure-build.ts a perimeter wall's exterior material
//   partitionParams(p, ctx)                  structure-build.ts a partition's colours and its door unit
//   ceilingMaterial(ctx)                     structure-build.ts an upper slab's underside, a top storey's ceiling
//   themeItem(kit, o, it)                    rooms-build.ts     a room item takes the house's role colours
//   lightHouse({ spec, anchors })            house-builder.ts   the preset and the sun's aim (the page's
//                                                               setLightingPreset: environment.ts createLighting);
// Every ctx carries `spec`, and `defaults` (specDefaults(spec)): a look-changing default applies only under 2.
// The rules themselves (restraint, keep, door colours, the sun, fans and lamps) are kit-rules.ts's, pure and shared
// with the validator, the fleet audit and scripts/test-kit.mts.
//
// Seam module (plan S0): each hook is called exactly where the line it replaced was, so no material is created in
// a different order (material ids break ties in three.js's render sort); a house that asks for nothing new builds
// the same objects as before.
import { createMaterialKit } from './materials.js';
import { hex } from './build-context.js';
import { specDefaults } from './spec/index.js';
import { HERO_SET } from './item-map.js';
import { kitPalette, keepSet, levelWall, doorColour, leafKindOf, lightingOf, restraintOf } from './kit-rules.js';

export function createKitBuild(bctx) {
  const { THREE, std, setLightingPreset } = bctx;
  // the house being built (one build at a time): its kit, for the door colours' timber rule
  let current: { spec: any; kit: any; palette: any } | null = null;

  // ---- the house's palette and kit
  // palette.restraint (0..1, default 1 = today's) and palette.keep (roles exempt from restraint): kit-rules.ts
  function housePalette(spec) {
    return kitPalette(spec);   // saturated walls/roofs pulled toward restraint
  }
  // the material kit compiles the palette: exterior cladding, floor textures the page lacks, and role colours
  // (fabric, wood, cabinet, rug, accent) that theme every prop — seeded by the house id
  function houseKit(spec, palette) {
    const p = spec.palette || {};
    const kit = createMaterialKit({
      THREE, palette, seed: spec.id, keep: [...keepSet(spec)], defaults: specDefaults(spec), roofPull: p.roofPull !== false, restraint: restraintOf(spec),
      roofColors: (spec.roofs || []).filter(r => r && r.color).map(r => hex(r.color)),
    });
    current = { spec, kit, palette };
    return kit;
  }
  function kitAnchors(kit, spec) {
    const out = { colors: kit.colors, cladding: kit.cladding().userData.cladding };
    Object.defineProperty(out, 'materialKit', { value: kit, enumerable: false });   // hero-build.ts themes its pieces with it
    return out;
  }

  // ---- walls and openings
  // ctx: { spec, defaults, lv }. With nothing new asked (no palette.door, no leaf / transom / frame / grid / lantern /
  // head, defaults 1) the parameters are exactly today's.
  function openingParams(op, height, isEntry, ctx?) {
    const spec = (ctx && ctx.spec) || (current && current.spec) || {}, d2 = specDefaults(spec) >= 2;
    const extra: any = {};
    if (op.frame) extra.frameColor = hex(op.frame);
    if (op.grid) extra.grid = op.grid;
    if (op.head && op.head !== 'flat') extra.head = op.head;
    if (op.type === 'window') return { type: 'window', width: op.w, height: op.h || 1.2, sillY: op.sill ?? 0.9, ...extra };
    if (op.type === 'glass')  return { type: 'window', width: op.w, height: Math.min(op.h || height - 0.1, height - 0.1), sillY: 0.05, ...extra };
    if (op.transom) extra.transom = op.transom;
    if (op.lantern !== undefined) extra.lantern = !!op.lantern;
    else if (d2) extra.lantern = false;   // automatic lanterns are off under defaults 2
    // a slider and a garage take the opening's `color` (the slider's frame, the garage's leaf)
    if (op.type === 'slider') return { type: 'door', width: op.w, height: op.h || 2.2, style: 'glass-slider', entry: !!isEntry, ...(op.color && !op.frame ? { frameColor: hex(op.color) } : {}), ...extra };
    if (op.type === 'garage') return { type: 'door', width: op.w, height: op.h || 2.2, style: 'garage', ...(op.color ? { leafColor: hex(op.color) } : {}), ...extra };
    const role = isEntry ? 'entry' : 'exterior';
    const leafC = doorColour(spec, role, { own: op.color, wood: current && current.kit ? current.kit.colors.wood : undefined, palette: current ? current.palette : undefined });
    const leaf = leafKindOf(spec, op);
    if (op.leaf || (leaf === 'double' && op.w > 1.1)) extra.leaf = leaf;
    // the entry swings INTO the house, and every open leaf parks flat along its wall (within 10° of its plane),
    // under defaults 2 (plan S1; Completeness C11 — gated, so no golden moves)
    if (isEntry && d2) extra.swing = 'in';
    else if (op.swing) extra.swing = op.swing;
    if (d2) extra.park = 'flat';
    return { type: 'door', width: op.w, height: op.h || 2.1, style: op.style || 'entry', open: isEntry || op.open === true, entry: !!isEntry, leafColor: leafC ? hex(leafC) : undefined, ...extra };
  }
  // ctx: { spec, defaults, lv, anchors, op, param, side, y, isEntry, wall, edge, centre, rotY } — called once per
  // opening a perimeter wall places, after its wall is built, placed and turned (`wall` the placed object, `edge` the
  // perimeter edge, `centre` its plan centre, `rotY` its rotation.y): anchors.openings[] = { level, side, centre:
  // [x, y, z], normal: [x, z], w, h, sill, type, entry } in world metres, for S2's facade dressing and S5's door
  // funnels. The leaves themselves are read off the finished scene by finishBuild.
  function noteOpening(ctx) {
    const { lv, anchors, op, param, side, y, isEntry } = ctx;
    if (!anchors || !op || !op.edge) return;
    const e = op.edge, horiz = side === 'S' || side === 'N';
    const n = { S: [0, 1], N: [0, -1], E: [1, 0], W: [-1, 0] }[side];
    const h = param.height || (param.type === 'window' ? 1.2 : 2.1), sill = param.type === 'window' ? (param.sillY ?? 0.9) : 0;
    const mm = v => Math.round(v * 1000) / 1000;
    (anchors.openings ||= []).push({
      level: lv.id, side, type: op.type, entry: !!isEntry, w: op.w, h: mm(h), sill: mm(sill), head: op.head || 'flat',
      centre: [mm(horiz ? op.at : e.a[0]), mm(y + sill + h / 2), mm(horiz ? e.a[1] : op.at)], normal: n,
    });
  }
  // ctx: { spec, defaults, lv, edge } — the exterior material of one perimeter wall: the storey's own cladding
  // (levels[].material; under defaults 2 also levels[].wallColor), else the house's
  // ctx: { spec, defaults, lv, anchors, p, wall, y, centre, len, alongX, doorOffset } — called once per partition, after
  // its wall is placed and turned. Its leaf carries userData.door like a perimeter one, and finishBuild collects it
  // with the rest, so there is nothing to record here.
  function notePartition(ctx) {}
  // ctx: { spec, defaults, anchors, kit, placed } — called once, after every level, the hero, the roofs and the site
  // are built and before the light: anchors.doors, from the leaves' own userData.door.
  function finishBuild(ctx) { collectDoors(ctx.anchors, ctx.placed); }
  function wallCladding(kit, ctx?) {
    const own = ctx && ctx.spec ? levelWall(ctx.spec, ctx.lv, current && current.spec === ctx.spec ? current.palette : undefined) : null;
    return own ? kit.cladding(own) : kit.cladding();
  }
  // ctx: { spec, defaults, lv, interior, trimColor } — a partition's paint, trim and door unit. partitions[].doorColor
  // and .doorStyle (the leaf: single | glazed | double | french | none); under defaults 2 the leaf colour is derived
  // (kit-rules.ts: painted or timber), never teal.
  function partitionParams(p, ctx) {
    const { interior, trimColor } = ctx;
    const out: any = { wallColor: hex(p.color || interior), trimColor, doorWidth: p.doorW || 0.9 };
    const spec = ctx.spec || (current && current.spec) || {};
    const c = doorColour(spec, 'interior', { own: p.doorColor, wood: current && current.kit ? current.kit.colors.wood : undefined, palette: current ? current.palette : undefined });
    if (c) out.doorColor = hex(c);
    if (p.doorStyle) out.doorLeaf = p.doorStyle === 'cased' ? 'none' : p.doorStyle;
    else if (specDefaults(spec) >= 2 && (p.doorW || 0.9) > 1.1 && (p.doorW || 0.9) <= 1.8) out.doorLeaf = 'double';
    if (p.doorSwing) out.doorSwing = p.doorSwing;
    if (specDefaults(spec) >= 2) out.doorPark = 'flat';
    return out;
  }
  // ctx: { spec, defaults, lv, where: 'slab-underside' | 'ceiling' } — a fresh material each call. The ceiling is
  // lit neutral (fleet fix, plan S1 task 1): it faces down, so the hemisphere's ground colour and the environment's
  // ground bounce lit it — the day preset's #aaa992 turned every ceiling olive. Its INDIRECT light keeps its
  // brightness and drops its hue; lamps and the sun still colour it.
  // Its paint is a neutral white too (it was Tailwind's slate-50, #f1f5f9, which read blue-grey once the olive
  // bounce stopped cancelling it).
  function ceilingMaterial({ where }) {
    const m = where === 'slab-underside' ? std(0xf2f2f0, { side: THREE.DoubleSide }) : std(0xf2f2f0, { side: THREE.DoubleSide, roughness: 0.9 });
    return neutralIndirect(m);
  }

  // ---- room items: props take the house's role colours; the Core and explicitly coloured items keep theirs.
  // Under defaults 2 an item's `color` no longer switches theming off for the whole item: the part it colours keeps it
  // (a builder marks that part with material.userData.colorParam, or already painted it that colour) and every other
  // role takes the house's theme — the "white" sectional is white with the house's cushions, not slate.
  function themeItem(kit, o, it) {
    const skipHero = HERO_SET.has(it.type) || it.type === 'core-shelf';
    if (it.color === undefined || kit.defaults < 2 || skipHero) { kit.theme(o, { skip: skipHero || it.color !== undefined }); return; }
    const c = hex(it.color);
    o.traverse(m => {
      if (!m.isMesh) return;
      for (const mat of (Array.isArray(m.material) ? m.material : [m.material])) {
        if (!mat || !mat.color) continue;
        if (mat.userData.colorParam) { mat.color.setHex(c); mat.userData.explicit = true; }
        else if (mat.color.getHex() === c) mat.userData.explicit = true;
      }
    });
    kit.theme(o);
  }

  // ---- lighting (plan Completeness A1)
  // The preset says what the light is made of; the house says where it stands — the sun swings round from the
  // bearing the entry faces, so the façade the shots open on is the lit one. `lighting` is a preset name or
  // { preset, sunBearing }: a sunBearing (compass degrees, 0 = north) puts the sun there; under defaults 2 each
  // house gets its own seeded swing and the true-white look (environment.ts lookOf). A spec without a `lighting`
  // still gets its sun aimed; it just keeps the default preset. The builder's aim sets the swing, bearing and look
  // every build, so nothing carries over from the house before.
  function lightHouse({ spec, anchors }) {
    const L = lightingOf(spec), d2 = specDefaults(spec) >= 2;
    if (setLightingPreset) setLightingPreset(spec.lighting, {
      front: anchors.entry ? anchors.entry.out : [0, 1],
      centre: anchors.bounds ? [(anchors.bounds.minX + anchors.bounds.maxX) / 2, (anchors.bounds.minZ + anchors.bounds.maxZ) / 2] : [0, 0],
      swing: d2 ? L.swing : null, bearing: L.sunBearing, look: L.look,
    });
    anchors.lighting = { preset: L.preset, sunBearing: L.sunBearing, swing: d2 ? L.swing : null, look: L.look };
  }

  // ---- anchors.doors: every hinged leaf the build hung (the page tags each pivot userData.door), in world terms,
  // for S5 to open doors and add them to its nav, and for the scene QA's leaf-in-lane. { id, level, kind:
  // 'entry' | 'exterior' | 'interior', leaf, hinge: [x, z], y0, h, w, closedYaw, openYaw, swing, open } — yaw is the
  // world heading of the leaf's free edge from its hinge (0 = +z). Non-enumerable `pivot` is the object itself.
  function collectDoors(anchors, placed) {
    const doors = [], P = new THREE.Vector3(), Q = new THREE.Vector3(), mm = v => Math.round(v * 1000) / 1000;
    const levelAt = y => { let best = null; for (const [id, l] of Object.entries(anchors.levels || {}) as any) if (y > (l as any).y - 0.3 && (!best || (l as any).y > anchors.levels[best].y)) best = id; return best; };
    for (const w of placed) {
      if (!w.userData || !w.userData.isWall) continue;
      const kind = w.userData.config && w.userData.config.orientation === 'partition' ? 'interior' : 'exterior';
      w.updateMatrixWorld(true);
      w.traverse(o => {
        const d = o.userData && o.userData.door; if (!d) return;
        const yawOf = (ang: number) => {
          const sgn = d.hinge === 'right' ? -1 : 1, keep = o.rotation.y;
          o.rotation.y = ang; o.updateMatrixWorld(true);
          o.getWorldPosition(P); Q.set(sgn, 0, 0).applyMatrix4(o.matrixWorld);
          o.rotation.y = keep; o.updateMatrixWorld(true);
          return Math.atan2(Q.x - P.x, Q.z - P.z) * 180 / Math.PI;
        };
        o.getWorldPosition(P);
        const hinge = [mm(P.x), mm(P.z)], y0 = mm(P.y + d.y0);
        const unit = o.parent;   // pivot → the door unit, placed at its opening's offset along the wall
        const isEntry = kind === 'exterior' && !!(unit && (w.userData.config.openings || []).some(op => op.entry && Math.abs(op.offset - unit.position.x) < 1e-6));
        const rec: any = { id: d.id || `${kind}:${doors.length}`, level: levelAt(P.y), kind: isEntry ? 'entry' : kind, leaf: d.leaf, hinge, y0, h: mm(d.h), w: mm(d.w), closedYaw: +yawOf(d.closedAngle).toFixed(1), openYaw: +yawOf(d.openAngle).toFixed(1), swing: d.swing, open: d.open };
        Object.defineProperty(rec, 'pivot', { value: o, enumerable: false });
        doors.push(rec);
      });
    }
    anchors.doors = doors;
  }

  return { housePalette, houseKit, kitAnchors, openingParams, noteOpening, notePartition, finishBuild, wallCladding, partitionParams, ceilingMaterial, themeItem, lightHouse, specDefaults };

  // Indirect light without hue (the ceiling fix above): three's physical lighting gathers the ambient, hemisphere
  // and light-probe irradiance in `irradiance` and the environment's in `iblIrradiance` / `radiance`; each is
  // replaced by its luma just before they are applied. Direct lights (the sun, the fixtures' warm spots) are untouched.
  function neutralIndirect(mat) {
    const LUMA = 'vec3( 0.2126, 0.7152, 0.0722 )';
    mat.onBeforeCompile = shader => {
      shader.fragmentShader = shader.fragmentShader.replace('#include <lights_fragment_end>', [
        '#if defined( RE_IndirectDiffuse )', `irradiance = vec3( dot( irradiance, ${LUMA} ) );`, `iblIrradiance = vec3( dot( iblIrradiance, ${LUMA} ) );`, '#endif',
        '#if defined( RE_IndirectSpecular )', `radiance = vec3( dot( radiance, ${LUMA} ) );`, '#endif',
        '#include <lights_fragment_end>'].join('\n'));
    };
    mat.customProgramCacheKey = () => 'neutral-indirect';
    mat.userData.neutralIndirect = true;
    return mat;
  }
}
export type KitBuild = ReturnType<typeof createKitBuild>;
