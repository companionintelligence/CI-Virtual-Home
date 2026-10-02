// assets/xr/locomotion.ts : how a person gets around the house in a headset, and what the house does for them. Replaces the seed stub.
// createLocomotion(host, rig) -> { loco, input }: xr-session calls it once the session and the bake are up, gives `input` to the UI kit (panels
// register RayTargets with it) and `loco` to the loop (tick per XR frame, after input.update and before ui.tick).
//
//   input.ts      what hands, controllers, gaze and visionOS pinches are doing, keyed by input source
//   nav.ts        where a body may stand (the ONLY createNav in the player), the WorldProbe the story presenter shares
//   teleport.ts   the arc / ray against the floor; a release goes there by a blink
//   stairs.ts     "Go up" / "Go down" rings at the ends of each flight
//   comfort.ts    snap turn about the head, the wall guard, seated height, the optional walk with its vignette
//   dress.ts      the roof, the ceilings and the walls, dressed for the HEAD
//   doors.ts      shut doors opened for the session
//   places.ts     the wrist menu's list of standing places
//   pointer.ts    the ray, the dot, the controllers, the hands, the arc and its ring (our own geometry, no model download)
//
// Nothing here moves the XR camera, and the only way the rig moves is XrRig.moveTo / snapTurn (a blink), except the optional walk (off by default).
// Nothing here is loaded unless a session starts, and nothing it changes outlives stop() (doors, dress state, the comfort quads, the listeners).
import type { InputSourceInfo, V3, WorldProbe, XrFrame, XrHost, XrLocomotion, XrRig } from './host.js';
import { createInput, type XrInputImpl } from './input.js';
import { createXrNav, yawOf, type XrNav } from './nav.js';
import { createTeleport, type Teleport } from './teleport.js';
import { createStairs, type Stairs } from './stairs.js';
import { createComfort, type Comfort, type ComfortOptions } from './comfort.js';
import { createDress, type Dress } from './dress.js';
import { openDoors, type Doors } from './doors.js';
import { buildPlaces, type Place } from './places.js';
import { createPointer, type Pointer } from './pointer.js';

export interface XrLocomotionImpl extends XrLocomotion {
  /** the nav, or null when the home has no world digest (then nothing can be aimed at, and the person stays where they are) */
  nav(): XrNav | null;
  comfort(): Comfort | null;
  /** the options a settings panel may change: continuous walking (off), vignette, snap angle */
  options(): ComfortOptions | null;
  /** snap-turn (the wrist menu's arrows on visionOS, where there is no thumbstick) */
  turn(dir: 1 | -1): Promise<unknown> | null;
  places(): Array<Place>;
  debug(): any;
}

const wait = (ms: number) => new Promise<void>(r => setTimeout(r, ms));

