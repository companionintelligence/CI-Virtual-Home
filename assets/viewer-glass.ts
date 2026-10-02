// The player's glass: panes without the transmission pass.
//
// Every glass builder in the page (windows, balustrades, shower screens, greenhouses, the roofs' skylights, build-
// context.ts's glassMat) makes a MeshPhysicalMaterial with `transmission` 0.6 to 0.92. In three r169 a scene with one
// transmissive mesh draws its opaque objects a second time into a full-size half-float 4x-MSAA target (mip-mapped, with
// the back faces of the panes drawn again), which halves the frame rate of a glass-heavy house on a real GPU (a house
// has 10 to 65 panes). Best quality (the recorder's composer), the films, the stills and the goldens need that look
// and keep it; the live plain path does not need a refracted picture of the room, only a pane that reads as glass.
//
// So the player swaps, once, on every material it finds with transmission > 0: transmission 0 (the builders are not
// touched, which would move every golden), the colour darkened and the opacity raised to a floor. Without the
// transmitted picture a pane's tint is its lit diffuse colour blended over the scene, which reads as a pale haze; the
// transmissive pane's tint was the scene seen through the colour, which only ever darkens. Scaling the colour by
// TINT and lifting faint panes to MIN_OPACITY puts the mean brightness of a pane back within about 0.5 grey levels of
// the transmissive one at day and dusk (stills of lakecabin and aurora, orbit and interior; see the commit message),
// with the pane's own reflections (specular, the sky in the environment) unchanged. It puts the originals back for
// Best quality and for anything drawn through the page's __houseRender* hooks (viewer.beforeExternalRender), and
// swaps again after.
//
// The originals live on the material's own userData (`__glassOrig`), not in a WeakMap: applyHouseGlow clones a pane's
// material into its "window glow" twin at every lighting change, and a clone carries userData, so a twin made while
// the swap is on knows how to go back. sync() finds those (and any pane a house build added) after a lighting change
// or a load. A flip is a program change (USE_TRANSMISSION), so nothing flips per frame: apply() / restore() are
// called on a state change only, and they do nothing when the state already is what is asked.
//
// Fresnel (added with the sky, assets/viewer-sky.ts). A flat tint reads as a veil: the same at every angle, with the
// reflection only as strong as the pane's alpha lets it be. Real glass is clear head-on and a mirror at a grazing
// angle, so the swapped pane's fragment shader raises its alpha toward 1 with Schlick's (1 - cos)^5 and darkens its
// diffuse part as it goes: the reflection of the sky in the environment (which the BRDF already makes strong at
// grazing) then shows at full strength where the view skims the pane, and the body colour is a little deeper where
// the path through the glass is longest. Head-on (cos near 1) the term is zero and the picture is the committed
// swap's, so the mean brightness measured there does not move. It is a patch on the swapped material
// (onBeforeCompile + customProgramCacheKey, undone by restore()), so the originals, the builders and every offline
// frame are untouched, and `?no=glass` leaves all of it off.
type Orig = { transmission: number; opacity: number; color: [number, number, number]; userOrigOpacity?: number };

// The one fixed setting. (material.envMapIntensity would be no lever: r169 takes a scene.environment's strength from
// scene.environmentIntensity and ignores the material's.)
const MIN_OPACITY = 0.4;
const TINT = 0.4;
// Fresnel look (GLSL constants, see patchFresnel): how far alpha is pulled to 1 at a full grazing angle, how much of the
// diffuse part is taken away there, and the exponent (Schlick's is 5; 3 lets the effect start earlier, so an oblique
// orbit view of a window already shows the sky in it, while head-on, cos > 0.8, it is still under 1 per cent).
const FRESNEL_ALPHA = 0.9;
const FRESNEL_DARK = 0.4;
const FRESNEL_POW = 3.0;

// Which materials carry the patch, and what they had of their own to put back.
type Saved = { obc?: any; key?: any };
const patched = new WeakMap<object, Saved>();
const hasOwn = (o: object, k: string) => Object.prototype.hasOwnProperty.call(o, k);

function fresnelChunk(): string {
  return `
	{
		float gfCos = clamp( abs( dot( normalize( normal ), normalize( vViewPosition ) ) ), 0.0, 1.0 );
		float gfF = pow( 1.0 - gfCos, ${FRESNEL_POW.toFixed(1)} );
		// a pane the roof fade is dissolving (opacity under ~0.15) must stay dissolving
		float gfLive = smoothstep( 0.12, 0.34, diffuseColor.a );
		diffuseColor.a = mix( diffuseColor.a, 1.0, clamp( gfF * ${FRESNEL_ALPHA.toFixed(2)} * gfLive, 0.0, 1.0 ) );
		outgoingLight -= totalDiffuse * ( gfF * ${FRESNEL_DARK.toFixed(2)} * gfLive );
	}
	#include <opaque_fragment>`;
}

