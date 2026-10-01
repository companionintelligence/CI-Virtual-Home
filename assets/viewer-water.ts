// The player's water: sky-reflecting, gently moving, with a depth gradient; the lake follows the hour.
//
// WHAT THE SCENE HAS. Three kinds of water are drawn as plain PBR materials with a still, 3 m tiled normal map:
//   - pools and ponds (kit.water: userData.surface === 'water'): an OPAQUE box top (the pool slab hides its transparent
//     sheet 5 cm inside a solid box), or a transparent 0.9-opacity disc/cylinder (ponds, hot tubs), or shaped-water cells;
//   - the 200 x 55 m lake plane behind the 11 waterfront houses ('World · lake', a MeshStandardMaterial without a tag);
//   - the 'World · <kind>' cells of lot.water (lake, river, canal, sea; fixtures only today).
// Everything reads as one flat tinted sheet. This module keeps three's own light path (the sun's GGX glint, the sky in
// scene.environment, Schlick Fresnel, the sky fog) and changes what feeds it, by patching a CLONE of each material:
//   - the normal: two scrolling layers of a tileable normal map made once at load (no binary asset), rotated against each
//     other so the pattern does not repeat, faded with distance, with a mip bias so it cannot sparkle at range;
//   - the roughness: raised from the mip-averaged normal's length (Toksvig), so a distant glint spreads into a sun road
//     instead of crawling;
//   - the colour: a per-hour deep / shallow / scatter table. A pool gets a shallow ledge that falls to deep water from
//     the distance to the edge of its top face, and a faked refraction (a tile grid and a caustic net, read through the
//     refracted view ray at a plausible floor depth) multiplied into the albedo; the lake gets a shore tint.
//   - the live water is OPAQUE (the transparent ones lose `transparent`, get opacity 1 and depthWrite): sorted and
//     blended water against the glass panes was the worst of the sort problems.
// A material is never edited: the mesh is pointed at the clone, and restore() points it back (userData.__waterOrig on
// the clone keeps the original, its transparent / opacity / depthWrite). The batch is not touched: a merged mesh holding
// the kit's opaque water gets its material swapped like any other mesh, and sync() finds the new merged meshes after a
// rebake. The pool's edge distance is a per-vertex attribute ('aWater') added to the mesh's geometry on apply and deleted
// on restore, because a merged mesh has lost the box a top face came from.
//
// TIERS. The player's quality ladder (viewer-quality.ts) gives 1 or 2. Tier 1 is this module alone (cost: a few ALU per
// water pixel; no pass, no target). Tier 2 adds the FFT ocean (viewer-ocean.ts, imported lazily) as the lake's and the
// sea's normal source, and only if the extension it needs (EXT_color_buffer_float) is there; if the import or the sim
// fails, the lake keeps the analytic layers. Tier 0 and ?no=water never get here.
//
// TIME. The animation clock is the player's (ctx.now()), wrapped at 200 s. Every scroll and orbit rate is a whole number
// of cycles per 200 s so the wrap is invisible. Nothing here is reachable from an offline frame: restore() runs before
// any __houseRender* call, and the original materials draw exactly what they drew.
import type { RealismCtx, RealismHandle, Tier } from './realism.js';

export const WRAP_S = 200;
const CHUNK_KEY = 'live-water';

// ---------------------------------------------------------------------------------------------------------------
// the colour table: 4 hours x 2 kinds. Tuned by eye on stills (the look sheets), not derived: day water read pale
// grey-blue otherwise. `scatter` is light the water gives back from below (added as emission, scaled in the shader by
// how much sky is reflected), so it carries the hour's brightness by itself; the rest comes through three's lights.
type Row = { deep: number; shallow: number; scatter: number; scatterK: number; chop: number; tint: number; env: number };
const POOL: Record<string, Row> = {
  day:    { deep: 0x103c4a, shallow: 0x2a7380, scatter: 0x0b5560, scatterK: 0.04, chop: 1.0, tint: 1.0, env: 1.45 },
  golden: { deep: 0x0f3440, shallow: 0x266670, scatter: 0x174a52, scatterK: 0.04, chop: 1.0, tint: 1.0, env: 1.4 },
  dusk:   { deep: 0x0d2c3c, shallow: 0x225668, scatter: 0x183e4c, scatterK: 0.04, chop: 1.0, tint: 1.0, env: 1.3 },
  night:  { deep: 0x061824, shallow: 0x14384c, scatter: 0x0f3650, scatterK: 0.06, chop: 1.0, tint: 1.0, env: 1.6 },
};
// a pond (a thin round disc on the lawn) is darker and greener than a pool
const POND: Record<string, Row> = {
  day:    { deep: 0x15302f, shallow: 0x35604f, scatter: 0x22443a, scatterK: 0.03, chop: 1.0, tint: 1.0, env: 1.1 },
  golden: { deep: 0x142c2b, shallow: 0x32564a, scatter: 0x203c34, scatterK: 0.03, chop: 1.0, tint: 1.0, env: 1.1 },
  dusk:   { deep: 0x112530, shallow: 0x2a4753, scatter: 0x1c3240, scatterK: 0.03, chop: 1.0, tint: 1.0, env: 1.1 },
  night:  { deep: 0x08161e, shallow: 0x112a34, scatter: 0x0e2230, scatterK: 0.04, chop: 1.0, tint: 1.0, env: 1.3 },
};
const BIG: Record<string, Row> = {
  day:    { deep: 0x1c4a5a, shallow: 0x4d8c96, scatter: 0x1a5c70, scatterK: 0.03, chop: 1.0, tint: 1.0, env: 1.9 },
  golden: { deep: 0x233f50, shallow: 0x5a8090, scatter: 0x3a5a66, scatterK: 0.03, chop: 1.0, tint: 1.0, env: 1.7 },
  dusk:   { deep: 0x233a52, shallow: 0x4f6c88, scatter: 0x3b5268, scatterK: 0.03, chop: 1.0, tint: 1.0, env: 1.5 },
  night:  { deep: 0x0b2036, shallow: 0x1a3e5a, scatter: 0x16385a, scatterK: 0.08, chop: 1.0, tint: 1.0, env: 1.8 },
};

