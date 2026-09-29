// Site primitives with seeded variation — the outdoors stops being axis-aligned rects and identical lollipops.
//
// Every site item gets its own seeded stream (house id + index), so planting varies house to house yet renders
// the same every run. New spec types (HOUSE-SPEC → Site):
//   bed      { type, poly: [[x,z],…] | at,w,d, plants: 'mixed'|'flowers'|'shrubs'|'grass', density }  planted bed on mulch
//   hedge    { type, path: [[x,z],…], h, w }                                                       clipped hedge along a polyline
//   path     { type, path: [[x,z],…], w, color }                                                   paved strip along a polyline
//   scatter  { type, at, r, n, species: ['shrub','rock','flowers',…] }                              seeded cluster in a disc
//   grove    { type, at, r, n, species }                                                           trees clustered with jitter
//   rock     { type, at, r }                                                                        one boulder
//   flowers  { type, at, r, color }                                                                a flowering clump
// and jitter on the old ones: tree, shrub, cypress, palm take seeded scale / lean / rotation / leaf colour unless
// `jitter: false`. The kit builds `cypress`, `palm` and `planter` itself too (house-builder asks it first), so every
// plant on the lot comes out of one vocabulary.
//
// Tree species (`tree.species`): broad | oval | layered | conical | columnar | palm | birch. The older names still
// work — round → broad, cypress → columnar. Unset, a tree picks one by seed, mostly broad and oval.
// Shrubs pick a form by seed (mound, boxwood, spreading, flowering, ornamental grass); `form` pins one.
//
// How a plant is made. A crown is not a few big blobs (from any distance they read as mossy boulders); it is a
// crowd of SMALL faceted leaf clusters — the way the crowns in pascalorg/plugin-trees read — scattered over the
// outer shell of a few ellipsoid lobes, round a dark core that keeps the sky from showing through the middle, and
// hung on a visible skeleton: a trunk that forks into limbs, one per lobe, with twigs out to the rim. Every cluster
// of a plant is one InstancedMesh (one draw call a crown), tinted per cluster from where it sits — shadowed low and
// deep inside, lit and a touch warmer high and outside — so the crown has depth without a texture. Conifers are
// whorls of flat, drooping branch sprays; the columnar cypress a flame of tight clusters; the palm a bent, ringed
// trunk under drooping pinnate fronds; the birch pale stems under an airy crown. Shrubs, bed plants and hedges use
// the same clusters, so everything green on the lot is made of the same stuff. Greens are deep and muted — the
// light supplies the colour, not the paint.
//
// Where there are many of one thing — leaf clusters, flower heads, the plants of a bed — they are InstancedMeshes of
// one shared variant (the plugin-trees pattern: one geometry per variant, a matrix per plant). Meshes the isometric
// twin should read as something other than their geometry type say so in `userData.isoShape`; parts it should not
// draw at all (limbs, crown cores, flower heads) carry `userData.iso = false`.
//
// The flower heads (daisy ring, tulip cup, lavender spike) and the grass tuft (flattened, leaning cones) are adapted
// from pascalorg/plugin-trees (MIT) — src/flower-geometry.ts and src/grass-geometry.ts — resized for our scale and
// merged by hand, since this module is plain ES and does not import BufferGeometryUtils.
import { mulberry32, fnv1a } from './materials.js';
import { createSpecies } from './site-species.js';
import { planPlanting, createSiteContext, SPECIES as PLANT_SPECIES } from './site-planting.js';
import { smoothLoop, smoothLine, tensionOf, offsetLoop, ccw, ribbon, lineNormals, resample, poisson, noisyLoop, rectPoly, dist, lengthOf, inPoly as inPolyG, bbox as bboxG, halfPlane, wobble } from './site-geom.js';

// ---- palettes: restrained, deep, muted --------------------------------------------------------------------------
const GREEN = {
  broad:    [0x3b5a2e, 0x42602f, 0x476534, 0x3a552f, 0x4c6936, 0x3f5d37],
  conical:  [0x2b4531, 0x2e4a34, 0x32503a, 0x294230],
  columnar: [0x2a4230, 0x2d4733, 0x314c36],
  birch:    [0x5a7140, 0x627843, 0x56703c],
  palm:     [0x415f31, 0x486535, 0x4c6637],
  shrub:    [0x3a5731, 0x42603a, 0x4a663b, 0x385235, 0x4f683d],
  grass:    [0x76824f, 0x6b7a47, 0x818a58],
};
const AUTUMN = [0xa35d2d, 0xb07836, 0x8c4b2b, 0x986733];
const BLOOM = [0xc46b7b, 0xd6a04b, 0xa18ac1, 0xebe6d8, 0xd595a6, 0xd6bf66, 0xb45a4b];
const BARK = 0x5a4a3d, CONIFER_BARK = 0x4a3b30, BIRCH_BARK = 0xe2ded5, PALM_BARK = 0x857059, MULCH = 0x42372e, KERB = 0x8a857b;
const PLANTER = 0x3d3b37;   // warm charcoal: a planter is furniture, not a colour
const ROCKS = [0x7a766f, 0x8a847b, 0x6d6a65, 0x9a948a];

// tree species: legacy names → the builder that draws them
const SPECIES = { round: 'broad', broad: 'broad', oval: 'oval', layered: 'layered', conical: 'conical', columnar: 'columnar', cypress: 'columnar', palm: 'palm', birch: 'birch',
  willow: 'willow', cherry: 'cherry', olive: 'olive', 'fan-palm': 'fan-palm', shade: 'shade', maple: 'layered' };
const SPECIES_H = { palm: 6, columnar: 4.2, willow: 7, cherry: 5, olive: 4, 'fan-palm': 6, shade: 9 };
const CHERRY = [0xd9a7b6, 0xe2b7c3, 0xcf98aa], OLIVE = [0x76855f, 0x7f8c66, 0x6f7d58], WILLOW = [0x8c9f4a, 0x97a950, 0x839644];
const DEFAULT_SPECIES = ['broad', 'broad', 'broad', 'oval', 'oval', 'conical', 'birch', 'layered'];
const FLOWER_KINDS = ['daisy', 'tulip', 'lavender', 'bloom', 'bloom'];
const PETAL = { daisy: [0xefeadb, 0xe8dcc0], tulip: [0xc46b7b, 0xd6a04b, 0xb45a4b, 0xd595a6], lavender: [0x8f7cb8, 0x9b88c0], bloom: BLOOM };

// The site types build() below answers (its switch's cases): the validator reads this list, so a type added to
// build() is added here too, or specs using it fail validation.
export const SITE_KIT_TYPES: readonly string[] = ['tree', 'cypress', 'palm', 'shrub', 'planter', 'flowers', 'rock', 'bed', 'path', 'hedge', 'scatter', 'grove', 'planting', 'climber', 'string-lights', 'pond', 'pergola'];
// the names each kit type accepts (the validator's site plugin warns on anything else)
export const TREE_SPECIES: readonly string[] = ['round', 'broad', 'oval', 'layered', 'conical', 'columnar', 'cypress', 'palm', 'birch', 'willow', 'cherry', 'olive', 'fan-palm', 'shade', 'maple'];
export const SHRUB_FORMS: readonly string[] = ['mound', 'boxwood', 'spreading', 'flowering', 'grass', 'hydrangea', 'fern', 'topiary-ball', 'topiary-cone', 'agave', 'yucca', 'columnar', 'rosemary', 'hosta', 'broadleaf', 'succulent', 'cactus', 'groundcover', 'silver', 'sedum'];
export const FLOWER_KINDS_ALL: readonly string[] = ['lavender', 'daisy', 'tulip', 'allium', 'rose', 'bloom', 'spike'];
export const PATH_SURFACES: readonly string[] = ['concrete', 'gravel', 'flagstone', 'stepping', 'brick', 'decking', 'terracotta'];

