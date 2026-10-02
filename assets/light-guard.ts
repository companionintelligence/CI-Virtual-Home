// Cheap spot and point lights for the live player. three's lights_fragment_begin evaluates RE_Direct (the full
// Lambert + GGX) for EVERY spot and point light in EVERY fragment, even where getSpotLightInfo / getPointLightInfo
// have already said the fragment is outside the cone or the range (directLight.visible = false, colour 0). The
// term is then exactly +0, so a house with a dozen lamps pays a dozen BRDFs per pixel for nothing. This wraps the
// RE_Direct call of those two loops in `if ( directLight.visible )`: same picture, the BRDF only where a light
// reaches. The directional loop is left alone (its lights are always visible).
//
// ROOM CLIP (the "frame" realism feature, assets/realism-frame.ts). The house's room lights (assets/fixtures.ts: one warm
// SpotLight per room, no shadows) are kept in their room only by a distance cutoff that stops "just past the side walls".
// That keeps the lawn dark but not the room next door: the neighbour's wall face, a wall's back and the ceiling of the
// storey below all lie inside the same cutoff, so a lit room washes the wall behind it, and light from an upstairs
// room lights the downstairs ceiling. The clip gives each spot its room's box and, in the spot loop, drops the light
// (directLight.visible = false, colour 0) for a fragment outside it. The box is a uniform per spot index, so it needs the
// index of each light in three's uniform array: createSpotClip() keeps that mapping by walking the scene the way three
// does (pre-order, invisible subtrees skipped, then WebGLLights' stable sort of shadow casters first) and PROVES it against
// three's own state one frame later (verify(), with no assumption about which camera drew); on a mismatch the clip
// switches itself off and the lights behave as before, tries again 90 frames later, and after the third failure stays off.
//
// LIVE PLAYER ONLY. It is called from room-creator.html under ?mode=view, before any material compiles (three's
// program cache key does not include chunk text, so a program compiled earlier would be reused unpatched). The
// editor, the offline recorder, the goldens, fixtures and thumbs never install it, so no product frame can move.
// `?no=lightguard` turns the guard off for A/B timing (and the clip with it); `?no=frame` / `?no=realism` / `?no=spotclip`
// leave the clip's shader text out. With the clip's switch off (its default) the added code is a branch on a uniform that
// is never taken: the same picture to the bit, which scripts/live-checks/frame.mts compares.
//
// HOW THE CLIP'S UNIFORMS REACH EVERY MATERIAL. They are added to ShaderLib.{lambert,phong,standard,physical,toon}.uniforms,
// which three clones into each material's own uniform map when its first program is made. UniformsUtils.clone copies a
// Vector4 but only slices an ARRAY, so the array's elements are shared by reference: every material, whatever its own
// onBeforeCompile does, reads the same Vector4s, and one write per frame reaches them all (no onBeforeCompile hook, which
// some of the page's materials replace, and viewer-batch.ts tells those apart by hasOwnProperty).

