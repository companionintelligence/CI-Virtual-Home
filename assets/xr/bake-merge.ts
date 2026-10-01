// assets/xr/bake-merge.ts : the merge half of the XR bake. THREE is injected (as everywhere in assets/), nothing here touches the
// renderer, a light or a shadow map: it WALKS the live scene, DECIDES what an XR frame draws, and BUILDS the merged meshes. The caller
// (bake.ts) commits the result (adds the meshes, hides the originals) and owns the undo.
//
// WHY it exists. A headset draws the house twice per frame (once per eye; three r169 has no multiview) on a mobile GPU. The 2D player's
// static batch (viewer-batch.ts) already folds a house from 5 000 to 13 000 calls to about 400 for one eye; that is still 800 stereo
// calls, four times what a Quest 3 can submit at 72 Hz. So the XR picture is a different, much coarser representation of the SAME house:
//
//   - the world (street, neighbours, tree line) and, on the standalone tier, the planted site are not drawn at all;
//   - see-through meshes (glass, water, lamp shades) are not drawn: transmission would draw the whole opaque scene again per eye;
//   - every flat-colour material (no map, nothing emissive, no shader patch) becomes ONE vertex-coloured MeshStandardMaterial per
//     (roughness, metalness, side) bucket, so a prop's forty boards and a wall's trim collapse into the draws of their cell;
//   - a textured or emissive material is merged on its own (a clone of it, with XR-sized copies of its textures);
//   - everything is cut into cells (6 m x 6 m x one storey) so a teleport can show only what is near (bake-lod.ts) and the frustum
//     still culls inside a storey.
//
// What stays as built (and stays visible): roofs and ceilings (xr-locomotion hides them with the head), InstancedMeshes outside the
// world (the recessed cans, which are part of the ceilings), the Core's screen and every subtree that ticks per frame. What is baked
// INTO A FRAME instead of the world: a door leaf (userData.door pivot) and the Core's fan rotor. Their meshes are merged in the
// pivot's own coordinates and added as children of the pivot, so the pivot still turns them; the 2D originals are hidden, never removed.
//
// The originals are never mutated: no visible flag here, no material edit. The XR meshes use their own material objects (clones, or
// the shared vertex-coloured buckets), so a program the XR light count compiles is never one the 2D player's materials hold, and leaving
// VR does not recompile the house. The exception is a material something edits in place while the house is on screen (a fixture's glow,
// the Core's LED): it is used as it is, so a lighting change reaches the XR mesh too.
//
// Not deterministic-critical: this file is live-player only (assets/xr/ is imported by nothing the goldens, fixtures, films or stills
// load), so it may read the clock for its report.

export type Frame = any;   // a THREE.Object3D the merged mesh is a child of (null: the world)

export interface BakeOptions {
  /** 'ground': hide every planted/built thing on the lot except the lot itself; 'all': merge the site too (tethered, vision) */
  site: 'ground' | 'all';
  cellM: number;
  /** XR-only downsampled copies of canvas textures to this edge, in px (null: as built) */
  textureCapPx: number | null;
  /** storeys, sorted by y; levelAt() below turns a world y into an index */
  levels: Array<{ y: number; h: number }>;
}

/** one merged mesh: its box in world metres, its storey, and what to do with it when the person moves */
export interface Merged {
  mesh: any; frame: Frame;
  box: [number, number, number, number, number, number];
  level: number;               // storey index; -1: the ground, shown whatever storey the head is on
  tris: number; verts: number; bytes: number;
  kind: 'flat' | 'textured';
  cell: string;
}

export interface Plan {
  hide: any[];                 // originals to hide (merged sources, the world, see-through meshes)
  pieces: Piece[];
  counts: { world: number; site: number; seeThrough: number; sources: number; kept: number; keptInstanced: number; skipped: number; helpers: number };
  keptMeshes: any[];           // meshes that stay as built and stay visible
}

