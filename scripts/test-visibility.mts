#!/usr/bin/env -S node --experimental-strip-types
// The visibility seam (assets/visibility.ts, S6's; S2 and S5 build on it), tested in Node against stand-in objects:
//   - a role a builder tagged BEFORE registerTrackedWall / autoRegisterWall is kept (S2's 'finish' liners stay liners);
//     S0 declares this the one semantic change of the "verbatim" page move — the page assigned 'wall' unconditionally,
//     which changed nothing while no wall carried a role at that point;
//   - the shot's frame reaches the roof rule and every hook with its clock (t, seconds), not only the arc fraction;
//   - the baked track has the fields plan §3.2 lists (doors, events.doneT) and the roof rule takes the shot's clock;
//   - shotHidden() and shotPose() are pure functions of the frame: whatever the last frame did is undone first, so
//     frame i never depends on frame i − 1, and endShotCutaway puts everything back.
// Needs `pnpm run build` (it reads assets/*.js).
// @check-house quick
//
//   node --experimental-strip-types scripts/test-visibility.mts        (any cwd; <1 s)
import * as THREE from '../assets/vendor/three/three.module.min.js';
import { createVisibility } from '../assets/visibility.js';
import { trackFromV1, shotRoofAlpha } from '../assets/shot-track.js';

let bad = 0;
const check = (ok: boolean, what: string, detail = '') => { console.log(`${ok ? '✓' : '✗'} ${what}${ok || !detail ? '' : `\n    ${detail.split('\n').join('\n    ')}`}`); if (!ok) bad++; };

// ---- stand-ins: enough of three.js and the page for createVisibility ------------------------------------------
class Vec { x = 0; y = 0; z = 0; set(x: number, y: number, z: number) { this.x = x; this.y = y; this.z = z; return this; } }
const obj = (userData: Record<string, any> = {}, position = [0, 0, 0]) => {
  const o: any = { userData, visible: true, position: new Vec().set(position[0], position[1], position[2]), rotation: new Vec(), scale: new Vec().set(1, 1, 1), traverse() {}, updateWorldMatrix() {} };
  return o;
};
(globalThis as any).document = { querySelectorAll: () => [], getElementById: () => null };   // setGlobalWallMode's buttons
const placedItems: any[] = [];
let mode = 'up';
const vis = createVisibility({
  THREE: { Box3: class { setFromObject() { return this; } } }, placedItems, FLOOR2_THRESHOLD: 3, wallMode: () => mode, setWallMode: (m: string) => { mode = m; },
  setLayerFilter() {}, house: () => null, eyeSpline: () => null,
});

// ---- roles ---------------------------------------------------------------------------------------------------
const plain = obj(), liner = obj({ role: 'finish' });
vis.registerTrackedWall(plain, 'south'); vis.registerTrackedWall(liner, 'south');
check(plain.userData.role === 'wall', 'registerTrackedWall tags an untagged wall "wall"');
check(liner.userData.role === 'finish', 'registerTrackedWall keeps a role the builder set first (S2\'s "finish" liner)', String(liner.userData.role));
const auto1 = obj({ isWall: true }, [0, 0, 4]), auto2 = obj({ isWall: true, role: 'finish' }, [0, 0, 4]);
vis.autoRegisterWall(auto1); vis.autoRegisterWall(auto2);
check(auto1.userData.role === 'wall' && auto2.userData.role === 'finish', 'autoRegisterWall likewise');
check(vis.trackedWalls.includes(liner) && vis.trackedWalls.includes(auto2), 'a kept-role wall is still tracked (it cuts away like a wall)');

// ---- the shot's clock ----------------------------------------------------------------------------------------
const a = obj({}, [1, 0, 1]), b = obj({}, [2, 0, 2]);
placedItems.push(a, b);
const preset = { dressing: { walls: 'up', roof: 'on' } };
const seen: any[] = [];
const off = vis.shotHidden((o: any, frame: any) => { seen.push(frame); return o === a && frame.seconds >= 2; });
const eye = { x: 0, y: 1.5, z: 0 }, target = { x: 1, y: 1, z: 1 };
vis.applyShotCutaway(preset, 0.3, eye, target, { t: 0.25, seconds: 3 });
const f = seen[0];
check(!!f && f.s === 0.3 && f.t === 0.25 && f.seconds === 3 && f.eye === eye && f.target === target && f.preset === preset, 'shotHidden\'s frame carries the arc fraction s and the shot clock t, seconds', JSON.stringify(f && { s: f.s, t: f.t, seconds: f.seconds }));
check(a.visible === false && b.visible === true, 'shotHidden hides what the hook says at this frame');
vis.applyShotCutaway(preset, 0.1, eye, target, { t: 0.05, seconds: 0.6 });
check(a.visible === true, 'the next frame puts it back first: frame i does not depend on frame i − 1');
vis.applyShotCutaway(preset, 0, eye, null);
check(seen[seen.length - 1].t === 0 && seen[seen.length - 1].seconds === 0, 'a still (no clock given) is t 0');
off();

