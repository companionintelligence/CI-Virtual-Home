// Room clip: a room's light stays in its room (plan 5.2, LIGHT v2 item 2).
//
// The house's lights have no shadows. Each room's one light (fixtures.ts: the fill spot of a lampless room, the lamp pool of a lamp room)
// was kept in its room by a distance cutoff alone, and a cutoff cannot do it: a lamp stands 0.35 m from the wall it leans on, so its reach
// goes a metre or more past that wall and lights the next room's floor, furniture and the wall's far side (measured on the 30 houses:
// 95 of 95 pools reach at least 1 m past their wall, 92 of 95 reach another room, and a lampless bath changed 36 % of its pixels when
// the other rooms' pools were toggled). Realism's live-player clip bounds the SPOTS only and never reaches the offline renderer
// (the goldens, the editor, the composer): this one is in the shader chunk, so every path draws the same picture.
//
//   - one box per light (the room's bounds, from the storey's floor to its ceiling), 16 slots, packed into ONE vec4 a slot in a
//     Float32Array that every lit material shares by reference (three clones an Array uniform but hands a typed array on as it is),
//     so a slot is written once at build and nothing is uploaded or updated per frame;
//   - the light finds its slot in its own `decay`: base + (slot + 1) x 0.0005, base a multiple of 0.01 (the pool's 1.6, the fill's 1).
//     No ordering of three's light arrays is assumed (WebGLLights sorts, the page adds its own point lights); an untagged light, whose
//     decay is 2 like every other light of the page, is not clipped. The coded decay moves the falloff by at most 1.1 % at 4 m;
//   - a fragment outside its light's box gets none of that light. On a side of the room that has NO wall (an open plan: nothing stands
//     between the living room and the kitchen) the light fades out over the last FADE metres inside the room instead of ending in a
//     line across an open floor; on a walled side it ends hard, inside the wall's thickness, so the wall's face stays lit.
//
// Pure data and string patching, no THREE import (Node tests read the packing and the mask); THREE comes in through installRoomClip.

export const MAX_SLOTS = 16;
export const FADE = 0.5;               // m: the soft edge of an open side, measured inside the room
export const MARGIN = 0;               // m: the box is the room's bounds (walls are centred on the bounds: the room's own face is 0.07 inside, the next room's 0.07 outside)
export const DECAY_STEP = 0.0005;
// A lamp pool (fixtures.ts) is a spot with a base decay above this; a room fill's is 1. The shader tells them apart by it (the coded decay is the one thing
// a light carries into the fragment shader that nothing else touches).
export const POOL_DECAY_MIN = 1.5;
// What shapes a pool beyond the cone (LIGHT v3 item 2). A lamp is a lit shade 0.3 m across, not a point: `core` is the radius (m) inside which the
// falloff stops climbing (1/(d^2 + core^2)^(decay/2) instead of 1/d^decay), so the wall, the pillow or the curtain a hand's breadth from the shade is lit and not
// blown out, and the pool can carry the intensity that makes it read across the room. `halo` is the bounded wash a lamp throws on whatever is round it, the wall it
// stands against and the ceiling above a table lamp, which a cone aimed into the room cannot reach: `haloK` of the pool's colour, at full strength at the lamp and
// falling to nothing at `haloR` (m). Lambert still decides how much a surface takes. `upFade` (m): a lamp's shade throws its light out and down, and a ceiling
// a metre over it is lit by what the room's own surfaces send up (environment.ts `bounce`), not by the lamp: the cone fades to nothing over fragments that far
// above the lamp head (from 35 % of it), which is what stops a spot aimed into the room from painting the ceiling white. The halo is not faded, it is bounded
// by its own radius. [core, haloR, haloK, upFade]; one array every lit material shares by reference.
export const POOL_CORE = 0.45, POOL_HALO_R = 1.1, POOL_HALO_K = 0.25, POOL_UP_FADE = 1.3;
export const POOL_DATA = new Float32Array([POOL_CORE, POOL_HALO_R, POOL_HALO_K, POOL_UP_FADE]);

export interface Rect { x: number; z: number; w: number; d: number }
export interface Seg { from: [number, number]; to: [number, number] }
export interface Sides { xmin: boolean; xmax: boolean; zmin: boolean; zmax: boolean }
/** a light's clip box: world metres, and which sides have no wall */
export interface ClipBox { x0: number; x1: number; z0: number; z1: number; y0: number; y1: number; open: Sides }

