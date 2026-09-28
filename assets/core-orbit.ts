// Orbiting the Companion Core at close range: where around it an eye can circle, and the waypoints of an arc
// through that space. door-to-core's finale and the core-orbit shot are both built on this (house-builder.ts
// shotsFor).
//
// Angles are degrees in the hero's own frame: 0 is straight in front of the Core (along hero.fwd, where its
// power button and LED ring face), +90 is the desk's right (hero side = [fwd.z, −fwd.x]), ±180 behind it. An eye
// at angle θ, radius r and height h sits at centre + r·(cos θ·fwd + sin θ·side) + h·up.
//
// The probe answers two questions about an eye position, against the storey as built:
//   free(p)  is it clear — inside the footprint and off any void, under the ceiling, WALL from every wall solid
//            and partition, ITEM outside every piece of furniture's box (LOOM from one that stands at the eye's
//            own height: a monitor 0.1 m off the lens fills half the frame), STRUCT from stairs, balustrades?
//            (a close-range margin: the walk keeps 0.45 m off a wall, an orbit a hand's width round a desk
//            cannot)
//   sees(p)  does a ray from it to the Core's centre meet nothing first?
// An arc is free where both hold every STEP degrees (at both ends of the orbit's height range). The shot takes the
// longest contiguous free run through (or nearest) the front.

import { perimeterEdges, inRect } from './house-geometry.js';

const DEG = Math.PI / 180;
export const ORBIT_STEP = 5;          // degrees between probed angles
export const WAYPOINT_STEP = 15;      // degrees between orbit waypoints: centripetal Catmull-Rom on a coarser arc bulges
const WALL = 0.3, ITEM = 0.08, LOOM = 0.22, STRUCT = 0.1, CEILING = 0.3;

const segDist = (x, z, ax, az, bx, bz) => { const dx = bx - ax, dz = bz - az, l2 = dx * dx + dz * dz || 1e-9; const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / l2)); return Math.hypot(x - (ax + dx * t), z - (az + dz * t)); };

