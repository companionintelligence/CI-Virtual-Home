// Plants — potted, hanging and tabletop greenery. Faceted foliage (IcosahedronGeometry detail 1 and 4-sided
// cones, all flat-shaded) on simple pots; anything that arches — palm and fern fronds, trailing vines — is one
// curved tapered-ribbon mesh from kit.frond, so a crown of 28 fronds is still 28 meshes. Pots take colors.accent
// or terracotta (an explicit it.color wins); leaves come from a small green set picked with ctx.rng, so two of the
// same type in one house differ.
// Every prop: origin at the floor centre of its footprint, faces +z at rot 0; the surface: true ones sit on a
// desk / counter / shelf and are placed at desk height by the builder.
import { registerProps } from './registry.js';

const GREENS = [0x2d6a4f, 0x386641, 0x40916c, 0x4f772d, 0x588157, 0x6a994e];
const SILVER = [0x5c6e57, 0x6b7f62, 0x74876a, 0x7d8f6f];          // olive and rosemary grey-greens
const TERRACOTTA = 0xc2703e, SOIL = 0x3b2a1e, GRAVEL = 0xd6d3d1, BARK = 0x5b4636, STEM = 0x4f6b3a;
const pick = (rng, arr) => arr[Math.floor(rng() * arr.length)];
const jit = (rng, a) => (rng() - 0.5) * 2 * a;
const potColor = (it, colors, rng, hex) => it.color ? hex(it.color) : (rng() < 0.5 ? colors.accent : TERRACOTTA);

// Per-prop toolkit over the ctx helpers. Headings: a = 0 points at +z (south, the front), a = π/2 at +x.
function kit({ THREE, std }) {
  const leafMat = c => std(c, { flatShading: true, roughness: 0.7 });
  const add = (g, m, x, y, z) => { m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; g.add(m); return m; };
  // a faceted blob, scaled to shape, swung to heading ry and tilted by rx (order YXZ: tilt first, then heading)
  const blob = (g, r, mat, x, y, z, sx = 1, sy = 1, sz = 1, ry = 0, rx = 0) => {
    const m = add(g, new THREE.Mesh(new THREE.IcosahedronGeometry(r, 1), mat), x, y, z);
    m.scale.set(sx, sy, sz); m.rotation.order = 'YXZ'; m.rotation.set(rx, ry, 0); return m;
  };
  const cyl = (g, rt, rb, h, mat, x, y, z, seg = 16) => add(g, new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat), x, y, z);
  // a thin cylinder from a to b (stems, chains, vines, trunks)
  const strut = (g, a, b, r, mat, seg = 6) => {
    const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b), d = B.clone().sub(A), L = d.length();
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, L, seg), mat);
    m.position.copy(A).add(B).multiplyScalar(0.5); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
    m.castShadow = true; g.add(m); return m;
  };
  // a blade / frond: a flattened 4-sided cone with its base at (x, y, z), heading a, tilted t from vertical
  // (t = π/2 is horizontal, more droops); the wide face is tangential so blades face outward
  const blade = (g, r, L, mat, x, y, z, a, t, flat = 0.3) => {
    const geo = new THREE.ConeGeometry(r, L, 4); geo.translate(0, L / 2, 0);
    const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.scale.set(1, 1, flat);
    m.rotation.order = 'YXZ'; m.rotation.set(t, a, 0); m.castShadow = true; g.add(m); return m;
  };
  // a leaf / frond: a faceted spindle (widest mid-way, tapering both ends) with its base at (x, y, z), heading a,
  // tilted t from vertical — w wide, L long, th thick
  const leaf = (g, w, L, th, mat, x, y, z, a, t) => {
    const geo = new THREE.IcosahedronGeometry(1, 1); geo.translate(0, 1, 0);
    const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.scale.set(w / 2, L / 2, th / 2);
    m.rotation.order = 'YXZ'; m.rotation.set(t, a, 0); m.castShadow = true; g.add(m); return m;
  };
  // a pot and its soil; returns the rim height. The pot is a closed cylinder, so the soil disc sits 8 mm proud of
  // the rim (inside it) rather than hidden under the cap.
  const pot = (g, rt, rb, h, mat, { x = 0, z = 0, y = 0, seg = 20, soil = null } = {}) => {
    cyl(g, rt, rb, h, mat, x, y + h / 2, z, seg);
    cyl(g, rt * 0.88, rt * 0.88, 0.02, soil || std(SOIL, { roughness: 1 }), x, y + h - 0.002, z, seg);
    return y + h;
  };
  // a curved frond / vine in ONE mesh: a tapered ribbon (w wide at its widest, th thick, L long along the curve)
  // swept from its base at (x, y, z) on heading a, leaving at tilt t0 from vertical and bending a further `bend`
  // radians (down when positive) by the tip — θ(u) = t0 + bend·u^pow, so pow < 1 bends early then runs straight
  // (a vine over a rim), pow = 1 is a smooth arc (a palm frond). Width follows sin(π·u^0.7): narrow at the base,
  // widest a third of the way out, pointed tip; pass profile to override (() => 1 for a vine). The geometry is
  // built in the group's own space (the mesh sits at the origin); mesh.userData.pts is the sampled centreline.
  const frond = (g, w, L, th, mat, x, y, z, a, t0, bend, { n = 6, pow = 1, profile = null } = {}) => {
    const sa = Math.sin(a), ca = Math.cos(a), wOf = profile || (u => Math.max(0.12, Math.sin(Math.PI * Math.pow(u, 0.7))));
    const pos = [], idx = [], pts = [];
    let r = 0, h = 0;   // the centreline's running radial / vertical offset from the base
    for (let i = 0; i <= n; i++) {
      const u = i / n, ang = t0 + bend * Math.pow(u, pow);
      if (i) { const mid = t0 + bend * Math.pow(u - 0.5 / n, pow); r += Math.sin(mid) * L / n; h += Math.cos(mid) * L / n; }
      const cx = x + r * sa, cy = y + h, cz = z + r * ca; pts.push([cx, cy, cz, ang]);
      const hw = w / 2 * wOf(u), ht = th / 2 * (i === n ? 0.3 : 1);
      const nx = Math.cos(ang) * sa, ny = -Math.sin(ang), nz = Math.cos(ang) * ca;   // the ribbon's face normal (vertical plane of the heading)
      pos.push(cx + ca * hw + nx * ht, cy + ny * ht, cz - sa * hw + nz * ht, cx - ca * hw + nx * ht, cy + ny * ht, cz + sa * hw + nz * ht,
        cx - ca * hw - nx * ht, cy - ny * ht, cz + sa * hw - nz * ht, cx + ca * hw - nx * ht, cy - ny * ht, cz - sa * hw - nz * ht);
      if (i) for (let k = 0; k < 4; k++) { const p = (i - 1) * 4, q = i * 4, k1 = (k + 1) % 4; idx.push(p + k, q + k, q + k1, p + k, q + k1, p + k1); }
    }
    idx.push(0, 1, 2, 0, 2, 3);   // base cap
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setIndex(idx); geo.computeVertexNormals();
    const m = new THREE.Mesh(geo, mat); m.castShadow = true; m.receiveShadow = true; m.userData.pts = pts; g.add(m); return m;
  };
  return { leafMat, add, blob, cyl, strut, blade, leaf, pot, frond };
}

