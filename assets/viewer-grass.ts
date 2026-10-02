// The player's grass: an original, camera-relative field of blades and tufts, a livelier lawn under it, and shaded,
// wind-moved tree crowns. Live player only (assets/realism-grass.ts installs it; nothing here runs in a product frame).
//
// THE FIELD. No per-instance buffers and no CPU work per frame. The geometry is ONE blade (or one tuft of blades) drawn
// `G x G` times; the vertex shader maps gl_InstanceID onto a torus of world cells round the camera's foot: slot (i, j)
// always holds the one world cell that is congruent to it modulo G inside the window, so as the camera walks a cell keeps
// its slot (no popping, nothing re-seeded) and only the cells at the window's far edge change hands. Everything a blade
// is — where it stands in its cell, how tall, how wide, which way it faces and bends, its tint — is a uint hash of
// (cell, the house's seed), so the field is the same field every time the same cell is looked at, and a blade is culled
// in the vertex shader by its distance to the camera, by the site bake's lawn coverage, and by a per-cell random
// threshold (so the density ramps rather than stops).
//
// TWO LEVELS OF DETAIL, equal in cover. Near the camera: blades of 2 to 4 segments, tapered, double sided, never thinner
// than about 0.9 px (a blade thinner than a pixel is what shimmers). Farther: tufts of 4 to 6 fanned blades in a coarser
// grid, with the widths of the blades widened so that (width x height x count per m2) is the same as the near blades':
// the two fade through each other with complementary probabilities, so there is no ring where the lawn changes density.
// The tufts' height shrinks to nothing over their last 4 m, so they melt into the flat lawn, whose colour is the same
// colour (the blade palette's mean is the lawn's own mean albedo).
//
// THE LAWN UNDER IT is patched in place (with an undo): a second octave of dry and healthy patches, a little less
// saturated by day, darker where it meets a path, bed or patio (from the bake), darker as soil under the grass, and lifted
// at dusk and night so it does not go black. Grass and lawn read the same patch noise, so a yellow patch is yellow in both.
//
// THE CROWNS: the trees' leaf clusters were faceted lollipops. Live, flat shading goes off, the normals lean toward the
// crown's own sphere (volume shading), the underside is darker, the sunward side glows a little with the light behind it,
// the colour breathes with a low-frequency noise, and the crown sways. The geometry is untouched.
//
// Originality: no code from Grassworks (a commercial product; only its public feature list was read), nothing from LYGIA.
// The noise, the hash and the wind are written here from the plain algorithms. Tuft shapes are our own (assets/site.ts
// adapted a grass tuft from pascalorg/plugin-trees, MIT, recorded in THIRD_PARTY.md; this file does not use it).
import type { SiteBake } from './viewer-bake.js';

// ---------------------------------------------------------------------------------------------------------------------
// the hash (the same text runs on the GPU and, below, on the CPU: scripts/live-checks/grass.mts compares them)
export const HASH_GLSL = /* glsl */`
uint gh_u(uint x) { x ^= x >> 16u; x *= 0x7feb352du; x ^= x >> 15u; x *= 0x846ca68bu; x ^= x >> 16u; return x; }
float gh_f(uint x) { return float(gh_u(x) & 0x00ffffffu) * (1.0 / 16777216.0); }
uint gh_cell(ivec2 c, uint seed) { return gh_u(uint(c.x) * 73856093u ^ uint(c.y) * 19349663u ^ seed); }
float gh_lat(ivec2 c) { return gh_f(gh_cell(c, 0x5bd1e995u)); }
float gh_noise(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); ivec2 c = ivec2(i);
  return mix(mix(gh_lat(c), gh_lat(c + ivec2(1, 0)), f.x), mix(gh_lat(c + ivec2(0, 1)), gh_lat(c + ivec2(1, 1)), f.x), f.y); }
// the lawn's own patchiness (dry <-> healthy), read by the flat lawn and by every blade so they agree
float gh_patch(vec2 p) { return gh_noise(p * 0.42) * 0.62 + gh_noise(p * 1.7 + 11.3) * 0.38; }
`;
// the torus: slot `id` of a G x G window whose lowest corner is `base` holds the one world cell inside the window that is congruent
// to the slot modulo G. Moving `base` by one hands over only the slots on the window's trailing edge (scripts/live-checks/grass.mts
// runs this very text on the GPU and checks both facts).
export const SLOT_GLSL = /* glsl */`
int gh_mod(int a, int b) { return ((a % b) + b) % b; }
ivec2 gh_slot(int id, int G, ivec2 base) { return base + ivec2(gh_mod(id % G - base.x, G), gh_mod(id / G - base.y, G)); }
`;
const U32 = (x: number): number => x >>> 0;
export function hashU(x: number): number {
  x = U32(x); x = U32(x ^ (x >>> 16)); x = U32(Math.imul(x, 0x7feb352d)); x = U32(x ^ (x >>> 15)); x = U32(Math.imul(x, 0x846ca68b)); x = U32(x ^ (x >>> 16));
  return x;
}
export const hashF = (x: number): number => (hashU(x) & 0x00ffffff) / 16777216;
export const cellKey = (cx: number, cz: number, seed: number): number => hashU(U32(Math.imul(cx | 0, 73856093) ^ Math.imul(cz | 0, 19349663) ^ seed));
/** the house's seed (FNV-1a of its id, the repo's usual seed) */
export function seedOf(id: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < id.length; i++) { h ^= id.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return h >>> 0;
}