const MARK = 'RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );';
const GUARDED = `if ( directLight.visible ) { ${MARK} }`;
const SPOT_INFO = 'getSpotLightInfo( spotLight, geometryPosition, directLight );';
// the clip: world position from the view-space one with the view matrix THE DRAW IS USING (a rigid transform: p_world = (p - t) * R,
// the transpose of the rotation applied from the right), so a second camera (a mirror, a probe) clips correctly too.
//
// THE DATA IS ONE vec4 A SPOT, 16 BYTES, in one Float32Array shared by every material. three uploads a material's uniforms each time it is
// drawn after another one (a house draws ~1000 of those a frame), so the payload is a per-frame cost: measured on aurora, two arrays of
// Vector4 boxes (lo, hi) cost +3 to 4 ms of CPU a frame, one typed array of 24 x 2 vec4 about +2.5, and this (16 x 1 vec4) is what is left
// of it. The box is (cx, cz, half width, half depth) and (y low, y high), the last four packed two to a float as whole centimetres
// (12 bits each; y from -10 m): a float32 holds 24 bits of integer exactly, and /4096 and floor() are exact in it. Zero half width = no
// box = no clip, which is also what an all-zero array means (a program with more spots than the array, or a light without a room).
// UNROLLED_LOOP_INDEX because three unrolls this loop and only rewrites `[ i ]`; the block braces because the unrolled copies share one
// scope (a bare `vec4 vhB` is a redefinition from the second light on: portal:test caught it).
const GEOM = 'vec3 geometryPosition = - vViewPosition;';
// the fragment's world position, once per fragment and not once per light (16 copies of the matrix product were a measurable GPU cost)
const WORLD = `${GEOM}
#if NUM_SPOT_LIGHTS > 0
	vec3 vhW = ( geometryPosition - viewMatrix[ 3 ].xyz ) * mat3( viewMatrix );
#endif`;
const CLIP = `${SPOT_INFO}
		{
			vec4 vhB = vhClip[ UNROLLED_LOOP_INDEX ];
			if ( directLight.visible && vhB.z > 0.0 ) {
				float vhHW = floor( vhB.z / 4096.0 ), vhYH = floor( vhB.w / 4096.0 );
				float vhHD = vhB.z - vhHW * 4096.0, vhYL = vhB.w - vhYH * 4096.0;
				if ( abs( vhW.x - vhB.x ) > vhHW * 0.01 || abs( vhW.z - vhB.y ) > vhHD * 0.01 || vhW.y < vhYL * 0.01 - 10.0 || vhW.y > vhYH * 0.01 - 10.0 ) { directLight.visible = false; directLight.color = vec3( 0.0 ); }
			}
		}`;
const CLIP_DECL = `
#if NUM_SPOT_LIGHTS > 0
	uniform vec4 vhClip[ NUM_SPOT_LIGHTS ];
#endif
`;
const SHADER_LIBS = ['lambert', 'phong', 'standard', 'physical', 'toon'];
/** The most spot lights one program can hold a box for (a house has at most LIGHT_CAP = 16 room lights). A program with more spots reads
 *  past the array: the GL leaves those entries at 0, and a 0 half width means "no clip", so the extra lights just reach as far as before. */
export const MAX_SPOTS = 16;

/** The packed vec4 of a box (see CLIP), as plain numbers: [cx, cz, hw*4096 + hd, yh*4096 + yl]. Sizes round up, so the box only grows. */
export function packBox(b: { lo: number[]; hi: number[] }): [number, number, number, number] {
  const q = (v: number, hi: number) => Math.min(4095, Math.max(0, hi ? Math.ceil(v - 1e-9) : Math.floor(v + 1e-9)));
  const hw = q((b.hi[0] - b.lo[0]) * 50, 1), hd = q((b.hi[2] - b.lo[2]) * 50, 1);
  const yl = q((b.lo[1] + 10) * 100, 0), yh = q((b.hi[1] + 10) * 100, 1);
  return [(b.lo[0] + b.hi[0]) / 2, (b.lo[2] + b.hi[2]) / 2, Math.max(1, hw) * 4096 + hd, yh * 4096 + yl];
}

type Shared = { data: Float32Array };
let done = false;
let shared: Shared | null = null;

