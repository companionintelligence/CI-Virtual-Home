// Material kit — the layer between a HouseSpec's palette and the meshes.
//
// Every spec authors { wall, trim, roof, accent, material } and until now only wall and trim were read: the
// catalog's 56 builders painted one slate palette into every house. The kit compiles the palette (plus a seeded
// pick from curated sets, so two houses with similar palettes still differ) into
//   colors   — role colours: fabric, fabric2, wood, cabinet, rug, accent, linen, metal
//   cladding — a world-mapped PBR exterior material for palette.material (brick, siding, stucco, stone, timber,
//              corrugated), tinted by palette.wall
//   theme(obj) — recolours a built prop by role: the catalog's colour literals are the role keys; every other
//              saturated colour on a themed prop is pulled toward restraint
//   floor(name) / surface(name) / roofMaterial(type, color) — PBR materials (albedo + normal + roughness from
//              assets/textures.ts) mapped in world metres, so tiling scale is physical on any slab or roof.
//              They survive clone(): a consumer may copy one (a fade, a roof builder's own()) and get a working
//              material, mapping and all
//   surfaceColor(name) — a surface's mean albedo, for flat material that must blend into it (a horizon disc)
//   water({ opaque }) — pool / pond water; mute() swaps any saturated-aqua material on a site asset for it
// Everything is seeded from the house id (mulberry32), so frames stay deterministic.
import { createTextureLibrary, worldUV } from './textures.js';

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
export function fnv1a(str) { let h = 0x811c9dc5; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193); } return h >>> 0; }

const hex = c => typeof c === 'string' ? parseInt(c.replace('#', ''), 16) : c;
const toRgb = c => [(c >> 16) & 255, (c >> 8) & 255, c & 255];
const fromRgb = ([r, g, b]) => (Math.round(Math.max(0, Math.min(255, r))) << 16) | (Math.round(Math.max(0, Math.min(255, g))) << 8) | Math.round(Math.max(0, Math.min(255, b)));
const mix = (a, b, t) => { const A = toRgb(a), B = toRgb(b); return fromRgb([A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t]); };
const lum = c => { const [r, g, b] = toRgb(c); return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255; };
const css = c => '#' + c.toString(16).padStart(6, '0');
// Restraint: compress HSL saturation above `sMax` to `keep` of its excess, moving toward the grey of the SAME
// luma — a lemon wall becomes cream, not khaki; a teal becomes a grey-teal; a colour already muted is untouched.
const restrain = (c, sMax = 0.3, keep = 0.4) => {
  const [r, g, b] = toRgb(hex(c)).map(x => x / 255);
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, d = mx - mn;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  if (s <= sMax) return hex(c);
  const k = (sMax + (s - sMax) * keep) / s, Y = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return fromRgb([r, g, b].map(x => (Y + (x - Y) * k) * 255) as [number, number, number]);
};
export const colourMath = { hex, mix, lum, css, toRgb, fromRgb, restrain };

// The palette as the house is built: saturated walls and roofs are pulled toward restraint (colour comes from
// light, not paint — a yellow house reads cream, a terracotta roof reads fired clay, not traffic cone).
// Trim and accent pass through (the accent is restrained where the kit uses it). Painted walls are held to the
// greige band Pascal's houses live in (lemon #fef08a builds #f2edc9, adobe #d4a373 builds #bea790); brick keeps
// more of its colour, because red is what fired clay is, not a paint choice.
export function restrainPalette(p: any = {}) {
  const out = { ...p };
  if (p.wall) out.wall = css(p.material === 'brick' ? restrain(p.wall, 0.3, 0.35) : restrain(p.wall, 0.18, 0.2));
  if (p.interior) out.interior = css(restrain(p.interior, 0.15, 0.25));
  if (p.roof) out.roof = css(restrain(p.roof, 0.28, 0.4));
  return out;
}

