// The player's FFT ocean (tier 2): a tiling height field simulated on the GPU, read by viewer-water.ts as the lake's and
// the sea's normal map. Loaded lazily (a dynamic import from viewer-water.ts), only on tier 2 and only when
// EXT_color_buffer_float is there; any failure drops the water back to its analytic layers.
//
// Adapted from jbouny/fft-ocean (commit 930c096, 2015-09-28), whose spectrum and FFT code credits dli/waves.
//
//   The MIT License (MIT)
//   Copyright (c) 2014 Jérémy Bouny          (jbouny/fft-ocean)
//   Copyright (c) 2014 David Li              (dli/waves, the original of the spectrum and FFT shaders)
//   Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated
//   documentation files (the "Software"), to deal in the Software without restriction, including without limitation
//   the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and
//   to permit persons to whom the Software is furnished to do so, subject to the following conditions:
//   The above copyright notice and this permission notice shall be included in all copies or substantial portions of
//   the Software.
//   THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO
//   THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
//   AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT,
//   TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
//   SOFTWARE.
//
// WHAT IS KEPT from the original: the Elfouhaily-style wave spectrum (the initial spectrum shader), the phase/spectrum
// pass, the Stockham FFT (2 x log2 N passes, horizontal then vertical, ping-pong) and the normals-from-displacement pass.
// WHAT CHANGED (the port to three r169 and to this player):
//   - the original's `float tanh()` is deleted (GLSL ES 3.00 has one: redefining it is a compile error on r169);
//   - setRenderTarget / render / restore instead of render(scene, camera, target); no renderer.context, no clearColor;
//     PlaneGeometry; the shader chunks are local constants, not ShaderLib entries; float32 only for the NEAREST
//     ping-pong targets, half float (filterable in WebGL2) for the displacement and the normal map;
//   - Math.random phases are gone: the initial spectrum is a complex gaussian made by Box-Muller from an integer hash of
//     the texel, so the same seed is the same sea on every machine and every load;
//   - the phase is omega(k) * t computed in the spectrum shader (h(k,t) = h0 e^{iwt} + conj(h0(-k)) e^{-iwt}), so the
//     surface is a pure function of t: no state carries from one update to the next, and update(t) twice reads back
//     identically. The original integrated the phase in a ping-pong buffer;
//   - the original's `k*k/KM*KM` operator-precedence slip in omega, and its fixed-amplitude standing-wave h0, are fixed;
//   - the screen-projected grid, the MirrorRenderer, its own tone mapping, hdr() and sky constants are dropped: this
//     module only makes the normal map (plus the slope second moment and Jacobian foam in alpha) and the displacement;
//     viewer-water.ts shades with three's own light path, so the sun, the sky, the fog and the tone mapping stay three's.
//
// COST (Apple M2 Max, measured in the research prototype, load average 17 to 50): a 128^2 update is 2 x 7 FFT passes + the
// spectrum + the normals = 17 draws, 0.25 to 0.5 ms of CPU/encode per update (renderer.info counts the calls), run at 30 Hz
// and skipped while the water is off screen. Targets: about 1.6 MB at N = 128 (6 MB at 256).
import type { RealismCtx } from './realism.js';

const SIM_VERT = `varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4( position.xy, 0.0, 1.0 ); }`;

// Elfouhaily et al. spectrum as in the original (David Li / Albert Buck / Bouny); omega shared by every pass
const COMMON = /* glsl */ `
const float PI = 3.14159265359; const float G = 9.81; const float KM = 370.0; const float CM = 0.23;
float sq( float x ) { return x * x; }
float omegaOf( float k ) { return sqrt( G * k * ( 1.0 + sq( k / KM ) ) ); }
uint hashU( uint x ) { x ^= x >> 16u; x *= 0x7feb352du; x ^= x >> 15u; x *= 0x846ca68bu; x ^= x >> 16u; return x; }
float hashF( uint x ) { return float( hashU( x ) & 0x00ffffffu ) / 16777216.0; }
`;

