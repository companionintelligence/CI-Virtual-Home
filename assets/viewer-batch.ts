// Live-only static batching for the portal's player (assets/viewer.ts calls bakeStatic once a house is built).
//
// A house is 2 000 to 4 500 meshes and, with the shadow pass, 5 000 to 13 000 draw calls a frame; on a weak CPU or a
// phone the submit cost of those calls (not the pixels) is the frame time. Most of the meshes are boxes of a few
// materials that never move, so this merges them: inside each TOGGLE UNIT — the thing visibility.ts, the layer filter
// and the shot's shotHidden()/shotPose() switch on or off as a whole — the static opaque meshes become a few merged
// meshes per (material, castShadow, receiveShadow, renderOrder, layers, 6 m cell). The merged meshes are CHILDREN OF
// THE SAME GROUP, with their vertices baked into that group's local space, so everything the page does to the group
// (visible, scale.y for a cutaway, position for the layer filter, a door pose) acts on them exactly as before. Nothing
// is ever merged across units.
//
// It is the player's alone. A product frame (a still, a film, a golden, a thumbnail, the editor) is a pure function of
// the tree and must not change by a bit, and merged geometry is the same picture but not the same float32 sums (baked
// matrices, another triangle order between coplanar faces). So nothing but viewer.ts imports this file, viewer.ts only
// calls it in view mode, `?no=batch` switches it off, and restoreStatic() puts the original meshes back.
//
// What stays a separate mesh (the walk below names each reason in `stats.skipped`):
//   - a subtree the page or a shot reaches into per frame or per lighting preset: userData.core (the Core's fan,
//     button and LED), .screen, .animate, .door (a door leaf's pivot, posed by shotPose), .world (the street: world.ts
//     swaps lit and plain window panes and fades lamp pools by preset), .fixture (applyHouseGlow scales its emissive)
//     and .windowGlow (applyHouseGlow swaps the pane's material for a glowing twin);
//   - anything see-through (transparent or transmissive: glass; the glass pass sorts and draws those on their own),
//     alphaHash materials (a roof's fade dissolves by the object-space position of each fragment, which baking into
//     the group's frame would change), a material with its own shader patch, InstancedMesh, SkinnedMesh, morph
//     targets, a partial drawRange, frustumCulled = false, a custom depth material, a hidden mesh;
//   - a toggle unit's own nested boundaries: a wall's fullGroup / cutawayGroup / baseboardGroup (visible flips per
//     wall mode), a roof, a ceiling. Each is a scope of its own; a scope never merges with its parent.
//
// `opts.hashed` (off) would also merge the roofs' alphaHash pieces: at full opacity nothing changes, but mid-fade the
// dissolve's noise pattern (hashed from each fragment's object-space position, which baking moves to the group's frame) is
// another pattern of the same density (measured: 47 000 pixels differ, MAE 4/255, for a fraction of a second). It would take
// roof-heavy houses (cocoon, cutestarter) from about 1 830 / 980 calls to 1 650 / 875. Left off so every state is pixel-identical.
//
// Materials keep their identity by default. Two materials that nothing mutates (not in a roof, a fixture, a glass
// pane, a dynamic subtree; a plain MeshStandard / Basic / Lambert with nothing but `muted` in its userData) and that
// have the same content (type, colours, roughness, metalness, the maps by uuid, side, flags) merge into one group and
// the first of them stands in: a prop that builds a fresh `std(colour)` for every board is one draw call, not forty.
//
// A merged mesh gets the union bounding sphere of its pieces, so a big unit loses per-mesh frustum culling inside a
// cell; the 6 m cell and the 65 000 vertex cap keep pieces local.
//
// Owner: S6 (ui) — the player. Reads visibility.ts's toggles by their userData tags and never edits it.

export type BatchStats = {
  before: number;          // draw calls a frame would issue for what is visible now (an array material counts its groups)
  after: number;
  meshesBefore: number;
  meshesAfter: number;
  merged: number;          // merged meshes made
  pieces: number;          // source (mesh, material group) ranges they hold
  taken: number;           // source meshes removed from the scene
  materialsBefore: number; // distinct material objects on visible meshes
  materialsAfter: number;
  skipped: Record<string, number>;
  ms: number;
};

