// Site species — the plants a `planting` (assets/site-planting.ts) is made of, one unit geometry per species, drawn
// as InstancedMeshes (the plugin-trees pattern the site kit already uses for beds: one geometry per variant, a
// matrix and a tint per plant). Built by assets/site.ts's kit, which hands in its helpers (leaf clusters, bushes,
// grass tufts, flower heads), so a planting is made of the same stuff as every other plant on the lot.
//
// A species geometry is UNIT size: its base at y 0, its crown reaching radius 1 in plan and height 1, so a plant is
// placed with scale (r, h, r). Flowering species also give their HEAD geometry and the spots on the unit foliage
// where heads sit (`lift`: how far above the foliage a stemmed head stands, as a share of the plant's height), and
// the heads are one InstancedMesh per species whose instance colours carry each plant's bloom.
//
//   shrubs      mound, spreading, boxwood, topiary-ball, topiary-cone, columnar (arborvitae), rosemary, groundcover,
//               silver (lamb's ear, artemisia), hosta, fern, broadleaf (banana, elephant ear)
//   grasses     grass (a tuft)
//   succulents  agave, yucca, succulent (a small rosette), cactus
//   flowers     daisy, tulip, bloom, rose, lavender, spike (delphinium, foxglove), allium, sedum, hydrangea
//   rock        a boulder
//
// Shapes only: every stream here comes from the rng the kit hands in (seeded per site item), never Math.random.
export function createSpecies(K) {
  const { THREE, V, clusterGeo, bushGeo, merged, grassTuft, flowerHead, shadeFacets, limbGeo } = K;
  const clamp01 = v => Math.max(0, Math.min(1, v));

  // normalise a geometry (and spots in its frame) to the unit plant: base at 0, plan radius 1, height 1
  function unit(geo, spots = []) {
    geo.computeBoundingBox();
    const b = geo.boundingBox, pos = geo.attributes.position;
    let R = 1e-6; for (let i = 0; i < pos.count; i++) R = Math.max(R, Math.hypot(pos.getX(i), pos.getZ(i)));
    const H = Math.max(1e-6, b.max.y - b.min.y), y0 = b.min.y;
    geo.translate(0, -y0, 0); geo.scale(1 / R, 1 / H, 1 / R); geo.computeVertexNormals();
    return { geo, spots: spots.map(p => V(p.x / R, (p.y - y0) / H, p.z / R)) };
  }
  // points on the top surface of a geometry (a blossom sits ON the leaves)
  function topSpots(geo, r, n, minY = 0.45) {
    const pos = geo.attributes.position; let maxY = -Infinity, minYv = Infinity;
    for (let i = 0; i < pos.count; i++) { maxY = Math.max(maxY, pos.getY(i)); minYv = Math.min(minYv, pos.getY(i)); }
    const cut = minYv + (maxY - minYv) * minY, cand = [];
    for (let i = 0; i < pos.count; i += 3) if (pos.getY(i) > cut) cand.push(i);
    return Array.from({ length: n }, () => { const i = cand[Math.floor(r() * cand.length)] ?? 0; return V(pos.getX(i), pos.getY(i), pos.getZ(i)); });
  }
  // a vertex-coloured copy of geo with every colour multiplied by k (a darker core, a paler tip)
  const tintGeo = (geo, k) => { const c = geo.attributes.color; if (c) for (let i = 0; i < c.array.length; i++) c.array[i] *= k; return geo; };
  const colorAll = (geo, [r, g, b]) => { const n = geo.attributes.position.count, c = new Float32Array(n * 3); for (let i = 0; i < n; i++) { c[i * 3] = r; c[i * 3 + 1] = g; c[i * 3 + 2] = b; } geo.setAttribute('color', new THREE.BufferAttribute(c, 3)); return geo; };
  // a shell of small clusters over a surface given by f(u, v) → point, clipped-looking (flat, dense, even)
  function clipped(r, surf, n, size, { dark = 0.55, core = null } = {}) {
    // (a clipped shape is a shell of small flat clusters: 20 triangles a cluster, more of them — 80 apiece cost ten
    // thousand triangles a topiary ball, on a plant a metre across)
    const base = clusterGeo(r, { detail: 0, rough: 0.12, squash: 0.9 }), geos = [];
    if (core) geos.push(tintGeo(core, 0.42));
    const e = new THREE.Euler();
    for (let i = 0; i < n; i++) {
      // Fibonacci-ish spread in (u, v) so the skin is even, jittered a little
      const u = (i + 0.5) / n, v = (i * 0.618034) % 1, p = surf(clamp01(u + (r() - 0.5) * 0.02), v + (r() - 0.5) * 0.02);
      const q = base.clone(), s = size * (0.8 + r() * 0.4);
      q.scale(s, s * 0.8, s); q.applyQuaternion(new THREE.Quaternion().setFromEuler(e.set((r() - 0.5) * 0.6, r() * 6.28, (r() - 0.5) * 0.6))); q.translate(p.x, p.y, p.z);
      const up = clamp01(p.y / 1.2), c = q.attributes.color.array, t = (dark + 0.4 * up) * (0.93 + r() * 0.14);
      for (let k = 0; k < c.length; k++) c[k] *= t;
      geos.push(q);
    }
    return merged(geos);
  }
  // thin tapering leaves (a rosette): each a flat blade from the base, rising at `rise`, arching by `arch`
  function blades(r, { n = 14, len = 1, wide = 0.08, rise = [0.6, 1.3], arch = 0.25, thick = 0, twist = 0.2, seg = 5, tone = [0.75, 1.05], ring = 0.02 }) {
    const pos = [], col = [];
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + (r() - 0.5) * 0.5, el = rise[0] + (rise[1] - rise[0]) * r(), L = len * (0.7 + r() * 0.45), W = wide * (0.8 + r() * 0.4), tw = (r() - 0.5) * twist;
      const dir = V(Math.cos(a), 0, Math.sin(a)), side = V(-Math.sin(a + tw), 0, Math.cos(a + tw));
      const P = u => { const e = el - arch * u * u * 2; return V(dir.x * Math.cos(e) * L * u + dir.x * ring, Math.sin(e) * L * u + (el > 1.2 ? 0 : 0), dir.z * Math.cos(e) * L * u + dir.z * ring); };
      const tn = tone[0] + (tone[1] - tone[0]) * r();
      for (let j = 0; j < seg; j++) {
        const u0 = j / seg, u1 = (j + 1) / seg, w0 = W * (1 - u0 * 0.92), w1 = W * (1 - u1 * 0.92);
        const A = P(u0), B = P(u1);
        const A0 = A.clone().addScaledVector(side, -w0), A1 = A.clone().addScaledVector(side, w0), B0 = B.clone().addScaledVector(side, -w1), B1 = B.clone().addScaledVector(side, w1);
        // a keel: the middle stands a little proud, so the blade folds (thick > 0 makes a succulent leaf)
        const mA = A.clone().addScaledVector(V(0, 1, 0), thick * (1 - u0) + 0.004), mB = B.clone().addScaledVector(V(0, 1, 0), thick * (1 - u1) + 0.004);
        const c0 = tn * (0.72 + 0.3 * u0), c1 = tn * (0.72 + 0.3 * u1);
        for (const [a0, b0, a1, b1] of [[A0, B0, mA, mB], [mA, mB, A1, B1]]) {
          pos.push(a0.x, a0.y, a0.z, b0.x, b0.y, b0.z, a1.x, a1.y, a1.z, a1.x, a1.y, a1.z, b0.x, b0.y, b0.z, b1.x, b1.y, b1.z);
          col.push(c0, c0, c0, c1, c1, c1, c0, c0, c0, c0, c0, c0, c1, c1, c1, c1, c1, c1);
        }
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.computeVertexNormals();
    return g;
  }
  // a pinnate frond (fern, small palm): a spine arching out with leaflets both sides
  function fronds(r, { n = 9, len = 1, rise = [0.7, 1.1], droop = 0.9, leaflet = 0.16, seg = 10 }) {
    const pos = [], col = [];
    for (let f = 0; f < n; f++) {
      const phi = (f / n) * Math.PI * 2 + (r() - 0.5) * 0.4, d = V(Math.cos(phi), 0, Math.sin(phi)), side = V(-d.z, 0, d.x), el = rise[0] + (rise[1] - rise[0]) * r(), L = len * (0.75 + r() * 0.35);
      const S = u => V(d.x * Math.cos(el) * L * u, (Math.sin(el) * u - droop * u * u * 0.5) * L, d.z * Math.cos(el) * L * u);
      const tone = 0.78 + r() * 0.25;
      for (let j = 0; j < seg; j++) {
        const u0 = j / seg, u1 = (j + 1) / seg, A = S(u0), B = S(u1), w = leaflet * L * Math.sin(Math.PI * Math.min(1, (u0 + u1) / 2 * 1.05)) * (j % 2 ? 0.85 : 1);
        for (const sgn of [-1, 1]) {
          const tip = V().lerpVectors(A, B, 0.5).addScaledVector(side, sgn * w).addScaledVector(V(0, 1, 0), -w * 0.35);
          pos.push(A.x, A.y, A.z, B.x, B.y, B.z, tip.x, tip.y, tip.z);
          const c = tone * (0.7 + 0.3 * u0); col.push(c, c, c, c, c, c, c * 1.05, c * 1.05, c * 1.05);
        }
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.computeVertexNormals();
    return g;
  }
  // broad paddle leaves on petioles (banana, elephant ear, canna)
  function paddles(r, { n = 6, len = 1 }) {
    const geos = [];
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + (r() - 0.5) * 0.5, el = 0.9 + r() * 0.5, L = len * (0.7 + r() * 0.4), d = V(Math.cos(a), 0, Math.sin(a));
      const stemTop = V(d.x * L * 0.25, L * 0.55 * Math.sin(el), d.z * L * 0.25);
      geos.push(colorAll(limbGeo(V(0, 0, 0), stemTop, 0.02, 0.012, 4), [0.6, 0.66, 0.5]));
      // the blade: a folded ellipse from the stem top outward and up
      const pos = [], col = [], side = V(-d.z, 0, d.x), seg = 6, W = L * 0.22;
      const P = u => V(stemTop.x + d.x * L * 0.6 * u, stemTop.y + L * 0.35 * u - L * 0.25 * u * u, stemTop.z + d.z * L * 0.6 * u);
      for (let j = 0; j < seg; j++) {
        const u0 = j / seg, u1 = (j + 1) / seg, A = P(u0), B = P(u1), w0 = W * Math.sin(Math.PI * u0) + 0.01, w1 = W * Math.sin(Math.PI * u1) + 0.01;
        for (const sgn of [-1, 1]) {
          const a0 = A.clone().addScaledVector(side, sgn * w0).addScaledVector(V(0, 1, 0), -w0 * 0.25), b0 = B.clone().addScaledVector(side, sgn * w1).addScaledVector(V(0, 1, 0), -w1 * 0.25);
          pos.push(A.x, A.y, A.z, B.x, B.y, B.z, a0.x, a0.y, a0.z, a0.x, a0.y, a0.z, B.x, B.y, B.z, b0.x, b0.y, b0.z);
          const c = 0.8 + 0.15 * u0; for (let k = 0; k < 6; k++) col.push(c, c, c);
        }
      }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
      geos.push(g);
    }
    return merged(geos);
  }
  // a ribbed column (cactus): a cylinder whose radius pulses with the ribs, capped round
  function ribbed(r, { h = 1, rad = 0.2, ribs = 10, arms = 0 }) {
    const parts = [];
    const col = (hh, rr, x = 0, z = 0, y = 0) => {
      const g = new THREE.CylinderGeometry(rr, rr * 1.05, hh, ribs * 2, 6), p = g.attributes.position;
      for (let i = 0; i < p.count; i++) { const ax = p.getX(i), az = p.getZ(i), an = Math.atan2(az, ax), k = 1 + 0.12 * Math.cos(an * ribs); p.setX(i, ax * k); p.setZ(i, az * k); }
      g.translate(x, y + hh / 2, z);
      const cap = new THREE.SphereGeometry(rr, ribs * 2, 5, 0, Math.PI * 2, 0, Math.PI / 2); cap.translate(x, y + hh, z);
      parts.push(g, cap);
    };
    col(h, rad);
    for (let i = 0; i < arms; i++) { const a = r() * 6.28, y = h * (0.35 + r() * 0.2), out = rad * 1.9, hh = h * (0.3 + r() * 0.2); col(0.001 + rad * 0.9, rad * 0.55, Math.cos(a) * rad * 1.2, Math.sin(a) * rad * 1.2, y); col(hh, rad * 0.62, Math.cos(a) * out, Math.sin(a) * out, y); }
    const g = merged(parts.map(p => p.index ? p.toNonIndexed() : p).map(p => colorAll(p, [1, 1, 1])));
    shadeFacets(g, r, { low: 0.66, axisY: h, spread: 0.08, warm: 0.02 });
    return g;
  }

  // ---- the species ------------------------------------------------------------------------------------------------
  // → { geo, leaf: colour, side?: DoubleSide, heads?: { geo, color (unused: instance colours carry it), spots, lift, scale }, stems?: colour }
  const LEAF = {
    mound: [0x3a5731, 0x42603a, 0x4a663b], box: [0x34502f, 0x3a5533], silver: [0x8e9a87, 0x98a393], rosemary: [0x56674f, 0x5d6d55],
    fern: [0x4d7036, 0x557a3a], hosta: [0x4a6b3c, 0x557a45], agave: [0x7c9a92, 0x86a39a, 0x728f86], yucca: [0x5d7a50, 0x66804f],
    succulent: [0x7d9a7a, 0x8aa383], cactus: [0x4f6b45, 0x5a7650], broadleaf: [0x3f6a32, 0x46723a], grass: [0x76824f, 0x6b7a47, 0x818a58],
    lavender: [0x7d8a78, 0x86917f], flower: [0x3f5c35, 0x46633a],
  };
  const pick = (r, a) => a[Math.floor(r() * a.length)];
  const flowerSpecies = (r, kind, { foliage, flat = 0.5, heads = 14, lift = 0, headKind = kind, leaf = LEAF.flower, grass = false, scale = 1 }) => {
    const fol = grass ? grassTuft(r, 0.5, 18, 0.1) : bushGeo(r, 0.4, { n: 9, size: 0.14, flat, detail: 0 });
    const spots = topSpots(fol, r, heads, 0.5);
    const u = unit(fol, spots);
    const hg = flowerHead(headKind, r);
    return { geo: u.geo, leaf: pick(r, leaf), side: grass ? THREE.DoubleSide : undefined, heads: { geo: hg.petals, centre: hg.centre, spots: u.spots, lift, scale }, foliage };
  };
  function build(draw: string, r: () => number): any {
    const [kind, name] = draw.split(':');
    if (kind === 'rock') {
      const g = new THREE.DodecahedronGeometry(1, 0); const p = g.attributes.position;
      for (let i = 0; i < p.count; i++) p.setY(i, p.getY(i) * (0.55 + r() * 0.1));
      return { geo: unit(g.toNonIndexed ? g.toNonIndexed() : g).geo, leaf: pick(r, [0x7a766f, 0x8a847b, 0x6d6a65]), rock: true };
    }
    if (kind === 'flower') {
      switch (name) {
        case 'lavender': return flowerSpecies(r, 'lavender', { foliage: 0.55, flat: 0.62, heads: 14, lift: 0.45, leaf: LEAF.lavender, scale: 1.4 });
        case 'spike': return flowerSpecies(r, 'spike', { foliage: 0.35, flat: 0.45, heads: 5, lift: 0.65, headKind: 'spike', scale: 1.8 });
        case 'allium': return flowerSpecies(r, 'allium', { foliage: 0.3, grass: true, heads: 3, lift: 0.7, headKind: 'allium', scale: 1.4 });
        case 'rose': return flowerSpecies(r, 'rose', { foliage: 0.9, flat: 0.8, heads: 11, lift: 0.02, headKind: 'rose', scale: 1.2 });
        case 'tulip': return flowerSpecies(r, 'tulip', { foliage: 0.45, flat: 0.45, heads: 7, lift: 0.5, scale: 1.1 });
        case 'daisy': return flowerSpecies(r, 'daisy', { foliage: 0.8, flat: 0.5, heads: 9, lift: 0.08, scale: 1.15 });
        default: return flowerSpecies(r, 'bloom', { foliage: 0.85, flat: 0.5, heads: 9, lift: 0.04, scale: 1.15 });
      }
    }
    if (kind === 'shrub') {
      switch (name) {
        case 'hydrangea': {
          const fol = bushGeo(r, 0.6, { n: 11, size: 0.22, flat: 0.8 }), spots = topSpots(fol, r, 16, 0.4), u = unit(fol, spots);
          return { geo: u.geo, leaf: pick(r, LEAF.mound), heads: { geo: headBall(r, 0.12), spots: u.spots, lift: 0.02, scale: 1.35 }, foliage: 0.92 };
        }
        case 'sedum': {
          const fol = bushGeo(r, 0.3, { n: 8, size: 0.1, flat: 0.45, detail: 0 }), spots = topSpots(fol, r, 8, 0.6), u = unit(fol, spots);
          return { geo: u.geo, leaf: pick(r, [0x6f8a5e, 0x7a9468]), heads: { geo: headFlat(r), spots: u.spots, lift: 0.02, scale: 1 }, foliage: 0.9 };
        }
        case 'boxwood': return { geo: unit(clipped(r, (u, v) => { const th = Math.acos(1 - 1.7 * u), ph = v * Math.PI * 2; return V(Math.sin(th) * Math.cos(ph), 0.5 + Math.cos(th) * 0.5, Math.sin(th) * Math.sin(ph)); }, 60, 0.21, { core: sphere(0.92, 0.5, 0.5) })).geo, leaf: pick(r, LEAF.box) };
        case 'topiary-ball': return { geo: unit(clipped(r, (u, v) => { const th = Math.acos(1 - 1.85 * u), ph = v * Math.PI * 2; return V(Math.sin(th) * Math.cos(ph), 1 + Math.cos(th), Math.sin(th) * Math.sin(ph)); }, 92, 0.2, { core: sphere(0.95, 1, 1) })).geo, leaf: pick(r, LEAF.box) };
        case 'topiary-cone': return { geo: unit(clipped(r, (u, v) => { const y = u * 2.6, rr = (1 - u) * 0.8 + 0.03, ph = v * Math.PI * 2; return V(Math.cos(ph) * rr, y + 0.05, Math.sin(ph) * rr); }, 104, 0.17, { core: cone(0.78, 2.6) })).geo, leaf: pick(r, LEAF.box) };
        case 'columnar': return { geo: unit(clipped(r, (u, v) => { const y = u * 3, prof = u < 0.25 ? 0.75 + u : Math.pow(1 - (u - 0.25) / 0.75, 0.7) * 0.95 + 0.06, ph = v * Math.PI * 2; return V(Math.cos(ph) * prof * 0.5, y, Math.sin(ph) * prof * 0.5); }, 104, 0.17, { core: cone(0.45, 3) })).geo, leaf: pick(r, [0x2e4a34, 0x32503a]) };
        case 'groundcover': return { geo: unit(bushGeo(r, 0.35, { n: 10, size: 0.1, flat: 0.42, detail: 0 })).geo, leaf: pick(r, [0x44633a, 0x4f6b3e, 0x3d5a36]) };
        case 'silver': return { geo: unit(bushGeo(r, 0.35, { n: 10, size: 0.1, flat: 0.5, detail: 0 })).geo, leaf: pick(r, LEAF.silver) };
        case 'rosemary': return { geo: unit(blades(r, { n: 40, len: 1, wide: 0.025, rise: [1.05, 1.45], arch: 0.1, seg: 4, tone: [0.7, 1.0] })).geo, leaf: pick(r, LEAF.rosemary), side: THREE.DoubleSide };
        case 'hosta': return { geo: unit(blades(r, { n: 12, len: 1, wide: 0.22, rise: [0.35, 0.8], arch: 0.3, seg: 5, tone: [0.8, 1.1] })).geo, leaf: pick(r, LEAF.hosta), side: THREE.DoubleSide };
        case 'fern': return { geo: unit(fronds(r, { n: 11, len: 1, rise: [0.6, 1.05], droop: 1.1, leaflet: 0.14 })).geo, leaf: pick(r, LEAF.fern), side: THREE.DoubleSide };
        case 'broadleaf': return { geo: unit(paddles(r, { n: 7, len: 1 })).geo, leaf: pick(r, LEAF.broadleaf), side: THREE.DoubleSide };
        case 'agave': return { geo: unit(blades(r, { n: 22, len: 1, wide: 0.1, rise: [0.35, 1.3], arch: 0.12, thick: 0.03, seg: 5, tone: [0.82, 1.08], twist: 0.05 })).geo, leaf: pick(r, LEAF.agave), side: THREE.DoubleSide };
        case 'succulent': return { geo: unit(blades(r, { n: 16, len: 1, wide: 0.16, rise: [0.3, 1.0], arch: 0.1, thick: 0.05, seg: 4, tone: [0.85, 1.1], twist: 0.05 })).geo, leaf: pick(r, LEAF.succulent), side: THREE.DoubleSide };
        case 'yucca': {
          // a short scaly trunk under a spiky ball of leaves
          const trunk = colorAll(limbGeo(V(0, 0, 0), V((r() - 0.5) * 0.1, 0.55, (r() - 0.5) * 0.1), 0.09, 0.07, 6).toNonIndexed(), [0.55, 0.5, 0.42]);
          const top = blades(r, { n: 36, len: 0.62, wide: 0.035, rise: [-0.3, 1.5], arch: 0.05, seg: 3, tone: [0.75, 1.05] }); top.translate(0, 0.55, 0);
          return { geo: unit(merged([trunk, top])).geo, leaf: pick(r, LEAF.yucca), side: THREE.DoubleSide };
        }
        case 'cactus': return { geo: unit(ribbed(r, { h: 1, rad: 0.22, ribs: 9, arms: r() < 0.6 ? 1 + Math.floor(r() * 2) : 0 })).geo, leaf: pick(r, LEAF.cactus) };
        case 'grass': return { geo: unit(grassTuft(r, 1, 34, 0.18)).geo, leaf: pick(r, LEAF.grass), side: THREE.DoubleSide };
        case 'spreading': return { geo: unit(bushGeo(r, 0.6, { n: 12, size: 0.2, flat: 0.55 })).geo, leaf: pick(r, LEAF.mound) };
        default: return { geo: unit(bushGeo(r, 0.6, { n: 11, size: 0.22, flat: 0.78 })).geo, leaf: pick(r, LEAF.mound) };
      }
    }
    return null;
  }
  const sphere = (rx, ry, cy) => { const g = new THREE.IcosahedronGeometry(1, 1).toNonIndexed(); g.scale(rx, ry, rx); g.translate(0, cy, 0); return colorAll(g, [1, 1, 1]); };
  const cone = (rad, h) => { const g = new THREE.ConeGeometry(rad, h, 8, 1).toNonIndexed(); g.translate(0, h / 2, 0); return colorAll(g, [1, 1, 1]); };
  // a hydrangea mophead: a ball of tiny florets
  function headBall(r, rad) {
    const parts = [];
    for (let i = 0; i < 10; i++) { const u = r() * 2 - 1, a = r() * 6.28, s = Math.sqrt(1 - u * u), f = new THREE.OctahedronGeometry(rad * 0.42, 0); f.translate(Math.cos(a) * s * rad * 0.75, Math.abs(u) * rad * 0.6, Math.sin(a) * s * rad * 0.75); parts.push(f); }
    return merged(parts);
  }
  // a flat sedum head: a low dome of tiny florets
  function headFlat(r) {
    const parts = [];
    for (let i = 0; i < 7; i++) { const a = r() * 6.28, d = r() * 0.05, f = new THREE.OctahedronGeometry(0.018, 0); f.translate(Math.cos(a) * d, 0.01 - d * 0.2, Math.sin(a) * d); parts.push(f); }
    return merged(parts);
  }
  return { build };
}
