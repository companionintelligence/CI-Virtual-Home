// softkit — the soft-furnishing grammar (PLAN 5.3, SOFT stream). Bedding, cushions, drapes, towels, throws (and, for the
// later waves, leaves, pots and cut flowers) are built from a handful of merged, role-tinted, vertex-shaded meshes
// instead of a stack of boxes.
//
// THREE-free at import: every function takes `ctx.THREE` (so a Node test can hand it the vendored three and the page
// its own). The contract every softkit prop obeys (and the rule the baked and dress-kit props follow too):
//   • no `map` on any material, so kit.theme() restrains the colour once and themeItem's colorParam path keeps working
//     (the one exception is a quilt, which a builder asks for and which kit.theme() already leaves alone);
//   • one mesh per role colour, `material.color` is the house role (or `it.color`), and the per-vertex `color` attribute
//     is a NEUTRAL shade multiplier only (seam darkening, fold valleys, underside), never a hue — one constant, SHADE;
//   • fresh materials per create(), geometry is built per create() and never cached across houses;
//   • opaque everywhere (GTAO turns an alpha-cut card into a solid quad; a leaf is a closed lens), the one allowance being
//     the optional sheer curtain, which is transparent, casts no shadow and sits behind one constant;
//   • no part thinner than 6 mm (a lens has a rim strip, not a collapsed edge), round bodies at least 16 segments;
//   • every random draw comes from ctx.rng (or a stream seeded by ONE draw from it), a fixed count per builder;
//   • no Math.random, Date or performance anywhere in this file (scripts/test-softkit.mts greps for them).
// Origin and facing follow the prop contract (assets/props/index.ts): floor centre, +z south, head of a bed at −z.

/** the neutral shade multipliers, in one place so the look can be retuned (and so a double-darkening against GTAO is one edit) */
export const SHADE = {
  seam: 0.88,        // a stitched seam, the join between two cushions
  under: 0.86,       // an underside, a hidden face
  fold: 0.80,        // the valley of a fold (curtain, towel, duvet skirt): 12-20% deep, never more
  crown: 1.0,        // the top of a puffed surface
  floor: 0.62,       // soil, the part of a leaf by the stem, the root of a pleat
  mattress: 0.93,    // the fitted sheet is a shade off the linen, so the pillows read against it
} as const;