// ---- shotPose ------------------------------------------------------------------------------------------------
const door = obj({}, [5, 0, 5]); door.rotation.y = 0.2;
const other = obj({}, [6, 0, 6]);
const frames: any[] = [];
const unpose = vis.shotPose((frame: any, touch: any) => {
  frames.push(frame);
  const d = touch(door);
  d.rotation.set(0, frame.seconds * 0.5, 0);                    // absolute, from the clock
  if (frame.seconds > 4) touch(other).position.set(9, 9, 9);     // moved on later frames only
});
vis.applyShotCutaway(preset, 0.5, eye, target, { t: 0.5, seconds: 2 });
check(door.rotation.y === 1 && frames[0].seconds === 2 && frames[0].t === 0.5, 'shotPose runs each frame with the clock, and its absolute transform lands');
vis.applyShotCutaway(preset, 0.9, eye, target, { t: 0.9, seconds: 4.5 });
check(door.rotation.y === 2.25 && other.position.x === 9, 'a later frame sets its own transforms');
vis.applyShotCutaway(preset, 0.2, eye, target, { t: 0.2, seconds: 1 });
check(door.rotation.y === 0.5 && other.position.x === 6 && other.position.y === 0, 'seeking back: an object an earlier frame moved and this one does not is put back (random access)', `door ${door.rotation.y}, other ${JSON.stringify(other.position)}`);
vis.endShotCutaway();
check(door.rotation.y === 0.2 && door.position.x === 5 && other.position.x === 6 && door.scale.y === 1, 'endShotCutaway puts every moved object back to what it was before the shot');
const n = frames.length;
vis.applyShotCutaway(preset, 0.5, eye, target, { t: 0.5, seconds: 2 });
check(frames.length === n + 1 && door.rotation.y === 1, 'a new shot after the end works the same (the snapshot was taken again)');
vis.endShotCutaway();
check(door.rotation.y === 0.2, '…and ends clean');
unpose();
vis.applyShotCutaway(preset, 0.5, eye, target, { t: 0.5, seconds: 2 });
check(frames.length === n + 1 && door.rotation.y === 0.2, 'an unregistered hook no longer runs');
vis.endShotCutaway();

// ---- the baked track (plan §3.2 format) ------------------------------------------------------------------------
const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
const track = trackFromV1(THREE, { eyePoints: [v(0, 1.5, 8), v(0, 1.5, 4), v(0, 1.5, 0)], targetPoints: [v(0, 1, 0), v(0, 1, -2), v(0, 1, -4)], dressing: { walls: 'up', roof: 'on' }, duration: 10 }, { type: 'door-to-core', duration: 10, fps: 120 });
check(track.version === 2 && track.samples === 1201 && track.roofAlpha.length === 1201, 'trackFromV1: 120 Hz, one entry per sample');
check(!!track.doors && typeof track.doors === 'object' && !Array.isArray(track.doors) && Object.keys(track.doors).length === 0, 'the track has a doors channel object (empty until S5 plans door openings)');
check('doneT' in track.events && track.events.doneT === null && 'settleT' in track.events && 'pressT' in track.events && 'enterT' in track.events && Array.isArray(track.events.stairT), 'the track\'s events are enterT, stairT, pressT, settleT, doneT');
const roof = (extra: Record<string, number> = {}) => shotRoofAlpha({ preset: { dressing: { walls: 'up', roof: 'auto' } }, s: 0.5, enter: () => 0.5, ...extra });
check(roof() === 0 && roof({ t: 0.1, seconds: 1 }) === 0 && shotRoofAlpha({ preset: { dressing: { walls: 'up', roof: 'on' } }, s: 0.5, enter: () => 0.5, seconds: 9 }) === 1, 'shotRoofAlpha takes the clock and v1 ignores it (same alpha with or without)');

console.log(`${bad ? '✗' : '✓'} visibility and track seams: ${bad} wrong`);
process.exit(bad ? 1 : 0);
