// Contact shadows for the live player: a soft dark pad under every piece of furniture and every potted plant that stands
// on a floor. The baked volume (viewer-ao.ts) has 0.25 m cells and cannot say "this sofa touches this floor"; this layer does.
//
// One mesh for the whole house (one draw call). Each item gets a nine-cell quad laid on its storey's floor: the middle
// cell is the item's own footprint (hidden under it anyway), the ring round it fades out over a margin that grows with
// the item's height, and the corners carry no alpha at all, so the pad is a rounded rectangle without a texture. The
// vertex alpha runs 0 at the outside to A at the footprint's edge; the fragment turns that ramp into a smooth falloff
// (smoothstep), so the edge of the pad is not a visible line. There is no image: the look is arithmetic.
//
// Where an item's footprint comes from: its group's bounds in the group's OWN frame (the batched scene keeps merged
// meshes in the group's local space), placed by the group's world matrix, so a chair turned 30 degrees gets a turned
// pad and not its world-aligned bounding box. The floor is the highest storey level at or below the item's base; an item
// standing on a rug sits on the rug's top.
//
// Not part of any product frame: the player adds it after the batch and takes it away for the page's __houseRender*
// hooks (restore). It follows an item that a shot hides (shotHidden sets `visible` per frame) by zeroing that item's pad
// alpha in tick(): only when an item flips, never per frame.

const SKIP_TYPE = /rug|runner|(^|-)mat$|curtain|^wall-|mirror|art$|hanging|chart|rail$|hooks?$|ceiling|chandelier|pendant|sconce/;
const MAX_ABOVE_FLOOR = 0.08;   // m: an item whose base is higher than this above its floor is on a surface or on a wall
const MIN_HEIGHT = 0.06;        // m: flatter than this is a rug or a mat
const MIN_SIDE = 0.12;          // m: smaller than this on both sides is clutter
const STRENGTH = 0.3;           // alpha of the pad's plateau

export type ContactStats = { items: number; quads: number; drawCalls: number };
type Item = { group: any; first: number; shown: boolean };

