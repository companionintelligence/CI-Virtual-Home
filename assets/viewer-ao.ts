// Baked ambient occlusion for the live player: a coarse 3D volume of "how open is the air here", sampled in the lit
// materials' own fragment shaders. scripts/bake-ao.mts makes the volume offline (a BVH ray-caster over the house's
// opaque triangles, 0.25 m cells) and commits it as content/ao/<id>.<hash>.bin; this module loads it and wires it in.
//
// WHAT IT DOES TO A FRAGMENT. One 3D texture tap, 0.2 m out along the surface normal, gives a visibility v in 0…1 (1:
// open sky, a flat wall in the open measures FLAT = 0.701 because half the sphere is the wall). v / FLAT clamps to 1 on a
// flat wall and falls below it only in concavities: wall corners, the ceiling edge, a shelf's recess, a porch alcove, the
// air under a sofa. It multiplies reflectedLight.indirectDiffuse and 0.6 of indirectSpecular, i.e. the ambient, the
// hemisphere light and the environment, as ambient occlusion should; the sun and the lamps (direct light, which has
// its own shadows) are never touched.
//
// HOW IT GETS THERE, and why it is not an onBeforeCompile. A material that has its own shader patch is not merged by
// viewer-batch.ts, and worldUV / neutralIndirect materials already carry one; three also keys programs by the patch's
// text. So: (1) three's ShaderChunk `common`, `begin_vertex` and `aomap_fragment` get a block each, guarded by
// `#ifdef VH_AO` (inert for every program without the define, so any material compiled before or without it is
// byte-identical); (2) the uniforms ride in the built-in materials' ShaderLib entries, with `clone()` overridden to
// return the same object, the trick environment.ts's installSkyFog uses for the fog colours, so the texture and the
// vectors are ONE instance for all programs (three clones a ShaderLib entry's uniforms for every material it compiles);
// (3) a material opts in with `material.defines.VH_AO = ''`. restore() deletes the define. Nothing else is touched.
// The define changes the program's cache key, so it must be set before the first render of a house (a program
// compiled earlier would be compiled twice: 4.5 to 8.3 s measured on cocoon).
//
// STALE VOLUMES. The manifest entry carries a fingerprint of the occluder triangles the bake saw (count and moments of
// their centroids). install() recomputes it on the scene it is given; a house whose geometry moved since the bake gets no
// AO rather than wrong AO. The fingerprint is a tolerance compare, not a hash, because the batched scene and the
// unbatched one hold the same triangles with float32 sums that differ in the last bits (viewer-batch.ts's header).

export const AO_VERSION = 1;
export const HEADER_BYTES = 40;
/** the visibility a flat wall measures with the bake's radius and the sample offset (see bake-ao.mts) */
export const SAMPLE_OFFSET = 0.2;

export type Fingerprint = { n: number; c: number[]; q: number[]; a: number };
export type Volume = { nx: number; ny: number; nz: number; cell: number; origin: [number, number, number]; rays: number; radius: number; hash: string; data: Uint8Array };

/** the analytic visibility of a flat wall for radius R, sampled at SAMPLE_OFFSET: 1 - 0.5 * ((1 - c) - c * ln(1/c)), c = offset / R */
export function flatValue(radius: number): number {
  const c = SAMPLE_OFFSET / radius;
  return 1 - 0.5 * ((1 - c) - c * Math.log(1 / c));
}

export function parseVolume(buf: ArrayBuffer): Volume {
  if (buf.byteLength < HEADER_BYTES) throw new Error('ao: volume shorter than its header');
  const dv = new DataView(buf);
  const magic = String.fromCharCode(dv.getUint8(0), dv.getUint8(1), dv.getUint8(2), dv.getUint8(3));
  if (magic !== 'VHAO') throw new Error('ao: not a volume');
  const nx = dv.getUint16(4, true), ny = dv.getUint16(6, true), nz = dv.getUint16(8, true), rays = dv.getUint8(10), version = dv.getUint8(11);
  if (version !== AO_VERSION) throw new Error(`ao: volume version ${version}`);
  const cell = dv.getFloat32(12, true), origin: [number, number, number] = [dv.getFloat32(16, true), dv.getFloat32(20, true), dv.getFloat32(24, true)], radius = dv.getFloat32(28, true);
  let hash = ''; for (let i = 32; i < 40; i++) hash += dv.getUint8(i).toString(16).padStart(2, '0');
  if (buf.byteLength !== HEADER_BYTES + nx * ny * nz) throw new Error('ao: volume size does not match its header');
  return { nx, ny, nz, cell, origin, rays, radius, hash, data: new Uint8Array(buf, HEADER_BYTES, nx * ny * nz) };
}