type Range = { start: number; count: number; mat: any };
export interface Piece {
  mesh: any; geo: any; ranges: Range[]; matrix: any; frame: Frame; hot: boolean; core: boolean;
  cast: boolean; recv: boolean; ro: number; mask: number; ground: boolean;
  cx: number; cy: number; cz: number;
}

const hasOwn = (o: any, k: string): boolean => Object.prototype.hasOwnProperty.call(o, k);
const matsOf = (m: any): any[] => (Array.isArray(m.material) ? m.material : m.material ? [m.material] : []);

/** the storey index of a world y (levels sorted by y). kit-build.ts's collectDoors uses the same 0.3 m allowance. */
export function levelAt(levels: Array<{ y: number }>, y: number): number {
  if (!levels.length) return Math.max(0, Math.floor(y / 3));
  let best = 0;
  for (let i = 0; i < levels.length; i++) if (y > levels[i].y - 0.3) best = i;
  return best;
}

// userData that says "something edits this subtree's materials in place after the build" (viewer-batch.ts DYNAMIC_KEYS, minus the ones
// that keep a subtree out of the merge altogether)
const HOT_KEYS = ['fixture', 'windowGlow'];
const MUTATED_MATERIAL_KEYS = ['fixture', 'windowGlow', 'orig', 'fixtureBase', '__glowTwin', '__baseEmissive'];
const TEXTURE_SLOTS = ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'aoMap', 'bumpMap', 'emissiveMap', 'alphaMap', 'lightMap', 'displacementMap'];
const FLAT_SLOTS = [...TEXTURE_SLOTS, 'envMap', 'specularMap'];
const MAX_VERTS = 65000;     // per merged mesh: 16-bit indices, and one draw never spans the house