registerProps({
  // ---- floor plants ------------------------------------------------------------------------------------------
  'snake-plant': {
    footprint: [0.36, 0.36], height: 0.9, params: ['color', 'h'], tags: ['living', 'bedroom', 'office', 'bathroom', 'entry'],
    create(it, ctx) {
      const { std, group, colors, hex, rng } = ctx, K = kit(ctx);
      const g = group('Snake Plant'), H = it.h || 0.9;
      const rim = K.pot(g, 0.14, 0.11, 0.28, std(potColor(it, colors, rng, hex), { roughness: 0.6 }));
      const dark = K.leafMat(0x2d6a4f), light = K.leafMat(0x6a994e);
      const n = 12 + Math.floor(rng() * 3);
      for (let i = 0; i < n; i++) {   // upright tapered blades on a golden-angle spiral, leaning slightly outward
        const a = i * 2.399 + jit(rng, 0.3), d = 0.02 + rng() * 0.07;
        const L = (H - rim) * (0.6 + rng() * 0.4), t = 0.06 + rng() * 0.14;
        K.blade(g, 0.042, L, rng() < 0.6 ? dark : light, Math.sin(a) * d, rim - 0.02, Math.cos(a) * d, a, t, 0.3);
      }
      return g;
    },
    iso: [{ shape: 'cyl', box: [-0.14, 0, -0.14, 0.14, 0.28, 0.14], color: 'role:accent' }, { shape: 'blob', box: [-0.2, 0.28, -0.2, 0.2, 0.92, 0.2], color: '#2d6a4f' }],
  },
  'indoor-palm': {
    footprint: [1.6, 1.6], height: 1.9, params: ['color', 'h'], tags: ['living', 'dining', 'entry', 'office'],   // 34 meshes
    create(it, ctx) {
      const { std, group, colors, hex, rng } = ctx, K = kit(ctx);
      const g = group('Kentia Palm'), rim = K.pot(g, 0.21, 0.17, 0.42, std(potColor(it, colors, rng, hex), { roughness: 0.6 }));
      const s = ((it.h || 1.9) - rim) / (1.9 - rim);   // h scales the plant above the pot
      const gi = Math.floor(rng() * (GREENS.length - 2)), greens = [K.leafMat(GREENS[gi]), K.leafMat(GREENS[gi + 1]), K.leafMat(GREENS[gi + 2])];   // three neighbouring greens
      const stemMat = std(STEM, { roughness: 0.8 });
      for (let i = 0; i < 4; i++) {   // four canes leaning out from the pot, each carrying a crown of arching fronds
        const a = (i + 0.5) * Math.PI / 2 + jit(rng, 0.4), lean = 0.08 + rng() * 0.08, len = (1.0 + rng() * 0.25) * s;
        const top = [Math.sin(a) * (0.08 + Math.sin(lean) * len), rim + Math.cos(lean) * len, Math.cos(a) * (0.08 + Math.sin(lean) * len)];
        K.strut(g, [Math.sin(a) * 0.08, rim - 0.02, Math.cos(a) * 0.08], top, 0.014, stemMat, 6);
        for (let k = 0; k < 6; k++) {   // six curved fronds fan across the cane's outward half: each rises from the crown, arches over and droops
          const fa = a + (k - 2.5) * 0.62 + jit(rng, 0.15), t0 = 0.45 + Math.abs(k - 2.5) * 0.18 + jit(rng, 0.1), fl = (0.65 + rng() * 0.1) * s;
          K.frond(g, 0.15, fl, 0.02, greens[(i + k) % 3], top[0], top[1] - 0.02, top[2], fa, t0, 1.5 + jit(rng, 0.15));
        }
        K.frond(g, 0.08, 0.3 * s, 0.02, greens[2], top[0], top[1], top[2], a + Math.PI + jit(rng, 0.5), 0.3, 0.5);   // the new spear, back over the pot
      }
      return g;
    },
    iso: [{ shape: 'cyl', box: [-0.21, 0, -0.21, 0.21, 0.42, 0.21], color: 'role:accent' }, { shape: 'cyl', box: [-0.04, 0.42, -0.04, 0.04, 1.45, 0.04], color: '#4f6b3a' }, { shape: 'blob', box: [-0.78, 1.05, -0.78, 0.78, 1.9, 0.78], color: '#40916c' }],
  },
  'ficus-tree': {
    footprint: [1.0, 1.0], height: 1.8, params: ['color', 'h'], tags: ['living', 'dining', 'office', 'entry'],
    create(it, ctx) {
      const { std, group, colors, hex, rng } = ctx, K = kit(ctx);
      const g = group('Ficus Tree'), rim = K.pot(g, 0.23, 0.18, 0.46, std(potColor(it, colors, rng, hex), { roughness: 0.6 }));
      const s = ((it.h || 1.8) - rim) / (1.8 - rim);   // h scales the tree above the pot (canopy top = rim + 1.34 s)
      const bark = std(BARK, { roughness: 0.85 });
      const lean = jit(rng, 0.06), top = [Math.sin(lean) * 0.85 * s, rim - 0.02 + 0.85 * s, 0];
      K.strut(g, [0, rim - 0.02, 0], top, 0.035, bark, 8);
      K.strut(g, [top[0] * 0.7, rim + 0.6 * s, 0], [0.25 * s, rim + 0.85 * s, 0.1 * s], 0.018, bark, 6);
      K.strut(g, [top[0] * 0.8, rim + 0.7 * s, 0], [-0.22 * s, rim + 0.95 * s, -0.12 * s], 0.018, bark, 6);
      const gi = Math.floor(rng() * (GREENS.length - 2)), greens = [K.leafMat(GREENS[gi]), K.leafMat(GREENS[gi + 1]), K.leafMat(GREENS[gi + 2])];   // neighbouring greens, one canopy
      const canopy =[[0, 1.55, 0, 0.28], [0.22, 1.35, 0.1, 0.24], [-0.22, 1.4, -0.1, 0.24], [0.1, 1.3, -0.24, 0.22], [-0.08, 1.38, 0.24, 0.22], [0.2, 1.6, -0.1, 0.2], [-0.18, 1.62, 0.1, 0.2]];
      canopy.forEach(([x, y, z, r], i) => K.blob(g, r * s, greens[i % 3], x * s + top[0] * 0.5, rim + (y - 0.46) * s, z * s, 1, 0.85, 1, rng() * 3));
      return g;
    },
    iso: [{ shape: 'cyl', box: [-0.23, 0, -0.23, 0.23, 0.46, 0.23], color: 'role:accent' }, { shape: 'cyl', box: [-0.035, 0.46, -0.035, 0.035, 1.3, 0.035], color: '#5b4636' }, { shape: 'blob', box: [-0.47, 1.1, -0.47, 0.47, 1.8, 0.47], color: '#386641' }],
  },
  'olive-tree-pot': {
    footprint: [0.9, 0.9], height: 1.6, params: ['color', 'h'], tags: ['living', 'dining', 'entry', 'outdoor'],
    create(it, ctx) {
      const { std, group, colors, hex, rng } = ctx, K = kit(ctx);
      const g = group('Olive Tree'), s = ((it.h || 1.6) - 0.44) / (1.6 - 0.44);   // h scales the tree above the planter
      // a tapered square planter: a 4-sided cylinder turned 45°
      const planter = K.cyl(g, 0.3, 0.25, 0.44, std(potColor(it, colors, rng, hex), { roughness: 0.7 }), 0, 0.22, 0, 4); planter.rotation.y = Math.PI / 4;
      K.cyl(g, 0.17, 0.17, 0.02, std(SOIL, { roughness: 1 }), 0, 0.438, 0, 12);   // proud of the rim, not z-fighting it
      const bark = std(0x8b7d6b, { roughness: 0.9 });
      const k1 = [0.05, 0.44 + 0.5 * s, -0.03], k2 = [-0.02, 0.44 + 0.85 * s, 0.04];   // a gnarled two-piece trunk
      K.strut(g, [0, 0.42, 0], k1, 0.04, bark, 7); K.strut(g, k1, k2, 0.03, bark, 7);
      const twigs = [[0.28, 1.2, 0.1], [-0.26, 1.15, -0.12], [0.05, 1.3, -0.28]];
      twigs.forEach(([x, y, z]) => K.strut(g, k2, [x * s, 0.44 + (y - 0.44) * s, z * s], 0.014, bark, 5));
      const mats = SILVER.map(c => K.leafMat(c));
      for (let i = 0; i < 13; i++) {   // a loose, uneven silver-green cloud of small blobs
        let x, y, z, r;
        if (!i) { x = 0; y = 1.44; z = 0; r = 0.16; }                                                                          // blob 0 crowns the cloud at 1.6
        else if (i <= 3) { const t = twigs[i - 1]; x = t[0] * 0.9; y = t[1] + 0.02; z = t[2] * 0.9; r = 0.13; }                // a tuft on each twig's end, so no bare stick pokes out
        else { const a = i * 2.399 + jit(rng, 0.3), d = 0.1 + (i % 4) * 0.07; x = Math.sin(a) * d; z = Math.cos(a) * d; y = 1.1 + rng() * 0.3 - (i % 4) * 0.04; r = 0.11 + rng() * 0.06; }
        K.blob(g, r * s, mats[i % 4], x * s, 0.44 + (y - 0.44) * s, z * s, 1.15, 0.8, 1, rng() * 3);
      }
      return g;
    },
    iso: [{ shape: 'box', box: [-0.21, 0, -0.21, 0.21, 0.44, 0.21], color: 'role:accent' }, { shape: 'cyl', box: [-0.04, 0.44, -0.04, 0.04, 1.3, 0.04], color: '#8b7d6b' }, { shape: 'blob', box: [-0.45, 1.0, -0.45, 0.45, 1.6, 0.45], color: '#8a9a7b' }],
  },
  'tall-cactus': {
    footprint: [0.42, 0.34], height: 1.5, params: ['color', 'h'], tags: ['living', 'office', 'entry'],
    create(it, ctx) {
      const { THREE, std, group, colors, hex, rng } = ctx, K = kit(ctx);
      const g = group('Tall Cactus'), H = it.h || 1.5, s = (H - 0.365) / (1.5 - 0.365);   // h scales the column above the pot
      K.pot(g, 0.17, 0.13, 0.3, std(potColor(it, colors, rng, hex), { roughness: 0.65 }), { seg: 18, soil: std(GRAVEL, { roughness: 1 }) });
      const green = K.leafMat(pick(rng, [0x3f7d4a, 0x4a8a55, 0x3a7048]));
      const cap = (r, x, y, z) => K.add(g, new THREE.Mesh(new THREE.SphereGeometry(r, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2), green), x, y, z);
      const colH = H - 0.365; K.cyl(g, 0.075, 0.085, colH, green, 0, 0.29 + colH / 2, 0, 8); cap(0.075, 0, 0.29 + colH, 0);   // pot 0.29 + column + cap 0.075 = h
      const arm = (side, y0, out, up) => {   // an elbow: out sideways, then up, capped
        const yy = 0.29 + y0 * s, h = K.cyl(g, 0.05, 0.05, out, green, side * out / 2, yy, 0, 8); h.rotation.z = Math.PI / 2;
        K.cyl(g, 0.05, 0.05, up * s, green, side * out, yy + up * s / 2, 0, 8); cap(0.05, side * out, yy + up * s, 0);
      };
      arm(-1, 0.55, 0.17, 0.36); arm(1, 0.72, 0.15, 0.28);
      if (rng() < 0.6) K.blob(g, 0.03, K.leafMat(0xe879a5), 0.02, 0.29 + colH + 0.055, 0.02, 1, 0.7, 1);   // a flower sitting on the cap, sometimes
      return g;
    },
    iso: [{ shape: 'cyl', box: [-0.17, 0, -0.17, 0.17, 0.3, 0.17], color: 'role:accent' }, { shape: 'cyl', box: [-0.085, 0.3, -0.085, 0.085, 1.49, 0.085], color: '#3f7d4a' }, { shape: 'box', box: [-0.22, 0.8, -0.05, 0.2, 1.3, 0.05], color: '#3f7d4a' }],
  },
  'pampas-vase': {
    footprint: [0.3, 0.3], height: 1.18, params: ['color', 'h'], tags: ['living', 'dining', 'bedroom', 'entry'],
    create(it, ctx) {
      const { THREE, std, group, colors, hex, rng } = ctx, K = kit(ctx);
      const g = group('Pampas Vase'), s = (it.h || 1.18) / 1.18;
      K.cyl(g, 0.055, 0.1, 0.5 * s, std(it.color ? hex(it.color) : (rng() < 0.5 ? colors.accent : 0xd6d3d1), { roughness: 0.55 }), 0, 0.25 * s, 0, 16);
      const stem = std(0xc9a26b, { roughness: 0.9 }), plumes = [0xe8d9c0, 0xdccbb0, 0xf0e4d0, 0xd9c4a8].map(c => K.leafMat(c));
      for (let i = 0; i < 6; i++) {   // dried stems fanning out of the neck, each topped by a tall cream plume
        const a = i * 1.047 + rng() * 0.5, lean = 0.08 + rng() * 0.12, L = (0.3 + rng() * 0.08) * s, dx = Math.sin(a) * Math.sin(lean), dz = Math.cos(a) * Math.sin(lean);
        const top = [dx * L, 0.5 * s + Math.cos(lean) * L, dz * L];
        K.strut(g, [Math.sin(a) * 0.02, 0.48 * s, Math.cos(a) * 0.02], top, 0.004, stem, 5);
        // the plume: a rounded blob where it leaves the stem, then a slim 7-sided cone tapering to the tip, both a
        // little flattened — fat at the bottom, pointed at the top, the pampas silhouette rather than a bud
        K.blob(g, 0.045 * s, plumes[i % 4], top[0], top[1], top[2], 1, 1.3, 0.75, a, lean);
        const cone = new THREE.ConeGeometry(0.048 * s, 0.3 * s, 7); cone.translate(0, 0.15 * s, 0);
        const m = K.add(g, new THREE.Mesh(cone, plumes[i % 4]), top[0], top[1], top[2]); m.scale.set(1, 1, 0.75); m.rotation.order = 'YXZ'; m.rotation.set(lean, a, 0);
      }
      return g;
    },
    iso: [{ shape: 'cyl', box: [-0.1, 0, -0.1, 0.1, 0.5, 0.1], color: 'role:accent' }, { shape: 'blob', box: [-0.18, 0.85, -0.18, 0.18, 1.18, 0.18], color: '#e8d9c0' }],
  },

  // ---- hanging -----------------------------------------------------------------------------------------------
  'hanging-plant': {
    footprint: [0.5, 0.5], height: 0.89, params: ['color', 'y'], tags: ['living', 'kitchen', 'bathroom', 'bedroom'],   // ≤ 37 meshes
    create(it, ctx) {
      const { THREE, std, group, colors, hex, rng } = ctx, K = kit(ctx);
      const g = group('Hanging Plant');
      // y is the hook height — the same convention as lighting.js's pendants: house-builder and the iso twin lift
      // the origin by it.y themselves, so with y set (checked by presence, not truthiness — 0 is a legitimate
      // hook height) the plant hangs from the local origin; without it (the sheet, the catalog, a spec that
      // leaves it out) the hook goes to a default 2.1 m above the floor origin. The iso hint is written for that
      // floor-origin case.
      const hook = it.y !== undefined ? 0 : 2.1;
      const metal = std(colors.metal, { metalness: 0.7, roughness: 0.35 });
      K.cyl(g, 0.045, 0.045, 0.012, metal, 0, hook - 0.006, 0, 12);                                            // ceiling plate
      K.add(g, new THREE.Mesh(new THREE.TorusGeometry(0.028, 0.006, 6, 12), metal), 0, hook - 0.045, 0);      // the hook ring
      const rimY = hook - 0.44, potR = 0.15;
      for (let i = 0; i < 3; i++) { const a = i * Math.PI * 2 / 3 + 0.5; K.strut(g, [0, hook - 0.07, 0], [Math.sin(a) * (potR - 0.01), rimY, Math.cos(a) * (potR - 0.01)], 0.004, metal, 5); }   // three chains
      K.cyl(g, potR, 0.1, 0.16, std(potColor(it, colors, rng, hex), { roughness: 0.6 }), 0, rimY - 0.08, 0, 18);
      K.cyl(g, potR * 0.9, potR * 0.9, 0.02, std(SOIL, { roughness: 1 }), 0, rimY - 0.012, 0, 18);
      const gi = Math.floor(rng() * (GREENS.length - 1)), greens = [K.leafMat(GREENS[gi]), K.leafMat(GREENS[gi + 1])], vine = std(STEM, { roughness: 0.9 });
      for (let i = 0; i < 4; i++) { const a = i * 1.7 + rng(), d = i ? 0.07 : 0; K.blob(g, 0.1 + rng() * 0.04, greens[i % 2], Math.sin(a) * d, rimY + 0.04, Math.cos(a) * d, 1, 0.65, 1, rng() * 3); }   // the mound
      for (let i = 0; i < 5; i++) {   // five trailing strands: each spills over the rim, turns down and hangs, leaves drooping along it
        const a = i * Math.PI * 2 / 5 + jit(rng, 0.25), L = 0.28 + rng() * 0.14, N = 7;
        const v = K.frond(g, 0.008, L, 0.008, vine, Math.sin(a) * (potR - 0.03), rimY + 0.01, Math.cos(a) * (potR - 0.03), a, 1.35, 1.8, { n: N, pow: 0.25, profile: () => 1 });
        const n = Math.min(4, 2 + Math.floor(L / 0.12));
        for (let k = 1; k <= n; k++) { const p = v.userData.pts[Math.round(k * N / (n + 0.3))], side = k % 2 ? 1 : -1; K.leaf(g, 0.055, 0.075, 0.012, greens[(i + k) % 2], p[0], p[1], p[2], a + side * 1.2 + jit(rng, 0.3), Math.PI - 0.5); }
      }
      return g;
    },
    iso: [{ shape: 'cyl', box: [-0.15, 1.5, -0.15, 0.15, 1.66, 0.15], color: 'role:accent' }, { shape: 'blob', box: [-0.2, 1.62, -0.2, 0.2, 1.9, 0.2], color: '#40916c' }, { shape: 'blob', box: [-0.24, 1.22, -0.24, 0.24, 1.5, 0.24], color: '#4f772d' }],
  },

  // ---- on a surface ------------------------------------------------------------------------------------------
  'herb-pots': {
    footprint: [0.42, 0.17], height: 0.26, surface: true, params: ['color'], tags: ['kitchen'],
    create(it, ctx) {
      const { std, box, group, colors, hex, rng } = ctx, K = kit(ctx);
      const g = group('Herb Pots');
      const tray = std(colors.wood, { roughness: 0.6 });   // a lipped wooden tray, three pots in a row
      g.add(box(0.42, 0.02, 0.16, tray, 0, 0.01, 0));
      g.add(box(0.42, 0.035, 0.012, tray, 0, 0.0175, -0.074)); g.add(box(0.42, 0.035, 0.012, tray, 0, 0.0175, 0.074));
      g.add(box(0.012, 0.035, 0.16, tray, -0.204, 0.0175, 0)); g.add(box(0.012, 0.035, 0.16, tray, 0.204, 0.0175, 0));
      const potMat = std(potColor(it, colors, rng, hex), { roughness: 0.65 });
      const herbs = [   // each takes the pot's x and its soil height; the blobs overlap the soil so nothing floats
        (x, y) => { const m = K.leafMat(0x4f9d3f); for (let k = 0; k < 4; k++) { const a = k * 1.6; K.blob(g, 0.032, m, x + Math.sin(a) * 0.025, y + 0.012 + (k % 2) * 0.035, Math.cos(a) * 0.025, 1, 0.8, 1, rng() * 3); } },                       // basil
        (x, y) => { const m = K.leafMat(pick(rng, SILVER)); for (let k = 0; k < 5; k++) { const a = k * 1.26; K.blade(g, 0.012, 0.13, m, x + Math.sin(a) * 0.015, y - 0.01, Math.cos(a) * 0.015, a, 0.35 + rng() * 0.2, 1); } },   // rosemary
        (x, y) => { const m = K.leafMat(0x6a994e); for (let k = 0; k < 4; k++) { const a = k * 1.6 + 0.8; K.blob(g, 0.03, m, x + Math.sin(a) * 0.03, y + 0.008 + (k % 2) * 0.03, Math.cos(a) * 0.03, 1.2, 0.5, 1, rng() * 3); } },            // mint
      ];
      const order = rng() < 0.5 ? [0, 1, 2] : [2, 0, 1];
      [-0.13, 0, 0.13].forEach((x, i) => { const rim = K.pot(g, 0.055, 0.045, 0.1, potMat, { x, y: 0.02, seg: 14 }); herbs[order[i]](x, rim + 0.008); });
      return g;
    },
    iso: [{ shape: 'box', box: [-0.21, 0, -0.08, 0.21, 0.035, 0.08], color: 'role:wood' }, { shape: 'blob', box: [-0.19, 0.03, -0.06, -0.07, 0.26, 0.06], color: '#4f9d3f' }, { shape: 'blob', box: [-0.06, 0.03, -0.06, 0.06, 0.26, 0.06], color: '#8a9a7b' }, { shape: 'blob', box: [0.07, 0.03, -0.06, 0.19, 0.26, 0.06], color: '#6a994e' }],
  },
  'orchid': {
    footprint: [0.44, 0.44], height: 0.55, surface: true, params: ['color'], tags: ['bedroom', 'living', 'bathroom', 'dining', 'office'],
    create(it, ctx) {
      const { std, group, colors, hex, rng } = ctx, K = kit(ctx);
      const g = group('Orchid');
      const rim = K.pot(g, 0.075, 0.06, 0.13, std(it.color ? hex(it.color) : (rng() < 0.5 ? colors.linen : colors.accent), { roughness: 0.5 }), { seg: 16 });
      const leaf = K.leafMat(0x2d6a4f);
      for (let i = 0; i < 4; i++) { const a = i * 1.6 + rng() * 0.5; K.leaf(g, 0.09, 0.2 + rng() * 0.04, 0.02, leaf, Math.sin(a) * 0.03, rim - 0.01, Math.cos(a) * 0.03, a, 1.2 + rng() * 0.25); }   // four broad leaves lying out from the crown
      const stemMat = std(0x5a7a3a, { roughness: 0.8 }), knee = [0.02, rim + 0.24, 0.01];
      K.strut(g, [0.01, rim, 0], knee, 0.006, stemMat, 6);
      K.strut(g, knee, [knee[0] + 0.16, knee[1] + 0.14, knee[2] + 0.05], 0.005, stemMat, 6);   // the spike bends over toward +x
      K.cyl(g, 0.005, 0.005, 0.34, std(0xc9a26b, { roughness: 0.8 }), -0.01, rim + 0.17, -0.01, 6);   // bamboo stake
      const petal = K.leafMat(pick(rng, [0xf4c2d7, 0xffffff, 0xb392c9, 0xf9e3ee, 0xe6a1b8])), centre = std(0xf5c542, { roughness: 0.6 });
      for (let k = 0; k < 5; k++) {   // five blooms alternating sides of the spike
        const f = 0.15 + k * 0.2, side = k % 2 ? 1 : -1, x = knee[0] + 0.16 * f, y = knee[1] + 0.14 * f, z = knee[2] + 0.05 * f + side * 0.03;
        K.blob(g, 0.035, petal, x, y + 0.02, z, 1.1, 0.35, 1, k, 0.35 * side);
        K.blob(g, 0.009, centre, x, y + 0.03, z, 1, 1, 1);
      }
      return g;
    },
    iso: [{ shape: 'cyl', box: [-0.075, 0, -0.075, 0.075, 0.13, 0.075], color: 'role:linen' }, { shape: 'blob', box: [-0.2, 0.13, -0.2, 0.2, 0.2, 0.2], color: '#2d6a4f' }, { shape: 'blob', box: [0.05, 0.4, -0.05, 0.25, 0.55, 0.1], color: '#f4c2d7' }],
  },
  'succulent-tray': {
    footprint: [0.36, 0.2], height: 0.12, surface: true, params: ['color'], tags: ['office', 'living', 'kitchen', 'bedroom'],
    create(it, ctx) {
      const { std, box, group, colors, hex, rng } = ctx, K = kit(ctx);
      const g = group('Succulent Tray');
      const tray = std(it.color ? hex(it.color) : (rng() < 0.5 ? colors.wood : 0x9a9a94), { roughness: 0.7 });   // wood or concrete
      g.add(box(0.36, 0.02, 0.2, tray, 0, 0.01, 0));
      g.add(box(0.36, 0.04, 0.012, tray, 0, 0.02, -0.094)); g.add(box(0.36, 0.04, 0.012, tray, 0, 0.02, 0.094));
      g.add(box(0.012, 0.04, 0.2, tray, -0.174, 0.02, 0)); g.add(box(0.012, 0.04, 0.2, tray, 0.174, 0.02, 0));
      g.add(box(0.33, 0.012, 0.17, std(GRAVEL, { roughness: 1 }), 0, 0.026, 0));
      const y = 0.032;   // a rosette, an aloe, a barrel, a jade and a stonecrop, each its own green
      K.blob(g, 0.045, K.leafMat(0x7fa87a), -0.12, y + 0.025, 0.03, 1, 0.55, 1, rng() * 3);
      const aloe = K.leafMat(0x5f8f5a); for (let k = 0; k < 5; k++) { const a = k * 1.26 + rng(); K.blade(g, 0.012, 0.09, aloe, -0.03 + Math.sin(a) * 0.01, y, -0.045 + Math.cos(a) * 0.01, a, 0.25 + rng() * 0.3, 0.6); }
      K.blob(g, 0.034, K.leafMat(0x4f772d), 0.05, y + 0.034, 0.045, 1, 1, 1, rng() * 3);
      const jade = K.leafMat(0x6a994e); K.cyl(g, 0.008, 0.01, 0.05, std(BARK), 0.12, y + 0.025, -0.03, 6); K.blob(g, 0.028, jade, 0.11, y + 0.06, -0.035, 1, 0.8, 1, rng()); K.blob(g, 0.024, jade, 0.135, y + 0.055, -0.02, 1, 0.8, 1, rng());
      K.blob(g, 0.026, K.leafMat(0xa3b18a), 0, y + 0.02, 0.06, 1.2, 0.6, 1, rng() * 3);
      return g;
    },
    iso: [{ shape: 'box', box: [-0.18, 0, -0.1, 0.18, 0.04, 0.1], color: 'role:wood' }, { shape: 'blob', box: [-0.16, 0.03, -0.08, 0.16, 0.12, 0.08], color: '#6a994e' }],
  },
  'trailing-ivy': {
    footprint: [0.43, 0.44], height: 0.25, surface: true, params: ['color'], tags: ['living', 'office', 'bedroom', 'kitchen'],
    create(it, ctx) {
      const { std, group, colors, hex, rng } = ctx, K = kit(ctx);
      const g = group('Trailing Ivy');
      const pz = -0.13;   // the pot sits at the back of the footprint; the vines spill forward (+z) across the shelf
      const rim = K.pot(g, 0.1, 0.08, 0.14, std(potColor(it, colors, rng, hex), { roughness: 0.6 }), { z: pz, seg: 16 });
      const greens = [K.leafMat(pick(rng, GREENS.slice(0, 3))), K.leafMat(pick(rng, GREENS.slice(3)))], vine = std(STEM, { roughness: 0.9 });   // one dark, one light
      for (let i = 0; i < 3; i++) { const a = i * 2.1 + rng(); K.blob(g, 0.075 + rng() * 0.02, greens[i % 2], Math.sin(a) * 0.04, rim + 0.045, pz + Math.cos(a) * 0.04, 1, 0.65, 1, rng() * 3); }
      for (let i = 0; i < 4; i++) {   // four vines: a curve over the rim and down to the surface, then a run along it
        const a = (i - 1.5) * 0.36 + jit(rng, 0.1), L1 = 0.15 + rng() * 0.02, r2 = 0.3 + rng() * 0.06;   // L1 drops the vine 11–12 cm: from the rim to just above the surface
        const v = K.frond(g, 0.008, L1, 0.008, vine, Math.sin(a) * 0.08, rim - 0.005, pz + Math.cos(a) * 0.08, a, 1.75, 1.05, { n: 5, pow: 0.6, profile: () => 1 });
        const pts = v.userData.pts, p1 = pts[5], p2 = [Math.sin(a) * r2 + jit(rng, 0.03), 0.012, pz + Math.cos(a) * r2];
        p1[1] = Math.max(p1[1], 0.012); K.strut(g, p1, p2, 0.004, vine, 5);
        // pointed leaves: two hanging off the curve, two lying flat along the run, alternating sides
        [pts[2], pts[4]].forEach((p, k) => K.leaf(g, 0.045, 0.065, 0.01, greens[(i + k) % 2], p[0], p[1], p[2], a + (k % 2 ? 1 : -1) * 1.1 + jit(rng, 0.3), 1.9 + jit(rng, 0.3)));
        [0.3, 0.7].forEach((t, k) => K.leaf(g, 0.045, 0.065, 0.01, greens[(i + k + 1) % 2], p1[0] + (p2[0] - p1[0]) * t, 0.012, p1[2] + (p2[2] - p1[2]) * t, a + (k % 2 ? 1 : -1) * 1.1 + jit(rng, 0.3), 1.45 + jit(rng, 0.1)));
      }
      return g;
    },
    iso: [{ shape: 'cyl', box: [-0.1, 0, -0.23, 0.1, 0.14, -0.03], color: 'role:accent' }, { shape: 'blob', box: [-0.12, 0.14, -0.25, 0.12, 0.25, -0.01], color: '#40916c' }, { shape: 'blob', box: [-0.2, 0, -0.05, 0.2, 0.05, 0.22], color: '#6a994e' }],
  },
  'fern': {
    footprint: [0.62, 0.62], height: 0.36, surface: true, params: ['color'], tags: ['bathroom', 'bedroom', 'living'],   // 30 meshes
    create(it, ctx) {
      const { std, group, colors, hex, rng } = ctx, K = kit(ctx);
      const g = group('Fern');
      const rim = K.pot(g, 0.09, 0.07, 0.14, std(potColor(it, colors, rng, hex), { roughness: 0.6 }), { seg: 16 });
      const mats = [K.leafMat(0x4f772d), K.leafMat(0x6a994e), K.leafMat(0x588157)];
      // 28 curved fronds in three tiers, one mesh each: the inner ones rise from the crown and arch, the middle ring
      // arches out over the rim, the outer ring leaves nearly flat and droops below it — the arch and the droop
      // are what separate a fern from an agave or a spider plant
      const tiers = [[6, 0.3, 0.25, 1.1], [10, 0.28, 0.65, 1.25], [12, 0.28, 1.05, 1.35]];   // count, length, start tilt, bend
      tiers.forEach(([n, L0, t0, b0], tier) => {
        for (let i = 0; i < n; i++) {
          const a = i * Math.PI * 2 / n + tier * 0.35 + jit(rng, 0.12), L = L0 + rng() * 0.05;
          K.frond(g, 0.07, L, 0.008, mats[(i + tier) % 3], Math.sin(a) * 0.025, rim - 0.01, Math.cos(a) * 0.025, a, t0 + jit(rng, 0.12), b0 + jit(rng, 0.15));
        }
      });
      return g;
    },
    iso: [{ shape: 'cyl', box: [-0.09, 0, -0.09, 0.09, 0.14, 0.09], color: 'role:accent' }, { shape: 'blob', box: [-0.31, 0.08, -0.31, 0.31, 0.36, 0.31], color: '#4f772d' }],
  },
}, { foliage: true });   // a leaf's bounding box is not its shape: the scene QA skips these