// ---------------------------------------------------------------------------------------------------------------
// the tileable normal map. Periodic value-noise fbm (every octave is a lattice that wraps at the texture edge), with a
// ridged middle octave for choppy crests; the normal comes from wrapped central differences. Stored as
// (nx, nz, ny) * 0.5 + 0.5, UNnormalised-friendly: the mip chain averages the vectors, and the shorter the average the
// rougher the water should look (the shader reads the length). A pure function of its seed: the same bytes every load.
const TEX = 256;
function hash2(x: number, y: number, seed: number): number {
  let h = (Math.imul(x, 0x1b873593) ^ Math.imul(y, 0x85ebca6b) ^ Math.imul(seed, 0xc2b2ae35)) | 0;
  h ^= h >>> 16; h = Math.imul(h, 0x7feb352d); h ^= h >>> 15; h = Math.imul(h, 0x846ca68b); h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
export function makeNormalPixels(size = TEX): Uint8Array {
  const H = new Float32Array(size * size);
  const octaves: [number, number, boolean][] = [[4, 1.0, false], [8, 0.55, true], [16, 0.32, true], [32, 0.16, false], [64, 0.07, false]];
  const fade = (t: number) => t * t * t * (t * (t * 6 - 15) + 10);
  for (let o = 0; o < octaves.length; o++) {
    const [L, amp, ridged] = octaves[o];
    for (let y = 0; y < size; y++) {
      const fy = (y / size) * L, iy = Math.floor(fy), ty = fade(fy - iy);
      for (let x = 0; x < size; x++) {
        const fx = (x / size) * L, ix = Math.floor(fx), tx = fade(fx - ix);
        const x0 = ix % L, x1 = (ix + 1) % L, y0 = iy % L, y1 = (iy + 1) % L, s = 11 + o * 7;
        const a = hash2(x0, y0, s), b = hash2(x1, y0, s), c = hash2(x0, y1, s), d = hash2(x1, y1, s);
        let n = (a + (b - a) * tx) + ((c + (d - c) * tx) - (a + (b - a) * tx)) * ty;
        if (ridged) n = 1 - Math.abs(2 * n - 1);
        H[y * size + x] += n * amp;
      }
    }
  }
  const px = new Uint8Array(size * size * 4);
  // a slope of GAIN per unit of height difference per texel: ~0.45 rms, a calm lake with a visible chop
  const GAIN = 3.2 * (size / 256);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const xm = (x + size - 1) % size, xp = (x + 1) % size, ym = (y + size - 1) % size, yp = (y + 1) % size;
      const sx = (H[y * size + xp] - H[y * size + xm]) * 0.5 * GAIN, sz = (H[yp * size + x] - H[ym * size + x]) * 0.5 * GAIN;
      const l = Math.hypot(sx, 1, sz), i = (y * size + x) * 4;
      px[i] = Math.round((-sx / l * 0.5 + 0.5) * 255);
      px[i + 1] = Math.round((-sz / l * 0.5 + 0.5) * 255);
      px[i + 2] = Math.round((1 / l * 0.5 + 0.5) * 255);
      px[i + 3] = 255;
    }
  }
  return px;
}

