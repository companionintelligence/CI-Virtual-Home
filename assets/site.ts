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
const SPECIES = { round: 'broad', broad: 'broad', oval: 'oval', layered: 'layered', conical: 'conical', columnar: 'columnar', cypress: 'columnar', palm: 'palm', birch: 'birch' };
const DEFAULT_SPECIES = ['broad', 'broad', 'broad', 'oval', 'oval', 'conical', 'birch', 'layered'];
const FLOWER_KINDS = ['daisy', 'tulip', 'lavender', 'bloom', 'bloom'];
const PETAL = { daisy: [0xefeadb, 0xe8dcc0], tulip: [0xc46b7b, 0xd6a04b, 0xb45a4b, 0xd595a6], lavender: [0x8f7cb8, 0x9b88c0], bloom: BLOOM };

// The site types build() below answers (its switch's cases): the validator reads this list, so a type added to
// build() is added here too, or specs using it fail validation.
export const SITE_KIT_TYPES: readonly string[] = ['tree', 'cypress', 'palm', 'shrub', 'planter', 'flowers', 'rock', 'bed', 'path', 'hedge', 'scatter', 'grove'];

// `keepOut` is the ground storey's footprint ({ x, z, w, d } rects): the walls stand on its edge, and a bed plants
// nothing that would reach through them.
export function createSiteKit({ THREE, seed = 'house', std, mix, keepOut = [] }) {
  const hex = c => typeof c === 'string' ? parseInt(c.replace('#', ''), 16) : c;
  const group = name => { const g = new THREE.Group(); g.name = name; g.userData = { category: 'Site' }; return g; };
  const rngFor = (item, index) => mulberry32(fnv1a(`${seed}:site:${index}:${item.type}`));
  const pick = (r, arr) => arr[Math.floor(r() * arr.length)];
  const jitter = (r, base, amt) => base * (1 + (r() - 0.5) * 2 * amt);
  const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
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

  function tree(s, r) {
    const jit = s.jitter !== false;
    const species = SPECIES[s.species] || (s.species ? 'broad' : pick(r, DEFAULT_SPECIES));
    const h = jitter(r, s.h || (species === 'palm' ? 6 : species === 'columnar' ? 4.2 : 5), jit ? 0.16 : 0);
    const deciduousish = species === 'broad' || species === 'oval' || species === 'layered' || species === 'birch';
    const leaf = s.color ? hex(s.color) : s.autumn && deciduousish ? pick(r, AUTUMN)
      : pick(r, species === 'oval' || species === 'layered' ? GREEN.broad : GREEN[species] || GREEN.broad);
    const g = group(`Tree (${species})`), M = mats();
    if (species === 'conical') conifer(g, h, r, leaf, M);
    else if (species === 'columnar') columnar(g, h, r, leaf, M);
    else if (species === 'palm') palm(g, h, r, leaf, M);
    else if (species === 'birch') birch(g, h, r, leaf, M);
    else deciduous(g, h, r, leaf, species, M);
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

  function shrub(s, r) {
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
    const poly = polyOf(s), g = group('Planted Bed'), M = mats();
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
    const cx0 = poly.reduce((a, p) => a + p[0], 0) / poly.length, cz0 = poly.reduce((a, p) => a + p[1], 0) / poly.length;
    const kerbShape = new THREE.Shape(poly.map(([px, pz]) => {
      let x = cx0 + (px - cx0) * 1.06, z = cz0 + (pz - cz0) * 1.06;
      if (houseGap(x, z) === 0 && houseGap(px, pz) > 0) { x = px; z = pz; }
      return new THREE.Vector2(x, -z);
    }));
    const edging = new THREE.Mesh(new THREE.ShapeGeometry(kerbShape), std(KERB, { roughness: 0.9 })); edging.rotation.x = -Math.PI / 2; edging.position.y = 0.005; g.add(edging); // ground shadow of the kerb
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
    const pts = s.path || [], h = s.h || 1.0, w = s.w || 0.6, g = group('Hedge'), M = mats();
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
      const seg = new THREE.Mesh(geo, foliage); seg.position.set(cx, 0, cz); seg.rotation.y = rot; seg.castShadow = true; seg.receiveShadow = true; g.add(seg);
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
  function scatter(s, r) {
    const R = s.r || 2, n = s.n || 6, species = s.species || ['shrub', 'rock', 'flowers'], g = group('Scatter');
    for (let i = 0; i < n; i++) {
      const a = r() * Math.PI * 2, d = Math.sqrt(r()) * R, sp = pick(r, species);
      const o = sp === 'rock' ? rock({ r: 0.25 + r() * 0.3 }, r) : sp === 'flowers' ? flowers({ r: 0.3 + r() * 0.25 }, r) : sp === 'tree' ? tree({ h: 3 + r() * 2 }, r) : shrub({ r: 0.3 + r() * 0.4 }, r);
      o.position.set(Math.cos(a) * d, 0, Math.sin(a) * d); g.add(o);
    }
    return g;
  }
  function grove(s, r) {
    const R = s.r || 3, n = s.n || 4, g = group('Grove');
    const species = s.species || pick(r, ['broad', 'oval', 'layered', 'birch']);
    for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2 + r() * 1.2, d = R * (0.3 + r() * 0.7); const t = tree({ h: (s.h || 5) * (0.75 + r() * 0.5), species: typeof species === 'string' ? species : pick(r, species) }, r); t.position.set(Math.cos(a) * d, 0, Math.sin(a) * d); g.add(t); }
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
      default: return null;
    }
  }
  // seeded jitter for site props built elsewhere: scale, lean, spin (cypress and palm are the kit's own now; kept
  // for any caller that still builds one outside it)
  function vary(obj, s, index) {
    if (s.jitter === false) return obj;
    const r = rngFor(s, index);
    const k = 0.85 + r() * 0.3; obj.scale.set(k, k * (0.95 + r() * 0.15), k);
    obj.rotation.y = r() * Math.PI * 2; obj.rotation.z = (r() - 0.5) * 0.05;
    return obj;
  }
  const ANCHORED = new Set(['bed', 'path', 'hedge']);   // these carry their own world coordinates
  return { build, vary, anchored: t => ANCHORED.has(t), rngFor };
}