const H0_FRAG = COMMON + /* glsl */ `
uniform vec2 uWind; uniform float uRes; uniform float uSize; uniform float uSeed; varying vec2 vUv;
void main() {
  vec2 c = gl_FragCoord.xy - 0.5;
  float n = ( c.x < uRes * 0.5 ) ? c.x : c.x - uRes, m = ( c.y < uRes * 0.5 ) ? c.y : c.y - uRes;
  vec2 K = 2.0 * PI * vec2( n, m ) / uSize; float k = length( K );
  float lw = length( uWind ), Om = 0.84, kp = G * sq( Om / lw ), cc = omegaOf( k ) / k, cp = omegaOf( kp ) / kp;
  float Lpm = exp( - 1.25 * sq( kp / k ) ), gamma = 1.7, sigma = 0.08 * ( 1.0 + 4.0 * pow( Om, - 3.0 ) );
  float Gam = exp( - sq( sqrt( k / kp ) - 1.0 ) / 2.0 * sq( sigma ) ), Jp = pow( gamma, Gam );
  float Fp = Lpm * Jp * exp( - Om / sqrt( 10.0 ) * ( sqrt( k / kp ) - 1.0 ) ), alphap = 0.006 * sqrt( Om ), Bl = 0.5 * alphap * cp / cc * Fp;
  float z0 = 0.000037 * sq( lw ) / G * pow( lw / cp, 0.9 ), uStar = 0.41 * lw / log( 10.0 / z0 );
  float alpham = 0.01 * ( ( uStar < CM ) ? ( 1.0 + log( uStar / CM ) ) : ( 1.0 + 3.0 * log( uStar / CM ) ) );
  float Fm = exp( - 0.25 * sq( k / KM - 1.0 ) ), Bh = 0.5 * alpham * CM / cc * Fm * Lpm;
  float a0 = log( 2.0 ) / 4.0, am = 0.13 * uStar / CM, Delta = tanh( a0 + 4.0 * pow( cc / cp, 2.5 ) + am * pow( CM / cc, 2.5 ) );
  float cosPhi = dot( normalize( uWind ), normalize( K ) );
  float S = ( 1.0 / ( 2.0 * PI ) ) * pow( k, - 4.0 ) * ( Bl + Bh ) * ( 1.0 + Delta * ( 2.0 * cosPhi * cosPhi - 1.0 ) );
  float dk = 2.0 * PI / uSize; float h = sqrt( S / 2.0 ) * dk;
  if ( K.x == 0.0 && K.y == 0.0 ) h = 0.0;
  uint id = uint( c.x ) + uint( c.y ) * uint( uRes ) + uint( uSeed ) * 7919u;
  float u1 = max( hashF( id * 2u + 1u ), 1e-6 ), u2 = hashF( id * 2u + 2u );
  float r = sqrt( - 2.0 * log( u1 ) ); vec2 g = r * vec2( cos( 2.0 * PI * u2 ), sin( 2.0 * PI * u2 ) );
  gl_FragColor = vec4( g * h, omegaOf( k ), 0.0 );
}`;

const SPEC_FRAG = COMMON + /* glsl */ `
uniform sampler2D uH0; uniform float uRes; uniform float uSize; uniform float uChop; uniform float uTime; varying vec2 vUv;
vec2 cmul( vec2 a, vec2 b ) { return vec2( a.x * b.x - a.y * b.y, a.y * b.x + a.x * b.y ); }
vec2 muli( vec2 z ) { return vec2( - z.y, z.x ); }
void main() {
  vec2 c = gl_FragCoord.xy - 0.5;
  float n = ( c.x < uRes * 0.5 ) ? c.x : c.x - uRes, m = ( c.y < uRes * 0.5 ) ? c.y : c.y - uRes;
  vec2 K = 2.0 * PI * vec2( n, m ) / uSize; float k = length( K );
  vec4 a = texture2D( uH0, vUv );
  vec4 b = texture2D( uH0, vec2( 1.0 ) - vUv + vec2( 1.0 / uRes ) );
  float w = mod( a.z * uTime, 2.0 * PI );
  vec2 e = vec2( cos( w ), sin( w ) );
  vec2 h = cmul( a.xy, e ) + cmul( vec2( b.x, - b.y ), vec2( e.x, - e.y ) );
  vec2 hX = - muli( h * ( K.x / max( k, 1e-5 ) ) ) * uChop, hZ = - muli( h * ( K.y / max( k, 1e-5 ) ) ) * uChop;
  if ( k == 0.0 ) { h = vec2( 0.0 ); hX = vec2( 0.0 ); hZ = vec2( 0.0 ); }
  gl_FragColor = vec4( hX + muli( h ), hZ );
}`;