/** a small seeded stream (mulberry32): for the few builders that spend ONE draw of ctx.rng and then need many */
export function stream(seed: number): () => number {
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
/** one draw of ctx.rng, spent as the seed of a private stream */
export const splitRng = (rng: () => number) => stream(Math.floor(rng() * 4294967296));

export const clamp = (x: number, a: number, b: number) => Math.max(a, Math.min(b, x));
export const smooth = (a: number, b: number, x: number) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
/** n+1 evenly spaced knots from −H to +H */
export const lin = (H: number, n: number) => Array.from({ length: n + 1 }, (_, i) => -H + (2 * H * i) / n);
/** n+1 evenly spaced values from 0 to 1 */
export const unit = (n: number) => Array.from({ length: n + 1 }, (_, i) => i / n);

const kits = new WeakMap<object, any>();
/** the grammar for one THREE (built once per THREE: it holds functions only, no geometry, no material) */
export function softkit(THREE: any) {
  const hit = kits.get(THREE);
  if (hit) return hit;

  // ---- the accumulator: welded positions + a neutral shade, indexed triangles ---------------------------------------------
  class Acc {
    pos: number[] = []; col: number[] = []; idx: number[] = []; map = new Map<string, number>();
    /** a vertex at (x, y, z) with shade s; a vertex within 0.05 mm of an earlier one IS that one (computeVertexNormals then smooths across the seam) */
    v(x: number, y: number, z: number, s = 1): number {
      const key = `${Math.round(x * 2e4)},${Math.round(y * 2e4)},${Math.round(z * 2e4)}`;
      const at = this.map.get(key);
      if (at !== undefined) { const c = this.col; c[at * 3] = c[at * 3 + 1] = c[at * 3 + 2] = Math.min(c[at * 3], s); return at; }
      const i = this.pos.length / 3; this.pos.push(x, y, z); this.col.push(s, s, s); this.map.set(key, i); return i;
    }
    tri(a: number, b: number, c: number) { if (a !== b && b !== c && a !== c) this.idx.push(a, b, c); }
    get tris() { return this.idx.length / 3; }
    get verts() { return this.pos.length / 3; }
    /** a (nu+1) × (nv+1) grid of vertex ids as triangles, flipped as a whole so its mean normal agrees with `want` */
    grid(ids: number[], nu: number, nv: number, want: number[]) {
      const p = (i: number) => [this.pos[i * 3], this.pos[i * 3 + 1], this.pos[i * 3 + 2]];
      const t: number[][] = [];
      for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) {
        const a = ids[j * (nu + 1) + i], b = ids[j * (nu + 1) + i + 1], c = ids[(j + 1) * (nu + 1) + i + 1], d = ids[(j + 1) * (nu + 1) + i];
        t.push([a, b, c], [a, c, d]);
      }
      let dot = 0;
      for (const [a, b, c] of t) {
        const A = p(a), B = p(b), C = p(c), u = [B[0] - A[0], B[1] - A[1], B[2] - A[2]], v = [C[0] - A[0], C[1] - A[1], C[2] - A[2]];
        dot += (u[1] * v[2] - u[2] * v[1]) * want[0] + (u[2] * v[0] - u[0] * v[2]) * want[1] + (u[0] * v[1] - u[1] * v[0]) * want[2];
      }
      for (const [a, b, c] of t) dot >= 0 ? this.tri(a, b, c) : this.tri(a, c, b);
    }
    /** the BufferGeometry: position, normal (smooth across welds), `color` (the neutral shade), and `uv` only when `uv(x,y,z)` is given (a quilt) */
    geometry(uv?: (x: number, y: number, z: number) => [number, number]) {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
      g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
      if (uv) { const t: number[] = []; for (let i = 0; i < this.pos.length; i += 3) t.push(...uv(this.pos[i], this.pos[i + 1], this.pos[i + 2])); g.setAttribute('uv', new THREE.Float32BufferAttribute(t, 2)); }
      g.setIndex(this.idx); g.computeVertexNormals(); g.computeBoundingSphere(); g.computeBoundingBox(); return g;
    }
    mesh(mat: any, { cast = true, receive = true, uv }: { cast?: boolean; receive?: boolean; uv?: (x: number, y: number, z: number) => [number, number] } = {}) {
      const m = new THREE.Mesh(this.geometry(uv), mat); m.castShadow = cast; m.receiveShadow = receive; return m;
    }
  }

  const V = new THREE.Vector3();

  // ---- a rounded box (cushion, mattress, duvet, throw, arm, pouf): optionally puffed, waved, shaded -----------------------
  // faces: which of py ny px nx pz nz to emit. kx/ky/kz: knot positions (−half..+half) on each axis, more knots = more folds.
  // wave(x,y,z,nx,ny,nz) → [dx,dy,dz] is a pure function of the point (so welded seams stay closed); shade(...) → multiplier.
  function shell(acc: any, o: any) {
    const { cx = 0, cy = 0, cz = 0, w, h, d, r = 0.02, faces = ['py', 'ny', 'px', 'nx', 'pz', 'nz'], puff = 0, wave = null, shade = null, xf = null } = o;
    const hx = w / 2, hy = h / 2, hz = d / 2, rr = Math.min(r, hx * 0.95, hy * 0.95, hz * 0.95);
    const K = (H: number, k?: number[]) => k || [-H, -H + rr, 0, H - rr, H];
    const KX = K(hx, o.kx), KY = K(hy, o.ky), KZ = K(hz, o.kz);
    const proj = (qx: number, qy: number, qz: number) => {
      const ix = clamp(qx, -(hx - rr), hx - rr), iy = clamp(qy, -(hy - rr), hy - rr), iz = clamp(qz, -(hz - rr), hz - rr);
      let nx = qx - ix, ny = qy - iy, nz = qz - iz; const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
      return [ix + nx * rr, iy + ny * rr, iz + nz * rr, nx, ny, nz];
    };
    const emit = (U: number[], W: number[], q: (u: number, v: number) => number[], want: number[]) => {
      const ids: number[] = [];
      for (const b of W) for (const a of U) {
        const [qx, qy, qz] = q(a, b); let [x, y, z, nx, ny, nz] = proj(qx, qy, qz);
        if (puff && ny > 0.2) y += puff * Math.max(0, 1 - (x / hx) ** 2) * Math.max(0, 1 - (z / hz) ** 2) * ny;
        if (wave) { const dv = wave(x, y, z, nx, ny, nz); x += dv[0]; y += dv[1]; z += dv[2]; }
        const mx = Math.max(Math.abs(nx), Math.abs(ny), Math.abs(nz));
        const s = shade ? shade(x, y, z, nx, ny, nz) : 0.88 + 0.12 * smooth(0.62, 0.98, mx) - (ny < -0.5 ? 0.1 : 0);
        let X = cx + x, Y = cy + y, Z = cz + z;
        if (xf) { V.set(X, Y, Z).applyMatrix4(xf); X = V.x; Y = V.y; Z = V.z; }
        ids.push(acc.v(X, Y, Z, clamp(s, 0.3, 1)));
      }
      acc.grid(ids, U.length - 1, W.length - 1, want);
    };
    if (faces.includes('py')) emit(KX, KZ, (u, v) => [u, hy, v], [0, 1, 0]);
    if (faces.includes('ny')) emit(KX, KZ, (u, v) => [u, -hy, v], [0, -1, 0]);
    if (faces.includes('px')) emit(KZ, KY, (u, v) => [hx, v, u], [1, 0, 0]);
    if (faces.includes('nx')) emit(KZ, KY, (u, v) => [-hx, v, u], [-1, 0, 0]);
    if (faces.includes('pz')) emit(KX, KY, (u, v) => [u, v, hz], [0, 0, 1]);
    if (faces.includes('nz')) emit(KX, KY, (u, v) => [u, v, -hz], [0, 0, -1]);
  }

  // ---- a pillow: the thickness vanishes at the seam, the corners pulled into ears, leaning by rotX ---------------------------
  // The top surface is a lens over the pillow's middle plane (its thickness vanishes at the seam); every vertex is clamped up to
  // `floorY` (the mattress) so a leaning pillow's low edge lies ON the mattress instead of sinking into it.
  function pillow(acc: any, o: any) {
    const { x = 0, y = 0, z = 0, w = 0.6, d = 0.4, t = 0.13, rotX = 0, rotY = 0, rotZ = 0, nu = 7, nv = 5, floorY = null, seamShade = 0.84 } = o;
    const m = new THREE.Matrix4().makeTranslation(x, y, z).multiply(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(rotX, rotY, rotZ, 'YXZ')));
    const top: number[] = [];
    for (let j = 0; j <= nv; j++) for (let i = 0; i <= nu; i++) {
      const u = (i / nu) * 2 - 1, v = (j / nv) * 2 - 1;
      const ear = 1 + 0.035 * Math.pow(Math.abs(u * v), 3);
      const k = Math.pow(Math.max(0, 1 - Math.pow(Math.abs(u), 3.2)) * Math.max(0, 1 - Math.pow(Math.abs(v), 3.2)), 0.55);
      const th = (t / 2) * k, lx = (w / 2) * u * ear, lz = (d / 2) * v * ear;
      V.set(lx, th, lz).applyMatrix4(m);
      top.push(acc.v(V.x, floorY === null ? V.y : Math.max(V.y, floorY + 0.002), V.z, seamShade + (1 - seamShade) * k));
    }
    acc.grid(top, nu, nv, [0, 1, 0]);
    // No underside: a down-facing face lying just over an up-facing one (a pillow on a mattress) is what GTAO's normal/depth pass reads as
    // a solid occluder, and it paints a black halo round the pillow (seen in the first cut). Open underneath, the pillow rests on its seam.
  }

  // ---- a cloth sheet over a (u, v) grid, optionally a closed lens (front and back joined by a rim strip) --------------------
  // pos(u,v) → [x,y,z] is the cloth's middle surface. th > 0 offsets the front and back by ±th/2 along the surface normal
  // (found from the grid itself); the border is pulled to rimK of the thickness and closed by a strip with its own normals,
  // because a border shared by two opposing sheets averages its normals to zero and renders black.
  function sheet(acc: any, o: any) {
    const { U, Vn, pos, shade, th = 0, want = [0, 0, 1], rimK = 0.4 } = o;
    const nu = U.length - 1, nv = Vn.length - 1;
    const P: number[][] = [];
    for (let j = 0; j <= nv; j++) for (let i = 0; i <= nu; i++) P.push(pos(U[i], Vn[j]));
    const at = (i: number, j: number) => P[clamp(j, 0, nv) * (nu + 1) + clamp(i, 0, nu)];
    const front: number[] = [], back: number[] = [];
    for (let j = 0; j <= nv; j++) for (let i = 0; i <= nu; i++) {
      const [x, y, z] = at(i, j), s = shade ? shade(U[i], Vn[j], x, y, z) : 1;
      if (!th) { front.push(acc.v(x, y, z, s)); continue; }
      const a = at(i + 1, j), b = at(i - 1, j), c = at(i, j + 1), e = at(i, j - 1);
      const du = [a[0] - b[0], a[1] - b[1], a[2] - b[2]], dv = [c[0] - e[0], c[1] - e[1], c[2] - e[2]];
      let n = [du[1] * dv[2] - du[2] * dv[1], du[2] * dv[0] - du[0] * dv[2], du[0] * dv[1] - du[1] * dv[0]];
      const l = Math.hypot(n[0], n[1], n[2]) || 1; n = n.map(q => q / l);
      if (n[0] * want[0] + n[1] * want[1] + n[2] * want[2] < 0) n = n.map(q => -q);
      const border = i === 0 || j === 0 || i === nu || j === nv, k = (border ? rimK : 1) * th / 2;
      front.push(acc.v(x + n[0] * k, y + n[1] * k, z + n[2] * k, s));
      back.push(acc.v(x - n[0] * k, y - n[1] * k, z - n[2] * k, s * 0.92));
    }
    acc.grid(front, nu, nv, want);
    if (!th) return;
    acc.grid(back, nu, nv, [-want[0], -want[1], -want[2]]);
    // the rim strip, outward by the sheet's own centroid
    let cx = 0, cy = 0, cz = 0; for (const p of P) { cx += p[0]; cy += p[1]; cz += p[2]; }
    const C = [cx / P.length, cy / P.length, cz / P.length], Q = (i: number) => [acc.pos[i * 3], acc.pos[i * 3 + 1], acc.pos[i * 3 + 2]];
    const ring: number[][] = [];
    for (let i = 0; i < nu; i++) ring.push([i, 0, i + 1, 0]);
    for (let j = 0; j < nv; j++) ring.push([nu, j, nu, j + 1]);
    for (let i = nu; i > 0; i--) ring.push([i, nv, i - 1, nv]);
    for (let j = nv; j > 0; j--) ring.push([0, j, 0, j - 1]);
    const id = (i: number, j: number) => j * (nu + 1) + i;
    for (const [i0, j0, i1, j1] of ring) {
      const a0 = front[id(i0, j0)], a1 = front[id(i1, j1)], b0 = back[id(i0, j0)], b1 = back[id(i1, j1)];
      const A = Q(a0), B = Q(a1), D = Q(b1), m = [(A[0] + B[0]) / 2 - C[0], (A[1] + B[1]) / 2 - C[1], (A[2] + B[2]) / 2 - C[2]];
      const u = [B[0] - A[0], B[1] - A[1], B[2] - A[2]], v = [D[0] - A[0], D[1] - A[1], D[2] - A[2]];
      const n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
      if (n[0] * m[0] + n[1] * m[1] + n[2] * m[2] >= 0) { acc.tri(a0, a1, b1); acc.tri(a0, b1, b0); } else { acc.tri(a0, b1, a1); acc.tri(a0, b0, b1); }
    }
  }

  // ---- a tapered n-sided strut between two points (a rod, a cane, a stile, a bracket): merged, capped -----------------------
  function strut(acc: any, a: number[], b: number[], r0: number, r1: number, sides = 8, s0 = 1, s1 = 1, cap = true) {
    const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b), d = B.clone().sub(A).normalize();
    const up = Math.abs(d.y) > 0.95 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0);
    const e1 = new THREE.Vector3().crossVectors(d, up).normalize(), e2 = new THREE.Vector3().crossVectors(d, e1).normalize();
    const r0i: number[] = [], r1i: number[] = [];
    for (let k = 0; k < sides; k++) {
      const ph = (k / sides) * Math.PI * 2, c = Math.cos(ph), s = Math.sin(ph);
      const p0 = A.clone().addScaledVector(e1, c * r0).addScaledVector(e2, s * r0), p1 = B.clone().addScaledVector(e1, c * r1).addScaledVector(e2, s * r1);
      r0i.push(acc.v(p0.x, p0.y, p0.z, s0)); r1i.push(acc.v(p1.x, p1.y, p1.z, s1));
    }
    // wind the side so it faces outward whichever way e1 × e2 came out
    const flip = new THREE.Vector3().crossVectors(e1, e2).dot(d) < 0;
    for (let k = 0; k < sides; k++) {
      const k1 = (k + 1) % sides;
      if (!flip) { acc.tri(r0i[k], r1i[k], r1i[k1]); acc.tri(r0i[k], r1i[k1], r0i[k1]); } else { acc.tri(r0i[k], r1i[k1], r1i[k]); acc.tri(r0i[k], r0i[k1], r1i[k1]); }
    }
    if (cap) {
      const ca = acc.v(A.x, A.y, A.z, s0), cb = acc.v(B.x, B.y, B.z, s1);
      for (let k = 0; k < sides; k++) {
        const k1 = (k + 1) % sides;
        if (!flip) { acc.tri(ca, r0i[k1], r0i[k]); acc.tri(cb, r1i[k], r1i[k1]); } else { acc.tri(ca, r0i[k], r0i[k1]); acc.tri(cb, r1i[k1], r1i[k]); }
      }
    }
  }

  // ---- a plain box with square corners (hardware, brackets): 12 triangles, shared by the face normals through the weld ------
  function slab(acc: any, cx: number, cy: number, cz: number, w: number, h: number, d: number, s = 1) { shell(acc, { cx, cy, cz, w, h, d, r: 0.0005, kx: [-w / 2, w / 2], ky: [-h / 2, h / 2], kz: [-d / 2, d / 2], shade: () => s }); }

  // ---- a hoop of short flat band (a curtain ring seen on a rod): a 10-gon band `width` wide, axis along x -------------------
  function band(acc: any, cx: number, cy: number, cz: number, R: number, width: number, seg = 10, t = 0.004, s = 0.9) {
    const o: number[] = [], i2: number[] = [], o2: number[] = [], i3: number[] = [];
    for (let k = 0; k < seg; k++) {
      const ph = (k / seg) * Math.PI * 2, c = Math.cos(ph), sn = Math.sin(ph);
      o.push(acc.v(cx - width / 2, cy + c * (R + t), cz + sn * (R + t), s)); o2.push(acc.v(cx + width / 2, cy + c * (R + t), cz + sn * (R + t), s));
      i2.push(acc.v(cx - width / 2, cy + c * R, cz + sn * R, s * 0.8)); i3.push(acc.v(cx + width / 2, cy + c * R, cz + sn * R, s * 0.8));
    }
    for (let k = 0; k < seg; k++) {
      const k1 = (k + 1) % seg;
      acc.tri(o[k], o2[k], o2[k1]); acc.tri(o[k], o2[k1], o[k1]);          // outside
      acc.tri(i2[k], i3[k1], i3[k]); acc.tri(i2[k], i2[k1], i3[k1]);        // inside (opposite winding)
    }
  }

  // ---- a closed lens leaf (later waves: plants): a real outline, a V fold, a droop; closed so GTAO sees the true silhouette ---
  function leaf(acc: any, o: any) {
    const { x = 0, y = 0, z = 0, a = 0, t = 0.3, L = 0.2, W = 0.1, droop = 0.6, fold = 0.18, th = 0.006, rows = 5, profile = (u: number) => Math.sin(Math.PI * Math.pow(u, 0.65)), roll = 0, tipS = 1, baseS = SHADE.floor } = o;
    const sa = Math.sin(a), ca = Math.cos(a), S = [ca, 0, -sa];
    let cx = x, cy = y, cz = z;
    const top: number[] = [], bot: number[] = [];
    for (let i = 0; i <= rows; i++) {
      const u = i / rows;
      if (i) { const mid = t + droop * Math.pow(u - 0.5 / rows, 1.15), st = Math.sin(mid), ct = Math.cos(mid); cx += sa * st * L / rows; cy += ct * L / rows; cz += ca * st * L / rows; }
      const ang = t + droop * Math.pow(u, 1.15), st = Math.sin(ang), ct = Math.cos(ang);
      const T = [sa * st, ct, ca * st], N = [T[1] * S[2] - T[2] * S[1], T[2] * S[0] - T[0] * S[2], T[0] * S[1] - T[1] * S[0]];
      const hw = (W / 2) * Math.max(0.0001, profile(u)), lift = fold * hw, s = baseS + (tipS - baseS) * u, rl = roll * hw, e = i === 0 || i === rows;
      const l = acc.v(cx - S[0] * hw + N[0] * (lift + rl), cy - S[1] * hw + N[1] * (lift + rl), cz - S[2] * hw + N[2] * (lift + rl), s * 0.92);
      const r = acc.v(cx + S[0] * hw + N[0] * (lift - rl), cy + S[1] * hw + N[1] * (lift - rl), cz + S[2] * hw + N[2] * (lift - rl), s * 0.92);
      const rt = acc.v(cx + N[0] * th / 2, cy + N[1] * th / 2, cz + N[2] * th / 2, Math.min(1, s * 1.1));
      const rb = e ? rt : acc.v(cx - N[0] * th / 2, cy - N[1] * th / 2, cz - N[2] * th / 2, s * 0.72);
      top.push(l, rt, r); bot.push(l, rb, r);
    }
    acc.grid(top, 2, rows, [0, 1, 0]); acc.grid(bot, 2, rows, [0, -1, 0]);
  }

  // ---- a lathe-turned pot or vase: profile of [r, y, shade], `seg` radial segments (at least 16 in the eye line) --------------
  function lathe(acc: any, prof: number[][], seg = 20, flute = 0, s = 1) {
    const rows: number[][] = [];
    for (const [r, y, sh = 1] of prof) {
      const row: number[] = [];
      for (let k = 0; k < seg; k++) { const ph = (k / seg) * Math.PI * 2, rr = r * (1 + flute * Math.cos(ph * 12)); row.push(acc.v(Math.cos(ph) * rr, y, Math.sin(ph) * rr, sh * s)); }
      rows.push(row);
    }
    for (let j = 0; j < rows.length - 1; j++) for (let k = 0; k < seg; k++) {
      const k1 = (k + 1) % seg;
      acc.tri(rows[j][k], rows[j + 1][k1], rows[j][k1]); acc.tri(rows[j][k], rows[j + 1][k], rows[j + 1][k1]);
    }
    return rows[rows.length - 1];
  }

  /** scale an accumulator's geometry about the vertical axis so no vertex stands more than `over` outside the box [x0,y0,z0,x1,y1,z1] (one-sided clamp) */
  function fitToEnvelope(acc: any, box: number[], over = 0.03) {
    const P = acc.pos;
    let mnx = Infinity, mxx = -Infinity, mnz = Infinity, mxz = -Infinity;
    for (let i = 0; i < P.length; i += 3) { mnx = Math.min(mnx, P[i]); mxx = Math.max(mxx, P[i]); mnz = Math.min(mnz, P[i + 2]); mxz = Math.max(mxz, P[i + 2]); }
    const fx = (v: number, lo: number, hi: number) => (v > hi + over ? (hi + over) / v : v < lo - over ? (lo - over) / v : 1);
    const sx = Math.min(fx(mxx, box[0], box[3]), mnx < 0 ? fx(mnx, box[0], box[3]) : 1), sz = Math.min(fx(mxz, box[2], box[5]), mnz < 0 ? fx(mnz, box[2], box[5]) : 1);
    if (sx < 1 || sz < 1) for (let i = 0; i < P.length; i += 3) { P[i] *= sx; P[i + 2] *= sz; }
    return { sx, sz };
  }

  const out = { Acc, shell, pillow, sheet, strut, slab, band, leaf, lathe, fitToEnvelope };
  kits.set(THREE, out);
  return out;
}