export function createContact(THREE: any, scene: any, house: any) {
  const b = house && house.anchors && house.anchors.bounds;
  const levels: number[] = ((house && house.spec && house.spec.levels) || []).map((l: any) => l.y || 0).sort((x: number, y: number) => x - y);
  if (!b || !levels.length) return null;
  scene.updateMatrixWorld(true);

  // ---- the rugs (item tops a pad may sit on) and the items
  type Rug = { x0: number; x1: number; z0: number; z1: number; top: number };
  const rugs: Rug[] = [], groups: { g: any; type: string }[] = [];
  const tmpBox = new THREE.Box3();
  scene.traverse((o: any) => {
    const u = o.userData;
    if (!u || !u.itemType || !o.visible) return;
    const type = String(u.itemType);
    if (u.category === 'Architecture') return;
    tmpBox.setFromObject(o);
    if (/rug|runner|(^|-)mat$/.test(type) && tmpBox.max.y - tmpBox.min.y < 0.08) { rugs.push({ x0: tmpBox.min.x, x1: tmpBox.max.x, z0: tmpBox.min.z, z1: tmpBox.max.z, top: tmpBox.max.y }); return; }
    if (SKIP_TYPE.test(type) || u.mounted || u.onSurface) return;
    groups.push({ g: o, type });
  });

  const inv = new THREE.Matrix4(), m = new THREE.Matrix4(), v = new THREE.Vector3();
  const pos: number[] = [], alpha: number[] = [], index: number[] = [];
  const items: Item[] = [];
  const corners = [[0, 0, 0], [1, 0, 0], [0, 1, 0], [1, 1, 0], [0, 0, 1], [1, 0, 1], [0, 1, 1], [1, 1, 1]];

  for (const { g } of groups) {
    // the group's bounds in its own frame
    inv.copy(g.matrixWorld).invert();
    let x0 = Infinity, y0 = Infinity, z0 = Infinity, x1 = -Infinity, y1 = -Infinity, z1 = -Infinity, any = false;
    g.traverse((n: any) => {
      if (!n.isMesh || !n.geometry || n.visible === false) return;
      if (!n.geometry.boundingBox) n.geometry.computeBoundingBox();
      const bb = n.geometry.boundingBox; if (!bb || !isFinite(bb.min.x)) return;
      m.multiplyMatrices(inv, n.matrixWorld);
      for (const c of corners) {
        v.set(c[0] ? bb.max.x : bb.min.x, c[1] ? bb.max.y : bb.min.y, c[2] ? bb.max.z : bb.min.z).applyMatrix4(m);
        x0 = Math.min(x0, v.x); y0 = Math.min(y0, v.y); z0 = Math.min(z0, v.z); x1 = Math.max(x1, v.x); y1 = Math.max(y1, v.y); z1 = Math.max(z1, v.z); any = true;
      }
    });
    if (!any) continue;
    const w = x1 - x0, d = z1 - z0, h = y1 - y0;
    if (h < MIN_HEIGHT || (w < MIN_SIDE && d < MIN_SIDE)) continue;
    // the item's centre and base in the world
    v.set((x0 + x1) / 2, y0, (z0 + z1) / 2).applyMatrix4(g.matrixWorld);
    const cx = v.x, cz = v.z, baseY = v.y;
    if (cx < b.minX || cx > b.maxX || cz < b.minZ || cz > b.maxZ) continue;   // a garden piece: no floor to lay a pad on
    let floorY = levels[0];
    for (const ly of levels) if (ly <= baseY + MAX_ABOVE_FLOOR) floorY = ly;
    if (baseY - floorY > MAX_ABOVE_FLOOR) continue;
    let y = floorY;
    for (const r of rugs) if (cx >= r.x0 && cx <= r.x1 && cz >= r.z0 && cz <= r.z1 && r.top - floorY < 0.08 && r.top > y) y = r.top;
    y += 0.004;

    // the nine-cell pad in the group's frame: x lines -e, 0, w, w+e (from the footprint's corner), likewise z
    const e = Math.min(0.16, 0.06 + 0.07 * h), ix = Math.min(0.12, 0.3 * w), iz = Math.min(0.12, 0.3 * d);
    const xs = [x0 - e, x0 + ix, x1 - ix, x1 + e], zs = [z0 - e, z0 + iz, z1 - iz, z1 + e];
    const first = pos.length / 3;
    for (let j = 0; j < 4; j++) for (let i = 0; i < 4; i++) {
      // inside the footprint's edge lines the alpha is full; on the outer lines it is 0; the four outer corners stay 0
      const edgeI = i === 0 || i === 3, edgeJ = j === 0 || j === 3;
      v.set(xs[i], 0, zs[j]).applyMatrix4(g.matrixWorld);   // (the group's y axis is up: its own y is not used)
      pos.push(v.x, y, v.z);
      alpha.push(edgeI || edgeJ ? 0 : STRENGTH);
    }
    for (let j = 0; j < 3; j++) for (let i = 0; i < 3; i++) {
      const a = first + j * 4 + i, bq = a + 1, c = a + 4, dq = a + 5;
      // a mirrored group (negative scale) flips the winding: the pad is double-sided, so no matter
      index.push(a, c, bq, bq, c, dq);
    }
    items.push({ group: g, first, shown: true });
  }
  if (!items.length) return null;

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  const color = new Float32Array((pos.length / 3) * 4);
  for (let i = 0; i < alpha.length; i++) { color[i * 4] = color[i * 4 + 1] = color[i * 4 + 2] = 1; color[i * 4 + 3] = alpha[i]; }
  const colorAttr = new THREE.BufferAttribute(color, 4);
  geo.setAttribute('color', colorAttr);
  geo.setIndex(index);
  geo.computeBoundingSphere();
  const mat = new THREE.MeshBasicMaterial({ color: 0x15100c, vertexColors: true, transparent: true, depthWrite: false, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  // the ramp across the margin becomes a smooth falloff
  mat.onBeforeCompile = shader => {
    shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', '#ifdef USE_COLOR_ALPHA\n\tdiffuseColor.a *= smoothstep( 0.0, 1.0, vColor.a / ' + STRENGTH.toFixed(2) + ' ) * ' + STRENGTH.toFixed(2) + ';\n#endif');
  };
  mat.customProgramCacheKey = () => 'vh-contact';
  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = 'Contact shadows';
  mesh.renderOrder = -5;   // before the glass and the other blended things, just after the opaque floor it lies on
  mesh.frustumCulled = false;
  mesh.castShadow = mesh.receiveShadow = false;
  mesh.userData.isHelper = false; mesh.userData.contact = true;
  mesh.matrixAutoUpdate = false;

  let on = false;
  const setItem = (it: Item, show: boolean) => {
    it.shown = show;
    for (let k = 0; k < 16; k++) { const i = it.first + k, edge = (k & 3) === 0 || (k & 3) === 3 || (k >> 2) === 0 || (k >> 2) === 3; color[i * 4 + 3] = show && !edge ? STRENGTH : 0; }
    colorAttr.needsUpdate = true;
  };
  return {
    apply() { if (on) return; on = true; scene.add(mesh); },
    restore() { if (!on) return; on = false; scene.remove(mesh); },
    /** a shot hides an item for a while (shotHidden): its pad goes with it. Cheap: one boolean per item. */
    tick(): boolean {
      let changed = false;
      for (const it of items) { const vis = it.group.visible !== false; if (vis !== it.shown) { setItem(it, vis); changed = true; } }
      return changed;
    },
    dispose() { if (on) { on = false; scene.remove(mesh); } geo.dispose(); mat.dispose(); },
    stats(): ContactStats { return { items: items.length, quads: index.length / 6, drawCalls: 1 }; },
  };
}
