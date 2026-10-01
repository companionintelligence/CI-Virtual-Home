// The site bake: one top-down look at the ground of a built house, kept as a small texture the live grass and the live
// lawn read by world position (assets/viewer-grass.ts). Live player only (assets/realism-grass.ts installs it).
//
// WHAT IT SEES. An orthographic camera over the lot looks straight down through a thin SLICE of the scene: from just under
// the lawn's top to 60 cm above it. Everything that stands in the slice is drawn once, flat, and nothing is lit. So the
// lawn top, beds, paths, patios, pool tops, decks, the house footprint, tree trunks and shrub bases are seen, and the
// canopies, roofs and walls above the slice are cut away by the near plane (the temporary materials are double-sided,
// so a wall that crosses the slice is seen from inside as its own flat colour, never as a window onto the lawn behind).
//
// WHAT IT KEEPS (RGBA, half float, never read back by the player):
//   R  lawn coverage (1 where the lawn is the thing on top), G  the lawn's height times R (divide by R for the height),
//   B  water, A  "something hard stands here" (paths, beds, walls, trunks), blurred wide so it is a soft contact falloff.
// Two small blurs turn the pixel-exact classes into a soft ramp about 10 cm wide, so blades thin out and shrink at a path
// edge instead of stopping at a line, and the A channel gets one wider blur for the lawn's edge darkening.
//
// IT TOUCHES THE SCENE FOR ONE RENDER. Every visible mesh gets a flat class material for that render and its own material
// back in a `finally`, the sun's shadow map is not redrawn, the background is off, and the renderer's target, clear colour
// and autoClear are put back: the bake leaves nothing behind (scripts/live-checks/grass.mts checks the scene is identical).
// Nothing here runs in a product frame; the offline hooks never see it.
export type SiteBake = {
  texture: any;
  /** world rectangle covered: x0, z0, w, d (u = (x - x0) / w, v = (z1 - z) / d, with z1 = z0 + d) */
  rect: { x0: number; z0: number; w: number; d: number };
  size: [number, number];
  /** lawn surface height range (y) the slice was cut around */
  yMin: number;
  yMax: number;
  /** pixels per metre */
  ppm: number;
  stats: { ms: number; meshes: number; bytes: number };
  /** the texels (half float decoded), for the live check only: a read-back stalls the GPU */
  read(): Float32Array;
  dispose(): void;
};

// uBias pushes a surface away from the camera by a few millimetres: a wall's, a bed's or a car's bottom face lies in the
// lawn's own plane (y = 0), and a depth tie there was won by whichever triangle the GPU drew last (the wall's centre read as lawn)
const VERT = /* glsl */`
uniform float uTop; uniform float uBias;
varying float vY;
void main() {
  #include <begin_vertex>
  #include <project_vertex>
  mvPosition.z -= uBias;
  gl_Position = projectionMatrix * mvPosition;
  vY = uTop + mvPosition.z;   // the camera looks straight down from y = uTop, so view depth is the drop below it
}`;
const FRAG = /* glsl */`
uniform vec4 uCls;   // (R, G is y when uCls.y > 0.5, B, A)
varying float vY;
void main() { gl_FragColor = vec4(uCls.x, uCls.y * vY, uCls.z, uCls.w); }`;

