// The player's frame kit: idle accumulation and a lighter Best quality. Loaded lazily by assets/realism-frame.ts.
//
// WHY A SECOND COMPOSER. The page's composerFor (room-creator.html) is the FILM's renderer: 4x MSAA half-float targets at
// twice the output size, GTAO at full size with 16 samples, bloom, grade, SMAA, OutputPass, and (because the player used to put
// the transmissive glass back for it) a second full scene pass for the transmission buffer. On the heavy houses that is 2.4 to
// 4.5k draw calls and 22 to 28 fps. It must stay exactly what it is: the films, the stills and the recorder use it, and the
// goldens are drawn through it. The player's Best quality is a LIVE PREVIEW tier, so it gets its own, lighter chain built from
// the same vendored passes:
//
//   scene -> 4x MSAA half-float target at the canvas size (no 2x supersample)
//         -> GTAO at half resolution with fewer samples (its normal pass is the second scene draw; the sun's shadow map is not redone for it)
//         -> bloom whose threshold follows the frame's own mean brightness (a lit white worktop is not a lamp)
//         -> grade + tone mapping + sRGB in ONE pass (the page's grade maths, retuned: see GRADE below), into an 8-bit target
//         -> SMAA on the display-referred picture (where it is meant to run), straight to the canvas
//
// and the glass stays in the opaque pass (realism-frame's keepsOpaqueGlass), which is what takes the transmission pass away.
// The film pipeline's look is unchanged; the player's Best quality no longer promises to equal it (README -> Live realism -> frame).
//
// ACCUMULATION. Camera still for ~250 ms and nothing else to draw: render N Halton-jittered frames (camera.setViewOffset, sub-pixel)
// into a half-float target (4x MSAA where the canvas is small enough), add each to a running sum, and show sum / k on the canvas.
// COLOUR MATCH. The sample target is drawn exactly as the canvas is: tone mapped and sRGB-encoded by each material's own shader, so
// translucent surfaces (water, glass, haze, the fading roof) blend in the same display space and a material with toneMapped = false
// comes out as it does on screen. r169 does that only when rendering to the screen or to an XR target; the target is therefore
// flagged isXRRenderTarget with the renderer's output colour space as its texture's (three's own switch for "draw this like the
// canvas": WebGLPrograms and WebGLBackground read it). A linear target plus a tone-map resolve was tried first and came out 2 % too
// bright overall and 40 % too bright on the lake, because blending a translucent layer in linear light is not blending it in sRGB.
// The sun's shadow map is drawn once for the whole accumulation.
// Jitter + averaging is the supersampling the plain path lacks: thin mullions, fences and roof courses stop crawling on a paused view.
//
// Nothing here reads a wall clock that a frame depends on (the jitter is a Halton sequence of the sample index) and nothing in it
// runs outside the player.
import { GTAOPass } from './vendor/three/postprocessing/GTAOPass.js';
import { UnrealBloomPass } from './vendor/three/postprocessing/UnrealBloomPass.js';
import { SMAAPass } from './vendor/three/postprocessing/SMAAPass.js';
import { FullScreenQuad } from './vendor/three/postprocessing/Pass.js';
import { OutputShader } from './vendor/three/shaders/OutputShader.js';
import { TIME_OF_DAY, GRADE_LOOK, GRADE_BALANCE } from './environment.js';

export type KitCtx = {
  THREE: any; renderer: any; scene: any; camera: any;
  house(): any;
  lighting(): any;
  /** is the baked ambient-occlusion feature drawing? Best quality then lets its own occlusion do part of GTAO's work */
  bakedAo(): boolean;
};

export const HQ_PIXEL_CAP = 4_200_000;      // the Best-quality chain's largest size, in pixels (the half-float targets are 8 bytes a pixel each)
export const ACC_MSAA_CAP = 2_300_000;      // above this many canvas pixels the accumulation target has no MSAA (the jitter is the antialiasing)

