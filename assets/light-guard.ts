// Cheap spot and point lights for the live player. three's lights_fragment_begin evaluates RE_Direct (the full
// Lambert + GGX) for EVERY spot and point light in EVERY fragment, even where getSpotLightInfo / getPointLightInfo
// have already said the fragment is outside the cone or the range (directLight.visible = false, colour 0). The
// term is then exactly +0, so a house with a dozen lamps pays a dozen BRDFs per pixel for nothing. This wraps the
// RE_Direct call of those two loops in `if ( directLight.visible )`: same picture, the BRDF only where a light
// reaches. The directional loop is left alone (its lights are always visible).
//
// LIVE PLAYER ONLY. It is called from room-creator.html under ?mode=view, before any material compiles (three's
// program cache key does not include chunk text, so a program compiled earlier would be reused unpatched). The
// editor, the offline recorder, the goldens, fixtures and thumbs never install it, so no product frame can move.
// `?no=lightguard` turns it off for A/B timing.

const MARK = 'RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );';
const GUARDED = `if ( directLight.visible ) { ${MARK} }`;

let done = false;

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
  C.lights_fragment_begin = head.split(MARK).join(GUARDED) + (src as string).slice(cut);
  done = true;
  return true;
}