// ---- which sides of a room have a wall ----------------------------------------------------------------------------------------------
const inRect = (x: number, z: number, r: Rect, pad = 0) => x >= r.x - pad && x <= r.x + r.w + pad && z >= r.z - pad && z <= r.z + r.d + pad;
const segDist = (px: number, pz: number, a: [number, number], b: [number, number]) => {
  const dx = b[0] - a[0], dz = b[1] - a[1], l2 = dx * dx + dz * dz || 1e-9;
  const t = Math.max(0, Math.min(1, ((px - a[0]) * dx + (pz - a[1]) * dz) / l2));
  return Math.hypot(px - (a[0] + dx * t), pz - (a[1] + dz * t));
};
/** Is each side of the room's rectangle walled? A wall is the storey's outline (a side whose outside lies off the footprint) or a partition
 *  along it (door gaps count: a doorway is not an open plan). A side is OPEN when less than half its length has a wall. */
export function openSides(b: Rect, footprint: Rect[], partitions: Seg[]): Sides {
  const walled = (ax: 'x' | 'z', at: number, from: number, to: number, outward: number): boolean => {
    const n = Math.max(2, Math.ceil((to - from) / 0.1));
    let hit = 0;
    for (let i = 0; i < n; i++) {
      const t = from + (to - from) * (i + 0.5) / n;
      const px = ax === 'x' ? at : t, pz = ax === 'x' ? t : at;
      const qx = ax === 'x' ? at + outward * 0.15 : t, qz = ax === 'x' ? t : at + outward * 0.15;
      const outside = footprint.length > 0 && !footprint.some(r => inRect(qx, qz, r, 0));
      if (outside || partitions.some(p => segDist(px, pz, p.from, p.to) <= 0.12)) hit++;
    }
    return hit / n >= 0.5;
  };
  return {
    xmin: !walled('x', b.x, b.z, b.z + b.d, -1), xmax: !walled('x', b.x + b.w, b.z, b.z + b.d, 1),
    zmin: !walled('z', b.z, b.x, b.x + b.w, -1), zmax: !walled('z', b.z + b.d, b.x, b.x + b.w, 1),
  };
}
/** the box of a room on the storey whose floor is at `y` and whose ceiling is `H` above it: from the floor's top to a centimetre under the next storey's floor (the lower
 *  storey's pool lit that floor's baseboards through the slab when the box ran 6 cm past the ceiling: 3 % of a bedroom's pixels) */
export function roomClipBox(b: Rect, y: number, H: number, footprint: Rect[], partitions: Seg[]): ClipBox {
  return { x0: b.x - MARGIN, x1: b.x + b.w + MARGIN, z0: b.z - MARGIN, z1: b.z + b.d + MARGIN, y0: y - 0.01, y1: y + H - 0.01, open: openSides(b, footprint, partitions) };
}

// ---- the packing: one vec4 a slot, every field an exact integer in a float32 --------------------------------------------------------
const Y_UNIT = 0.01, XZ_UNIT = 0.005, Y_BASE = 2;    // 11-bit half sizes: 5 mm to 10.2 m a side (the widest room of the 30 houses is 18.9 m); 11-bit heights: 1 cm from -2 m to 18.5 m (the tallest storey top is 11.4 m)
const B24 = 4194304;                    // 2^22: the flag bits sit above two 11-bit fields
/** [cx, cz, hw + 2048 hd + 2^22 (xmin + 2 xmax), yl + 2048 yh + 2^22 (zmin + 2 zmax)]; the sides round out (the box only grows), the top rounds DOWN: the storey above begins a hair over it (its floor, its baseboards) and must stay dark */
export function packBox(c: ClipBox): [number, number, number, number] | null {
  const q = (v: number) => Math.min(2047, Math.max(0, v));
  const hw = Math.ceil((c.x1 - c.x0) / 2 / XZ_UNIT - 1e-9), hd = Math.ceil((c.z1 - c.z0) / 2 / XZ_UNIT - 1e-9);
  if (hw > 2047 || hd > 2047) return null;   // a room wider than 20 m: no clip (the box would have to shrink, and a too-small box darkens its own room)
  const yl = q(Math.floor((c.y0 + Y_BASE) / Y_UNIT + 1e-9)), yh = q(Math.floor((c.y1 + Y_BASE) / Y_UNIT + 1e-9));
  const f = (b: boolean) => (b ? 1 : 0);
  return [(c.x0 + c.x1) / 2, (c.z0 + c.z1) / 2, hw + 2048 * hd + B24 * (f(c.open.xmin) + 2 * f(c.open.xmax)), yl + 2048 * yh + B24 * (f(c.open.zmin) + 2 * f(c.open.zmax))];
}
/** the inverse, as the shader reads it (the Node tests pin the two together) */
export function unpackBox(v: ArrayLike<number>): ClipBox | null {
  const [cx, cz, z, w] = [v[0], v[1], v[2], v[3]];
  const fz = Math.floor(z / B24), rz = z - fz * B24, hd = Math.floor(rz / 2048), hw = rz - hd * 2048;
  const fw = Math.floor(w / B24), rw = w - fw * B24, yh = Math.floor(rw / 2048), yl = rw - yh * 2048;
  if (hw <= 0 && hd <= 0) return null;
  return { x0: cx - hw * XZ_UNIT, x1: cx + hw * XZ_UNIT, z0: cz - hd * XZ_UNIT, z1: cz + hd * XZ_UNIT, y0: yl * Y_UNIT - Y_BASE, y1: yh * Y_UNIT - Y_BASE,
    open: { xmin: (fz & 1) === 1, xmax: (fz & 2) === 2, zmin: (fw & 1) === 1, zmax: (fw & 2) === 2 } };
}
/** the mask the shader computes (1 inside, 0 outside, a smoothstep over FADE on an open side): the same arithmetic, for Node */
export function clipMask(c: ClipBox, p: { x: number; y: number; z: number }): number {
  const side = (d: number, open: boolean) => (open ? (() => { const t = Math.max(0, Math.min(1, d / FADE)); return t * t * (3 - 2 * t); })() : d >= 0 ? 1 : 0);
  return side(p.x - c.x0, c.open.xmin) * side(c.x1 - p.x, c.open.xmax) * side(p.z - c.z0, c.open.zmin) * side(c.z1 - p.z, c.open.zmax) * (p.y >= c.y0 && p.y <= c.y1 ? 1 : 0);
}

