// Time of day — the light a house is seen in, as data plus the few pure functions that turn it into a scene.
//
// A preset says what the hour is MADE of:
//   sky        three colours [top, horizon, ground]. Baked two ways: through PMREM it is scene.environment, the
//              image-based light every PBR material samples (cool from above, warm from the horizon, a dim
//              bounce from below); as an equirect it is the backdrop, fading below the horizon into the ground
//              colour by exactly the function the fog uses, so fogged ground and backdrop meet without a seam.
//   sun        colour / intensity / elevation / swing (degrees round from straight in front of the entry, + = to
//              the front's left). Where it stands comes from the house — createLighting's applyLighting (below) aims it.
//   hemi, fill the sky/ground bounce and a cool fill opposite the sun. Neither casts shadows.
//   fog        [near, far] in metres, to the horizon colour. far stays inside the camera's far plane (160 m) so
//              the ground is fully hazed before it is clipped.
//   exposure, env   tone-mapping exposure, set for ACES filmic (TONE_EXPOSURE rescales it for the A/B
//              mappers), and scene.environmentIntensity.
//   bounce     the emissive of every CEILING material (userData.bounce, set by the kit and the arch materials): the light a
//              room's own surfaces throw up at its ceiling, which no light here models. Without it a ceiling is lit by the
//              hemisphere's ground colour alone (greyed to luma, kit-build.ts neutralIndirect): flat mid-grey by day, black
//              at night. A scalar of white-warm emissive, ramped by hour (plan 5.2 L2).
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
  bounce: number;
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
    lampGain: 0.035, bounce: 0.12, windowGlow: 0, glowColor: '#ffe2bd', sunGlow: 0.25,
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
    lampGain: 0.3, bounce: 0.10, windowGlow: 0.18, glowColor: '#ffdcb0', sunGlow: 0.6,
    bloom: { strength: 0.15, radius: 0.4, threshold: 2.0 },
    grade: { contrast: 1.05, saturation: 0.9, vignette: 0.18 },
  },
  dusk: {
    label: 'Dusk',
    sky: ['#4e638b', '#e5a38b', '#5d626e'],
    sun: { color: '#ffa98f', intensity: 1.0, elevation: 8, swing: -64 },
    hemi: { sky: '#b9aed0', ground: '#9a8576', intensity: 1.28 },
    fill: { color: '#9eaecd', intensity: 0.3 },
    ambient: 0,
    exposure: 0.9, env: 0.7,
    fog: [70, 155], shadow: 0.6,
    lampGain: 1.6, bounce: 0.07, windowGlow: 0.8, glowColor: '#ffd9a8', sunGlow: 0.8,
    bloom: { strength: 0.35, radius: 0.4, threshold: 1.8 },
    grade: { contrast: 1.05, saturation: 0.72, vignette: 0.22 },
  },
  night: {
    label: 'Night',
    sky: ['#0b1731', '#424b64', '#17202a'],
    sun: { color: '#bed5ff', intensity: 0.35, elevation: 38, swing: 40 },
    hemi: { sky: '#829fc9', ground: '#6a5a4e', intensity: 1.05 },
    fill: { color: '#8aa2c9', intensity: 0.22 },
    ambient: 0,
    exposure: 0.85, env: 0.30,
    fog: [55, 150], shadow: 0.5,
    lampGain: 1.7, bounce: 0.07, windowGlow: 1.0, glowColor: '#ffd49e', sunGlow: 0.1,
    bloom: { strength: 0.4, radius: 0.4, threshold: 1.6 },
    grade: { contrast: 1.05, saturation: 0.8, vignette: 0.26 },
  },
};

/** How much light the sky and the room's own bounce give a surface before any lamp: the hemisphere's two colours weighed by their luminance
 *  (a bare intensity says nothing: night's cool sky is a third as bright as day's at any number), plus the image-based environment and the cool
 *  fill, each weighed the same way. Used to keep the hours in order (night <= dusk <= day), which no single field can: dusk's env is above
 *  day's because its sky image is dim, and the hemisphere's ground colour at night is a warm lamp-bounce stand-in, not a sky. */