/** Walk the scene and decide. Nothing changes. `opts.site` says whether the lot's planting is drawn. */
export function planBake(THREE: any, scene: any, opts: BakeOptions): Plan {
  const hide: any[] = [], pieces: Piece[] = [], keptMeshes: any[] = [];
  const counts = { world: 0, site: 0, seeThrough: 0, sources: 0, kept: 0, keptInstanced: 0, skipped: 0, helpers: 0 };
  const m4 = new THREE.Matrix4(), inv = new THREE.Matrix4(), ctr = new THREE.Vector3();

  type Ctx = { hide: 'world' | 'site' | 'helper' | null; keep: boolean; frame: Frame; hot: boolean; core: boolean; ground: boolean };
  // ctx: what the nearest tagged ancestor says. `keep`: stays as built. `frame`: merged into this object's own coordinates.
  const walk = (node: any, ctx: Ctx) => {
    for (const c of node.children) {
      if (!c.visible) continue;
      const u = c.userData || {};
      let next = ctx;
      if (u.isHelper) next = { ...next, hide: 'helper' };
      else if (u.world) next = { ...next, hide: 'world' };
      else if (u.siteType || u.role === 'site') next = { ...next, hide: opts.site === 'all' ? next.hide : 'site' };
      if (u.role === 'ground') next = { ...next, ground: true };
      // a roof or ceiling, a screen (its canvas texture is redrawn per frame) or something with its own animate(): left exactly as built
      if (u.isRoof || u.isCeiling || u.screen || typeof u.animate === 'function') next = { ...next, keep: true };
      // a door leaf and the Core's fan rotor turn about a pivot: their meshes are baked into the pivot's frame
      if (!next.keep && !next.frame && (u.door || c.name === 'fan rotor')) next = { ...next, frame: c };
      if (HOT_KEYS.some(k => u[k])) next = { ...next, hot: true };
      if (u.core) next = { ...next, core: true };
      if (c.isMesh || c.isLine || c.isPoints || c.isSprite) { visit(c, next); }
      if (c.children.length) walk(c, next);
    }
  };

  const visit = (mesh: any, ctx: Ctx) => {
    if (ctx.hide === 'world') { hide.push(mesh); counts.world++; return; }
    if (ctx.hide === 'site') { hide.push(mesh); counts.site++; return; }
    if (ctx.hide === 'helper') { hide.push(mesh); counts.helpers++; return; }
    if (!mesh.isMesh) { counts.kept++; keptMeshes.push(mesh); return; }          // a line, points or a sprite elsewhere: as built
    if (ctx.keep) { counts.kept++; keptMeshes.push(mesh); return; }
    if (mesh.isInstancedMesh || mesh.isSkinnedMesh || mesh.isBatchedMesh) { counts.kept++; counts.keptInstanced++; keptMeshes.push(mesh); return; }
    const geo = mesh.geometry;
    if (!geo || !geo.attributes || !geo.attributes.position) { counts.skipped++; return; }
    const mats = matsOf(mesh);
    if (!mats.length) { counts.skipped++; return; }
    // see-through (glass, water, a lamp shade, a decal's soft edge): not drawn in a headset. A mesh whose every material is hidden is the same.
    if (mats.some(m => !m || m.visible === false || m.transparent || (m.transmission || 0) > 0)) { hide.push(mesh); counts.seeThrough++; return; }
    // what a merge cannot represent stays as built and visible: another material type, per-vertex colours, morphs, tangents, a partial draw range
    if (mats.some(m => !/^Mesh(Standard|Physical|Basic|Lambert|Phong|Toon|Matcap)Material$/.test(m.type) || m.wireframe || m.vertexColors || (m.clippingPlanes && m.clippingPlanes.length) || m.stencilWrite)
      || (geo.morphAttributes && Object.keys(geo.morphAttributes).length) || geo.attributes.tangent
      || mesh.customDepthMaterial || mesh.customDistanceMaterial || hasOwn(mesh, 'onBeforeRender') || hasOwn(mesh, 'onAfterRender')
      || ((geo.attributes.uv1) && mats.some(m => m.aoMap || m.lightMap))) { counts.kept++; keptMeshes.push(mesh); return; }
    const total = geo.index ? geo.index.count : geo.attributes.position.count;
    if (geo.drawRange.start !== 0 || geo.drawRange.count < total) { counts.kept++; keptMeshes.push(mesh); return; }
    const ranges: Range[] = [];
    if (Array.isArray(mesh.material)) {
      for (const g of geo.groups) {
        const count = Math.min(g.count, total - g.start), m = mesh.material[g.materialIndex];
        if (count >= 3 && m) ranges.push({ start: g.start, count: count - (count % 3), mat: m });
      }
      if (!ranges.length) { counts.skipped++; return; }
    } else ranges.push({ start: 0, count: total - (total % 3), mat: mesh.material });
    // the mesh's matrix into the frame it is baked into (the world, or a pivot's own coordinates)
    m4.copy(mesh.matrixWorld);
    if (ctx.frame) { inv.copy(ctx.frame.matrixWorld).invert(); m4.premultiply(inv); }
    if (!geo.boundingBox) geo.computeBoundingBox();
    ctr.copy(geo.boundingBox.getCenter(new THREE.Vector3())).applyMatrix4(mesh.matrixWorld);   // always the world centre: cells are world cells
    pieces.push({ mesh, geo, ranges, matrix: m4.clone(), frame: ctx.frame, hot: ctx.hot, core: ctx.core, cast: !!mesh.castShadow, recv: !!mesh.receiveShadow, ro: mesh.renderOrder, mask: mesh.layers.mask, ground: ctx.ground, cx: ctr.x, cy: ctr.y, cz: ctr.z });
    hide.push(mesh); counts.sources++;
  };

  // the scene's own top level can carry tags too (the world group, a roof group), so walk it as a parent
  walk(scene, { hide: null, keep: false, frame: null, hot: false, core: false, ground: false });
  return { hide, pieces, counts, keptMeshes };
}

// ---------------------------------------------------------------------------------------------------------------- materials