const FFT_FRAG = /* glsl */ `
const float PI = 3.14159265359;
uniform sampler2D uIn; uniform float uN; uniform float uSub; varying vec2 vUv;
vec2 cmul( vec2 a, vec2 b ) { return vec2( a.x * b.x - a.y * b.y, a.y * b.x + a.x * b.y ); }
void main() {
#ifdef HORIZONTAL
  float index = vUv.x * uN - 0.5;
#else
  float index = vUv.y * uN - 0.5;
#endif
  float evenIndex = floor( index / uSub ) * ( uSub * 0.5 ) + mod( index, uSub * 0.5 );
#ifdef HORIZONTAL
  vec4 ev = texture2D( uIn, vec2( evenIndex + 0.5, gl_FragCoord.y ) / uN );
  vec4 od = texture2D( uIn, vec2( evenIndex + uN * 0.5 + 0.5, gl_FragCoord.y ) / uN );
#else
  vec4 ev = texture2D( uIn, vec2( gl_FragCoord.x, evenIndex + 0.5 ) / uN );
  vec4 od = texture2D( uIn, vec2( gl_FragCoord.x, evenIndex + uN * 0.5 + 0.5 ) / uN );
#endif
  float ta = - 2.0 * PI * ( index / uSub ); vec2 tw = vec2( cos( ta ), sin( ta ) );
  gl_FragColor = vec4( ev.xy + cmul( tw, od.xy ), ev.zw + cmul( tw, od.zw ) );
}`;

// normals from the displacement (the original's four cross products), packed (x, z, up) * 0.5 + 0.5 so the mip chain
// averages the vectors and viewer-water.ts reads the slope variance from the average's length; the alpha is the
// Jacobian foam: where the horizontal map folds (J < ~0.5), crests only.
const NRM_FRAG = /* glsl */ `
uniform sampler2D uDisp; uniform float uRes; uniform float uSize; varying vec2 vUv;
void main() {
  float t = 1.0 / uRes, ts = uSize / uRes;
  vec3 c = texture2D( uDisp, vUv ).rgb;
  vec3 r = vec3( ts, 0., 0. ) + texture2D( uDisp, vUv + vec2( t, 0. ) ).rgb - c;
  vec3 l = vec3( - ts, 0., 0. ) + texture2D( uDisp, vUv + vec2( - t, 0. ) ).rgb - c;
  vec3 tp = vec3( 0., 0., - ts ) + texture2D( uDisp, vUv + vec2( 0., - t ) ).rgb - c;
  vec3 bt = vec3( 0., 0., ts ) + texture2D( uDisp, vUv + vec2( 0., t ) ).rgb - c;
  vec3 n = normalize( cross( r, tp ) + cross( tp, l ) + cross( l, bt ) + cross( bt, r ) );
  vec2 dx = ( texture2D( uDisp, vUv + vec2( t, 0. ) ).xz - texture2D( uDisp, vUv - vec2( t, 0. ) ).xz ) / ( 2.0 * ts );
  vec2 dz = ( texture2D( uDisp, vUv + vec2( 0., t ) ).xz - texture2D( uDisp, vUv - vec2( 0., t ) ).xz ) / ( 2.0 * ts );
  float J = ( 1.0 + dx.x ) * ( 1.0 + dz.y ) - dx.y * dz.x;
  gl_FragColor = vec4( n.x * 0.5 + 0.5, n.z * 0.5 + 0.5, n.y * 0.5 + 0.5, clamp( ( 0.55 - J ) * 3.0, 0.0, 1.0 ) );
}`;

export type OceanOptions = { N?: number; tile?: number; wind?: [number, number]; chop?: number; seed?: number; hz?: number };

export type Ocean = {
  readonly tile: number;
  readonly N: number;
  normalMap(): any;
  displacementMap(): any;
  /** the surface at time t (s). A pure function of t. Skipped (false) while not visible or less than 1/hz after the last. */
  update(t: number, camera: any, visible: boolean, force?: boolean): boolean;
  /** the height field (displacement y, N x N, metres) read back from the GPU: for the live check, never on a frame */
  readback(): Float32Array;
  dispose(): void;
  stats(): Record<string, unknown>;
};