// ---------------------------------------------------------------------------------------------------------------
// GLSL. Original: a lowbias32 integer hash (public domain), cellular edges for the caustic net, and the shading glue.
const GLSL_COMMON = /* glsl */ `
uniform float uWTime;
uniform sampler2D uWNorm;
uniform vec3 uWDeep; uniform vec3 uWShallow; uniform vec3 uWScatter;
uniform vec4 uWParam;   // x chop strength, y scatter strength, z tint, w sun-road breadth
uniform float uWEnv;    // gain on the reflected sky (the hour's environment is dimmed for the lit house, not for a mirror)
varying vec3 vWPos;
float wEnvUp = 0.0;
#ifdef WATER_EDGE
varying vec4 vWEdge;
#endif
#ifdef WATER_OCEAN
uniform sampler2D uWOcean; uniform vec4 uWOceanP;   // x 1/tile (m), y foam gain, z slope gain, w 1/fine tile
#endif
uint wMix( uint x ) { x ^= x >> 16u; x *= 0x7feb352du; x ^= x >> 15u; x *= 0x846ca68bu; x ^= x >> 16u; return x; }
vec2 wHash2( vec2 c, float seed ) {
  uint h = wMix( uint( int( c.x ) + 4096 ) * 73856093u ^ uint( int( c.y ) + 4096 ) * 19349663u ^ uint( seed ) * 83492791u );
  return vec2( float( h & 65535u ), float( h >> 16u ) ) * ( 1.0 / 65535.0 );
}
// distance to the nearest cell edge of a wandering cellular pattern (0 on a ridge): the caustic net
float wCell( vec2 p, float t, float seed ) {
  vec2 i = floor( p ), f = fract( p ); float d1 = 8.0, d2 = 8.0;
  for ( int y = -1; y <= 1; y ++ ) for ( int x = -1; x <= 1; x ++ ) {
    vec2 g = vec2( float( x ), float( y ) ), h = wHash2( i + g, seed );
    vec2 o = 0.5 + 0.42 * sin( t + 6.2831853 * h );
    float d = length( g + o - f );
    if ( d < d1 ) { d2 = d1; d1 = d; } else if ( d < d2 ) d2 = d;
  }
  return d2 - d1;
}
// one scrolling layer: tile size (m), rotation, scroll in tiles per WRAP seconds (whole numbers, so the clock wraps unseen)
vec4 wLayer( vec2 p, float tile, float ang, vec2 scroll, float bias, out vec2 slope ) {
  float c = cos( ang ), s = sin( ang );
  vec2 q = vec2( c * p.x - s * p.y, s * p.x + c * p.y ) / tile + scroll * ( uWTime * ${(1 / WRAP_S).toFixed(6)} );
  vec4 t = texture2D( uWNorm, q, bias );
  vec3 n = vec3( t.r * 2.0 - 1.0, t.b * 2.0 - 1.0, t.g * 2.0 - 1.0 );   // (x, up, z) of the unrotated tile
  float len = length( n );
  vec2 sl = n.xz / max( n.y, 0.2 );
  slope = vec2( c * sl.x + s * sl.y, - s * sl.x + c * sl.y );   // back into world axes
  return vec4( slope, len, 0.0 );
}
`;

const GLSL_VERT_DECL = `
varying vec3 vWPos;
#ifdef WATER_EDGE
attribute vec4 aWater;
varying vec4 vWEdge;
#endif
`;
const GLSL_VERT = `
vWPos = ( modelMatrix * vec4( transformed, 1.0 ) ).xyz;
#ifdef WATER_EDGE
vWEdge = aWater;
#endif
`;