export function ambientOf(p: Preset): number {
  const lin = (h: string) => { const n = hexOf(h); return [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(v => { const x = v / 255; return x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4; }); };
  const L = (h: string) => { const [r, g, b] = lin(h); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
  const hemi = p.hemi.intensity * (L(p.hemi.sky) + L(p.hemi.ground)) / 2;
  const env = p.env * (L(p.sky[0]) + L(p.sky[1]) + L(p.sky[2])) / 3;
  return hemi + env + p.fill.intensity * L(p.fill.color);
}

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
/** a preset's name — a TIME_OF_DAY key, an alias, or a spec's `lighting` object ({ preset, sunBearing }) — resolved */
export const lightingName = (n?: any): string => {
  const k = n && typeof n === 'object' ? n.preset : n;
  return typeof k === 'string' && TIME_OF_DAY[k] ? k : (typeof k === 'string' && LIGHTING_ALIASES[k]) || DEFAULT_LIGHTING;
};

// ---- the look generation (plan S1: defaults 2) ---------------------------------------------------------------
// Look 1 is each preset as above. Look 2 — the true-white look a house gets under `"defaults": 2` — keeps the hour
// (the sun's height, colour and shadows, the lit windows, the sunset sky behind the house) but stops the light
// from repainting the house: golden hour and dusk turned white walls pink and a cobalt wall grey. It
//   - pulls the light colours (sun, hemisphere, fill) and the environment's sky part-way to the grey of the same
//     luma, so a white wall in the shade is lit by something near white;
//   - white-balances the frame most of the way toward neutral, as a photographer would at golden hour;
//   - holds the grade's saturation at 0.86 or above, so a signature colour (palette.keep) survives dusk (dusk's own
//     0.72 is what greyed a blue wall; 0.86 keeps a lawn from reading as green paint).
// The backdrop sky and the fog keep the preset's own colours. Pure data again: lookOf(p, 2) is a new preset.
const hexStr = (c: number) => '#' + c.toString(16).padStart(6, '0');
const towardGrey = (c: string, k: number): string => {
  const n = hexOf(c), r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255, y = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  const f = (x: number) => Math.round(x + (y - x) * k);
  return hexStr((f(r) << 16) | (f(g) << 8) | f(b));
};
export type Look = 1 | 2;
export function lookOf(p: Preset, look: Look = 1): Preset & { envSky?: [string, string, string]; balance?: [number, number, number] } {
  if (look !== 2) return p;
  const q: any = {
    ...p,
    sun: { ...p.sun, color: towardGrey(p.sun.color, 0.45) },
    hemi: { ...p.hemi, sky: towardGrey(p.hemi.sky, 0.6), ground: towardGrey(p.hemi.ground, 0.75) },
    fill: { ...p.fill, color: towardGrey(p.fill.color, 0.5) },
    envSky: p.sky.map(c => towardGrey(c, 0.55)) as [string, string, string],
    grade: { ...p.grade, saturation: Math.max(p.grade.saturation, 0.86) },
  };
  // white balance: what a white wall facing the sun reads under this light (sRGB-ish linear weights), corrected
  // three-quarters of the way toward neutral (the exponent 0.75 below) and normalised to luma 1, so exposure is untouched;
  // scripts/test-kit-look.mts measures the result on a white and a cobalt wall
  const lin = (c: string) => { const n = hexOf(c); return [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(v => (v / 255) ** 2.2); };
  const sun = lin(q.sun.color), hs = lin(q.hemi.sky), hg = lin(q.hemi.ground);
  const W = [0, 1, 2].map(k => sun[k] * q.sun.intensity * 0.5 + hs[k] * q.hemi.intensity * 0.5 + hg[k] * q.hemi.intensity * 0.2);
  const Y = 0.2126 * W[0] + 0.7152 * W[1] + 0.0722 * W[2];
  const bal = W.map(w => Math.pow(Y / Math.max(w, 1e-6), 0.75));
  const bY = 0.2126 * bal[0] + 0.7152 * bal[1] + 0.0722 * bal[2];
  q.balance = bal.map(v => +(v / bY).toFixed(4)) as [number, number, number];
  return q;
}

const hexOf = (c: string): number => parseInt(c.replace('#', ''), 16);
const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
const smooth = (e0: number, e1: number, x: number): number => { const t = Math.max(0, Math.min(1, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t); };

// Unit vector toward the sun, from the preset and the bearing the entry faces ([fx, fz] in the ground plane).
// `swing` (degrees round from the front, + = to the front's left) replaces the preset's own: a house's seeded
// swing under defaults 2, or the swing an authored lighting.sunBearing works out to (kit-rules.ts).
export function sunDirection(p: Preset, front: [number, number] = [0, 1], swing: number = p.sun.swing): [number, number, number] {
  const DEG = Math.PI / 180;
  const az = Math.atan2(front[0], front[1]) + swing * DEG, el = p.sun.elevation * DEG;
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
    // `backdrop`: the preset the backdrop is baked from when it differs from the environment's (look 2 keeps the
    // preset's own sky behind the house while its light is neutralised)
    bake(name: string, p: Preset, sun: number[], backdrop: Preset = p) {
      const key = `${name}|${p.sky.join()}|${p.sun.color}|${p.sunGlow}|${sun.map(v => v.toFixed(4)).join()}` + (backdrop === p ? '' : `|${backdrop.sky.join()}|${backdrop.sun.color}`);
      if (current && current.key === key) return current;
      const envSky = skyEquirect(THREE, p, sun, { width: 256, height: 128, below: 'ground' });
      const rt = pmrem.fromEquirectangular(envSky);
      envSky.dispose();
      const background = skyEquirect(THREE, backdrop, sun, { width: 512, height: 256, below: 'backdrop' });
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
/** the warm white a ceiling's bounce emits: the room's own light off its floor and walls, not the lamp's colour */
export const BOUNCE_COLOR = 0xfff0dc;
const matsOf = (o: any): any[] => (Array.isArray(o.material) ? o.material : o.material ? [o.material] : []);
const seeThrough = (m: any): boolean => !!m && (m.transparent || (m.transmission || 0) > 0 || /glass|glazing|pane/i.test(m.name || ''));

export function applyHouseGlow(THREE: any, root: any, p: Preset): { fixtures: number; panes: number; bounced: number } {
  const glow = new THREE.Color(hexOf(p.glowColor));
  let fixtures = 0, panes = 0, bounced = 0;
  root.traverse((o: any) => {
    const ud = o.userData;
    // ceiling bounce: a material tagged userData.bounce (a number: 1, or less on a textured ceiling that a flat emissive would wash out)
    // takes the preset's bounce as its emissive. Set, never scaled, so re-lighting is idempotent (the fixtureBase pattern, without the base)
    if (o.isMesh) for (const m of matsOf(o)) {
      const b = m && m.userData && m.userData.bounce;
      if (!b || !m.emissive) continue;
      m.emissive.setHex(BOUNCE_COLOR);
      m.emissiveIntensity = p.bounce * (typeof b === 'number' ? b : 1);
      bounced++;
    }
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
  return { fixtures, panes, bounced };
}

// The composer's scene-referred grade, applied in linear light before tone mapping: contrast about mid-grey
// and a saturation lift (the pivot-and-lift of pascalorg/editor's post-processing GRADE_PARAMS, MIT), then a
// soft vignette.
// `look` and `balance` belong to the look generation (lookOf): look.x multiplies the saturation, balance is a per-
// channel white balance. Their values are ONE object each shared by every copy of the shader (no isVector flag,
// so ShaderPass's uniform clone keeps the reference, as installSkyFog does with its colours), which applyLighting
// sets for the house on screen; at look 1 they are exactly 1 and the grade is the one above.
export const GRADE_LOOK = { x: 1, y: 1, z: 1 };
export const GRADE_BALANCE = { x: 1, y: 1, z: 1 };
export const GradeShader = {
  name: 'HouseGradeShader',
  uniforms: {
    tDiffuse: { value: null },
    contrast: { value: 1.0 },
    saturation: { value: 1.0 },
    vignette: { value: 0.0 },
    aspect: { value: 16 / 9 },
    look: { value: GRADE_LOOK },
    balance: { value: GRADE_BALANCE },
  },
  vertexShader: /* glsl */`
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: /* glsl */`
    uniform sampler2D tDiffuse;
    uniform float contrast, saturation, vignette, aspect;
    uniform vec3 look, balance;
    varying vec2 vUv;
    void main() {
      vec4 c = texture2D(tDiffuse, vUv);
      vec3 rgb = max(c.rgb, vec3(0.0)) * balance;
      rgb = pow(rgb / 0.18, vec3(contrast)) * 0.18;
      float l = dot(rgb, vec3(0.2126, 0.7152, 0.0722));
      rgb = max(mix(vec3(l), rgb, saturation * look.x), vec3(0.0));
      vec2 d = (vUv - 0.5) * vec2(aspect, 1.0) / length(vec2(aspect, 1.0)) * 2.0;   // 0 centre, 1 corners
      rgb *= 1.0 - vignette * smoothstep(0.35, 1.0, length(d));
      gl_FragColor = vec4(rgb, c.a);
    }`,
};

// ---- the light on the page: a preset and an aim, applied to the scene ------------------------------------------
// Moved out of room-creator.html (plan S0; Completeness A1 gives the light to S1, which owns this file): the page
// creates one with its lights, sky and renderer and destructures the names it used to declare, so every caller is
// unchanged. `aim` is the live aim (the house the lights point at), which the page's shadow box and composer read.
// setLightingPreset is the API the builder (kit-build.ts lightHouse) and the editor's time-of-day control call.
export function createLighting({ THREE, scene, renderer, sunLight, hemisphereLight, ambientLight, rimLight, skyBaker, skyFog, refitShadow,
  toneMapping: houseToneMapping, toneExposure: houseToneExposure, select: lightingSelect, override: LIGHTING_OVERRIDE }: any) {
  // The house the lights are aimed at, kept so the UI's preset select can re-light without rebuilding.
  // `swing` / `bearing`: the house's own sun (kit-build.ts lightHouse: a seeded swing under defaults 2, or the
  // compass bearing lighting.sunBearing names); `look`: the look generation. The builder's aim sets all three every
  // build, so they never carry from one house to the next; the UI's preset select keeps them for the house.
  const lightingAim: any = { front: [0, 1], centre: [0, 0], preset: 'day', swing: null, bearing: null, look: 1 };
  const DEG = Math.PI / 180;
  function applyLighting(preset, aim: any = {}) {
    if (preset) lightingAim.preset = lightingName(preset);
    if (aim.front) lightingAim.front = aim.front;
    if (aim.centre) lightingAim.centre = aim.centre;
    if ('swing' in aim) lightingAim.swing = typeof aim.swing === 'number' ? aim.swing : null;
    if ('bearing' in aim) lightingAim.bearing = typeof aim.bearing === 'number' ? aim.bearing : null;
    if ('look' in aim) lightingAim.look = aim.look === 2 ? 2 : 1;
    const name = lightingAim.preset, p0 = TIME_OF_DAY[name], p = lookOf(p0, lightingAim.look);
    const [cx, cz] = lightingAim.centre;
    const fr = lightingAim.front as [number, number];
    // a bearing is a compass direction (0 = north, the page's −Z); the swing it means depends on the front
    const swing = lightingAim.bearing !== null ? (180 - lightingAim.bearing) - Math.atan2(fr[0], fr[1]) / DEG
      : lightingAim.swing !== null && name !== 'night' ? lightingAim.swing : p.sun.swing;
    const s = sunDirection(p, fr, swing), D = 34;
    // sun: the key, the only shadow caster. shadow.intensity < 1 leaves some sky in the shade (Pascal: 0.75).
    sunLight.color.set(p.sun.color); sunLight.intensity = p.sun.intensity;
    sunLight.position.set(cx + s[0] * D, s[1] * D, cz + s[2] * D);
    sunLight.target.position.set(cx, 0, cz); sunLight.target.updateMatrixWorld();
    sunLight.shadow.intensity = p.shadow;
    // sky / ground bounce, and a cool fill from the far side at 35°
    hemisphereLight.color.set(p.hemi.sky); hemisphereLight.groundColor.set(p.hemi.ground); hemisphereLight.intensity = p.hemi.intensity;
    ambientLight.color.set(0xffffff); ambientLight.intensity = p.ambient;
    const faz = Math.atan2(s[0], s[2]) + Math.PI, fel = 35 * DEG, F = 28;
    rimLight.color.set(p.fill.color); rimLight.intensity = p.fill.intensity;
    rimLight.position.set(cx + Math.sin(faz) * Math.cos(fel) * F, Math.sin(fel) * F, cz + Math.cos(faz) * Math.cos(fel) * F);
    rimLight.target.position.set(cx, 1, cz); rimLight.target.updateMatrixWorld();
    // sky: PMREM environment + backdrop; fog to the horizon colour
    const envP = (p as any).envSky ? { ...p, sky: (p as any).envSky } : p;
    const sky = envP === p ? skyBaker.bake(name, p, s) : skyBaker.bake(name, envP, s, p0);
    scene.environment = sky.environment; scene.environmentIntensity = p.env;
    scene.background = sky.background; scene.backgroundIntensity = 1;
    scene.fog.color.set(p.sky[1]); scene.fog.near = p.fog[0]; scene.fog.far = p.fog[1];
    skyFog.ground.set(p.sky[2]); skyFog.sky.set(p.sky[0]);
    scene.userData.horizon = parseInt(p.sky[1].slice(1), 16);
    renderer.toneMapping = houseToneMapping;
    renderer.toneMappingExposure = p.exposure * houseToneExposure;
    // the grade's look uniforms (the composer's grade pass shares these objects): 1 at look 1
    const bal = (p as any).balance || [1, 1, 1];
    GRADE_BALANCE.x = bal[0]; GRADE_BALANCE.y = bal[1]; GRADE_BALANCE.z = bal[2];
    GRADE_LOOK.x = p0.grade.saturation > 0 ? p.grade.saturation / p0.grade.saturation : 1;
    refitShadow();   // a low sun throws long shadows: the box has to hold them, not just the lot
    // the house's own light: tagged fixtures × lampGain, tagged window glass glowing (bloom/grade: composerFor)
    const glow = applyHouseGlow(THREE, scene, p);
    const w = window as any;
    const bearing = ((180 - (Math.atan2(fr[0], fr[1]) / DEG + swing)) % 360 + 360) % 360;
    w.__houseLighting = { preset: name, label: p.label, lampGain: p.lampGain, windowGlow: p.windowGlow, glowColor: p.glowColor, horizon: scene.userData.horizon, sky: p.sky.slice(), sun: s, tagged: glow,
      swing: +swing.toFixed(2), sunBearing: +bearing.toFixed(2), look: lightingAim.look, grade: { ...p.grade }, balance: bal.slice() };
    window.dispatchEvent(new CustomEvent('house:lighting', { detail: w.__houseLighting }));
  }
  // The builder's dep, and the UI select, both land here. `preset` is optional — applyLighting's own
  // `if (preset)` guard is what leaves the current preset untouched when it's omitted (a spec without
  // `lighting` still gets its sun aimed, per the builder's call site). Resolving a name unconditionally
  // here defeated that guard by always handing applyLighting something truthy, forcing every build back to
  // the default preset even when the caller passed nothing. The builder always passes an aim; the UI never
  // does — so ?lighting= overrides the spec's preset, not the viewer's own choice.
  // `preset`: a name, an alias or a spec's lighting object ({ preset, sunBearing }). `aim`: the builder's — front,
  // centre, and the house's swing, bearing and look (kit-build.ts lightHouse).
  function setLightingPreset(preset, aim?) {
    if (aim && LIGHTING_OVERRIDE) preset = LIGHTING_OVERRIDE;
    const name = preset ? lightingName(preset) : undefined;
    if (name && lightingSelect && lightingSelect.value !== name) lightingSelect.value = name;
    applyLighting(name, aim);
  }
  return { aim: lightingAim, applyLighting, setLightingPreset };
}