// Curated sets the rng picks from — muted product-render colours (linen, oatmeal, stone, sage, ink), picked
// against the palette's accent so the house reads as one scheme.
const FABRICS = [0x3f4650, 0x8b8a86, 0x7b8268, 0x9a7d6e, 0x3f4b5c, 0xb6a78e, 0x8a978f, 0xa39a8b, 0x6b7078, 0xcdc6ba];
const WOODS = [0x5b4636, 0x9c7f62, 0xc4b19a, 0x7d6147, 0x2e2622, 0x6f5a48];
const CABINETS = [0x24272b, 0xefede8, 0x8b978e, 0x3a4656, 0x8a8580, 0x3f3a33, 0xdcd7cf];

// colour literal → role. Anything the catalog paints with one of these is a role, not a colour.
const ROLE_OF = new Map([
  [0x334155, 'fabric'], [0x475569, 'fabric2'], [0x0c323c, 'fabric2'], [0x64748b, 'fabric2'],
  [0x452818, 'wood'], [0x78350f, 'wood'], [0x3e2723, 'wood'], [0x5a3e2b, 'wood'], [0x5e3f25, 'wood'], [0x7a5535, 'wood'], [0x92400e, 'wood'],
  [0x0f172a, 'cabinet'], [0x1e293b, 'cabinet'],
  [0x073038, 'rug'], [0x0f766e, 'accent'], [0x0d9488, 'accent'],
]);