// (declared at file scope below `common`: the env gain is applied after the lights, outside the body's block)
// the body, injected after normal_fragment_maps (before the lights read normal, roughnessFactor and diffuseColor)
const GLSL_BODY = /* glsl */ `
{
  vec3 wn0 = inverseTransformDirection( normal, viewMatrix );
  float wUp = smoothstep( 0.55, 0.9, wn0.y );
  wEnvUp = wUp;
  float wDist = length( vViewPosition );
  vec3 wV = normalize( vWPos - cameraPosition );
  // ---- the waves
  float wFar = 1.0 / ( 1.0 + pow( wDist * ( 1.0 / 70.0 ), 2.0 ) );   // detail fades before it can shimmer
  float wBias = clamp( log2( max( wDist, 1.0 ) * 0.05 ), 0.0, 3.0 );
  vec2 sA, sB, sl = vec2( 0.0 ); float lenA = 1.0, lenB = 1.0, foam = 0.0;
  #ifdef WATER_POOL
    lenA = wLayer( vWPos.xz, 5.3, 0.35, vec2( 3.0, 2.0 ), wBias, sA ).z;
    lenB = wLayer( vWPos.xz, 2.1, -0.62, vec2( -5.0, 4.0 ), wBias, sB ).z;
    sl = ( sA * 0.55 + sB * 0.45 ) * 0.42 * uWParam.x * wFar;
  #else
    #ifdef WATER_OCEAN
      // the sim's mip-mapped normals + its own slope variance (the length of the averaged normal) + crest foam
      vec4 o0 = texture2D( uWOcean, vWPos.xz * uWOceanP.x, wBias * 0.5 );
      vec3 on = o0.xyz * 2.0 - 1.0;   // (x, z, up) as stored by the sim's normal pass: slope = xz / up
      sl = on.xy / max( on.z, 0.2 ) * uWOceanP.z * wFar;
      lenA = clamp( length( on ), 0.0, 1.0 );
      foam = o0.a * uWOceanP.y;
      lenB = wLayer( vWPos.xz, 1.7, 0.6, vec2( 4.0, -3.0 ), wBias, sB ).z;
      sl += sB * 0.12 * uWParam.x * wFar;
    #else
      lenA = wLayer( vWPos.xz, 23.0, 0.28, vec2( 2.0, 1.0 ), wBias, sA ).z;
      lenB = wLayer( vWPos.xz, 6.7, -0.55, vec2( -3.0, 2.0 ), wBias, sB ).z;
      sl = ( sA * 0.5 + sB * 0.5 ) * 0.38 * uWParam.x * wFar;
    #endif
  #endif
  vec2 wBase = wn0.xz / max( wn0.y, 0.05 );
  vec3 wn = normalize( vec3( wBase.x + sl.x, 1.0, wBase.y + sl.y ) );
  normal = normalize( mix( normal, transformDirection( wn, viewMatrix ), wUp ) );
  // ---- roughness from the normal variance (Toksvig-like): short averaged normals, rougher water
  float wLen = min( lenA, lenB );
  float wVar = ( 1.0 - wLen ) / max( wLen, 0.05 );
  roughnessFactor = mix( roughnessFactor, sqrt( roughnessFactor * roughnessFactor + wVar * uWParam.w ), wUp );
  // ---- colour
  float wCos = clamp( dot( - wV, wn ), 0.0, 1.0 );
  float wFres = 0.04 + 0.96 * pow( 1.0 - wCos, 5.0 );
  float wEdge = 99.0;
  #ifdef WATER_EDGE
    if ( vWEdge.z > 0.0 ) {
      wEdge = vWEdge.y < 0.0 ? ( 1.0 - vWEdge.x ) * vWEdge.z
        : min( min( vWEdge.x, 1.0 - vWEdge.x ) * vWEdge.z, min( vWEdge.y, 1.0 - vWEdge.y ) * vWEdge.w );
    }
  #endif
  #ifdef WATER_POOL
    float wDeepT = smoothstep( 0.05, 1.15, wEdge );
    vec3 wCol = mix( uWShallow, uWDeep, wDeepT * 0.92 );
    // the floor seen through the surface: the view ray refracted at the wobbling normal, to a floor 0.4 - 1.5 m down
    float wDepth = mix( 0.4, 1.5, wDeepT );
    vec3 wR = refract( wV, normalize( vec3( sl * 0.35, 1.0 ) ), 0.7519 );
    vec2 wFloor = vWPos.xz + wR.xz * ( wDepth / max( - wR.y, 0.5 ) );
    float wNear = 1.0 - smoothstep( 14.0, 38.0, wDist );
    // grout lines of a 0.3 m tile (anti-aliased by the footprint, gone at range) and the net of light on the floor
    vec2 wT = wFloor / 0.3;
    vec2 wG = abs( fract( wT - 0.5 ) - 0.5 ) / max( fwidth( wT ), vec2( 1e-4 ) );
    float wLine = ( 1.0 - clamp( min( wG.x, wG.y ) - 0.4, 0.0, 1.0 ) ) * wNear;
    float wTc = uWTime * ${((Math.PI * 2 * 12) / WRAP_S).toFixed(6)};
    float wC1 = wCell( wFloor * 1.1 + vec2( 0.3, 1.7 ), wTc, 3.0 ), wC2 = wCell( wFloor.yx * 1.6 + vec2( 4.1, 0.2 ), - wTc * 1.25, 9.0 );
    float wNet = pow( 1.0 - smoothstep( 0.0, 0.34, wC1 ), 1.6 ) + 0.8 * pow( 1.0 - smoothstep( 0.0, 0.3, wC2 ), 1.6 );
    float wLook = ( 1.0 - wFres ) * wNear;   // looking down you see the floor; at a graze only the sky
    wCol *= 1.0 + 0.1 * wLook * ( wNet * 1.2 - 0.4 ) - 0.12 * wLine * wLook;
  #else
    vec3 wCol = mix( uWShallow, uWDeep, smoothstep( 0.0, 7.0, wEdge ) );
  #endif
  diffuseColor.rgb = mix( diffuseColor.rgb, wCol * uWParam.z, wUp );
  totalEmissiveRadiance += uWScatter * uWParam.y * ( 1.0 - wFres ) * wUp;
  #ifdef WATER_OCEAN
    diffuseColor.rgb = mix( diffuseColor.rgb, vec3( 0.82, 0.88, 0.9 ), clamp( foam, 0.0, 1.0 ) * wUp );
    roughnessFactor = mix( roughnessFactor, 0.8, clamp( foam, 0.0, 1.0 ) * wUp );
  #endif
}
`;

const GLSL_ENV = `
reflectedLight.indirectSpecular *= mix( 1.0, uWEnv, wEnvUp );
`;

// ---------------------------------------------------------------------------------------------------------------
export type WaterKind = 'pool' | 'pond' | 'big';
type Variant = { kind: WaterKind; edge: boolean; ocean: boolean };
const variantKey = (v: Variant) => `${v.kind}${v.edge ? 'e' : ''}${v.ocean ? 'o' : ''}`;

