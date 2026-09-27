// Time of day — the light a house is seen in, as data plus the few pure functions that turn it into a scene.
//
// A preset says what the hour is MADE of:
//   sky        three colours [top, horizon, ground]. Baked two ways: through PMREM it is scene.environment, the
//              image-based light every PBR material samples (cool from above, warm from the horizon, a dim
//              bounce from below); as an equirect it is the backdrop, fading below the horizon into the ground
//              colour by exactly the function the fog uses, so fogged ground and backdrop meet without a seam.
//   sun        colour / intensity / elevation / swing (degrees round from straight in front of the entry, + = to
//              the front's left). Where it stands comes from the house — room-creator.html's applyLighting aims it.
//   hemi, fill the sky/ground bounce and a cool fill opposite the sun. Neither casts shadows.
//   fog        [near, far] in metres, to the horizon colour. far stays inside the camera's far plane (160 m) so
//              the ground is fully hazed before it is clipped.
//   exposure, env   tone-mapping exposure, set for ACES filmic (TONE_EXPOSURE rescales it for the A/B
//              mappers), and scene.environmentIntensity.
//   lampGain   the house's own lamps: every material under an object tagged userData.fixture has its emissive
//              scaled by it (and fixture lights read it from the `house:lighting` event).
//   windowGlow glass under an object tagged userData.windowGlow glows glowColor at this emissive intensity.
//   bloom, grade    the offline composer's bloom (threshold is linear, pre-tone-mapping radiance) and its
//              scene-referred grade: contrast about mid-grey, saturation, a vignette.
//
// day / dusk / night start from the numbers of Pascal Next's published time-of-day presets (sky, sun colour,
// hemisphere, fill, lampGain); golden takes its sky, hemisphere and fill from their dawn. The sun's strength
// and height, the environment intensity, exposure, fog, bloom and grade are ours — tuned by eye and by
// sampling their demo frames. At dusk a lit white wall there reads about #978681 and the lawn #1c2b16; at
// night the walls read #1e2a3c. So dusk here swaps their blue hemisphere for a lavender one, lets the salmon
// horizon reach the walls through the environment, and grades saturation down until a lawn stops reading as
// green paint. The dusk and night lamp gains sit above theirs (1.6 / 1.7 against 1.2 / 1.3): the fixtures'
// base intensities were set under the first pass's Neutral mapping, and under ACES the same rooms read dim
// next to Pascal's; raising the gain lifts every lamp, pool and pendant together without touching their bases.
//
// Everything is a pure function of the preset and the sun direction: no randomness, no clock — the frame-hash
// test and the goldens depend on two runs agreeing.

export type Preset = {
  label: string;
  sky: [string, string, string];
  sun: { color: string; intensity: number; elevation: number; swing: number };
  hemi: { sky: string; ground: string; intensity: number };
  fill: { color: string; intensity: number };
  ambient: number;
  exposure: number;
  env: number;
  fog: [number, number];
  shadow: number;
  lampGain: number;
  windowGlow: number;
  glowColor: string;
  sunGlow: number;
  bloom: { strength: number; radius: number; threshold: number };
  grade: { contrast: number; saturation: number; vignette: number };
};