// ---------------------------------------------------------------------------------------------------- occluders
// Which triangles occlude: the opaque ones that are drawn. Glass and anything blended lets the light through; a
// cut-out card (leaves) is not a surface; a mesh that writes no depth is a decal.
function occludes(m: any): boolean {
  if (!m || m.visible === false) return false;
  if (m.transparent || (m.transmission || 0) > 0 || m.alphaTest > 0 || m.depthWrite === false || m.colorWrite === false) return false;
  return true;
}

export type Box = { min: [number, number, number]; max: [number, number, number] };
export const CELL = 0.25;       // m: the volume's voxel
export const MARGIN = 1.5;      // m: the volume reaches this far past the house's plan
export const RADIUS = 1.5;      // m: how far a ray looks for an occluder

/** The box the volume covers: the house's plan bounds plus a margin, from the ground up to the top storey plus 1.2 m. */
export function volumeBox(house: any): Box {
  const b = house.anchors && house.anchors.bounds;
  if (!b) throw new Error('ao: the house has no plan bounds');
  let top = 3;
  for (const l of house.spec.levels || []) top = Math.max(top, (l.y || 0) + (l.height || 2.8) + 1.2);
  return { min: [b.minX - MARGIN, 0, b.minZ - MARGIN], max: [b.maxX + MARGIN, top, b.maxZ + MARGIN] };
}
export const boxCells = (b: Box, cell = CELL): [number, number, number] => [0, 1, 2].map(i => Math.ceil((b.max[i] - b.min[i]) / cell - 1e-9)) as [number, number, number];

/** Calls fn for every occluding triangle of the visible scene, in world space (instances expanded), as nine numbers. With a
 *  box, a mesh or an instance whose bounding sphere does not reach it is not walked (a house's foliage is most of its triangles). */