export interface MatKit {
  /** the XR material for a source material (a clone or a shared bucket), and the bucket key it merges under */
  resolve(src: any, hot: boolean, core: boolean): { mat: any; flat: boolean; key: string };
  owned: any[];                // materials made here (disposed at restore)
  textures: any[];             // texture copies made here (disposed at restore)
  textureBytes(): number;      // all textures the XR meshes use, after the cap
}

const bucket = (v: number) => Math.round((v || 0) * 3) / 3;

function isFlat(m: any): boolean {
  if (m.type !== 'MeshStandardMaterial') return false;
  for (const k of FLAT_SLOTS) if (m[k]) return false;
  if (m.alphaHash || m.alphaTest > 0 || m.wireframe || m.flatShading) return false;
  if (m.emissive && (m.emissive.r > 0 || m.emissive.g > 0 || m.emissive.b > 0) && m.emissiveIntensity > 0) return false;
  if (hasOwn(m, 'onBeforeCompile') || hasOwn(m, 'customProgramCacheKey')) return false;   // a patched shader cannot be folded into a bucket
  if (m.polygonOffset || !m.depthWrite || !m.depthTest || !m.colorWrite || m.blending !== 1) return false;
  return true;
}

/** Downsample a canvas/image texture to `cap` px on its long edge. Returns the same texture when it needs no copy (small enough, or
 *  not a drawable image: a DataTexture, a cube). The copy carries the sampler state of the source. */
function capTexture(THREE: any, tex: any, cap: number | null, made: Map<any, any>, list: any[]): any {
  if (!tex || !cap) return tex;
  const hit = made.get(tex); if (hit) return hit;
  const img = tex.image;
  const w = img && (img.naturalWidth || img.width), h = img && (img.naturalHeight || img.height);
  const drawable = img && (img instanceof HTMLCanvasElement || img instanceof HTMLImageElement || (typeof ImageBitmap !== 'undefined' && img instanceof ImageBitmap));
  if (!drawable || !w || !h || Math.max(w, h) <= cap || tex.isCompressedTexture || tex.isCubeTexture) { made.set(tex, tex); return tex; }
  const k = cap / Math.max(w, h);
  const cw = Math.max(1, Math.round(w * k)), ch = Math.max(1, Math.round(h * k));
  const cv = document.createElement('canvas'); cv.width = cw; cv.height = ch;
  const cx = cv.getContext('2d'); if (!cx) { made.set(tex, tex); return tex; }
  cx.imageSmoothingEnabled = true; (cx as any).imageSmoothingQuality = 'high';
  cx.drawImage(img, 0, 0, cw, ch);
  const t = new THREE.CanvasTexture(cv);
  t.wrapS = tex.wrapS; t.wrapT = tex.wrapT; t.repeat.copy(tex.repeat); t.offset.copy(tex.offset); t.center.copy(tex.center); t.rotation = tex.rotation;
  t.colorSpace = tex.colorSpace; t.anisotropy = tex.anisotropy; t.flipY = tex.flipY; t.channel = tex.channel;
  t.minFilter = tex.minFilter; t.magFilter = tex.magFilter; t.generateMipmaps = tex.generateMipmaps; t.premultiplyAlpha = tex.premultiplyAlpha;
  t.matrixAutoUpdate = tex.matrixAutoUpdate; if (!tex.matrixAutoUpdate) t.matrix.copy(tex.matrix);
  t.userData = { xrCopyOf: tex.uuid };
  made.set(tex, t); list.push(t);
  return t;
}