export function installLightGuard(THREE: any): boolean {
  if (done) return true;
  const C = THREE?.ShaderChunk;
  const src: unknown = C?.lights_fragment_begin;
  // the spot and point loops come before the directional one; only their RE_Direct calls are wrapped
  const cut = typeof src === 'string' ? src.indexOf('#if ( NUM_DIR_LIGHTS > 0 )') : -1;
  const head = cut > 0 ? (src as string).slice(0, cut) : '';
  const calls = head.split(MARK).length - 1;
  if (calls !== 2 || !head.includes('NUM_POINT_LIGHTS') || !head.includes('NUM_SPOT_LIGHTS')) {
    console.warn('installLightGuard: three\'s lights_fragment_begin is not the expected r169 text; lights left unguarded');
    return false;
  }
  let text = head.split(MARK).join(GUARDED);
  // the room clip: only where the spot loop and the declarations have exactly the expected text, and the page did not switch it off.
  // Everything is built on the side and taken over only if all of it applied: half a patch is a shader that does not compile.
  const pars: unknown = C?.lights_pars_begin;
  if (clipWanted() && head.split(SPOT_INFO).length === 2 && head.split(GEOM).length === 2 && typeof pars === 'string' && pars.includes('uniform SpotLight spotLights[ NUM_SPOT_LIGHTS ]') && SHADER_LIBS.every(k => THREE.ShaderLib?.[k]?.uniforms)) {
    try {
      // (UniformsUtils.clone slices an Array but hands a typed array on as it is, so every material's own uniform map holds THIS array)
      const data = new Float32Array(MAX_SPOTS * 4);
      const clipped = text.replace(SPOT_INFO, CLIP).replace(GEOM, WORLD);
      for (const k of SHADER_LIBS) THREE.ShaderLib[k].uniforms.vhClip = { value: data };
      C.lights_pars_begin = pars + CLIP_DECL;
      text = clipped;
      shared = { data };
    } catch (e) { shared = null; console.warn('installLightGuard: the room clip could not be installed', e); }
  }
  C.lights_fragment_begin = text + (src as string).slice(cut);
  done = true;
  return true;
}

function clipWanted(): boolean {
  try {
    const q = new URLSearchParams(location.search);
    const no = q.getAll('no').join(',').split(',');
    return !no.includes('lightguard') && !no.includes('frame') && !no.includes('realism') && !no.includes('spotclip');
  } catch { return false; }
}

/** true once installLightGuard has put the room clip's code into three's shader chunks */
export const spotClipInstalled = (): boolean => !!shared;

// ------------------------------------------------------------------------------------------------------------------
// The controller: which light is in which room, in which uniform slot.

export type Box = { lo: [number, number, number]; hi: [number, number, number] };
export type SpotClipStats = { lights: number; mapped: number; slots: number; verified: number; mismatches: number; off: string; on: boolean; lastMismatch: string; strikes: number };
export type SpotClip = {
  /** the boxes were found for this many of the house's room lights */
  readonly mapped: number;
  /** switch the clip on (a no-op after it has failed its proof) */
  apply(): void;
  /** switch it off: the lights reach as far as their cutoff again */
  restore(): void;
  /** before a drawn frame: fill the slots for the lights three will upload, and the camera. false when the clip is off. */
  update(camera: any): boolean;
  /** after a drawn frame: prove the slots matched three's own uniform array. false (and the clip off for a while) when they did not. */
  verify(): boolean;
  /** the scene's lights changed (a rebake, a new light): find them again */
  rescan(): void;
  stats(): SpotClipStats;
  /** the slots as the last update() filled them (for the live check) */
  slotLights(): any[];
  boxOf(light: any): Box | null;
};

/** three's WebGLLights comparator: shadow-casting lights first, then lights with a map; a stable sort keeps the scene order within a class */
const shadowFirst = (a: any, b: any): number => (b.castShadow ? 2 : 0) - (a.castShadow ? 2 : 0) + (b.map ? 1 : 0) - (a.map ? 1 : 0);

/**
 * Boxes for the room lights of a built house. A room light (userData.fixtureLight, assets/fixtures.ts) hangs at the middle of
 * its room's bounds, so the room is the one on the light's storey whose centre is under it. The box is the room's bounds grown by
 * a wall's half thickness's worth (MARGIN) sideways, from the storey's floor up to its ceiling (to the sky on the top storey, where
 * a ceiling may vault).
 */