export function walkOccluders(THREE: any, scene: any, box: Box | null, fn: (ax: number, ay: number, az: number, bx: number, by: number, bz: number, cx: number, cy: number, cz: number) => void): void {
  scene.updateMatrixWorld(true);
  const mm = new THREE.Matrix4(), e = mm.elements;
  const reaches = (sp: any, k: number): boolean => {
    if (!box) return true;
    const cx = e[0] * sp.center.x + e[4] * sp.center.y + e[8] * sp.center.z + e[12], cy = e[1] * sp.center.x + e[5] * sp.center.y + e[9] * sp.center.z + e[13], cz = e[2] * sp.center.x + e[6] * sp.center.y + e[10] * sp.center.z + e[14];
    const sc = Math.sqrt(Math.max(e[0] * e[0] + e[1] * e[1] + e[2] * e[2], e[4] * e[4] + e[5] * e[5] + e[6] * e[6], e[8] * e[8] + e[9] * e[9] + e[10] * e[10])), r = sp.radius * sc + k;
    return cx + r >= box.min[0] && cx - r <= box.max[0] && cy + r >= box.min[1] && cy - r <= box.max[1] && cz + r >= box.min[2] && cz - r <= box.max[2];
  };
  // The state the page leaves the house in at install depends on the requested shot (a walkthrough opens with the ceilings
  // on, an orbit with them off; a wall mode picks one of the wall's three groups), but the volume must not: so the
  // structure is taken as the house is, closed: ceilings and roofs always, a wall's full group always, its cutaway and
  // baseboard variants never, and door leaves never (a shot swings them).
  const always = new Set<any>(), never = new Set<any>();
  scene.traverse((o: any) => {
    const u = o.userData;
    if (!u) return;
    if (u.isCeiling || u.isRoof) always.add(o);
    if (u.isWall) { if (u.fullGroup) always.add(u.fullGroup); if (u.cutawayGroup) never.add(u.cutawayGroup); if (u.baseboardGroup) never.add(u.baseboardGroup); }
  });
  const visit = (o: any) => {
    if (o.visible === false && !always.has(o)) return;
    if (never.has(o)) return;
    const ud = o.userData;
    // the Core's fan, the screens and anything the page animates move with the clock: not part of the room
    if (ud && (ud.core || ud.screen || ud.animate || ud.door || ud.isHelper)) return;
    for (const c of o.children) visit(c);
    if (!o.isMesh || !o.geometry || o.isSkinnedMesh) return;
    const pos = o.geometry.attributes.position, idx = o.geometry.index;
    if (!pos || pos.itemSize < 3) return;
    const mats: any[] = Array.isArray(o.material) ? o.material : [o.material];
    // ranges of the index (or of the vertex list) that an occluding material draws
    const ranges: [number, number][] = [];
    const total = idx ? idx.count : pos.count;
    const dr = o.geometry.drawRange, dEnd = dr.count === Infinity ? total : Math.min(total, dr.start + dr.count);
    if (Array.isArray(o.material)) {
      for (const g of o.geometry.groups) if (occludes(mats[g.materialIndex])) { const s = Math.max(g.start, dr.start), t = Math.min(g.start + g.count, dEnd); if (t > s) ranges.push([s, t]); }
    } else if (occludes(mats[0]) && dEnd > dr.start) ranges.push([dr.start, dEnd]);
    if (!ranges.length) return;
    if (!o.geometry.boundingSphere) o.geometry.computeBoundingSphere();
    const sp = o.geometry.boundingSphere;
    const arr = pos.isInterleavedBufferAttribute || pos.normalized ? null : pos.array, stride = pos.itemSize;
    const ix = idx ? idx.array : null;
    const X = (v: number) => (arr ? arr[v * stride] : pos.getX(v)), Y = (v: number) => (arr ? arr[v * stride + 1] : pos.getY(v)), Z = (v: number) => (arr ? arr[v * stride + 2] : pos.getZ(v));
    const count = o.isInstancedMesh ? o.count : 1;
    for (let k = 0; k < count; k++) {
      if (o.isInstancedMesh) { o.getMatrixAt(k, mm); mm.premultiply(o.matrixWorld); } else mm.copy(o.matrixWorld);
      if (!reaches(sp, 0)) continue;
      const m0 = e[0], m1 = e[1], m2 = e[2], m4 = e[4], m5 = e[5], m6 = e[6], m8 = e[8], m9 = e[9], m10 = e[10], m12 = e[12], m13 = e[13], m14 = e[14];
      for (const [s, t] of ranges) {
        for (let i = s; i + 3 <= t; i += 3) {
          const a = ix ? ix[i] : i, b = ix ? ix[i + 1] : i + 1, c = ix ? ix[i + 2] : i + 2;
          const ax = X(a), ay = Y(a), az = Z(a), bx = X(b), by = Y(b), bz = Z(b), cx = X(c), cy = Y(c), cz = Z(c);
          fn(m0 * ax + m4 * ay + m8 * az + m12, m1 * ax + m5 * ay + m9 * az + m13, m2 * ax + m6 * ay + m10 * az + m14,
            m0 * bx + m4 * by + m8 * bz + m12, m1 * bx + m5 * by + m9 * bz + m13, m2 * bx + m6 * by + m10 * bz + m14,
            m0 * cx + m4 * cy + m8 * cz + m12, m1 * cx + m5 * cy + m9 * cz + m13, m2 * cx + m6 * cy + m10 * cz + m14);
        }
      }
    }
  };
  visit(scene);
}

/** Count and moments of the centroids of the occluding triangles inside the box, and the sum of their areas: what the bake
 *  saw, in a few numbers. (A triangle belongs to the box by its centroid, so a mesh's batching never moves one across.) */
export function fingerprint(THREE: any, scene: any, box: Box): Fingerprint {
  let n = 0, sx = 0, sy = 0, sz = 0, qx = 0, qy = 0, qz = 0, area = 0;
  const [x0, y0, z0] = box.min, [x1, y1, z1] = box.max;
  walkOccluders(THREE, scene, box, (ax, ay, az, bx, by, bz, cx, cy, cz) => {
    const x = (ax + bx + cx) / 3, y = (ay + by + cy) / 3, z = (az + bz + cz) / 3;
    if (x < x0 || x > x1 || y < y0 || y > y1 || z < z0 || z > z1) return;
    n++; sx += x; sy += y; sz += z; qx += x * x; qy += y * y; qz += z * z;
    const ux = bx - ax, uy = by - ay, uz = bz - az, vx = cx - ax, vy = cy - ay, vz = cz - az;
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    area += 0.5 * Math.sqrt(nx * nx + ny * ny + nz * nz);
  });
  return { n, c: [sx, sy, sz], q: [qx, qy, qz], a: area };
}