export const TIME_OF_DAY: Record<string, Preset> = {
  day: {
    label: 'Day',
    sky: ['#608eb8', '#dae5e4', '#b4b9a6'],
    sun: { color: '#fff5e3', intensity: 3.6, elevation: 50, swing: -38 },
    hemi: { sky: '#e6efff', ground: '#aaa992', intensity: 1.3 },
    fill: { color: '#dce8ff', intensity: 0.32 },
    ambient: 0,
    exposure: 0.78, env: 0.48,
    fog: [60, 155], shadow: 0.8,
    lampGain: 0.035, windowGlow: 0, glowColor: '#ffe2bd', sunGlow: 0.25,
    bloom: { strength: 0.08, radius: 0.4, threshold: 2.5 },
    grade: { contrast: 1.06, saturation: 0.88, vignette: 0.14 },
  },
  golden: {
    label: 'Golden hour',
    sky: ['#657ba0', '#efb8a1', '#686f73'],
    sun: { color: '#ffc39a', intensity: 4.2, elevation: 18, swing: -50 },
    hemi: { sky: '#b5c7df', ground: '#9b8d81', intensity: 1.55 },
    fill: { color: '#a9bfdf', intensity: 0.5 },
    ambient: 0,
    exposure: 1.0, env: 0.55,
    fog: [55, 150], shadow: 0.8,
    lampGain: 0.3, windowGlow: 0.18, glowColor: '#ffdcb0', sunGlow: 0.6,
    bloom: { strength: 0.15, radius: 0.4, threshold: 2.0 },
    grade: { contrast: 1.05, saturation: 0.9, vignette: 0.18 },
  },
  dusk: {
    label: 'Dusk',
    sky: ['#4e638b', '#e5a38b', '#5d626e'],
    sun: { color: '#ffa98f', intensity: 1.0, elevation: 8, swing: -64 },
    hemi: { sky: '#b9aed0', ground: '#837773', intensity: 0.9 },
    fill: { color: '#9eaecd', intensity: 0.3 },
    ambient: 0,
    exposure: 0.9, env: 0.7,
    fog: [70, 155], shadow: 0.6,
    lampGain: 1.6, windowGlow: 0.8, glowColor: '#ffd9a8', sunGlow: 0.8,
    bloom: { strength: 0.35, radius: 0.4, threshold: 1.8 },
    grade: { contrast: 1.05, saturation: 0.72, vignette: 0.22 },
  },
  night: {
    label: 'Night',
    sky: ['#0b1731', '#424b64', '#17202a'],
    sun: { color: '#bed5ff', intensity: 0.35, elevation: 38, swing: 40 },
    hemi: { sky: '#829fc9', ground: '#3d4656', intensity: 0.72 },
    fill: { color: '#8aa2c9', intensity: 0.22 },
    ambient: 0,
    exposure: 0.85, env: 0.22,
    fog: [55, 150], shadow: 0.5,
    lampGain: 1.7, windowGlow: 1.0, glowColor: '#ffd49e', sunGlow: 0.1,
    bloom: { strength: 0.4, radius: 0.4, threshold: 1.6 },
    grade: { contrast: 1.05, saturation: 0.8, vignette: 0.26 },
  },
};

// The tone mapper is ACES filmic, as in Pascal's renderer, and every preset's exposure above is set for it.
// Against the same frames, Khronos PBR Neutral kept a bright warm lamp's hue all the way up, so a lit room at
// dusk read as an orange blob; ACES rolls it off to the warm white Pascal's rooms glow with, and gives the
// exteriors their darker, filmic foot. (three's ACES divides exposure by 0.6, hence the numbers below 1.)
// `?tone=neutral|agx` stays for A/B checks; these factors bring those mappers' mid-greys roughly level.
export const TONE_EXPOSURE: Record<string, number> = { aces: 1, neutral: 1.3, agx: 1.35 };

// Old spec / scene names keep working. The daylight family all becomes Pascal's day; the warm low-sun ones
// golden hour; the dark studio looks dusk (the house lit from inside) and the neon one night.
export const LIGHTING_ALIASES: Record<string, string> = {
  'pascal-daylight': 'day', 'ci-mist': 'day', 'studio-clean': 'day', 'ci-biophilic': 'day', 'biophilic': 'day', 'daylight': 'day', 'noon': 'day',
  'ci-twilight': 'golden', 'golden-hour': 'golden', 'dawn': 'golden', 'sunset': 'golden',
  'ci-dark': 'dusk', 'twilight': 'dusk', 'evening': 'dusk',
  'cyberpunk': 'night',
};
export const DEFAULT_LIGHTING = 'day';
export const lightingName = (n?: string | null): string => (n && TIME_OF_DAY[n] ? n : (n && LIGHTING_ALIASES[n]) || DEFAULT_LIGHTING);

const hexOf = (c: string): number => parseInt(c.replace('#', ''), 16);
const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
const smooth = (e0: number, e1: number, x: number): number => { const t = Math.max(0, Math.min(1, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t); };

// Unit vector toward the sun, from the preset and the bearing the entry faces ([fx, fz] in the ground plane).
export function sunDirection(p: Preset, front: [number, number] = [0, 1]): [number, number, number] {
  const DEG = Math.PI / 180;
  const az = Math.atan2(front[0], front[1]) + p.sun.swing * DEG, el = p.sun.elevation * DEG;
  return [Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el)];
}

