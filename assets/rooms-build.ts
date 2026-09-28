// The rooms loop — every room item of one storey placed, turned, tagged and themed, and the tall ones recorded
// as routing solids (anchors.solids) for the shot planner.
//
// Seam module (plan S0): moved verbatim out of house-builder.ts. Owner: S3 (compose).
import { PROPS } from './props/index.js';
import { DEG, hex, mix } from './build-context.js';

export function createRoomsBuild(bctx, { ITEMS, DESK_TOP, ON_SURFACE }) {
  const { THREE, AssetFactory, std, box, group } = bctx;

  // The registry props' build context for one house: its role colours and a per-instance seeded stream, counted
  // across the whole build (every storey), so the Nth registry prop of a house always draws the same stream.
  function propContextFor(kit) {
    let propIndex = 0;
    const propCtx = (it, H) => ({ THREE, std, box, group, mix, hex, colors: kit.colors, rng: kit.itemRng(`${it.type}:${propIndex++}`), H });   // registry props (assets/props/)
    return propCtx;
  }

  // One storey's rooms (run after its structure, before its fixtures).
  function buildRooms({ spec, lv, y, H, palette, kit, anchors, put, propCtx }) {
    // rooms + items
    // The hero desk set (desk, chair, monitor, device, speakers) is placed by the hero block below from
    // hero.at/rot; 25 of the 30 specs ALSO list it as room items at the same spot. Skip those, as
    // generate_house_iso.py's draw_rooms does, or the two sets stack back-to-back and the item copy's
    // monitor back sits in front of the real screen.
    // 25 specs also list the desk set as room items at hero.at; whatever surface the hero uses, those are
    // the hero set's copy, not extra furniture (a shelf hero with a room-item desk under it is two heroes)
    const heroHere = spec.hero && spec.hero.level === lv.id;
    const HERO_SET = new Set(['walnut-desk', 'task-chair', 'curved-monitor', 'chalk-tower', 'charcoal-tower', 'strix-mini', 'speakers']);
    // The page's own plant builders (the registry marks its plants foliage itself): a splayed leaf's box
    // covers far more than the leaf, so the scene QA's box tests would call every plant near a wall a clash.
    const PAGE_FOLIAGE = new Set(['fiddle-leaf', 'monstera', 'bonsai', 'bamboo', 'cactus-group']);
    for (const room of lv.rooms || []) {
      for (const it of room.items || []) {
        if (heroHere && HERO_SET.has(it.type) && Math.hypot(it.at[0] - spec.hero.at[0], it.at[1] - spec.hero.at[1]) < 1.3) continue;
        const prop = PROPS.get(it.type);
        const fn = ITEMS[it.type] || (prop && (p => prop.create(p, propCtx(it, H)))); if (!fn) continue;
        const yy = y + ((ON_SURFACE.has(it.type) || (prop && prop.surface)) ? (it.y ?? DESK_TOP) : (it.y ?? (prop && prop.mountY) ?? 0));   // mountY: a wall-mounted prop's default height
        const o = put(() => fn(it, { H, y, palette }), it.at[0], it.at[1], yy, null, 'item');
        o.rotation.y = (it.rot || 0) * DEG;   // core-shelf: rot is the wall heading, the plank extends the other way
        o.userData.room = room.name;
        o.userData.itemType = it.type;
        o.userData.onSurface = ON_SURFACE.has(it.type) || !!(prop && prop.surface);
        o.userData.mounted = !!(prop && prop.mountY !== undefined);   // art, sconces, upper cabinets: they live IN the wall plane by design, whatever y they mount at
        o.userData.foliage = !!(prop && prop.foliage) || PAGE_FOLIAGE.has(it.type);
        kit.theme(o, { skip: HERO_SET.has(it.type) || it.type === 'core-shelf' || it.color !== undefined });   // props take the house's role colours; the Core and explicitly coloured items keep theirs
        // anything the door-to-core eye (1.45 m up) could meet is a routing obstacle on this storey — a desk
        // ornament sitting at DESK_TOP + its own height clears 1.1 m easily without blocking anything at floor
        // or eye level, so this reads o.userData.onSurface (registry surface: true included) rather than
        // re-testing the legacy ON_SURFACE set alone, which every registry prop fails by construction.
        o.updateMatrixWorld(true);
        const bb = new THREE.Box3().setFromObject(o);
        if (bb.max.y > y + 1.1 && !o.userData.onSurface) (anchors.solids[lv.id] ||= []).push({ minX: bb.min.x, maxX: bb.max.x, minZ: bb.min.z, maxZ: bb.max.z, top: bb.max.y, type: it.type });
        if (o.userData.coreShelf) {
          const a = o.userData.coreShelf.core.userData.core.anchors(), back = a.back, floor = y + 0.01, topY = yy + o.userData.coreShelf.h;
          put(() => AssetFactory.createCable([a.inlet, a.inlet.clone().add(back.clone().multiplyScalar(0.05)), new THREE.Vector3(a.inlet.x + back.x * 0.08, topY - 0.15, a.inlet.z + back.z * 0.08), new THREE.Vector3(a.inlet.x + back.x * 0.06, floor + 0.2, a.inlet.z + back.z * 0.06), new THREE.Vector3(a.inlet.x + back.x * 0.1, floor, a.inlet.z + back.z * 0.1)], 'power'), 0, 0, 0, 'Shelf Power Cord');
        }
      }
    }
  }

  return { propContextFor, buildRooms };
}