/** null: the device cannot (no float render targets); a throw: something went wrong building it */
export function createOcean(ctx: RealismCtx, o: OceanOptions = {}): Ocean | null {
  const { THREE, renderer } = ctx;
  if (!renderer.extensions.has('EXT_color_buffer_float')) return null;
  const N = o.N ?? 128, tile = o.tile ?? 80, chop = o.chop ?? 0.5, wind = o.wind ?? [1.7, 1.2], seed = o.seed ?? 1, hz = o.hz ?? 30;
  const tgt = (filter: number, wrap: number, type: number, mips = false) => new THREE.WebGLRenderTarget(N, N, {
    format: THREE.RGBAFormat, type, minFilter: filter, magFilter: filter === THREE.NearestFilter ? filter : THREE.LinearFilter,
    wrapS: wrap, wrapT: wrap, depthBuffer: false, stencilBuffer: false, generateMipmaps: mips,
  });
  const h0 = tgt(THREE.NearestFilter, THREE.RepeatWrapping, THREE.FloatType);
  const spec = tgt(THREE.NearestFilter, THREE.ClampToEdgeWrapping, THREE.FloatType);
  const ping = tgt(THREE.NearestFilter, THREE.ClampToEdgeWrapping, THREE.FloatType);
  const pong = tgt(THREE.NearestFilter, THREE.ClampToEdgeWrapping, THREE.FloatType);
  const disp = tgt(THREE.LinearFilter, THREE.RepeatWrapping, THREE.HalfFloatType);
  const norm = tgt(THREE.LinearMipmapLinearFilter, THREE.RepeatWrapping, THREE.HalfFloatType, true);
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2)); quad.frustumCulled = false;
  const simScene = new THREE.Scene(); simScene.add(quad);
  const simCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const mk = (frag: string, uniforms: any, defines?: any) => new THREE.ShaderMaterial({ vertexShader: SIM_VERT, fragmentShader: frag, uniforms, defines: defines || {}, depthTest: false, depthWrite: false, blending: THREE.NoBlending });
  const mH0 = mk(H0_FRAG, { uWind: { value: new THREE.Vector2(wind[0], wind[1]) }, uRes: { value: N }, uSize: { value: tile }, uSeed: { value: seed } });
  const mSpec = mk(SPEC_FRAG, { uH0: { value: h0.texture }, uRes: { value: N }, uSize: { value: tile }, uChop: { value: chop }, uTime: { value: 0 } });
  const mH = mk(FFT_FRAG, { uIn: { value: null }, uN: { value: N }, uSub: { value: 2 } }, { HORIZONTAL: '' });
  const mV = mk(FFT_FRAG, { uIn: { value: null }, uN: { value: N }, uSub: { value: 2 } });
  const mNrm = mk(NRM_FRAG, { uDisp: { value: disp.texture }, uRes: { value: N }, uSize: { value: tile } });

  // every pass leaves the renderer's target, viewport-affecting state and auto-clear as it found them
  const pass = (mat: any, target: any) => { quad.material = mat; renderer.setRenderTarget(target); renderer.render(simScene, simCam); };
  const save = () => ({ rt: renderer.getRenderTarget(), ac: renderer.autoClear, xr: renderer.xr.enabled, sh: renderer.shadowMap.autoUpdate });
  const load = (s: any) => { renderer.setRenderTarget(s.rt); renderer.autoClear = s.ac; renderer.xr.enabled = s.xr; renderer.shadowMap.autoUpdate = s.sh; };
  {
    const s = save();
    try { renderer.autoClear = true; renderer.shadowMap.autoUpdate = false; pass(mH0, h0); } finally { load(s); }
  }

  const iters = Math.log2(N) * 2;
  let lastT = -1e9, updates = 0, lastMs = 0, skipped = 0;
  const ocean: Ocean = {
    tile, N,
    normalMap: () => norm.texture,
    displacementMap: () => disp.texture,
    update(t, _camera, visible, force = false) {
      if (!visible && !force) { skipped++; return false; }
      if (!force && Math.abs(t - lastT) < 1 / hz) return false;
      lastT = t;
      const s = save(), t0 = performance.now();   // (the stats' clock only: the surface is a function of t alone)
      try {
        renderer.autoClear = true; renderer.shadowMap.autoUpdate = false;
        mSpec.uniforms.uTime.value = t;
        pass(mSpec, spec);
        let m = mH;
        for (let i = 0; i < iters; i++) {
          let src: any, dst: any;
          if (i === 0) { src = spec; dst = ping; }
          else if (i === iters - 1) { src = iters % 2 === 0 ? ping : pong; dst = disp; }
          else if (i % 2 === 1) { src = ping; dst = pong; }
          else { src = pong; dst = ping; }
          if (i === iters / 2) m = mV;
          m.uniforms.uIn.value = src.texture;
          m.uniforms.uSub.value = Math.pow(2, (i % (iters / 2)) + 1);
          pass(m, dst);
        }
        pass(mNrm, norm);   // generateMipmaps on the target: three builds the chain after the pass
      } finally { load(s); }
      lastMs = performance.now() - t0; updates++;
      return true;
    },
    readback() {
      const raw = new Uint16Array(N * N * 4), out = new Float32Array(N * N);
      const s = save();
      try { renderer.readRenderTargetPixels(disp, 0, 0, N, N, raw); } finally { load(s); }
      for (let i = 0; i < N * N; i++) out[i] = THREE.DataUtils.fromHalfFloat(raw[i * 4 + 1]);   // (the y of the displacement is the green channel)
      return out;
    },
    dispose() {
      for (const r of [h0, spec, ping, pong, disp, norm]) r.dispose();
      for (const m of [mH0, mSpec, mH, mV, mNrm]) m.dispose();
      quad.geometry.dispose();
    },
    stats: () => ({ N, tile, wind, chop, hz, updates, skipped, lastEncodeMs: +lastMs.toFixed(3) }),
  };
  return ocean;
}