/** the r169 chunk text this module patches must be there; false: leave the water alone (a warning, the original look) */
export function checkChunks(THREE: any): boolean {
  const L = THREE?.ShaderLib?.physical;
  const f: unknown = L?.fragmentShader, v: unknown = L?.vertexShader;
  const need = (src: unknown, s: string) => typeof src === 'string' && src.includes(s);
  const ok = need(f, '#include <normal_fragment_maps>') && need(f, '#include <common>') && need(f, 'varying vec3 vViewPosition;') && need(f, 'vec3 totalEmissiveRadiance')
    && need(v, '#include <project_vertex>') && need(v, '#include <common>') && need(v, 'vViewPosition')
    && typeof THREE?.ShaderChunk?.lights_physical_fragment === 'string' && THREE.ShaderChunk.lights_physical_fragment.includes('material.roughness = max( roughnessFactor, 0.0525 )')
    && typeof THREE?.ShaderChunk?.normal_fragment_begin === 'string' && THREE.ShaderChunk.normal_fragment_begin.includes('vec3 nonPerturbedNormal = normal;') ;
  if (!ok) console.warn('viewer-water: three\'s meshphysical shader is not the expected r169 text; water left as built');
  return ok;
}

type Target = { mesh: any; orig: any | any[]; geo: any; addedAttr: boolean };

export type WaterOptions = { pixelBudget?: number };