// =================================================================================================================
// The role-material helper: a fresh MeshStandardMaterial per call, the colour a house role, the shade a vertex multiplier
// =================================================================================================================
export const softMat = (ctx: any, color: number, extra: any = {}) => ctx.std(color, { roughness: 0.92, vertexColors: true, ...extra });
/** add `acc` as a mesh when it holds anything; `role` is stamped on the mesh so a later pass (a quilt) can find it without comparing colours */
export function put(g: any, acc: any, mat: any, role?: string, opts: any = {}) {
  if (!acc.tris) return null;
  const m = acc.mesh(mat, opts); if (role) m.userData.role = role;
  g.add(m); return m;
}

// =================================================================================================================
// Bedding — the mattress, duvet, turn-down, throw and pillows of every bed (beds.ts bedding()), 2-3 meshes
// =================================================================================================================
/** The bed's linen, laid on a mattress base that sits at `y` (head at −z, centred at `z`). Same arguments and same return as the
 *  old beds.ts bedding(): the top of the pillows. Meshes: linen (mattress, sleeping pillows, turn-down lining), duvet (with the
 *  roll and the skirt), accent (throw, euro pillows, lumbar) — the last only when the bed has any. ONE ctx.rng draw (the seed of
 *  a private stream), whatever the bed. `quilt: [w, d]` gives the duvet planar UVs (the caller swaps in the pattern material). */