// placed: the build's top-level objects (house-builder `put`), each with userData.role. core: the hero Core
// object (excluded from both tests). centre: the Core's centre (Vector3). reach: how far out anything could matter.
export function createOrbitProbe({ THREE, level, placed, core, centre, reach = 2.6 }) {
  const y0 = level.y || 0, H = level.height || 2.8;
  const rects = level.footprint || [], voids = level.voids || [], parts = level.partitions || [];
  const edges = rects.length ? perimeterEdges(rects) : [];
  const sphere = new THREE.Sphere(centre.clone(), reach);
  const wallBoxes = [], itemBoxes = [], structBoxes = [], rayObjs = [];
  const skip = new Set(['ground', 'site', 'roof', 'ceiling']);
  const box = new THREE.Box3();
  for (const o of placed || []) {
    if (!o || o === core) continue;
    const role = (o.userData && o.userData.role) || 'item';
    if (skip.has(role)) continue;
    o.updateMatrixWorld(true);
    box.setFromObject(o);
    if (box.isEmpty() || !box.intersectsSphere(sphere)) continue;
    rayObjs.push(o);
    if (role === 'item' || role === 'hero') {
      // the QA gate's item-clip test, exactly: the whole object's box, if it stands taller than 0.25 m
      const sz = box.getSize(new THREE.Vector3());
      if (sz.y > 0.25 && sz.x < 8 && sz.z < 8) itemBoxes.push(Object.assign(box.clone(), { name: o.name || o.userData.itemType || 'item' }));
      continue;
    }
    // a wall is a group of solids round its openings (piers, lintel, sill), a stair a run of treads: per mesh
    const into = role === 'wall' ? wallBoxes : structBoxes, pad = role === 'wall' ? WALL : STRUCT;
    o.traverse(m => {
      if (!m.isMesh) return;
      const b = new THREE.Box3().setFromObject(m);
      if (!b.isEmpty() && b.intersectsSphere(sphere) && b.max.y > y0 + 0.2) into.push(Object.assign(b.expandByScalar(pad), { name: o.name || role }));
    });
  }
  const p3 = new THREE.Vector3();
  // why (x, y, z) is not clear — null when it is
  function blocker(x, y, z) {
    if (!rects.some(r => inRect(x, z, r, -0.05))) return 'outside the storey';
    if (voids.some(v => inRect(x, z, v, 0.3))) return 'over a void';
    if (y > y0 + H - CEILING || y < y0 + 0.3) return 'ceiling / floor';
    for (const e of edges) if (segDist(x, z, e.a[0], e.a[1], e.b[0], e.b[1]) < WALL) return 'perimeter wall';
    for (const pt of parts) if (segDist(x, z, pt.from[0], pt.from[1], pt.to[0], pt.to[1]) < WALL) return 'partition';
    p3.set(x, y, z);
    for (const b of wallBoxes) if (b.containsPoint(p3)) return `wall ${b.name}`;
    for (const b of itemBoxes) { const pad = b.max.y > y - 0.1 ? LOOM : ITEM; if (x > b.min.x - pad && x < b.max.x + pad && z > b.min.z - pad && z < b.max.z + pad && y > b.min.y - pad && y < b.max.y + pad) return `item ${b.name}`; }
    for (const b of structBoxes) if (b.containsPoint(p3)) return `structure ${b.name}`;
    return null;
  }
  // The Core is seen when rays reach its centre, the centre of its bounding box (the QA gate's target — the
  // desk-glow decal stretches it forward) and the middle of its top face.
  const coreBox = core ? new THREE.Box3().setFromObject(core) : null;
  const aims = [centre.clone()];
  if (coreBox && !coreBox.isEmpty()) { aims.push(coreBox.getCenter(new THREE.Vector3())); aims.push(new THREE.Vector3(centre.x, coreBox.max.y - 0.01, centre.z)); }
  const ray = new THREE.Raycaster(), from = new THREE.Vector3(), dir = new THREE.Vector3();
  function occluder(x, y, z) {
    for (const to of aims) {
      from.set(x, y, z); dir.subVectors(to, from); const dist = dir.length(); dir.normalize();
      ray.set(from, dir); ray.near = 0.02; ray.far = Math.max(0.05, dist - 0.13);   // stop at the Core's own shell
      const hit = ray.intersectObjects(rayObjs, true)[0];
      if (hit) { let o = hit.object; while (o.parent && !rayObjs.includes(o)) o = o.parent; return o.name || (o.userData && o.userData.itemType) || 'something'; }
    }
    return null;
  }
  return {
    free: (x, y, z) => blocker(x, y, z) === null,
    sees: (x, y, z) => occluder(x, y, z) === null,
    explain: (x, y, z) => blocker(x, y, z) || ((o => o && `hides the Core: ${o}`)(occluder(x, y, z))),
    counts: { walls: wallBoxes.length, items: itemBoxes.length, structure: structBoxes.length, rays: rayObjs.length }
  };
}

export const orbitPoint = (THREE, centre, fwd, r, deg, y) => {
  const a = deg * DEG, s = [fwd[1], -fwd[0]];
  return new THREE.Vector3(centre.x + r * (Math.cos(a) * fwd[0] + Math.sin(a) * s[0]), y, centre.z + r * (Math.cos(a) * fwd[1] + Math.sin(a) * s[1]));
};

// Which of the 360 / STEP probed angles is free at radius r for every height in hs.
export function freeMap(THREE, probe, centre, fwd, r, hs) {
  const n = Math.round(360 / ORBIT_STEP), free = [];
  for (let k = 0; k < n; k++) {
    const deg = -180 + k * ORBIT_STEP;
    free.push(hs.every(h => { const p = orbitPoint(THREE, centre, fwd, r, deg, centre.y + h); return probe.free(p.x, p.y, p.z) && probe.sees(p.x, p.y, p.z); }));
  }
  return free;
}