export function createLocomotion(host: XrHost, rig: XrRig): { loco: XrLocomotionImpl; input: XrInputImpl } {
  const input = createInput(host, rig);
  const busy = () => !!(rig as any).busy?.();
  let navx: XrNav | null = null, navTried = false;
  let pointer: Pointer | null = null, teleport: Teleport | null = null, stairs: Stairs | null = null, comfort: Comfort | null = null, dress: Dress | null = null, doors: Doors | null = null;
  let placesList: Place[] | null = null, spawn: V3 | null = null, live = false, stopped = false;
  const offs: Array<() => void> = [];
  const t = { start: 0, nav: 0 };

  // the nav is built the first time anything asks (start(), or the story's presenter asking the WorldProbe before start)
  function getNav(): XrNav | null {
    if (navTried) return navx;
    navTried = true;
    try {
      const w = host.anchors() && host.anchors().shotWorld;
      if (w && w.levels && w.boxes) { const t0 = performance.now(); navx = createXrNav(w); navx.warm(); t.nav = performance.now() - t0; }
    } catch (e) { console.warn('xr locomotion: no nav', e); navx = null; }
    return navx;
  }

  const none: WorldProbe = {
    floorY: () => null, walkable: () => false, roomAt: () => ({ room: null, level: null, indoors: false }), segmentClear: () => true, hull: () => [], nearestStand: () => null,
  };
  const P = (): WorldProbe => { const n = getNav(); return n ? n.probeApi : none; };
  const world: WorldProbe = {
    floorY: (x, z, l) => P().floorY(x, z, l), walkable: (x, z, l, c) => P().walkable(x, z, l, c), roomAt: p => P().roomAt(p),
    segmentClear: (a, b, ig) => P().segmentClear(a, b, ig), hull: () => P().hull(), nearestStand: (a, b, q) => P().nearestStand(a, b, q),
  };

  // where a person starts: just inside the front door facing in; else a step from the Core; else the first room
  function pickSpawn(n: XrNav): { feet: V3; yawDeg: number } | null {
    const w = n.world;
    if (w.entry) {
      const lv = n.levelById(w.entry.level), y = lv ? lv.y : w.entry.y;
      const s = n.snap(w.entry.x - w.entry.out[0] * 1.4, w.entry.z - w.entry.out[1] * 1.4, y, 2.0, true);
      if (s) return { feet: [s.x, y, s.z], yawDeg: yawOf(-w.entry.out[0], -w.entry.out[1]) };
    }
    if (w.hero) {
      const s = n.probeApi.nearestStand([w.hero.x, w.hero.y, w.hero.z], w.hero.centre, { level: w.hero.level, minDist: 1.3, maxDist: 3.2 });
      if (s) return { feet: s.feet, yawDeg: (s.yaw * 180) / Math.PI };
    }
    for (const l of w.levels) for (const r of l.rooms) { const p = n.visitPoint(l.id, r); if (p) return { feet: p, yawDeg: n.bestHeading(p[0], l.y, p[2]) }; }
    return null;
  }

  const loco: XrLocomotionImpl = {
    world,
    nav: () => navx,
    comfort: () => comfort,
    options: () => (comfort ? comfort.options : null),
    turn: dir => (comfort ? comfort.snap(dir) : null),

    async start() {
      const t0 = performance.now();
      stopped = false;
      const n = getNav();
      doors = openDoors({ anchors: host.anchors(), renderer: host.renderer });
      pointer = createPointer(host, input, rig);
      comfort = createComfort({ THREE: host.THREE, camera: host.camera, input, rig, nav: () => navx, busy });
      teleport = createTeleport({ input, rig, nav: () => navx, view: pointer.view, busy, stickBusy: id => !!comfort && comfort.walking(id) });
      offs.push(input.addTarget(teleport.floor));
      if (n) stairs = createStairs({ THREE: host.THREE, scene: host.scene, nav: n, input, rig, busy });
      dress = createDress({ api: host.api, world: () => (navx ? navx.world : null), renderer: host.renderer });
      // the person stands indoors: if the session's own entry pose is not a place a body can stand, or there is a better one, blink-free move now (the veil is up)
      if (n) {
        const sp = pickSpawn(n);
        if (sp) {
          spawn = sp.feet;
          const h = rig.head().pos;
          if (Math.hypot(h[0] - sp.feet[0], h[2] - sp.feet[2]) > 0.15 || Math.abs(rig.floorY() - sp.feet[1]) > 0.05) {
            await Promise.race([rig.moveTo({ feet: sp.feet, yawDeg: sp.yawDeg }, { blink: false }), wait(1500)]);
          }
        }
      }
      comfort.autoHeight();
      const hd = rig.head(); dress.now(hd.pos, hd.dir);
      live = true;
      t.start = performance.now() - t0;
    },

    tick(f: XrFrame) {
      if (!live || stopped) return;
      comfort!.tick(f); teleport!.tick(f); stairs?.tick(f); dress!.tick(f); pointer!.tick(f);
    },

    places() { const n = getNav(); if (!n) return []; return placesList || (placesList = buildPlaces(n, spawn)); },
    async goToPlace(id) {
      const p = loco.places().find(x => x.id === id);
      if (!p) return { ms: 0, headMovedM: 0, yawTurnedDeg: 0, swapFrame: -1 };
      return rig.moveTo({ feet: p.feet, yawDeg: p.yawDeg }, { faceStandYaw: true });
    },

    stop() {
      if (stopped && !live) return;
      stopped = true; live = false;
      for (const off of offs.splice(0)) off();
      teleport?.stop(); stairs?.stop(); pointer?.stop(); comfort?.stop(); dress?.stop(); doors?.restore();
      input.dispose();
      teleport = null; stairs = null; pointer = null; comfort = null; dress = null; doors = null;
    },

    debug() {
      return {
        live, navMs: t.nav, startMs: t.start, spawn, places: placesList ? placesList.length : null,
        sources: input.sources(), teleport: teleport ? teleport.state() : null, comfort: comfort ? comfort.state() : null, dress: dress ? dress.state() : null,
        doors: doors ? doors.state() : null, rings: stairs ? stairs.shown() : [], draws: pointer ? pointer.drawCount() : 0,
        stairLinks: navx ? navx.stairs().length : 0,
      };
    },
  };
  return { loco, input };
}
export type { InputSourceInfo };
