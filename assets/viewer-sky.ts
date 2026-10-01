// The player's sky: a procedural dome and a sky-based environment, in place of the page's two gradient bakes.
//
// What the page does without it (environment.ts, createSkyBaker): the sky is three colours (top, horizon, ground), baked
// twice from one function, `skyRadiance`: a 512x256 equirect for scene.background, and a 256x128 one through PMREM for
// scene.environment. installSkyFog fogs distant ground toward exactly that function, so ground and backdrop meet. The
// result is a clean gradient with a soft glow where the sun is: nothing in it for a window, a pool or a polished floor to
// reflect, and no sky to speak of behind the house.
//
// What this adds, LIVE PLAYER ONLY (it is installed after the house is built, `?no=sky` leaves it out, and restore() puts
// the page's own background, environment and environment strength back before any __houseRender* call):
//   - one shader function, skyColor(direction), written from public algorithms and used twice:
//       * the base is `skyRadiance` itself, line for line (same top/horizon/ground blend, same exponent 0.6, same
//         16-degree ground ramp, same sun lobe), so from the horizon to about 5 degrees above it, and over the whole ground
//         half, the colour is the page's own to within rounding: the fog still meets the sky without a seam;
//       * a Mie-like halo round the sun (Henyey-Greenstein phase, g = 0.72) and a soft sun disc; at night the same
//         direction is a moon (a lit sphere with a few maria) and a hash-grid star field; at dusk a few early stars;
//       * a cloud layer: fbm of a value noise, projected on a plane (direction.xz / (elevation + 0.09)) so that the clouds
//         pile up and flatten toward the horizon, shaded by a second tap one step toward the sun (a cloud is dark where the
//         neighbour toward the sun is denser, bright with a silver edge where it is thin). Cloud colour and alpha fade into
//         the horizon colour between 4 and 17 degrees of elevation, which is what keeps the band the fog meets clean.
//   - the dome: a unit sphere drawn LAST of the opaque objects with depth forced to the far plane (gl_Position.z =
//     gl_Position.w), so the early depth test throws away every pixel a wall, a roof or the lawn already covers and the
//     cloud shader runs only on sky. The view matrix is used rotation-only, so the dome needs no following the camera.
//   - the environment: the same function baked once into a 256x128 half-float equirect with a fullscreen triangle (the same
//     size the page uses: a bigger one would change the PMREM's size and recompile every material), fed to PMREM and set
//     as scene.environment. The baked clouds are the dome's frozen pattern (same seed, drift 0), blurred by PMREM to what a
//     glossy surface can show. The bake is cached per (preset, palette, sun) and a time-of-day switch that was seen before
//     costs a pointer swap. A bake is debounced: a house load sets the light several times in a row.
//   - exposure: the new environment is not the old one with clouds on top, so the light it gives is measured (a 64x32
//     bake read back, against the page's own sky function at the same size: the irradiance for a surface facing up and
//     for the four facing sideways) and scene.environmentIntensity is scaled by old / new (clamped to 0.7 .. 1.3), so the
//     lit surfaces do not get brighter or darker than the preset was tuned for.
//
// Tiers: 0 draws the dome with two noise octaves and time frozen; 1 and 2 four octaves, and the clouds drift with the
// player's clock while the player is drawing (nothing forces a redraw: a paused shot is a still picture). The dome costs
// the pixels where sky is visible; the environment bake costs one 256x128 pass and a PMREM per time of day.
//
// Determinism: the sky is built from the house id (a seed for the cloud pattern) and the lighting only, never a random
// number or the wall clock; only the drift uses the player's clock, at tier 1 and above. An offline frame never sees any
// of this (restore()).
import { TIME_OF_DAY, lookOf, skyEquirect } from './environment.js';

// The part of the realism feature context the sky uses (assets/realism.ts's RealismCtx; kept structural here so the
// module stands alone).
export type SkyCtx = {
  THREE: any; scene: any; renderer: any; camera: any;
  no: Set<string>;
  tier(): number;
  houseId(): string;
  lighting(): any;
  onLighting(cb: (detail: any) => void): void | (() => void);
  markDirty(): void;
  now(): number;
};

export type SkyHandle = {
  apply(): void; restore(): void; sync(): void;
  tick(dtS: number, tS: number, camera?: any): void;
  setTier(t: number): void; setHq(on: boolean): void;
  /** test hook: the dome's colours as a w*h linear RGBA float equirect (row 0 = nadir), time 0, tier-1 octaves */
  probe(w: number, h: number): { data: Float32Array; w: number; h: number } | null;
  dispose(): void;
  stats(): Record<string, any>;
};