/** Halton sequence (radical inverse) of index i in base b: the sub-pixel jitter. i >= 1. */
export function halton(i: number, b: number): number {
  let f = 1, r = 0;
  while (i > 0) { f /= b; r += f * (i % b); i = Math.floor(i / b); }
  return r;
}

// ---- the resolve: scale -> (grade) -> tone mapping -> sRGB, in the page's own order -----------------------------------------
// OutputShader's vertex shader and tone-mapping chain, with a scale in front (the accumulation sum / k) and, for Best quality,
// the grade between them.
const RESOLVE_FRAGMENT = /* glsl */`
precision highp float;
uniform sampler2D tDiffuse;
uniform float vhScale;
#ifdef VH_GRADE
uniform float contrast, saturation, vignette, aspect;
uniform vec3 look, balance;
#endif
#include <tonemapping_pars_fragment>
#include <colorspace_pars_fragment>
varying vec2 vUv;
void main() {
	vec4 c = texture2D( tDiffuse, vUv );
	vec3 rgb = max( c.rgb * vhScale, vec3( 0.0 ) );
#ifdef VH_GRADE
	rgb *= balance;
	rgb = pow( rgb / 0.18, vec3( contrast ) ) * 0.18;
	float l = dot( rgb, vec3( 0.2126, 0.7152, 0.0722 ) );
	rgb = max( mix( vec3( l ), rgb, saturation * look.x ), vec3( 0.0 ) );
	vec2 d = ( vUv - 0.5 ) * vec2( aspect, 1.0 ) / length( vec2( aspect, 1.0 ) ) * 2.0;
	rgb *= 1.0 - vignette * smoothstep( 0.35, 1.0, length( d ) );
#endif
	gl_FragColor = vec4( rgb, 1.0 );
#ifdef LINEAR_TONE_MAPPING
	gl_FragColor.rgb = LinearToneMapping( gl_FragColor.rgb );
#elif defined( REINHARD_TONE_MAPPING )
	gl_FragColor.rgb = ReinhardToneMapping( gl_FragColor.rgb );
#elif defined( CINEON_TONE_MAPPING )
	gl_FragColor.rgb = CineonToneMapping( gl_FragColor.rgb );
#elif defined( ACES_FILMIC_TONE_MAPPING )
	gl_FragColor.rgb = ACESFilmicToneMapping( gl_FragColor.rgb );
#elif defined( AGX_TONE_MAPPING )
	gl_FragColor.rgb = AgXToneMapping( gl_FragColor.rgb );
#elif defined( NEUTRAL_TONE_MAPPING )
	gl_FragColor.rgb = NeutralToneMapping( gl_FragColor.rgb );
#endif
#ifdef SRGB_TRANSFER
	gl_FragColor = sRGBTransferOETF( gl_FragColor );
#endif
}`;

// the mean linear brightness of a texture on a fixed 16 x 9 grid of taps -> one 8-bit texel (mean / 8, clamped), read back asynchronously
const PROBE_FRAGMENT = /* glsl */`
precision highp float;
uniform sampler2D tDiffuse;
varying vec2 vUv;
void main() {
	float sum = 0.0;
	for ( int y = 0; y < 9; y ++ ) for ( int x = 0; x < 16; x ++ ) {
		vec3 c = texture2D( tDiffuse, ( vec2( float( x ), float( y ) ) + 0.5 ) / vec2( 16.0, 9.0 ) ).rgb;
		sum += dot( c, vec3( 0.2126, 0.7152, 0.0722 ) );
	}
	gl_FragColor = vec4( clamp( sum / 144.0 / 8.0, 0.0, 1.0 ), 0.0, 0.0, 1.0 );
}`;

/**
 * The GRADE the Best-quality chain uses, per time of day, as a pull of the preset's own numbers toward neutral. The film's presets
 * desaturate dusk to 0.72 and night to 0.8 (a deliberate cinematic look) and darken the corners; the plain player has neither, and
 * the lighter Best quality is a preview of the same picture with occlusion, bloom and antialiasing on top, so it keeps only a part
 * of that grade. Measured against the plain path (README -> frame): the page's own chain read 8 to 17 % greyer.
 */
