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
type Orig = { transmission: number; opacity: number; color: [number, number, number]; userOrigOpacity?: number };

// The one fixed setting. (material.envMapIntensity would be no lever: r169 takes a scene.environment's strength from
// scene.environmentIntensity and ignores the material's.)
const MIN_OPACITY = 0.4;
const TINT = 0.4;

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
    m.needsUpdate = true;
  };
  const unswap = (m: any) => {
    const ud = m.userData, o: Orig | undefined = ud && ud.__glassOrig;
    if (!o) return;
    m.transmission = o.transmission; m.opacity = o.opacity; m.color.setRGB(o.color[0], o.color[1], o.color[2]);
    if (ud.orig && o.userOrigOpacity !== undefined) ud.orig.opacity = o.userOrigOpacity;
    delete ud.__glassOrig;
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
      each(m => { if (m.isMeshPhysicalMaterial && m.transmission > 0 && !(m.userData && m.userData.__glassOrig)) swap(m); });
    },
    get swapped() { return swapped; },
  };
}