// =================================================================================================================
// Pass 4 (S3 compose): four more floor plants, so a house's plants differ from room to room and from the next
// house (snake-plant stood in 29 of 30).
// =================================================================================================================
registerProps({
  // Bird of paradise — tall paddle leaves on long stalks fanning up out of a wide pot (tropical, modern).
  'bird-of-paradise': {
    footprint: [0.9, 0.9], height: 1.7, params: ['color', 'h'], tags: ['living', 'dining', 'entry', 'sunroom'],
    create(it, ctx) {
      const { std, group, colors, hex, rng } = ctx, K = kit(ctx);
      const g = group('Bird of Paradise'), rim = K.pot(g, 0.22, 0.18, 0.4, std(potColor(it, colors, rng, hex), { roughness: 0.6 }));
      const s = ((it.h || 1.7) - rim) / (1.7 - rim), stalk = std(STEM, { roughness: 0.8 });
      const greens = [K.leafMat(0x2d6a4f), K.leafMat(0x386641), K.leafMat(0x40916c)];
      for (let i = 0; i < 7; i++) {
        const a = i * 2.399 + jit(rng, 0.25), t = 0.12 + rng() * 0.28, L = (0.55 + rng() * 0.3) * s;
        const tip = [Math.sin(a) * Math.sin(t) * L, rim + Math.cos(t) * L, Math.cos(a) * Math.sin(t) * L];
        K.strut(g, [0, rim - 0.02, 0], tip, 0.012, stalk, 5);
        K.leaf(g, 0.2, 0.52 * s, 0.02, greens[i % 3], tip[0], tip[1], tip[2], a, t + 0.15);
      }
      return g;
    },
    iso: [{ shape: 'cyl', box: [-0.22, 0, -0.22, 0.22, 0.4, 0.22], color: 'role:accent' }, { shape: 'blob', box: [-0.45, 0.4, -0.45, 0.45, 1.7, 0.45], color: '#386641' }],
  },
  // Rubber plant — a straight cane with glossy dark oval leaves held out all the way up (modern, industrial).
  'rubber-plant': {
    footprint: [0.7, 0.7], height: 1.5, params: ['color', 'h'], tags: ['living', 'office', 'bedroom', 'entry'],
    create(it, ctx) {
      const { std, group, colors, hex, rng } = ctx, K = kit(ctx);
      const g = group('Rubber Plant'), rim = K.pot(g, 0.17, 0.14, 0.34, std(potColor(it, colors, rng, hex), { roughness: 0.6 }));
      const H = it.h || 1.5, top = H - 0.08, leafMat = std(0x1f3d2b, { roughness: 0.35, flatShading: true });
      K.strut(g, [0, rim - 0.02, 0], [0.02, top, 0], 0.016, std(BARK, { roughness: 0.8 }), 6);
      const n = 11;
      for (let i = 0; i < n; i++) {
        const u = i / (n - 1), y = rim + 0.1 + u * (top - rim - 0.1), a = i * 2.2 + jit(rng, 0.3);
        K.leaf(g, 0.13, 0.26 - u * 0.06, 0.012, leafMat, Math.sin(a) * 0.02, y, Math.cos(a) * 0.02, a, 1.1 - u * 0.5);
      }
      return g;
    },
    iso: [{ shape: 'cyl', box: [-0.17, 0, -0.17, 0.17, 0.34, 0.17], color: 'role:accent' }, { shape: 'blob', box: [-0.33, 0.4, -0.33, 0.33, 1.5, 0.33], color: '#1f3d2b' }],
  },
  // ZZ plant — arching stems of small glossy paired leaflets from a low pot (every style, low light: halls, baths).
  'zz-plant': {
    footprint: [0.6, 0.6], height: 0.85, params: ['color', 'h'], tags: ['living', 'bedroom', 'office', 'bathroom', 'entry'],
    create(it, ctx) {
      const { std, group, colors, hex, rng } = ctx, K = kit(ctx);
      const g = group('ZZ Plant'), rim = K.pot(g, 0.15, 0.13, 0.26, std(potColor(it, colors, rng, hex), { roughness: 0.6 }));
      const H = it.h || 0.85, mat = std(0x2d5a3a, { roughness: 0.3, flatShading: true });
      for (let i = 0; i < 7; i++) {
        const a = i * 2.399 + jit(rng, 0.3), t = 0.1 + rng() * 0.35, L = (H - rim) * (0.75 + rng() * 0.25);
        const fr = K.frond(g, 0.02, L, 0.012, mat, 0, rim - 0.01, 0, a, t, 0.35);
        const pts = fr.userData.pts;
        for (let k = 2; k < pts.length; k += 1) for (const s of [-1, 1]) {
          const [x, y, z] = pts[k];
          K.leaf(g, 0.045, 0.08, 0.01, mat, x, y, z, a + s * 1.3, 1.1);
        }
      }
      return g;
    },
    iso: [{ shape: 'cyl', box: [-0.15, 0, -0.15, 0.15, 0.26, 0.15], color: 'role:accent' }, { shape: 'blob', box: [-0.3, 0.26, -0.3, 0.3, 0.85, 0.3], color: '#2d5a3a' }],
  },
  // Dracaena — two or three bare canes of different heights each topped by a tuft of strappy leaves (modern,
  // scandi, tropical).
  'dracaena': {
    footprint: [0.8, 0.8], height: 1.8, params: ['color', 'h'], tags: ['living', 'office', 'entry', 'dining'],
    create(it, ctx) {
      const { std, group, colors, hex, rng } = ctx, K = kit(ctx);
      const g = group('Dracaena'), rim = K.pot(g, 0.18, 0.15, 0.38, std(potColor(it, colors, rng, hex), { roughness: 0.6 }));
      const H = it.h || 1.8, cane = std(0x8b7355, { roughness: 0.85 }), leaves = [K.leafMat(0x4f772d), K.leafMat(0x6a994e)];
      [1, 0.78, 0.6].forEach((f, i) => {
        const a = i * 2.1 + jit(rng, 0.3), top = [Math.sin(a) * 0.1, rim + (H - rim - 0.3) * f, Math.cos(a) * 0.1];
        K.strut(g, [Math.sin(a) * 0.04, rim - 0.02, Math.cos(a) * 0.04], top, 0.02, cane, 6);
        for (let k = 0; k < 9; k++) K.blade(g, 0.022, 0.34 + rng() * 0.08, leaves[k % 2], top[0], top[1], top[2], k * 0.7 + jit(rng, 0.2), 0.5 + rng() * 0.9, 0.2);
      });
      return g;
    },
    iso: [{ shape: 'cyl', box: [-0.18, 0, -0.18, 0.18, 0.38, 0.18], color: 'role:accent' }, { shape: 'blob', box: [-0.4, 1.0, -0.4, 0.4, 1.8, 0.4], color: '#4f772d' }],
  },
});
