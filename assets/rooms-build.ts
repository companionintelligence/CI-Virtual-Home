// The rooms loop — every room item of one storey placed, turned, tagged and themed, and the tall ones recorded
// as routing solids (anchors.solids) for the shot planner.
//
// Composed rooms (plan S3): a room with a `program` (and not `lock`ed) gets the composer's furniture set
// (assets/room-composer.ts composeHouse — THREE-free, seeded, cached per spec) after its authored items, which are
// kept exactly as pins. A room without a program takes the loop exactly as before. Under `defaults: 2`, authored
// wall-mounted items set inside their wall move out to its face and surface items authored at the desk default sit
// on whatever they stand on (snapWallMount / stackOnSurface).
// anchors.compose records every composed room for <id>.plan.json (assets/plan-export/compose.ts).
//
// Seam module (plan S0): moved verbatim out of house-builder.ts. Owner: S3 (compose).
import { PROPS } from './props/index.js';
import { DEG, hex, mix } from './build-context.js';
import { HERO_SET } from './item-map.js';
import { composeHouse, snapWallMount, stackOnSurface, SRC } from './room-composer.js';
import { isComposed } from './room-programs.js';
import { analyzeRoom } from './room-geo.js';
import { sunkRooms } from './arch-plan.js';
import { defaultsAtLeast } from './spec/index.js';
import { DRESS_SRC, isDress, dressOff, dressOptIn, dressHouse } from './room-dress.js';

/** the offset of a composed item's room floor over the storey's (see buildRooms) */
const ON_FLOOR = Symbol('onFloor');

// ---- rug on rug --------------------------------------------------------------------------------------------------------------------
// Every rug is a 12 mm slab with its top at the same height, so one laid over another (a runner across an area rug, a patterned rug over a
// shag) shares its top plane with the rug under it and the two flicker. A rug lies RUG_LAYER higher for each rug under it in the room.
export const RUG_LAYER = 0.001;
const isRug = (type: string) => /(^|-)rug$/.test(type);
/** the plan box (axis-aligned round the turned rect) of a rug item, in the room's frame */
function rugBox(it: any) {
  const fp = (PROPS.get(it.type) || {}).footprint || (it.type === 'area-rug' ? [3.2, 2.2] : [2, 1.4]);   // (the page's area rug is 3.2 x 2.2 unless it says)
  const round = /^(circular|concentric)-rug$/.test(it.type) || (it.type === 'patterned-rug' && it.shape === 'round');
  const w = round ? 2 * (it.r ?? (it.w || fp[0]) / 2) : (it.w || fp[0]), d = round ? w : (it.d || fp[1]), a = (it.rot || 0) * DEG;
  const hx = (Math.abs(Math.cos(a)) * w + Math.abs(Math.sin(a)) * d) / 2, hz = (Math.abs(Math.sin(a)) * w + Math.abs(Math.cos(a)) * d) / 2;
  return { x0: it.at[0] - hx, x1: it.at[0] + hx, z0: it.at[1] - hz, z1: it.at[1] + hz };
}
/** how many rug layers lie under each rug of a room: 0 for one that overlaps no earlier rug, else one above the highest earlier rug it overlaps */
export function rugLayers(items: any[]) {
  const layers = new Map<any, number>(), seen: Array<{ b: ReturnType<typeof rugBox>; k: number }> = [];
  for (const it of items) {
    if (!isRug(it.type) || !Array.isArray(it.at)) continue;
    const b = rugBox(it);
    let k = 0;
    for (const q of seen) if (q.b.x0 < b.x1 - 0.01 && q.b.x1 > b.x0 + 0.01 && q.b.z0 < b.z1 - 0.01 && q.b.z1 > b.z0 + 0.01) k = Math.max(k, q.k + 1);
    seen.push({ b, k });
    if (k) layers.set(it, k);
  }
  return layers;
}