const QUAD_VERT = /* glsl */`varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;
// separable blur; `uMask` picks the channels it blurs (the others pass through), weights are a 9-tap gaussian at `uStep` texels
const BLUR_FRAG = /* glsl */`
uniform sampler2D tSrc; uniform vec2 uDir; uniform vec4 uMask; uniform float uSigma;
varying vec2 vUv;
void main() {
  vec4 c = texture2D(tSrc, vUv);
  vec4 acc = vec4(0.0); float wsum = 0.0;
  for (int i = -4; i <= 4; i++) {
    float w = exp(-0.5 * float(i * i) / (uSigma * uSigma));
    acc += w * texture2D(tSrc, vUv + uDir * float(i));
    wsum += w;
  }
  acc /= wsum;
  gl_FragColor = mix(c, acc, uMask);
}`;

const lawnMeshes = (scene: any): any[] => {
  const out: any[] = [];
  scene.traverseVisible((o: any) => {
    if (!o.isMesh || o.isInstancedMesh) return;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    if (mats.some((m: any) => m && m.userData && m.userData.surface === 'lawn')) out.push(o);
  });
  return out;
};

/** the ground lawn of the scene: its meshes and their world box, or null when the house has none that sits at ground level */
export function findGroundLawn(THREE: any, scene: any): { meshes: any[]; box: any; tops: number[] } | null {
  scene.updateMatrixWorld(true);
  const box = new THREE.Box3(), b = new THREE.Box3(), meshes: any[] = [], tops: number[] = [];
  for (const o of lawnMeshes(scene)) {
    b.setFromObject(o);
    // a lawn on an upper storey (a courtyard floor) or a green roof is not the ground; neither is anything huge
    if (b.isEmpty() || b.min.y > 0.3 || b.max.y < -0.3 || b.max.x - b.min.x > 400) continue;
    meshes.push(o); tops.push(b.max.y); box.union(b);
  }
  return meshes.length ? { meshes, box, tops } : null;
}

export function bakeSite(THREE: any, renderer: any, scene: any, opts: { maxSide?: number; margin?: number } = {}): SiteBake | null {
  const t0 = performance.now();
  const lawn = findGroundLawn(THREE, scene);
  if (!lawn) return null;
  const margin = opts.margin ?? 1;
  const x0 = lawn.box.min.x - margin, x1 = lawn.box.max.x + margin, z0 = lawn.box.min.z - margin, z1 = lawn.box.max.z + margin;
  const w = x1 - x0, d = z1 - z0;
  const maxSide = opts.maxSide ?? 1024;
  const ppm = Math.min(maxSide / Math.max(w, d), 32);
  const W = Math.max(64, Math.ceil(w * ppm)), H = Math.max(64, Math.ceil(d * ppm));
  // the slice: just under the lawn's lowest top to 60 cm over its highest
  const yMin = Math.min(...lawn.tops), yMax = Math.max(...lawn.tops);   // (a lawn's top is its mesh box's top)
  // (60 cm and not 30: a raised bed's soil and a car's body sit above 30 cm, and a slice that cuts them away shows the lawn under them)
  const near = yMax + 0.6, far = yMin - 0.05;   // (world y of the slice's two planes; the camera sits on the top one)

  const makeTarget = () => new THREE.WebGLRenderTarget(W, H, {
    type: THREE.HalfFloatType, format: THREE.RGBAFormat, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter,
    wrapS: THREE.ClampToEdgeWrapping, wrapT: THREE.ClampToEdgeWrapping, depthBuffer: true, stencilBuffer: false, generateMipmaps: false,
  });
  const A = makeTarget(), B = makeTarget();
  const cam = new THREE.OrthographicCamera(-w / 2, w / 2, d / 2, -d / 2, 0, near - far);
  cam.position.set((x0 + x1) / 2, near, (z0 + z1) / 2);
  cam.up.set(0, 0, -1);   // right = +x, up = -z, so v runs from the +z edge down to the -z edge
  cam.lookAt((x0 + x1) / 2, far, (z0 + z1) / 2);
  cam.layers.enableAll();
  cam.updateMatrixWorld(true);

  const mk = (cls: number[], bias: number) => new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG, side: THREE.DoubleSide, uniforms: { uTop: { value: near }, uBias: { value: bias }, uCls: { value: new THREE.Vector4(...cls) } } });
  const mats = { hard: mk([0, 0, 0, 1], 0), lawn: mk([1, 1, 0, 0], 0.004), water: mk([0, 0, 1, 0], 0.002) };

  // ---- the swap: every visible mesh gets its class material for one render; a finally puts all of it back
  const saved: { o: any; material: any }[] = [], hidden: any[] = [];
  const classOf = (m: any): any => (m && m.userData && m.userData.surface === 'lawn' ? mats.lawn : m && m.userData && m.userData.surface === 'water' ? mats.water : mats.hard);
  let meshes = 0;
  const prev = {
    target: renderer.getRenderTarget(), autoClear: renderer.autoClear, clear: renderer.getClearColor(new THREE.Color()), clearAlpha: renderer.getClearAlpha(),
    shadowAuto: renderer.shadowMap.autoUpdate, shadowNeeds: renderer.shadowMap.needsUpdate, bg: scene.background, env: scene.environment, fog: scene.fog, over: scene.overrideMaterial,
    xr: renderer.xr.enabled, tone: renderer.toneMapping,
  };
  try {
    scene.traverseVisible((o: any) => {
      if (o.isMesh) {
        saved.push({ o, material: o.material }); meshes++;
        o.material = Array.isArray(o.material) ? o.material.map(classOf) : classOf(o.material);
      } else if (o.isLine || o.isPoints || o.isSprite) { hidden.push(o); }
    });
    for (const o of hidden) o.visible = false;
    scene.background = null; scene.environment = null; scene.fog = null; scene.overrideMaterial = null;
    renderer.xr.enabled = false;
    renderer.shadowMap.autoUpdate = false; renderer.shadowMap.needsUpdate = false;
    renderer.autoClear = true;
    // the clear is "hard" (A = 1): whatever the slice does not draw (the void under a floating storey) is not lawn
    renderer.setClearColor(new THREE.Color(0, 0, 0), 1);
    renderer.setRenderTarget(A);
    renderer.render(scene, cam);
  } finally {
    for (const s of saved) s.o.material = s.material;
    for (const o of hidden) o.visible = true;
    scene.background = prev.bg; scene.environment = prev.env; scene.fog = prev.fog; scene.overrideMaterial = prev.over;
    renderer.xr.enabled = prev.xr;
    renderer.shadowMap.autoUpdate = prev.shadowAuto; renderer.shadowMap.needsUpdate = prev.shadowNeeds;
    renderer.autoClear = prev.autoClear;
    renderer.setClearColor(prev.clear, prev.clearAlpha);
    renderer.setRenderTarget(prev.target);
    for (const m of Object.values(mats) as any[]) m.dispose();
  }

  // ---- the blurs (fullscreen triangle). 1: pixel classes -> a soft ramp. 2: the hardness channel alone, wider.
  const quadGeo = new THREE.BufferGeometry();
  quadGeo.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3));
  quadGeo.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 2, 0, 0, 2], 2));
  const blurMat = new THREE.ShaderMaterial({ vertexShader: QUAD_VERT, fragmentShader: BLUR_FRAG, depthTest: false, depthWrite: false, uniforms: { tSrc: { value: null }, uDir: { value: new THREE.Vector2() }, uMask: { value: new THREE.Vector4(1, 1, 1, 1) }, uSigma: { value: 1.5 } } });
  const quad = new THREE.Mesh(quadGeo, blurMat); quad.frustumCulled = false;
  const qs = new THREE.Scene(); qs.add(quad);
  const qc = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const pass = (src: any, dst: any, dx: number, dy: number, mask: number[], sigma: number) => {
    blurMat.uniforms.tSrc.value = src.texture; blurMat.uniforms.uDir.value.set(dx / W, dy / H); blurMat.uniforms.uMask.value.set(...mask); blurMat.uniforms.uSigma.value = sigma;
    renderer.setRenderTarget(dst); renderer.render(qs, qc);
  };
  try {
    renderer.autoClear = true;
    // 10 cm ramp: sigma ~1.4 texels at ~30 px/m is ~5 cm, 9 taps wide
    pass(A, B, 1, 0, [1, 1, 1, 1], 1.4); pass(B, A, 0, 1, [1, 1, 1, 1], 1.4);
    // contact falloff: the hardness channel alone, 3 texels a tap (about 35 cm of reach at 30 px/m)
    pass(A, B, 3, 0, [0, 0, 0, 1], 1.8); pass(B, A, 0, 3, [0, 0, 0, 1], 1.8);
  } finally {
    renderer.autoClear = prev.autoClear;
    renderer.setRenderTarget(prev.target);
    blurMat.dispose(); quadGeo.dispose();
  }
  B.dispose();
  const tex = A.texture;
  tex.generateMipmaps = false; tex.needsUpdate = false;

  const bake: SiteBake = {
    texture: tex, rect: { x0, z0, w, d }, size: [W, H], yMin, yMax, ppm,
    stats: { ms: +(performance.now() - t0).toFixed(2), meshes, bytes: W * H * 8 },
    read() {
      const px = new Uint16Array(W * H * 4);
      renderer.readRenderTargetPixels(A, 0, 0, W, H, px);
      const f = new Float32Array(px.length);
      for (let i = 0; i < px.length; i++) f[i] = THREE.DataUtils.fromHalfFloat(px[i]);
      return f;
    },
    dispose() { A.dispose(); },
  };
  return bake;
}