// ---- the shader ---------------------------------------------------------------------------------------------------------
const COMMON = /* glsl */`
uniform vec3 uTop, uHor, uGnd, uSunCol, uSunDir, uMoonCol, uCloudLit, uCloudShade;
uniform float uSunGlow, uEnv, uMoon, uStars, uStarGain, uTime, uCover, uOct, uDisc, uDiscR;
uniform vec2 uSeed;

float hash12( vec2 p ) { return fract( sin( dot( p, vec2( 12.9898, 78.233 ) ) ) * 43758.5453 ); }
float vnoise( vec2 p ) {
	vec2 i = floor( p ), f = fract( p );
	f = f * f * f * ( f * ( f * 6.0 - 15.0 ) + 10.0 );
	float a = hash12( i ), b = hash12( i + vec2( 1.0, 0.0 ) ), c = hash12( i + vec2( 0.0, 1.0 ) ), d = hash12( i + vec2( 1.0, 1.0 ) );
	return mix( mix( a, b, f.x ), mix( c, d, f.x ), f.y );
}
// fbm: octaves of value noise, each half the amplitude and a little over twice the frequency, turned a bit so the lattice
// does not line up; normalised so the mean is 0.5 for any octave count (a lower tier is the same pattern, blurrier)
float fbm( vec2 p, float oct ) {
	float s = 0.0, a = 0.5, n = 0.0;
	mat2 R = mat2( 0.8, -0.6, 0.6, 0.8 ) * 2.03;
	for ( int i = 0; i < 5; i ++ ) { if ( float( i ) >= oct ) break; s += a * vnoise( p ); n += a; p = R * p; a *= 0.5; }
	return s / n;
}

vec3 skyColor( vec3 d, float oct, float pix ) {
	// 1. the page's own gradient (environment.ts skyRadiance), unchanged
	float lat = asin( clamp( d.y, -1.0, 1.0 ) ) * 0.6366198;
	vec3 col;
	if ( lat >= 0.0 ) col = mix( uHor, uTop, pow( lat, 0.6 ) );
	else col = mix( uHor, uGnd, smoothstep( 0.0, 0.18, - lat ) ) * ( 1.0 + lat * 0.25 * uEnv );
	float cosA = max( 0.0, dot( d, uSunDir ) );
	float up = smoothstep( -0.02, 0.04, lat );
	col += uSunCol * ( uSunGlow * up * ( 0.35 * pow( cosA, 6.0 ) + 1.2 * pow( cosA, 64.0 ) ) );
	// 2. Mie-like forward scattering: Henyey-Greenstein, g = 0.72, a wide warm halo round the sun (or the moon)
	float hg = 0.4816 / pow( 1.5184 - 1.44 * cosA, 1.5 );
	col += uSunCol * ( uSunGlow * 0.03 * hg * up * ( 1.0 - uMoon ) );
	// 3. clouds on a plane above: pile up and flatten toward the horizon, gone into the haze by 4 degrees
	float ca = 0.0;
	if ( d.y > 0.05 && uCover < 0.98 ) {
		vec2 uv = d.xz / ( d.y + 0.09 ) * 0.62 + uSeed + vec2( uTime, uTime * 0.37 );
		float dn = fbm( uv, oct );
		float cd = smoothstep( uCover, uCover + 0.22, dn );
		float ramp = smoothstep( 0.07, 0.30, d.y );
		ca = cd * ramp;
		if ( ca > 0.002 ) {
			vec2 toSun = normalize( uSunDir.xz + vec2( 1e-4 ) );
			float dn2 = fbm( uv + toSun * 0.08, oct );
			float lit = clamp( 0.6 + ( dn - dn2 ) * 2.4, 0.0, 1.0 );
			vec3 cc = mix( uCloudShade, uCloudLit, lit );
			// silver edge: where the cloud is thin and the sun is behind it
			cc += uSunCol * ( 4.0 * cd * ( 1.0 - cd ) * pow( cosA, 5.0 ) * 0.5 * ( 1.0 - uMoon ) );
			// toward the horizon the cloud turns into the haze
			vec3 hz = mix( uHor, uTop, 0.12 );
			cc = mix( hz, cc, smoothstep( 0.07, 0.45, d.y ) );
			col = mix( col, cc, ca );
		}
	}
	// 4. the sun disc, soft-edged, seen through thin cloud
	if ( uMoon < 0.5 ) {
		float cr = cos( uDiscR );
		float disc = smoothstep( cos( uDiscR * 1.7 ), cr, cosA ) * smoothstep( -0.01, 0.03, d.y );
		col += uSunCol * ( uDisc * disc * ( 1.0 - ca * 0.92 ) );
	} else {
		// the moon: a lit sphere with a few darker maria, and a faint halo
		vec3 M = uSunDir;
		vec3 mr = normalize( cross( vec3( 0.0, 1.0, 0.0 ), M ) );
		vec3 mu = cross( M, mr );
		float sr = sin( uDiscR );
		vec2 q = vec2( dot( d, mr ), dot( d, mu ) ) / sr;
		float r2 = dot( q, q );
		float edge = ( 1.0 - smoothstep( 0.86, 1.0, r2 ) ) * step( 0.0, cosA - 0.5 );
		vec3 n = vec3( q, sqrt( max( 1.0 - r2, 0.0 ) ) );
		float l = smoothstep( -0.15, 0.4, dot( n, normalize( vec3( 0.55, 0.28, 0.78 ) ) ) );
		float maria = fbm( q * 2.4 + 7.3, 3.0 );
		float tex = mix( 0.58, 1.0, smoothstep( 0.38, 0.62, maria ) );
		col += uMoonCol * ( ( 0.22 + 1.4 * l ) * tex * edge * uDisc * ( 1.0 - ca * 0.9 ) * smoothstep( -0.01, 0.03, d.y ) );
		col += uMoonCol * ( 0.05 * exp( - ( 1.0 - cosA ) * 70.0 ) * up );
	}
	// 5. stars: one candidate per cell of a 3D grid cut by the unit sphere; a star is a small disc at least a pixel wide
	// (so it does not swim when the camera moves), its energy kept constant as it widens
	if ( uStars > 0.0 && d.y > 0.08 ) {
		const float K = 110.0;
		vec3 g = d * K, c = floor( g );
		float h = hash12( c.xy + c.z * 37.17 );
		if ( h < uStars ) {
			vec3 j = vec3( hash12( c.xy + c.z * 13.1 + 1.7 ), hash12( c.yz + c.x * 7.3 + 4.1 ), hash12( c.zx + c.y * 5.9 + 9.2 ) );
			vec3 sp = c + 0.2 + 0.6 * j;
			float r0 = 0.11, r = max( r0, pix * K * 0.9 );
			float s = smoothstep( r, 0.0, length( g - sp ) ) * ( r0 * r0 ) / ( r * r );
			float mag = pow( hash12( c.xy * 1.31 + c.z * 3.7 ), 5.0 );
			vec3 tint = mix( vec3( 1.0, 0.82, 0.66 ), vec3( 0.72, 0.82, 1.0 ), hash12( c.yz + 2.9 ) );
			col += tint * ( s * ( 0.35 + 2.2 * mag ) * uStarGain * smoothstep( 0.09, 0.3, d.y ) * ( 1.0 - ca ) );
		}
	}
	return col;
}
`;