export function roomBoxes(house: any, lights: any[]): Map<any, Box> {
  const out = new Map<any, Box>();
  const spec = house?.spec, anchors = house?.anchors?.levels;
  if (!spec || !anchors || !Array.isArray(spec.levels)) return out;
  const levels = spec.levels.map((l: any) => ({ id: l.id, a: anchors[l.id], rooms: l.rooms || [] })).filter((l: any) => l.a && typeof l.a.y === 'number');
  const topY = Math.max(...levels.map((l: any) => l.a.y));
  const MARGIN = 0.06, EPS = 0.03;
  const p = { x: 0, y: 0, z: 0 };
  for (const light of lights) {
    light.updateWorldMatrix(true, false);
    const e = light.matrixWorld.elements;
    p.x = e[12]; p.y = e[13]; p.z = e[14];
    let lv: any = null;
    for (const l of levels) if (l.a.y <= p.y + EPS && (!lv || l.a.y > lv.a.y)) lv = l;
    if (!lv) continue;
    const room = lv.rooms.find((r: any) => r.bounds && Math.abs(r.bounds.x + r.bounds.w / 2 - p.x) < 0.03 && Math.abs(r.bounds.z + r.bounds.d / 2 - p.z) < 0.03);
    if (!room) continue;
    const b = room.bounds, top = lv.a.y >= topY ? 1e4 : Math.max(lv.a.y + (lv.a.height || 3) + EPS, p.y + 0.3);
    out.set(light, { lo: [b.x - MARGIN, lv.a.y - EPS, b.z - MARGIN], hi: [b.x + b.w + MARGIN, top, b.z + b.d + MARGIN] });
  }
  return out;
}