export const GRADE = {
	/** the preset's contrast exponent is pulled this far toward 1 (1 = the preset's own) */
	contrastK: 0.55,
	/** effective saturation = 1 - (1 - preset saturation) * this: dusk 0.72 -> 0.90, night 0.8 -> 0.93, day 0.88 -> 0.96 */
	saturationPull: 0.35,
	/** the vignette's strength relative to the preset's */
	vignetteK: 0.6,
	/** bloom strength relative to the preset's */
	bloomK: 0.75,
	/** the bloom threshold is at least this many times the frame's mean brightness, and never below the floor */
	thresholdMean: 5.5,
	thresholdFloor: 1.7,
	thresholdCeil: 4.0,
};

export type FrameKitStats = {
	accum: { count: number; msaa: number; w: number; h: number; allocated: boolean };
	hq: { ready: boolean; w: number; h: number; meanLum: number | null; threshold: number | null; frames: number; bakedAo: boolean };
};

export function createFrameKit(ctx: KitCtx) {
	const { THREE, renderer, scene } = ctx;
	const size = new THREE.Vector2();
	const canvasSize = (): { w: number; h: number } => { renderer.getDrawingBufferSize(size); return { w: Math.max(2, Math.round(size.x)), h: Math.max(2, Math.round(size.y)) }; };

	const quad = new FullScreenQuad(null);
	const resolveMaterial = (grade: boolean) => {
		const m = new THREE.RawShaderMaterial({
			name: grade ? 'HouseHqResolve' : 'HouseAccumResolve',
			defines: grade ? { VH_GRADE: '' } : {},
			uniforms: {
				tDiffuse: { value: null }, toneMappingExposure: { value: 1 }, vhScale: { value: 1 },
				contrast: { value: 1 }, saturation: { value: 1 }, vignette: { value: 0 }, aspect: { value: 16 / 9 },
				look: { value: GRADE_LOOK }, balance: { value: GRADE_BALANCE },   // (shared objects: applyLighting writes them for the house on screen)
			},
			vertexShader: OutputShader.vertexShader,
			fragmentShader: RESOLVE_FRAGMENT,
			depthTest: false, depthWrite: false,
		});
		(m as any)._cs = null; (m as any)._tm = null;
		return m;
	};
	// OutputPass's define rebuild: tone mapping and the colour transfer follow the renderer
	const syncOutputDefines = (m: any) => {
		if (m._cs === renderer.outputColorSpace && m._tm === renderer.toneMapping) return;
		m._cs = renderer.outputColorSpace; m._tm = renderer.toneMapping;
		const d: Record<string, string> = m.name === 'HouseHqResolve' ? { VH_GRADE: '' } : {};
		if (THREE.ColorManagement.getTransfer(m._cs) === THREE.SRGBTransfer) d.SRGB_TRANSFER = '';
		const t = m._tm;
		if (t === THREE.LinearToneMapping) d.LINEAR_TONE_MAPPING = '';
		else if (t === THREE.ReinhardToneMapping) d.REINHARD_TONE_MAPPING = '';
		else if (t === THREE.CineonToneMapping) d.CINEON_TONE_MAPPING = '';
		else if (t === THREE.ACESFilmicToneMapping) d.ACES_FILMIC_TONE_MAPPING = '';
		else if (t === THREE.AgXToneMapping) d.AGX_TONE_MAPPING = '';
		else if (t === THREE.NeutralToneMapping) d.NEUTRAL_TONE_MAPPING = '';
		m.defines = d;
		m.needsUpdate = true;
	};
	// the renderer's clear colour is the page's (the sky's horizon, alpha 1); a sum has to start at zero
	const clearCol = new THREE.Color();
	const clearBlack = (target: any) => {
		const a = renderer.getClearAlpha(); renderer.getClearColor(clearCol);
		renderer.setRenderTarget(target); renderer.setClearColor(0x000000, 0); renderer.clear();
		renderer.setClearColor(clearCol, a);
	};
	const drawQuad = (mat: any, target: any) => {
		const ac = renderer.autoClear;
		renderer.autoClear = false;
		renderer.setRenderTarget(target);
		quad.material = mat;
		quad.render(renderer);
		renderer.autoClear = ac;
	};

	// =============================================================================================================
	// accumulation
	// =============================================================================================================
	const acc: { rt: any; sum: any; w: number; h: number; msaa: number; add: any; out: any; count: number } = { rt: null, sum: null, w: 0, h: 0, msaa: 0, add: null, out: null, count: 0 };
	function accEnsure(w: number, h: number): void {
		const msaa = w * h <= ACC_MSAA_CAP ? 4 : 0;
		if (acc.rt && acc.w === w && acc.h === h && acc.msaa === msaa) return;
		accFree();
		acc.w = w; acc.h = h; acc.msaa = msaa;
		acc.rt = new THREE.WebGLRenderTarget(w, h, { type: THREE.HalfFloatType, samples: msaa });
		acc.rt.texture.name = 'HouseAccum.frame';
		acc.rt.isXRRenderTarget = true;   // see COLOUR MATCH above; the texture's colorSpace is set per step
		acc.sum = new THREE.WebGLRenderTarget(w, h, { type: THREE.HalfFloatType, depthBuffer: false });
		acc.sum.texture.name = 'HouseAccum.sum';
		acc.add = new THREE.RawShaderMaterial({
			name: 'HouseAccumAdd',
			uniforms: { tDiffuse: { value: acc.rt.texture } },
			vertexShader: OutputShader.vertexShader,
			fragmentShader: 'precision highp float; uniform sampler2D tDiffuse; varying vec2 vUv; void main() { gl_FragColor = texture2D( tDiffuse, vUv ); }',
			blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor,
			blendEquationAlpha: THREE.AddEquation, blendSrcAlpha: THREE.OneFactor, blendDstAlpha: THREE.OneFactor,
			depthTest: false, depthWrite: false,
		});
		acc.out = new THREE.RawShaderMaterial({
			name: 'HouseAccumShow',
			uniforms: { tDiffuse: { value: acc.sum.texture }, vhScale: { value: 1 } },
			vertexShader: OutputShader.vertexShader,
			fragmentShader: 'precision highp float; uniform sampler2D tDiffuse; uniform float vhScale; varying vec2 vUv; void main() { gl_FragColor = vec4( clamp( texture2D( tDiffuse, vUv ).rgb * vhScale, 0.0, 1.0 ), 1.0 ); }',
			depthTest: false, depthWrite: false,
		});
		acc.count = 0;
	}
	function accFree(): void {
		for (const k of ['rt', 'sum'] as const) { if (acc[k]) { acc[k].dispose(); acc[k] = null; } }
		for (const k of ['add', 'out'] as const) { if (acc[k]) { acc[k].dispose(); acc[k] = null; } }
		acc.count = 0; acc.w = acc.h = acc.msaa = 0;
	}

	/**
	 * Draw one more jittered sample and show the running mean. The caller owns the shadow map (`shadowUpdate`: true for the first
	 * sample of an accumulation, so the map is current, false after) and the choice of when to stop. Everything it touches (the
	 * camera's view offset, the render target, autoClear) is put back before it returns, also on a throw.
	 */
	function accStep(camera: any, shadowUpdate: boolean): number {
		const { w, h } = canvasSize();
		accEnsure(w, h);
		const k = acc.count;
		const sm = renderer.shadowMap, prevAuto = sm.autoUpdate, prevRT = renderer.getRenderTarget(), prevView = camera.view ? { ...camera.view } : null;
		let offset = false;
		const restoreView = () => {
			if (!offset) return;
			offset = false;
			if (prevView && prevView.enabled) camera.setViewOffset(prevView.fullWidth, prevView.fullHeight, prevView.offsetX, prevView.offsetY, prevView.width, prevView.height);
			else { camera.clearViewOffset(); if (!prevView) camera.view = null; }   // (three keeps a disabled view object; the camera had none)
		};
		try {
			const i = k + 1;
			camera.setViewOffset(w, h, halton(i, 2) - 0.5, halton(i, 3) - 0.5, w, h);
			offset = true;
			sm.autoUpdate = shadowUpdate && prevAuto;
			acc.rt.texture.colorSpace = renderer.outputColorSpace;
			renderer.setRenderTarget(acc.rt);
			renderer.render(scene, camera);
			restoreView();   // the camera as it was, before anything else can read its projection
			if (k === 0) { clearBlack(acc.sum); }
			drawQuad(acc.add, acc.sum);
			acc.count = k + 1;
			acc.out.uniforms.vhScale.value = 1 / acc.count;
			drawQuad(acc.out, null);
		} finally {
			restoreView();
			sm.autoUpdate = prevAuto;
			renderer.setRenderTarget(prevRT);
		}
		return acc.count;
	}
	/** Show the sum again (the canvas was drawn over by something else, the mean has not changed). */
	const accShow = (): void => {
		if (!acc.sum || !acc.count) return;
		const prevRT = renderer.getRenderTarget();
		acc.out.uniforms.vhScale.value = 1 / acc.count;
		drawQuad(acc.out, null);
		renderer.setRenderTarget(prevRT);
	};

	// =============================================================================================================
	// Best quality
	// =============================================================================================================
	const hq: any = { w: 0, h: 0, rt: null, ping: null, ldr: null, gtao: null, bloom: null, smaa: null, resolve: null, probe: null, probeRt: null, probeBuf: new Uint8Array(4),
		reading: false, mean: null as number | null, threshold: null as number | null, frames: 0, built: false, house: null as any };
	const seeThrough = (m: any): boolean => !!m && (m.transparent || (m.transmission || 0) > 0);

	function hqBuild(w: number, h: number): void {
		hq.w = w; hq.h = h;
		const hw = Math.max(2, w >> 1), hh = Math.max(2, h >> 1);
		hq.rt = new THREE.WebGLRenderTarget(w, h, { type: THREE.HalfFloatType, samples: 4 });
		hq.ping = new THREE.WebGLRenderTarget(w, h, { type: THREE.HalfFloatType, depthBuffer: false });
		hq.ldr = new THREE.WebGLRenderTarget(w, h, { type: THREE.UnsignedByteType, depthBuffer: false });
		hq.rt.texture.name = 'HouseHq.scene'; hq.ping.texture.name = 'HouseHq.ao'; hq.ldr.texture.name = 'HouseHq.display';
		const gtao = new GTAOPass(scene, ctx.camera, hw, hh);
		gtao.output = GTAOPass.OUTPUT.Default;
		gtao.blendIntensity = 1.0;
		gtao.updateGtaoMaterial({ radius: 0.8, distanceExponent: 1, thickness: 1, scale: 1, samples: 10, distanceFallOff: 1, screenSpaceRadius: false });
		gtao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 4, radiusExponent: 1, rings: 2, samples: 8 });
		// glass, screens and other see-through surfaces neither occlude nor take occlusion (the page's rule); the sun's shadow map is
		// not redrawn for the normal pass (the scene pass before it just drew it)
		const baseOverride = gtao.overrideVisibility.bind(gtao);
		gtao.overrideVisibility = function () { baseOverride(); scene.traverse((o: any) => { if (o.isMesh && o.visible && (Array.isArray(o.material) ? o.material.some(seeThrough) : seeThrough(o.material))) o.visible = false; }); };
		const baseRender = gtao.renderOverride.bind(gtao);
		gtao.renderOverride = function (r: any, mat: any, rt: any, cc: any, ca: any) { const a = r.shadowMap.autoUpdate; r.shadowMap.autoUpdate = false; try { baseRender(r, mat, rt, cc, ca); } finally { r.shadowMap.autoUpdate = a; } };
		hq.gtao = gtao;
		hq.bloom = new UnrealBloomPass(new THREE.Vector2(w, h), 0.2, 0.5, 2.0);
		if (!hq.smaa) hq.smaa = new SMAAPass(w, h); else hq.smaa.setSize(w, h);
		hq.resolve = resolveMaterial(true);
		hq.probe = new THREE.RawShaderMaterial({ name: 'HouseHqProbe', uniforms: { tDiffuse: { value: null } }, vertexShader: OutputShader.vertexShader, fragmentShader: PROBE_FRAGMENT, depthTest: false, depthWrite: false });
		hq.probeRt = new THREE.WebGLRenderTarget(1, 1, { type: THREE.UnsignedByteType, depthBuffer: false, minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter });
		hq.built = true;
		hq.house = null;
	}
	function hqFree(): void {
		for (const k of ['rt', 'ping', 'ldr', 'probeRt']) if (hq[k]) { hq[k].dispose(); hq[k] = null; }
		if (hq.gtao) { hq.gtao.dispose(); hq.gtao = null; }
		if (hq.bloom) { hq.bloom.dispose(); hq.bloom = null; }
		for (const k of ['resolve', 'probe']) if (hq[k]) { hq[k].dispose(); hq[k] = null; }
		hq.built = false; hq.w = hq.h = 0;
	}
	/** GTAO's clip box is the house's lot (the page's fitGtaoClipBox) */
	function fitClip(): void {
		const house = ctx.house();
		if (hq.house === house) return;
		hq.house = house;
		const b = house?.anchors?.bounds;
		if (!b) return;
		const lot = house.spec?.lot || { w: 30, d: 24 };
		hq.gtao.setSceneClipBox(new THREE.Box3(new THREE.Vector3(Math.min(b.minX, -lot.w / 2) - 1, -1, Math.min(b.minZ, -lot.d / 2) - 1), new THREE.Vector3(Math.max(b.maxX, lot.w / 2) + 1, 14, Math.max(b.maxZ, lot.d / 2) + 1)));
	}
	/** SMAA decodes its two lookup tables from data URLs; a frame drawn before they are on the GPU is antialiased against nothing */
	function smaaReady(): boolean {
		const s = hq.smaa;
		if (!s) return false;
		const ok = (t: any) => !!(t.image && t.image.complete && t.image.naturalWidth > 0);
		if (!(ok(s.areaTexture) && ok(s.searchTexture))) return false;
		if (!s.__uploaded) { s.areaTexture.needsUpdate = true; s.searchTexture.needsUpdate = true; s.__uploaded = true; }
		return true;
	}
	/** Start building the chain now (the lookups need a few ms to decode). */
	function hqWarm(): boolean {
		const { w, h } = hqSize();
		if (!hq.built || hq.w !== w || hq.h !== h) {
			if (hq.built) { hqResize(w, h); } else hqBuild(w, h);
		}
		return smaaReady();
	}
	function hqSize(): { w: number; h: number } {
		const { w, h } = canvasSize();
		const k = Math.min(1, Math.sqrt(HQ_PIXEL_CAP / (w * h)));
		return { w: Math.max(2, Math.round(w * k)), h: Math.max(2, Math.round(h * k)) };
	}
	function hqResize(w: number, h: number): void {
		hq.w = w; hq.h = h;
		const hw = Math.max(2, w >> 1), hh = Math.max(2, h >> 1);
		hq.rt.setSize(w, h); hq.ping.setSize(w, h); hq.ldr.setSize(w, h);
		hq.gtao.setSize(hw, hh);
		hq.bloom.setSize(w, h);
		hq.smaa.setSize(w, h);
	}
	/** the bloom's threshold from the frame's mean brightness (read back a few frames late, asynchronously: no stall) */
	function bloomThreshold(preset: any): number {
		const G = GRADE;
		const base = preset.bloom.threshold;
		if (hq.mean === null) return Math.max(G.thresholdFloor, base);
		return Math.min(G.thresholdCeil, Math.max(G.thresholdFloor, G.thresholdMean * hq.mean));
	}
	function probeMean(): void {
		if (hq.reading || typeof renderer.readRenderTargetPixelsAsync !== 'function') return;
		hq.probe.uniforms.tDiffuse.value = hq.ping.texture;
		drawQuad(hq.probe, hq.probeRt);
		hq.reading = true;
		renderer.readRenderTargetPixelsAsync(hq.probeRt, 0, 0, 1, 1, hq.probeBuf).then(() => {
			hq.reading = false;
			const m = (hq.probeBuf[0] / 255) * 8;
			hq.mean = hq.mean === null ? m : hq.mean + (m - hq.mean) * 0.35;
		}, () => { hq.reading = false; });
	}

	/** One Best-quality frame to the canvas. false when the chain is not ready (SMAA's lookups still decoding): the caller draws plain. */
	function hqRender(camera: any): boolean {
		if (!hqWarm()) return false;
		fitClip();
		const light = ctx.lighting();
		const preset = TIME_OF_DAY[light && light.preset] || TIME_OF_DAY.day;
		const prevRT = renderer.getRenderTarget();
		try {
			// 1. the scene, 4x MSAA
			renderer.setRenderTarget(hq.rt);
			renderer.render(scene, camera);
			// 2. ambient occlusion (half resolution), written over the scene into `ping`; the baked volume (the "ao" feature) already
			// darkens corners, so the screen-space term is eased where it is drawing
			hq.gtao.blendIntensity = ctx.bakedAo() ? 0.6 : 1.0;
			hq.gtao.renderToScreen = false;
			hq.gtao.render(renderer, hq.ping, hq.rt);
			// 3. bloom, in place on `ping`
			hq.bloom.strength = preset.bloom.strength * GRADE.bloomK;
			hq.bloom.radius = preset.bloom.radius;
			hq.bloom.threshold = hq.threshold = bloomThreshold(preset);
			hq.bloom.renderToScreen = false;
			hq.bloom.render(renderer, hq.ping, hq.ping);
			if (hq.frames % 6 === 0) probeMean();
			// 4. grade + tone map + sRGB into the 8-bit display target
			const m = hq.resolve, u = m.uniforms;
			syncOutputDefines(m);
			const g = (light && light.grade) || preset.grade;
			u.tDiffuse.value = hq.ping.texture;
			u.toneMappingExposure.value = renderer.toneMappingExposure;
			u.vhScale.value = 1;
			u.contrast.value = 1 + (g.contrast - 1) * GRADE.contrastK;
			u.saturation.value = 1 - (1 - g.saturation) * GRADE.saturationPull;
			u.vignette.value = g.vignette * GRADE.vignetteK;
			u.aspect.value = hq.w / hq.h;
			drawQuad(m, hq.ldr);
			// 5. SMAA on the display picture, to the canvas
			hq.smaa.renderToScreen = true;
			hq.smaa.render(renderer, null, hq.ldr);
			hq.frames++;
		} finally {
			renderer.setRenderTarget(prevRT);
		}
		return true;
	}

	function dispose(): void {
		accFree();
		hqFree();
		if (hq.smaa) { hq.smaa.dispose(); hq.smaa = null; }
		quad.dispose();
	}

	return {
		accStep, accShow,
		accCount: () => acc.count,
		accReset: () => { acc.count = 0; },
		accFree,
		accAllocated: () => !!acc.rt,
		hqWarm, hqRender, hqFree,
		dispose,
		stats: (): FrameKitStats => ({
			accum: { count: acc.count, msaa: acc.msaa, w: acc.w, h: acc.h, allocated: !!acc.rt },
			hq: { ready: hq.built && smaaReady(), w: hq.w, h: hq.h, meanLum: hq.mean === null ? null : +hq.mean.toFixed(3), threshold: hq.threshold === null ? null : +hq.threshold.toFixed(2), frames: hq.frames, bakedAo: ctx.bakedAo() },
		}),
	};
}
export type FrameKit = ReturnType<typeof createFrameKit>;
