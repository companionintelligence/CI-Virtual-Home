// The hero — the Companion Core, the surface it sits on and its cables. Writes anchors.hero, which the shot planner
// frames, with anchors.hero.coreBox: the device's exact world box (never the desk-glow decal; plan Completeness C6).
//
// hero.surface (plan S1 "hero surfaces"):
//   desk      the walnut desk set: desk, monitor (hero.monitor 'curved' | 'flat' | 'none'), chair (hero.chair
//             { kind: 'task' | 'lounge' | 'none', pose: 'turned' | 'tucked' }), hero.desk { style, color, w }
//   shelf     headless: a floating shelf on the wall the hero backs onto (hero.shelfHeight)
//   credenza, island, console, counter — or any type in item-map.ts SURFACE_TYPES
//             the piece is built backing onto the wall (its front toward the room, the user side), and the Core
//             stands on its REAL top: candidate spots on the piece, each tested by casting down at the Core's
//             corners and centre, the first whose five hits agree within 4 mm wins — so a turntable, a bowl, a
//             faucet or a cooktop is never under it, and its y is the top itself, never a constant
//   none      the Core on the floor
// The island leaves its own stools off when the room already has some; a piece of furniture takes the house's theme
// unless hero.surfaceColor gives it a colour. Default desk and shelf heroes build exactly as they did (the same
// objects, materials and order).
//
// Seam module (plan S0): moved out of house-builder.ts. Owner: S1 (kit).
import { DEG, hex } from './build-context.js';
import { PROPS } from './props/index.js';
import { SURFACE_ALIASES, createItemMap } from './item-map.js';
import { mulberry32, fnv1a } from './materials.js';

// a Core's footprint half-extents (232 × 205 mm prone; 90 × 205 upright)
const CORE_HALF = { prone: [0.116, 0.1025], upright: [0.045, 0.1025] };
// stone tops a themed island picks from (white quartz, warm marble, dove grey, soapstone, travertine)
const STONES = [0xece9e3, 0xe4ddd1, 0xbdbab4, 0x5b5e60, 0xd6c8ae];
/** the hero island's stone: hero.surfaceColor, else the house's seeded pick */
export const heroIslandStone = (spec: any): number => spec.hero && spec.hero.surfaceColor ? hex(spec.hero.surfaceColor) : STONES[Math.floor(mulberry32(fnv1a(`${spec.id}:hero-island`))() * STONES.length)];
/** the colour of the top a hero stands on, where it is known before the build (the Core-policy lint's contrast) */
export function heroSurfaceColour(spec: any): number | null {
  const h = spec.hero || {}, s = h.surface || 'desk';
  if (h.surfaceColor) return hex(h.surfaceColor);
  if (s === 'desk') return h.desk && h.desk.color ? hex(h.desk.color) : ({ walnut: 0x452818, oak: 0xa88b69, white: 0xe9e6e0, black: 0x1f1f21 })[(h.desk && h.desk.style) || 'walnut'] ?? 0x452818;
  if (s === 'shelf') return 0x6b4a2b;
  if (s === 'island' || s === 'kitchen-island') return heroIslandStone(spec);
  if (s === 'none') return null;
  return null;   // a themed piece: its colour is the house's wood or cabinet role, known at build time only
}