export function createMatKit(THREE: any, cap: number | null, mutable: Set<any>): MatKit {
  const owned: any[] = [], textures: any[] = [];
  const buckets = new Map<string, any>(), clones = new Map<any, any>(), madeTex = new Map<any, any>();
  const used = new Set<any>();
  const kit: MatKit = {
    owned, textures,
    resolve(src: any, hot: boolean, core: boolean) {
      // a material that something edits in place keeps its identity: the glow reaches the XR mesh, and it is merged on its own.
      // (The Core's LED, status ring and desk glow are the glowing ones; the rest of its chassis is an ordinary flat or textured material.)
      const glows = core && src.emissive && src.emissive.getHex() !== 0;
      if (hot || glows || mutable.has(src) || (src.userData && MUTATED_MATERIAL_KEYS.some(k => src.userData[k]))) {
        for (const k of TEXTURE_SLOTS) if (src[k]) used.add(src[k]);
        return { mat: src, flat: false, key: `own|${src.uuid}` };
      }
      if (isFlat(src)) {
        const r = bucket(src.roughness), mt = bucket(src.metalness), key = `flat|${r}|${mt}|${src.side}`;
        let b = buckets.get(key);
        if (!b) {
          b = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: r, metalness: mt, side: src.side });
          b.name = `xr flat r${r.toFixed(2)} m${mt.toFixed(2)} s${src.side}`; b.userData = { xrBake: true };
          buckets.set(key, b); owned.push(b);
        }
        return { mat: b, flat: true, key };
      }
      let c = clones.get(src);
      if (!c) {
        c = src.clone();
        // clone() copies no function property: the patch that makes a world-space UV or greys the indirect light must come along
        if (hasOwn(src, 'onBeforeCompile')) c.onBeforeCompile = src.onBeforeCompile;
        if (hasOwn(src, 'customProgramCacheKey')) c.customProgramCacheKey = src.customProgramCacheKey;
        c.userData = { ...(src.userData || {}), xrBake: true };
        for (const k of TEXTURE_SLOTS) if (src[k]) c[k] = capTexture(THREE, src[k], cap, madeTex, textures);
        for (const k of TEXTURE_SLOTS) if (c[k]) used.add(c[k]);
        clones.set(src, c); owned.push(c);
      }
      return { mat: c, flat: false, key: `clone|${src.uuid}` };
    },
    textureBytes() {
      let bytes = 0;
      for (const t of used) {
        const img = t.image; const w = img && (img.naturalWidth || img.width) || 0, h = img && (img.naturalHeight || img.height) || 0;
        bytes += w * h * 4 * (t.generateMipmaps ? 1.333 : 1);
      }
      return bytes;
    },
  };
  return kit;
}

/** every material something edits in place (viewer-batch.ts mutableMaterials): the fixtures, glow panes, the Core, any roof */
export function mutableMaterials(scene: any): Set<any> {
  const out = new Set<any>();
  const walk = (n: any, hot: boolean) => {
    const u = n.userData || {};
    hot = hot || HOT_KEYS.some(k => u[k]) || !!u.isRoof;
    if (n.isMesh) for (const m of matsOf(n)) if (m && (hot || (m.userData && MUTATED_MATERIAL_KEYS.some(k => m.userData[k])))) out.add(m);
    for (const c of n.children) walk(c, hot);
  };
  walk(scene, false);
  return out;
}

// ---------------------------------------------------------------------------------------------------------------- merge

export interface BuildResult {
  merged: Merged[]; kit: MatKit; geometries: any[]; bytes: number; tris: number; groups: number;
  /** source meshes whose material object the XR mesh uses as it is (fixtures, glow): their 2D program is replaced by the XR one until they are drawn again */
  ownSources: any[];
}

type Item = { piece: Piece; range: Range; mat: any; flat: boolean };

