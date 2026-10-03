// Architecture materials — S2's claddings, floors, wall and ceiling finishes, drawn from the house's material kit.
//
// S1 owns the kit (materials.ts, textures.ts). The plan's contract is `kit.cladding({ kind, color })` cached by (kind,
// colour) and `kit.finish(kind, { color, pattern, scale })`; until S1 ships them, this module builds the same thing from
// the kit's own texture library (`kit.textures.set(kind, opts)`, seeded by the house id) with the kit's PBR recipe, and
// prefers S1's functions the moment they exist (`kit.claddingFor`, `kit.finish`). Nothing here runs for a house that
// asks for no S2 field, so no material is created out of the v1 order.
//
// Materials are cached per kit — one per (what, options) — except where a caller needs its own (a roof part: the roof
// fade writes to every material under a registered roof, so roofs take clones).
//
// Owner: S2 (architecture).
import { worldUV } from './textures.js';

const hexOf = (c: any, d: number) => (c === undefined || c === null ? d : typeof c === 'number' ? c : parseInt(String(c).replace('#', ''), 16));
const caches = new WeakMap<object, Map<string, any>>();

// the finish kinds S1's kit.finish (materials.ts FINISHES) makes; any other kind this module builds itself
const KIT_FLOORS = new Set(['oak', 'honey-oak', 'walnut', 'cherry', 'white-oak', 'grey-wash', 'herringbone', 'tile', 'hex-tile', 'checker', 'terracotta', 'pavers', 'concrete', 'carpet', 'marble', 'terrazzo']);
const KIT_WALLS = new Set(['paint', 'painted-brick', 'wallpaper', 'brick', 'stone', 'timber']);