export function createSpotClip(o: { scene: any; renderer: any; house: () => any }): SpotClip | null {
  const sh = shared;
  if (!sh) return null;
  const { scene, renderer } = o;
  let all: any[] = [];                       // every light in the scene, in three's visiting order (pre-order), visible or not
  let boxes = new Map<any, Box>();
  let wanted = false;                        // apply() was called and restore() has not been
  let off = '';                              // why the clip switched itself off (empty: it has not)
  let strikes = 0, retryAt = 0, ticks = 0;   // a failed proof switches the clip off for RETRY_TICKS frames; the third one is for good
  const RETRY_TICKS = 90;
  const order: any[] = [];                   // the spot lights as three will upload them this frame
  let uploaded: any[] = [];                  // …and as the last update() left them, for verify()
  let uploadedFrame = -1;                    // renderer.info.render.frame then: no draw since means nothing to prove yet
  let verified = 0, mismatches = 0, lastMismatch = '';
  const live: any[] = [];

  const rescan = () => {
    all = [];
    const walk = (n: any) => { if (n.isLight) all.push(n); const c = n.children; for (let i = 0; i < c.length; i++) walk(c[i]); };
    walk(scene);
    const rooms = all.filter(l => l.isSpotLight && l.userData && l.userData.fixtureLight);
    boxes = roomBoxes(o.house(), rooms);
  };
  rescan();

  const visibleChain = (n: any): boolean => { for (let q = n; q; q = q.parent) if (q.visible === false) return false; return true; };

  function orderSpots(camera: any): void {
    live.length = 0;
    for (const l of all) if (visibleChain(l) && l.layers.test(camera.layers)) live.push(l);
    live.sort(shadowFirst);
    order.length = 0;
    for (const l of live) if (l.isSpotLight) order.push(l);
  }

  let flagged = 0;                           // how many slots carry a flag in the shared array now
  const setBox = (i: number, b: Box | undefined) => {
    const d = sh.data, o = i * 4;
    if (b) d.set(packBox(b), o);
    else d[o + 2] = 0;   // a light without a box (not a room lamp) is not clipped
  };
  const clearFrom = (from: number) => { for (let i = from; i < flagged; i++) sh.data[i * 4 + 2] = 0; flagged = Math.min(flagged, from); };
  const clearFlags = () => clearFrom(0);
  const isOn = () => wanted && !off;
  const fail = (why: string) => { strikes++; off = why; retryAt = ticks + RETRY_TICKS; clearFlags(); uploaded = []; };

  /** three's own spot array (view space): the one a lit material that has been drawn holds. WebGLLights mutates it in place, but the
   *  renderer may make a new one (a new render state), so the material is remembered and the array read from it each time; a material
   *  that has not been refreshed yet holds a private empty array, which is skipped. */
  let stateMat: any = null;
  const spotsOf = (m: any): any[] | null => { const u = m && renderer.properties.get(m).uniforms; return u && u.spotLights && Array.isArray(u.spotLights.value) ? u.spotLights.value : null; };
  function drawnSpots(): any[] | null {
    const known = spotsOf(stateMat);
    if (known && known.length) return known;
    stateMat = null;
    let found: any[] | null = null;
    scene.traverse((n: any) => {
      if (found || !n.isMesh) return;
      for (const m of Array.isArray(n.material) ? n.material : [n.material]) {
        const a = spotsOf(m);
        if (a && a.length) { stateMat = m; found = a; return; }
      }
    });
    return found;
  }

  return {
    get mapped() { return boxes.size; },
    apply() { wanted = true; },
    restore() { wanted = false; clearFlags(); uploaded = []; },
    rescan,
    update(camera) {
      ticks++;
      if (off && strikes < 3 && ticks >= retryAt) off = '';   // try again: the proof below decides
      if (!isOn() || !boxes.size) { clearFlags(); uploaded = []; return false; }
      orderSpots(camera);
      const n = Math.min(order.length, MAX_SPOTS);
      for (let i = 0; i < n; i++) setBox(i, boxes.get(order[i]));
      clearFrom(n); flagged = n;
      uploaded = order.slice(0, n);
      uploadedFrame = renderer.info.render.frame;
      return true;
    },
    verify() {
      if (!isOn() || !uploaded.length) return true;
      if (renderer.info.render.frame === uploadedFrame) return true;   // nothing has been drawn with them yet
      const state = drawnSpots();
      if (!state) return true;   // nothing lit has been drawn yet: no proof either way
      // The slot i chosen at update() must be the light three put in its slot i. three's spot array holds view-space positions of
      // WHICHEVER camera drew last (the main one, or a probe / mirror camera), so no camera is assumed: each slot's own cone
      // (distance, cone cosine) and the distances between slots, which a rigid view transform keeps, must match the lights.
      const n = uploaded.length;
      let ok = state.length === n;
      if (!ok) lastMismatch = `three holds ${state.length} spots, ${n} were mapped`;
      for (let i = 0; ok && i < n; i++) {
        const u = state[i], l = uploaded[i];
        if (Math.abs(u.distance - l.distance) > 1e-3 || Math.abs(u.coneCos - Math.cos(l.angle)) > 1e-4) { ok = false; lastMismatch = `slot ${i}: cone ${u.distance}/${u.coneCos.toFixed(4)} vs light ${l.distance}/${Math.cos(l.angle).toFixed(4)}`; }
      }
      for (let i = 0; ok && i < n; i++) {
        const pi = state[i].position, ei = uploaded[i].matrixWorld.elements;
        for (let j = i + 1; ok && j < n; j++) {
          const pj = state[j].position, ej = uploaded[j].matrixWorld.elements;
          const dv = Math.hypot(pi.x - pj.x, pi.y - pj.y, pi.z - pj.z), dw = Math.hypot(ei[12] - ej[12], ei[13] - ej[13], ei[14] - ej[14]);
          if (Math.abs(dv - dw) > 0.02) { ok = false; lastMismatch = `slots ${i},${j}: ${dv.toFixed(2)} m apart in three, ${dw.toFixed(2)} m as mapped`; }
        }
      }
      verified++;
      if (!ok) { mismatches++; fail('slot mapping did not match three\'s light order'); }
      return ok;
    },
    stats: () => ({ lights: all.filter(l => l.isSpotLight).length, mapped: boxes.size, slots: uploaded.length, verified, mismatches, off, on: isOn(), lastMismatch, strikes }),
    slotLights: () => uploaded.slice(),
    boxOf: (l: any) => boxes.get(l) || null,
  };
}
