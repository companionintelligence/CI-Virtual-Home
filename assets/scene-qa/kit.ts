// Scene QA checks — owned by S1 (kit). Registered with registerSceneCheck(code, ctx => issues); see registry.ts.
//
//   hero-float    the Companion Core stands ON its surface: rays cast down at its box's corners and centre find the
//                 top under it, and the box's floor (anchors.hero.coreBox.minY) must meet it within 5 mm — the
//                 credenza used to float it 0.165 m and the island sank it 2 cm. Error over 5 mm of air or nothing
//                 under its centre; warn when sunk more than 5 mm into the top.
//   leaf-in-lane  an open door leaf stays out of every doorway's lane (the doorway's width, 0.9 m out on both
//                 sides) — its own included, which means it is parked within 10° of its wall — and out of the room's
//                 furniture. Static: it tests the leaves where the build parks them (S5's door opening is dynamic).
// Both arrive as the plan's new lints do; hero-float is an error from the start (plan S1 acceptance), leaf-in-lane
// a warning until the layout pass.
import { registerSceneCheck } from './registry.js';

registerSceneCheck('hero-float', ({ THREE, house, placedItems }) => {
  const h = house && house.anchors && house.anchors.hero;
  if (!h || !h.coreBox) return [];
  const b = h.coreBox, dev = h.device;
  const skip = new Set<any>();
  if (dev) dev.traverse(o => skip.add(o));
  const targets = placedItems.filter(o => o !== dev && !(o.userData && (o.userData.isCable || o.userData.fixtures || o.userData.role === 'fixture')));
  const ray = new THREE.Raycaster(), down = new THREE.Vector3(0, -1, 0), inset = 0.006;
  const at = (x, z) => {
    ray.set(new THREE.Vector3(x, b.minY + 0.05, z), down);
    const hit = ray.intersectObjects(targets, true).find(i => !skip.has(i.object) && i.object.visible !== false && !(i.object.userData && i.object.userData.isCable));
    return hit ? hit.point.y : null;
  };
  const cxz = [(b.minX + b.maxX) / 2, (b.minZ + b.maxZ) / 2];
  const pts = [cxz, [b.minX + inset, b.minZ + inset], [b.maxX - inset, b.minZ + inset], [b.minX + inset, b.maxZ - inset], [b.maxX - inset, b.maxZ - inset]];
  const ys = pts.map(([x, z]) => at(x, z));
  const where = `${h.surfaceType || h.surface} at (${cxz[0].toFixed(2)}, ${cxz[1].toFixed(2)})`;
  if (ys[0] === null) return [{ level: 'error', message: `nothing under the Core's centre (${where})`, subject: 'Companion Core (Hero)' }];
  const top = Math.max(...ys.filter(y => y !== null) as number[]), gap = b.minY - top;
  if (gap > 0.005) return [{ level: 'error', message: `the Core floats ${(gap * 1000).toFixed(0)} mm above its ${where} (top ${top.toFixed(3)}, Core ${b.minY.toFixed(3)})`, subject: 'Companion Core (Hero)' }];
  if (gap < -0.005) return [{ level: 'warn', message: `the Core sinks ${(-gap * 1000).toFixed(0)} mm into its ${where}`, subject: 'Companion Core (Hero)' }];
  return [];
});

registerSceneCheck('leaf-in-lane', ({ THREE, house, placedItems }) => {
  const a = house && house.anchors, spec = house && house.spec;
  if (!a || !Array.isArray(a.doors) || !a.doors.length) return [];
  const D = Math.PI / 180, out = [];
  type Lane = { c: [number, number]; along: [number, number]; half: number; level: string | null; id: string };
  const lanes: Lane[] = [];
  // every doorway: the hinged doors (their closed span), the exterior door openings, the partitions' doorways
  const levelY = id => ((a.levels || {})[id] || {}).y ?? 0;
  for (const d of a.doors) {
    const dir: [number, number] = [Math.sin(d.closedYaw * D), Math.cos(d.closedYaw * D)];
    lanes.push({ c: [d.hinge[0] + dir[0] * d.w / 2, d.hinge[1] + dir[1] * d.w / 2], along: dir, half: d.w / 2 + 0.02, level: d.level, id: d.id });
  }
  for (const o of a.openings || []) if (o.type === 'door' || o.type === 'slider') {
    const along: [number, number] = [Math.abs(o.normal[1]), Math.abs(o.normal[0])];
    lanes.push({ c: [o.centre[0], o.centre[2]], along, half: o.w / 2, level: o.level, id: `${o.level}:${o.side}@${o.centre[0]},${o.centre[2]}` });
  }
  for (const lv of (spec && spec.levels) || []) for (const p of lv.partitions || []) {
    if (p.door === null || p.door === undefined || !Array.isArray(p.from) || !Array.isArray(p.to)) continue;
    const len = Math.hypot(p.to[0] - p.from[0], p.to[1] - p.from[1]) || 1, along: [number, number] = [(p.to[0] - p.from[0]) / len, (p.to[1] - p.from[1]) / len];
    lanes.push({ c: [p.from[0] + along[0] * p.door, p.from[1] + along[1] * p.door], along: [Math.abs(along[0]), Math.abs(along[1])], half: (p.doorW || 0.9) / 2, level: lv.id, id: `${lv.id}:partition@${p.door}` });
  }
  const inLane = (L: Lane, x: number, z: number) => {
    const dx = x - L.c[0], dz = z - L.c[1], u = dx * L.along[0] + dz * L.along[1], v = -dx * L.along[1] + dz * L.along[0];
    return Math.abs(u) < L.half - 0.03 && Math.abs(v) < 0.9;
  };
  // the room's tall-enough things, as plan boxes on their storey
  const items = placedItems.filter(o => o.userData && o.userData.role === 'item' && !o.userData.mounted && !o.userData.foliage).map(o => {
    const bb = new THREE.Box3().setFromObject(o); return { o, bb };
  }).filter(i => !i.bb.isEmpty() && i.bb.max.y - i.bb.min.y > 0.3);
  for (const d of a.doors) {
    if (!d.open) continue;
    const dir = [Math.sin(d.openYaw * D), Math.cos(d.openYaw * D)];
    const pts = Array.from({ length: 9 }, (_, i) => [d.hinge[0] + dir[0] * d.w * (i + 1) / 9, d.hinge[1] + dir[1] * d.w * (i + 1) / 9]);
    const y0 = d.y0, y1 = d.y0 + d.h, lv = d.level;
    for (const L of lanes) {
      if (L.level !== lv) continue;
      const own = L.id === d.id;
      const hit = pts.find(([x, z]) => inLane(L, x, z));
      if (hit) out.push({ level: 'warn', message: `${d.kind} leaf ${d.id} at (${d.hinge[0]}, ${d.hinge[1]}) stands in ${own ? 'its own doorway (parked more than 10° off its wall)' : `the lane of doorway ${L.id}`}`, subject: d.id });
    }
    const clash = items.find(i => i.bb.min.y < y1 && i.bb.max.y > y0 + 0.1 && pts.some(([x, z]) => x > i.bb.min.x + 0.02 && x < i.bb.max.x - 0.02 && z > i.bb.min.z + 0.02 && z < i.bb.max.z - 0.02));
    if (clash) out.push({ level: 'warn', message: `${d.kind} leaf ${d.id} at (${d.hinge[0]}, ${d.hinge[1]}) swings into ${clash.o.userData.itemType || clash.o.name}`, subject: d.id });
  }
  return out;
});
