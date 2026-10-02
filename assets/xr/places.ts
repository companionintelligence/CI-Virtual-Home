// assets/xr/places.ts : "Places": where the wrist menu can send a person, one blink away. THREE-free (scripts/test-xr-nav.mts runs it on all 30 homes).
//
// In 2D the player offers the baked shots: a camera track a person watches. In a headset applyFrame is never called (a camera that moves
// without the head is the one thing that must not happen), so the 2D shots are not a replay here. What replaces them is a list of STANDING
// PLACES, each a place the nav says a body can stand, each reached by the same blink as every other move:
//   the front door   the entry, a step inside, facing in
//   the Core         the nearest stand from which the Companion Core is seen whole at a standing and a seated eye (poses.ts's rule)
//   each room        nav.visitPoint: the most open cell near the room's centre, facing the longest clear view
//   each flight      the foot of the stairs (to go up) and the top (to go down), the same stands the rings use
// Labels come from the digest (room names, level ids); no copy is invented here.
import type { V3 } from './host.js';
import type { XrNav } from './nav.js';
import { yawOf } from './nav.js';

export type PlaceKind = 'room' | 'stairs-up' | 'stairs-down' | 'entry' | 'core';
export interface Place { id: string; label: string; level: string | null; feet: V3; kind: PlaceKind; yawDeg: number; reachable?: boolean }

/** "Ground floor", "Upstairs", "Floor 3": by position in the storey order, not by id (ids are l1/l2, l0/l1, ...) */
export function levelName(nav: XrNav, levelId: string | null): string {
  if (!levelId) return 'Outside';
  const ls = [...nav.world.levels].sort((a, b) => a.y - b.y);
  const i = ls.findIndex(l => l.id === levelId);
  if (i <= 0) return 'Ground floor';
  return ls.length === 2 ? 'Upstairs' : `Floor ${i + 1}`;
}

/** the opposite heading, in (-180, 180] */
const flip = (deg: number) => ((deg + 360) % 360) - 180;

const MIN_ROOM_M2 = 3.5;   // a "room" of 1 m x 1 m (a carport marker, a terrace sliver) is not a place to stand

export function buildPlaces(nav: XrNav, spawn: V3 | null): Place[] {
  const w = nav.world, out: Place[] = [];
  const entry = w.entry;
  const entryLevel = entry ? nav.levelById(entry.level) : null;
  if (spawn) out.push({ id: 'entry', label: 'Front door', level: entryLevel ? entryLevel.id : null, feet: spawn, kind: 'entry', yawDeg: entry ? yawOf(-entry.out[0], -entry.out[1]) : 0 });

  if (w.hero) {
    const c = w.hero.centre;
    const from: V3 = spawn || [c[0], w.hero.y - 0.8, c[2]];
    const s = nav.probeApi.nearestStand(from, c, { level: w.hero.level, minDist: 1.3, maxDist: 3.2 });
    if (s) out.push({ id: 'core', label: 'Companion Core', level: s.level, feet: s.feet, kind: 'core', yawDeg: (s.yaw * 180) / Math.PI });
  }

  // every room with a place to stand is offered, walkable from the door or not: a place is a blink, not a walk, and the roof store behind a terrace
  // or the floor above a stairwell that is too narrow for a body (mirage) are still homes' rooms. `reachable` says which ones a person could also walk to.
  const ref = spawn && entryLevel ? spawn : null;
  const reach = ref ? nav.reachableFrom(entryLevel!.id, ref[0], ref[2]) : () => true;
  const labels = new Map<string, number>();
  for (const l of w.levels) for (const r of l.rooms) labels.set(r.name, (labels.get(r.name) || 0) + 1);
  for (const l of w.levels) {
    for (const r of l.rooms) {
      if (!r.b || r.b.w * r.b.d < MIN_ROOM_M2) continue;
      const p = nav.visitPoint(l.id, r); if (!p) continue;
      const base = r.name || `Room ${r.no}`;
      out.push({
        id: `room:${l.id}:${r.no}`, label: (labels.get(r.name) || 0) > 1 ? `${base} (${levelName(nav, l.id)})` : base, level: l.id,
        feet: p, kind: 'room', yawDeg: nav.bestHeading(p[0], l.y, p[2]), reachable: reach(l.id, p[0], p[2]),
      });
    }
  }
  for (const link of nav.stairs()) {
    if (link.foot.stand) out.push({ id: `stairs-up:${link.index}`, label: `Stairs up to ${levelName(nav, link.to)}`, level: link.from, feet: link.foot.stand, kind: 'stairs-up', yawDeg: flip(link.foot.yawDeg) });
    if (link.top.stand) out.push({ id: `stairs-down:${link.index}`, label: `Stairs down to ${levelName(nav, link.from)}`, level: link.to, feet: link.top.stand, kind: 'stairs-down', yawDeg: flip(link.top.yawDeg) });
  }
  return out;
}