// Chain the fresnel patch after whatever the material already compiles with.
function patchFresnel(m: any) {
  if (patched.has(m)) return;
  const saved: Saved = {};
  if (hasOwn(m, 'onBeforeCompile')) saved.obc = m.onBeforeCompile;
  if (hasOwn(m, 'customProgramCacheKey')) saved.key = m.customProgramCacheKey;
  const prevObc = m.onBeforeCompile, prevKey = m.customProgramCacheKey;
  patched.set(m, saved);
  m.onBeforeCompile = function (shader: any, renderer: any) {
    prevObc.call(this, shader, renderer);
    if (!shader.fragmentShader.includes('#include <opaque_fragment>')) return;
    shader.fragmentShader = shader.fragmentShader.replace('#include <opaque_fragment>', fresnelChunk());
  };
  // three keys its program cache by the text of onBeforeCompile; give the patched pane its own key (plus the old one)
  m.customProgramCacheKey = function () { return `${prevKey.call(this)}|glass-fresnel-${FRESNEL_POW}-${FRESNEL_ALPHA}-${FRESNEL_DARK}`; };
}
function unpatchFresnel(m: any) {
  const saved = patched.get(m);
  if (!saved) return;
  patched.delete(m);
  if ('obc' in saved) m.onBeforeCompile = saved.obc; else delete m.onBeforeCompile;
  if ('key' in saved) m.customProgramCacheKey = saved.key; else delete m.customProgramCacheKey;
}

export type GlassSwap = { apply(): void; restore(): void; sync(): void; readonly swapped: boolean };

export function createGlassSwap(_THREE: any, scene: any, enabled = true): GlassSwap {
  let swapped = false;   // the state the scene's panes are in (true: the plain path's opaque-pass glass)

  const each = (fn: (m: any) => void) => {
    const seen = new Set<any>();
    scene.traverse((o: any) => {
      if (!o.isMesh || !o.material) return;
      for (const m of Array.isArray(o.material) ? o.material : [o.material]) if (m && !seen.has(m)) { seen.add(m); fn(m); }
    });
  };
  const swap = (m: any) => {
    const ud = m.userData || (m.userData = {});
    const o: Orig = { transmission: m.transmission, opacity: m.opacity, color: [m.color.r, m.color.g, m.color.b] };
    // the roofs' fade rewrites opacity from userData.orig.opacity every frame (visibility.ts setRoofOpacity): move that too
    if (ud.orig && typeof ud.orig.opacity === 'number') o.userOrigOpacity = ud.orig.opacity;
    ud.__glassOrig = o;
    m.transmission = 0;
    // a faint pane gets a firmer tint; water (0.75+) and anything already firm is left as authored
    if (m.opacity < MIN_OPACITY) { const k = MIN_OPACITY / m.opacity; m.opacity = MIN_OPACITY; if (ud.orig && o.userOrigOpacity !== undefined) ud.orig.opacity = o.userOrigOpacity * k; }
    m.color.multiplyScalar(TINT);
    patchFresnel(m);
    m.needsUpdate = true;
  };
  const unswap = (m: any) => {
    const ud = m.userData, o: Orig | undefined = ud && ud.__glassOrig;
    if (!o) return;
    m.transmission = o.transmission; m.opacity = o.opacity; m.color.setRGB(o.color[0], o.color[1], o.color[2]);
    if (ud.orig && o.userOrigOpacity !== undefined) ud.orig.opacity = o.userOrigOpacity;
    delete ud.__glassOrig;
    unpatchFresnel(m);
    m.needsUpdate = true;
  };

  return {
    // swap every pane in the scene (and turn the swap on for the panes a later sync() finds)
    apply() {
      if (!enabled) return;
      swapped = true;
      each(m => { if (m.isMeshPhysicalMaterial && m.transmission > 0 && !(m.userData && m.userData.__glassOrig)) swap(m); });
    },
    restore() {
      if (!swapped) return;
      swapped = false;
      each(unswap);
    },
    // after a lighting change or a load: panes made since the last call (glow twins cloned from a swapped pane
    // carry the marker and the swapped values already; a twin cloned while restored is transmissive and is swapped
    // here only if the swap is on)
    sync() {
      if (!enabled || !swapped) return;
      each(m => {
        if (!m.isMeshPhysicalMaterial) return;
        if (m.transmission > 0 && !(m.userData && m.userData.__glassOrig)) swap(m);
        // a window-glow twin is a clone of a swapped pane: it has the swapped values (userData is deep-copied) but not the
        // patch, which a clone does not carry
        else if (m.userData && m.userData.__glassOrig && !patched.has(m)) { patchFresnel(m); m.needsUpdate = true; }
      });
    },
    get swapped() { return swapped; },
  };
}
