// Plants — potted, hanging and tabletop greenery. Faceted foliage (IcosahedronGeometry detail 1 and 4-sided
// cones, all flat-shaded) on simple pots; anything that arches — palm and fern fronds, trailing vines — is one
// curved tapered-ribbon mesh from kit.frond, so a crown of 28 fronds is still 28 meshes. Pots take colors.accent
// or terracotta (an explicit it.color wins); leaves come from a small green set picked with ctx.rng, so two of the
// same type in one house differ.
// Every prop: origin at the floor centre of its footprint, faces +z at rot 0; the surface: true ones sit on a
// desk / counter / shelf and are placed at desk height by the builder.
import { registerProps } from './registry.js';
import { recipes } from './plants2.js';

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
    create: (it, ctx) => recipes['snake-plant'](it, ctx),   // softkit plants v2 (assets/props/plants2.ts)
    iso: [{ shape: 'cyl', box: [-0.14, 0, -0.14, 0.14, 0.28, 0.14], color: 'role:accent' }, { shape: 'blob', box: [-0.2, 0.28, -0.2, 0.2, 0.92, 0.2], color: '#2d6a4f' }],
  },
  'indoor-palm': {
    footprint: [1.6, 1.6], height: 1.9, params: ['color', 'h'], tags: ['living', 'dining', 'entry', 'office'],   // 34 meshes
    create: (it, ctx) => recipes['indoor-palm'](it, ctx),   // softkit plants v2 (assets/props/plants2.ts)
    iso: [{ shape: 'cyl', box: [-0.21, 0, -0.21, 0.21, 0.42, 0.21], color: 'role:accent' }, { shape: 'cyl', box: [-0.04, 0.42, -0.04, 0.04, 1.45, 0.04], color: '#4f6b3a' }, { shape: 'blob', box: [-0.78, 1.05, -0.78, 0.78, 1.9, 0.78], color: '#40916c' }],
  },
  'ficus-tree': {
    footprint: [1.0, 1.0], height: 1.8, params: ['color', 'h'], tags: ['living', 'dining', 'office', 'entry'],
    create: (it, ctx) => recipes['ficus-tree'](it, ctx),   // softkit plants v2 (assets/props/plants2.ts)
    iso: [{ shape: 'cyl', box: [-0.23, 0, -0.23, 0.23, 0.46, 0.23], color: 'role:accent' }, { shape: 'cyl', box: [-0.035, 0.46, -0.035, 0.035, 1.3, 0.035], color: '#5b4636' }, { shape: 'blob', box: [-0.47, 1.1, -0.47, 0.47, 1.8, 0.47], color: '#386641' }],
  },
  'olive-tree-pot': {
    footprint: [0.9, 0.9], height: 1.6, params: ['color', 'h'], tags: ['living', 'dining', 'entry', 'outdoor'],
    create: (it, ctx) => recipes['olive-tree-pot'](it, ctx),   // softkit plants v2 (assets/props/plants2.ts)
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
    create: (it, ctx) => recipes['pampas-vase'](it, ctx),   // softkit plants v2 (assets/props/plants2.ts)
    iso: [{ shape: 'cyl', box: [-0.1, 0, -0.1, 0.1, 0.5, 0.1], color: 'role:accent' }, { shape: 'blob', box: [-0.18, 0.85, -0.18, 0.18, 1.18, 0.18], color: '#e8d9c0' }],
  },

  // ---- hanging -----------------------------------------------------------------------------------------------
  'hanging-plant': {
    footprint: [0.5, 0.5], height: 0.89, params: ['color', 'y'], tags: ['living', 'kitchen', 'bathroom', 'bedroom'],   // ≤ 37 meshes
    create: (it, ctx) => recipes['hanging-plant'](it, ctx),   // softkit plants v2 (assets/props/plants2.ts)
    iso: [{ shape: 'cyl', box: [-0.15, 1.5, -0.15, 0.15, 1.66, 0.15], color: 'role:accent' }, { shape: 'blob', box: [-0.2, 1.62, -0.2, 0.2, 1.9, 0.2], color: '#40916c' }, { shape: 'blob', box: [-0.24, 1.22, -0.24, 0.24, 1.5, 0.24], color: '#4f772d' }],
  },

  // ---- on a surface ------------------------------------------------------------------------------------------
  'herb-pots': {
    footprint: [0.42, 0.17], height: 0.26, surface: true, params: ['color'], tags: ['kitchen'],
    create: (it, ctx) => recipes['herb-pots'](it, ctx),   // softkit plants v2 (assets/props/plants2.ts)
    iso: [{ shape: 'box', box: [-0.21, 0, -0.08, 0.21, 0.035, 0.08], color: 'role:wood' }, { shape: 'blob', box: [-0.19, 0.03, -0.06, -0.07, 0.26, 0.06], color: '#4f9d3f' }, { shape: 'blob', box: [-0.06, 0.03, -0.06, 0.06, 0.26, 0.06], color: '#8a9a7b' }, { shape: 'blob', box: [0.07, 0.03, -0.06, 0.19, 0.26, 0.06], color: '#6a994e' }],
  },
  'orchid': {
    footprint: [0.44, 0.44], height: 0.55, surface: true, params: ['color'], tags: ['bedroom', 'living', 'bathroom', 'dining', 'office'],
    create: (it, ctx) => recipes['orchid'](it, ctx),   // softkit plants v2 (assets/props/plants2.ts)
    iso: [{ shape: 'cyl', box: [-0.075, 0, -0.075, 0.075, 0.13, 0.075], color: 'role:linen' }, { shape: 'blob', box: [-0.2, 0.13, -0.2, 0.2, 0.2, 0.2], color: '#2d6a4f' }, { shape: 'blob', box: [0.05, 0.4, -0.05, 0.25, 0.55, 0.1], color: '#f4c2d7' }],
  },
  'succulent-tray': {
    footprint: [0.36, 0.2], height: 0.12, surface: true, params: ['color'], tags: ['office', 'living', 'kitchen', 'bedroom'],
    create: (it, ctx) => recipes['succulent-tray'](it, ctx),   // softkit plants v2 (assets/props/plants2.ts)
    iso: [{ shape: 'box', box: [-0.18, 0, -0.1, 0.18, 0.04, 0.1], color: 'role:wood' }, { shape: 'blob', box: [-0.16, 0.03, -0.08, 0.16, 0.12, 0.08], color: '#6a994e' }],
  },
  'trailing-ivy': {
    footprint: [0.43, 0.44], height: 0.25, surface: true, params: ['color'], tags: ['living', 'office', 'bedroom', 'kitchen'],
    create: (it, ctx) => recipes['trailing-ivy'](it, ctx),   // softkit plants v2 (assets/props/plants2.ts)
    iso: [{ shape: 'cyl', box: [-0.1, 0, -0.23, 0.1, 0.14, -0.03], color: 'role:accent' }, { shape: 'blob', box: [-0.12, 0.14, -0.25, 0.12, 0.25, -0.01], color: '#40916c' }, { shape: 'blob', box: [-0.2, 0, -0.05, 0.2, 0.05, 0.22], color: '#6a994e' }],
  },
  'fern': {
    footprint: [0.62, 0.62], height: 0.36, surface: true, params: ['color'], tags: ['bathroom', 'bedroom', 'living'],   // 30 meshes
    create: (it, ctx) => recipes['fern'](it, ctx),   // softkit plants v2 (assets/props/plants2.ts)
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
    footprint: [0.9, 0.8], height: 1.7, params: ['color', 'h'], tags: ['living', 'dining', 'entry', 'sunroom'],
    create: (it, ctx) => recipes['bird-of-paradise'](it, ctx),   // softkit plants v2 (assets/props/plants2.ts)
    iso: [{ shape: 'cyl', box: [-0.22, 0, -0.22, 0.22, 0.4, 0.22], color: 'role:accent' }, { shape: 'blob', box: [-0.45, 0.4, -0.45, 0.45, 1.7, 0.45], color: '#386641' }],
  },
  // Rubber plant — a straight cane with glossy dark oval leaves held out all the way up (modern, industrial).
  'rubber-plant': {
    footprint: [0.5, 0.5], height: 1.6, params: ['color', 'h'], tags: ['living', 'office', 'bedroom', 'entry'],
    create: (it, ctx) => recipes['rubber-plant'](it, ctx),   // softkit plants v2 (assets/props/plants2.ts)
    iso: [{ shape: 'cyl', box: [-0.17, 0, -0.17, 0.17, 0.34, 0.17], color: 'role:accent' }, { shape: 'blob', box: [-0.33, 0.4, -0.33, 0.33, 1.5, 0.33], color: '#1f3d2b' }],
  },
  // ZZ plant — arching stems of small glossy paired leaflets from a low pot (every style, low light: halls, baths).
  'zz-plant': {
    footprint: [0.6, 0.6], height: 0.85, params: ['color', 'h'], tags: ['living', 'bedroom', 'office', 'bathroom', 'entry'],
    create: (it, ctx) => recipes['zz-plant'](it, ctx),   // softkit plants v2 (assets/props/plants2.ts)
    iso: [{ shape: 'cyl', box: [-0.15, 0, -0.15, 0.15, 0.26, 0.15], color: 'role:accent' }, { shape: 'blob', box: [-0.3, 0.26, -0.3, 0.3, 0.85, 0.3], color: '#2d5a3a' }],
  },
  // Dracaena — two or three bare canes of different heights each topped by a tuft of strappy leaves (modern,
  // scandi, tropical).
  'dracaena': {
    footprint: [0.8, 0.8], height: 1.8, params: ['color', 'h'], tags: ['living', 'office', 'entry', 'dining'],
    create: (it, ctx) => recipes['dracaena'](it, ctx),   // softkit plants v2 (assets/props/plants2.ts)
    iso: [{ shape: 'cyl', box: [-0.18, 0, -0.18, 0.18, 0.38, 0.18], color: 'role:accent' }, { shape: 'blob', box: [-0.4, 1.0, -0.4, 0.4, 1.8, 0.4], color: '#4f772d' }],
  },

  // ---- more houseplants (plan S3: snake-plant and zz-plant were in 30 of 30 houses) ----------------------------------------------
  // Peace lily — a clump of broad glossy leaves on stems, three white spathes above them.
  'peace-lily': {
    footprint: [0.7, 0.8], height: 1.0, params: ['color', 'h'], tags: ['living', 'bedroom', 'office', 'bathroom', 'entry'],
    create: (it, ctx) => recipes['peace-lily'](it, ctx),   // softkit plants v2 (assets/props/plants2.ts)
    iso: [{ shape: 'cyl', box: [-0.15, 0, -0.15, 0.15, 0.24, 0.15], color: 'role:accent' }, { shape: 'blob', box: [-0.3, 0.24, -0.3, 0.3, 0.85, 0.3], color: '#1f4d2e' }],
  },
  // Aloe pot — a rosette of thick pointed blades in a small clay pot; sits on a table, shelf or counter.
  'aloe-pot': {
    footprint: [0.36, 0.36], height: 0.4, surface: true, params: ['color'], tags: ['living', 'office', 'kitchen', 'bedroom', 'bathroom'],
    create: (it, ctx) => recipes['aloe-pot'](it, ctx),   // softkit plants v2 (assets/props/plants2.ts)
    iso: [{ shape: 'cyl', box: [-0.1, 0, -0.1, 0.1, 0.13, 0.1], color: 'role:accent' }, { shape: 'blob', box: [-0.17, 0.13, -0.17, 0.17, 0.4, 0.17], color: '#5f8f5a' }],
  },
  // Ponytail palm — a swollen bulb of a trunk under a fountain of long drooping strands (a floor plant, 1.2 m).
  'ponytail-palm': {
    footprint: [0.85, 0.85], height: 1.0, params: ['color', 'h'], tags: ['living', 'office', 'entry', 'sunroom'],
    create: (it, ctx) => recipes['ponytail-palm'](it, ctx),   // softkit plants v2 (assets/props/plants2.ts)
    iso: [{ shape: 'cyl', box: [-0.17, 0, -0.17, 0.17, 0.26, 0.17], color: 'role:accent' }, { shape: 'blob', box: [-0.4, 0.3, -0.4, 0.4, 1.2, 0.4], color: '#5a8f3f' }],
  },
  // Jade plant — thick woody stems carrying rounded fleshy leaves, in a small pot; a table plant.
  'jade-plant': {
    footprint: [0.36, 0.36], height: 0.42, surface: true, params: ['color'], tags: ['living', 'office', 'kitchen', 'bedroom'],
    create: (it, ctx) => recipes['jade-plant'](it, ctx),   // softkit plants v2 (assets/props/plants2.ts)
    iso: [{ shape: 'cyl', box: [-0.1, 0, -0.1, 0.1, 0.12, 0.1], color: 'role:accent' }, { shape: 'blob', box: [-0.15, 0.12, -0.15, 0.15, 0.4, 0.15], color: '#3f7f45' }],
  },
  // Calathea — a low clump of broad oval leaves with a pale stripe down the middle, purple undersides showing at the rim.
  'calathea': {
    footprint: [0.7, 0.7], height: 0.7, params: ['color', 'h'], tags: ['living', 'bedroom', 'office', 'bathroom'],
    create: (it, ctx) => recipes['calathea'](it, ctx),   // softkit plants v2 (assets/props/plants2.ts)
    iso: [{ shape: 'cyl', box: [-0.16, 0, -0.16, 0.16, 0.25, 0.16], color: 'role:accent' }, { shape: 'blob', box: [-0.33, 0.25, -0.33, 0.33, 0.7, 0.33], color: '#2f5d3a' }],
  },
}, { foliage: true });   // PLAN 5.3: foliage on ALL the registry plants (a leaf's bounding box is not its shape)