// The sky as linear RGB along a view direction. Below the horizon it fades from the horizon colour into the
// ground colour by 16° down. `below`: 'ground' — the environment's bounce, a little darker toward the nadir;
// 'backdrop' — exactly the function the fog uses (installSkyFog), so fogged ground and backdrop agree at
// every angle. A soft lobe round the sun warms the sun side of the sky and gives glossy surfaces a highlight.
type Lin = [number, number, number];
function palette(THREE: any, p: Preset): { top: Lin; hor: Lin; gnd: Lin; sun: Lin } {
  const toLin = (c: string): Lin => { const k = new THREE.Color(hexOf(c)); return [k.r, k.g, k.b]; };   // sRGB hex → working (linear)
  return { top: toLin(p.sky[0]), hor: toLin(p.sky[1]), gnd: toLin(p.sky[2]), sun: toLin(p.sun.color) };
}
function skyRadiance(pal: ReturnType<typeof palette>, p: Preset, dir: number[], sun: number[], below: 'ground' | 'backdrop', out: number[]): number[] {
  const { top, hor, gnd } = pal;
  const lat = Math.asin(Math.max(-1, Math.min(1, dir[1]))) / (Math.PI / 2);   // −1 nadir … 1 zenith
  if (lat >= 0) {
    const t = Math.pow(lat, 0.6);   // < 1 widens the pale band above the horizon
    for (let k = 0; k < 3; k++) out[k] = lerp(hor[k], top[k], t);
  } else {
    const t = smooth(0, 0.18, -lat), dim = below === 'ground' ? 1 + lat * 0.25 : 1;
    for (let k = 0; k < 3; k++) out[k] = lerp(hor[k], gnd[k], t) * dim;
  }
  // sun lobe: a broad glow on the sun side and a tighter core, above the horizon only
  if (p.sunGlow > 0) {
    const cosA = Math.max(0, dir[0] * sun[0] + dir[1] * sun[1] + dir[2] * sun[2]);
    const g = p.sunGlow * smooth(-0.02, 0.04, lat) * (0.35 * Math.pow(cosA, 6) + 1.2 * Math.pow(cosA, 64));
    for (let k = 0; k < 3; k++) out[k] += pal.sun[k] * g;
  }
  return out;
}

// An equirectangular half-float sky, row 0 = nadir (three's equirect v runs −90° … +90°).
export function skyEquirect(THREE: any, p: Preset, sun: number[], { width = 256, height = 128, below = 'ground' as 'ground' | 'backdrop' } = {}): any {
  const data = new Uint16Array(width * height * 4);
  const toHalf = THREE.DataUtils.toHalfFloat;
  const pal = palette(THREE, p);
  const c = [0, 0, 0], dir = [0, 0, 0];
  for (let y = 0; y < height; y++) {
    const lat = ((y + 0.5) / height - 0.5) * Math.PI;
    const cl = Math.cos(lat), sl = Math.sin(lat);
    for (let x = 0; x < width; x++) {
      const phi = ((x + 0.5) / width - 0.5) * 2 * Math.PI;   // three: u = atan(dir.z, dir.x) / 2π + 0.5
      dir[0] = Math.cos(phi) * cl; dir[1] = sl; dir[2] = Math.sin(phi) * cl;
      skyRadiance(pal, p, dir, sun, below, c);
      const i = (y * width + x) * 4;
      data[i] = toHalf(c[0]); data[i + 1] = toHalf(c[1]); data[i + 2] = toHalf(c[2]); data[i + 3] = toHalf(1);
    }
  }
  const tex = new THREE.DataTexture(data, width, height, THREE.RGBAFormat, THREE.HalfFloatType);
  tex.mapping = THREE.EquirectangularReflectionMapping;
  tex.colorSpace = THREE.LinearSRGBColorSpace;
  tex.magFilter = THREE.LinearFilter; tex.minFilter = THREE.LinearFilter;
  tex.generateMipmaps = false;
  tex.needsUpdate = true;
  return tex;
}