// ---- the slots a house's lights live in -------------------------------------------------------------------------------------------
/** the vec4s every lit material reads (one Float32Array, shared by reference): all zero = no clip anywhere */
export const CLIP_DATA = new Float32Array(MAX_SLOTS * 4);
export function clearSlots() { CLIP_DATA.fill(0); }
export function setSlot(slot: number, c: ClipBox): void {
  if (!(slot >= 0 && slot < MAX_SLOTS)) throw new Error(`room clip: slot ${slot} outside 0..${MAX_SLOTS - 1}`);
  const p = packBox(c);
  CLIP_DATA.set(p || [0, 0, 0, 0], slot * 4);
}
/** a light's decay with its slot coded in: `base` must be a multiple of 0.01 */
export const codedDecay = (base: number, slot: number): number => base + (slot + 1) * DECAY_STEP;
/** the slot a coded decay names, or -1 for an untagged light */
export function slotOfDecay(decay: number): number {
  const c = decay * 100, n = Math.round((c - Math.floor(c)) / 0.05);
  return n >= 1 && n <= MAX_SLOTS ? n - 1 : -1;
}

// ---- the shader patch ---------------------------------------------------------------------------------------------------------------
const GEOM = 'vec3 geometryPosition = - vViewPosition;';
const POINT_INFO = 'getPointLightInfo( pointLight, geometryPosition, directLight );';
const SPOT_INFO = 'getSpotLightInfo( spotLight, geometryPosition, directLight );';
const WORLD = `${GEOM}
vec3 vhWorld = ( geometryPosition - viewMatrix[ 3 ].xyz ) * mat3( viewMatrix );`;
const DECL = `
uniform vec4 vhClip[ ${MAX_SLOTS} ];
uniform vec4 vhPool;
float vhSide( float d, float open ) { return open > 0.5 ? smoothstep( 0.0, ${FADE.toFixed(2)}, d ) : step( 0.0, d ); }
// \`lv\`: from the fragment to the light (view space), \`lc\`: the light's colour before any attenuation (intensity included)
void vhRoomClip( const in float decay, const in vec3 w, inout IncidentLight light, const in vec3 lv, const in vec3 lc ) {
	if ( dot( lc, vec3( 1.0 ) ) <= 0.0 ) return;   // a light that is off adds nothing: skip its box and its pool (every room light by day)
	float c = decay * 100.0;
	float n = floor( ( c - floor( c ) ) / 0.05 + 0.5 );
	if ( n < 1.0 || n > ${MAX_SLOTS}.0 ) return;
	vec4 b = vhClip[ int( n ) - 1 ];
	float fz = floor( b.z / ${B24}.0 ), rz = b.z - fz * ${B24}.0, hd = floor( rz / 2048.0 ), hw = rz - hd * 2048.0;
	float fw = floor( b.w / ${B24}.0 ), rw = b.w - fw * ${B24}.0, yh = floor( rw / 2048.0 ), yl = rw - yh * 2048.0;
	if ( hw <= 0.0 && hd <= 0.0 ) return;
	float xo = fz - 2.0 * floor( fz * 0.5 ), xp = floor( fz * 0.5 ), zo = fw - 2.0 * floor( fw * 0.5 ), zp = floor( fw * 0.5 );
	float m = vhSide( w.x - ( b.x - hw * ${XZ_UNIT} ), xo ) * vhSide( ( b.x + hw * ${XZ_UNIT} ) - w.x, xp )
	        * vhSide( w.z - ( b.y - hd * ${XZ_UNIT} ), zo ) * vhSide( ( b.y + hd * ${XZ_UNIT} ) - w.z, zp )
	        * step( 0.0, w.y - ( yl * ${Y_UNIT} - ${Y_BASE.toFixed(1)} ) ) * step( 0.0, ( yh * ${Y_UNIT} - ${Y_BASE.toFixed(1)} ) - w.y );
	if ( c >= ${(POOL_DECAY_MIN * 100).toFixed(1)} && m > 0.0 ) {
		float d2 = dot( lv, lv );
		float h = clamp( 1.0 - sqrt( d2 ) / vhPool.y, 0.0, 1.0 );
		float up = 1.0 - smoothstep( 0.35 * vhPool.w, vhPool.w, - ( lv * mat3( viewMatrix ) ).y );
		light.color = light.color * pow( d2 / ( d2 + vhPool.x * vhPool.x ), decay * 0.5 ) * up + lc * ( vhPool.z * h * h );
		light.visible = dot( light.color, vec3( 1.0 ) ) > 0.0;
	}
	light.color *= m;
	if ( m <= 0.0 ) light.visible = false;
}
`;
const MARK = 'RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );';
const SHADER_LIBS = ['lambert', 'phong', 'standard', 'physical', 'toon'];

