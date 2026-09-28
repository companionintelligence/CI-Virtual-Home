// The hero — the Companion Core, the surface it sits on (desk set, credenza, island, shelf) and its cables.
// Writes anchors.hero, which the shot planner frames.
//
// Seam module (plan S0): moved verbatim out of house-builder.ts. Owner: S1 (kit).
import { DEG } from './build-context.js';

export function createHeroBuild(bctx, { DESK_TOP }) {
  const { THREE, AssetFactory, std, group } = bctx;

  function buildHero({ spec, levelById, put, anchors }) {
    // ---- hero (Companion Core)
    if (spec.hero) {
      const lv = levelById[spec.hero.level] || spec.levels[0];
      const y = lv ? lv.y : 0; const [hx, hz] = spec.hero.at;
      // Spec convention: hero.rot is the heading the desk BACKS onto — rot 0 puts the monitor/wall side
      // north (-Z) and the user south of it, rot 90 backs onto the west wall, etc. (that is how all 30
      // specs place their desks: `at` hugs a wall and rot names that wall). The asset library's
      // desk/monitor face -Z at rotation 0 with the chair north, so the assets turn 180° from the spec
      // heading; `fwd` — where the user sits and the camera approaches from — then points into the room.
      const rot = ((spec.hero.rot || 0) + 180) * DEG;
      const fwd = [-Math.sin(rot), -Math.cos(rot)];
      const surface = spec.hero.surface || 'desk';
      const side = [fwd[1], -fwd[0]]; // to the right of the desk
      // hero.device: chalk | charcoal (the Companion Core, 232 × 205 × 90 mm) | strix (the AMD reference mini PC).
      // hero.pose: prone (default — as marketed and drawn in the campaign) | upright (stood on its side).
      const pose = spec.hero.pose === 'upright' ? 'upright' : 'prone';
      const devFn = spec.hero.device === 'charcoal' ? () => AssetFactory.createCharcoalTower({ pose }) : spec.hero.device === 'strix' ? () => AssetFactory.createStrixHaloMini() : () => AssetFactory.createChalkTower({ pose });
      let cx = hx + side[0] * 0.55, cz = hz + side[1] * 0.55, dy = DESK_TOP, monitorBase = null;
      if (surface === 'desk') {
        const d = put(() => AssetFactory.createWalnutDesk(), hx, hz, y, 'Hero Desk'); d.rotation.y = rot;
        const ch = put(() => AssetFactory.createTaskChair(), hx + fwd[0] * 0.8, hz + fwd[1] * 0.8, y); ch.rotation.y = rot + Math.PI;
        const mon = put(() => AssetFactory.createCurvedMonitor(), hx - fwd[0] * 0.1, hz - fwd[1] * 0.1, y + DESK_TOP); mon.rotation.y = rot;
        monitorBase = [hx - fwd[0] * 0.1, y + DESK_TOP + 0.02, hz - fwd[1] * 0.1];
      } else if (surface === 'credenza') {
        const c = put(() => AssetFactory.createMediaCredenza(1.8, 0.45), hx, hz, y, 'Hero Credenza'); c.rotation.y = rot;
      } else if (surface === 'island') {
        put(() => AssetFactory.createKitchenIsland(2.4, 0.9), hx, hz, y, 'Hero Island'); dy = 0.92;
      } else if (surface === 'shelf') {
        // headless: a floating shelf on the wall the hero backs onto, the Core on it like a piece of furniture,
        // one power cord down the wall. hero.at is authored as a desk centre 0.4 m off the wall; the shelf's
        // back edge goes where the desk's did.
        // 0.8 m by default — console height, and under the 0.85 m cutaway line, so on a cut wall the shelf
        // still has a wall behind it; hero.shelfHeight raises it where the wall stays full height
        const sx = hx - fwd[0] * 0.4, sz = hz - fwd[1] * 0.4, shelfH = spec.hero.shelfHeight || 0.8;
        const sh = put(() => AssetFactory.createFloatingShelf(0.9, 0.26, shelfH), sx, sz, y, 'Hero Shelf'); sh.rotation.y = rot + Math.PI;   // plank extends local +Z = fwd, into the room
        cx = sx + fwd[0] * 0.13; cz = sz + fwd[1] * 0.13; dy = shelfH;
        // a couple of books to one side, so it reads as a shelf and not a mount
        const books = put(() => { const g = group('Books'); for (const [i, c] of [0x8b5e3c, 0x3f5d73, 0xd9c9a3].entries()) { const b = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.2 - i * 0.02, 0.15), std(c)); b.position.set(i * 0.032, (0.2 - i * 0.02) / 2, 0); g.add(b); } return g; }, cx - side[0] * 0.3, cz - side[1] * 0.3, y + shelfH); books.rotation.y = rot;
      } else { dy = 0; }
      const dev = put(devFn, cx, cz, y + dy, 'Companion Core (Hero)', 'hero');
      dev.rotation.y = rot;
      // The hero anchor is the DEVICE (what the flythrough frames), not the desk centre. centreY is where the
      // camera should look: the middle of the slab in its pose.
      anchors.hero = { x: cx, y: y + dy, z: cz, deskX: hx, deskZ: hz, level: spec.hero.level, fwd, rot, surface, pose, centreY: y + dy + (pose === 'upright' ? 0.116 : 0.045) };

      // ---- cables: the Core is plugged in. Power from the PSU inlet at the rear, off the back of whatever it
      // sits on and down to the floor; on a desk also a display lead from the I/O plate to the monitor base.
      if (dev.userData.core) {
        const a = dev.userData.core.anchors(); const back = a.back;   // unit vector out of the rear panel
        const floor = y + 0.01, topY = y + dy;
        if (surface === 'shelf') {
          // straight down the wall from the shelf, a slight belly, into a floor socket
          put(() => AssetFactory.createCable([a.inlet, a.inlet.clone().add(back.clone().multiplyScalar(0.05)), new THREE.Vector3(a.inlet.x + back.x * 0.08, topY - 0.15, a.inlet.z + back.z * 0.08), new THREE.Vector3(a.inlet.x + back.x * 0.06, floor + 0.2, a.inlet.z + back.z * 0.06), new THREE.Vector3(a.inlet.x + back.x * 0.1, floor, a.inlet.z + back.z * 0.1)], 'power'), 0, 0, 0, 'Hero Power Cord');
        } else {
          const edge = surface === 'island' ? 0.45 : 0.4;   // distance from the surface centre to its back edge
          const dropX = hx - fwd[0] * (edge + 0.04) + side[0] * 0.3, dropZ = hz - fwd[1] * (edge + 0.04) + side[1] * 0.3;
          put(() => AssetFactory.createCable([a.inlet, a.inlet.clone().add(back.clone().multiplyScalar(0.05)), new THREE.Vector3(a.inlet.x + back.x * 0.12, topY + 0.004, a.inlet.z + back.z * 0.12), new THREE.Vector3((a.inlet.x + dropX) / 2, topY + 0.004, (a.inlet.z + dropZ) / 2), new THREE.Vector3(dropX, topY - 0.02, dropZ), new THREE.Vector3(dropX + back.x * 0.03, topY - 0.35, dropZ + back.z * 0.03), new THREE.Vector3(dropX + back.x * 0.05, floor, dropZ + back.z * 0.05)], 'power'), 0, 0, 0, 'Hero Power Cord');
          if (monitorBase) put(() => AssetFactory.createCable([a.io, a.io.clone().add(back.clone().multiplyScalar(0.04)), new THREE.Vector3((a.io.x + monitorBase[0]) / 2 + back.x * 0.1, topY + 0.003, (a.io.z + monitorBase[2]) / 2 + back.z * 0.1), new THREE.Vector3(monitorBase[0] - fwd[0] * 0.05, monitorBase[1], monitorBase[2] - fwd[1] * 0.05)], 'display'), 0, 0, 0, 'Hero Display Lead');
        }
      }
    }
  }

  return { buildHero };
}