const DOME_VERT = /* glsl */`
varying vec3 vDir;
void main() {
	vDir = position;
	vec4 p = projectionMatrix * vec4( mat3( viewMatrix ) * position, 1.0 );
	gl_Position = vec4( p.xy, p.w * 0.999999, p.w );   // the far plane: only pixels nothing else covered are shaded
}`;
const DOME_FRAG = /* glsl */`
varying vec3 vDir;
${COMMON}
void main() {
	vec3 d = normalize( vDir );
	float pix = length( fwidth( d ) );
	gl_FragColor = vec4( skyColor( d, uOct, pix ), 1.0 );
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`;
const BAKE_VERT = /* glsl */`
varying vec2 vUv;
void main() { vUv = uv; gl_Position = vec4( position.xy, 0.0, 1.0 ); }`;
// equirect: three's convention, u = atan(z, x) / 2pi + 0.5, v = 0 at the nadir
const BAKE_FRAG = /* glsl */`
varying vec2 vUv;
${COMMON}
void main() {
	float phi = ( vUv.x - 0.5 ) * 6.2831853, lat = ( vUv.y - 0.5 ) * 3.1415927;
	vec3 d = vec3( cos( phi ) * cos( lat ), sin( lat ), sin( phi ) * cos( lat ) );
	gl_FragColor = vec4( skyColor( d, uOct, 0.0 ), 1.0 );
}`;

