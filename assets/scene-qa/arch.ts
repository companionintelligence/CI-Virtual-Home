// Scene QA checks — owned by S2 (architecture). Register each with registerSceneCheck(code, ctx => issues); see registry.ts.
// New checks arrive as warnings until the layout pass promotes them (plan §2.0).
//
//   stair-headroom   walk every flight's line and cast up from each tread: the built slab overhead must be at least the
//                    headroom (2 m less the slab's own bevel) above it — the built-geometry twin of validate/arch.mts stair-void,
//                    which reads the plan: this one sees what was actually built (a void that was never cut, a liner, a beam)
//   stair-step-off   0.3 m past a flight's top step there must be floor (the storey above's slab or a site deck, within a step of the top),
//                    and nothing standing between the last step and it (a partition, a balustrade)
//   feature-detached a porch, bay, balcony or terrace part must touch the house's wall (or its roof for a terrace) — a deck or a
//                    roof left floating off the wall reads as a gap in every shot
import { registerSceneCheck } from './registry.js';

const HEADROOM = 1.9;   // metres over a tread the slab's underside must clear (2.0 less tolerance)

registerSceneCheck('stair-headroom', ({ THREE, scene, house, placedItems }) => {
  const anchors = house && house.anchors;
  if (!anchors || !(anchors.stairs || []).length) return [];
  // every floor there is: the slabs and the room floors laid on them (a room floor across the stairwell seals it as surely as the slab)
  const floors = placedItems.filter(o => o.userData && o.userData.role === 'floor');
  if (!floors.length) return [];
  scene.updateMatrixWorld(true);
  const rc = new THREE.Raycaster(); rc.far = 2.2;
  const up = new THREE.Vector3(0, 1, 0), down = new THREE.Vector3(0, -1, 0), issues = [];
  const shown = o => { for (let p = o; p; p = p.parent) if (p.visible === false) return false; return true; };
  for (const [i, st] of anchors.stairs.entries()) {
    // the walking line: the plan's (turning and arrayed flights) or the straight run's
    const pts = (st.path && st.path.length ? st.path : [st.bottom, st.top]) as number[][];
    if (st.shape === 'spiral' || st.type === 'spiral') continue;
    const topY = st.top ? st.top[1] : pts[pts.length - 1][1];
    let bump = null;
    for (let k = 0; k < pts.length - 1 && !bump; k++) {
      const a = pts[k], b = pts[k + 1], len = Math.hypot(b[0] - a[0], b[2] - a[2]), n = Math.max(2, Math.ceil(len / 0.25));
      for (let s = 0; s <= n; s++) {
        const t = s / n, x = a[0] + (b[0] - a[0]) * t, z = a[2] + (b[2] - a[2]) * t, y = a[1] + (b[1] - a[1]) * t;
        // the last step is the upper floor itself
        if (y > topY - 0.05) continue;
        // from the tread up: a slab built over the climb (the ray meets its underside)
        rc.far = 2.2; rc.set(new THREE.Vector3(x, y + 0.05, z), up);
        const hit = rc.intersectObjects(floors, true).find(h => shown(h.object));
        // (a slab within a hand's breadth is the floor the flight arrives on, not one it climbs under)
        if (hit && hit.distance > 0.3 && hit.distance < HEADROOM) { bump = { x, y, z, d: hit.distance }; break; }
        // from the storey above down: a floor laid over the climb — a room's overlay, which an upward ray passes through the back of
        rc.far = 0.9; rc.set(new THREE.Vector3(x, topY + 0.5, z), down);
        const ov = rc.intersectObjects(floors, true).find(h => shown(h.object) && Math.abs(h.point.y - topY) < 0.3);
        // (its height over the tread, from where the upward ray starts: a floor 2 m up is where a slab should be, one under 1.9 m is a lid)
        if (ov && ov.point.y - (y + 0.05) > 0.3 && ov.point.y - (y + 0.05) < HEADROOM) { bump = { x, y, z, d: ov.point.y - y }; break; }
      }
    }
    if (bump) issues.push({ level: 'warn', message: `stair ${st.from}→${st.to}${st.index ? ` #${st.index}` : ''}: ${bump.d.toFixed(2)} m of headroom over the tread at (${bump.x.toFixed(2)}, ${bump.z.toFixed(2)}) — a floor is built over the climb (a void, or autoVoid: true)`, subject: `stairs:${st.from}:${i}` });
  }
  return issues;
});

registerSceneCheck('stair-step-off', ({ THREE, scene, house, placedItems }) => {
  const anchors = house && house.anchors;
  if (!anchors || !(anchors.stairs || []).length) return [];
  // floor: the storey's slab, or a deck or a platform of the site the flight arrives on
  const floors = placedItems.filter(o => o.userData && (o.userData.role === 'floor' || o.userData.role === 'site'));
  const blockers = placedItems.filter(o => o.userData && (o.userData.isWall || o.userData.partition || o.userData.role === 'structure') && !o.userData.stair && !o.userData.isRoof);
  scene.updateMatrixWorld(true);
  const rc = new THREE.Raycaster(), down = new THREE.Vector3(0, -1, 0), issues = [];
  for (const [i, st] of anchors.stairs.entries()) {
    if (st.shape === 'spiral' || st.type === 'spiral' || !st.top || !st.dir) continue;
    const d = st.dir as number[], top = st.top as number[];
    const [sx, sz] = (st.stepOff as number[]) || [top[0] + d[0] * 0.3, top[2] + d[1] * 0.3];
    // floor under the step-off, within a step of the top tread
    rc.far = 1.2; rc.set(new THREE.Vector3(sx, top[1] + 0.6, sz), down);
    const g = rc.intersectObjects(floors, true).find(h => h.object.visible !== false);
    if (!g || Math.abs(g.point.y - top[1]) > 0.3) { issues.push({ level: 'warn', message: `stair ${st.from}→${st.to}: no floor at its step-off (${sx.toFixed(2)}, ${sz.toFixed(2)}) on ${st.to} — the top step lands in a void or off the slab`, subject: `stairs:${st.from}:${i}` }); continue; }
    // a wall or rail between the last step and the step-off, at walking height
    const from = new THREE.Vector3(top[0], top[1] + 0.9, top[2]), to = new THREE.Vector3(sx, top[1] + 0.9, sz), dir = to.clone().sub(from), len = dir.length();
    if (len < 1e-6) continue;
    rc.far = len; rc.set(from, dir.normalize());
    const w = rc.intersectObjects(blockers, true).find(h => h.object.visible !== false && h.distance > 0.02);
    if (w) issues.push({ level: 'warn', message: `stair ${st.from}→${st.to}: "${(w.object.parent && w.object.parent.name) || w.object.name}" stands between its top step and the step-off`, subject: `stairs:${st.from}:${i}` });
  }
  return issues;
});

registerSceneCheck('feature-detached', ({ THREE, scene, placedItems, trackedWalls, trackedRoofs }) => {
  const parts = placedItems.filter(o => /^(Porch \(|Porch roof|Bay roof|Bay floor|balcony deck|loggia deck|terrace deck|Canopy)/.test(o.name || ''));
  if (!parts.length || !trackedWalls.length) return [];
  scene.updateMatrixWorld(true);
  const walls = trackedWalls.map(w => new THREE.Box3().setFromObject(w));
  // a terrace is a deck on a roof of the house: the roof it stands on counts as touching
  const roofs = (trackedRoofs || []).filter(r => !(r.name && /^terrace deck/.test(r.name))).map(r => new THREE.Box3().setFromObject(r));
  const issues = [];
  for (const p of parts) {
    const b = new THREE.Box3().setFromObject(p).expandByScalar(0.16);
    const terrace = /^terrace deck/.test(p.name || '');
    if (!walls.some(w => w.intersectsBox(b)) && !(terrace && roofs.some(r => r.intersectsBox(b)))) issues.push({ level: 'warn', message: `"${p.name}" touches no wall${terrace ? ' or roof' : ''} — it floats off the house`, subject: p.name });
  }
  return issues;
});