/** A fingerprint taken on the batched scene against one taken on the unbatched one differ by float32 noise (a metre-scale
 *  coordinate carries ~1e-7 of relative error per vertex); a moved wall, a new prop or another room differs by far more. */
export function sameFingerprint(a: Fingerprint, b: Fingerprint): boolean {
  if (a.n !== b.n) return false;
  const pair = (x: number, y: number) => Math.abs(x - y) <= 0.01 + 1e-8 * Math.abs(x);
  return a.c.every((v, i) => pair(v, b.c[i])) && a.q.every((v, i) => pair(v, b.q[i])) && pair(a.a, b.a);
}

// ---------------------------------------------------------------------------------------------------- the shader
const GLSL_COMMON = `
#ifdef VH_AO
varying vec3 vVhP;
uniform highp sampler3D uVhAo;
uniform vec3 uVhAoMin;
uniform vec3 uVhAoInv;
uniform vec3 uVhAoK;
#endif
`;
const GLSL_VERTEX = `
#ifdef VH_AO
#if defined( USE_BATCHING ) && defined( USE_INSTANCING )
vVhP = ( modelMatrix * batchingMatrix * instanceMatrix * vec4( transformed, 1.0 ) ).xyz;
#elif defined( USE_BATCHING )
vVhP = ( modelMatrix * batchingMatrix * vec4( transformed, 1.0 ) ).xyz;
#elif defined( USE_INSTANCING )
vVhP = ( modelMatrix * instanceMatrix * vec4( transformed, 1.0 ) ).xyz;
#else
vVhP = ( modelMatrix * vec4( transformed, 1.0 ) ).xyz;
#endif
#endif
`;
// uVhAoK = ( strength exponent, specular share, 1 / flat-wall value )
const GLSL_FRAGMENT = `
#ifdef VH_AO
{
	vec3 vhN = inverseTransformDirection( normal, viewMatrix );
	vec3 vhUV = ( vVhP + vhN * ${SAMPLE_OFFSET.toFixed(2)} - uVhAoMin ) * uVhAoInv;
	bool vhOut = any( lessThan( vhUV, vec3( 0.0 ) ) ) || any( greaterThan( vhUV, vec3( 1.0 ) ) );
	float vhV = vhOut ? 1.0 : textureLod( uVhAo, vhUV, 0.0 ).r;
	vhV = pow( clamp( vhV * uVhAoK.z, 0.0, 1.0 ), uVhAoK.x );
	reflectedLight.indirectDiffuse *= vhV;
	reflectedLight.indirectSpecular *= mix( 1.0, vhV, uVhAoK.y );
}
#endif
`;

export type Shared = { tex: any; min: any; inv: any; k: any };
const SHARED_KEY = '__vhAoShared';
const AO_SHADERS = ['standard', 'physical', 'lambert', 'phong', 'toon'];