export function createHeroBuild(bctx, { DESK_TOP }: any = {}) {
  const { THREE, AssetFactory, std, box, group, mix } = bctx;
  const { ITEMS } = createItemMap(bctx);   // (closures only: the page builders a surface type may name)

  function buildHero({ spec, levelById, put, anchors }) {
    // ---- hero (Companion Core)
    if (!spec.hero) return;
    const lv = levelById[spec.hero.level] || spec.levels[0];
    const y = lv ? lv.y : 0; const [hx, hz] = spec.hero.at;
    // Spec convention: hero.rot is the heading the desk BACKS onto — rot 0 puts the monitor/wall side
    // north (-Z) and the user south of it, rot 90 backs onto the west wall, etc. (that is how all 30
    // specs place their desks: `at` hugs a wall and rot names that wall). The asset library's
    // desk/monitor face -Z at rotation 0 with the chair north, so the assets turn 180° from the spec
    // heading; `fwd` — where the user sits and the camera approaches from — then points into the room.
    const rot = ((spec.hero.rot || 0) + 180) * DEG;
    const fwd = [-Math.sin(rot), -Math.cos(rot)];
    const surfaceName = spec.hero.surface || 'desk';
    const surface = surfaceName;   // (anchors keep the spec's word; SURFACE_ALIASES maps it to a type below)
    const side = [fwd[1], -fwd[0]]; // to the right of the desk
    // hero.device: chalk | charcoal (the Companion Core, 232 × 205 × 90 mm) | strix (the AMD reference mini PC).
    // hero.pose: prone (default — as marketed and drawn in the campaign) | upright (stood on its side).
    const pose = spec.hero.pose === 'upright' ? 'upright' : 'prone';
    const devFn = spec.hero.device === 'charcoal' ? () => AssetFactory.createCharcoalTower({ pose }) : spec.hero.device === 'strix' ? () => AssetFactory.createStrixHaloMini() : () => AssetFactory.createChalkTower({ pose });
    let cx = hx + side[0] * 0.55, cz = hz + side[1] * 0.55, dy = DESK_TOP, monitorBase = null, edge = 0.4, surfaceObj = null, surfaceType = null;
    const kit = anchors.kit && anchors.kit.materialKit;   // kit-build.ts kitAnchors: the house's material kit
    const room = heroRoomOf(spec, lv);
    if (surface === 'desk') {
      const dk = spec.hero.desk || {}, mon = spec.hero.monitor || 'curved';
      const chair = typeof spec.hero.chair === 'string' ? { kind: spec.hero.chair } : (spec.hero.chair || {});
      const d = put(() => (dk.style || dk.color || dk.w) ? AssetFactory.createWalnutDesk({ w: dk.w, style: dk.style, color: dk.color ? hex(dk.color) : undefined }) : AssetFactory.createWalnutDesk(), hx, hz, y, 'Hero Desk'); d.rotation.y = rot;
      surfaceObj = d; surfaceType = 'walnut-desk';
      const kind = chair.kind || 'task', cpose = chair.pose || null;
      if (kind !== 'none') {
        // the chair: pulled out 0.8 m from the desk's centre, facing it (today's); 'tucked' under the front edge;
        // 'turned' pulled 0.35 m further out and swung 35° toward the room, off the Core's side (plan §3.11)
        const pull = cpose === 'tucked' ? 0.5 : cpose === 'turned' ? 1.0 : 0.8, off = cpose === 'turned' ? -0.25 : 0;
        const make = kind === 'lounge' ? () => AssetFactory.createClubChair() : () => AssetFactory.createTaskChair();
        const ch = put(make, hx + fwd[0] * pull + side[0] * off, hz + fwd[1] * pull + side[1] * off, y);
        ch.rotation.y = rot + Math.PI + (cpose === 'turned' ? -35 * DEG : 0);
        if (kind === 'lounge') ch.name = 'Hero Lounge Chair';
      }
      if (mon !== 'none') {
        const m = put(() => mon === 'flat' ? AssetFactory.createFlatMonitor() : AssetFactory.createCurvedMonitor(), hx - fwd[0] * 0.1, hz - fwd[1] * 0.1, y + DESK_TOP); m.rotation.y = rot;
        monitorBase = [hx - fwd[0] * 0.1, y + DESK_TOP + 0.02, hz - fwd[1] * 0.1];
      }
    } else if (surface === 'shelf') {
      // headless: a floating shelf on the wall the hero backs onto, the Core on it like a piece of furniture,
      // one power cord down the wall. hero.at is authored as a desk centre 0.4 m off the wall; the shelf's
      // back edge goes where the desk's did.
      // 0.8 m by default — console height, and under the 0.85 m cutaway line, so on a cut wall the shelf
      // still has a wall behind it; hero.shelfHeight raises it where the wall stays full height
      const sx = hx - fwd[0] * 0.4, sz = hz - fwd[1] * 0.4, shelfH = spec.hero.shelfHeight || 0.8;
      const sh = put(() => spec.hero.surfaceColor ? AssetFactory.createFloatingShelf(0.9, 0.26, shelfH, hex(spec.hero.surfaceColor)) : AssetFactory.createFloatingShelf(0.9, 0.26, shelfH), sx, sz, y, 'Hero Shelf'); sh.rotation.y = rot + Math.PI;   // plank extends local +Z = fwd, into the room
      surfaceObj = sh; surfaceType = 'shelf';
      cx = sx + fwd[0] * 0.13; cz = sz + fwd[1] * 0.13; dy = shelfH;
      // a couple of books to one side, so it reads as a shelf and not a mount
      const books = put(() => { const g = group('Books'); for (const [i, c] of [0x8b5e3c, 0x3f5d73, 0xd9c9a3].entries()) { const b = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.2 - i * 0.02, 0.15), std(c)); b.position.set(i * 0.032, (0.2 - i * 0.02) / 2, 0); g.add(b); } return g; }, cx - side[0] * 0.3, cz - side[1] * 0.3, y + shelfH); books.rotation.y = rot;
    } else if (surface !== 'none') {
      // ---- a piece of furniture with a top (credenza, island, console, counter, or any SURFACE_TYPES type)
      const type = SURFACE_ALIASES[surface] || surface;
      const built = buildSurface(type, spec, room, kit);
      if (built) {
        const { obj, frontZ } = built;
        // the piece backs onto the wall: its front (local +z for the registry, the island and the cabinetry; the
        // credenza and the desk are symmetric) toward the room
        const turn = frontZ ? rot + Math.PI : rot;
        const s = put(() => obj, hx, hz, y, `Hero ${type.replace(/(^|-)([a-z])/g, (m, a, b) => (a ? ' ' : '') + b.toUpperCase())}`);
        s.rotation.y = turn;
        s.updateMatrixWorld(true);
        surfaceObj = s; surfaceType = type;
        const spot = findSpot(s, type, pose, turn, y);
        if (spot) { cx = spot.x; cz = spot.z; dy = spot.top - y; }
        else { const bb = new THREE.Box3().setFromObject(s); dy = bb.max.y - y; cx = hx; cz = hz; }
        // the cable drops off the back edge: half the piece's depth
        const bb = new THREE.Box3().setFromObject(s), dx = bb.max.x - bb.min.x, dz = bb.max.z - bb.min.z;
        edge = Math.abs(fwd[0]) > Math.abs(fwd[1]) ? dx / 2 : dz / 2;
      }
    } else { dy = 0; }
    const dev = put(devFn, cx, cz, y + dy, 'Companion Core (Hero)', 'hero');
    dev.rotation.y = rot;
    // The hero anchor is the DEVICE (what the flythrough frames), not the desk centre. centreY is where the
    // camera should look: the middle of the slab in its pose.
    anchors.hero = { x: cx, y: y + dy, z: cz, deskX: hx, deskZ: hz, level: spec.hero.level, fwd, rot, surface, pose, centreY: y + dy + (pose === 'upright' ? 0.116 : 0.045) };
    // the device's exact box, excluding the glow decal (the Core's own box(); the Strix has no decal)
    dev.updateMatrixWorld(true);
    const cb = dev.userData.core && typeof dev.userData.core.box === 'function' ? dev.userData.core.box() : new THREE.Box3().setFromObject(dev);
    const mm = v => Math.round(v * 1000) / 1000;
    anchors.hero.coreBox = { minX: mm(cb.min.x), minY: mm(cb.min.y), minZ: mm(cb.min.z), maxX: mm(cb.max.x), maxY: mm(cb.max.y), maxZ: mm(cb.max.z) };
    anchors.hero.surfaceTop = mm(y + dy);
    if (surfaceType) anchors.hero.surfaceType = surfaceType;
    // the piece under the Core, for the scene QA's hero-float (not serialised)
    Object.defineProperty(anchors.hero, 'surfaceObj', { value: surfaceObj, enumerable: false });
    Object.defineProperty(anchors.hero, 'device', { value: dev, enumerable: false });

    // ---- cables: the Core is plugged in. Power from the PSU inlet at the rear, off the back of whatever it
    // sits on and down to the floor; on a desk also a display lead from the I/O plate to the monitor base.
    if (dev.userData.core) {
      const a = dev.userData.core.anchors(); const back = a.back;   // unit vector out of the rear panel
      const floor = y + 0.01, topY = y + dy;
      if (surface === 'shelf') {
        // straight down the wall from the shelf, a slight belly, into a floor socket
        put(() => AssetFactory.createCable([a.inlet, a.inlet.clone().add(back.clone().multiplyScalar(0.05)), new THREE.Vector3(a.inlet.x + back.x * 0.08, topY - 0.15, a.inlet.z + back.z * 0.08), new THREE.Vector3(a.inlet.x + back.x * 0.06, floor + 0.2, a.inlet.z + back.z * 0.06), new THREE.Vector3(a.inlet.x + back.x * 0.1, floor, a.inlet.z + back.z * 0.1)], 'power'), 0, 0, 0, 'Hero Power Cord');
      } else if (surface !== 'none') {
        // distance from the surface centre to its back edge (desk 0.4; a piece of furniture: half its depth)
        const dropX = hx - fwd[0] * (edge + 0.04) + side[0] * 0.3, dropZ = hz - fwd[1] * (edge + 0.04) + side[1] * 0.3;
        put(() => AssetFactory.createCable([a.inlet, a.inlet.clone().add(back.clone().multiplyScalar(0.05)), new THREE.Vector3(a.inlet.x + back.x * 0.12, topY + 0.004, a.inlet.z + back.z * 0.12), new THREE.Vector3((a.inlet.x + dropX) / 2, topY + 0.004, (a.inlet.z + dropZ) / 2), new THREE.Vector3(dropX, topY - 0.02, dropZ), new THREE.Vector3(dropX + back.x * 0.03, topY - 0.35, dropZ + back.z * 0.03), new THREE.Vector3(dropX + back.x * 0.05, floor, dropZ + back.z * 0.05)], 'power'), 0, 0, 0, 'Hero Power Cord');
        if (monitorBase) put(() => AssetFactory.createCable([a.io, a.io.clone().add(back.clone().multiplyScalar(0.04)), new THREE.Vector3((a.io.x + monitorBase[0]) / 2 + back.x * 0.1, topY + 0.003, (a.io.z + monitorBase[2]) / 2 + back.z * 0.1), new THREE.Vector3(monitorBase[0] - fwd[0] * 0.05, monitorBase[1], monitorBase[2] - fwd[1] * 0.05)], 'display'), 0, 0, 0, 'Hero Display Lead');
      }
    }

    // ---- the pieces the hero block builds as surfaces --------------------------------------------------------
    // → { obj, frontZ }: frontZ — the piece's front is its local +z (turned to face the room)
    function buildSurface(type, spec, room, kit) {
      const col = spec.hero.surfaceColor ? hex(spec.hero.surfaceColor) : undefined;
      const stools = !(room && (room.items || []).some(it => /stool/.test(it.type)));
      let obj = null, frontZ = true;
      if (type === 'kitchen-island') {
        // a themed stone (hero.surfaceColor, else a seeded pick), no stools where the room has its own
        const stone = heroIslandStone(spec);
        obj = AssetFactory.createKitchenIsland(2.4, 0.9, stone, { stools });
      } else if (type === 'media-credenza') { obj = AssetFactory.createMediaCredenza(1.8, 0.45); frontZ = false; }
      else if (type === 'kitchen-cabinetry') obj = AssetFactory.createKitchenCabinetry(2.4, 0.9, 0.65, { uppers: 'none' });
      else if (type === 'walnut-desk') { obj = AssetFactory.createWalnutDesk(); frontZ = false; }
      else if (ITEMS[type] && !PROPS.get(type)) { obj = ITEMS[type]({ type, at: [0, 0] }, { H: 2.8, y: 0, palette: {} }); frontZ = false; }
      else {
        const prop = PROPS.get(type); if (!prop) return null;
        const ctx = { THREE, std, box, group, mix, hex, colors: kit ? kit.colors : { wood: 0x7d6147, fabric: 0x8b8a86, fabric2: 0x6b7078, cabinet: 0x8a8580, metal: 0x2b2f33, accent: 0x5f7470, linen: 0xf2efe9, rug: 0x8a837a }, rng: kit ? kit.itemRng(`hero:${type}`) : mulberry32(fnv1a(`${spec.id}:hero:${type}`)), H: 2.8 };
        obj = prop.create({ type, at: [0, 0], ...(col !== undefined ? { color: spec.hero.surfaceColor } : {}) }, ctx);
      }
      if (!obj) return null;
      // a page piece takes the house's roles (the island's stone, chosen above, stays); with hero.surfaceColor the
      // part the builder marks as its colour takes it and the rest is themed
      if (kit && !PROPS.get(type)) {
        obj.traverse(m => {
          if (!m.isMesh || !m.material || !m.material.userData || !m.material.userData.colorParam) return;
          if (col !== undefined && type !== 'kitchen-island') m.material.color.setHex(col);
          if (col !== undefined || type === 'kitchen-island') m.material.userData.explicit = true;
        });
        kit.theme(obj);
      }
      return { obj, frontZ };
    }
  }

  // The first spot on the piece's top where the Core stands flat: candidates in the piece's own frame (x along its
  // width, z toward its front), each tested at the Core's four corners and centre by a ray cast down onto the piece.
  const ray = new THREE.Raycaster();
  function findSpot(obj, type, pose, turn, y) {
    obj.updateMatrixWorld(true);
    const inv = new THREE.Matrix4().copy(obj.matrixWorld).invert();
    const lb = new THREE.Box3();
    obj.traverse(m => { if (m.isMesh) { m.geometry.computeBoundingBox(); const b = m.geometry.boundingBox.clone().applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, m.matrixWorld)); lb.union(b); } });
    const hw = (lb.max.x - lb.min.x) / 2, hd = (lb.max.z - lb.min.z) / 2, midX = (lb.max.x + lb.min.x) / 2, midZ = (lb.max.z + lb.min.z) / 2;
    const [ax, az] = CORE_HALF[pose] || CORE_HALF.prone, reachX = Math.max(0, hw - ax - 0.03), reachZ = Math.max(0, hd - az - 0.02);
    // preferred spots: the island's user-side end (≥ 0.35 m from its faucet at (0.45, 0.15) and its cooktop at x ≤ −0.05),
    // the credenza's +x half (its turntable stands on −x), otherwise the right third, then outward in both directions
    const pref = type === 'kitchen-island' ? [[0.85, 0.15], [0.85, 0.05], [-0.95, 0.15]]
      : type === 'media-credenza' ? [[0.4, 0], [0.55, 0], [0.25, 0]]
      : [[0.3, 0], [-0.3, 0], [0.15, 0], [-0.15, 0], [0, 0], [0.45, 0], [-0.45, 0]];
    const cands = pref.map(([x, z]) => [Math.max(-reachX, Math.min(reachX, x)), Math.max(-reachZ, Math.min(reachZ, z))]);
    for (let k = 1; k <= 8; k++) for (const sgn of [1, -1]) cands.push([sgn * reachX * k / 8, 0]);
    const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), turn);
    const down = new THREE.Vector3(0, -1, 0);
    for (const [lx, lz] of cands) {
      const hits = [];
      for (const [sx, sz] of [[0, 0], [-1, -1], [1, -1], [-1, 1], [1, 1]]) {
        // the Core turns with the hero (rot = turn or turn − π): its footprint's corners in the piece's frame
        const p = new THREE.Vector3(midX + lx + sx * ax, 0, midZ + lz + sz * az).applyMatrix4(obj.matrixWorld);
        ray.set(new THREE.Vector3(p.x, y + 3, p.z), down);
        const h = ray.intersectObject(obj, true)[0];
        hits.push(h ? h.point.y : null);
      }
      if (hits.some(h => h === null)) continue;
      const hi = Math.max(...hits), lo = Math.min(...hits);
      if (hi - lo > 0.004) continue;
      const c = new THREE.Vector3(midX + lx, 0, midZ + lz).applyMatrix4(obj.matrixWorld);
      return { x: c.x, z: c.z, top: hi };
    }
    return null;
  }

  return { buildHero };
}

// the room hero.at stands in, on its level (items: its stools)
function heroRoomOf(spec, lv) {
  const [x, z] = spec.hero.at;
  return ((lv && lv.rooms) || []).find(r => r.bounds && x >= r.bounds.x - 0.01 && x <= r.bounds.x + r.bounds.w + 0.01 && z >= r.bounds.z - 0.01 && z <= r.bounds.z + r.bounds.d + 0.01) || null;
}