export function createRoomsBuild(bctx, { ITEMS, DESK_TOP, ON_SURFACE, kitb }) {
  const { THREE, AssetFactory, std, box, group } = bctx;

  // The registry props' build context for one house: its role colours and a per-instance seeded stream, counted
  // across the whole build (every storey), so the Nth registry prop of a house always draws the same stream.
  function propContextFor(kit) {
    let propIndex = 0;
    // A dress item (plan 5.6) draws from a stream keyed by the item alone (`dk`: its room, slot and ordinal) and never advances `propIndex`:
    // every other registry prop's stream is counted on propIndex, so one more dress item anywhere must not shift the Nth prop after it.
    const propCtx = (it, H) => ({ THREE, std, box, group, mix, hex, colors: kit.colors, rng: kit.itemRng(it.src === DRESS_SRC ? `dress:${it.dk ?? `${it.type}@${it.at}`}` : `${it.type}:${propIndex++}`), H });   // registry props (assets/props/)
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
    // The page's own plant builders (the registry marks its plants foliage itself): a splayed leaf's box
    // covers far more than the leaf, so the scene QA's box tests would call every plant near a wall a clash.
    const PAGE_FOLIAGE = new Set(['fiddle-leaf', 'monstera', 'bonsai', 'bamboo', 'cactus-group']);
    const tidy = defaultsAtLeast(spec, 2);
    const sunk = new Set(sunkRooms(spec, lv));
    const noDress = dressOff();   // ?dress=0: the exact BEFORE of a dressed house (every dress item left out, baked or live)
    for (const room of lv.rooms || []) {
      let items = room.items || [];
      // a composed piece stands on the room's own floor: a raised platform or a sunken pit (rooms[].floorOffset, S2) moves it with the floor —
      // the composer lays a room out in the storey's frame. (Authored items carry their own y.) Carried on the item as a symbol so the
      // tidy pass's copies keep it.
      const floorOff = typeof room.floorOffset === 'number' && (room.floorOffset > 0 || sunk.has(room)) ? room.floorOffset : 0;
      if (isComposed(room)) {
        const res = composeHouse(spec).get(room);
        if (res) {
          items = [...items, ...res.items.map(it => (floorOff ? { ...it, [ON_FLOOR]: floorOff } : it))];
          (anchors.compose ||= []).push({ level: lv.id, room: room.no ?? room.name, name: room.name, program: res.program, style: res.style, items: res.items });
        }
      }
      // the dress phase (plan 5.6): a room that opts in with an explicit `dress.level` and carries no baked dress item of its own is dressed live
      if (noDress) items = items.filter(it => !isDress(it));
      else if (dressOptIn(room) && !items.some(isDress)) {
        const d = dressHouse(spec).get(room);
        if (d && d.items.length) items = [...items, ...d.items.map(it => (floorOff ? { ...it, [ON_FLOOR]: floorOff } : it))];
      }
      // dress items build last in their room, baked or live, whatever order the spec lists them in: the build order is what object and material ids (and so
      // ties in the render sort) follow, and a baked room must build exactly what the live phase builds
      if (!noDress && items.some(isDress)) items = [...items.filter(it => !isDress(it)), ...items.filter(isDress)];
      if (tidy) {
        const geo = analyzeRoom(spec, lv, room);
        items = items.map(it => { if (it.src === SRC || it.src === DRESS_SRC) return it; const a = snapWallMount(it, geo) || it; return stackOnSurface(a, items) || a; });
      }
      const rugOver = rugLayers(items);
      for (const it of items) {
        if (heroHere && HERO_SET.has(it.type) && Math.hypot(it.at[0] - spec.hero.at[0], it.at[1] - spec.hero.at[1]) < 1.3) continue;
        const prop = PROPS.get(it.type);
        const fn = ITEMS[it.type] || (prop && (p => prop.create(p, propCtx(it, H)))); if (!fn) continue;
        const yy = y + (it[ON_FLOOR] || 0) + (rugOver.get(it) || 0) * RUG_LAYER + ((ON_SURFACE.has(it.type) || (prop && prop.surface)) ? (it.y ?? DESK_TOP) : (it.y ?? (prop && prop.mountY) ?? 0));   // mountY: a wall-mounted prop's default height
        const o = put(() => fn(it, { H, y, palette }), it.at[0], it.at[1], yy, null, 'item');
        o.rotation.y = (it.rot || 0) * DEG;   // core-shelf: rot is the wall heading, the plank extends the other way
        o.userData.room = room.name;
        o.userData.itemType = it.type;
        o.userData.onSurface = ON_SURFACE.has(it.type) || !!(prop && prop.surface);
        o.userData.mounted = !!(prop && prop.mountY !== undefined);   // art, sconces, upper cabinets: they live IN the wall plane by design, whatever y they mount at
        o.userData.foliage = !!(prop && prop.foliage) || PAGE_FOLIAGE.has(it.type);
        if (it.src === DRESS_SRC) o.userData.dress = true;   // the shot planner and the QA gates skip small dress items as camera obstacles
        kitb.themeItem(kit, o, it);   // props take the house's role colours; the Core and explicitly coloured items keep theirs (kit-build.ts)
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