// PMREM-baked environment + backdrop for one (preset, sun) pair. One bake per call that changes either;
// the previous pair is disposed. The environment gets the ground-bounce sky, the backdrop the fog's.
export function createSkyBaker(THREE: any, renderer: any) {
  const pmrem = new THREE.PMREMGenerator(renderer);
  pmrem.compileEquirectangularShader();
  let current: any = null;
  return {
    bake(name: string, p: Preset, sun: number[]) {
      const key = `${name}|${p.sky.join()}|${p.sun.color}|${p.sunGlow}|${sun.map(v => v.toFixed(4)).join()}`;
      if (current && current.key === key) return current;
      const envSky = skyEquirect(THREE, p, sun, { width: 256, height: 128, below: 'ground' });
      const rt = pmrem.fromEquirectangular(envSky);
      envSky.dispose();
      const background = skyEquirect(THREE, p, sun, { width: 512, height: 256, below: 'backdrop' });
      const prev = current;
      current = { key, rt, environment: rt.texture, background };
      if (prev) { prev.rt.dispose(); prev.background.dispose(); }
      return current;
    },
    get current() { return current; },
  };
}

// Sky-coloured fog. three's Fog fades everything to ONE colour, which is right only at the horizon: from above,
// a dusk house's distant ground went salmon, a golden one's beige. Here the fog colour is the sky's own colour
// along the view ray — scene.fog.color (the horizon) at the horizon line, fading into the sky's ground colour
// looking down and its top colour looking up — the same function the backdrop is baked with, so fogged ground
// meets the backdrop without a seam from any camera pose (what pascalorg/editor's atmosphere fogRadiance does
// with a node material; this is the WebGL-chunk equivalent). Patches three's shared fog shader chunks and the
// built-in materials' uniforms once, before any program compiles. Returns the two shared colours applyLighting
// keeps current; scene.fog stays a plain THREE.Fog (colour = horizon, near, far).
export function installSkyFog(THREE: any): { ground: any; sky: any } {
  const shared = (c: any) => { c.clone = function () { return this; }; return c; };   // one Color for every program's uniform
  const ground = shared(new THREE.Color()), sky = shared(new THREE.Color());
  const add = (u: any) => { if (u && u.fogColor && !u.fogGroundColor) { u.fogGroundColor = { value: ground }; u.fogSkyColor = { value: sky }; } };
  for (const k of Object.keys(THREE.ShaderLib)) add(THREE.ShaderLib[k].uniforms);
  add(THREE.UniformsLib.fog);
  const C = THREE.ShaderChunk;
  C.fog_pars_vertex = '#ifdef USE_FOG\n\tvarying float vFogDepth;\n\tvarying vec3 vFogView;\n#endif';
  C.fog_vertex = '#ifdef USE_FOG\n\tvFogDepth = - mvPosition.z;\n\tvFogView = mvPosition.xyz;\n#endif';
  C.fog_pars_fragment = [
    '#ifdef USE_FOG',
    '\tuniform vec3 fogColor;', '\tuniform vec3 fogGroundColor;', '\tuniform vec3 fogSkyColor;',
    '\tvarying float vFogDepth;', '\tvarying vec3 vFogView;',
    '\t#ifdef FOG_EXP2', '\t\tuniform float fogDensity;', '\t#else', '\t\tuniform float fogNear;', '\t\tuniform float fogFar;', '\t#endif',
    '#endif'].join('\n');
  C.fog_fragment = [
    '#ifdef USE_FOG',
    '\t#ifdef FOG_EXP2', '\t\tfloat fogFactor = 1.0 - exp( - fogDensity * fogDensity * vFogDepth * vFogDepth );',
    '\t#else', '\t\tfloat fogFactor = smoothstep( fogNear, fogFar, vFogDepth );', '\t#endif',
    // world-space view direction: the view-space ray times the (orthonormal) view matrix's transpose
    '\tvec3 fogRay = isOrthographic ? vec3( 0.0, 0.0, -1.0 ) : vFogView;   // an orthographic view looks along -z',
    '\tfloat fogLat = asin( clamp( normalize( ( vec4( fogRay, 0.0 ) * viewMatrix ).xyz ).y, -1.0, 1.0 ) ) * 0.6366198;',
    '\tvec3 fogTint = fogLat >= 0.0 ? mix( fogColor, fogSkyColor, pow( fogLat, 0.6 ) ) : mix( fogColor, fogGroundColor, smoothstep( 0.0, 0.18, - fogLat ) );',
    '\tgl_FragColor.rgb = mix( gl_FragColor.rgb, fogTint, fogFactor );',
    '#endif'].join('\n');
  return { ground, sky };
}

