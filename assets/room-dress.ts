// The dress phase — a second, additive pass after a room's layout is frozen (plan 5.6 DRESS): it reads the room's final items as pins and
// adds `src: 'dress@1'` items (the small goods of assets/props/dress-*.ts, lamps, towels) on the surfaces the layout made. THREE-free.
//
// This file holds the contract every other module reads (D0, plumbing: no pixels); the host registry (room-dress-hosts.ts), the recipes
// (dress-recipes.ts) and the phase itself arrive in D1-D3 behind the same names.
//
//   DRESS_SRC          the marker a dress item carries (`src: 'dress@1'`), as `compose@1` marks the composer's
//   isDress(item)      is this item the dress phase's?
//   dressOff()         the `?dress=0` kill switch: the build leaves every dress item out (baked or live), the exact BEFORE of a dressed house
//   dressOptIn(room)   does this room ask for the live dress phase? Only an explicit `room.dress.level` does: a room without one is never dressed
//                      by the build, so every shipped house builds exactly as it did (a baked `dress@1` item is a plain item in the spec)
//   dressHouse(spec)   room -> DressResult for every opted-in room (cached per spec content, like composeHouse)
//
// Seeding: a dress item carries `dk` (its room, slot and ordinal), and the page seeds it from `kit.itemRng('dress:' + dk)`, a stream keyed by the
// item alone: it never advances the house-wide `propIndex` that every registry prop's stream is counted on (assets/rooms-build.ts), so adding,
// moving or removing a dress item moves no other prop's colour or jitter.
//
// Owner: DRESS.
export const DRESS_SRC = 'dress@1';

export const isDress = (it: any): boolean => !!it && it.src === DRESS_SRC;

/** `?dress=0` (a page switch; Node has no location and is never switched off) */
export function dressOff(): boolean {
  try { return typeof location !== 'undefined' && new URLSearchParams(location.search).get('dress') === '0'; } catch { return false; }
}

/** the room asks for the live dress phase: `dress: { level: 0..1 }` (a number), never `false`, never absent */
export const dressOptIn = (room: any): boolean => !!room && !!room.dress && typeof room.dress === 'object' && typeof room.dress.level === 'number';

export interface DressResult { items: any[]; program: string | null; level: number; slots: Array<{ slot: string; host: string; n: number }>; skipped: Array<{ slot: string; why: string }> }

/** room -> what the dress phase adds (D2 fills this in; until then no room is dressed) */
export function dressHouse(_spec: any): Map<any, DressResult> { return new Map(); }