// ---- small helpers -----------------------------------------------------------------------------------------------------
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const smooth = (e0: number, e1: number, x: number) => { const t = clamp((x - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t); };
function fnv1a(s: string): number { let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; } return h >>> 0; }

// coverage per time of day: the fraction of the noise range that counts as cloud starts at this value (higher = clearer)
const COVER: Record<string, number> = { day: 0.52, golden: 0.46, dusk: 0.44, night: 0.5 };
// stars: share of grid cells with one, and a brightness gain
const STARS: Record<string, [number, number]> = { night: [0.16, 1.5], dusk: [0.04, 0.4] };
const BAKE_W = 256, BAKE_H = 128;       // the page's own environment size: a different one would resize the PMREM and recompile the materials
const METER_W = 64, METER_H = 32;
const CACHE_MAX = 4;
const DEBOUNCE_MS = 90;
const DRIFT = 0.012;                    // noise-plane units per second at tier 1 and above

type Pack = { key: string; rt: any; texture: any; ratio: number; bakeMs: number; pmremMs: number; last: number };

export function createSky(ctx: SkyCtx): SkyHandle {
  const { THREE, scene, renderer } = ctx;
  const col = (hex: string) => new THREE.Color(parseInt(hex.replace('#', ''), 16));
  const uni = (mode: 'dome' | 'bake') => ({
    uTop: { value: new THREE.Color() }, uHor: { value: new THREE.Color() }, uGnd: { value: new THREE.Color() },
    uSunCol: { value: new THREE.Color() }, uSunDir: { value: new THREE.Vector3(0, 1, 0) }, uMoonCol: { value: new THREE.Color() },
    uCloudLit: { value: new THREE.Color() }, uCloudShade: { value: new THREE.Color() },
    uSunGlow: { value: 0 }, uEnv: { value: mode === 'bake' ? 1 : 0 }, uMoon: { value: 0 }, uStars: { value: 0 }, uStarGain: { value: 1 },
    uTime: { value: 0 }, uCover: { value: 0.5 }, uOct: { value: mode === 'bake' ? 3 : 2 },
    uDisc: { value: 9 }, uDiscR: { value: 0.025 }, uSeed: { value: new THREE.Vector2() },
  });

  const domeMat = new THREE.ShaderMaterial({
    uniforms: uni('dome'), vertexShader: DOME_VERT, fragmentShader: DOME_FRAG,
    side: THREE.DoubleSide, depthWrite: false, depthTest: true, fog: false,
  });
  domeMat.name = 'sky-dome';
  const dome = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 12), domeMat);
  dome.name = 'Sky dome';
  dome.frustumCulled = false; dome.renderOrder = 1e6; dome.castShadow = false; dome.receiveShadow = false;
  dome.matrixAutoUpdate = false; dome.raycast = () => {};
  dome.userData.liveSky = true;

  const bakeMat = new THREE.ShaderMaterial({ uniforms: uni('bake'), vertexShader: BAKE_VERT, fragmentShader: BAKE_FRAG, depthTest: false, depthWrite: false, toneMapped: false });
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), bakeMat);
  quad.frustumCulled = false;
  const bakeScene = new THREE.Scene(); bakeScene.add(quad);
  const bakeCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  let pmrem: any = null;

  const cache = new Map<string, Pack>();
  const horizonBg = new THREE.Color(0x808080);

  let active = false;        // the sky is on (apply() was called and restore() has not been)
  let hq = false;
  let tier = clamp(ctx.tier() | 0, 0, 2);
  let envOn = false;         // scene.environment is ours right now
  let page: { background: any; environment: any; intensity: number } | null = null;   // the page's own, as of the last lighting event
  let current: Pack | null = null;
  let detail: any = null;    // the last lighting detail
  let timer: any = null;
  let unsub: void | (() => void) = undefined;
  const st = { bakes: 0, hits: 0, bakeMs: 0, pmremMs: 0, ratio: 1, drift: false, last: '' };

  // ---- parameters from the lighting ----------------------------------------------------------------------------------
  // `p0` is the preset as authored (the page keeps its own sky behind the house at look 2); the environment is lit by
  // lookOf(p0, look), as the page's bake is. Both give the colours below.
  function lightingOf(d: any) {
    const name: string = (d && d.preset) || 'day';
    const p0 = (TIME_OF_DAY as any)[name] || (TIME_OF_DAY as any).day;
    const look = d && d.look === 2 ? 2 : 1;
    const q: any = lookOf(p0, look);
    const sun: number[] = (d && d.sun) || [0.3, 0.8, 0.5];
    return { name, p0, q, look, sun };
  }

  function paint(u: any, L: ReturnType<typeof lightingOf>, env: boolean) {
    const p = env ? L.q : L.p0;
    const sky: [string, string, string] = env && L.q.envSky ? L.q.envSky : L.p0.sky;
    u.uTop.value.copy(col(sky[0])); u.uHor.value.copy(col(sky[1])); u.uGnd.value.copy(col(sky[2]));
    u.uSunCol.value.copy(col(p.sun.color));
    u.uSunDir.value.set(L.sun[0], L.sun[1], L.sun[2]).normalize();
    u.uSunGlow.value = p.sunGlow;
    const moon = L.name === 'night';
    u.uMoon.value = moon ? 1 : 0;
    u.uMoonCol.value.set(0.82, 0.9, 1.0);
    const [stars, gain] = STARS[L.name] || [0, 0];
    u.uStars.value = env ? 0 : stars; u.uStarGain.value = gain;
    // clouds: lit ones take the horizon's brightness (so they follow the hour) and the sun's warmth when it is low; the
    // shade side is the sky's cool middle
    const hor = u.uHor.value, top = u.uTop.value;
    const lum = (c: any) => 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;
    const k = clamp(lum(hor) * 2.1, 0.09, 1.7) * (moon ? 0.85 : 1);
    const low = 1 - smooth(0.05, 0.55, L.sun[1]);
    const tint = moon ? u.uMoonCol.value : u.uSunCol.value;
    u.uCloudLit.value.setRGB(1, 1, 1).lerp(tint, moon ? 0.85 : 0.18 + 0.62 * low).multiplyScalar(k);
    u.uCloudShade.value.copy(top).lerp(hor, moon ? 0.6 : 0.35).multiplyScalar(moon ? 0.95 : 0.7);
    const seed = fnv1a(ctx.houseId() || 'house');
    u.uSeed.value.set(((seed & 0xffff) / 65535) * 40, (((seed >>> 16) & 0xffff) / 65535) * 40);
    u.uCover.value = clamp((COVER[L.name] ?? 0.5) + (((seed >>> 8) & 0xff) / 255 - 0.5) * 0.08, 0.3, 0.8);
    u.uDisc.value = moon ? 1.5 : env ? 5 : 9;
    u.uDiscR.value = env ? 0.045 : moon ? 0.04 : 0.024;
    u.uEnv.value = env ? 1 : 0;
  }

  // ---- the environment bake ------------------------------------------------------------------------------------------
  function withTarget<T>(fn: () => T): T {
    const prevRT = renderer.getRenderTarget(), face = renderer.getActiveCubeFace(), mip = renderer.getActiveMipmapLevel();
    const prevAuto = renderer.autoClear;
    try { return fn(); } finally { renderer.setRenderTarget(prevRT, face, mip); renderer.autoClear = prevAuto; }
  }
  const half = (THREE as any).DataUtils.fromHalfFloat;
  // The light the sky gives a surface, per facing: irradiance (cosine-weighted sum of luminance over the sphere) for a normal
  // up and, averaged, for the four horizontal ones, from a w*h equirect RGBA buffer. A surface in the house is lit by these,
  // not by the sphere's plain mean, which would count the (dark) ground half the same as the sky.
  function irradiance(buf: ArrayLike<number>, w: number, h: number, decode: (v: number) => number): { up: number; side: number } {
    let up = 0, side = 0;
    for (let y = 0; y < h; y++) {
      const lat = ((y + 0.5) / h - 0.5) * Math.PI, cl = Math.cos(lat), sl = Math.sin(lat);
      const dOmega = cl * (Math.PI / h) * (2 * Math.PI / w);
      for (let x = 0; x < w; x++) {
        const phi = ((x + 0.5) / w - 0.5) * 2 * Math.PI;
        const i = (y * w + x) * 4;
        const L = 0.2126 * decode(buf[i]) + 0.7152 * decode(buf[i + 1]) + 0.0722 * decode(buf[i + 2]);
        const dx = Math.cos(phi) * cl, dz = Math.sin(phi) * cl;
        up += L * Math.max(0, sl) * dOmega;
        side += L * (Math.max(0, dx) + Math.max(0, -dx) + Math.max(0, dz) + Math.max(0, -dz)) * 0.25 * dOmega;
      }
    }
    return { up, side };
  }
  // old / new irradiance (half from the up facing, half from the sides; see the header); 1 when the meter cannot run
  function exposureRatio(L: ReturnType<typeof lightingOf>): number {
    try {
      const envP = L.q.envSky ? { ...L.q, sky: L.q.envSky } : L.q;
      const old = skyEquirect(THREE, envP, L.sun, { width: METER_W, height: METER_H, below: 'ground' });
      const o = irradiance(old.image.data, METER_W, METER_H, half);
      old.dispose();
      const rt = new THREE.WebGLRenderTarget(METER_W, METER_H, { type: THREE.FloatType, format: THREE.RGBAFormat, depthBuffer: false, colorSpace: THREE.LinearSRGBColorSpace });
      let n = o;
      withTarget(() => {
        renderer.setRenderTarget(rt); renderer.render(bakeScene, bakeCam);
        const buf = new Float32Array(METER_W * METER_H * 4);
        renderer.readRenderTargetPixels(rt, 0, 0, METER_W, METER_H, buf);
        n = irradiance(buf, METER_W, METER_H, v => v);
      });
      rt.dispose();
      if (!(n.up > 1e-6 && n.side > 1e-6 && o.up > 1e-6 && o.side > 1e-6)) return 1;
      return clamp(0.5 * (o.up / n.up) + 0.5 * (o.side / n.side), 0.7, 1.3);
    } catch { return 1; }
  }

  function keyOf(L: ReturnType<typeof lightingOf>): string {
    return [L.name, L.look, L.p0.sky.join(), L.q.sun.color, L.q.sunGlow, L.sun.map(v => v.toFixed(3)).join(), ctx.houseId()].join('|');
  }

  function bake(L: ReturnType<typeof lightingOf>): Pack {
    const key = keyOf(L);
    const hit = cache.get(key);
    if (hit) { hit.last = ctx.now(); st.hits++; return hit; }
    const t0 = performance.now();
    if (!pmrem) { pmrem = new THREE.PMREMGenerator(renderer); pmrem.compileEquirectangularShader(); }
    const u = bakeMat.uniforms;
    paint(u, L, true);
    u.uTime.value = 0; u.uOct.value = 3;
    const eq = new THREE.WebGLRenderTarget(BAKE_W, BAKE_H, { type: THREE.HalfFloatType, format: THREE.RGBAFormat, depthBuffer: false, colorSpace: THREE.LinearSRGBColorSpace, generateMipmaps: false });
    eq.texture.mapping = THREE.EquirectangularReflectionMapping;
    eq.texture.minFilter = THREE.LinearFilter; eq.texture.magFilter = THREE.LinearFilter;
    let rt: any;
    let t1 = 0;
    withTarget(() => {
      renderer.setRenderTarget(eq); renderer.render(bakeScene, bakeCam);
      t1 = performance.now();
      rt = pmrem.fromEquirectangular(eq.texture);
    });
    eq.dispose();
    const ratio = withTarget(() => exposureRatio(L));
    const pack: Pack = { key, rt, texture: rt.texture, ratio, bakeMs: t1 - t0, pmremMs: performance.now() - t1, last: ctx.now() };
    cache.set(key, pack);
    while (cache.size > CACHE_MAX) {
      let oldest: Pack | null = null;
      for (const p of cache.values()) if (p !== pack && p !== current && (!oldest || p.last < oldest.last)) oldest = p;
      if (!oldest) break;
      cache.delete(oldest.key); oldest.rt.dispose();
    }
    st.bakes++; st.bakeMs = pack.bakeMs; st.pmremMs = pack.pmremMs; st.ratio = ratio;
    return pack;
  }

  // ---- applying -------------------------------------------------------------------------------------------------------
  function capturePage() {
    // the page's own pointers, as applyLighting left them: a field that still holds ours is not the page's
    if (!page) page = { background: scene.background, environment: scene.environment, intensity: scene.environmentIntensity };
    if (scene.background !== horizonBg) page.background = scene.background;
    if (!(envOn && current && scene.environment === current.texture)) { page.environment = scene.environment; page.intensity = scene.environmentIntensity; }
  }
  function paintDome(L: ReturnType<typeof lightingOf>) {
    const u = domeMat.uniforms;
    paint(u, L, false);
    u.uOct.value = tier === 0 ? 2 : 4;
    horizonBg.copy(u.uHor.value);
  }
  function installEnv(pack: Pack) {
    current = pack;
    scene.environment = pack.texture;
    scene.environmentIntensity = (page ? page.intensity : scene.environmentIntensity) * pack.ratio;
    envOn = true;
  }
  function useLighting(d: any, now = false) {
    detail = d || detail || ctx.lighting();
    if (!active || hq || !detail) return;
    capturePage();
    const L = lightingOf(detail);
    paintDome(L);
    scene.background = horizonBg;
    st.last = L.name;
    const hit = cache.get(keyOf(L));
    if (timer) { clearTimeout(timer); timer = null; }
    if (hit || now) { installEnv(bake(L)); return; }
    envOn = false;   // the page's own environment (just written) shows until the bake lands
    timer = setTimeout(() => { timer = null; if (!active || hq) return; try { installEnv(bake(lightingOf(detail))); ctx.markDirty(); } catch (e) { console.warn('sky: environment bake failed, the page\'s own stays', e); } }, DEBOUNCE_MS);
  }

  function apply() {
    if (active) return;
    active = true;
    if (hq) return;
    if (!dome.parent) scene.add(dome);
    dome.updateMatrix();
    useLighting(ctx.lighting(), true);
    ctx.markDirty();
  }
  function restore() {
    if (!active && !dome.parent) return;
    active = false;
    if (timer) { clearTimeout(timer); timer = null; }
    if (dome.parent) dome.parent.remove(dome);
    // the page's pointers, but only where ours are still the ones in the scene
    if (page) {
      if (scene.background === horizonBg) scene.background = page.background;
      if (envOn && scene.environment === current?.texture) { scene.environment = page.environment; scene.environmentIntensity = page.intensity; }
    }
    envOn = false;
  }

  unsub = ctx.onLighting(d => { if (active) useLighting(d); else detail = d; });

  return {
    apply, restore,
    // a lighting change the page announced is handled by the listener; sync() re-reads the current light (a load)
    sync() { if (active && !hq) useLighting(ctx.lighting()); },
    tick(_dt: number, tS: number) {
      if (!active || hq) return;
      // tier 0 is a still sky; from tier 1 the clouds drift with the player's clock
      domeMat.uniforms.uTime.value = tier >= 1 ? tS * DRIFT : 0;
    },
    setTier(t: number) {
      tier = clamp(t | 0, 0, 2);
      domeMat.uniforms.uOct.value = tier === 0 ? 2 : 4;
      if (tier === 0) domeMat.uniforms.uTime.value = 0;
      st.drift = tier >= 1;
    },
    // Best quality draws the page's own sky (a composer pass has no use for a dome that skips depth): off while it is on
    setHq(on: boolean) {
      if (on === hq) return;
      if (on) { restore(); active = true; hq = true; }
      else { hq = false; active = false; apply(); }
    },
    probe(w: number, h: number) {
      const L = lightingOf(detail || ctx.lighting());
      try {
        const u = bakeMat.uniforms;
        paint(u, L, false); u.uTime.value = 0; u.uOct.value = 4;
        const rt = new THREE.WebGLRenderTarget(w, h, { type: THREE.FloatType, format: THREE.RGBAFormat, depthBuffer: false, colorSpace: THREE.LinearSRGBColorSpace });
        const data = new Float32Array(w * h * 4);
        withTarget(() => { renderer.setRenderTarget(rt); renderer.render(bakeScene, bakeCam); renderer.readRenderTargetPixels(rt, 0, 0, w, h, data); });
        rt.dispose();
        return { data, w, h };
      } catch { return null; }
    },
    dispose() {
      restore();
      if (typeof unsub === 'function') unsub();
      for (const p of cache.values()) p.rt.dispose();
      cache.clear();
      dome.geometry.dispose(); domeMat.dispose(); quad.geometry.dispose(); bakeMat.dispose();
      if (pmrem) pmrem.dispose();
    },
    stats() {
      return { ...st, tier, active, hq, cached: cache.size, env: envOn, programs: renderer.info?.programs?.length };
    },
  };
}