export function layBedding(g: any, ctx: any, o: any) {
  const { THREE, colors, mix } = ctx, K = softkit(THREE), { Acc, shell, pillow } = K;
  const { w, d, y, z = 0, duvet, thick = 0.2, pillowD = 0.4, cover = 0.58, quilt = null } = o;
  const pillows = o.pillows ?? (w > 1.2 ? 2 : 1);
  const r = splitRng(ctx.rng);
  const kid = thick < 0.18;
  const linenA = new K.Acc(), duvetA = new Acc(), altA = new Acc();
  const matTop = y + thick, zh = z - d / 2, zf = z + d / 2;
  const loft = 0.046, drop = Math.min(0.17, thick - 0.025);
  // ---- the mattress and its fitted sheet
  const rM = Math.min(0.05, thick / 2.2);
  shell(linenA, { cy: y + thick / 2, cz: z, w, h: thick, d, r: rM, faces: ['py', 'px', 'nx', 'pz', 'nz'], kx: lin(w / 2, 4), kz: lin(d / 2, 6), ky: [-thick / 2, -thick / 2 + rM, thick / 2 - rM, thick / 2],
    shade: (x: number, yy: number, zz: number, nx: number, ny: number) => SHADE.mattress * (0.93 + 0.07 * smooth(-thick / 2, thick / 2, yy)) * (ny > 0.5 ? 1 : 0.94) });
  // ---- the duvet: puffed channelled top, a skirt hanging over both sides and the foot, folded back at the head
  const bl = d * (cover + r() * 0.05), cl = bl + 0.02, cz = zf - cl / 2 + 0.008, headEdge = zf - cl;
  const W2 = w + 0.02, hh = loft + drop, ph = r() * 6.28, nxk = Math.max(8, Math.round(W2 / 0.15) * 2 - 4);
  const sideK = (nx: number, nz: number) => Math.abs(nx) > 0.4 || nz > 0.4;
  shell(duvetA, {
    cy: matTop + loft - hh / 2, cz, w: W2, h: hh, d: cl, r: 0.05, faces: ['py', 'px', 'nx', 'pz'], puff: 0.018,
    kx: lin(W2 / 2, nxk), kz: lin(cl / 2, 4), ky: [-hh / 2, -hh / 2 + 0.05, hh / 2 - 0.07, hh / 2 - 0.04, hh / 2],
    wave: (x: number, yy: number, zz: number, nx: number, ny: number, nz: number) => {
      const sag = Math.max(0, hh / 2 - 0.06 - yy) / 0.14;
      let dx = 0, dy = 0, dz = 0;
      if (ny > 0.5) dy = 0.008 * Math.cos((x / W2) * Math.PI * 2 * Math.round(W2 / 0.3)) + 0.004 * Math.sin(zz * 11 + ph);
      if (Math.abs(nx) > 0.5) dx = Math.sign(x) * (0.0075 * Math.sin(zz * 14 + ph)) * Math.min(1, sag + 0.2);
      if (nz > 0.5) dz = 0.0075 * Math.sin(x * 14 + ph) * Math.min(1, sag + 0.2);
      return [dx, dy, dz];
    },
    shade: (x: number, yy: number, zz: number, nx: number, ny: number, nz: number) => {
      const fold = sideK(nx, nz) ? 0.9 + 0.1 * Math.sin((Math.abs(nx) > 0.4 ? zz : x) * 14 + ph + 1.4) : 1;
      return (0.8 + 0.2 * smooth(-hh / 2, hh / 2 - 0.05, yy)) * (ny > 0.5 ? 0.94 + 0.06 * (0.5 + 0.5 * Math.cos((x / W2) * Math.PI * 2 * Math.round(W2 / 0.3))) : fold);
    },
  });
  // the fold-back: a roll of duvet at the fold line and the linen lining lying toward the head
  const flap = Math.min(0.24, bl * 0.28);
  shell(duvetA, { cy: matTop + loft + 0.016, cz: headEdge + flap + 0.02, w: W2 - 0.004, h: 0.07, d: 0.075, r: 0.033, faces: ['py', 'px', 'nx', 'pz', 'nz'], kx: lin(W2 / 2, 6), ky: [-0.035, 0, 0.035], kz: [-0.0375, 0, 0.0375] });
  shell(linenA, { cy: matTop + loft + 0.012, cz: headEdge + flap / 2, w: W2 - 0.04, h: 0.026, d: flap + 0.01, r: 0.012, faces: ['py', 'px', 'nx', 'nz'], kx: lin((W2 - 0.04) / 2, 4), kz: [-(flap + 0.01) / 2, (flap + 0.01) / 2] });
  // ---- a throw across the foot (not on a kid's bed)
  const throwOn = r() < 0.6 && !kid, altCol = duvet === colors.accent ? colors.fabric2 : colors.accent;
  const tph = r() * 6.28;
  if (throwOn) {
    const tw = W2 + 0.02, td = 0.36, th2 = 0.26;
    shell(altA, {
      cy: matTop + loft + 0.012 - th2 / 2 + 0.01, cz: zf - 0.18 - 0.02, w: tw, h: th2, d: td, r: 0.016, faces: ['py', 'px', 'nx'], puff: 0.012,
      kx: lin(tw / 2, 8), kz: lin(td / 2, 2), ky: [-th2 / 2, -th2 / 2 + 0.05, th2 / 2 - 0.025, th2 / 2],
      wave: (x: number, yy: number, zz: number, nx: number, ny: number) => (Math.abs(nx) > 0.5 ? [Math.sign(x) * 0.012 * Math.sin(zz * 19 + tph), 0, 0] : [0, 0.007 * Math.sin(x * 9 + tph) + 0.003 * Math.sin(zz * 21 + x * 5), 0]),
      shade: (x: number, yy: number, zz: number, nx: number, ny: number) => (ny > 0.5 ? (1 - 0.1 * (0.5 + 0.5 * Math.sin(x * 9 + tph))) * (Math.abs(zz) > td / 2 - 0.04 ? 0.82 : 1) : 0.82 + 0.12 * smooth(-th2 / 2, th2 / 2, yy)),
    });
  }
  // ---- the pillows: the sleeping pair (or one) of linen, behind them euro shams for a wide bed, a lumbar in front
  const pw = Math.min(0.62, pillows > 1 ? w / 2 - 0.1 : w - 0.2), euro = w > 1.4 && pillows > 1, yawJ = (r() - 0.5) * 0.06;
  const euroJ = [(r() - 0.5) * 0.08, (r() - 0.5) * 0.08], lumJ = [(r() - 0.5) * 0.18, (r() - 0.5) * 0.2];
  const pz = zh + (euro ? 0.4 : 0.31) + (pillowD - 0.4) * 0.2;
  const lean = kid ? 0.2 : 0.3;
  for (let i = 0; i < pillows; i++) {
    const px = pillows > 1 ? (i - (pillows - 1) / 2) * (w / pillows) : 0;
    pillow(linenA, { x: px, y: matTop + 0.035 + (euro ? 0.028 : 0), z: pz, w: pw, d: pillowD, t: kid ? 0.1 : 0.115, rotX: lean, rotY: yawJ * (i % 2 ? -1 : 1), nu: 6, nv: 4, floorY: matTop });
  }
  if (euro) {
    for (const s of [-1, 1]) pillow(altA, { x: s * (w / 4), y: matTop + 0.1, z: zh + 0.2, w: 0.54, d: 0.5, t: 0.13, rotX: 0.5, rotY: s * 0.03 + euroJ[(s + 1) / 2], nu: 6, nv: 4, floorY: matTop });
    pillow(altA, { x: lumJ[0] * 0.4, y: matTop + loft + 0.03, z: pz + pillowD / 2 + 0.2, w: 0.5, d: 0.2, t: 0.075, rotX: 0.32, rotY: lumJ[1], nu: 6, nv: 2, floorY: matTop + loft - 0.01 });
  }
  const uv = quilt ? (x: number, _y: number, zz: number): [number, number] => [(x + W2 / 2) / W2, (zz - (zf - cl)) / cl] : undefined;
  put(g, linenA, softMat(ctx, colors.linen, { roughness: 0.95 }), 'linen');
  put(g, duvetA, softMat(ctx, duvet, { roughness: 0.88 }), 'duvet', { uv });
  put(g, altA, softMat(ctx, altCol, { roughness: 0.93 }), 'throw');
  return matTop + 0.11 + pillowD * 0.22;
}