export function createWater(ctx: RealismCtx): RealismHandle {
  const { THREE, scene } = ctx;
  const normalTex = new THREE.DataTexture(makeNormalPixels(), TEX, TEX, THREE.RGBAFormat, THREE.UnsignedByteType);
  normalTex.wrapS = normalTex.wrapT = THREE.RepeatWrapping;
  normalTex.minFilter = THREE.LinearMipmapLinearFilter; normalTex.magFilter = THREE.LinearFilter;
  normalTex.generateMipmaps = true; normalTex.anisotropy = Math.min(4, ctx.renderer.capabilities.getMaxAnisotropy?.() || 1);
  normalTex.colorSpace = THREE.NoColorSpace;
  normalTex.needsUpdate = true;

  // uniforms shared by every clone of a kind (one write per frame, whatever the number of materials)
  const uTime = { value: 0 };
  const mk = (): any => ({
    uWTime: uTime, uWNorm: { value: normalTex },
    uWDeep: { value: new THREE.Color() }, uWShallow: { value: new THREE.Color() }, uWScatter: { value: new THREE.Color() },
    uWParam: { value: new THREE.Vector4(1, 0.1, 1, 0.12) }, uWEnv: { value: 1.5 },
    uWOcean: { value: null }, uWOceanP: { value: new THREE.Vector4(1 / 80, 1, 1, 1 / 9) },
  });
  const U: Record<WaterKind, any> = { pool: mk(), pond: mk(), big: mk() };

  let applied = false;
  let tier: Tier = ctx.tier();
  let oceanTex: any = null;                      // the FFT sim's normal map, when the lazy module is up (tier 2)
  const oceanOn = (): boolean => !!oceanTex && tier >= 2;
  const clones = new Map<string, any>();         // `${original.uuid}|${variant}|${tier}` → the patched clone
  const targets = new Map<any, Target>();        // mesh → what to put back
  const frustum = new THREE.Frustum(), pv = new THREE.Matrix4(), tmpBox = new THREE.Box3();
  let acc = 0, visible = false, visCheck = 0;
  let still = false;
  let held: number | null = null;                // ?waterdebug: the look sheets and the live check freeze the clock

  const setPalette = (): void => {
    const L = ctx.lighting();
    const name: string = (L && L.preset) || 'day';
    for (const [k, T] of [['pool', POOL], ['pond', POND], ['big', BIG]] as [WaterKind, Record<string, Row>][]) {
      const r = T[name] || T.day, u = U[k];
      u.uWDeep.value.setHex(r.deep); u.uWShallow.value.setHex(r.shallow); u.uWScatter.value.setHex(r.scatter);
      u.uWParam.value.set(r.chop, r.scatterK, r.tint, k === 'big' ? 0.14 : 0.1); u.uWEnv.value = r.env;
    }
    ctx.markDirty();
  };
  setPalette();

  // ---- which meshes are water, and of what kind
  const isWorld = (o: any): boolean => { for (let p = o; p; p = p.parent) if (p.userData && p.userData.world) return true; return typeof o.name === 'string' && o.name.startsWith('World · '); };
  const isWaterMat = (m: any): boolean => !!m && !!m.userData && (m.userData.surface === 'water' || !!m.userData.__waterOrig);
  const waterSlots = (o: any): boolean[] => {
    const list: any[] = Array.isArray(o.material) ? o.material : [o.material];
    return list.map((m: any) => !!m && (isWaterMat(m) || (o.name === 'World · lake' && m.isMeshStandardMaterial)));
  };

  // ---- the per-vertex edge distance of a pool's top face(s): rect (u, v, W, D) or fan (r, -1, R, 0); z <= 0: none
  function addEdgeAttribute(mesh: any, slots: boolean[]): boolean {
    const geo = mesh.geometry;
    const pos = geo.attributes && geo.attributes.position;
    if (!pos || pos.count < 3) return false;
    if (geo.attributes.aWater) return true;
    const idx = geo.index;
    const n = pos.count;
    const ranges: [number, number][] = [];
    if (Array.isArray(mesh.material)) {
      for (const g of geo.groups) if (slots[g.materialIndex]) ranges.push([g.start, g.count]);
    } else ranges.push([0, idx ? idx.count : n]);
    const mw = mesh.matrixWorld.elements;
    const sx = Math.hypot(mw[0], mw[1], mw[2]), sz = Math.hypot(mw[8], mw[9], mw[10]);
    const vi = (k: number): number => (idx ? idx.getX(k) : k);
    const px = (i: number) => pos.getX(i), py = (i: number) => pos.getY(i), pz = (i: number) => pos.getZ(i);
    // up-facing triangles, clustered by shared (quantised) corner positions
    const key = (i: number) => `${Math.round(px(i) * 1000)},${Math.round(py(i) * 1000)},${Math.round(pz(i) * 1000)}`;
    const parent = new Map<string, string>();
    const find = (a: string): string => { let r = a; while (parent.get(r) !== r) r = parent.get(r)!; let c = a; while (parent.get(c) !== r) { const nx = parent.get(c)!; parent.set(c, r); c = nx; } return r; };
    const tris: [number, number, number][] = [];
    for (const [start, count] of ranges) {
      for (let k = start; k + 2 < start + count; k += 3) {
        const a = vi(k), b = vi(k + 1), c = vi(k + 2);
        const e1x = px(b) - px(a), e1y = py(b) - py(a), e1z = pz(b) - pz(a), e2x = px(c) - px(a), e2y = py(c) - py(a), e2z = pz(c) - pz(a);
        const nx = e1y * e2z - e1z * e2y, ny = e1z * e2x - e1x * e2z, nz = e1x * e2y - e1y * e2x;
        const l = Math.hypot(nx, ny, nz);
        if (l < 1e-12 || Math.abs(ny) / l < 0.9) continue;
        tris.push([a, b, c]);
        const ka = key(a), kb = key(b), kc = key(c);
        for (const q of [ka, kb, kc]) if (!parent.has(q)) parent.set(q, q);
        parent.set(find(kb), find(ka)); parent.set(find(kc), find(ka));
      }
    }
    if (!tris.length) return false;
    const arr = new Float32Array(n * 4);
    for (let i = 0; i < n; i++) arr[i * 4 + 2] = -1;
    const clusters = new Map<string, Map<string, number>>();   // root → corner key → vertex index (one representative)
    for (const [a, b, c] of tris) { const r = find(key(a)); let m = clusters.get(r); if (!m) clusters.set(r, m = new Map()); for (const v of [a, b, c]) m.set(key(v), v); }
    const vertsByKey = new Map<string, number[]>();   // every vertex index that sits at a corner key (non-indexed meshes repeat them)
    for (const [a, b, c] of tris) for (const v of [a, b, c]) { const kk = key(v); let l = vertsByKey.get(kk); if (!l) vertsByKey.set(kk, l = []); if (!l.includes(v)) l.push(v); }
    for (const m of clusters.values()) {
      const pts = [...m.entries()].map(([kk, v]) => ({ kk, x: px(v), z: pz(v) }));
      const cnt = pts.length;
      let cx = 0, cz = 0; for (const p of pts) { cx += p.x; cz += p.z; } cx /= cnt; cz /= cnt;
      let minx = Infinity, maxx = -Infinity, minz = Infinity, maxz = -Infinity;
      for (const p of pts) { minx = Math.min(minx, p.x); maxx = Math.max(maxx, p.x); minz = Math.min(minz, p.z); maxz = Math.max(maxz, p.z); }
      const set = (kk: string, a: number, b: number, c: number, d: number) => { for (const v of vertsByKey.get(kk)!) { arr[v * 4] = a; arr[v * 4 + 1] = b; arr[v * 4 + 2] = c; arr[v * 4 + 3] = d; } };
      // a fan: one corner at the centroid, the rest on a circle round it (a cylinder's cap)
      let fan = false, R = 0;
      if (cnt >= 6) {
        const d = pts.map(p => Math.hypot(p.x - cx, p.z - cz)), ci = d.indexOf(Math.min(...d));
        const ring = d.filter((_, i) => i !== ci), mean = ring.reduce((s, x) => s + x, 0) / ring.length;
        if (d[ci] < mean * 0.02 && ring.every(x => Math.abs(x - mean) < mean * 0.03)) { fan = true; R = mean; }
      }
      if (fan) {
        const Rm = R * (sx + sz) * 0.5;
        for (const p of pts) set(p.kk, Math.min(1, Math.hypot(p.x - cx, p.z - cz) / R), -1, Rm, 0);
      } else if (cnt === 4) {
        // an oriented rectangle: from the first corner, its two nearest neighbours are the adjacent corners
        const p0 = pts[0], rest = pts.slice(1).sort((a, b) => Math.hypot(a.x - p0.x, a.z - p0.z) - Math.hypot(b.x - p0.x, b.z - p0.z));
        const e1x = rest[0].x - p0.x, e1z = rest[0].z - p0.z, e2x = rest[1].x - p0.x, e2z = rest[1].z - p0.z;
        const W = Math.hypot(e1x, e1z), D = Math.hypot(e2x, e2z);
        if (W < 1e-6 || D < 1e-6) continue;
        for (const p of pts) {
          const dx = p.x - p0.x, dz = p.z - p0.z;
          set(p.kk, Math.min(1, Math.max(0, (dx * e1x + dz * e1z) / (W * W))), Math.min(1, Math.max(0, (dx * e2x + dz * e2z) / (D * D))), W * sx, D * sz);
        }
      } else {
        const W = maxx - minx, D = maxz - minz;
        if (W < 1e-6 || D < 1e-6) continue;
        for (const p of pts) set(p.kk, (p.x - minx) / W, (p.z - minz) / D, W * sx, D * sz);
      }
    }
    geo.setAttribute('aWater', new THREE.BufferAttribute(arr, 4));
    return true;
  }

  // a pond: a thin (< 0.2 m) round disc lying on the ground (a hot tub stands 0.8 m up; a pool is a box)
  function pondLike(o: any): boolean {
    const g = o.geometry; if (!g || g.type !== 'CylinderGeometry') return false;
    const e = o.matrixWorld.elements; return e[13] < 0.3;
  }

  // ---- the patched clone of one material
  function cloneFor(orig: any, v: Variant): any {
    const key = `${orig.uuid}|${variantKey(v)}|${tier}`;
    let c = clones.get(key);
    if (c) return c;
    c = orig.clone();
    // (no `worldUV` tag: viewer-batch merges a tagged material by content, and this one carries a shader of its own)
    c.userData = { ...(orig.userData || {}), worldUV: undefined, __waterOrig: { mat: orig, transparent: orig.transparent, opacity: orig.opacity, depthWrite: orig.depthWrite } };
    c.transparent = false; c.opacity = 1; c.depthWrite = true;
    c.name = (orig.name || 'water') + ' (live)';
    if (c.normalScale && c.normalMap) c.normalScale.multiplyScalar(0.35);   // the kit's 3 m swell stays, under the moving layers
    if (v.kind === 'big') { c.polygonOffset = true; c.polygonOffsetFactor = -2; c.polygonOffsetUnits = -2; }   // the lake plane is 2 mm above the ground
    const prevCompile = c.onBeforeCompile, prevKey = c.customProgramCacheKey ? c.customProgramCacheKey.bind(c) : () => '';
    const u = U[v.kind];
    const defs = `#define WATER_${v.kind === 'big' ? 'BIG' : 'POOL'} 1\n${v.edge ? '#define WATER_EDGE 1\n' : ''}${v.ocean ? '#define WATER_OCEAN 1\n' : ''}`;
    c.onBeforeCompile = (shader: any, renderer: any) => {
      if (prevCompile) prevCompile.call(c, shader, renderer);
      Object.assign(shader.uniforms, u);
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\n' + defs + GLSL_VERT_DECL)
        .replace('#include <project_vertex>', '#include <project_vertex>\n' + GLSL_VERT);
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', '#include <common>\n' + defs + GLSL_COMMON)
        .replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>\n' + GLSL_BODY)
        .replace('#include <lights_fragment_end>', '#include <lights_fragment_end>\n' + GLSL_ENV);
    };
    c.customProgramCacheKey = () => `${prevKey()}|${CHUNK_KEY}-${tier}-${variantKey(v)}`;
    c.needsUpdate = true;
    clones.set(key, c);
    return c;
  }

  // ---- find the water in the scene and point it at the clones
  function patch(): void {
    scene.updateMatrixWorld(true);
    scene.traverse((o: any) => {
      if (!o.isMesh || !o.material || targets.has(o)) return;
      const slots = waterSlots(o);
      if (!slots.some(Boolean)) return;
      const list: any[] = Array.isArray(o.material) ? o.material : [o.material];
      if (list.some(m => m && m.userData && m.userData.__waterOrig)) return;   // already ours (a sync after a rebake keeps its meshes)
      const big = isWorld(o);
      let edge = false;
      if (!big) { try { edge = addEdgeAttribute(o, slots); } catch (e) { console.warn('viewer-water: edge attribute failed', e); edge = false; } }
      const v: Variant = { kind: big ? 'big' : pondLike(o) ? 'pond' : 'pool', edge, ocean: big && oceanOn() };
      // the lake plane is a single quad: its own corners give the shore term too
      if (big && o.name === 'World · lake') {
        try { v.edge = addEdgeAttribute(o, slots); } catch { v.edge = false; }
      }
      if (o.geometry && !o.geometry.boundingBox) o.geometry.computeBoundingBox();   // (tick() asks whether any water is on screen)
      targets.set(o, { mesh: o, orig: o.material, geo: o.geometry, addedAttr: v.edge });
      const next = list.map((m, i) => (slots[i] ? cloneFor(m, v) : m));
      o.material = Array.isArray(o.material) ? next : next[0];
    });
  }
  function unpatch(): void {
    for (const t of targets.values()) {
      t.mesh.material = t.orig;
      if (t.addedAttr && t.geo && t.geo.attributes && t.geo.attributes.aWater) t.geo.deleteAttribute('aWater');
    }
    targets.clear();
  }

  // ---- the lazy FFT ocean (tier 2): the lake's normal source
  let ocean: any = null, oceanState: 'none' | 'loading' | 'on' | 'failed' = 'none', oceanReason = '';
  async function loadOcean(): Promise<void> {
    if (oceanState !== 'none' || ctx.no.has('ocean')) return;
    oceanState = 'loading';
    try {
      // (?waterdebug=noext: the live check's way of pretending the device has no float render targets)
      if (ctx.params.get('waterdebug') === 'noext' || !ctx.renderer.extensions.has('EXT_color_buffer_float')) throw new Error('no EXT_color_buffer_float');
      const mod: any = await import('./viewer-ocean.js');
      const o = mod.createOcean(ctx);
      if (!o) throw new Error('ocean refused');
      o.update(held !== null ? held : ctx.now(), ctx.camera, true, true);   // the first picture, before any pixel reads the map
      ocean = o; oceanState = 'on';
      oceanTex = o.normalMap();
      U.big.uWOcean.value = oceanTex;
      U.big.uWOceanP.value.set(1 / o.tile, 1.0, 0.85, 1 / 9);
      if (applied && tier >= 2) rebuildVariants();
    } catch (e) {
      oceanState = 'failed'; oceanReason = String((e as Error)?.message || e);
      console.warn('viewer-water: the FFT ocean is not used', e);
    }
  }
  // the lake's program changes (analytic ↔ ocean): point the big water at the other clone
  function rebuildVariants(): void {
    if (!applied) return;
    unpatch();
    patch();
    ctx.markDirty();
  }

  const handle: RealismHandle = {
    apply() {
      if (applied) return;
      applied = true;
      tier = ctx.tier();
      patch();
      if (tier >= 2 && oceanState === 'none') void loadOcean();
      else if (tier >= 2 && oceanState === 'on') rebuildVariants();
    },
    restore() {
      if (!applied) return;
      applied = false;
      unpatch();
    },
    sync() {
      if (!applied) return;
      // drop meshes that left the scene (a rebake replaced them), find the new ones
      for (const [m, t] of [...targets.entries()]) {
        let inScene = false; for (let p = m; p; p = p.parent) if (p === scene) { inScene = true; break; }
        if (!inScene) { m.material = t.orig; targets.delete(m); }
      }
      patch();
    },
    tick(dtS: number, tS: number, camera: any) {
      if (!applied) return;
      uTime.value = held !== null ? held : tS % WRAP_S;
      if (ocean && oceanOn()) { try { ocean.update(held !== null ? held : tS, camera, visible, held !== null); } catch (e) { fallback(String((e as Error)?.message || e)); } }
      // frames keep coming at 30 Hz while water is on screen (a paused view still moves)
      visCheck += dtS; acc += dtS;
      if (visCheck >= 0.2) {
        visCheck = 0;
        pv.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse); frustum.setFromProjectionMatrix(pv);
        visible = false;
        for (const t of targets.values()) {
          const b = t.mesh.geometry && t.mesh.geometry.boundingBox; if (!b || !t.mesh.visible) continue;
          tmpBox.copy(b).applyMatrix4(t.mesh.matrixWorld);
          if (frustum.intersectsBox(tmpBox)) { visible = true; break; }
        }
      }
      if (visible && acc >= 1 / 30 && !still) { acc = 0; ctx.markDirty(); }
    },
    setTier(t: Tier) {
      if (t === tier) return;
      tier = t;
      if (!applied) return;
      if (t >= 2 && oceanState === 'none') void loadOcean();
      rebuildVariants();
    },
    dispose() {
      if (applied) { applied = false; unpatch(); }
      for (const c of clones.values()) c.dispose();
      clones.clear();
      if (ocean) { try { ocean.dispose(); } catch { /* gone */ } ocean = null; oceanTex = null; }
      normalTex.dispose();
    },
    stats() {
      let pool = 0, big = 0, edge = 0;
      for (const t of targets.values()) { if (isWorld(t.mesh)) big++; else pool++; if (t.addedAttr) edge++; }
      return { tier, pools: pool, big, edge, clones: clones.size, ocean: oceanState, oceanReason, visible, oceanStats: ocean ? ocean.stats() : null };
    },
  };

  function fallback(why: string): void {
    console.warn('viewer-water: the FFT sim failed, back to the analytic layers', why);
    oceanState = 'failed'; oceanReason = why;
    try { ocean && ocean.dispose(); } catch { /* ditto */ }
    ocean = null; oceanTex = null; U.big.uWOcean.value = null;
    rebuildVariants();
  }

  ctx.onLighting(() => setPalette());
  // test hook, only with ?waterdebug (the stills and scripts/live-checks/water.mts read and freeze the clock through it)
  if (ctx.params.has('waterdebug')) {
    (window as any).__houseWater = {
      hold(t: number | null) { held = t; still = t !== null; if (t !== null) uTime.value = t; },
      time: () => uTime.value,
      stats: () => handle.stats!(),
      ocean: () => ocean,
      failOcean: () => fallback('forced'),
    };
  }
  return handle;
}