/** Group the pieces by (cell, storey, material bucket, shadow flags, frame) and build one mesh per group (split at 65 000 vertices). */
export function buildMerged(THREE: any, plan: Plan, opts: BakeOptions, mutable: Set<any>): BuildResult {
  const kit = createMatKit(THREE, opts.textureCapPx, mutable);
  const ownSources = new Set<any>();
  const groups = new Map<string, { items: Item[]; mat: any; flat: boolean; level: number; cell: string; frame: Frame; cast: boolean; recv: boolean; ro: number; mask: number; uv: boolean }>();
  for (const p of plan.pieces) {
    const level = p.ground ? -1 : levelAt(opts.levels, p.frame ? p.frame.getWorldPosition(new THREE.Vector3()).y : p.cy);
    const cell = `${Math.floor(p.cx / opts.cellM)}_${level}_${Math.floor(p.cz / opts.cellM)}`;
    for (const range of p.ranges) {
      const r = kit.resolve(range.mat, p.hot, p.core);
      const uv = !r.flat && !!p.geo.attributes.uv;
      const key = `${cell}|${r.key}|${p.ro}|${p.mask}|${p.frame ? p.frame.uuid : '-'}|${uv ? 'uv' : 'nouv'}`;
      let g = groups.get(key);
      if (!g) { g = { items: [], mat: r.mat, flat: r.flat, level, cell, frame: p.frame, cast: p.cast, recv: p.recv, ro: p.ro, mask: p.mask, uv }; groups.set(key, g); }
      g.items.push({ piece: p, range, mat: r.mat, flat: r.flat });
      if (r.mat === range.mat) ownSources.add(p.mesh);
    }
  }

  const merged: Merged[] = [], geometries: any[] = [];
  const v3 = new THREE.Vector3(), n3 = new THREE.Matrix3();
  let bytes = 0, tris = 0;
  for (const g of groups.values()) {
    let start = 0;
    while (start < g.items.length) {
      // count each item's unique vertices (a mesh with an index uses only what its range references)
      let end = start, verts = 0;
      const remaps: Array<{ remap: Int32Array | null; list: number[] | null; n: number }> = [];
      while (end < g.items.length) {
        const it = g.items[end], geo = it.piece.geo, pos = geo.attributes.position;
        let n: number, remap: Int32Array | null = null, list: number[] | null = null;
        if (geo.index) {
          remap = new Int32Array(pos.count).fill(-1); list = [];
          const ia = geo.index;
          for (let i = it.range.start; i < it.range.start + it.range.count; i++) { const v = ia.getX(i); if (remap[v] < 0) { remap[v] = list.length; list.push(v); } }
          n = list.length;
        } else n = it.range.count;
        if (end > start && verts + n > MAX_VERTS) break;
        verts += n; remaps.push({ remap, list, n }); end++;
      }
      const chunk = g.items.slice(start, end);
      start = end;
      let ni = 0; for (const it of chunk) ni += it.range.count;
      const position = new Float32Array(verts * 3), normal = new Float32Array(verts * 3);
      const uvArr = g.uv ? new Float32Array(verts * 2) : null;
      const color = g.flat ? new Uint16Array(verts * 4) : null;
      const index = verts > 65535 ? new Uint32Array(ni) : new Uint16Array(ni);
      let vo = 0, io = 0;
      const box: [number, number, number, number, number, number] = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity];
      for (let ci = 0; ci < chunk.length; ci++) {
        const it = chunk[ci], p = it.piece, geo = p.geo, rm = remaps[ci];
        const pos = geo.attributes.position, nor = geo.attributes.normal, uv = geo.attributes.uv;
        const me = p.matrix.elements;
        n3.getNormalMatrix(p.matrix);
        const flip = p.matrix.determinant() < 0;
        // the source vertex of the j-th merged vertex of this item
        const nv = rm.n;
        for (let j = 0; j < nv; j++) {
          const sv = rm.list ? rm.list[j] : it.range.start + j;
          const o = (vo + j) * 3;
          const x = pos.getX(sv), y = pos.getY(sv), z = pos.getZ(sv);
          const px = me[0] * x + me[4] * y + me[8] * z + me[12], py = me[1] * x + me[5] * y + me[9] * z + me[13], pz = me[2] * x + me[6] * y + me[10] * z + me[14];
          position[o] = px; position[o + 1] = py; position[o + 2] = pz;
          if (nor) { v3.set(nor.getX(sv), nor.getY(sv), nor.getZ(sv)).applyMatrix3(n3).normalize(); normal[o] = v3.x; normal[o + 1] = v3.y; normal[o + 2] = v3.z; }
          else { normal[o] = 0; normal[o + 1] = 1; normal[o + 2] = 0; }
          if (uvArr) { if (uv) { uvArr[(vo + j) * 2] = uv.getX(sv); uvArr[(vo + j) * 2 + 1] = uv.getY(sv); } }
          if (px < box[0]) box[0] = px; if (py < box[1]) box[1] = py; if (pz < box[2]) box[2] = pz;
          if (px > box[3]) box[3] = px; if (py > box[4]) box[4] = py; if (pz > box[5]) box[5] = pz;
        }
        if (color) {
          // the source material's colour, in the linear working space three multiplies vertex colours in; 16 bits, so a dark brown keeps its hue
          const c = it.range.mat.color; const r = Math.round(c.r * 65535), gg = Math.round(c.g * 65535), b = Math.round(c.b * 65535);
          for (let j = 0; j < nv; j++) { const o = (vo + j) * 4; color[o] = r; color[o + 1] = gg; color[o + 2] = b; color[o + 3] = 65535; }
        }
        // indices (rebased to the merged vertex numbering; a mirrored transform flips the winding back)
        if (geo.index) { const ia = geo.index; for (let i = 0; i < it.range.count; i++) index[io + i] = rm.remap![ia.getX(it.range.start + i)] + vo; }
        else for (let i = 0; i < it.range.count; i++) index[io + i] = vo + i;
        if (flip) for (let i = 0; i + 2 < it.range.count; i += 3) { const t = index[io + i + 1]; index[io + i + 1] = index[io + i + 2]; index[io + i + 2] = t; }
        vo += nv; io += it.range.count;
      }
      const geom = new THREE.BufferGeometry();
      geom.setAttribute('position', new THREE.BufferAttribute(position, 3));
      geom.setAttribute('normal', new THREE.BufferAttribute(normal, 3));
      if (uvArr) geom.setAttribute('uv', new THREE.BufferAttribute(uvArr, 2));
      if (color) geom.setAttribute('color', new THREE.BufferAttribute(color, 4, true));
      geom.setIndex(new THREE.BufferAttribute(index, 1));
      // a frame's vertices were baked with inverse(frame) * mesh, so they ARE in the frame's coordinates and so is the sphere three
      // culls with (it moves it with the pivot); the LOD box below is the world box
      geom.computeBoundingBox(); geom.computeBoundingSphere();
      if (g.frame) {
        const wb = new THREE.Box3(new THREE.Vector3(box[0], box[1], box[2]), new THREE.Vector3(box[3], box[4], box[5])).applyMatrix4(g.frame.matrixWorld);
        box[0] = wb.min.x; box[1] = wb.min.y; box[2] = wb.min.z; box[3] = wb.max.x; box[4] = wb.max.y; box[5] = wb.max.z;
      }
      const mesh = new THREE.Mesh(geom, g.mat);
      // every merged mesh casts and receives: splitting by the 2D flags would multiply the draws by up to four, and the static sun map is the
      // headset's only shadow (a rug that casts, a glow plane that receives, is not a difference anyone can see there)
      mesh.castShadow = true; mesh.receiveShadow = true; mesh.renderOrder = g.ro; mesh.layers.mask = g.mask;
      mesh.name = `xr ${g.flat ? 'flat' : 'tex'} ${g.cell}`;
      mesh.matrixAutoUpdate = false; mesh.frustumCulled = true;
      mesh.userData = { xrBake: true, cell: g.cell };
      const mbytes = position.byteLength + normal.byteLength + (uvArr ? uvArr.byteLength : 0) + (color ? color.byteLength : 0) + index.byteLength;
      bytes += mbytes; tris += ni / 3;
      geometries.push(geom);
      merged.push({ mesh, frame: g.frame, box, level: g.level, tris: ni / 3, verts, bytes: mbytes, kind: g.flat ? 'flat' : 'textured', cell: g.cell });
    }
  }
  return { merged, kit, geometries, bytes, tris, groups: groups.size, ownSources: [...ownSources] };
}