// The contiguous free run through the front (angle 0), or through the free angle nearest it. Returns
// { lo, hi, full } in unwrapped degrees (lo ≤ hi, hi − lo < 360), or null when nothing is free.
export function frontRun(free) {
  const n = free.length, front = Math.round(180 / ORBIT_STEP);
  if (free.every(Boolean)) return { lo: -180, hi: 180 - ORBIT_STEP, full: true };
  let seed = -1;
  for (let d = 0; d <= n / 2 && seed < 0; d++) for (const k of [front + d, front - d]) { const kk = ((k % n) + n) % n; if (free[kk]) { seed = k; break; } }
  if (seed < 0) return null;
  let a = seed, b = seed;
  while (b - a < n - 1 && free[(((a - 1) % n) + n) % n]) a--;
  while (b - a < n - 1 && free[(((b + 1) % n) + n) % n]) b++;
  return { lo: -180 + a * ORBIT_STEP, hi: -180 + b * ORBIT_STEP, full: false };
}

// A sweep inside a free run that starts at `from` and travels `dir` (+1: angles rising): it ENDS on the Core's
// front — past straight-on in the direction it travels, by as much of `over` = [min, max] degrees as it takes
// to make aWant in all (the last frames hold the button and LED ring at a three-quarter with the room behind)
// — and is no longer than aMax (the start moves up when it would be). Where the front itself is not free it
// ends at the run's end nearest it. { dir, from, to, arc }, or null when that leaves nothing to sweep.
export function sweepFrom(run, dir, from, { aMax = 150, aWant = 120, over = [15, 30] } = {}) {
  let to;
  if (run.full || (run.lo <= 0 && run.hi >= 0)) {
    const need = Math.max(over[0], Math.min(over[1], aWant - Math.abs(from)));
    to = dir < 0 ? -need : need;
    if (!run.full) to = dir < 0 ? Math.max(run.lo, to) : Math.min(run.hi, to);
  } else to = dir < 0 ? run.lo : run.hi;
  if (Math.abs(to - from) > aMax) from = to - dir * aMax;
  const arc = (to - from) * dir;
  return arc > 0 ? { dir, from, to, arc } : null;
}

// The sweeps a free run allows, one per direction round the Core that ends on its front, each starting as far
// round as the run (and aMax) allow; longest first (`prefer`, +1 / −1, breaks a tie). door-to-core weighs
// them against where its walk arrives from.
export function chooseSweeps(run, sweep: Record<string, any> = {}) {
  if (!run) return [];
  const { prefer = -1 } = sweep;
  const dirs = run.full || (run.lo <= 0 && run.hi >= 0) ? [-1, 1] : [Math.abs(run.lo) < Math.abs(run.hi) ? -1 : 1];
  const options = dirs.map(dir => sweepFrom(run, dir, run.full ? -dir * 180 : dir < 0 ? run.hi : run.lo, sweep)).filter(Boolean);
  options.sort((a, b) => (b.arc - a.arc) || (a.dir === prefer ? -1 : b.dir === prefer ? 1 : 0));
  return options;
}

// Waypoints every ≤ WAYPOINT_STEP degrees from `from` to `to` (inclusive), height easing h0 → h1.
export function arcWaypoints(THREE, centre, fwd, r, from, to, h0, h1) {
  const n = Math.max(1, Math.ceil(Math.abs(to - from) / WAYPOINT_STEP));
  const out = [];
  for (let i = 0; i <= n; i++) {
    const f = i / n, deg = from + (to - from) * f, h = h0 + (h1 - h0) * (0.5 - 0.5 * Math.cos(Math.PI * f));
    out.push({ deg, p: orbitPoint(THREE, centre, fwd, r, deg, centre.y + h) });
  }
  return out;
}

// The whole plan: for each candidate radius (nominal first), the free run through the front and the sweeps in
// it; the radius whose longest sweep is longest wins, nominal preferred unless another is 4° longer per 0.1 m
// moved. { r, run, free, dir, from, to, arc (the longest sweep), options (every direction, longest first) }.
export function planOrbit({ THREE, probe, centre, fwd, radii, hs, sweep }) {
  let best = null;
  const r0 = radii[0];
  for (const r of radii) {
    const free = freeMap(THREE, probe, centre, fwd, r, hs);
    const run = frontRun(free);
    const options = chooseSweeps(run, sweep);
    if (!options.length) continue;
    const score = Math.min(options[0].arc, (sweep && sweep.aMax) || 150) - 40 * Math.abs(r - r0);
    if (!best || score > best.score + 1e-6) best = { r, run, free, score, options, ...options[0] };
  }
  return best;
}