// what a subtree carries when something reaches into it after the build (see the header)
const DYNAMIC_KEYS = ['core', 'screen', 'animate', 'door', 'world', 'fixture', 'windowGlow'];
// userData a material may carry and still be merged by content: `muted` is the fleet's colour restraint, applied at build
const BENIGN_MATERIAL_USERDATA = new Set(['muted']);
// userData on a material that says something else edits it in place
const MUTATED_MATERIAL_KEYS = ['fixture', 'windowGlow', 'orig', 'fixtureBase', '__glowTwin', '__baseEmissive'];
const CELL = 6;             // m: merge pieces only within a cell of this size (frustum culling stays local)
const MAX_VERTS = 65000;    // per merged mesh: 16-bit indices, and one draw never spans the house
const SIMPLE_MATERIALS = new Set(['MeshStandardMaterial', 'MeshBasicMaterial', 'MeshLambertMaterial']);
const DRAWABLE_MATERIALS = /^Mesh(Standard|Physical|Basic|Lambert|Phong|Toon|Matcap)Material$/;

type Piece = {
  mesh: any; geo: any; mat: any; key: string; verts: number[]; idx: number[]; matrix: any; flip: boolean; cx: number; cy: number; cz: number;
  cast: boolean; recv: boolean; ro: number; mask: number;
};
type Op = { scope: any; merged: any; sources: any[] };

// what the last bake changed, for restoreStatic()
let last: { merged: any[]; removed: { mesh: any; parent: any }[] } | null = null;

const matsOf = (m: any): any[] => (Array.isArray(m.material) ? m.material : m.material ? [m.material] : []);
const isDynamic = (n: any): boolean => { const u = n.userData; if (!u) return false; for (const k of DYNAMIC_KEYS) if (u[k]) return true; return false; };
const isBoundary = (n: any, protect: Set<any>): boolean => { const u = n.userData; return protect.has(n) || !!(u && (u.isWall || u.isRoof || u.isCeiling)); };

/** the draw calls a frame issues for what is visible (an array material draws once per geometry group) */
function census(scene: any): { calls: number; meshes: number; mats: number } {
  let calls = 0, meshes = 0; const mats = new Set<any>();
  scene.traverseVisible((o: any) => {
    if (!o.isMesh) return;
    meshes++;
    const list = matsOf(o); for (const m of list) if (m) mats.add(m);
    if (Array.isArray(o.material)) { for (const g of o.geometry.groups) if (g.count > 0 && o.material[g.materialIndex] && o.material[g.materialIndex].visible !== false) calls++; }
    else calls++;
  });
  return { calls, meshes, mats: mats.size };
}

/** every material that something edits in place, or may: the subtrees the page or a shot reaches into, every roof, and
 *  any material a builder tagged. Such a material keeps its identity (it is never replaced by another's twin) and is not
 *  the stand-in for anything. */
function mutableMaterials(scene: any): Set<any> {
  const out = new Set<any>();
  const walk = (n: any, hot: boolean) => {
    hot = hot || isDynamic(n) || !!(n.userData && n.userData.isRoof);
    if (n.isMesh) for (const m of matsOf(n)) if (m && (hot || MUTATED_MATERIAL_KEYS.some(k => m.userData && m.userData[k]))) out.add(m);
    for (const c of n.children) walk(c, hot);
  };
  walk(scene, false);
  return out;
}

const hasOwn = (o: any, k: string): boolean => Object.prototype.hasOwnProperty.call(o, k);