/** Put the three chunk blocks and the shared uniforms in, once per page. Returns null when three's chunks are not the r169 text. */
export function installShaders(THREE: any): Shared | null {
  const C = THREE.ShaderChunk;
  if (C[SHARED_KEY]) return C[SHARED_KEY];
  if (!THREE.Data3DTexture || typeof C.aomap_fragment !== 'string' || !C.aomap_fragment.includes('ambientOcclusion') || typeof C.begin_vertex !== 'string' || typeof C.common !== 'string') {
    console.warn('ao: three\'s shader chunks are not the expected r169 text; no AO');
    return null;
  }
  const one = (o: any) => { o.clone = function () { return this; }; return o; };
  const tex = one(new THREE.Data3DTexture(new Uint8Array([255]), 1, 1, 1));
  tex.format = THREE.RedFormat; tex.type = THREE.UnsignedByteType; tex.minFilter = tex.magFilter = THREE.LinearFilter; tex.unpackAlignment = 1;
  tex.wrapS = tex.wrapT = tex.wrapR = THREE.ClampToEdgeWrapping; tex.generateMipmaps = false; tex.needsUpdate = true;
  const shared: Shared = { tex, min: one(new THREE.Vector3()), inv: one(new THREE.Vector3(1, 1, 1)), k: one(new THREE.Vector3(1, 0.6, 1)) };
  C.common += GLSL_COMMON; C.begin_vertex += GLSL_VERTEX; C.aomap_fragment += GLSL_FRAGMENT;
  for (const key of AO_SHADERS) {
    const u = THREE.ShaderLib[key] && THREE.ShaderLib[key].uniforms;
    if (u && !u.uVhAo) { u.uVhAo = { value: shared.tex }; u.uVhAoMin = { value: shared.min }; u.uVhAoInv = { value: shared.inv }; u.uVhAoK = { value: shared.k }; }
  }
  C[SHARED_KEY] = shared;
  return shared;
}

const TYPES = /^Mesh(Standard|Physical|Lambert|Phong|Toon)Material$/;
/** the lit, opaque materials in the scene, each once */
export function litMaterials(scene: any): any[] {
  const seen = new Set<any>(), out: any[] = [];
  scene.traverse((o: any) => {
    if (!o.isMesh) return;
    for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
      if (!m || seen.has(m)) continue;
      seen.add(m);
      if (TYPES.test(m.type) && !(m.transmission > 0) && !(m.transparent && m.opacity < 0.9)) out.push(m);
    }
  });
  return out;
}

/** strength: the exponent on the visibility. slack: the share of the open-air wall value that counts as unoccluded (a wall
 *  inside a room sees floor and ceiling within the ray radius and measures below the open-air wall; the slack keeps
 *  such a wall as it was and darkens only what is tighter, corners and recesses). */
export type AoSettings = { strength: number; hqScale: number; specular: number; slack: number };
export const DEFAULTS: AoSettings = { strength: 2.8, hqScale: 0.35, specular: 0.6, slack: 0.58 };

export type AoStats = { materials: number; voxels: number; bytes: number; strength: number; on: boolean; hq: boolean };

/** Upload the volume into the shared texture and switch the scene's lit materials onto it. */
export function createAo(THREE: any, scene: any, shared: Shared, vol: Volume, settings: AoSettings = DEFAULTS) {
  const mats = litMaterials(scene);
  const had = new Map<any, boolean>();   // material → it already had a `defines` object of its own
  let on = false, hq = false;
  const flat = flatValue(vol.radius);

  // the texture is shared by every program and replaced per house: free the old store, take the new size
  shared.tex.dispose();
  shared.tex.image = { data: vol.data, width: vol.nx, height: vol.ny, depth: vol.nz };
  shared.tex.needsUpdate = true;
  shared.min.set(vol.origin[0], vol.origin[1], vol.origin[2]);
  shared.inv.set(1 / (vol.nx * vol.cell), 1 / (vol.ny * vol.cell), 1 / (vol.nz * vol.cell));
  const setK = () => shared.k.set(settings.strength * (hq ? settings.hqScale : 1), settings.specular, 1 / (flat * settings.slack));
  setK();

  return {
    apply() {
      if (on) return;
      on = true;
      for (const m of mats) {
        if (!had.has(m)) had.set(m, Object.prototype.hasOwnProperty.call(m, 'defines') && !!m.defines);
        if (!m.defines) m.defines = {};
        m.defines.VH_AO = '';
        m.needsUpdate = true;
      }
    },
    restore() {
      if (!on) return;
      on = false;
      for (const m of mats) {
        if (m.defines) { delete m.defines.VH_AO; if (!had.get(m) && !Object.keys(m.defines).length) m.defines = undefined; }
        m.needsUpdate = true;
      }
    },
    /** Best quality draws its own occlusion (GTAO): keep a trace of this one so the two do not darken twice */
    setHq(v: boolean) { hq = v; setK(); },
    dispose() { if (on) this.restore(); },
    stats(): AoStats { return { materials: mats.length, voxels: vol.nx * vol.ny * vol.nz, bytes: vol.data.byteLength, strength: shared.k.x, on, hq }; },
  };
}