// ---- PBR vocabularies ----------------------------------------------------------------------------------------
// floor name (HOUSE-SPEC level `floor`) → texture set
const PHTHALO = { color: 0x041620, chips: [0xc5e8dc, 0x00a9a7, 0x0a6358, 0x72ddd4, 0xe8f2f4, 0x073038] };   // the CI dark terrazzo
const CHARCOAL = { color: 0x22272d, chips: [0xe7e5e4, 0x94a3b8, 0xa8a29e, 0x64748b, 0x3a4450] };
const FLOORS = {
  oak: ['oak', {}], wood: ['oak', {}], planks: ['oak', {}],
  herringbone: ['herringbone', {}], 'oak-herringbone': ['herringbone', {}], parquet: ['herringbone', {}],
  tile: ['tile', {}], porcelain: ['tile', {}], stone: ['tile', { color: 0xcfc6b6, size: 0.6 }],
  marble: ['marble', {}], 'carrara-marble': ['marble', {}],
  concrete: ['concrete', {}], 'polished-concrete': ['concrete', {}],
  terrazzo: ['terrazzo', {}], 'phthalo-terrazzo': ['terrazzo', PHTHALO], 'charcoal-terrazzo': ['terrazzo', CHARCOAL],
  deck: ['deck', {}]
};
// oak tones the house picks from: natural, white oak, smoked, light. Greige, hue ~38° (yellow-brown), not the
// ~30° peach that warm key light pushes toward salmon; the grain, not the base colour, carries the wood.
const OAK_TONES = [0x9e8f77, 0xaa9f8a, 0x877a66, 0xb1a690];
// site surfaces (the lot ground, paving, the street) → texture set + mapping options
const SURFACES = {
  lawn: ['lawn', {}, { macro: 0.25 }], grass: ['lawn', {}, { macro: 0.25 }], waterfront: ['lawn', {}, { macro: 0.25 }],
  asphalt: ['asphalt', {}, { macro: 0.35 }], road: ['asphalt', {}, { macro: 0.35 }],
  // neutral cement greys (a hair cool, so warm key light lands them on stone, not sand); joints every 3 m on a
  // drive, 1.2 m pavers on a patio, 1.5 m sidewalk flags
  concrete: ['concrete', { exterior: true, period: 3, joints: 3, color: 0xa5a4a0 }, {}], driveway: ['concrete', { exterior: true, period: 3, joints: 3, color: 0xa2a19d }, {}],
  patio: ['concrete', { exterior: true, period: 2.4, joints: 1.2, color: 0xaeaca7 }, {}],
  sidewalk: ['concrete', { exterior: true, period: 1.5, joints: 1.5, color: 0xadaca8 }, {}],
  curb: ['concrete', { exterior: true, period: 1.5, joints: 0, color: 0xbdbcb7 }, {}],
  steps: ['concrete', { exterior: true, period: 1.5, joints: 0, color: 0xa9a8a3 }, {}],
  urban: ['concrete', { exterior: true, period: 2, joints: 1, color: 0x9c9b97 }, {}],
  desert: ['sand', {}, { macro: 0.45 }], sand: ['sand', {}, { macro: 0.45 }],
  forest: ['litter', {}, { macro: 0.45 }]
};
// roof type (HOUSE-SPEC roof `type`) or finish name → roofing set; aframe-glass has none (the caller keeps glass)
const ROOF_KIND = {
  gable: 'asphalt-shingle', hip: 'asphalt-shingle', colonial: 'asphalt-shingle', mansard: 'asphalt-shingle', shingle: 'asphalt-shingle',
  shed: 'standing-seam', metal: 'standing-seam', butterfly: 'standing-seam',
  terracotta: 'clay-tile', tile: 'clay-tile', spanish: 'clay-tile',
  flat: 'membrane',
  'asphalt-shingle': 'asphalt-shingle', 'standing-seam': 'standing-seam', 'clay-tile': 'clay-tile', membrane: 'membrane'
};
const ROOF_COLOR = { 'asphalt-shingle': 0x2f2e2c, 'standing-seam': 0x3a3d40, 'clay-tile': 0xa8634a, membrane: 0x6f7378 };
// roof finishes (S2's roofs[].finish) → roofing sets
Object.assign(ROOF_KIND, { seam: 'standing-seam', slate: 'asphalt-shingle', shake: 'asphalt-shingle' });
// room finishes (kit.finish, plan S1) → texture set + options. Floors: the oaks, herringbone, tile (square, hex,
// checker), terracotta, stone pavers, concrete, carpet, marble, terrazzo. Walls: paint, painted brick, wallpaper
// (stripe, dot, botanical), wainscot, board and batten, and the exposed claddings.
export const FINISHES: Record<string, [string, any]> = {
  oak: ['oak', {}], 'honey-oak': ['oak', { color: 0xb38d5e }], walnut: ['oak', { color: 0x6a4b35 }], cherry: ['oak', { color: 0x8f553e }],
  'white-oak': ['oak', { color: 0xc4b596 }], 'grey-wash': ['oak', { color: 0xa39f96 }],
  herringbone: ['herringbone', {}], tile: ['tile', { size: 0.3 }], 'square-tile': ['tile', { size: 0.3 }], 'hex-tile': ['hextile', {}], 'checker-tile': ['checker', {}], checker: ['checker', {}],
  terracotta: ['terracotta', {}], pavers: ['pavers', {}], 'stone-pavers': ['pavers', {}], concrete: ['concrete', {}], carpet: ['carpet', {}],
  marble: ['marble', {}], terrazzo: ['terrazzo', {}],
  paint: ['paint', {}], 'painted-brick': ['paintedbrick', {}], wallpaper: ['wallpaper', {}], wainscot: ['wainscot', {}], 'board-and-batten': ['battens', {}],
  brick: ['brick', { color: 0xa0573f }], stone: ['stone', { color: 0xb3aa9b }], timber: ['timber', { color: 0x9c7f62 }],
};
export const FINISH_KINDS = Object.keys(FINISHES);