let installed = false;
/** Patch three's light chunks so a tagged light is clipped to its box. Before any program compiles (three's program cache key does not
 *  include chunk text): environment.ts installSkyFog, the page's one early patch point, calls it. Idempotent; false (and the lights
 *  reach as far as their cutoff, as before) when three's chunk text is not the r169 text this was written against. */
export function installRoomClip(THREE: any): boolean {
  if (installed) return true;
  // ?no=roomclip: the A/B switch (the leak test measures the clip against no clip, and a page can run without it)
  try { if (typeof location !== 'undefined' && /[?&]no=[^&]*roomclip/.test(location.search)) return false; } catch { /* no location: Node */ }
  const C = THREE?.ShaderChunk;
  const begin: unknown = C?.lights_fragment_begin, pars: unknown = C?.lights_pars_begin;
  const once = (s: string, t: string) => s.split(t).length === 2;
  if (typeof begin !== 'string' || typeof pars !== 'string' || !once(begin, GEOM) || !once(begin, POINT_INFO) || !once(begin, SPOT_INFO)
    || !pars.includes('getPointLightInfo') || !SHADER_LIBS.every(k => THREE.ShaderLib?.[k]?.uniforms)) {
    console.warn('installRoomClip: three\'s light chunks are not the expected r169 text; lights left unclipped');
    return false;
  }
  // on the side, then taken over only if all of it applied
  let text = begin.replace(GEOM, WORLD)
    .replace(POINT_INFO, `${POINT_INFO}\n\t\tvhRoomClip( pointLight.decay, vhWorld, directLight, pointLight.position - geometryPosition, pointLight.color );`)
    .replace(SPOT_INFO, `${SPOT_INFO}\n\t\tvhRoomClip( spotLight.decay, vhWorld, directLight, spotLight.position - geometryPosition, spotLight.color );`);
  // BRDF only where a light reaches (the spot and point loops come before the directional one). A light a fragment is clipped from, or one at
  // intensity 0 (a room light under the v2 policy, fixtures.ts __fillZero), adds exactly +0, so the picture is the same bit for bit; without the
  // branch sixteen of them cost sixteen Lambert + GGX evaluations a fragment for nothing. light-guard.ts does this for the live player;
  // wrapping again there is harmless (the text it looks for is still there, twice).
  const cut = text.indexOf('#if ( NUM_DIR_LIGHTS > 0 )');
  if (cut > 0) text = text.slice(0, cut).split(MARK).join(`if ( directLight.visible ) { ${MARK} }`) + text.slice(cut);
  for (const k of SHADER_LIBS) { THREE.ShaderLib[k].uniforms.vhClip = { value: CLIP_DATA }; THREE.ShaderLib[k].uniforms.vhPool = { value: POOL_DATA }; }
  C.lights_pars_begin = pars + DECL;
  C.lights_fragment_begin = text;
  installed = true;
  return true;
}
export const roomClipInstalled = (): boolean => installed;