// ---------------------------------------------------------------------------------------------------------------------
export type GrassStyle = 'fine' | 'soft';
export const DEFAULT_STYLE: GrassStyle = 'fine';
export type GrassTier = {
  /** LOD0 (blades): reach in m, cell size in m, segments per blade */
  r0: number; cell0: number; seg0: number;
  /** LOD1 (tufts): reach, cell, segments, blades per tuft */
  r1: number; cell1: number; seg1: number; blades: number;
};
// Research budgets (an M2 Max, ~0.7 to 1.2 ms per million triangles, vertex bound): mid ~180k triangles, high ~1.1 to 1.3 M.
export const TIERS: Record<1 | 2, GrassTier> = {
  1: { r0: 4.4, cell0: 0.04, seg0: 3, r1: 11, cell1: 0.1, seg1: 1, blades: 6 },
  2: { r0: 6.5, cell0: 0.038, seg0: 4, r1: 16, cell1: 0.1, seg1: 1, blades: 6 },
};
export type GrassVariant = { height: number; width: number; label: string };
export const VARIANTS: Record<string, GrassVariant> = {
  mown: { height: 0.085, width: 0.012, label: 'mown lawn' },
  meadow: { height: 0.42, width: 0.016, label: 'meadow' },
};

/** blade geometry: seg segments, two verts a level and a tip; position = (side -1..1, along 0..1, blade index in the tuft) */
export function bladeGeometry(THREE: any, seg: number, blades = 1): any {
  const pos: number[] = [], idx: number[] = [];
  const per = 2 * seg + 1;
  for (let b = 0; b < blades; b++) {
    const o = b * per;
    for (let j = 0; j < seg; j++) { const y = j / seg; pos.push(-1, y, b, 1, y, b); }
    pos.push(0, 1, b);
    for (let j = 0; j < seg - 1; j++) { const a = o + 2 * j; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    const t = o + 2 * (seg - 1); idx.push(t, t + 1, t + 2);
  }
  const g = new THREE.InstancedBufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.userData.trisPer = idx.length / 3;
  return g;
}

/** the mean linear albedo of a material (colour x map), 16 x 16 samples of its map; a lawn green when it cannot be read */
export function meanAlbedo(THREE: any, mat: any, fallback = 0x4e6a3a): any {
  const out = new THREE.Color(fallback);   // (three converts the hex to linear working space)
  try {
    const img = mat && mat.map && mat.map.image;
    if (img && typeof document !== 'undefined') {
      const c = document.createElement('canvas'); c.width = c.height = 16;
      const g = c.getContext('2d', { willReadFrequently: true });
      if (g) {
        g.drawImage(img, 0, 0, 16, 16);
        const d = g.getImageData(0, 0, 16, 16).data;
        let r = 0, gg = 0, b = 0;
        const lin = (v: number) => { v /= 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
        for (let i = 0; i < d.length; i += 4) { r += lin(d[i]); gg += lin(d[i + 1]); b += lin(d[i + 2]); }
        const n = d.length / 4;
        out.setRGB(r / n, gg / n, b / n);
        if (mat.color) out.multiply(mat.color);
      }
    }
  } catch { /* a tainted or odd canvas: the fallback stands */ }
  return out;
}

// ---------------------------------------------------------------------------------------------------------------------
// the field
export type FieldHost = {
  THREE: any; scene: any; renderer: any;
  bake: SiteBake;
  seed: number;
  variant: GrassVariant;
  style: GrassStyle;
  /** overrides for the tier table and the variant (?gtune={"cell0":0.04,"height":0.1}), for judging the look */
  tune?: Record<string, number>;
  mean: any;                      // THREE.Color, the lawn's mean linear albedo
  windDir: [number, number];
};
const FIELD_VERT = /* glsl */`
uniform float uTime; uniform vec3 uCam; uniform float uPxScale;
uniform vec2 uBaseCell; uniform float uCell; uniform int uG; uniform uint uSeed;
uniform vec4 uBand; uniform float uHeight; uniform float uWidth; uniform float uFan;
uniform sampler2D uMask; uniform vec4 uRect; uniform vec3 uWind; uniform float uRefY;
varying float vH; varying float vRnd; varying float vPatch;
vec3 gBase; float gHs, gWs, gYaw, gBend, gVis; bool gCull; vec2 gDir;
${HASH_GLSL}
${SLOT_GLSL}
void grassInstance(float bladeIx) {
  int G = uG, id = gl_InstanceID;
  ivec2 cell = gh_slot(id, G, ivec2(uBaseCell));
  uint key = gh_cell(cell, uSeed);
  vec2 xz = (vec2(cell) + vec2(gh_f(key + 1u), gh_f(key + 2u))) * uCell;
  // how much of this level of detail is here at this distance (the two levels' shares add up to 1 in the overlap). The distance
  // is taken to the lawn's reference height, so the cull below needs no look at the mask: most slots of the window are out of
  // their level's reach or lose the random draw, and they leave before the texture fetch and the rest of the hashes.
  float d0 = length(vec3(xz.x - uCam.x, uCam.y - uRefY, xz.y - uCam.z));
#ifdef GRASS_TUFT
  float vis = smoothstep(uBand.x, uBand.y, d0) * (1.0 - smoothstep(uBand.z, uBand.w, d0));
  float grow = 1.0 - smoothstep(uBand.z, uBand.w, d0);
#else
  float vis = 1.0 - smoothstep(uBand.x, uBand.y, d0);
  float grow = 1.0;
#endif
  gBase = vec3(xz.x, 0.0, xz.y); gHs = 0.0; gWs = 0.0; gYaw = 0.0; gBend = 0.0; gVis = 0.0; gCull = true; vRnd = 0.0; vPatch = 0.0;
  if (!(gh_f(key + 3u) < vis)) return;
  vec2 muv = vec2((xz.x - uRect.x) * uRect.z, (uRect.y - xz.y) * uRect.w);
  vec4 m = textureLod(uMask, muv, 0.0);
  float inside = all(greaterThanEqual(muv, vec2(0.0))) && all(lessThanEqual(muv, vec2(1.0))) ? 1.0 : 0.0;
  // (a hard line thinner than the blur, a 5 cm wall or a fence post, leaves the lawn channel at about 0.7: the remap takes it out, and
  // moves a plain edge about 5 cm into the lawn, which is the inset a blade at an edge needs)
  float cov = smoothstep(0.6, 0.98, m.r) * inside * (1.0 - smoothstep(0.0, 0.35, m.b));
  float gy = m.r > 0.02 ? m.g / m.r : 0.0;
  float d = distance(vec3(xz.x, gy, xz.y), uCam);
  // the random threshold: density thins out toward the edge of the lawn (cover < 1)
  gCull = !(gh_f(key + 4u) < cov);
  float hs = uHeight * (0.7 + 0.6 * gh_f(key + 5u));
  float dryv = gh_patch(xz);
  hs *= (0.82 + 0.36 * dryv) * smoothstep(0.2, 0.9, cov) * grow;
  float ws = uWidth * (0.8 + 0.4 * gh_f(key + 6u));
  float yaw = gh_f(key + 7u) * 6.2831853;
  float bend = 0.12 + 0.5 * gh_f(key + 8u);
  vec2 off = vec2(0.0);
#ifdef GRASS_TUFT
  {
    float n = float(N_BLADES);
    uint bk = gh_u(key + 977u * (uint(bladeIx) + 1u));
    float f = bladeIx / (n - 1.0) - 0.5;
    yaw += f * uFan + (gh_f(bk + 1u) - 0.5) * 0.35;
    hs *= 0.7 + 0.5 * gh_f(bk + 2u);
    bend = 0.2 + 0.5 * gh_f(bk + 3u) + abs(f) * 0.5;
    ws *= 0.85 + 0.3 * gh_f(bk + 4u);
    float a = gh_f(bk + 5u) * 6.2831853;
    off = vec2(cos(a), sin(a)) * uCell * 0.22 * gh_f(bk + 6u);
  }
#endif
  xz += off;
  // the camera pushes blades aside within 0.6 m and flattens them under 0.3 m (only when it is near the ground)
  vec2 toC = xz - uCam.xz;
  float dc = length(toC);
  float low = 1.0 - smoothstep(0.6, 1.8, uCam.y - gy);
  hs *= mix(1.0, smoothstep(0.12, 0.35, d), low);
  gBase = vec3(xz.x, gy, xz.y);
  gDir = dc > 1e-4 ? toC / dc : vec2(1.0, 0.0);
  gBend = bend + (1.0 - smoothstep(0.0, 0.7, dc)) * low * 0.9;
  gHs = hs; gWs = ws; gYaw = yaw; gVis = vis;
  // a blade is never thinner than ~0.9 px on screen (a sub-pixel blade is what flickers): widen by the pixel size at its distance
  float wpx = 0.9 / (uPxScale / max(d, 0.2));
  gWs = max(gWs, min(wpx * 2.0, gWs * 4.0));
  vRnd = gh_f(key + 9u);
  vPatch = dryv;
}`;
const FIELD_NORMAL = /* glsl */`
  grassInstance(position.z);
  vec3 objectNormal;
  {
    vec2 dir = vec2(cos(gYaw), sin(gYaw));
    vec2 sd = vec2(-dir.y, dir.x);
    // a face normal, leaned toward the sky and rounded across the width: grass is lit like the ground it grows from
    objectNormal = normalize(vec3(dir.x * 0.34 + sd.x * position.x * 0.3, 1.0 + gBend * 0.2, dir.y * 0.34 + sd.y * position.x * 0.3));
  }
`;
const FIELD_BEGIN = /* glsl */`
  vec3 transformed;
  {
    float y = position.y;
    vec2 dir = vec2(cos(gYaw), sin(gYaw));
    vec2 sd = vec2(-dir.y, dir.x);
    // wind: a gust front travelling across the lawn, with a slower sway at right angles and a fast per-blade flutter
    vec2 wd = uWind.xy;
    float ph = dot(gBase.xz, wd) * 0.33 - uTime * 1.5;
    float gust = 0.5 + 0.5 * sin(ph) * (0.65 + 0.35 * sin(dot(gBase.xz, vec2(-wd.y, wd.x)) * 0.11 + uTime * 0.37));
    float flutter = sin(uTime * 5.3 + vRnd * 40.0 + y * 2.0) * 0.12;
    float lean = (gBend + (gust + flutter) * uWind.z) * y * y;
    vec2 horiz = dir * lean * gHs + wd * (gust * uWind.z * 0.6) * y * y * gHs;
    float width = gWs * 0.5 * (1.0 - 0.85 * y * y) * position.x;
    transformed = gBase + vec3(sd.x * width, y * gHs * (1.0 - 0.28 * min(lean, 1.0)), sd.y * width) + vec3(horiz.x, 0.0, horiz.y);
    vH = y;
  }
`;
const FIELD_FRAG_PARS = /* glsl */`
varying float vH; varying float vRnd; varying float vPatch;
uniform vec3 uMean; uniform float uLift; uniform float uTrans; uniform vec3 uTone; uniform float uGain;
`;
const FIELD_COLOR = /* glsl */`
  {
    // the palette is the lawn's own mean albedo, dark and cool at the base, light and a little yellow at the tip, dry where the
    // lawn is dry; weights chosen so the width-weighted mean over a blade is the mean itself
    float far = smoothstep( 2.5, 9.0, length( vViewPosition ) );   // far away a blade's dark base and light tip average out
    float g = mix( vH, 0.5 + 0.2 * vH, far * 0.6 );
    vec3 baseC = uMean * vec3(0.66, 0.72, 0.60);
    vec3 tipC = uMean * vec3(1.34, 1.38, 0.95);
    vec3 c = mix(baseC, tipC, smoothstep(0.0, 1.0, g));
    float dry = smoothstep(0.52, 0.78, vPatch);
    c = mix(c, c * vec3(1.22, 1.06, 0.62), dry * 0.55 * (0.4 + 0.6 * g));
    c *= 0.82 + 0.36 * vRnd;
    c *= uTone * uGain;
    diffuseColor.rgb = c;
  }
`;
const FIELD_NORMAL_FRAG = /* glsl */`
  float faceDirection = gl_FrontFacing ? 1.0 : -1.0;
  vec3 normal = normalize( vNormal );   // (no flip for the back face: both sides of a blade are lit as the sky-leaning blade)
  vec3 nonPerturbedNormal = normal;
`;
const FIELD_OUT = /* glsl */`
  vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + totalEmissiveRadiance + diffuseColor.rgb * uLift * (0.45 + 0.55 * vH);
  #if NUM_DIR_LIGHTS > 0
  {
    // the sun behind the blade: light comes through it toward the eye, strongest at the tip, only where the sun reaches
    vec3 Ls = directionalLights[ 0 ].direction;
    float back = pow( saturate( dot( -normalize( vViewPosition ), Ls ) ), 3.0 );
    float sh = 1.0;
    #if defined( USE_SHADOWMAP ) && NUM_DIR_LIGHT_SHADOWS > 0
      DirectionalLightShadow dls = directionalLightShadows[ 0 ];
      sh = receiveShadow ? getShadow( directionalShadowMap[ 0 ], dls.shadowMapSize, dls.shadowIntensity, dls.shadowBias, dls.shadowRadius, vDirectionalShadowCoord[ 0 ] ) : 1.0;
    #endif
    outgoingLight += diffuseColor.rgb * directionalLights[ 0 ].color * ( back * sh * uTrans * vH * vH );
  }
  #endif
`;

export type Field = {
  group: any;
  uniforms: Record<string, { value: any }>;
  /** per frame: the camera, the clock, the drawing buffer */
  update(camera: any, tS: number, bufH: number): boolean;
  /** true when the field draws anything this frame (a camera above the reach draws none) */
  readonly visible: boolean;
  /** true when the camera is close enough for the wind to read (the frames it asks for while paused are worth drawing) */
  readonly animated: boolean;
  setLook(o: { lift?: number; trans?: number; tone?: [number, number, number] }): void;
  setTier(t: 1 | 2): void;
  dispose(): void;
  stats(): Record<string, unknown>;
};

export function createField(host: FieldHost, tier: 1 | 2): Field {
  const { THREE, bake } = host;
  const group = new THREE.Group(); group.name = 'Grass (live)'; group.userData.iso = false;
  // soft: broader, fewer blades; fine: narrow and dense (the parameter that is judged in real lighting)
  const soft = host.style === 'soft';
  const shared: Record<string, { value: any }> = {
    uTime: { value: 0 }, uCam: { value: new THREE.Vector3() }, uPxScale: { value: 700 },
    uSeed: { value: host.seed >>> 0 }, uRefY: { value: bake.yMax },
    uMask: { value: bake.texture }, uRect: { value: new THREE.Vector4(bake.rect.x0, bake.rect.z0 + bake.rect.d, 1 / bake.rect.w, 1 / bake.rect.d) },
    uWind: { value: new THREE.Vector3(host.windDir[0], host.windDir[1], host.variant.height > 0.2 ? 0.55 : 0.4) },
    uMean: { value: new THREE.Vector3(host.mean.r, host.mean.g, host.mean.b) },
    uLift: { value: 0 }, uTrans: { value: 0.9 }, uTone: { value: new THREE.Vector3(1, 1, 1) },
  };
  let cur: 1 | 2 = tier;
  let lods: { mesh: any; cfg: any; U: Record<string, { value: any }>; tris: number; instances: number; tuft: boolean }[] = [];
  let visible = false, animated = false, bufH = 700, lastR1 = 0;

  const tune = host.tune || {};
  const makeLod = (tuft: boolean, T: GrassTier) => {
    const cell = (tuft ? T.cell1 : T.cell0) * (soft ? 1.5 : 1);
    const reach = tuft ? T.r1 : T.r0;
    const G = Math.ceil((2 * reach) / cell) + 4;
    const seg = tuft ? T.seg1 : T.seg0, n = tuft ? T.blades : 1;
    const geo = bladeGeometry(THREE, seg, n);
    geo.instanceCount = G * G;
    // constant cover: a tuft's blades are wider by (cell1 / cell0)^2 / blades, so width x height x count per m2 matches the near blades'
    const c0 = T.cell0 * (soft ? 1.5 : 1), c1 = T.cell1 * (soft ? 1.5 : 1);
    const w0 = (typeof tune.width === 'number' ? tune.width : host.variant.width) * (soft ? 1.9 : 1);
    const width = tuft ? (w0 * (c1 * c1) / (c0 * c0)) / T.blades * 1.0 : w0;
    const height = (typeof tune.height === 'number' ? tune.height : host.variant.height) * (tuft ? 0.92 : 1);
    const band = tuft ? new THREE.Vector4(T.r0 * 0.55, T.r0, T.r1 * 0.45, T.r1) : new THREE.Vector4(T.r0 * 0.55, T.r0, 0, 0);
    const U: Record<string, { value: any }> = {
      uBaseCell: { value: new THREE.Vector2() }, uCell: { value: cell }, uG: { value: G }, uBand: { value: band },
      uHeight: { value: height }, uWidth: { value: width }, uFan: { value: 1.1 }, uGain: { value: tuft ? 1.1 : 1.14 },
    };
    const mat = new THREE.MeshLambertMaterial({ color: 0xffffff, side: THREE.DoubleSide });
    mat.name = tuft ? 'Grass tufts' : 'Grass blades';
    mat.customProgramCacheKey = () => (tuft ? 'grass-tuft' : 'grass-blade');
    mat.onBeforeCompile = (sh: any) => {
      Object.assign(sh.uniforms, shared, U);
      const defs = (tuft ? `#define GRASS_TUFT\n#define N_BLADES ${n}\n` : '');
      sh.vertexShader = defs + sh.vertexShader
        .replace('#include <common>', `#include <common>\n${FIELD_VERT}`)
        .replace('#include <beginnormal_vertex>', FIELD_NORMAL)
        .replace('#include <begin_vertex>', FIELD_BEGIN)
        .replace('#include <project_vertex>', `#include <project_vertex>\n if (gCull) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);`);
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', `#include <common>\n${FIELD_FRAG_PARS}`)
        .replace('#include <color_fragment>', `#include <color_fragment>\n${FIELD_COLOR}`)
        .replace('#include <normal_fragment_begin>', FIELD_NORMAL_FRAG)
        .replace('vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + totalEmissiveRadiance;', FIELD_OUT);
    };
    const mesh = new THREE.Mesh(geo, mat);
    mesh.frustumCulled = false; mesh.castShadow = false; mesh.receiveShadow = true; mesh.matrixAutoUpdate = false;
    mesh.name = tuft ? 'Grass tufts (live)' : 'Grass blades (live)'; mesh.userData.iso = false;
    return { mesh, cfg: { cell, reach, G }, U, tris: G * G * geo.userData.trisPer, instances: G * G, tuft };
  };
  const build = (t: 1 | 2) => {
    const T = { ...TIERS[t] } as any;
    for (const k of Object.keys(T)) if (typeof tune[k] === 'number') T[k] = tune[k];
    lods = [makeLod(false, T), makeLod(true, T)];
    for (const l of lods) group.add(l.mesh);
    lastR1 = T.r1;
  };
  const free = () => {
    for (const l of lods) { group.remove(l.mesh); l.mesh.geometry.dispose(); l.mesh.material.dispose(); }
    lods = [];
  };
  build(tier);

  const field: Field = {
    group, uniforms: shared,
    get visible() { return visible; },
    get animated() { return animated; },
    update(camera, tS, h) {
      shared.uTime.value = tS;
      shared.uCam.value.copy(camera.position);
      bufH = h;
      // projectionMatrix[5] = 1 / tan(fov / 2): pixels per metre at 1 m = drawing-buffer height / 2 * that
      shared.uPxScale.value = (h * 0.5) * camera.projectionMatrix.elements[5];
      // nothing can be nearer than the camera's height over the lawn: above the reach, the field costs nothing
      const above = camera.position.y - bake.yMax;
      visible = above < lastR1 + 0.5;
      animated = above < lastR1 * 0.55;
      group.visible = visible;
      if (visible) for (const l of lods) {
        const c = l.cfg.cell, G = l.cfg.G;
        l.U.uBaseCell.value.set(Math.floor(camera.position.x / c) - (G >> 1), Math.floor(camera.position.z / c) - (G >> 1));
      }
      return visible;
    },
    setLook(o) {
      if (o.lift !== undefined) shared.uLift.value = o.lift;
      if (o.trans !== undefined) shared.uTrans.value = o.trans;
      if (o.tone) shared.uTone.value.set(o.tone[0], o.tone[1], o.tone[2]);
    },
    setTier(t) { if (t === cur) return; cur = t; free(); build(t); },
    dispose() { free(); },
    stats() {
      return { tier: cur, style: host.style, variant: host.variant.label, visible, bufH, lods: lods.map(l => ({ tuft: l.tuft, instances: l.instances, tris: l.tris, cell: l.cfg.cell, reach: l.cfg.reach })), trisMax: lods.reduce((a, l) => a + l.tris, 0) };
    },
  };
  void bufH;
  return field;
}

// ---------------------------------------------------------------------------------------------------------------------
// patching a material in place, with an exact undo (the lawn is the kit's own shared material; a merged mesh's stand-in is
// found by traversal, so there is no clone to hand out). The material's own onBeforeCompile (textures.ts worldUV) runs first.
type Saved = { obc: any; ownObc: boolean; key: any; ownKey: boolean };
function patchInPlace(m: any, tag: string, mod: (sh: any) => void, store: Map<any, Saved>): void {
  if (store.has(m)) return;
  const own = (k: string) => Object.prototype.hasOwnProperty.call(m, k);
  store.set(m, { obc: m.onBeforeCompile, ownObc: own('onBeforeCompile'), key: m.customProgramCacheKey, ownKey: own('customProgramCacheKey') });
  const prev = m.onBeforeCompile, baseKey = String(m.customProgramCacheKey());
  m.onBeforeCompile = function (sh: any, r: any) { prev.call(m, sh, r); mod(sh); };
  m.customProgramCacheKey = () => `${baseKey}|${tag}`;
  m.needsUpdate = true;
}
function unpatch(m: any, store: Map<any, Saved>): void {
  const s = store.get(m);
  if (!s) return;
  if (s.ownObc) m.onBeforeCompile = s.obc; else delete m.onBeforeCompile;
  if (s.ownKey) m.customProgramCacheKey = s.key; else delete m.customProgramCacheKey;
  m.needsUpdate = true;
  store.delete(m);
}

// ---------------------------------------------------------------------------------------------------------------------
// the lawn under the grass
export type LawnPatch = {
  apply(): void; restore(): void;
  /** a lighting change or a rebake made new materials: patch the ones that are new */
  sync(): void;
  setLook(o: { lift?: number; mute?: number; edge?: number; soil?: number; reach?: number }): void;
  update(camera: any): void;
  dispose(): void;
  stats(): Record<string, unknown>;
};
export function createLawnPatch(env: { THREE: any; scene: any; bake: SiteBake; reach: number }): LawnPatch {
  const { THREE, scene, bake } = env;
  const U: Record<string, { value: any }> = {
    uLvMask: { value: bake.texture },
    uLvRect: { value: new THREE.Vector4(bake.rect.x0, bake.rect.z0 + bake.rect.d, 1 / bake.rect.w, 1 / bake.rect.d) },
    uLvLook: { value: new THREE.Vector4(0.1, 0.12, 0.3, 0.03) },   // x unused, y muted, z edge darkening, w soil darkening under grass
    uLvLift: { value: 0 },
    uLvGrass: { value: env.reach },   // the grass's reach: the soil under it darkens to here
  };
  const store = new Map<any, Saved>();
  let on = false;
  const mod = (sh: any) => {
    Object.assign(sh.uniforms, U);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vLvW;')
      .replace('#include <project_vertex>', '#include <project_vertex>\n vLvW = ( modelMatrix * vec4( transformed, 1.0 ) ).xyz;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>\nvarying vec3 vLvW;\nuniform sampler2D uLvMask; uniform vec4 uLvRect; uniform vec4 uLvLook; uniform float uLvLift; uniform float uLvGrass;\n${HASH_GLSL}`)
      .replace('#include <color_fragment>', `#include <color_fragment>
        {
          vec3 lw = vLvW;
          float gnd = 1.0 - smoothstep(0.35, 0.6, lw.y);   // the ground lawn: not a green roof or a raised courtyard
          vec3 c = diffuseColor.rgb;
          float lum = dot( c, vec3( 0.2126, 0.7152, 0.0722 ) );
          c = mix( vec3( lum ), c, 1.0 - uLvLook.y * gnd );
          float pa = gh_patch( lw.xz );
          float dry = smoothstep( 0.52, 0.78, pa ), lush = smoothstep( 0.45, 0.2, pa );
          c = mix( c, c * vec3( 1.22, 1.06, 0.62 ), dry * 0.55 * gnd );
          c = mix( c, c * vec3( 0.9, 1.03, 0.88 ), lush * 0.5 * gnd );
          c *= 1.0 + ( 0.92 + 0.16 * gh_noise( lw.xz * 6.1 + 3.7 ) - 1.0 ) * gnd;
          vec2 muv = vec2( ( lw.x - uLvRect.x ) * uLvRect.z, ( uLvRect.y - lw.z ) * uLvRect.w );
          float inside = ( all( greaterThanEqual( muv, vec2( 0.0 ) ) ) && all( lessThanEqual( muv, vec2( 1.0 ) ) ) ) ? gnd : 0.0;
          vec4 bk = texture2D( uLvMask, muv );
          c *= 1.0 - uLvLook.z * smoothstep( 0.04, 0.65, bk.a ) * inside;
          float gp = 1.0 - smoothstep( uLvGrass * 0.45, uLvGrass * 0.95, distance( cameraPosition, lw ) );
          c *= 1.0 - uLvLook.w * gp * bk.r * inside;
          diffuseColor.rgb = c;
        }`)
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n totalEmissiveRadiance += diffuseColor.rgb * uLvLift;');
  };
  const lawnMats = (): any[] => {
    const out = new Set<any>();
    scene.traverse((o: any) => {
      if (!o.isMesh || o.isInstancedMesh) return;
      for (const m of Array.isArray(o.material) ? o.material : [o.material]) if (m && m.userData && m.userData.surface === 'lawn' && m.isMeshStandardMaterial) out.add(m);
    });
    return [...out];
  };
  return {
    apply() { on = true; for (const m of lawnMats()) patchInPlace(m, 'lawn-live', mod, store); },
    restore() { on = false; for (const m of [...store.keys()]) unpatch(m, store); },
    sync() { if (on) for (const m of lawnMats()) patchInPlace(m, 'lawn-live', mod, store); },
    setLook(o) {
      if (o.lift !== undefined) U.uLvLift.value = o.lift;
      if (o.mute !== undefined) U.uLvLook.value.y = o.mute;
      if (o.edge !== undefined) U.uLvLook.value.z = o.edge;
      if (o.soil !== undefined) U.uLvLook.value.w = o.soil;
      if (o.reach !== undefined) U.uLvGrass.value = o.reach;
    },
    update() { /* (cameraPosition is a three built-in) */ },
    dispose() { this.restore(); },
    stats: () => ({ patched: store.size }),
  };
}

// ---------------------------------------------------------------------------------------------------------------------
// the crowns
export type Foliage = {
  apply(): void; restore(): void; sync(): void;
  update(tS: number): void;
  setLook(o: { trans?: number; lift?: number }): void;
  dispose(): void;
  stats(): Record<string, unknown>;
};
// the instanced meshes of site.ts / world.ts that are leaves, by the names they carry
const FOLIAGE_NAMES = new Set(['Leaves', 'Hedge leaves', 'Branch sprays', 'Willow strands', 'Crown core', 'Bed shrubs', 'Bed foliage', 'World · crowns', 'World · conifers']);
const PER_INSTANCE = new Set(['World · crowns', 'World · conifers', 'Bed shrubs', 'Bed foliage']);   // many trees in one mesh: each instance is its own crown
export function createFoliage(env: { THREE: any; scene: any; windDir: [number, number] }): Foliage {
  const { THREE, scene } = env;
  const shared: Record<string, { value: any }> = {
    uFolT: { value: 0 }, uFolWind: { value: new THREE.Vector2(env.windDir[0], env.windDir[1]) }, uFolTrans: { value: 0.8 }, uFolLift: { value: 0 },
  };
  type Entry = { mesh: any; orig: any; clone: any };
  const entries: Entry[] = [];
  let on = false;
  const mkMod = (per: boolean, C: any, R: any, core: boolean) => (sh: any) => {
    Object.assign(sh.uniforms, shared, { uFolC: { value: C }, uFolR: { value: R } });
    const defs = (per ? '#define FOL_PER\n' : '') + (core ? '#define FOL_CORE\n' : '');
    sh.vertexShader = defs + sh.vertexShader
      .replace('#include <common>', `#include <common>
        uniform float uFolT; uniform vec2 uFolWind; uniform vec3 uFolC; uniform vec3 uFolR;
        varying vec3 vFolN; varying float vFolY; varying vec3 vFolW;`)
      .replace('#include <project_vertex>', `
        vec4 mvPosition = vec4( transformed, 1.0 );
        vec3 fcen = vec3( 0.0 ), frad = uFolR;
        #ifdef USE_INSTANCING
          mvPosition = instanceMatrix * mvPosition;
          #ifdef FOL_PER
            fcen = instanceMatrix[ 3 ].xyz; frad = vec3( length( instanceMatrix[ 0 ].xyz ), length( instanceMatrix[ 1 ].xyz ), length( instanceMatrix[ 2 ].xyz ) );
          #else
            fcen = uFolC;
          #endif
        #else
          fcen = uFolC;
        #endif
        vec3 fdir = ( mvPosition.xyz - fcen ) / max( frad, vec3( 0.05 ) );
        vFolN = normalize( normalMatrix * normalize( normalize( fdir ) + vec3( 0.0, 0.45, 0.0 ) ) );   // (leaves lean to the sky: the crown's underside is not black)
        vFolY = clamp( 0.5 + 0.5 * fdir.y, 0.0, 1.0 );
        vec4 fw = modelMatrix * mvPosition;
        vFolW = fw.xyz;
        // the crown sways with the wind (a slow swell along it, a faster flutter per cluster); the base of the crown stays put
        float swell = sin( uFolT * 0.85 + dot( fw.xz, uFolWind ) * 0.12 ) * 0.6 + sin( uFolT * 1.9 + fw.x * 0.27 + fw.z * 0.23 ) * 0.4;
        float flut = sin( uFolT * 4.3 + dot( fw.xyz, vec3( 1.7, 2.3, 3.1 ) ) );
        float amp = 0.014 * max( frad.y, 0.2 ) * vFolY * vFolY;
        fw.xz += uFolWind * ( swell * amp + flut * 0.004 * vFolY );
        mvPosition = viewMatrix * fw;
        gl_Position = projectionMatrix * mvPosition;`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
        uniform float uFolTrans; uniform float uFolLift; varying vec3 vFolN; varying float vFolY; varying vec3 vFolW;
        ${HASH_GLSL}`)
      .replace('#include <color_fragment>', `#include <color_fragment>
        {
          float cn = gh_noise( vFolW.xz * 0.9 + vFolW.y * 0.6 ) * 0.65 + gh_noise( vFolW.xz * 3.1 + vFolW.y * 2.0 ) * 0.35;
          diffuseColor.rgb *= ( 0.86 + 0.28 * cn ) * mix( vec3( 0.95, 1.02, 0.95 ), vec3( 1.07, 1.0, 0.86 ), cn );
          #ifndef FOL_CORE
            diffuseColor.rgb *= mix( 0.8, 1.0, smoothstep( 0.0, 0.7, vFolY ) );
          #endif
        }`)
      .replace('#include <normal_fragment_begin>', `#include <normal_fragment_begin>
        normal = normalize( mix( normal, normalize( vFolN ), 0.5 ) );`)
      .replace('vec3 outgoingLight = totalDiffuse + totalSpecular + totalEmissiveRadiance;', `vec3 outgoingLight = totalDiffuse + totalSpecular + totalEmissiveRadiance + diffuseColor.rgb * uFolLift;   // (night: crowns lifted off black)
        #if NUM_DIR_LIGHTS > 0 && ! defined( FOL_CORE )
        {
          vec3 Ls = directionalLights[ 0 ].direction;
          float back = pow( saturate( dot( -normalize( vViewPosition ), Ls ) ), 2.0 );
          float thin = saturate( dot( -normalize( vFolN ), Ls ) * 0.6 + 0.3 );   // light through the leaves: the side away from the sun glows
          float sh = 1.0;
          #if defined( USE_SHADOWMAP ) && NUM_DIR_LIGHT_SHADOWS > 0
            DirectionalLightShadow dls = directionalLightShadows[ 0 ];
            sh = receiveShadow ? getShadow( directionalShadowMap[ 0 ], dls.shadowMapSize, dls.shadowIntensity, dls.shadowBias, dls.shadowRadius, vDirectionalShadowCoord[ 0 ] ) : 1.0;
          #endif
          outgoingLight += diffuseColor.rgb * directionalLights[ 0 ].color * ( ( 0.22 * thin + 0.25 * back ) * mix( 0.55, 1.0, sh ) * uFolTrans * ( 0.45 + 0.55 * vFolY ) );
        }
        #endif`);
  };
  const find = (): any[] => {
    const out: any[] = [];
    scene.traverse((o: any) => {
      if (o.isInstancedMesh && FOLIAGE_NAMES.has(o.name) && o.material && !Array.isArray(o.material) && o.material.isMeshStandardMaterial && !(o.material.userData && o.material.userData.__fol)) out.push(o);
    });
    return out;
  };
  const crownBox = (mesh: any): { c: any; r: any } => {
    // the crown's centre and half-extent in the mesh's own space, from the instances' positions (their clusters' radii added)
    const n = mesh.count, m = new THREE.Matrix4(), p = new THREE.Vector3(), lo = new THREE.Vector3(1e9, 1e9, 1e9), hi = new THREE.Vector3(-1e9, -1e9, -1e9);
    const gr = mesh.geometry.boundingSphere || (mesh.geometry.computeBoundingSphere(), mesh.geometry.boundingSphere);
    for (let i = 0; i < n; i++) {
      mesh.getMatrixAt(i, m); p.setFromMatrixPosition(m);
      const s = Math.max(m.getMaxScaleOnAxis(), 0.001) * (gr ? gr.radius : 1);
      lo.min(new THREE.Vector3(p.x - s, p.y - s, p.z - s)); hi.max(new THREE.Vector3(p.x + s, p.y + s, p.z + s));
    }
    const c = lo.clone().add(hi).multiplyScalar(0.5), r = hi.clone().sub(lo).multiplyScalar(0.5);
    r.max(new THREE.Vector3(0.1, 0.1, 0.1));
    return { c, r };
  };
  const add = (mesh: any) => {
    const orig = mesh.material, per = PER_INSTANCE.has(mesh.name), core = mesh.name === 'Crown core';
    const clone = orig.clone();
    clone.flatShading = false;
    clone.userData = { ...orig.userData, __fol: true };
    const { c, r } = per ? { c: new THREE.Vector3(), r: new THREE.Vector3(1, 1, 1) } : crownBox(mesh);
    const mod = mkMod(per, c, r, core);
    clone.onBeforeCompile = mod;
    clone.customProgramCacheKey = () => `fol-${per ? 'p' : 'c'}${core ? 'k' : ''}|${orig.vertexColors ? 'vc' : ''}`;
    clone.needsUpdate = true;
    mesh.material = clone;
    entries.push({ mesh, orig, clone });
  };
  return {
    apply() { on = true; for (const m of find()) add(m); },
    restore() {
      on = false;
      for (const e of entries) { if (e.mesh.material === e.clone) e.mesh.material = e.orig; e.clone.dispose(); }
      entries.length = 0;
    },
    sync() { if (on) for (const m of find()) add(m); },
    update(tS) { shared.uFolT.value = tS; },
    setLook(o) { if (o.trans !== undefined) shared.uFolTrans.value = o.trans; if (o.lift !== undefined) shared.uFolLift.value = o.lift; },
    dispose() { this.restore(); },
    stats: () => ({ meshes: entries.length }),
  };
}