// `keepOut` is the ground storey's footprint ({ x, z, w, d } rects): the walls stand on its edge, and a bed plants
// nothing that would reach through them. `spec` (optional) gives the planting generator the lot it plants — the
// house, its paths, its terraces; `surface(name)` a ground material (the kit's lawn, litter, gravel …) for the
// generators' floors and path surfaces; `gen2` the spec's `defaults: 2` (the look-changing defaults: a true offset
// kerb on every bed, Poisson scatters, curved path ends).
export function createSiteKit({ THREE, seed = 'house', std, mix, keepOut = [], spec = null, surface = null, gen2 = false }: { THREE: any; seed?: string; std: any; mix?: any; keepOut?: any[]; spec?: any; surface?: any; gen2?: boolean }) {
  const hex = c => typeof c === 'string' ? parseInt(c.replace('#', ''), 16) : c;
  const group = name => { const g = new THREE.Group(); g.name = name; g.userData = { category: 'Site' }; return g; };
  const rngFor = (item, index) => mulberry32(fnv1a(`${seed}:site:${index}:${item.type}`));
  const pick = (r, arr) => arr[Math.floor(r() * arr.length)];
  const jitter = (r, base, amt) => base * (1 + (r() - 0.5) * 2 * amt);
  const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
  const box = (w, h, d, mat, x = 0, y = 0, z = 0, shadow = true) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); m.castShadow = shadow; m.receiveShadow = true; return m; };
  const UP = V(0, 1, 0);
  const clamp01 = v => Math.max(0, Math.min(1, v));
  const _col = new THREE.Color();
  const darker = (c, k) => _col.set(c).multiplyScalar(k).getHex();   // k in linear light: 0.4 is a deep shade

  // Materials are shared within one plant (a tree's clusters all use one leaf material) but never across plants:
  // the editor's swatch recolours a selected object's materials in place, and that must not repaint the street.
  function mats() {
    const cache = new Map();
    return (color, opts = {}) => { const k = color + ':' + JSON.stringify(opts); if (!cache.has(k)) cache.set(k, std(color, opts)); return cache.get(k); };
  }
  const leafOpts = { roughness: 0.9, flatShading: true, vertexColors: true };
  const barkOpts = { roughness: 0.95, flatShading: true };
  const coreOpts = { roughness: 1, flatShading: true };

  // ---- geometry helpers -----------------------------------------------------------------------------------------
  // A smooth, seeded lumpiness: a sum of plane waves in random directions. Continuous in position, so the vertices
  // a polyhedron duplicates per face (and a cone's seam) move together and the surface never cracks.
  function lumps(r, waves = 4, freq = 2.6) {
    const w = Array.from({ length: waves }, () => {
      const u = r() * 2 - 1, a = r() * Math.PI * 2, s = Math.sqrt(1 - u * u);
      return { x: s * Math.cos(a), y: u, z: s * Math.sin(a), f: freq * (0.7 + r() * 0.6), p: r() * Math.PI * 2 };
    });
    return (x, y, z) => { let s = 0; for (const k of w) s += Math.sin((k.x * x + k.y * y + k.z * z) * k.f + k.p); return s / Math.sqrt(waves); };
  }
  // Per-facet shade written as a vertex colour (a multiplier on the material colour): darker toward the underside
  // (a cheap occlusion), a touch warmer on top, and a seeded few percent so no two facets match.
  function shadeFacets(geo, r, { low = 0.7, warm = 0.035, spread = 0.12, axisY = 1 } = {}) {
    const pos = geo.attributes.position, col = new Float32Array(pos.count * 3);
    for (let f = 0; f < pos.count; f += 3) {
      const cy = (pos.getY(f) + pos.getY(f + 1) + pos.getY(f + 2)) / 3 / axisY;   // about −1 … 1
      const up = clamp01((cy + 1) / 2);
      const s = (low + (1 - low) * up) * (1 - spread / 2 + r() * spread), w = up > 0.65 ? warm : 0;
      for (let k = f; k < f + 3; k++) { col[k * 3] = s * (1 + w); col[k * 3 + 1] = s * (1 + w * 0.5); col[k * 3 + 2] = s * (1 - w); }
    }
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  }
  // A lumpy, flat-bottomed blob — only the palm's crown boss uses it now.
  function leafClump(rad, r, { detail = 1, squash = 0.82, bump = 0.24, flat = 0.42, low = 0.68, freq = 2.6 } = {}) {
    const geo = new THREE.IcosahedronGeometry(1, detail), pos = geo.attributes.position, n = lumps(r, 4, freq);
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i), d = 1 + bump * n(x, y, z);
      let yy = y * d; if (yy < -flat) yy = -flat + (yy + flat) * 0.3;
      pos.setXYZ(i, x * d * rad, yy * rad * squash, z * d * rad);
    }
    shadeFacets(geo, r, { low, axisY: rad * squash, spread: 0.16 });
    geo.computeVertexNormals();
    return geo;
  }
  // One leaf cluster, unit size: a small faceted polyhedron nudged off-true so a crowd of them reads as foliage.
  // It stays an IcosahedronGeometry, so the plan twin reads a blob.
  function clusterGeo(r, { detail = 1, rough = 0.2, squash = 0.86 } = {}) {
    const geo = new THREE.IcosahedronGeometry(1, detail), pos = geo.attributes.position, n = lumps(r, 3, 2.4);
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i), d = 1 + rough * n(x, y, z);
      pos.setXYZ(i, x * d, y * d * squash, z * d);
    }
    shadeFacets(geo, r, { low: 0.72, axisY: squash, spread: 0.1, warm: 0.03 });
    geo.computeVertexNormals();
    return geo;
  }
  // Concatenate geometries (non-indexed, positions + colours when every part has them) into one draw call.
  function merged(geos) {
    const parts = geos.map(g => g.index ? g.toNonIndexed() : g);
    const withColor = parts.every(p => p.attributes.color);
    const n = parts.reduce((a, p) => a + p.attributes.position.count, 0);
    const pos = new Float32Array(n * 3), col = withColor ? new Float32Array(n * 3) : null;
    let o = 0;
    for (const p of parts) { pos.set(p.attributes.position.array, o * 3); if (col) col.set(p.attributes.color.array, o * 3); o += p.attributes.position.count; }
    const out = new THREE.BufferGeometry();
    out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    if (col) out.setAttribute('color', new THREE.BufferAttribute(col, 3));
    out.computeVertexNormals();
    return out;
  }
  // a cylinder between two points (trunks, limbs, palm segments), transformed in place so it stays a CylinderGeometry
  function limbGeo(a, b, r0, r1, segs = 6) {
    const d = V().subVectors(b, a), len = d.length();
    const geo = new THREE.CylinderGeometry(r1, r0, len, segs, 1);
    geo.translate(0, len / 2, 0);
    geo.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(UP, d.normalize()));
    geo.translate(a.x, a.y, a.z);
    return geo;
  }
  function addMesh(g, geo, m, x = 0, y = 0, z = 0, receive = true) {
    const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.castShadow = true; o.receiveShadow = receive; g.add(o); return o;
  }
  // an InstancedMesh from one geometry and a list of placements { x, y, z, rx, ry, rz, s, sx, sy, sz, tint, warm }
  const _m4 = new THREE.Matrix4(), _q = new THREE.Quaternion(), _p = V(), _s = V(), _e = new THREE.Euler(), _c = new THREE.Color();
  function instanced(geo, m, list, name, ud) {
    const im = new THREE.InstancedMesh(geo, m, list.length);
    list.forEach((p, i) => {
      _e.set(p.rx || 0, p.ry || 0, p.rz || 0); _q.setFromEuler(_e); _p.set(p.x, p.y, p.z);
      const s = p.s ?? 1; _s.set(p.sx ?? s, p.sy ?? s, p.sz ?? s);
      im.setMatrixAt(i, _m4.compose(_p, _q, _s));
      const t = p.tint ?? 1, w = p.warm || 0; _c.setRGB(t * (1 + w), t * (1 + w * 0.5), t * (1 - w)); im.setColorAt(i, _c);
    });
    im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true;
    im.castShadow = true; im.receiveShadow = true; if (name) im.name = name;
    if (ud) Object.assign(im.userData, ud);
    return im;
  }
  // points on the upper surface of a geometry (its own vertices, so a blossom sits ON the leaves)
  function topPoints(geo, r, n, minY = 0.15) {
    const pos = geo.attributes.position; let maxY = -Infinity;
    for (let i = 0; i < pos.count; i++) maxY = Math.max(maxY, pos.getY(i));
    const cand = []; for (let i = 0; i < pos.count; i += 3) if (pos.getY(i) > maxY * minY) cand.push(i);
    return Array.from({ length: n }, () => { const i = cand[Math.floor(r() * cand.length)] ?? 0; return V(pos.getX(i), pos.getY(i), pos.getZ(i)); });
  }

  // ---- crowns: leaf clusters over lobes --------------------------------------------------------------------------
  // A lobe is an ellipsoid { c, rx, ry, rz?, n, inner, floor, gap }: n cluster centres are dart-thrown over its
  // outer shell (from `inner` of its radius out to the rim — a crown is a shell of leaves round a shadowed middle),
  // none below `floor` (crowns hang flat underneath), none closer to another than the gap.
  function sampleLobes(r, lobes, minGap) {
    const pts = [];
    for (const L of lobes) {
      const inner = L.inner ?? 0.55, floor = L.floor ?? -0.55, gap = minGap * (L.gap ?? 1), g2 = gap * gap;
      for (let t = 0, placed = 0; placed < L.n && t < L.n * 30; t++) {
        const u = r() * 2 - 1, a = r() * Math.PI * 2, s = Math.sqrt(1 - u * u), q = inner + (1 - inner) * Math.sqrt(r());
        if (u < floor) continue;
        const p = V(L.c.x + Math.cos(a) * s * L.rx * q, L.c.y + u * L.ry * q, L.c.z + Math.sin(a) * s * (L.rz ?? L.rx) * q);
        if (pts.some(o => o.p.distanceToSquared(p) < g2)) continue;
        pts.push({ p, q, lobe: L }); placed++;
      }
    }
    return pts;
  }
  // Placements for clusters: size jitter, a spin about the vertical (clusters keep their flat side down), and a tint
  // from where each sits — shadowed low and deep inside, lit high and on the rim, warmer at the very top.
  function tintClusters(pts, r, size, sq = 1, { dark = 0.46, lift = 0.4 } = {}) {
    const ys = pts.map(o => o.p.y), y0 = Math.min(...ys), span = Math.max(0.1, Math.max(...ys) - y0);
    return pts.map(({ p, q }) => {
      const up = (p.y - y0) / span, s = size * (0.72 + r() * 0.56);
      return {
        x: p.x, y: p.y, z: p.z, ry: r() * Math.PI * 2, rx: (r() - 0.5) * 0.5, rz: (r() - 0.5) * 0.5, s, sy: s * sq,
        tint: (dark + lift * up + 0.14 * clamp01((q - 0.5) / 0.5)) * (0.92 + r() * 0.16),
        warm: up > 0.55 ? 0.06 * (up - 0.55) / 0.45 : 0,
      };
    });
  }
  // The crown: every cluster in ONE InstancedMesh (the twin reads its combined box as the canopy blob) and, when a
  // core material is given, a dark core per lobe (instanced too) so gaps between clusters show shade, not sky.
  function crown(g, r, lobes, leafMat, { size, gap = 1.0, sq = 1, detail = 1, rough = 0.2, core = 0.6, coreMat = null, dark = 0.46, lift = 0.4 }) {
    const pts = sampleLobes(r, lobes, size * gap);
    if (!pts.length) return [];
    const list = tintClusters(pts, r, size, sq, { dark, lift });
    g.add(instanced(clusterGeo(r, { detail, rough }), leafMat, list, 'Leaves', { isoShape: 'blob' }));
    if (core && coreMat) {
      const cores = lobes.map(L => ({ x: L.c.x, y: L.c.y, z: L.c.z, sx: L.rx * core, sy: L.ry * core, sz: (L.rz ?? L.rx) * core, ry: r() * Math.PI * 2 }));
      g.add(instanced(new THREE.IcosahedronGeometry(1, 1), coreMat, cores, 'Crown core', { iso: false }));
    }
    return list;
  }
  // limbs and twigs of one plant, merged into one draw call (the trunk stays its own cylinder for the twin)
  function woodMesh(g, geos, mat) {
    if (!geos.length) return null;
    const m = addMesh(g, merged(geos), mat); m.name = 'Limbs'; m.userData.iso = false; return m;
  }
  // A small bush as ONE geometry — clusters merged, their tint baked into the vertex colour — the unit a bed, a
  // planter or a flower clump instances or places.
  function bushGeo(r, rad, { n = 7, size = rad * 0.42, flat = 0.75, detail = 1, inner = 0.45 } = {}) {
    const lobe = { c: V(0, rad * flat * 0.62, 0), rx: rad, ry: rad * flat, n, inner, floor: -0.45 };
    const list = tintClusters(sampleLobes(r, [lobe], size * 0.8), r, size, 0.85, { dark: 0.52, lift: 0.42 });
    const base = clusterGeo(r, { detail, rough: 0.22 }), e = new THREE.Euler(), geos = [];
    // a dark core under the clusters, so the bush is one mass rather than pebbles on the soil
    const core = clusterGeo(r, { detail: 1, rough: 0.12 }); core.scale(rad * 0.78, rad * flat * 0.7, rad * 0.78); core.translate(0, rad * flat * 0.5, 0);
    for (let k = 0, c = core.attributes.color.array; k < c.length; k++) c[k] *= 0.42;
    geos.push(core);
    for (const p of list) {
      const q = base.clone(); q.scale(p.s, p.sy, p.s); q.applyQuaternion(new THREE.Quaternion().setFromEuler(e.set(p.rx, p.ry, p.rz))); q.translate(p.x, p.y, p.z);
      const c = q.attributes.color.array;
      for (let k = 0; k < c.length; k += 3) { c[k] *= p.tint * (1 + p.warm); c[k + 1] *= p.tint * (1 + p.warm * 0.5); c[k + 2] *= p.tint * (1 - p.warm); }
      geos.push(q);
    }
    return merged(geos);
  }

  // ---- trees ----------------------------------------------------------------------------------------------------
  // Deciduous: a trunk that forks into one limb per lobe (and a leader), the crown a main lobe ringed by limb-tip
  // lobes so the silhouette is a cloud, not a ball, and twigs out to some of the low clusters.
  //   broad   — a wide rounded crown (oak, maple)          oval — tall and narrow (linden, hornbeam)
  //   layered — two or three flat tiers along a leader (dogwood, Japanese maple)
  function deciduous(g, h, r, leaf, form, M) {
    const bark = M(BARK, barkOpts), foliage = M(leaf, leafOpts), coreMat = M(darker(leaf, 0.4), coreOpts);
    const oval = form === 'oval', layered = form === 'layered';
    const forkY = h * (oval ? 0.24 : 0.3) * (0.9 + r() * 0.2), r0 = Math.max(0.08, h * 0.03);
    const fork = V((r() - 0.5) * 0.04 * h, forkY, (r() - 0.5) * 0.04 * h);
    addMesh(g, limbGeo(V(0, 0, 0), fork, r0 * 1.3, r0 * 0.85, 8), bark).name = 'Trunk';
    const wood = [], lobes = [], RX = h * (oval ? 0.2 : 0.3);
    if (layered) {
      const top = V((r() - 0.5) * 0.2, h * 0.88, (r() - 0.5) * 0.2);
      wood.push(limbGeo(fork, top, r0 * 0.8, r0 * 0.3, 6));
      for (let t = 0; t < 3; t++) {
        const k = t / 3, y = forkY + (top.y - forkY) * (0.14 + k * 0.84), ring = RX * (0.62 - k * 0.3), m = 4 - t;
        const base = V().lerpVectors(fork, top, (y - forkY) / (top.y - forkY)), a0 = r() * Math.PI * 2;
        for (let i = 0; i < m; i++) {
          const a = a0 + (i / m) * Math.PI * 2 + (r() - 0.5) * 0.6, tip = V(base.x + Math.cos(a) * ring, y + (r() - 0.3) * 0.2, base.z + Math.sin(a) * ring);
          wood.push(limbGeo(base, tip, r0 * 0.42, r0 * 0.18, 5));
          const rx = RX * (0.44 - k * 0.1) * (0.85 + r() * 0.3);
          lobes.push({ c: tip.clone().setY(tip.y + rx * 0.1), rx, ry: rx * 0.3, n: 10 - t, inner: 0.25, floor: -0.4 });
        }
        lobes.push({ c: base.clone().setY(y + 0.08), rx: RX * (0.3 - k * 0.08), ry: RX * 0.1, n: 5, inner: 0.2, floor: -0.4 });
      }
      lobes.push({ c: top.clone().setY(top.y + RX * 0.05), rx: RX * 0.34, ry: RX * 0.2, n: 8, inner: 0.3, floor: -0.4 });
      crown(g, r, lobes, foliage, { size: h * 0.052, sq: 0.7, core: 0.5, coreMat });
    } else {
      const RY = (h - forkY) * (oval ? 0.5 : 0.46), C = V(fork.x, forkY + (h - forkY) * 0.52, fork.z);
      lobes.push({ c: C, rx: RX * 0.74, ry: RY * 0.8, n: oval ? 20 : 24, inner: 0.5 });
      const k = oval ? 3 : 4 + (r() < 0.5 ? 1 : 0), a0 = r() * Math.PI * 2;
      for (let i = 0; i < k; i++) {
        const a = a0 + (i / k) * Math.PI * 2 + (r() - 0.5) * 0.6, out = RX * (oval ? 0.42 : 0.56) * (0.9 + r() * 0.2);
        const dy = oval ? (i / (k - 1) - 0.5) * RY * 0.9 : (r() - 0.45) * RY * 0.5;
        const c = V(C.x + Math.cos(a) * out, C.y + dy, C.z + Math.sin(a) * out);
        lobes.push({ c, rx: RX * (0.44 + r() * 0.1), ry: RY * (oval ? 0.5 : 0.52), n: oval ? 9 : 10, inner: 0.45 });
        // a limb from the fork out to the lobe, and a secondary from its middle up into the crown
        const start = V().lerpVectors(V(0, 0, 0), fork, 0.92 + r() * 0.08);
        wood.push(limbGeo(start, c, r0 * 0.6, r0 * 0.24, 6));
        const mid = V().lerpVectors(start, c, 0.5), b = a + (r() < 0.5 ? -0.8 : 0.8);
        wood.push(limbGeo(mid, V(mid.x + Math.cos(b) * RX * 0.22, C.y + RY * (0.3 + r() * 0.3), mid.z + Math.sin(b) * RX * 0.22), r0 * 0.3, r0 * 0.12, 5));
      }
      const lead = V(C.x + (r() - 0.5) * RX * 0.2, C.y + RY * 0.62, C.z + (r() - 0.5) * RX * 0.2);
      wood.push(limbGeo(fork, lead, r0 * 0.6, r0 * 0.2, 6));
      lobes.push({ c: lead, rx: RX * 0.46, ry: RY * 0.42, n: 9, inner: 0.45 });
      const list = crown(g, r, lobes, foliage, { size: h * (oval ? 0.062 : 0.068), core: 0.62, coreMat });
      // twigs: some of the low clusters get a visible twig back to the nearest lobe centre, so the underside of the
      // crown shows a branch structure rather than a floating cloud
      for (const p of list) {
        if (p.y > C.y || r() > 0.35) continue;
        const at = V(p.x, p.y, p.z), L = lobes.reduce((best, l) => l.c.distanceToSquared(at) < best.c.distanceToSquared(at) ? l : best, lobes[0]);
        wood.push(limbGeo(L.c, at, r0 * 0.14, r0 * 0.06, 4));
      }
    }
    woodMesh(g, wood, bark);
  }

  // Conifer: a straight trunk under whorls of flat branch sprays — each spray a long, thin diamond, wide in the
  // middle, arching down to its tip — shorter and denser toward a leader. One InstancedMesh for every spray.
  function conifer(g, h, r, leaf, M) {
    addMesh(g, limbGeo(V(0, 0, 0), V(0, h * 0.9, 0), Math.max(0.07, h * 0.03), 0.03, 7), M(CONIFER_BARK, barkOpts)).name = 'Trunk';
    const spray = new THREE.OctahedronGeometry(0.5, 0); spray.translate(0.5, 0, 0);   // from the trunk (x 0) to the tip (x 1)
    const sp = spray.attributes.position;
    for (let i = 0; i < sp.count; i++) { const x = sp.getX(i); sp.setY(i, sp.getY(i) - 0.12 * x * x); }   // the spray arches down
    shadeFacets(spray, r, { low: 0.62, axisY: 0.5, spread: 0.08, warm: 0.02 });
    spray.computeVertexNormals();
    const tiers = 9 + Math.floor(r() * 3), base = h * (0.13 + r() * 0.04), top = h * 0.9, list = [];
    for (let i = 0; i < tiers; i++) {
      const k = i / (tiers - 1), y = base + (top - base) * Math.pow(k, 0.95), R = h * 0.26 * Math.pow(1 - k, 0.85) + h * 0.05;
      const m = Math.max(6, Math.round(6 + 4 * (1 - k))), a0 = r() * Math.PI * 2;
      for (let j = 0; j < m; j++) {
        const a = a0 + (j / m) * Math.PI * 2 + (r() - 0.5) * 0.4, L = R * (0.85 + r() * 0.3);
        const wide = Math.max(L * 0.42, 2 * Math.PI * L * 0.5 / m * 1.45);   // neighbours overlap into a skirt
        list.push({ x: 0, y: y + (r() - 0.5) * 0.06, z: 0, ry: a, rz: -(0.26 + 0.24 * (1 - k) + (r() - 0.5) * 0.12), sx: L, sy: L * 0.5, sz: wide, tint: (0.6 + 0.36 * k) * (0.92 + r() * 0.16) });
      }
    }
    g.add(instanced(spray, M(leaf, leafOpts), list, 'Branch sprays', { isoShape: 'cone' }));
    const tip = new THREE.ConeGeometry(h * 0.035, h * 0.12, 6); tip.translate(0, h * 0.95, 0);
    addMesh(g, tip, M(leaf, { roughness: 0.9, flatShading: true }));
  }

  // Columnar (Italian cypress): a flame of tight clusters round a dark spindle, widest a third of the way up.
  function columnar(g, h, r, leaf, M) {
    const foliage = M(leaf, leafOpts), coreMat = M(darker(leaf, 0.45), coreOpts);
    addMesh(g, limbGeo(V(0, 0, 0), V(0, h * 0.3, 0), Math.max(0.07, h * 0.025), 0.05, 6), M(CONIFER_BARK, barkOpts)).name = 'Trunk';
    const W = h * 0.13, base = h * 0.06, top = h * 0.98, k = 7, lobes = [];
    for (let i = 0; i < k; i++) {
      const t = (i + 0.5) / k, prof = t < 0.3 ? 0.8 + t * 0.67 : Math.pow(1 - (t - 0.3) / 0.7, 0.85) * 0.92 + 0.08;
      lobes.push({ c: V((r() - 0.5) * W * 0.12, base + t * (top - base), (r() - 0.5) * W * 0.12), rx: W * prof, ry: (top - base) / k * 1.1, n: Math.round(12 + 34 * prof), inner: 0.86, floor: -1 });
    }
    crown(g, r, lobes, foliage, { size: W * 0.22, sq: 1.4, gap: 0.72, detail: 0, rough: 0.12, core: 0.94, coreMat, dark: 0.56, lift: 0.36 });
  }

  // Palm: a bent, ringed trunk under a crown of drooping pinnate fronds (one merged, double-sided mesh).
  function palm(g, h, r, leaf, M) {
    const bend = h * (0.06 + r() * 0.12), az = r() * Math.PI * 2, bx = Math.cos(az), bz = Math.sin(az);
    const P = t => V(bx * bend * t * t, h * t, bz * bend * t * t);
    const k = Math.sqrt(h / 6), segs = Math.max(6, Math.round(h * 1.6)), rings = [];
    for (let i = 0; i < segs; i++) {
      const t0 = i / segs, t1 = (i + 1) / segs, rad = (0.2 - 0.07 * t0) * k;
      rings.push(limbGeo(P(t0), P(t1), rad * 1.1, rad * 0.9, 8));   // each segment flares at its foot: the rings
    }
    const trunk = addMesh(g, merged(rings), M(PALM_BARK, barkOpts)); trunk.name = 'Trunk'; trunk.userData.isoShape = 'cyl';
    const T = P(1);
    // the crown boss and a few nuts under it
    addMesh(g, leafClump(0.26 * k, r, { squash: 1.1, bump: 0.1, flat: 0.9 }), M(0x6a5a3e, leafOpts), T.x, T.y - 0.05, T.z);
    const nutMat = M(0x5a4a30, { roughness: 0.8 });
    for (let i = 0, n = 3 + Math.floor(r() * 3); i < n; i++) { const a = r() * Math.PI * 2; addMesh(g, new THREE.IcosahedronGeometry(0.09 * k, 0), nutMat, T.x + Math.cos(a) * 0.17 * k, T.y - 0.22 * k, T.z + Math.sin(a) * 0.17 * k, false).userData.iso = false; }
    // fronds: a spine that rises and droops, leaflets angled forward in a shallow V
    const pos = [], col = [];
    const tri = (a, b, c, ca, cb, cc) => { pos.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z); col.push(ca, ca, ca * 0.9, cb, cb, cb * 0.9, cc, cc, cc * 0.9); };
    const nF = 14 + Math.floor(r() * 5), phase = r() * Math.PI * 2;
    for (let f = 0; f < nF; f++) {
      const phi = phase + f * 2.39996 + (r() - 0.5) * 0.3, d = V(Math.cos(phi), 0, Math.sin(phi));
      const age = f / nF * 0.8 + r() * 0.2, rise = 0.95 - age * 1.05, len = h * (0.42 + r() * 0.14), droop = 0.55 + age * 0.7;
      const S = u => V(T.x + d.x * Math.cos(rise) * len * u, T.y + (Math.sin(rise) * u - droop * u * u) * len, T.z + d.z * Math.cos(rise) * len * u);
      const side = V().crossVectors(d, UP).normalize(), m = 16, tone = 0.8 + (1 - age) * 0.18 - (age > 0.85 ? 0.12 : 0);
      for (let j = 0; j < m; j++) {
        const u0 = j / m, u1 = (j + 1) / m, A = S(u0), B = S(u1), um = (u0 + u1) / 2;
        const tan = V().subVectors(B, A).normalize(), L = len * 0.2 * Math.pow(Math.sin(Math.PI * Math.min(1, um * 1.08)), 0.7) * (j % 2 ? 0.86 : 1);
        for (const sgn of [-1, 1]) {
          const tip = V().lerpVectors(A, B, 0.6).addScaledVector(side, sgn * L * 0.92).addScaledVector(UP, -L * 0.36).addScaledVector(tan, L * 0.45);
          tri(A, B, tip, tone * (0.7 + 0.25 * u0), tone * (0.7 + 0.25 * u1), tone * 1.04);
        }
      }
    }
    const fg = new THREE.BufferGeometry();
    fg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); fg.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); fg.computeVertexNormals();
    addMesh(g, fg, M(leaf, { ...leafOpts, side: THREE.DoubleSide })).userData.isoShape = 'blob';
  }

  // Birch: one to three pale stems, leaning apart, under an airy crown of small clusters on thin upswept twigs.
  function birch(g, h, r, leaf, M) {
    const bark = M(BIRCH_BARK, { ...barkOpts, vertexColors: true }), twig = M(0x6b5d50, barkOpts), foliage = M(leaf, leafOpts);
    const stems = r() < 0.45 ? 1 : r() < 0.7 ? 2 : 3, a0 = r() * Math.PI * 2, lobes = [], wood = [];
    for (let s = 0; s < stems; s++) {
      const a = a0 + (s / stems) * Math.PI * 2, lean = stems === 1 ? 0.03 : 0.08 + r() * 0.08, hs = h * (stems === 1 ? 1 : 0.8 + r() * 0.2);
      const foot = V(stems === 1 ? 0 : Math.cos(a) * 0.12, 0, stems === 1 ? 0 : Math.sin(a) * 0.12);
      const top = V(foot.x + Math.cos(a) * Math.sin(lean) * hs, hs * 0.86, foot.z + Math.sin(a) * Math.sin(lean) * hs);
      // bark: white, with dark lenticel marks where a seeded wave runs high
      const r0 = Math.max(0.06, h * 0.022) * (stems === 1 ? 1 : 0.8), geo = new THREE.CylinderGeometry(r0 * 0.5, r0, 1, 7, 16);
      const pos = geo.attributes.position, col = new Float32Array(pos.count * 3), n = lumps(r, 3, 1);
      for (let i = 0; i < pos.count; i++) {
        const an = Math.atan2(pos.getZ(i), pos.getX(i)), v = n(Math.cos(an) * 1.5, pos.getY(i) * 40, Math.sin(an) * 1.5);
        col[i * 3] = col[i * 3 + 1] = col[i * 3 + 2] = v > 0.6 ? 0.3 : v > 0.4 ? 0.72 : 1;
      }
      geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
      const d = V().subVectors(top, foot), len = d.length();
      geo.scale(1, len, 1); geo.translate(0, len / 2, 0); geo.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(UP, d.normalize())); geo.translate(foot.x, 0, foot.z);
      addMesh(g, geo, bark).name = 'Trunk';
      // small lobes up the top half of the stem, each on its own thin upswept twig
      const cN = (stems === 1 ? 6 : 4) + Math.floor(r() * 2);
      for (let i = 0; i < cN; i++) {
        const t = 0.45 + 0.55 * (i + r() * 0.6) / cN, from = V().lerpVectors(foot, top, t), b = r() * Math.PI * 2, out = h * (0.06 + 0.07 * (1 - Math.abs(t - 0.7) * 2));
        const c = V(from.x + Math.cos(b) * out, from.y + h * (0.04 + r() * 0.05), from.z + Math.sin(b) * out);
        wood.push(limbGeo(from, c, r0 * 0.3, r0 * 0.1, 4));
        lobes.push({ c, rx: h * (0.07 + r() * 0.03), ry: h * (0.08 + r() * 0.03), n: 7, inner: 0.3, floor: -0.7 });
      }
      lobes.push({ c: top.clone().setY(top.y + h * 0.04), rx: h * 0.07, ry: h * 0.09, n: 6, inner: 0.3, floor: -0.7 });
    }
    woodMesh(g, wood, twig);
    crown(g, r, lobes, foliage, { size: h * 0.04, gap: 1.25, core: 0, dark: 0.62, lift: 0.4 });
  }

  // Weeping willow: a short trunk forking into arching limbs under a broad dome of fine clusters, and a skirt of
  // hundreds of thin, tapering, light strands hung from the dome's shell — those from its rim nearly to the ground and
  // ragged at the foot, those higher up shorter, so the whole reads as a bell (not a barrel); each strand leaves its
  // branch heading outward and curves down (one InstancedMesh of strands, lighter at the foot).
  function willow(g, h, r, leaf, M) {
    const bark = M(0x4f4236, barkOpts), foliage = M(leaf, leafOpts), coreMat = M(darker(leaf, 0.45), coreOpts);
    const r0 = Math.max(0.14, h * 0.038), fork = V((r() - 0.5) * 0.3, h * 0.3, (r() - 0.5) * 0.3);
    addMesh(g, limbGeo(V(0, 0, 0), fork, r0 * 1.45, r0, 8), bark).name = 'Trunk';
    const R = h * 0.5, cy = h * 0.56, top = cy + R * 0.72, wood = [], lobes = [];
    const k = 5 + Math.floor(r() * 2), a0 = r() * Math.PI * 2;
    for (let i = 0; i < k; i++) {
      const a = a0 + (i / k) * Math.PI * 2 + (r() - 0.5) * 0.5, mid = V(Math.cos(a) * R * 0.32, cy + R * 0.5, Math.sin(a) * R * 0.32), tip = V(Math.cos(a) * R * 0.78, cy + R * 0.16 + r() * R * 0.12, Math.sin(a) * R * 0.78);
      wood.push(limbGeo(fork, mid, r0 * 0.62, r0 * 0.38, 6), limbGeo(mid, tip, r0 * 0.36, r0 * 0.14, 5));
      lobes.push({ c: tip.clone().setY(tip.y + R * 0.1), rx: R * 0.36, ry: R * 0.2, n: 30, inner: 0.35, floor: -0.35 });
    }
    lobes.push({ c: V(0, cy + R * 0.42, 0), rx: R * 0.62, ry: R * 0.3, n: 56, inner: 0.35, floor: -0.3 });
    woodMesh(g, wood, bark);
    crown(g, r, lobes, foliage, { size: h * 0.03, sq: 0.8, core: 0.6, coreMat, dark: 0.5, lift: 0.4 });
    // a strand: a narrow tapering ribbon, one metre long (scaled per strand), swinging out then hanging, lighter at its foot
    const seg = 6, pos = [], col = [], bow = t => 0.17 * (1 - (1 - t) * (1 - t) * (1 - t));
    for (let j = 0; j < seg; j++) {
      const t0 = j / seg, t1 = (j + 1) / seg, w0 = 0.04 * (1 - t0 * 0.7), w1 = 0.04 * (1 - t1 * 0.7), z0 = bow(t0), z1 = bow(t1);
      pos.push(-w0, -t0, z0, w0, -t0, z0, w1, -t1, z1, -w0, -t0, z0, w1, -t1, z1, -w1, -t1, z1);
      const c0 = 0.82 + 0.26 * t0, c1 = 0.82 + 0.26 * t1; col.push(c0, c0, c0, c0, c0, c0, c1, c1, c1, c0, c0, c0, c1, c1, c1, c1, c1, c1);
    }
    const strand = new THREE.BufferGeometry(); strand.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); strand.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); strand.computeVertexNormals();
    const list = [];
    for (let i = 0, n = 820; i < n; i++) {
      // hung from the dome's shell: u = how far up it (0 the rim, 1 the crown), the rim's strands the longest
      const a = r() * Math.PI * 2, u = Math.pow(r(), 1.25) * 0.88, rr = R * Math.sqrt(1 - u * u) * (0.94 + r() * 0.1), y = cy + R * 0.72 * u + (r() - 0.5) * 0.2;
      const foot = h * (0.08 + u * 0.42 + r() * (0.22 - u * 0.12)), len = Math.max(0.5, y - foot);
      list.push({ x: Math.cos(a) * rr, y, z: Math.sin(a) * rr, ry: Math.PI / 2 - a + (r() - 0.5) * 0.7, rx: (r() - 0.5) * 0.06, sx: 0.7 + r() * 0.7, sy: len, sz: len, tint: 0.72 + 0.34 * r() });
    }
    g.add(instanced(strand, M(leaf, { roughness: 0.9, flatShading: true, side: THREE.DoubleSide, vertexColors: true }), list, 'Willow strands', { isoShape: 'blob' }));
  }
  // Olive: two or three gnarled stems twisting apart, under an open, silvery crown of small clumps.
  function olive(g, h, r, leaf, M) {
    const bark = M(0x6b6255, barkOpts), foliage = M(leaf, leafOpts), coreMat = M(darker(leaf, 0.5), coreOpts);
    const stems = 2 + Math.floor(r() * 2), wood = [], lobes = [], r0 = Math.max(0.1, h * 0.045);
    for (let s = 0; s < stems; s++) {
      const a = r() * Math.PI * 2, lean = 0.25 + r() * 0.3;
      let p = V(Math.cos(a) * 0.08, 0, Math.sin(a) * 0.08);
      for (let k = 0; k < 4; k++) {
        const q = V(p.x + Math.cos(a) * lean * h * 0.12 + (r() - 0.5) * 0.25, p.y + h * (0.14 + r() * 0.05), p.z + Math.sin(a) * lean * h * 0.12 + (r() - 0.5) * 0.25);
        (s === 0 && k === 0 ? (addMesh(g, limbGeo(p, q, r0 * (1.2 - k * 0.2), r0 * (1 - k * 0.22), 7), bark).name = 'Trunk', null) : wood.push(limbGeo(p, q, r0 * (1.2 - k * 0.22), r0 * (1 - k * 0.22), 6)));
        p = q;
      }
      for (let k = 0; k < 3; k++) lobes.push({ c: V(p.x + (r() - 0.5) * h * 0.25, p.y + (r() - 0.3) * h * 0.1, p.z + (r() - 0.5) * h * 0.25), rx: h * (0.17 + r() * 0.06), ry: h * 0.13, n: 18, inner: 0.35, floor: -0.55 });
    }
    woodMesh(g, wood, bark);
    crown(g, r, lobes, foliage, { size: h * 0.042, gap: 0.95, sq: 0.85, core: 0.55, coreMat, dark: 0.56, lift: 0.36 });
  }
  // Fan palm: a straight fibrous trunk under a round head of fan leaves on long stalks.
  function fanPalm(g, h, r, leaf, M) {
    const lean = (r() - 0.5) * 0.08, T = V(lean * h, h, lean * h * 0.5);
    const trunk = addMesh(g, limbGeo(V(0, 0, 0), T, 0.2, 0.16, 9), M(0x6f604e, barkOpts)); trunk.name = 'Trunk'; trunk.userData.isoShape = 'cyl';
    const pos = [], col = [];
    const tri = (a, b2, c, k0, k1, k2) => { pos.push(a.x, a.y, a.z, b2.x, b2.y, b2.z, c.x, c.y, c.z); col.push(k0, k0, k0, k1, k1, k1, k2, k2, k2); };
    const n = 19 + Math.floor(r() * 6);
    for (let f = 0; f < n; f++) {
      const phi = f * 2.39996 + r() * 0.3, el = 0.15 + r() * 1.05 - (f / n) * 0.95, L = h * (0.13 + r() * 0.05), R = h * (0.17 + r() * 0.04);
      const d = V(Math.cos(phi) * Math.cos(el), Math.sin(el), Math.sin(phi) * Math.cos(el)), stalkEnd = V().copy(T).addScaledVector(d, L);
      const side = V().crossVectors(d, UP).normalize(), up = V().crossVectors(side, d).normalize();
      // the stalk as two thin triangles, then the fan: a filled half-disc of blades (each a pointed tip between two
      // notches) spread over ~200° about the stalk's end, drooping a little toward the edges
      pos.push(T.x, T.y, T.z, stalkEnd.x, stalkEnd.y, stalkEnd.z, stalkEnd.x + side.x * 0.03, stalkEnd.y, stalkEnd.z + side.z * 0.03); col.push(0.6, 0.6, 0.55, 0.6, 0.6, 0.55, 0.6, 0.6, 0.55);
      const blades = 11, tone = 0.8 + r() * 0.2;
      const dir = t => V().addScaledVector(d, Math.cos(t)).addScaledVector(side, Math.sin(t)).addScaledVector(up, -0.28 * Math.sin(t) * Math.sin(t));
      for (let b = 0; b < blades; b++) {
        const t0 = -1.75 + 3.5 * b / blades, t1 = -1.75 + 3.5 * (b + 1) / blades, tm = (t0 + t1) / 2;
        const a = V().copy(stalkEnd).addScaledVector(dir(t0), R * 0.1), c = V().copy(stalkEnd).addScaledVector(dir(t1), R * 0.1);
        const n0 = V().copy(stalkEnd).addScaledVector(dir(t0), R * 0.8), n1 = V().copy(stalkEnd).addScaledVector(dir(t1), R * 0.8);
        const tip = V().copy(stalkEnd).addScaledVector(dir(tm), R).addScaledVector(up, (b % 2 ? 0.05 : -0.05) * R);
        const k = tone * (b % 2 ? 0.9 : 1.04);
        tri(a, n0, tip, k * 0.85, k, k * 1.08); tri(a, tip, n1, k * 0.85, k * 1.08, k); tri(a, n1, c, k * 0.85, k, k * 0.85);
      }
    }
    const fg = new THREE.BufferGeometry(); fg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); fg.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); fg.computeVertexNormals();
    addMesh(g, fg, M(leaf, { ...leafOpts, side: THREE.DoubleSide })).userData.isoShape = 'blob';
  }

  function tree(s, r) {
    const jit = s.jitter !== false;
    const species = SPECIES[s.species] || (s.species ? 'broad' : pick(r, DEFAULT_SPECIES));
    const h = jitter(r, s.h || SPECIES_H[species] || 5, jit ? 0.16 : 0);
    const deciduousish = species === 'broad' || species === 'oval' || species === 'layered' || species === 'birch' || species === 'shade';
    const leaf = s.color ? hex(s.color) : s.autumn && deciduousish ? pick(r, AUTUMN)
      : species === 'cherry' ? pick(r, CHERRY) : species === 'olive' ? pick(r, OLIVE) : species === 'willow' ? pick(r, WILLOW)
      : pick(r, species === 'oval' || species === 'layered' || species === 'shade' ? GREEN.broad : species === 'fan-palm' ? GREEN.palm : GREEN[species] || GREEN.broad);
    const g = group(`Tree (${species})`), M = mats();
    if (species === 'conical') conifer(g, h, r, leaf, M);
    else if (species === 'columnar') columnar(g, h, r, leaf, M);
    else if (species === 'palm') palm(g, h, r, leaf, M);
    else if (species === 'birch') birch(g, h, r, leaf, M);
    else if (species === 'willow') willow(g, h, r, leaf, M);
    else if (species === 'olive') olive(g, h, r, leaf, M);
    else if (species === 'fan-palm') fanPalm(g, h, r, leaf, M);
    else deciduous(g, h, r, leaf, species === 'cherry' || species === 'shade' ? 'broad' : species, M);
    // `spread` widens (or narrows) the crown about the trunk, leaving the trunk as it is
    if (s.spread && s.spread !== 1) { const k = Math.max(0.5, Math.min(2, s.spread)); for (const c of g.children) if (c.name !== 'Trunk') c.scale.set(k, 1, k); }
    if (jit) { g.rotation.y = r() * Math.PI * 2; g.rotation.z = (r() - 0.5) * 0.05; }
    return g;
  }

  // ---- shrubs, grasses, flowers -------------------------------------------------------------------------------------
  // an ornamental-grass tuft: flattened, leaning cones fanned out from the crown (plugin-trees grass-geometry, MIT)
  function grassTuft(r, hgt, blades = 26, spread = 0.12) {
    const geos = [];
    for (let i = 0; i < blades; i++) {
      const bh = hgt * (0.6 + r() * 0.6), b = new THREE.ConeGeometry(0.035 * hgt + 0.012, bh, 3);
      b.scale(1, 1, 0.3); b.translate(0, bh / 2, 0); b.rotateZ((r() - 0.5) * 1.0);
      const a = r() * Math.PI * 2; b.rotateY(a); const d = r() * spread; b.translate(Math.cos(a) * d, 0, Math.sin(a) * d);
      const t = 0.72 + r() * 0.35, bp = b.attributes.position, c = new Float32Array(bp.count * 3);
      for (let k = 0; k < bp.count; k++) { const up = clamp01(bp.getY(k) / bh); c[k * 3] = t * (0.75 + 0.35 * up); c[k * 3 + 1] = t * (0.75 + 0.3 * up); c[k * 3 + 2] = t * (0.75 + 0.2 * up); }
      b.setAttribute('color', new THREE.BufferAttribute(c, 3)); geos.push(b);
    }
    return merged(geos);
  }
  // flower heads (plugin-trees flower-geometry, MIT): daisy ring, tulip cup, lavender spike; plus a plain bloom
  // cluster. One geometry per material (petals, centre), around a local origin at the top of the stem.
  function flowerHead(kind, r) {
    const petals = [], centre = [];
    if (kind === 'lavender') {
      for (let i = 0; i < 16; i++) { const t = i / 16, y = t * 0.16, a = i * 2.4 + r() * 0.5, rr = (1 - t) * 0.03 + 0.006; const f = new THREE.IcosahedronGeometry(0.016 * (1 - t * 0.4), 0); f.translate(Math.cos(a) * rr, y, Math.sin(a) * rr); petals.push(f); }
    } else if (kind === 'tulip') {
      for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2 + r() * 0.1, p = new THREE.ConeGeometry(0.04, 0.12, 4); p.translate(0, 0.06, 0); p.rotateZ(0.4); p.rotateY(-a); p.translate(Math.cos(a) * 0.025, 0, Math.sin(a) * 0.025); petals.push(p); }
    } else if (kind === 'daisy') {
      for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2 + r() * 0.08, p = new THREE.ConeGeometry(0.018, 0.075, 3); p.rotateZ(Math.PI / 2); p.translate(0.06, 0, 0); p.rotateY(-a); petals.push(p); }
      const c = new THREE.IcosahedronGeometry(0.03, 1); c.scale(1, 0.55, 1); c.translate(0, 0.008, 0); centre.push(c);
    } else if (kind === 'spike') {
      // a delphinium / foxglove spike: florets up a long tapering head
      for (let i = 0; i < 22; i++) { const t = i / 22, y = t * 0.34, a = i * 2.4 + r() * 0.5, rr = (1 - t) * 0.045 + 0.008; const f = new THREE.IcosahedronGeometry(0.02 * (1 - t * 0.5), 0); f.translate(Math.cos(a) * rr, y, Math.sin(a) * rr); petals.push(f); }
    } else if (kind === 'allium') {
      // a globe of florets
      for (let i = 0; i < 26; i++) { const u = r() * 2 - 1, a = r() * Math.PI * 2, q = Math.sqrt(1 - u * u), f = new THREE.IcosahedronGeometry(0.014, 0); f.translate(Math.cos(a) * q * 0.055, 0.055 + u * 0.055, Math.sin(a) * q * 0.055); petals.push(f); }
    } else if (kind === 'rose') {
      // a cupped rose: a tight ball of petals, a ring of looser ones round it
      const c = new THREE.IcosahedronGeometry(0.026, 1); c.scale(1, 0.85, 1); c.translate(0, 0.024, 0); petals.push(c);
      for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2 + r() * 0.3, p = new THREE.IcosahedronGeometry(0.018, 0); p.scale(1, 0.6, 0.8); p.translate(Math.cos(a) * 0.028, 0.012, Math.sin(a) * 0.028); petals.push(p); }
    } else {
      for (let i = 0; i < 5; i++) { const a = r() * Math.PI * 2, d = r() * 0.03, b = new THREE.IcosahedronGeometry(0.035 + r() * 0.015, 0); b.translate(Math.cos(a) * d, r() * 0.03, Math.sin(a) * d); petals.push(b); }
    }
    return { petals: merged(petals), centre: centre.length ? merged(centre) : null };
  }
  // Heads for a set of spots: one InstancedMesh per material, plus stems when the heads stand clear of the leaves.
  // The twin skips them — a bed's heads are dots, not a disc of petal colour over the bed.
  function flowerHeads(g, kind, color, spots, r, M, scale = 1.1) {
    if (!spots.length) return;
    const head = flowerHead(kind, r), tall = kind === 'tulip' || kind === 'lavender', no = { iso: false };
    const list = spots.map(p => { const lift = tall ? 0.1 + r() * 0.08 : 0.01; return { x: p.x, y: p.y + lift, z: p.z, lift, ry: r() * Math.PI * 2, rx: (r() - 0.5) * 0.3, rz: (r() - 0.5) * 0.3, s: scale * (0.8 + r() * 0.4), tint: 0.86 + r() * 0.18 }; });
    g.add(instanced(head.petals, M(color, { roughness: 0.75, flatShading: true }), list, 'Flower heads', no));
    if (head.centre) g.add(instanced(head.centre, M(0xc99a3c, { roughness: 0.7 }), list, 'Flower centres', no));
    if (tall) {
      const stem = new THREE.CylinderGeometry(0.006, 0.01, 1, 4); stem.translate(0, 0.5, 0);
      g.add(instanced(stem, M(0x4f6a3c, { roughness: 0.9 }), list.map(p => ({ x: p.x, y: p.y - p.lift - 0.05, z: p.z, s: 1.4, sy: p.lift + 0.05 })), 'Flower stems', no));
    }
  }

  // A shrub in one of the planting generator's forms (hydrangea, fern, topiary, agave, yucca …): its unit species
  // geometry scaled to `r` (crown radius) and `h`, with its heads when it flowers.
  const SPECIES_FORMS = new Set(['hydrangea', 'fern', 'topiary-ball', 'topiary-cone', 'agave', 'yucca', 'columnar', 'rosemary', 'hosta', 'broadleaf', 'succulent', 'cactus', 'groundcover', 'silver', 'sedum']);
  function speciesShrub(s, r, form) {
    const info = PLANT_SPECIES[form] || PLANT_SPECIES.shrub, M = mats();
    const rad = s.r || (info.r[0] + info.r[1]) / 2 * (0.9 + r() * 0.2), h = s.h || (info.h[0] + info.h[1]) / 2 * (0.9 + r() * 0.2);
    const g = group(form === 'agave' || form === 'yucca' || form === 'succulent' || form === 'cactus' ? 'Succulent' : 'Shrub');
    const plan = { plants: [{ sp: form, x: 0, z: 0, y: 0, h, r: rad, rot: r() * Math.PI * 2, tint: 1, bloom: s.color ? hex(s.color) : null, layer: 'mid' }] };
    drawPlants(g, plan.plants, r, M, 0);
    return g;
  }
  function shrub(s, r) {
    if (SPECIES_FORMS.has(s.form)) return speciesShrub(s, r, s.form);
    const jit = s.jitter !== false;
    const rad = jitter(r, s.r || 0.6, jit ? 0.25 : 0);
    const form = s.form || (s.color || !jit ? 'mound' : pick(r, ['mound', 'mound', 'mound', 'boxwood', 'spreading', 'flowering', 'grass']));
    const g = group(form === 'grass' ? 'Ornamental Grass' : 'Shrub'), M = mats();
    if (form === 'grass') {
      const c = s.color ? hex(s.color) : pick(r, GREEN.grass);
      addMesh(g, grassTuft(r, rad * 1.7, 40, rad * 0.35), M(c, { ...leafOpts, side: THREE.DoubleSide })).userData.isoShape = 'blob';
      g.rotation.y = r() * Math.PI * 2;
      return g;
    }
    const leaf = s.color ? hex(s.color) : form === 'boxwood' ? pick(r, [0x34502f, 0x3a5533]) : pick(r, GREEN.shrub);
    const foliage = M(leaf, leafOpts), coreMat = M(darker(leaf, 0.42), coreOpts), lobes = [];
    const boxwood = form === 'boxwood';
    if (boxwood) {
      // clipped: one dense, even skin of small clusters over a full core
      lobes.push({ c: V(0, rad * 0.78, 0), rx: rad, ry: rad * 0.82, n: Math.round(26 + rad * 30), inner: 0.9, floor: -0.62 });
    } else {
      const spreading = form === 'spreading', n = spreading ? 3 + Math.floor(r() * 2) : jit ? 1 + Math.floor(r() * 3) : 1;
      const reach = spreading ? 1.25 : 0.85, flat = spreading ? 0.55 : 0.74;
      for (let i = 0; i < n; i++) {
        const rr = i === 0 ? rad : rad * (0.55 + r() * 0.3), a = r() * Math.PI * 2, d = i === 0 ? 0 : rad * reach * (0.4 + r() * 0.4);
        lobes.push({ c: V(Math.cos(a) * d, rr * flat * 0.7, Math.sin(a) * d), rx: rr, ry: rr * flat, n: Math.round(8 + rr * 18), inner: 0.5, floor: -0.4 });
      }
    }
    const list = crown(g, r, lobes, foliage, { size: rad * (boxwood ? 0.22 : 0.34), gap: boxwood ? 0.7 : 0.95, sq: 0.9, core: boxwood ? 0.88 : 0.72, coreMat, dark: 0.5, lift: 0.42 });
    if (form === 'flowering' && list.length) {
      // blossoms on the upper, outer clusters — hydrangea / rose, in a muted colour
      const top = list.filter(p => p.y > lobes[0].c.y), from = top.length ? top : list;
      const spots = Array.from({ length: 14 + Math.floor(r() * 10) }, () => {
        const p = pick(r, from), a = r() * Math.PI * 2;
        return V(p.x + Math.cos(a) * p.s * 0.5, p.y + p.sy * 0.55, p.z + Math.sin(a) * p.s * 0.5);
      });
      flowerHeads(g, 'bloom', pick(r, BLOOM), spots, r, M, 1.1 + rad * 0.5);
    }
    g.rotation.y = r() * Math.PI * 2;
    return g;
  }
  function flowers(s, r) {
    // `kind` picks the flower whatever its colour (`color` pins the bloom); unset, the old seeded pick
    if (FLOWER_KINDS_ALL.includes(s.kind)) {
      const g = group('Flowers'), M = mats(), rad = s.r || 0.5, info = PLANT_SPECIES[s.kind] || PLANT_SPECIES.bloom;
      // a clump of r: several plants of the kind, Poisson-spaced inside it
      const sp = Math.max(0.12, (info.r[0] + info.r[1]) / 2 * 1.2), pts = rad <= sp ? [[0, 0]] : poisson(r, { x0: -rad, z0: -rad, x1: rad, z1: rad }, sp, (x, z) => x * x + z * z < rad * rad, { seeds: 2, grid: sp });
      const bloomC = s.color ? hex(s.color) : info.bloom ? pick(r, info.bloom) : null;
      drawPlants(g, pts.map(([x, z]) => ({ sp: s.kind, x, z, y: 0, h: s.h || (info.h[0] + info.h[1]) / 2 * (0.85 + r() * 0.3), r: (info.r[0] + info.r[1]) / 2 * (0.85 + r() * 0.3), rot: r() * Math.PI * 2, tint: 0.9 + r() * 0.2, bloom: bloomC, layer: 'mid' })), r, M, 0);
      return g;
    }
    const rad = s.r || 0.5, g = group('Flowers'), M = mats();
    const kind = s.color ? 'bloom' : pick(r, FLOWER_KINDS), color = s.color ? hex(s.color) : pick(r, PETAL[kind]);
    const mound = bushGeo(r, rad, { n: Math.round(6 + rad * 12), size: rad * 0.3, flat: 0.42, detail: 0 });
    addMesh(g, mound, M(pick(r, GREEN.shrub), leafOpts)).userData.isoShape = 'blob';
    const spots = topPoints(mound, r, 9 + Math.floor(r() * 9) + Math.round(rad * 10), 0.35);
    flowerHeads(g, kind, color, spots, r, M);
    return g;
  }
  // A planter: the same w × 0.5 × d box house-builder used to build (so layouts, footprints and `rot` are
  // unchanged), in warm charcoal, topped with mulch and planted along its length — small leafy bushes, and on some
  // an ornamental grass — instead of one smooth ball. Never spun: its box stays square to the walls it was placed
  // against.
  function planter(s, r) {
    const w = s.w || 1.2, d = s.d || 0.5, g = group('Planter'), M = mats();
    addMesh(g, new THREE.BoxGeometry(w, 0.5, d), std(PLANTER, { roughness: 0.85 }), 0, 0.25, 0);
    addMesh(g, new THREE.BoxGeometry(w - 0.08, 0.02, d - 0.08), M(MULCH, { roughness: 1 }), 0, 0.5, 0).castShadow = false;
    const long = w >= d, L = Math.max(w, d), D = Math.min(w, d), n = Math.max(1, Math.round(L / 0.5));
    const leaf = s.color ? hex(s.color) : pick(r, [0x34502f, 0x3a5533, ...GREEN.shrub.slice(0, 3)]), foliage = M(leaf, leafOpts);
    const grassAt = n > 1 && r() < 0.4 ? Math.floor(r() * n) : -1;
    for (let i = 0; i < n; i++) {
      const t = (i + 0.5) / n - 0.5, along = t * L + (r() - 0.5) * 0.06, x = long ? along : 0, z = long ? 0 : along;
      if (i === grassAt) { addMesh(g, grassTuft(r, D * 1.3, 24, D * 0.18), M(pick(r, GREEN.grass), { ...leafOpts, side: THREE.DoubleSide }), x, 0.5, z).userData.isoShape = 'blob'; continue; }
      const rad = D * (0.46 + r() * 0.1);
      const m = addMesh(g, bushGeo(r, rad, { n: 8, size: rad * 0.36, flat: 0.8 }), foliage, x, 0.47, z);
      m.rotation.y = r() * Math.PI * 2; m.userData.isoShape = 'blob';
    }
    return g;
  }
  function rock(s, r) {
    const rad = jitter(r, s.r || 0.4, 0.3), g = group('Rock');
    const m = new THREE.Mesh(new THREE.DodecahedronGeometry(rad, 0), std(pick(r, ROCKS), { roughness: 1, flatShading: true }));
    m.scale.set(1 + r() * 0.5, 0.55 + r() * 0.3, 1 + r() * 0.4); m.rotation.set(r() * 0.4, r() * Math.PI, r() * 0.3); m.position.y = rad * 0.35; m.castShadow = true; m.receiveShadow = true; g.add(m);
    return g;
  }

  // ---- planted areas and lines --------------------------------------------------------------------------------
  const polyOf = s => s.poly ? s.poly : [[s.at[0] - s.w / 2, s.at[1] - s.d / 2], [s.at[0] + s.w / 2, s.at[1] - s.d / 2], [s.at[0] + s.w / 2, s.at[1] + s.d / 2], [s.at[0] - s.w / 2, s.at[1] + s.d / 2]];
  const inPoly = (x, z, poly) => { let c = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const [xi, zi] = poly[i], [xj, zj] = poly[j]; if ((zi > z) !== (zj > z) && x < (xj - xi) * (z - zi) / (zj - zi) + xi) c = !c; } return c; };
  const areaOf = poly => Math.abs(poly.reduce((a, p, i) => { const q = poly[(i + 1) % poly.length]; return a + (p[0] * q[1] - q[0] * p[1]); }, 0) / 2);
  // Room to grow beside the house: how far a plant centred at (x, z) may reach before it touches a ground-storey
  // wall — the distance to the footprint less WALL_OUT (the walls are 0.16 m thick and centred on the footprint
  // edge, and their sills and casings stand a little proud of that). Negative inside the house.
  const WALL_OUT = 0.12;
  const rectGap = (x, z, b) => Math.hypot(Math.max(b.x - x, 0, x - (b.x + b.w)), Math.max(b.z - z, 0, z - (b.z + b.d)));
  const houseGap = (x, z) => keepOut.reduce((m, b) => Math.min(m, rectGap(x, z, b)), Infinity);   // 0 inside the footprint
  const roomAt = (x, z) => houseGap(x, z) - WALL_OUT;
  // how far a plant variant reaches from its stem, in plan
  const reachOf = geo => { const p = geo.attributes.position; let m = 0; for (let i = 0; i < p.count; i++) m = Math.max(m, Math.hypot(p.getX(i), p.getZ(i))); return m; };
  // A bed is mulch inside a stone kerb, planted by dart-throwing (a minimum spacing, so it never reads as a grid)
  // and in drifts (gardeners plant in sweeps, not confetti). Every plant kind is ONE InstancedMesh per variant.
  // A foundation bed runs up to a wall, so nothing is planted without room for at least a flower clump
  // (BED_MIN_ROOM, its leaves and heads), and every plant is shrunk to fit the room it has — the ones against the
  // wall are the small ones, and none reaches through into the rooms.
  const BED_MIN_ROOM = 0.26;
  function bed(s, r) {
    // `smooth` curves the outline (centripetal Catmull-Rom through its corners); `edge` ({ color, h, w } | 'none') and
    // a smoothed outline take the true offset kerb, and so does every bed under `defaults: 2`
    const t = tensionOf(s.smooth), trueKerb = s.edge !== undefined || t !== null || gen2;
    const poly = t === null ? polyOf(s) : smoothLoop(polyOf(s), t, 0.25), g = group('Planted Bed'), M = mats();
    const shape = new THREE.Shape(poly.map(p => new THREE.Vector2(p[0], p[1])));
    const soilGeo = new THREE.ExtrudeGeometry(shape, { depth: 0.1, bevelEnabled: false }); soilGeo.rotateX(Math.PI / 2);
    const soil = new THREE.Mesh(soilGeo, std(MULCH, { roughness: 1 })); soil.position.y = 0.1; soil.receiveShadow = true; g.add(soil);
    // Kerb: a flat outline a touch wider than the soil, sitting just under it, so it peeks out as a visible
    // border rather than being hidden under the soil block it shares a footprint with — offset outward from
    // the polygon's own centroid rather than true polygon buffering, which is overkill for beds this size.
    // The soil's rotateX(+90°) takes shape (x, y) to world (x, 0, y), but a ShapeGeometry laid flat face-up
    // (rotation.x = −90°) takes it to (x, 0, −y) — so the kerb is drawn in (x, −z). Drawn in (x, z) it landed
    // mirrored across z = 0, a grey patch on the far side of the lot. ShapeGeometry winds every face to +z
    // whichever way the outline runs, so it faces up and needs no DoubleSide. It sits above the ground storey's
    // floor, so a corner the widening would carry into the footprint keeps the bed's own corner instead —
    // otherwise a foundation bed's kerb shows as a grey sliver on the room floor behind the wall.
    if (!trueKerb) {
      const cx0 = poly.reduce((a, p) => a + p[0], 0) / poly.length, cz0 = poly.reduce((a, p) => a + p[1], 0) / poly.length;
      const kerbShape = new THREE.Shape(poly.map(([px, pz]) => {
        let x = cx0 + (px - cx0) * 1.06, z = cz0 + (pz - cz0) * 1.06;
        if (houseGap(x, z) === 0 && houseGap(px, pz) > 0) { x = px; z = pz; }
        return new THREE.Vector2(x, -z);
      }));
      const kerb = new THREE.Mesh(new THREE.ShapeGeometry(kerbShape), std(KERB, { roughness: 0.9 })); kerb.rotation.x = -Math.PI / 2; kerb.position.y = 0.005; g.add(kerb); // ground shadow of the kerb
    } else if (s.edge !== 'none') {
      // a kerb as wide everywhere round the bed, never reaching into the house
      const e = typeof s.edge === 'object' && s.edge ? s.edge : {}, w = e.w ?? 0.1;
      const outer = offsetLoop(poly, w).map((q, i) => (houseGap(q[0], q[1]) === 0 && houseGap(poly[i][0], poly[i][1]) > 0 ? poly[i] : q));
      const inner = ccw(poly);
      const k = slabPoly(ccw(outer), 0, e.h ?? 0.02, M(e.color ? hex(e.color) : KERB, { roughness: 0.9 }), 'Bed kerb', [inner.slice().reverse()]); k.castShadow = false; g.add(k);
    }
    const xs = poly.map(p => p[0]), zs = poly.map(p => p[1]);
    const minX = Math.min(...xs), maxX = Math.max(...xs), minZ = Math.min(...zs), maxZ = Math.max(...zs);
    const kind = s.plants || 'mixed', area = areaOf(poly), n = Math.round((s.density || 1.2) * area);
    const gap = Math.sqrt(area / Math.max(1, n)) * 0.6, pts = [];
    for (let tries = 0; pts.length < n && tries < n * 40; tries++) {
      const x = minX + r() * (maxX - minX), z = minZ + r() * (maxZ - minZ);
      if (!inPoly(x, z, poly) || roomAt(x, z) < BED_MIN_ROOM || pts.some(p => Math.hypot(p[0] - x, p[1] - z) < gap)) continue;
      pts.push([x, z]);
    }
    // a plant's scale, no bigger than the room it has for its reach
    const fit = (x, z, s0, reach) => Math.min(s0, roomAt(x, z) / reach);
    // drifts: a slow seeded wave across the bed decides what grows where
    const ang = r() * Math.PI, ph = r() * 6.28, wave = (x, z) => Math.sin((x * Math.cos(ang) + z * Math.sin(ang)) * 1.3 + ph) * 0.5 + 0.5;
    const kinds = { shrub: [], grass: [], flowerA: [], flowerB: [] };
    for (const [x, z] of pts) {
      const w = wave(x, z), roll = r();
      if (kind === 'shrubs') kinds[roll < 0.8 ? 'shrub' : 'grass'].push([x, z]);
      else if (kind === 'grass') kinds[roll < 0.85 ? 'grass' : 'shrub'].push([x, z]);
      else if (kind === 'flowers') kinds[w < 0.5 ? 'flowerA' : 'flowerB'].push([x, z]);
      else kinds[w < 0.3 ? 'shrub' : w < 0.45 ? 'grass' : w < 0.72 ? 'flowerA' : 'flowerB'].push([x, z]);
    }
    const y0 = 0.1;
    if (kinds.shrub.length) {
      const geo = bushGeo(r, 0.34, { n: 8, size: 0.13, flat: 0.72 }), reach = reachOf(geo);
      g.add(instanced(geo, M(pick(r, GREEN.shrub), leafOpts), kinds.shrub.map(([x, z]) => { const s0 = 0.75 + r() * 0.6; return { x, y: y0 - 0.02, z, ry: r() * Math.PI * 2, s: fit(x, z, s0, reach), tint: 0.9 + r() * 0.18 }; }), 'Bed shrubs', { isoShape: 'blob' }));
    }
    if (kinds.grass.length) {
      const geo = grassTuft(r, 0.5, 22, 0.08), reach = reachOf(geo);
      g.add(instanced(geo, M(pick(r, GREEN.grass), { ...leafOpts, side: THREE.DoubleSide }), kinds.grass.map(([x, z]) => ({ x, y: y0, z, ry: r() * Math.PI * 2, s: fit(x, z, 0.8 + r() * 0.5, reach), tint: 0.9 + r() * 0.2 })), 'Bed grasses', { isoShape: 'blob' }));
    }
    for (const key of ['flowerA', 'flowerB']) {
      const spots = kinds[key]; if (!spots.length) continue;
      const fk = pick(r, FLOWER_KINDS), color = s.color ? hex(s.color) : pick(r, PETAL[fk]);
      const mound = bushGeo(r, 0.17, { n: 5, size: 0.07, flat: 0.55, detail: 0 }), reach = reachOf(mound);
      g.add(instanced(mound, M(pick(r, GREEN.shrub), leafOpts), spots.map(([x, z]) => ({ x, y: y0 - 0.01, z, ry: r() * Math.PI * 2, s: fit(x, z, 0.8 + r() * 0.5, reach), tint: 0.9 + r() * 0.2 })), 'Bed foliage', { isoShape: 'blob' }));
      const heads = []; for (const [x, z] of spots) for (let i = 0, m = 3 + Math.floor(r() * 3); i < m; i++) { const a = r() * Math.PI * 2, d = r() * 0.13; heads.push(V(x + Math.cos(a) * d, y0 + 0.12 + r() * 0.05, z + Math.sin(a) * d)); }
      flowerHeads(g, fk, color, heads, r, M, 1.0);
    }
    return g;
  }
  function pathStrip(s, r) {
    // `smooth` or `surface` (and every path under `defaults: 2`): a ribbon along the curved centre line, in a surface
    if (s.smooth !== undefined || s.surface !== undefined || gen2) return surfacedPath(s, r);
    const pts = s.path || [], w = s.w || 1.0, color = s.color ? hex(s.color) : 0xd6d3d1, g = group('Path');
    const mat = std(color, { roughness: 0.95 });
    for (let i = 0; i < pts.length - 1; i++) {
      const [ax, az] = pts[i], [bx, bz] = pts[i + 1]; const len = Math.hypot(bx - ax, bz - az); if (len < 1e-6) continue;
      const m = new THREE.Mesh(new THREE.BoxGeometry(len, 0.05, w), mat); m.position.set((ax + bx) / 2, 0.025, (az + bz) / 2); m.rotation.y = -Math.atan2(bz - az, bx - ax); m.receiveShadow = true; g.add(m);
      if (i > 0) { const j = new THREE.Mesh(new THREE.CylinderGeometry(w / 2, w / 2, 0.05, 12), mat); j.position.set(ax, 0.025, az); j.receiveShadow = true; g.add(j); }
    }
    return g;
  }
  // A clipped hedge: a subdivided box, rounded along its top edges and darker at its foot, under a skin of small
  // leaf clusters on a jittered grid over its sides and top (one InstancedMesh a run), so it reads as clipped
  // leaves, not a painted wall.
  function hedge(s, r) {
    // `smooth`: the hedge follows a curve through its path (runs of ~0.9 m, overlapping at the joints)
    const tt = tensionOf(s.smooth);
    const pts = tt === null ? s.path || [] : smoothLine(s.path || [], tt, 0.9), h = s.h || 1.0, w = s.w || 0.6, g = group('Hedge'), M = mats();
    const leaf = s.color ? hex(s.color) : pick(r, [0x34502f, 0x3a5533, 0x2f4a30]);
    const foliage = M(leaf, leafOpts), n = lumps(r, 5, 5), leafGeo = clusterGeo(r, { detail: 1, rough: 0.14, squash: 1 });
    for (let i = 0; i < pts.length - 1; i++) {
      const [ax, az] = pts[i], [bx, bz] = pts[i + 1]; const len = Math.hypot(bx - ax, bz - az); if (len < 1e-6) continue;
      const L = len + w * 0.6, rot = -Math.atan2(bz - az, bx - ax), cx = (ax + bx) / 2, cz = (az + bz) / 2, cs = Math.cos(rot), sn = Math.sin(rot);
      const geo = new THREE.BoxGeometry(L, h, w, Math.max(2, Math.round(L / 0.22)), Math.max(2, Math.round(h / 0.22)), Math.max(2, Math.round(w / 0.2)));
      const pos = geo.attributes.position, col = new Float32Array(pos.count * 3);
      for (let k = 0; k < pos.count; k++) {
        const x = pos.getX(k); let y = pos.getY(k), z = pos.getZ(k);
        const wx = cx + x * cs + z * sn, wz = cz - x * sn + z * cs, bump = n(wx, y, wz) * 0.045;
        const topness = clamp01((y - (h / 2 - 0.2)) / 0.2), edge = clamp01((Math.abs(z) - (w / 2 - 0.15)) / 0.15);
        const shade = (0.5 + 0.3 * clamp01((y + h / 2) / h)) * (1 + n(wx * 3, y * 3, wz * 3) * 0.05);
        z *= 1 - 0.18 * topness * edge; y -= 0.08 * topness * edge;
        const sx = Math.abs(x) > L / 2 - 1e-4 ? Math.sign(x) : 0, sz = Math.abs(z) > w / 2 * 0.8 ? Math.sign(z) : 0, sy = y > h / 2 - 0.12 ? 1 : 0;
        pos.setXYZ(k, x + sx * bump, y + sy * bump + h / 2, z + sz * bump);
        col[k * 3] = shade; col[k * 3 + 1] = shade; col[k * 3 + 2] = shade * 0.97;
      }
      geo.setAttribute('color', new THREE.BufferAttribute(col, 3)); geo.computeVertexNormals();
      const seg = new THREE.Mesh(geo, foliage); seg.position.set(cx, s.y === undefined ? ctxFor().groundAt(cx, cz) : 0, cz); seg.rotation.y = rot; seg.castShadow = true; seg.receiveShadow = true; g.add(seg);   // (each run stands on the ground at its own middle: a hedge along a terrace)
      // the leaf skin, in the run's own frame (a child of the box, so it inherits position and turn)
      const step = 0.2, cl = [], j = () => (r() - 0.5) * step * 0.7;
      // each cluster is pressed flat along the face it sits on (z on the sides, y on top) — clipped, not wild
      const put = (x, y, z, up, top) => { const k = 0.13 + r() * 0.05; cl.push({ x, y, z, ry: (r() - 0.5) * 0.5, rx: (r() - 0.5) * 0.4, rz: (r() - 0.5) * 0.4, sx: k, sy: top ? k * 0.5 : k, sz: top ? k : k * 0.5, tint: (0.56 + 0.4 * up) * (0.9 + r() * 0.16) }); };
      for (let x = -L / 2 + step / 2; x < L / 2; x += step) {
        for (let y = 0.12; y < h - 0.1; y += step) for (const sgn of [-1, 1]) put(x + j(), y + j(), sgn * (w / 2 - 0.02), y / h, false);
        for (let z = -w / 2 + step * 0.6; z < w / 2 - step * 0.3; z += step) put(x + j(), h - 0.02, z + j() * 0.5, 1, true);
      }
      if (cl.length) seg.add(instanced(leafGeo, foliage, cl, 'Hedge leaves', { iso: false }));
    }
    return g;
  }
  // ---- the planting generator's plants (assets/site-planting.ts plans them, assets/site-species.ts shapes them) ----
  const SP = createSpecies({ THREE, V, clusterGeo, bushGeo, merged, grassTuft, flowerHead, shadeFacets, limbGeo });
  const css = c => '#' + (c >>> 0).toString(16).padStart(6, '0');
  // Plants of one item, one InstancedMesh per species (and one per species for its flower heads, centres and stems).
  // `lift`: what they stand on above their ground (a bed's soil). Returns the per-plant boxes the isometric twin draws
  // (the InstancedMeshes themselves are marked iso = false: one box round a whole bed's lavender reads as a slab).
  function drawPlants(g, plants, r, M, lift = 0) {
    const iso = [];
    const by = new Map();
    for (const p of plants) { if (!by.has(p.sp)) by.set(p.sp, []); by.get(p.sp).push(p); }
    for (const [sp, list] of by) {
      const info = PLANT_SPECIES[sp]; if (!info) continue;
      if (info.draw.startsWith('tree:')) {
        for (const p of list) {
          const t = tree({ species: info.draw.slice(5), h: p.h, spread: p.r / ((info.r[0] + info.r[1]) / 2) }, r);
          t.position.set(p.x, p.y, p.z); g.add(t);
          iso.push({ part: sp, shape: 'blob', color: '#4a6636', box: [p.x - p.r, p.y + p.h * 0.35, p.z - p.r, p.x + p.r, p.y + p.h, p.z + p.r] });
        }
        continue;
      }
      const S = SP.build(info.draw, r); if (!S) continue;
      const fol = S.foliage ?? 1;
      const mat = S.rock ? M(S.leaf, { roughness: 1, flatShading: true }) : M(S.leaf, S.side ? { ...leafOpts, side: S.side } : leafOpts);
      // a mound's leaves reach a little past its planting radius (the planner spaces by r; crowns should touch)
      const k = /^shrub:(mound|spreading|groundcover|silver|hosta|sedum|boxwood|hydrangea)$|^flower:/.test(info.draw) ? 1.15 : 1;
      const inst = list.map(p => ({ x: p.x, y: p.y + lift - (S.rock ? p.h * 0.25 : 0.02), z: p.z, ry: p.rot, sx: p.r * k, sy: p.h * fol, sz: p.r * k, tint: p.tint }));
      g.add(instanced(S.geo, mat, inst, `Plants (${sp})`, { iso: false }));
      const shape = sp === 'topiary-cone' || sp === 'columnar' ? 'cone' : 'blob';
      for (const p of list) iso.push({ part: sp, shape, color: css(S.leaf), box: [p.x - p.r, p.y + lift, p.z - p.r, p.x + p.r, p.y + lift + p.h * fol, p.z + p.r] });
      if (!S.heads) continue;
      // heads: the unit spots on each plant's foliage, turned and scaled with it, lifted on stems for tall kinds
      const H = S.heads, heads = [], stems = [], avgH = (info.h[0] + info.h[1]) / 2;
      for (const p of list) {
        const c = Math.cos(p.rot), s = Math.sin(p.rot), bloomC = p.bloom ?? (info.bloom ? info.bloom[0] : 0xebe6d8), k = H.scale * Math.max(0.75, Math.min(1.3, p.h / avgH));
        const n = Math.max(1, Math.round(H.spots.length * Math.min(1.4, Math.max(0.5, p.r / ((info.r[0] + info.r[1]) / 2)))));
        for (let i = 0; i < n; i++) {
          const q = H.spots[i % H.spots.length], lx = q.x * p.r * (i >= H.spots.length ? 0.8 : 1), lz = q.z * p.r * (i >= H.spots.length ? 0.8 : 1);
          const x = p.x + lx * c + lz * s, z = p.z - lx * s + lz * c, yf = p.y + lift + q.y * p.h * fol;
          const up = H.lift > 0.05 ? H.lift * p.h * (0.7 + 0.3 * r()) : H.lift * p.h;
          heads.push({ x, y: yf + up, z, ry: r() * Math.PI * 2, rx: (r() - 0.5) * 0.3, rz: (r() - 0.5) * 0.3, s: k * (0.85 + r() * 0.3), c: bloomC, t: 0.88 + r() * 0.2 });
          if (up > 0.08) stems.push({ x, y: yf - 0.04, z, s: 1.3, sy: up + 0.04 });
        }
      }
      const hm = new THREE.InstancedMesh(H.geo, M(0xffffff, { roughness: 0.75, flatShading: true }), heads.length);
      heads.forEach((h, i) => { _e.set(h.rx, h.ry, h.rz); _q.setFromEuler(_e); hm.setMatrixAt(i, _m4.compose(_p.set(h.x, h.y, h.z), _q, _s.set(h.s, h.s, h.s))); hm.setColorAt(i, _c.setHex(h.c).multiplyScalar(h.t)); });
      hm.instanceMatrix.needsUpdate = true; if (hm.instanceColor) hm.instanceColor.needsUpdate = true;
      hm.castShadow = true; hm.receiveShadow = true; hm.name = `Flower heads (${sp})`; hm.userData.iso = false; g.add(hm);
      if (H.centre) g.add(instanced(H.centre, M(0xc99a3c, { roughness: 0.7 }), heads.map(h => ({ ...h, sx: h.s, sy: h.s, sz: h.s, tint: 1 })), `Flower centres (${sp})`, { iso: false }));
      if (stems.length) { const stem = new THREE.CylinderGeometry(0.006, 0.01, 1, 4); stem.translate(0, 0.5, 0); g.add(instanced(stem, M(0x4f6a3c, { roughness: 0.9 }), stems, `Flower stems (${sp})`, { iso: false })); }
    }
    return iso;
  }

  // ---- ground materials for the generators: the kit's (site-build.ts hands `surface` in), flat colours without it --
  const surfaceMat = (name, color = null) => (surface && surface(name, color)) || std(color ?? ({ gravel: 0xa39b8c, meadow: 0x6a7448, litter: 0x4a4232, brick: 0x8e5a48, terracotta: 0xb06a4c, concrete: 0xb2afa8, decking: 0x8a6a4a, mulch: MULCH, lawn: 0x4e6a3a }[name] ?? 0x9a968e), { roughness: 0.95 });
  // a flat polygon lying at y (a meadow's floor, a pond's shore): ShapeGeometry lies in XY, turned flat it maps shape
  // y onto −z, so the outline is drawn in (x, −z)
  function flatPoly(poly, y, mat, name) {
    const geo = new THREE.ShapeGeometry(new THREE.Shape(poly.map(p => new THREE.Vector2(p[0], -p[1]))));
    const m = new THREE.Mesh(geo, mat); m.rotation.x = -Math.PI / 2; m.position.y = y; m.receiveShadow = true; m.name = name; return m;
  }
  // a slab over a polygon, top at y1, sides down to y0 (ExtrudeGeometry: shape (x, y) → plan (x, z) after rotateX(+90°))
  function slabPoly(poly, y0, y1, mat, name, holes = []) {
    const shape = new THREE.Shape(poly.map(p => new THREE.Vector2(p[0], p[1])));
    for (const h of holes) shape.holes.push(new THREE.Path(h.map(p => new THREE.Vector2(p[0], p[1]))));
    const geo = new THREE.ExtrudeGeometry(shape, { depth: Math.max(0.005, y1 - y0), bevelEnabled: false, curveSegments: 4 }); geo.rotateX(Math.PI / 2);
    const m = new THREE.Mesh(geo, mat); m.position.y = y1; m.receiveShadow = true; m.castShadow = y1 - y0 > 0.06; m.name = name; return m;
  }
  // a bed's edging as a true offset of its outline (not the old copy scaled about its centroid): steel or stone,
  // `w` wide, standing `h` proud of the ground the bed sits on
  function edging(g, poly, y, edge, M) {
    const e = typeof edge === 'object' && edge ? edge : {}, w = e.w ?? 0.08, h = e.h ?? 0.04;
    const inner = ccw(poly), outer = offsetLoop(inner, w);
    const mat = M(e.color ? hex(e.color) : KERB, { roughness: 0.85 });
    const m = slabPoly(outer, y, y + h, mat, 'Bed edging', [inner.slice().reverse()]); m.castShadow = false; g.add(m);
  }
  function soil(g, poly, y, color, M) { g.add(slabPoly(poly, y, y + 0.1, M(color ?? MULCH, { roughness: 1 }), 'Soil')); }

  // `planting`: the generator (site-planting.ts) lays out beds and plants; drawn here
  let siteCtx = null;
  const ctxFor = () => siteCtx || (siteCtx = createSiteContext(spec || { id: seed, levels: [{ y: 0, footprint: keepOut }], site: [] }));
  function planting(s, index, r) {
    const plan = planPlanting(s, index, ctxFor());
    const g = group(`Planting (${s.kind || 'border'} · ${plan.mix})`), M = mats();
    const edge = s.edge === 'none' ? null : s.edge !== undefined ? s.edge : null;
    for (const bed of plan.beds) {
      if (bed.soil) soil(g, bed.poly, bed.y, bed.mulch, M);
      if (edge) edging(g, bed.poly, bed.y, edge, M);
    }
    if (plan.floor) g.add(flatPoly(plan.floor.poly, plan.floor.y + 0.012, surfaceMat(plan.floor.kind), plan.floor.kind === 'meadow' ? 'Meadow floor' : 'Woodland floor'));
    const iso = drawPlants(g, plan.plants, r, M, plan.beds.some(b => b.soil) ? 0.08 : 0);
    iso.push(...drawPlants(g, plan.trees, r, M, 0));
    g.userData.isoParts = [...plan.beds.map(b => ({ part: 'bed', shape: 'poly', poly: b.poly.map(p => [+p[0].toFixed(3), +p[1].toFixed(3)]), color: css(b.mulch ?? MULCH), box: polyBox(b.poly, b.y, b.y + 0.1) })), ...iso];
    g.userData.plan = { beds: plan.beds.map(b => ({ poly: b.poly, wall: b.wall })), plants: plan.plants.length + plan.trees.length, mix: plan.mix };
    return g;
  }
  const polyBox = (poly, y0, y1) => { const b = bboxG(poly); return [b.x0, y0, b.z0, b.x1, y1, b.z1].map(v => +v.toFixed(3)); };

  // ---- paths: a ribbon along the (curved) centre line, in a surface ------------------------------------------------
  // top at y1, a lip down to y0 along both edges; UVs come from the material (world-mapped kit surfaces)
  function ribbonMesh(line, w, y0, y1, mat, name) {
    const L = ribbon(line, w), n = line.length, pos = [];
    const P = i => L[i], Q = i => L[2 * n - 1 - i];   // left edge i, right edge i
    // one triangle, wound so its normal points along `want`
    const tri = (a, b, c, want) => {
      const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
      const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
      if (nx * want[0] + ny * want[1] + nz * want[2] >= 0) pos.push(...a, ...b, ...c); else pos.push(...a, ...c, ...b);
    };
    for (let i = 0; i < n - 1; i++) {
      const a = P(i), b = P(i + 1), c = Q(i + 1), d = Q(i), m = line[i];
      tri([a[0], y1, a[1]], [d[0], y1, d[1]], [b[0], y1, b[1]], [0, 1, 0]); tri([b[0], y1, b[1]], [d[0], y1, d[1]], [c[0], y1, c[1]], [0, 1, 0]);
      for (const [u, v] of [[a, b], [d, c]]) {
        const out = [u[0] - m[0], 0, u[1] - m[1]];
        tri([u[0], y0, u[1]], [u[0], y1, u[1]], [v[0], y1, v[1]], out); tri([u[0], y0, u[1]], [v[0], y1, v[1]], [v[0], y0, v[1]], out);
      }
    }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.computeVertexNormals();
    const mesh = new THREE.Mesh(geo, mat); mesh.receiveShadow = true; mesh.name = name;
    return mesh;
  }
  // stones along a line: stepping stones (one every stride, alternating a little) or crazy-paving flagstones (the
  // ribbon cut into Voronoi cells round Poisson points, each shrunk by the joint). One mesh, a tint per stone.
  function stones(g, line, w, y, r, color, crazy, M) {
    const pos = [], col = [];
    const addStone = (poly, h, tone) => {
      const c = poly.reduce((a, p) => [a[0] + p[0] / poly.length, a[1] + p[1] / poly.length], [0, 0]);
      const top = y + h;
      for (let i = 0; i < poly.length; i++) {
        const a = poly[i], b = poly[(i + 1) % poly.length];
        pos.push(c[0], top, c[1], b[0], top, b[1], a[0], top, a[1]); for (let k = 0; k < 3; k++) col.push(tone, tone, tone);
        pos.push(a[0], y, a[1], a[0], top, a[1], b[0], top, b[1], a[0], y, a[1], b[0], top, b[1], b[0], y, b[1]); for (let k = 0; k < 6; k++) col.push(tone * 0.8, tone * 0.8, tone * 0.8);
      }
    };
    if (!crazy) {
      const L = lengthOf(line), stride = 0.62, n = Math.max(1, Math.floor(L / stride)), N = lineNormals(line);
      let acc = 0, seg = 0;
      for (let k = 0; k < n; k++) {
        const target = (k + 0.5) * L / n;
        while (seg < line.length - 2 && acc + dist(line[seg], line[seg + 1]) < target) { acc += dist(line[seg], line[seg + 1]); seg++; }
        const t = (target - acc) / (dist(line[seg], line[seg + 1]) || 1), cx = line[seg][0] + (line[seg + 1][0] - line[seg][0]) * t, cz = line[seg][1] + (line[seg + 1][1] - line[seg][1]) * t;
        const off = (k % 2 ? 1 : -1) * w * 0.1 + (r() - 0.5) * w * 0.08, nx = N[seg][0], nz = N[seg][1];
        const R = Math.min(w, 0.7) * (0.36 + r() * 0.06), sides = 7 + Math.floor(r() * 3), a0 = r() * Math.PI;
        const poly = Array.from({ length: sides }, (_, i) => { const a = a0 + (i / sides) * Math.PI * 2, rr = R * (0.82 + r() * 0.3); return [cx + nx * off + Math.cos(a) * rr * 1.1, cz + nz * off + Math.sin(a) * rr * 0.85] as [number, number]; });
        addStone(poly, 0.035 + r() * 0.01, 0.9 + r() * 0.2);
      }
    } else {
      const outline = ribbon(line, w), bb = bboxG(outline), joint = 0.035;
      const seeds = poisson(r, bb, 0.42, (x, z) => inPolyG(x, z, outline), { seeds: 3, grid: 0.4 });
      for (const [sx, sz] of seeds) {
        let cell = rectPoly([sx, sz], 1.2, 1.2, 0);
        for (const [ox, oz] of seeds) {
          if (ox === sx && oz === sz || Math.hypot(ox - sx, oz - sz) > 1.2) continue;
          const nx = ox - sx, nz = oz - sz, mx = (ox + sx) / 2, mz = (oz + sz) / 2, l = Math.hypot(nx, nz);
          cell = halfPlane(cell, nx / l, nz / l, (nx * mx + nz * mz) / l - joint / 2);
          if (cell.length < 3) break;
        }
        if (cell.length < 3) continue;
        // keep it inside the path's outline: pull any corner outside back toward the stone's centre
        cell = cell.map(p => { let q = p; for (let k = 0; k < 6 && !inPolyG(q[0], q[1], outline); k++) q = [q[0] + (sx - q[0]) * 0.3, q[1] + (sz - q[1]) * 0.3]; return q; });
        addStone(cell, 0.03 + r() * 0.012, 0.86 + r() * 0.24);
      }
    }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); geo.computeVertexNormals();
    const m = new THREE.Mesh(geo, M(color, { roughness: 0.9, vertexColors: true, flatShading: true })); m.castShadow = false; m.receiveShadow = true; m.name = crazy ? 'Flagstones' : 'Stepping stones';
    g.add(m);
  }
  // timber decking laid across the walk: boards square to the line, on two dark bearers
  function boards(g, line, w, y, color, r, M) {
    const L = lengthOf(line), n = Math.max(1, Math.floor(L / 0.16)), pts = resample(line, L / n), N = lineNormals(pts), list = [];
    for (let i = 0; i < pts.length; i++) {
      const [x, z] = pts[i], [nx, nz] = N[i], a = Math.atan2(-nz, nx);
      list.push({ x, y: y + 0.07, z, ry: a, sx: w * (Math.hypot(nx, nz)), sy: 1, sz: 1, tint: 0.85 + r() * 0.25 });
    }
    const board = new THREE.BoxGeometry(1, 0.03, 0.14);
    g.add(instanced(board, M(color, { roughness: 0.75 }), list, 'Deck boards', { isoShape: 'box' }));
    for (const off of [-w * 0.35, w * 0.35]) g.add(ribbonMesh(pts.map((p, i) => [p[0] + N[i][0] * off, p[1] + N[i][1] * off]), 0.08, y, y + 0.055, M(0x3a3129, { roughness: 0.9 }), 'Bearer'));
  }
  function surfacedPath(s, r) {
    const line = ctxFor().pathLine(s), w = s.w || 1.0, kind = PATH_SURFACES.includes(s.surface) ? s.surface : 'concrete', g = group(`Path (${kind})`), M = mats();
    if (line.length < 2) return g;
    const color = s.color ? hex(s.color) : null;
    if (kind === 'stepping') stones(g, line, w, 0.0, r, color ?? 0x9d978c, false, M);
    else if (kind === 'flagstone') { g.add(ribbonMesh(line, w, 0, 0.018, surfaceMat('gravel', 0x8f887c), 'Joints')); stones(g, line, w, 0.015, r, color ?? 0xa39d92, true, M); }
    else if (kind === 'decking') boards(g, line, w, 0, color ?? 0x8a6a4a, r, M);
    else g.add(ribbonMesh(line, w, 0, kind === 'gravel' ? 0.03 : 0.05, surfaceMat(kind, color), 'Path surface'));
    g.userData.plan = { line, w };
    return g;
  }

  // ---- water with a shore: an organic pond (`poly`, or `shape: 'organic'`) -----------------------------------------
  function pondOrganic(s, r) {
    const g = group('Pond'), M = mats(), t = tensionOf(s.smooth ?? true);
    const w = s.w || 4, d = s.d || 3;
    let outline = Array.isArray(s.poly) && s.poly.length >= 3 ? (t === null ? s.poly : smoothLoop(s.poly, t, 0.25)) : blobLocal(r, w, d);
    outline = noisyLoop(outline, r, 0.1, 1.4, 0.2);
    const shore = offsetLoop(outline, 0.32);
    g.add(flatPoly(shore, 0.018, M(0x5f574c, { roughness: 1 }), 'Shore'));
    const water = surface ? surface('water') : null;
    g.add(flatPoly(outline, 0.04, water || std(0x184b57, { roughness: 0.1 }), 'Water'));
    // rocks round the shore: seeded count and sizes, some big ones, half sunk
    const L = lengthOf(outline, true), n = Math.max(6, Math.round(L / 0.9)), list = [];
    const ring = resample(outline, L / n, true);
    for (let i = 0; i < ring.length; i++) {
      if (r() < 0.25) continue;
      const [x, z] = ring[i], big = r() < 0.15, k = big ? 0.26 + r() * 0.14 : 0.1 + r() * 0.13, out = 0.1 + r() * 0.15;
      const c = [ring[(i + 1) % ring.length][0] - ring[(i - 1 + ring.length) % ring.length][0], ring[(i + 1) % ring.length][1] - ring[(i - 1 + ring.length) % ring.length][1]], l = Math.hypot(c[0], c[1]) || 1;
      const nx = c[1] / l, nz = -c[0] / l;   // outward (the loop is positive-area: out is left of travel on a north-up plan)
      list.push({ x: x + nx * out, y: k * 0.25, z: z + nz * out, rx: r() * 0.5, ry: r() * Math.PI * 2, rz: r() * 0.4, sx: k * (1 + r() * 0.5), sy: k * (0.55 + r() * 0.25), sz: k * (1 + r() * 0.4), tint: 0.85 + r() * 0.3 });
    }
    g.add(instanced(new THREE.DodecahedronGeometry(1, 0), M(pick(r, [0x6d6a65, 0x74706a, 0x67635d]), { roughness: 1, flatShading: true }), list, 'Shore rocks', { isoShape: 'blob' }));
    // marginal planting: a few tufts where the shore is not rock, and lily pads on the water
    const tufts = [];
    for (let i = 0; i < ring.length; i += 2 + Math.floor(r() * 3)) { const [x, z] = ring[i]; tufts.push({ sp: r() < 0.6 ? 'grass' : 'fern', x, z, y: 0, h: 0.6 + r() * 0.5, r: 0.28 + r() * 0.12, rot: r() * 6.28, tint: 0.9 + r() * 0.2, bloom: null, layer: 'mid' }); }
    const iso = drawPlants(g, tufts, r, M, 0);
    const bb = bboxG(outline), pads = [];
    for (let i = 0; i < 40 && pads.length < Math.round(w * d * 0.5); i++) { const x = bb.x0 + r() * (bb.x1 - bb.x0), z = bb.z0 + r() * (bb.z1 - bb.z0); if (inPolyG(x, z, offsetLoop(outline, -0.4))) pads.push({ x, y: 0.045, z, ry: r() * 6.28, s: 0.12 + r() * 0.1, sy: 1, tint: 0.85 + r() * 0.25 }); }
    if (pads.length) { const pad = new THREE.CircleGeometry(1, 9, 0.3, Math.PI * 2 - 0.3); pad.rotateX(-Math.PI / 2); g.add(instanced(pad, M(0x4f6b3a, { roughness: 0.6 }), pads.map(p => ({ ...p, sx: p.s, sz: p.s })), 'Lily pads', { iso: false })); }
    g.userData.isoParts = [{ part: 'water', shape: 'poly', poly: outline.map(p => [+p[0].toFixed(3), +p[1].toFixed(3)]), color: '#3b82c4', box: polyBox(outline, 0, 0.04) }, ...iso];
    return g;
  }
  const blobLocal = (r, w, d) => { const pts = []; const k = [0, 1, 2].map(i => ({ f: 2 + i, p: r() * 6.28, a: (0.55 + r() * 0.45) / (i + 1) })); for (let i = 0; i < 48; i++) { const a = i / 48 * Math.PI * 2, q = 1 + 0.14 * k.reduce((v, o) => v + o.a * Math.sin(a * o.f + o.p), 0); pts.push([Math.cos(a) * w / 2 * q, Math.sin(a) * d / 2 * q]); } return pts; };

  // ---- structures: an open pergola, a climber, string lights ------------------------------------------------------
  // Pergola: posts, two beams, rafters across and (modern) fine slats over them, an optional climber over the top.
  // `style`: timber | modern (dark steel, slatted) ; `color` the frame ; `climber`: wisteria | vine | rose | none.
  function pergola(s, r) {
    const w = s.w || 4, d = s.d || 3, h = s.h || 2.6, modern = s.style === 'modern', g = group('Pergola'), M = mats();
    const frame = M(s.color ? hex(s.color) : modern ? 0x2b2d30 : 0x6b5440, { roughness: modern ? 0.5 : 0.8, metalness: modern ? 0.4 : 0 });
    const P = modern ? 0.1 : 0.15, nx = Math.max(1, Math.ceil((w - 0.2) / 3)), posts = [];
    for (let i = 0; i <= nx; i++) for (const z of [-d / 2 + P / 2 + 0.05, d / 2 - P / 2 - 0.05]) posts.push([-w / 2 + P / 2 + 0.05 + (w - P - 0.1) * i / nx, z]);
    for (const [x, z] of posts) g.add(box(P, h - 0.2, P, frame, x, (h - 0.2) / 2, z));
    for (const z of [-d / 2 + P / 2 + 0.05, d / 2 - P / 2 - 0.05]) g.add(box(w + 0.5, 0.2, modern ? 0.1 : 0.08, frame, 0, h - 0.1, z));
    const nr = Math.max(3, Math.round((w + 0.3) / (modern ? 0.35 : 0.5)));
    for (let i = 0; i <= nr; i++) g.add(box(modern ? 0.05 : 0.06, modern ? 0.14 : 0.16, d + 0.5, frame, -w / 2 - 0.1 + (w + 0.2) * i / nr, h + (modern ? 0.07 : 0.08), 0));
    if (modern) for (let z = -d / 2 - 0.2; z <= d / 2 + 0.2; z += 0.14) g.add(box(w + 0.3, 0.025, 0.05, frame, 0, h + 0.155, z, false));
    const c = s.climber && s.climber !== 'none' ? s.climber : null;
    if (c) climberOver(g, r, M, c, w, d, h, posts);
    g.userData.solids = posts.map(([x, z]) => ({ kind: 'post', x, z, w: P, d: P, yMin: 0, yMax: h }));
    return g;
  }
  // a climber over a pergola's top: a gnarled stem up two posts, a mat of foliage over the rafters, and (wisteria)
  // lilac racemes hanging through them
  function climberOver(g, r, M, kind, w, d, h, posts) {
    const leaf = kind === 'wisteria' ? 0x55703c : kind === 'rose' ? 0x3f5c35 : 0x46663a, foliage = M(leaf, leafOpts), bark = M(0x5a4a3d, barkOpts);
    const wood = [];
    for (const [x, z] of [posts[0], posts[posts.length - 1]]) {
      let p = V(x + 0.12, 0, z + 0.1);
      for (let k = 0; k < 5; k++) { const q = V(x + 0.12 + (r() - 0.5) * 0.15, h * (k + 1) / 5, z + 0.1 + (r() - 0.5) * 0.15); wood.push(limbGeo(p, q, 0.05 - k * 0.006, 0.045 - k * 0.006, 5)); p = q; }
    }
    woodMesh(g, wood, bark);
    const lobes = [];
    for (let i = 0; i < 7; i++) lobes.push({ c: V(-w / 2 + w * (i + 0.5) / 7 + (r() - 0.5) * 0.3, h + 0.26, (r() - 0.5) * d * 0.4), rx: w / 7 * 0.95, ry: 0.2, rz: d * 0.44, n: 34, inner: 0.25, floor: -0.9 });
    crown(g, r, lobes, foliage, { size: 0.11, gap: 0.85, sq: 0.75, core: 0, dark: 0.58, lift: 0.38 });
    if (kind === 'wisteria' || kind === 'rose') {
      // racemes: drooping cones of florets under the rafters (wisteria) or blooms on the mat (rose)
      const spots = [];
      for (let i = 0; i < (kind === 'wisteria' ? 70 : 40); i++) spots.push(V(-w / 2 + r() * w, kind === 'wisteria' ? h - 0.05 - r() * 0.1 : h + 0.35 + r() * 0.15, -d / 2 + r() * d));
      if (kind === 'wisteria') {
        const rac = new THREE.ConeGeometry(0.06, 0.45, 6, 3); rac.rotateX(Math.PI); rac.translate(0, -0.22, 0);
        const rp = rac.attributes.position; for (let i = 0; i < rp.count; i++) { const y = rp.getY(i); rp.setX(i, rp.getX(i) * (1 + 0.25 * Math.sin(y * 40))); }
        rac.computeVertexNormals();
        g.add(instanced(rac, M(0xa18ac1, { roughness: 0.8, flatShading: true }), spots.map(p => ({ x: p.x, y: p.y, z: p.z, ry: r() * 6.28, rx: (r() - 0.5) * 0.25, s: 0.8 + r() * 0.5, tint: 0.85 + r() * 0.25 })), 'Wisteria racemes', { iso: false }));
      } else flowerHeads(g, 'rose', 0xc98aa3, spots, r, M, 1.4);
    }
  }
  // `climber`: a wall climber along from → to, up to h (wisteria, ivy, rose) — a flat mat of foliage on the wall face
  function climber(s, r) {
    const g = group('Climber'), M = mats(), kind = s.species || 'ivy';
    const a = s.from || [0, 0], b = s.to || [1, 0], h = s.h || 2.4, y0 = s.y ?? 0, L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    const leaf = kind === 'wisteria' ? 0x55703c : kind === 'rose' ? 0x3f5c35 : 0x3a5a33, foliage = M(leaf, leafOpts);
    const lobes = [], n = Math.max(2, Math.round(L / 0.9));
    for (let i = 0; i < n; i++) {
      const t = (i + 0.5) / n, x = a[0] + (b[0] - a[0]) * t, z = a[1] + (b[1] - a[1]) * t, hh = h * (0.55 + r() * 0.45);
      lobes.push({ c: V(x, y0 + hh * 0.55, z), rx: L / n * 0.75, ry: hh * 0.5, rz: 0.12, n: Math.round(10 + hh * 6), inner: 0.6, floor: -1 });
    }
    // the mat is flat against the wall: squash each lobe across the line (rz) by turning the lobes' frame
    const ang = Math.atan2(b[1] - a[1], b[0] - a[0]);
    for (const l of lobes) { const cx = l.c.x, cz = l.c.z; l.c.set(cx, l.c.y, cz); const rx = l.rx; l.rx = Math.abs(Math.cos(ang)) * rx + Math.abs(Math.sin(ang)) * 0.12; l.rz = Math.abs(Math.sin(ang)) * rx + Math.abs(Math.cos(ang)) * 0.12; }
    const list = crown(g, r, lobes, foliage, { size: 0.14, gap: 0.8, sq: 0.8, core: 0, dark: 0.55, lift: 0.35 });
    if (kind === 'wisteria' || kind === 'rose') {
      const top = list.filter(p => p.y > y0 + h * 0.35), spots = Array.from({ length: Math.round(L * 8) }, () => { const p = pick(r, top.length ? top : list); return V(p.x, p.y - 0.05, p.z); });
      if (kind === 'wisteria') {
        const rac = new THREE.ConeGeometry(0.055, 0.4, 6, 2); rac.rotateX(Math.PI); rac.translate(0, -0.2, 0);
        g.add(instanced(rac, M(0xa18ac1, { roughness: 0.8, flatShading: true }), spots.map(p => ({ x: p.x, y: p.y, z: p.z, ry: r() * 6.28, s: 0.8 + r() * 0.4, tint: 0.85 + r() * 0.25 })), 'Wisteria racemes', { iso: false }));
      } else flowerHeads(g, 'rose', s.color ? hex(s.color) : 0xc98aa3, spots, r, M, 1.4);
    }
    return g;
  }
  // `string-lights`: festoon lights along `path` at `h`, sagging between poles (or the points you give)
  function stringLights(s, r) {
    const g = group('String Lights'), M = mats(), pts = s.path || [], h = s.h || 2.6, sag = s.sag ?? 0.3;
    const pole = M(0x2b2d30, { roughness: 0.6, metalness: 0.4 }), wire = M(0x1f1f1f, { roughness: 0.8 });
    if (s.posts !== false) for (const [x, z] of pts) g.add(box(0.07, h + 0.05, 0.07, pole, x, (h + 0.05) / 2, z));
    const bulbs = [];
    for (let i = 0; i < pts.length - 1; i++) {
      const [ax, az] = pts[i], [bx, bz] = pts[i + 1], L = Math.hypot(bx - ax, bz - az), n = Math.max(2, Math.round(L / 0.5));
      let prev = V(ax, h, az);
      for (let k = 1; k <= n; k++) {
        const t = k / n, y = h - sag * 4 * t * (1 - t) * Math.min(1, L / 4), p = V(ax + (bx - ax) * t, y, az + (bz - az) * t);
        const seg = new THREE.Mesh(limbGeo(prev, p, 0.006, 0.006, 3), wire); seg.castShadow = false; g.add(seg); prev = p;
        if (k < n) bulbs.push({ x: p.x, y: p.y - 0.06, z: p.z, s: 1, tint: 0.95 + r() * 0.1 });
      }
    }
    if (bulbs.length) {
      const bulb = new THREE.SphereGeometry(0.035, 8, 6);
      const mat = new THREE.MeshStandardMaterial({ color: 0xfff1d6, emissive: 0xffc98f, emissiveIntensity: 0.9, roughness: 0.3 });
      const im = instanced(bulb, mat, bulbs, 'Bulbs', { iso: false, fixture: 'string' }); im.castShadow = false; g.add(im);
    }
    return g;
  }

  // On a terrace (A3) each item of a scatter or a grove stands on the ground at its own spot: site-build.ts lifts the
  // group by the ground at its centre, so an item is set off by what the ground there differs by (nothing on a flat lot,
  // nor on a group with a `y` of its own). The group turns by `rot` about its centre.
  const followGround = (s, x, z) => {
    if (s.y !== undefined || !Array.isArray(s.at)) return 0;
    const c = ctxFor(), a = (s.rot || 0) * Math.PI / 180;
    return c.groundAt(s.at[0] + x * Math.cos(a) + z * Math.sin(a), s.at[1] - x * Math.sin(a) + z * Math.cos(a)) - c.groundAt(s.at[0], s.at[1]);
  };
  function scatter(s, r) {
    const R = s.r || 2, n = s.n || 6, species = s.species || ['shrub', 'rock', 'flowers'], g = group('Scatter');
    if (s.layout === 'poisson' || gen2) {
      // Poisson-disk spaced (no two within the spacing that fits n in the disc), each item then placed as below
      const sp = R * Math.sqrt(Math.PI / Math.max(1, n)) * 0.78;
      const pts = poisson(r, { x0: -R, z0: -R, x1: R, z1: R }, sp, (x, z) => x * x + z * z <= R * R, { seeds: 2, grid: sp, max: n });
      for (const [x, z] of pts) {
        const sp2 = pick(r, species);
        const o = sp2 === 'rock' ? rock({ r: 0.25 + r() * 0.3 }, r) : sp2 === 'flowers' ? flowers({ r: 0.3 + r() * 0.25 }, r) : sp2 === 'tree' ? tree({ h: 3 + r() * 2 }, r) : shrub({ r: 0.3 + r() * 0.4 }, r);
        o.position.set(x, followGround(s, x, z), z); g.add(o);
      }
      return g;
    }
    for (let i = 0; i < n; i++) {
      const a = r() * Math.PI * 2, d = Math.sqrt(r()) * R, sp = pick(r, species);
      const o = sp === 'rock' ? rock({ r: 0.25 + r() * 0.3 }, r) : sp === 'flowers' ? flowers({ r: 0.3 + r() * 0.25 }, r) : sp === 'tree' ? tree({ h: 3 + r() * 2 }, r) : shrub({ r: 0.3 + r() * 0.4 }, r);
      o.position.set(Math.cos(a) * d, followGround(s, Math.cos(a) * d, Math.sin(a) * d), Math.sin(a) * d); g.add(o);
    }
    return g;
  }
  function grove(s, r) {
    const R = s.r || 3, n = s.n || 4, g = group('Grove');
    const species = s.species || pick(r, ['broad', 'oval', 'layered', 'birch']);
    for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2 + r() * 1.2, d = R * (0.3 + r() * 0.7); const t = tree({ h: (s.h || 5) * (0.75 + r() * 0.5), species: typeof species === 'string' ? species : pick(r, species) }, r); t.position.set(Math.cos(a) * d, followGround(s, Math.cos(a) * d, Math.sin(a) * d), Math.sin(a) * d); g.add(t); }
    return g;
  }

  // `s` and its index in spec.site → a built object (or null when the type is not ours)
  function build(s, index) {
    const r = rngFor(s, index);
    switch (s.type) {
      case 'tree': return tree(s, r);
      case 'cypress': { const t = tree({ ...s, species: 'columnar', h: s.h || 4.2 }, r); t.name = 'Cypress'; return t; }
      case 'palm': { const t = tree({ ...s, species: 'palm', h: s.h || 6 }, r); t.name = 'Palm'; return t; }
      case 'shrub': return shrub(s, r);
      case 'planter': return planter(s, r);
      case 'flowers': return flowers(s, r);
      case 'rock': return rock(s, r);
      case 'bed': return bed(s, r);
      case 'path': return pathStrip(s, r);
      case 'hedge': return hedge(s, r);
      case 'scatter': return scatter(s, r);
      case 'grove': return grove(s, r);
      case 'planting': return planting(s, index, r);
      case 'climber': return climber(s, r);
      case 'string-lights': return stringLights(s, r);
      // the kit answers these only in their new forms; otherwise site-build.ts's page builders do (unchanged)
      case 'pond': return organicPond(s) ? pondOrganic(s, r) : null;
      case 'pergola': return pergola(s, r);
      default: return null;
    }
  }
  const organicPond = s => (Array.isArray(s.poly) && s.poly.length >= 3) || s.shape === 'organic' || (gen2 && s.shape !== 'ellipse');
  // seeded jitter for site props built elsewhere: scale, lean, spin (cypress and palm are the kit's own now; kept
  // for any caller that still builds one outside it)
  function vary(obj, s, index) {
    if (s.jitter === false) return obj;
    const r = rngFor(s, index);
    const k = 0.85 + r() * 0.3; obj.scale.set(k, k * (0.95 + r() * 0.15), k);
    obj.rotation.y = r() * Math.PI * 2; obj.rotation.z = (r() - 0.5) * 0.05;
    return obj;
  }
  const ANCHORED = new Set(['bed', 'path', 'hedge', 'planting', 'climber', 'string-lights']);   // these carry their own world coordinates
  // (a pond drawn round a `poly` does too; one at `at` is placed and turned like any other item)
  const anchored = (t, s = null) => ANCHORED.has(t) || (t === 'pond' && !!s && Array.isArray(s.poly) && s.poly.length >= 3);
  return { build, vary, anchored, rngFor, context: ctxFor, drawPlants, flatPoly, slabPoly, surfaceMat, tree };
}