// Tagged fixtures and window glass. A lamp authored at 2.0 reads 2.0 × lampGain at every preset, and
// re-lighting is idempotent: the authored intensity is the material's userData.fixtureBase when the builder
// that made it recorded one (fixtures.ts, props/lighting.ts), else whatever it was the first time it is touched
// here. The recorded base wins, so a material something else already dimmed can never compound.
// Window glass is usually one material shared by every window (and sometimes by a table top or a shower
// screen), so a tagged pane gets a glowing twin of its material — one twin per source material — rather than
// lighting every other user of the original.
const glowTwins = new WeakMap<object, any>();
const matsOf = (o: any): any[] => (Array.isArray(o.material) ? o.material : o.material ? [o.material] : []);
const seeThrough = (m: any): boolean => !!m && (m.transparent || (m.transmission || 0) > 0 || /glass|glazing|pane/i.test(m.name || ''));

export function applyHouseGlow(THREE: any, root: any, p: Preset): { fixtures: number; panes: number } {
  const glow = new THREE.Color(hexOf(p.glowColor));
  let fixtures = 0, panes = 0;
  root.traverse((o: any) => {
    const ud = o.userData;
    if (!ud) return;
    if (ud.fixture) {
      o.traverse((n: any) => {
        if (!n.isMesh) return;
        for (const m of matsOf(n)) {
          if (!m.emissive) continue;
          if (m.userData.__baseEmissive === undefined) m.userData.__baseEmissive = m.emissiveIntensity ?? 1;
          const base = typeof m.userData.fixtureBase === 'number' ? m.userData.fixtureBase : m.userData.__baseEmissive;
          m.emissiveIntensity = base * p.lampGain;
          fixtures++;
        }
      });
    }
    if (ud.windowGlow) {
      o.traverse((n: any) => {
        if (!n.isMesh) return;
        const own = n === o;   // a tagged mesh is glass by declaration; under a tagged group only see-through parts are
        const mats = matsOf(n);
        let changed = false;
        const next = mats.map((m: any) => {
          if (!m.emissive || !(own || seeThrough(m))) return m;
          let twin = m.userData.__glowTwin ? m : glowTwins.get(m);
          if (!twin) { twin = m.clone(); twin.name = `${m.name || 'glass'} (window glow)`; twin.userData = { ...m.userData, __glowTwin: true }; glowTwins.set(m, twin); }
          twin.emissive.copy(glow);
          twin.emissiveIntensity = p.windowGlow;
          if (twin !== m) changed = true;
          panes++;
          return twin;
        });
        if (changed) n.material = Array.isArray(n.material) ? next : next[0];
      });
    }
  });
  return { fixtures, panes };
}

// The composer's scene-referred grade, applied in linear light before tone mapping: contrast about mid-grey
// and a saturation lift (the pivot-and-lift of pascalorg/editor's post-processing GRADE_PARAMS, MIT), then a
// soft vignette.
export const GradeShader = {
  name: 'HouseGradeShader',
  uniforms: {
    tDiffuse: { value: null },
    contrast: { value: 1.0 },
    saturation: { value: 1.0 },
    vignette: { value: 0.0 },
    aspect: { value: 16 / 9 },
  },
  vertexShader: /* glsl */`
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: /* glsl */`
    uniform sampler2D tDiffuse;
    uniform float contrast, saturation, vignette, aspect;
    varying vec2 vUv;
    void main() {
      vec4 c = texture2D(tDiffuse, vUv);
      vec3 rgb = max(c.rgb, vec3(0.0));
      rgb = pow(rgb / 0.18, vec3(contrast)) * 0.18;
      float l = dot(rgb, vec3(0.2126, 0.7152, 0.0722));
      rgb = max(mix(vec3(l), rgb, saturation), vec3(0.0));
      vec2 d = (vUv - 0.5) * vec2(aspect, 1.0) / length(vec2(aspect, 1.0)) * 2.0;   // 0 centre, 1 corners
      rgb *= 1.0 - vignette * smoothstep(0.35, 1.0, length(d));
      gl_FragColor = vec4(rgb, c.a);
    }`,
};