export function createArchMaterials(THREE: any, kit: any) {
  let cache = caches.get(kit);
  if (!cache) { cache = new Map(); caches.set(kit, cache); }
  const once = (key: string, make: () => any) => { if (!cache.has(key)) cache.set(key, make()); return cache.get(key); };
  // the kit's pbr(): a fresh MeshStandardMaterial over a texture set, mapped in world metres
  const pbr = (set: any, { mode = 'auto', rotation = 0, macro = 0, ...extra }: any = {}) => {
    const mat = new THREE.MeshStandardMaterial({
      color: 0xffffff, map: set.map, normalMap: set.normalMap, roughnessMap: set.roughnessMap, roughness: 1, metalness: set.metalness,
      normalScale: new THREE.Vector2(set.normalScale, set.normalScale), ...extra,
    });
    worldUV(THREE, mat, { period: set.period, mode, rotation, macro, macroMean: set.mean });
    mat.userData.surface = set.kind;
    return mat;
  };
  const lib = kit && kit.textures;
  const setOf = (kind: string, opts: any) => (lib && typeof lib.set === 'function' ? lib.set(kind, opts) : null);
  const plain = (color: number, extra: any = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.85, ...extra });

  // ---- exterior cladding: { kind, color } → the wall's outward face (userData.cladding drives its trim style)
  const CLAD_SET = { stucco: 'stucco', siding: 'siding', brick: 'brick', stone: 'stone', timber: 'timber', corrugated: 'corrugated', 'board-and-batten': 'timber', concrete: 'concrete', shingle: 'siding' };
  function cladding({ kind = 'stucco', color = '#f1f5f9' }: any = {}) {
    if (kit && typeof kit.claddingFor === 'function') return kit.claddingFor({ kind, color });   // S1's, once it exists
    const c = hexOf(color, 0xf1f5f9), k = CLAD_SET[kind] ? kind : 'stucco';
    return once(`clad:${k}:${c}`, () => {
      const set = k === 'concrete' ? setOf('concrete', { exterior: true, period: 2.4, joints: 1.2, color: c }) : setOf(CLAD_SET[k], { color: c });
      const mat = set ? pbr(set, { mode: 'auto' }) : plain(c);
      // the wall's trim style reads this: brick and stone take masonry heads and sills, stucco a band, the rest casings
      mat.userData.cladding = k === 'concrete' ? 'stucco' : k === 'board-and-batten' || k === 'shingle' ? (k === 'shingle' ? 'siding' : 'timber') : k;
      mat.userData.archKind = k;
      return mat;
    });
  }

  // ---- floors: kind + tone → a floor material (world-mapped; boards along `rotation`)
  const OAK = { oak: null, 'honey-oak': 0xb08653, walnut: 0x5e4533, cherry: 0x8c5139, 'white-oak': 0xc8b797, 'grey-wash': 0xa39c91 };
  function floor(f: any, { rotation = 0 }: any = {}) {
    const spec = typeof f === 'string' ? { kind: f } : f || {};
    const kind = spec.kind || 'oak';
    if (kit && typeof kit.finish === 'function' && KIT_FLOORS.has(kind)) { const m = kit.finish(kind, { color: spec.color, color2: spec.color2, pattern: spec.pattern, scale: spec.scale, rotation }); if (m) return m; }
    const c = spec.color !== undefined ? hexOf(spec.color, 0) : undefined;
    return once(`floor:${kind}:${c}:${spec.scale}:${rotation.toFixed(3)}`, () => {
      if (kind in OAK) return kit.floor('oak', { rotation, ...((c ?? OAK[kind]) != null ? { color: c ?? OAK[kind] } : {}) });
      if (kind === 'herringbone' || kind === 'chevron') return kit.floor('herringbone', { ...(c != null ? { color: c } : {}) });
      const tile = (o: any) => { const set = setOf('tile', o); return set ? pbr(set, { mode: 'auto', rotation }) : plain(o.color || 0xd5cec3); };
      if (kind === 'tile') return tile({ ...(c != null ? { color: c } : {}), size: spec.scale || 0.6 });
      if (kind === 'hex-tile') return tile({ color: c ?? 0xe4ded3, size: spec.scale || 0.2, grout: 0.002 });
      if (kind === 'checker') return tile({ color: c ?? 0xdedad2, size: spec.scale || 0.3, groutColor: 0x3a3a38, grout: 0.006 });
      if (kind === 'terracotta') return tile({ color: c ?? 0xb3694a, size: spec.scale || 0.3, groutColor: 0xc9b7a3, grout: 0.006 });
      if (kind === 'stone') return tile({ color: c ?? 0xcfc6b6, size: spec.scale || 0.6 });
      if (kind === 'pavers') return tile({ color: c ?? 0xb8b2a7, size: spec.scale || 0.4, groutColor: 0x8d877d, grout: 0.008 });
      if (kind === 'slate') return tile({ color: c ?? 0x4d5359, size: spec.scale || 0.45, groutColor: 0x2e3237 });
      if (kind === 'carpet') return plain(c ?? 0xb9ae9c, { roughness: 1 });
      if (kind === 'concrete' || kind === 'marble' || kind === 'terrazzo' || kind === 'phthalo-terrazzo' || kind === 'charcoal-terrazzo' || kind === 'deck') return kit.floor(kind, { ...(c != null ? { color: c } : {}) });
      return kit.floor('oak', { rotation });
    });
  }

  // ---- a room's wall surface: paint, plaster, brick, stone, concrete, shiplap, timber, tile (wainscot and
  // board-and-batten are paint plus geometry: room-finish.ts)
  function wall(kind = 'paint', color?: any) {
    const c = hexOf(color, 0xf1eee8);
    if (kit && typeof kit.finish === 'function' && KIT_WALLS.has(kind)) { const m = kit.finish(kind, { color: c }); if (m) return m; }
    return once(`wall:${kind}:${c}`, () => {
      if (kind === 'painted-brick') { const set = setOf('brick', { color: c }); return set ? pbr(set, { mode: 'auto' }) : plain(c); }
      if (kind === 'brick') { const set = setOf('brick', { color: color !== undefined ? c : 0x9a5a44 }); return set ? pbr(set, { mode: 'auto' }) : plain(c); }
      if (kind === 'stone') { const set = setOf('stone', { color: color !== undefined ? c : 0xb9b1a4 }); return set ? pbr(set, { mode: 'auto' }) : plain(c); }
      if (kind === 'concrete') { const set = setOf('concrete', { color: color !== undefined ? c : 0xa9a49c }); return set ? pbr(set, { mode: 'auto' }) : plain(c); }
      if (kind === 'shiplap') { const set = setOf('siding', { color: c }); return set ? pbr(set, { mode: 'auto' }) : plain(c); }
      if (kind === 'timber') { const set = setOf('timber', { color: color !== undefined ? c : 0x9c7f62 }); return set ? pbr(set, { mode: 'auto' }) : plain(c); }
      if (kind === 'tile') { const set = setOf('tile', { color: c, size: 0.15, grout: 0.002 }); return set ? pbr(set, { mode: 'auto' }) : plain(c); }
      return plain(c, { roughness: kind === 'plaster' ? 0.95 : 0.8 });
    });
  }

  // ---- ceilings: plain paint or timber boards
  function ceiling(kind = 'flat', color?: any) {
    const c = hexOf(color, 0xf1f5f9);
    return once(`ceil:${kind}:${c}`, () => {
      if (kind === 'timber') { const set = setOf('oak', { color: color !== undefined ? c : 0xa88660 }); const m = set ? pbr(set, { mode: 'auto', side: THREE.DoubleSide }) : plain(c, { side: THREE.DoubleSide }); return m; }
      return plain(c, { side: THREE.DoubleSide, roughness: 0.9 });
    });
  }

  // ---- trim and small parts: a painted colour (cached)
  const paint = (color: any, extra: any = {}) => once(`paint:${hexOf(color, 0xffffff)}:${JSON.stringify(extra)}`, () => plain(hexOf(color, 0xffffff), extra));
  // a private copy (roofs: the fade writes to it)
  const own = (m: any) => { const c = m.clone(); if (m.onBeforeCompile) c.onBeforeCompile = m.onBeforeCompile; if (Object.prototype.hasOwnProperty.call(m, 'customProgramCacheKey')) c.customProgramCacheKey = m.customProgramCacheKey; return c; };

  return { cladding, floor, wall, ceiling, paint, own, plain, pbr, setOf, hexOf };
}
export type ArchMaterials = ReturnType<typeof createArchMaterials>;