/** why a material cannot be part of a merged mesh (null: it can) */
function materialProblem(m: any, hashed: boolean): string | null {
  if (!m || m.visible === false) return 'hidden';
  if (m.transparent || (m.transmission || 0) > 0) return 'seeThrough';
  if (m.alphaHash && !hashed) return 'alphaHash';
  if (!DRAWABLE_MATERIALS.test(m.type) || m.wireframe) return 'material';
  if (m.clippingPlanes && m.clippingPlanes.length || m.stencilWrite) return 'shader';
  // a shader patch is fine when it is a pure function of the fragment, not of the object's own frame: textures.ts worldUV
  // maps in world metres (modelMatrix * position) and kit-build.ts neutralIndirect greys the indirect light. Any other
  // patch (or a bare customProgramCacheKey) is unknown, so its meshes stay as they are.
  if ((hasOwn(m, 'onBeforeCompile') || hasOwn(m, 'customProgramCacheKey')) && !(m.userData && (m.userData.worldUV || m.userData.neutralIndirect))) return 'shader';
  return null;
}

/** the properties two materials must share for one to stand in for the other (null: never merged by content) */
function contentKey(m: any, mutable: Set<any>): string | null {
  if (mutable.has(m) || !SIMPLE_MATERIALS.has(m.type)) return null;
  if (hasOwn(m, 'onBeforeCompile') || hasOwn(m, 'customProgramCacheKey')) return null;
  if (m.userData && Object.keys(m.userData).some(k => !BENIGN_MATERIAL_USERDATA.has(k))) return null;
  const c = (x: any) => (x && x.isColor ? x.getHex() : '-');
  const t = (x: any) => (x ? x.uuid : '-');
  const n = (x: any) => (x === undefined || x === null ? '-' : typeof x === 'number' ? +x.toFixed(6) : x.isVector2 ? `${x.x},${x.y}` : String(x));
  return [m.type, m.name, m.defines ? JSON.stringify(m.defines) : '-', c(m.color), n(m.roughness), n(m.metalness), c(m.emissive), n(m.emissiveIntensity), n(m.opacity), m.side, m.shadowSide, m.flatShading ? 1 : 0, m.vertexColors ? 1 : 0,
    m.depthWrite ? 1 : 0, m.depthTest ? 1 : 0, m.colorWrite ? 1 : 0, n(m.alphaTest), m.polygonOffset ? `${m.polygonOffsetFactor},${m.polygonOffsetUnits}` : '-', m.blending, m.fog ? 1 : 0, m.toneMapped ? 1 : 0, m.dithering ? 1 : 0,
    n(m.envMapIntensity), n(m.normalScale), n(m.bumpScale), n(m.aoMapIntensity), n(m.lightMapIntensity), n(m.reflectivity), n(m.combine),
    t(m.map), t(m.normalMap), t(m.roughnessMap), t(m.metalnessMap), t(m.aoMap), t(m.bumpMap), t(m.emissiveMap), t(m.alphaMap), t(m.envMap), t(m.lightMap), t(m.specularMap),
  ].join('|');
}

function readAttr(a: any, i: number, out: number[], size: number) {
  out[0] = a.getX(i); if (size > 1) out[1] = a.getY(i); if (size > 2) out[2] = a.getZ(i); if (size > 3) out[3] = a.getW(i);
}