// The kit's options past the palette (kit-build.ts houseKit passes them from the spec; the prop sheet and the
// catalog pass none, which is today's kit):
//   keep       palette.keep's roles: 'accent' keeps the accent role unrestrained, 'roof' a roof colour exactly (no
//              restraint, no charcoal pull)
//   defaults   specDefaults(spec): under 2 the seeded wood, fabric and cabinet roles are lifted to luma ≥ 0.12 (no
//              accidental black or navy), and a roof is pulled toward charcoal only when it has no colour of its own
//   roofPull   palette.roofPull: false turns the charcoal pull off for every roof
//   roofColors the spec's explicit roofs[].color values (0xRRGGBB), which is how roofMaterial(type, color) — the
//              call roofs.ts makes with a colour whether authored or its type's default — tells the two apart
export function createMaterialKit({ THREE, palette = {}, seed = 'house', keep = [], defaults = 1, roofPull = true, roofColors = [] }: { THREE: any; palette?: any; seed?: string; keep?: string[]; defaults?: number; roofPull?: boolean; roofColors?: number[] } = {} as any) {
  const rng = mulberry32(fnv1a(String(seed)));
  const pick = arr => arr[Math.floor(rng() * arr.length)];
  const keeps = new Set(keep || []), d2 = defaults >= 2;
  const lift = c => { if (!d2) return c; let x = c; for (let k = 0; k < 12 && lum(x) < 0.12; k++) x = mix(x, 0xffffff, 0.12); return x; };
  const wall = hex(palette.wall || '#f1f5f9'), trim = hex(palette.trim || '#1e293b'), accent = hex(palette.accent || '#0f766e'), roof = hex(palette.roof || '#334155');
  // fabric: half the time the accent (muted), else a curated pick; the second fabric always differs from the first
  const accentMuted = restrain(mix(accent, 0x6b7280, 0.45), 0.2, 0.3);
  const fabric = lift(rng() < 0.5 ? accentMuted : pick(FABRICS));
  let fabric2 = pick(FABRICS); if (fabric2 === fabric) fabric2 = mix(fabric, 0xffffff, 0.35);
  fabric2 = lift(fabric2);
  const wood = lift(pick(WOODS));
  const cabinet = lift(pick(CABINETS));
  const rug = mix(restrain(accent, 0.2, 0.3), 0x7a746c, 0.55);
  const colors = { wall, trim, accent: keeps.has('accent') ? accent : restrain(accent, 0.18, 0.2), roof, fabric, fabric2, wood, cabinet, rug, linen: 0xf2efe9, metal: 0x2b2f33 };

  // ---- textures: one library per house, seeded by its id; sets are cached per (kind, options)
  const lib = createTextureLibrary({ THREE, rngFor: key => mulberry32(fnv1a(`${seed}:${key}`)) });
  const oakTone = OAK_TONES[Math.floor(mulberry32(fnv1a(`${seed}:oak-tone`))() * OAK_TONES.length)];
  // a fresh material per call (roof fades and wall modes act per material), textures shared
  function pbr(set, { mode = 'auto', rotation = 0, macro = 0, scale = 1, offset = [0, 0], ...extra }: any = {}) {
    const mat = new THREE.MeshStandardMaterial({
      color: 0xffffff, map: set.map, normalMap: set.normalMap, roughnessMap: set.roughnessMap, roughness: 1, metalness: set.metalness,
      normalScale: new THREE.Vector2(set.normalScale, set.normalScale), ...extra
    });
    worldUV(THREE, mat, { period: scale === 1 ? set.period : set.period.map(p => p * scale), mode, rotation, macro, macroMean: set.mean, ...(offset[0] || offset[1] ? { offset } : {}) });
    mat.userData.surface = set.kind;
    return mat;
  }

  // ---- cladding: a seeded PBR set per kind, tinted by the wall colour, mapped in world units on each face's
  // own plane (so piers and lintels of any size share one continuous surface, and a cut wall never stretches)
  // kit.cladding() is the house's own (palette.material in palette.wall); kit.cladding({ kind, color }) is one
  // cached per (kind, colour) — a storey's own (levels[].material / wallColor), S2's volumes and facade zones. A pair
  // that IS the house's gets the house's material, so a storey that names the house's own cladding is not a seam.
  const CLAD = new Set(['brick', 'siding', 'stucco', 'stone', 'timber', 'corrugated']);
  let claddingMat = null;
  const claddings = new Map();
  const houseKind = () => (CLAD.has(palette.material) ? palette.material : 'stucco');
  function cladding(opts: any = palette.material || 'stucco') {
    if (opts && typeof opts === 'object') {
      const kind = CLAD.has(opts.kind) ? opts.kind : houseKind(), c = opts.color != null ? hex(opts.color) : wall;
      if (kind === houseKind() && c === wall) return cladding();
      const key = `${kind}:${c}`;
      if (claddings.has(key)) return claddings.get(key);
      const mat = pbr(lib.set(kind, { color: c }), { mode: 'auto' });
      mat.userData.cladding = kind;
      claddings.set(key, mat); return mat;
    }
    let kind = opts;
    if (claddingMat) return claddingMat;
    if (!CLAD.has(kind)) kind = 'stucco';
    const mat = pbr(lib.set(kind, { color: wall }), { mode: 'auto' });
    mat.userData.cladding = kind;
    claddingMat = mat; return mat;
  }

  // ---- floors: kit.floor(name, { rotation, color }) → material. Boards run along world Z (north–south) at
  // rotation 0; pass Math.PI / 2 to run them east–west. Herringbone is laid at 45°.
  function floor(name = 'oak', { rotation = null, color = null, ...extra }: any = {}) {
    if (name === 'grass' || name === 'lawn') return surface('lawn', extra);   // a lawn "floor" (a courtyard storey)
    const [kind, o] = FLOORS[name] || FLOORS.oak;
    const opts = color != null ? { ...o, color: hex(color) } : (kind === 'oak' ? { ...o, color: oakTone } : o);
    return pbr(lib.set(kind, opts), { mode: 'auto', rotation: rotation ?? (kind === 'herringbone' ? Math.PI / 4 : 0), ...extra });
  }

  // ---- site surfaces: kit.surface(name) → material (lawn, asphalt, concrete, driveway, patio, sidewalk, curb,
  // steps, urban, desert, forest). Unknown names fall back to lawn.
  function surface(name = 'lawn', { rotation = 0, ...extra }: any = {}) {
    const [kind, o, map] = SURFACES[name] || SURFACES.lawn;
    return pbr(lib.set(kind, o), { mode: 'auto', rotation, ...map, ...extra });
  }
  // the mean albedo of a surface, for anything that has to blend into it (a horizon disc, fog, a far lawn)
  function surfaceColor(name = 'lawn') { const [kind, o] = SURFACES[name] || SURFACES.lawn; return lib.set(kind, o).meanHex; }

  // ---- roofs: kit.roofMaterial(type, color, extra) → material, or null for glass roofs (the caller keeps
  // its own). `type` is a HOUSE-SPEC roof type (gable, hip → asphalt shingle; shed → standing seam; terracotta
  // → clay tile; flat → membrane) or a finish name. Mapped along each roof plane: courses run level with the
  // eave on gables, hips and sheds alike. `extra` is merged into the material (e.g. { side: THREE.DoubleSide }).
  // kit.roofMaterial({ finish, color, extra }) — S2's form: `finish` a roof finish (shingle, seam, tile, slate,
  // shake, membrane) or a roof type, `color` the roof's OWN colour or nothing. Under defaults 2 the charcoal pull
  // applies only to a roof with no colour of its own; palette.roofPull: false and palette.keep 'roof' turn it off.
  const explicitRoofs = new Set((roofColors || []).map(c => hex(c)));
  function roofMaterial(type: any = 'gable', color = null, extra: any = {}) {
    let own = color != null && explicitRoofs.has(hex(color));   // the positional call: authored, or its type's default?
    if (type && typeof type === 'object') { ({ finish: type = 'gable', color = null, extra = {} } = type); own = color != null; }
    if (type === 'aframe-glass' || type === 'glass') return null;
    const kind = ROOF_KIND[type] || 'asphalt-shingle';
    const c0 = hex(color ?? ROOF_COLOR[kind]);
    const kept = keeps.has('roof') && own;
    const pull = !kept && roofPull !== false && !(d2 && own);
    // fired clay, not traffic cone. Dark shingle, seam and membrane roofs lean to a neutral charcoal: a warm
    // brown #3f2a1d under a golden sun reads as milk chocolate, the same roof pulled toward #282b31 reads as the
    // near-black roofs of Pascal's streets. The target is a hair cool, so a golden key light lands it on
    // charcoal rather than brown. Light roofs (a white membrane, a pale metal) keep their colour.
    const dark = lum(c0) < 0.35;
    const c = kept ? c0
      : kind === 'clay-tile' ? (pull ? mix(restrain(c0, 0.22, 0.25), 0x3a3531, 0.12) : restrain(c0, 0.22, 0.25))
      : kind === 'membrane' ? (dark && pull ? mix(restrain(c0, 0.12, 0.3), 0x34363a, 0.4) : restrain(c0, 0.15, 0.3))
      : dark && pull ? mix(restrain(c0, 0.12, 0.3), kind === 'standing-seam' ? 0x31353b : 0x282b31, 0.42) : restrain(c0, 0.2, 0.35);
    const mat = pbr(lib.set(kind, { color: c }), { mode: 'slope', ...extra });
    mat.userData.roofKind = kind;
    return mat;
  }

  // ---- room finishes: kit.finish(kind, { color, pattern, scale, yBase, rotation }) → a floor or wall material
  // (S2's rooms[].floor / rooms[].walls). A fresh material a call, its maps shared per (kind, options) and seeded by
  // the house. `scale` multiplies the pattern's size; `yBase` puts a wainscot's rail at its height above that floor.
  function finish(kind = 'paint', { color = null, pattern = null, scale = 1, yBase = 0, rotation = 0, h = null, ...extra }: any = {}) {
    const f = FINISHES[kind === 'tile' && pattern && FINISHES[`${pattern}-tile`] ? `${pattern}-tile` : kind] || FINISHES.paint;
    const [gen, o0] = f;
    const o: any = { ...o0 };
    if (color != null) o.color = hex(color);
    if (pattern && gen === 'wallpaper') o.pattern = pattern;
    if (h != null && gen === 'wainscot') o.h = h;
    if (gen === 'oak' && o.color == null) o.color = oakTone;
    const set = lib.set(gen, o);
    return pbr(set, { mode: 'auto', scale, rotation: rotation || (gen === 'herringbone' ? Math.PI / 4 : 0), offset: gen === 'wainscot' ? [0, -yBase] : [0, 0], ...extra });
  }

  // legacy: the albedo of a kit floor (tile, deck, …) for code that only takes a texture
  function floorTexture(name) { const [kind, o] = FLOORS[name] || []; return kind ? lib.set(kind, o).map : null; }

  // ---- theme a built prop: every material whose colour is a role key takes the kit's colour for that role;
  // every other plain colour is pulled toward restraint (no primary-colour props)
  const seen = new WeakSet();
  const glows = mat => mat.emissive && mat.emissive.getHex() !== 0 && (mat.emissiveIntensity ?? 1) > 0;
  // once per material ever: a builder that caches its materials across houses must not be muted twice
  const muteMat = mat => { if (glows(mat) || mat.userData.muted) return; mat.color.setHex(restrain(mat.color.getHex(), 0.25, 0.2)); mat.userData.muted = true; };
  // ---- water: kit.water({ opaque }) → the house's pool / pond water, shared per house. A deep teal (Pascal's
  // pools read dark and blue-green, not swimming-pool-sign cyan), glossy, with a still, seeded ripple normal map
  // in world metres so the sky and the lamps break up in it. No transmission (no extra render pass). The opaque
  // variant is for a basin whose top face IS the water line (the page's pool slab hides its transparent sheet
  // 5 cm inside a solid box, so the box top is all a camera ever sees of that pool).
  const waterMats = new Map();
  function water({ opaque = false } = {}) {
    if (waterMats.has(opaque)) return waterMats.get(opaque);
    const set = lib.set('water', {});
    const common = { roughness: 0.05, metalness: 0, normalMap: set.normalMap, normalScale: new THREE.Vector2(set.normalScale, set.normalScale) };
    const mat = opaque
      ? new THREE.MeshStandardMaterial({ color: 0x1e5461, ...common })
      : new THREE.MeshPhysicalMaterial({ color: 0x184b57, transparent: true, opacity: 0.9, ior: 1.33, depthWrite: false, ...common });
    worldUV(THREE, mat, { period: set.period, mode: opaque ? 'auto' : 'plan' });
    mat.userData.surface = 'water';
    waterMats.set(opaque, mat);
    return mat;
  }
  // a saturated blue-to-cyan: the page's pool literals (0x06b6d4 water, 0x0284c7 basin, 0x38bdf8 mosaic, 0x0ea5e9)
  const isAqua = c => { const [r, g, b] = toRgb(c).map(x => x / 255), mx = Math.max(r, g, b), mn = Math.min(r, g, b); if (mx - mn < 0.3 || mx !== b && mx !== g) return false; const h = mx === b ? 240 + 60 * (r - g) / (mx - mn) : 120 + 60 * (b - r) / (mx - mn); return h >= 180 && h <= 215; };   // 180°+: the CI teal accent (175°) is not water
  // mute(obj): restraint only, no role mapping — for site assets (porch decks, pool basins, gazebos, palms)
  // whose dark literals are not furniture roles. Emissive and textured materials keep their colour. Anything
  // painted a saturated aqua is water: a transparent one takes kit.water(), an opaque one (a basin top, a
  // mosaic pool floor) kit.water({ opaque: true }).
  const muted = new WeakSet();
  function mute(obj) {
    obj.traverse(m => {
      if (!m.isMesh) return;
      const list = Array.isArray(m.material) ? m.material : [m.material];
      list.forEach((mat, i) => {
        if (!mat || !mat.color || mat.map || mat.userData.surface === 'water' || muted.has(mat) || seen.has(mat)) return;
        if (!glows(mat) && isAqua(mat.color.getHex())) {
          const w = water({ opaque: !mat.transparent });
          if (Array.isArray(m.material)) m.material[i] = w; else m.material = w;
          return;
        }
        muted.add(mat); muteMat(mat);
      });
    });
    return obj;
  }
  // theme(obj, { skip }): a material flagged userData.explicit (a colour the spec gave the item: kit-build.ts
  // themeItem under defaults 2) keeps it; every other role is themed as usual
  function theme(obj, { skip = false } = {}) {
    if (skip) return obj;
    obj.traverse(m => {
      if (!m.isMesh) return;
      for (const mat of (Array.isArray(m.material) ? m.material : [m.material])) {
        if (!mat || !mat.color || seen.has(mat) || mat.map || mat.userData.explicit) continue;
        seen.add(mat);
        const role = ROLE_OF.get(mat.color.getHex());
        if (!role) { if (!mat.transparent) muteMat(mat); continue; }
        if (role === 'cabinet' && (mat.metalness || 0) > 0.5) continue;   // metal legs and frames stay metal
        mat.color.setHex(colors[role]);
      }
    });
    return obj;
  }

  const itemRng = key => mulberry32(fnv1a(`${seed}:item:${key}`));   // a stream per prop instance
  return { rng, itemRng, colors, cladding, floor, surface, surfaceColor, roofMaterial, finish, water, floorTexture, theme, mute, textures: lib, css: c => css(c), defaults, keep: [...keeps] };
}