export function bakeStatic(THREE: any, scene: any, opts: { protect?: any[]; dedupe?: boolean; hashed?: boolean } = {}): BatchStats {
  const skipped: Record<string, number> = {};
  const skip = (why: string, n = 1) => { skipped[why] = (skipped[why] || 0) + n; };
  const before = census(scene);
  const protect = new Set<any>(opts.protect || []);
  const dedupe = opts.dedupe !== false, hashedOk = opts.hashed === true;   // off: see `hashed` in the header
  const mutable = mutableMaterials(scene);

  // A wall's three plan groups flip visible per wall mode: each is its own scope, wherever the wall sits.
  scene.traverse((n: any) => { const u = n.userData; if (u && u.isWall) for (const k of ['fullGroup', 'cutawayGroup', 'baseboardGroup']) if (u[k]) protect.add(u[k]); });

  // how many meshes hold each geometry: one taken out of the scene is disposed only when the last holder goes
  const holders = new Map<any, number>();
  scene.traverse((n: any) => { if (n.isMesh && n.geometry) holders.set(n.geometry, (holders.get(n.geometry) || 0) + 1); });

  const canonical = new Map<string, any>();   // content key → the material that stands in for all of that content
  const standIn = (m: any): any => {
    if (!dedupe) return m;
    const k = contentKey(m, mutable); if (k === null) return m;
    const c = canonical.get(k); if (c) return c;
    canonical.set(k, m); return m;
  };

  const ops: Op[] = [];
  const scopes: any[] = [];
  const m4 = new THREE.Matrix4(), n3 = new THREE.Matrix3(), v3 = new THREE.Vector3(), box = new THREE.Box3(), ctr = new THREE.Vector3();
  const tmp = [0, 0, 0, 0];

  // one scope: the pieces of every eligible mesh under `root`, in root's frame, grouped and merged
  function bakeScope(root: any) {
    const pieces: Piece[] = [];
    const collect = (node: any, acc: any) => {
      for (const c of node.children) {
        if (c.userData && c.userData.batched) continue;
        if (isBoundary(c, protect)) { scopes.push(c); continue; }
        if (isDynamic(c)) { skip('dynamic'); continue; }
        if (c.isMesh) {
          // a mesh that carries children (the hedge's blobs hang off its base) cannot be taken out of the scene: its children would go with it
          if (c.children.length) { skip('hasChildren'); if (c.matrixAutoUpdate) c.updateMatrix(); collect(c, new THREE.Matrix4().multiplyMatrices(acc, c.matrix)); continue; }
          addMesh(c, acc, pieces); continue;
        }
        if ((c.isGroup || c.type === 'Object3D') && c.visible) {
          if (c.matrixAutoUpdate) c.updateMatrix();
          collect(c, new THREE.Matrix4().multiplyMatrices(acc, c.matrix));
        } else if (c.isGroup || c.type === 'Object3D') skip('hiddenGroup');
      }
    };
    collect(root, new THREE.Matrix4());

    // group by everything that must match for two pieces to be one draw. The cells are laid from the scope's own lowest
    // piece, not from its origin (a prop is built round its origin: a grid through it would cut every prop in eight).
    let lx = Infinity, ly = Infinity, lz = Infinity;
    for (const p of pieces) { lx = Math.min(lx, p.cx); ly = Math.min(ly, p.cy); lz = Math.min(lz, p.cz); }
    const groupKey = (p: Piece) => `${p.cast ? 1 : 0}${p.recv ? 1 : 0}|${p.ro}|${p.mask}|${p.key}|${Math.floor((p.cx - lx) / CELL)},${Math.floor((p.cy - ly) / CELL)},${Math.floor((p.cz - lz) / CELL)}`;
    const groups = new Map<string, Piece[]>();
    for (const p of pieces) { const k = groupKey(p), g = groups.get(k); if (g) g.push(p); else groups.set(k, [p]); }
    // a mesh is taken when any of its pieces has a partner; then all its pieces go (the mesh cannot be half removed)
    const taken = new Set<any>();
    for (const g of groups.values()) if (g.length > 1) for (const p of g) taken.add(p.mesh);
    if (!taken.size) { skip('noPartner', pieces.length); return; }
    const take = pieces.filter(p => taken.has(p.mesh));
    skip('noPartner', pieces.length - take.length);
    const byKey = new Map<string, Piece[]>();
    for (const p of take) { const k = groupKey(p), g = byKey.get(k); if (g) g.push(p); else byKey.set(k, [p]); }
    const role = root.userData && root.userData.role;
    for (const g of byKey.values()) {
      let start = 0;
      while (start < g.length) {
        let end = start, verts = 0;
        while (end < g.length && (end === start || verts + g[end].verts.length <= MAX_VERTS)) verts += g[end++].verts.length;
        const chunk = g.slice(start, end); start = end;
        const merged = mergePieces(chunk);
        merged.userData = { batched: true, role, pieces: chunk.length };
        ops.push({ scope: root, merged, sources: [...new Set(chunk.map(p => p.mesh))] });
      }
    }
  }

  function addMesh(mesh: any, acc: any, out: Piece[]) {
    const geo = mesh.geometry;
    if (mesh.isInstancedMesh || mesh.isSkinnedMesh || mesh.isBatchedMesh) return skip('instanced');
    if (!mesh.visible) return skip('hidden');
    if (!geo || !geo.attributes || !geo.attributes.position) return skip('geometry');
    if (mesh.frustumCulled === false) return skip('frustumCulled');
    if (mesh.customDepthMaterial || mesh.customDistanceMaterial || hasOwn(mesh, 'onBeforeRender') || hasOwn(mesh, 'onAfterRender')) return skip('custom');
    if (geo.morphAttributes && Object.keys(geo.morphAttributes).length) return skip('morph');
    if (geo.attributes.tangent) return skip('tangent');
    const total = geo.index ? geo.index.count : geo.attributes.position.count;
    if (geo.drawRange.start !== 0 || geo.drawRange.count < total) return skip('drawRange');
    const mats = matsOf(mesh);
    for (const m of mats) { const why = materialProblem(m, hashedOk); if (why) return skip(why); }
    const ranges: { start: number; count: number; mat: any }[] = [];
    if (Array.isArray(mesh.material)) {
      for (const g of geo.groups) {
        const count = Math.min(g.count, total - g.start), m = mesh.material[g.materialIndex];
        if (count >= 3 && m) ranges.push({ start: g.start, count: count - (count % 3), mat: m });
      }
      if (!ranges.length) return skip('noGroups');
    } else ranges.push({ start: 0, count: total - (total % 3), mat: mesh.material });
    if (mesh.matrixAutoUpdate) mesh.updateMatrix();
    m4.multiplyMatrices(acc, mesh.matrix);
    if (!geo.boundingBox) geo.computeBoundingBox();
    ctr.copy(geo.boundingBox.getCenter(v3)).applyMatrix4(m4);
    const attrSig = Object.keys(geo.attributes).sort().map(k => `${k}${geo.attributes[k].itemSize}`).join(',');
    const flip = m4.determinant() < 0;
    const pos = geo.attributes.position, vcount = pos.count;
    for (const r of ranges) {
      const verts: number[] = [], idx: number[] = [];
      if (geo.index) {
        const remap = new Int32Array(vcount).fill(-1), ia = geo.index;
        for (let i = r.start; i < r.start + r.count; i++) { const v = ia.getX(i); if (remap[v] < 0) { remap[v] = verts.length; verts.push(v); } idx.push(remap[v]); }
      } else for (let i = r.start; i < r.start + r.count; i++) { idx.push(verts.length); verts.push(i); }
      if (flip) for (let i = 0; i + 2 < idx.length; i += 3) { const t = idx[i + 1]; idx[i + 1] = idx[i + 2]; idx[i + 2] = t; }
      const mat = standIn(r.mat);
      out.push({ mesh, geo, mat, key: `${mat.id}|${attrSig}`, verts, idx, matrix: m4.clone(), flip, cx: ctr.x, cy: ctr.y, cz: ctr.z,
        cast: !!mesh.castShadow, recv: !!mesh.receiveShadow, ro: mesh.renderOrder, mask: mesh.layers.mask });
    }
  }

  function mergePieces(chunk: Piece[]): any {
    let nv = 0, ni = 0; for (const p of chunk) { nv += p.verts.length; ni += p.idx.length; }
    const names = Object.keys(chunk[0].geo.attributes);
    const arrays: Record<string, Float32Array> = {}, sizes: Record<string, number> = {};
    for (const k of names) { sizes[k] = chunk[0].geo.attributes[k].itemSize; arrays[k] = new Float32Array(nv * sizes[k]); }
    const index = nv > 65535 ? new Uint32Array(ni) : new Uint16Array(ni);
    let vo = 0, io = 0;
    for (const p of chunk) {
      n3.getNormalMatrix(p.matrix);
      for (const k of names) {
        const a = p.geo.attributes[k], s = sizes[k], dst = arrays[k];
        for (let j = 0; j < p.verts.length; j++) {
          readAttr(a, p.verts[j], tmp, s);
          if (k === 'position') { v3.set(tmp[0], tmp[1], tmp[2]).applyMatrix4(p.matrix); tmp[0] = v3.x; tmp[1] = v3.y; tmp[2] = v3.z; }
          else if (k === 'normal') { v3.set(tmp[0], tmp[1], tmp[2]).applyMatrix3(n3).normalize(); tmp[0] = v3.x; tmp[1] = v3.y; tmp[2] = v3.z; }
          const o = (vo + j) * s; for (let c = 0; c < s; c++) dst[o + c] = tmp[c];
        }
      }
      for (let j = 0; j < p.idx.length; j++) index[io + j] = p.idx[j] + vo;
      vo += p.verts.length; io += p.idx.length;
    }
    const g = new THREE.BufferGeometry();
    for (const k of names) g.setAttribute(k, new THREE.BufferAttribute(arrays[k], sizes[k]));
    g.setIndex(new THREE.BufferAttribute(index, 1));
    g.computeBoundingBox(); g.computeBoundingSphere();
    const first = chunk[0], mesh = new THREE.Mesh(g, first.mat);
    mesh.castShadow = first.cast; mesh.receiveShadow = first.recv; mesh.renderOrder = first.ro; mesh.layers.mask = first.mask;
    mesh.name = 'batched';
    mesh.matrixAutoUpdate = false; mesh.updateMatrix();   // it sits at its group's origin and never moves on its own
    return mesh;
  }

  // ---- phase 1 (nothing in the scene changes): every scope's merged meshes. A throw here leaves the scene untouched.
  for (const c of scene.children) {
    const u = c.userData;
    if (!u || !u.generated || u.isHelper || !(c.isGroup || c.type === 'Object3D')) continue;
    if (isDynamic(c)) { skip('dynamic'); continue; }
    scopes.push(c);
  }
  for (let i = 0; i < scopes.length; i++) bakeScope(scopes[i]);   // bakeScope appends the nested boundaries it meets

  // ---- phase 2: swap them in
  const removed: { mesh: any; parent: any }[] = [], mergedList: any[] = [];
  let pieces = 0, takenN = 0;
  for (const op of ops) {
    op.scope.add(op.merged); mergedList.push(op.merged); pieces += op.merged.userData.pieces;
    for (const s of op.sources) {
      if (!s.parent) continue;   // (already taken by another op: a mesh's pieces can land in several)
      removed.push({ mesh: s, parent: s.parent }); s.parent.remove(s); takenN++;
      const left = (holders.get(s.geometry) || 1) - 1; holders.set(s.geometry, left);
      if (left === 0) s.geometry.dispose();
    }
  }
  last = { merged: mergedList, removed };
  // A material that stood in for others (or whose meshes all merged) is drawn by nothing now. The page may have drawn the
  // house once before this ran (its own first frame), which compiled programs for the originals: release them here, or
  // they stay held for as long as the page lives. dispose() only lets go of the GPU side; restoreStatic() draws them again.
  const live = new Set<any>();
  scene.traverse((n: any) => { if (n.isMesh) for (const m of matsOf(n)) live.add(m); });
  for (const { mesh } of removed) for (const m of matsOf(mesh)) if (!live.has(m)) { live.add(m); m.dispose(); }
  const after = census(scene);
  return { before: before.calls, after: after.calls, meshesBefore: before.meshes, meshesAfter: after.meshes, merged: mergedList.length, pieces, taken: takenN, materialsBefore: before.mats, materialsAfter: after.mats, skipped, ms: 0 };
}

/** put the original meshes back (the merged ones go, geometry disposed); what `?no=batch` would have shown */
export function restoreStatic(): void {
  if (!last) return;
  for (const m of last.merged) { if (m.parent) m.parent.remove(m); m.geometry.dispose(); }
  for (const { mesh, parent } of last.removed) parent.add(mesh);   // (a geometry disposed at the bake is uploaded again on the next draw)
  last = null;
}
