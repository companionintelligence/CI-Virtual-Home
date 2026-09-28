// Texture library — seeded procedural PBR sets for the house kit (assets/materials.ts).
//
// Every set is drawn from one seeded stream into three maps of the same size:
//   map          — sRGB albedo
//   normalMap    — tangent space, derived from a height field in metres (central differences, wrapped)
//   roughnessMap — linear, in G (where three reads it)
// and carries its physical period in metres, so worldUV() can map a material in world units: a 0.18 m oak
// board is 0.18 m in a 3 m bath and in a 12 m great room alike, and a shingle course is 143 mm on every roof.
//
// Pixels are computed in typed arrays (no canvas paths, no Math.random, no clock) and uploaded as
// DataTextures, so the same seed gives the same bytes on every run — the frame-hash test depends on it.
// Row 0 of every map is v = 0 (DataTexture, flipY false): pixel functions get (s, t) in metres with t UP the
// texture, which on a roof (worldUV 'slope') is up the slope and on a floor ('plan') is north.
//
// No image files: everything here is generated. Nothing is copied from Pascal's texture set.

type RGB = [number, number, number];
type Px = { r: number; g: number; b: number; h: number; ro: number };
type Gen = { W: number; H: number; period: [number, number]; normalScale?: number; metalness?: number; fn: (u: number, v: number, s: number, t: number, o: Px) => void };

const clamp = (x: number, a = 0, b = 1) => (x < a ? a : x > b ? b : x);
const smooth = (a: number, b: number, x: number) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
export const rgbOf = (c: any): RGB => { const n = typeof c === 'string' ? parseInt(c.replace('#', ''), 16) : (c ?? 0); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
const mixRgb = (a: RGB, b: RGB, t: number): RGB => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const put = (o: Px, c: RGB, k = 1) => { o.r = c[0] * k; o.g = c[1] * k; o.b = c[2] * k; };
const wrapD = (d: number, p: number) => { d = ((d % p) + p) % p; return d > p / 2 ? p - d : d; };   // distance on a circle of length p

// integer hash → [0, 1): per-board / per-tile / per-granule randomness that is a pure function of indices
function hasher(seed: number) {
  return (a: number, b = 0, c = 0) => {
    let h = (seed ^ Math.imul(a | 0, 0x27d4eb2d) ^ Math.imul(b | 0, 0x165667b1) ^ Math.imul(c | 0, 0x9e3779b1)) >>> 0;
    h = Math.imul(h ^ (h >>> 15), 0x85ebca6b); h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35); h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  };
}
// periodic value noise on an nx × ny lattice (wraps, so the texture tiles)
function lattice(rng: () => number, nx: number, ny: number) {
  const a = new Float32Array(nx * ny); for (let i = 0; i < a.length; i++) a[i] = rng() * 2 - 1;
  return (x: number, y: number) => {
    let xi = Math.floor(x), yi = Math.floor(y); const fx = x - xi, fy = y - yi;
    xi %= nx; if (xi < 0) xi += nx; yi %= ny; if (yi < 0) yi += ny;
    const x1 = xi + 1 === nx ? 0 : xi + 1, y1 = yi + 1 === ny ? 0 : yi + 1;
    const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
    const r0 = a[yi * nx + xi] + (a[yi * nx + x1] - a[yi * nx + xi]) * sx, r1 = a[y1 * nx + xi] + (a[y1 * nx + x1] - a[y1 * nx + xi]) * sx;
    return r0 + (r1 - r0) * sy;
  };
}
// fbm over the unit period: (u, v) ∈ [0, 1) → roughly [-0.7, 0.7]; fx, fy are cycles per period at octave 0
function fbm(rng: () => number, fx: number, fy: number, octaves = 4, gain = 0.5) {
  const ls: any[] = [], fs: number[][] = []; let norm = 0;
  for (let k = 0, a = 1; k < octaves; k++, a *= gain) { const nx = fx << k, ny = fy << k; ls.push(lattice(rng, nx, ny)); fs.push([nx, ny, a]); norm += a; }
  return (u: number, v: number) => { let s = 0; for (let k = 0; k < ls.length; k++) s += fs[k][2] * ls[k](u * fs[k][0], v * fs[k][1]); return s / norm; };
}

// ---------------------------------------------------------------------------------------------------------
// Rasterise a generator into albedo / height / roughness, then derive the normal map
// ---------------------------------------------------------------------------------------------------------
function raster(gen: Gen) {
  const { W, H } = gen, [pu, pv] = gen.period;
  const alb = new Uint8Array(W * H * 4), rgh = new Uint8Array(W * H * 4), nrm = new Uint8Array(W * H * 4), hgt = new Float32Array(W * H);
  const o: Px = { r: 0, g: 0, b: 0, h: 0, ro: 0.5 };
  let lumSum = 0, rSum = 0, gSum = 0, bSum = 0;
  for (let y = 0; y < H; y++) {
    const v = (y + 0.5) / H, t = v * pv;
    for (let x = 0; x < W; x++) {
      const u = (x + 0.5) / W; o.h = 0; o.ro = 0.5;
      gen.fn(u, v, u * pu, t, o);
      const i = y * W + x, j = i * 4;
      const r = clamp(Math.round(o.r), 0, 255), g = clamp(Math.round(o.g), 0, 255), b = clamp(Math.round(o.b), 0, 255);
      alb[j] = r; alb[j + 1] = g; alb[j + 2] = b; alb[j + 3] = 255;
      lumSum += (r + g + b) / 765; rSum += r; gSum += g; bSum += b;
      hgt[i] = o.h;
      const ro = clamp(Math.round(o.ro * 255), 0, 255); rgh[j] = ro; rgh[j + 1] = ro; rgh[j + 2] = ro; rgh[j + 3] = 255;
    }
  }
  const du = pu / W, dv = pv / H;
  for (let y = 0; y < H; y++) {
    const ym = (y - 1 + H) % H, yp = (y + 1) % H;
    for (let x = 0; x < W; x++) {
      const xm = (x - 1 + W) % W, xp = (x + 1) % W;
      const dhdu = (hgt[y * W + xp] - hgt[y * W + xm]) / (2 * du), dhdv = (hgt[yp * W + x] - hgt[ym * W + x]) / (2 * dv);
      let nx = -dhdu, ny = -dhdv, nz = 1; const l = Math.hypot(nx, ny, nz); nx /= l; ny /= l; nz /= l;
      const j = (y * W + x) * 4;
      nrm[j] = Math.round((nx * 0.5 + 0.5) * 255); nrm[j + 1] = Math.round((ny * 0.5 + 0.5) * 255); nrm[j + 2] = Math.round((nz * 0.5 + 0.5) * 255); nrm[j + 3] = 255;
    }
  }
  const N = W * H, meanHex = (Math.round(rSum / N) << 16) | (Math.round(gSum / N) << 8) | Math.round(bSum / N);
  return { alb, rgh, nrm, mean: lumSum / N, meanHex };
}

// ---------------------------------------------------------------------------------------------------------
// Generators. Each takes (ctx, opts) and returns { W, H, period, fn }. ctx: rng (seeded stream), hash, fbm.
// ---------------------------------------------------------------------------------------------------------
type Ctx = { rng: () => number; hash: (a: number, b?: number, c?: number) => number; fbm: (fx: number, fy: number, oct?: number, gain?: number) => (u: number, v: number) => number };

// Staggered boards: `across` columns per period, random lengths along t, wrapping. Returns a per-column
// lookup (row → board index, distance to the nearest board end, board start) for fast per-pixel queries.
function boardLayout(ctx: Ctx, across: number, pv: number, H: number, minL: number, maxL: number) {
  const cols = [];
  for (let c = 0; c < across; c++) {
    const t0 = ctx.rng() * pv; const cuts = [t0]; let t = t0;
    for (;;) { const len = minL + ctx.rng() * (maxL - minL); if (t + len > t0 + pv - minL) break; t += len; cuts.push(t); }
    const norm = cuts.map(x => x % pv).sort((a, b) => a - b);
    const id = new Int32Array(H), dEnd = new Float32Array(H), start = new Float32Array(H);
    for (let y = 0; y < H; y++) {
      const tt = (y + 0.5) / H * pv;
      let k = norm.length - 1; for (let i = 0; i < norm.length; i++) if (norm[i] <= tt) k = i;
      const a = norm[k], b = norm[(k + 1) % norm.length];
      id[y] = k; dEnd[y] = Math.min(wrapD(tt - a, pv), wrapD(b - tt, pv)); start[y] = a;
    }
    cols.push({ id, dEnd, start });
  }
  return cols;
}

// wood tone for a board: brightness and a warm/cool shift, both from the board's hash
function woodTone(base: RGB, h1: number, h2: number, spread = 0.13, cast = 0.08): RGB {
  const k = 1 + (h1 - 0.5) * 2 * spread, w = (h2 - 0.5) * cast;
  return [base[0] * k * (1 + w), base[1] * k, base[2] * k * (1 - w * 1.2)];
}

const GEN: Record<string, (c: Ctx, o: any) => Gen> = {
  // ---- floors ------------------------------------------------------------------------------------------
  // fine oak: 0.18 m boards, 0.9–2.2 m long, staggered; eased edges; the odd knot. The figure is what reads as
  // wood from across a room: growth lines that run the board's length and wander (rift boards), or nest into
  // cathedral arches round an off-centre heart (flat-sawn boards, two in five), over a soft long streak.
  // Board-to-board tone is kept narrow, so a floor reads as one floor and not as a barcode of laminate.
  oak: (c, o) => {
    const bw = o.boardW ?? 0.18, across = 8, pu = bw * across, pv = 2.88, W = 512, H = 1024;
    const base = rgbOf(o.color ?? 0xa0927b);
    const cols = boardLayout(c, across, pv, H, 0.9, 2.2);
    const streak = c.fbm(across * 12, 3, 3, 0.55), fine = c.fbm(across * 40, 10, 2, 0.5), blot = c.fbm(across, 2, 2);
    const warp = c.fbm(across * 2, 5, 3, 0.5);
    return {
      W, H, period: [pu, pv], normalScale: 0.9,
      fn: (u, v, s, t, px) => {
        const col = Math.min(across - 1, Math.floor(s / bw)), lx = s - col * bw, row = Math.min(H - 1, Math.floor(v * H));
        const L = cols[col], id = L.id[row], dEnd = L.dEnd[row];
        const h1 = c.hash(col, id, 1), h2 = c.hash(col, id, 2), h3 = c.hash(col, id, 3), h4 = c.hash(col, id, 4);
        const off = h3 * 0.37;
        const st = streak(u, v + off), fn = fine(u + h1 * 0.1, v + off), bl = blot(u, v + off);
        // growth lines: a phase whose integer crossings are the dark latewood lines
        const xb = lx / bw, tb = ((t - L.start[row]) % pv + pv) % pv, w = warp(u + h1 * 0.37, v + off);
        const phase = h4 < 0.4
          ? 14 * (xb - 0.3 - 0.4 * h1) ** 2 - tb / (0.17 + 0.12 * h3) + 1.6 * w + h2 * 7   // cathedral arches
          : xb * (6 + 5 * h2) + 2.4 * w + h3 * 9;                                             // straight, wandering
        const f = phase - Math.floor(phase), dl = Math.min(f, 1 - f);
        const line = 1 - smooth(0.0, 0.34, dl), band = 0.5 + 0.5 * Math.cos(2 * Math.PI * f);   // soft figure, not pencil lines
        const sd = Math.min(lx, bw - lx, dEnd);
        const seam = smooth(0.0006, 0.0042, sd);
        let knot = 0;   // a knot on one board in six
        if (h2 < 0.17) {
          const kx = col * bw + bw * (0.25 + h1 * 0.5), kt = L.start[row] + 0.25 + h3 * 0.5;
          knot = 1 - smooth(0.4, 1.6, Math.hypot((s - kx) / 0.011, wrapD(t - kt, pv) / 0.024));
        }
        const g = (1 + 0.07 * st + 0.04 * fn + 0.04 * bl - 0.38 * knot) * (1 - 0.08 * line - 0.05 * band);
        put(px, woodTone(base, h1, h2, 0.055, 0.035), g * (0.62 + 0.38 * seam));   // one warm cast, no blue-grey boards
        px.h = -0.0007 * (1 - seam) + (h1 - 0.5) * 0.0002 + 0.00005 * st - 0.00006 * line;
        px.ro = 0.44 + 0.06 * st + 0.05 * (h2 - 0.5) + 0.05 * line + 0.26 * (1 - seam);
      }
    };
  },

  // herringbone: 0.08 × 0.48 m blocks on the lattice {i(1,1) + j(n,−n)} (block units), square period 2n
  herringbone: (c, o) => {
    const Wb = 0.08, n = 6, P = 2 * n * Wb, W = 512, H = 512;
    const base = rgbOf(o.color ?? 0x9d8a76);
    const gH = c.fbm(4, 2 * n * 10, 2, 0.5), gV = c.fbm(2 * n * 10, 4, 2, 0.5), fine = c.fbm(64, 64, 2);
    return {
      W, H, period: [P, P], normalScale: 0.9,
      fn: (u, v, s, t, px) => {
        const x = s / Wb, y = t / Wb;
        const si = Math.floor((x + y) / 2), ti = Math.floor((x - y) / (2 * n));
        let type = -1, ci = 0, cj = 0, along = 0, across = 0;
        search: for (let j = ti - 1; j <= ti + 1; j++) for (let i = si - n - 1; i <= si + 1; i++) {
          const qx = x - (i + j * n), qy = y - (i - j * n);
          if (qx >= 0 && qx < n && qy >= 0 && qy < 1) { type = 0; ci = i; cj = j; along = qx; across = qy; break search; }
          if (qx >= n && qx < n + 1 && qy >= 1 - n && qy < 1) { type = 1; ci = i; cj = j; along = qy - (1 - n); across = qx - n; break search; }
        }
        // canonical block id within the period: (i, j) modulo the sublattice {(n, 1), (n, −1)}
        const jm = ((cj % 2) + 2) % 2, im = (((jm ? ci - n : ci) % (2 * n)) + 2 * n) % (2 * n);
        const h1 = c.hash(im, type, 11), h2 = c.hash(im, type, 12), h3 = c.hash(im, type, 13);
        const g = type === 0 ? gH(u, v + h3) : gV(u + h3, v);
        const sd = Math.min(across, 1 - across, along, n - along) * Wb;
        const seam = smooth(0.0005, 0.0035, sd);
        put(px, woodTone(base, h1, h2, 0.08), (1 + 0.1 * g + 0.04 * fine(u, v)) * (0.6 + 0.4 * seam));
        px.h = -0.0007 * (1 - seam) + (h1 - 0.5) * 0.00015;
        px.ro = 0.42 + 0.08 * g + 0.25 * (1 - seam);
      }
    };
  },

  // porcelain / limestone-look tile: 0.6 m, 3 mm grout, eased edges, mottled
  tile: (c, o) => {
    const size = o.size ?? 0.6, n = 2, P = size * n, W = 512, H = 512, gw = o.grout ?? 0.003;
    const base = rgbOf(o.color ?? 0xd5cec3), grout = rgbOf(o.groutColor ?? 0xb3aca1);
    const mott = c.fbm(6, 6, 4), fine = c.fbm(48, 48, 2);
    return {
      W, H, period: [P, P], normalScale: 0.7,
      fn: (u, v, s, t, px) => {
        const i = Math.floor(s / size), j = Math.floor(t / size), lx = s - i * size, ly = t - j * size;
        const ed = Math.min(lx, size - lx, ly, size - ly);
        const tileK = smooth(gw * 0.5 - 0.0006, gw * 0.5 + 0.0006, ed);
        const tone = 1 + (c.hash(i, j, 21) - 0.5) * 0.06, m = mott(u, v), f = fine(u, v);
        const tc = mixRgb(base, [base[0] * 0.93, base[1] * 0.92, base[2] * 0.9], clamp(0.5 + m));
        const k = tone * (1 + 0.035 * f);
        px.r = grout[0] + (tc[0] * k - grout[0]) * tileK; px.g = grout[1] + (tc[1] * k - grout[1]) * tileK; px.b = grout[2] + (tc[2] * k - grout[2]) * tileK;
        px.h = -0.0012 * (1 - smooth(gw * 0.5, gw * 0.5 + 0.0035, ed)) + 0.00003 * m;
        px.ro = 0.3 + 0.05 * m + 0.55 * (1 - tileK);
      }
    };
  },

  // polished marble: 0.75 m tiles, warped veins (the phase jumps at every joint, as separate slabs do)
  marble: (c, o) => {
    const size = 0.75, n = 2, P = size * n, W = 512, H = 512;
    const base = rgbOf(o.color ?? 0xe9e7e2), vein = rgbOf(o.vein ?? 0x7a8088);
    const warp = c.fbm(1, 1, 3, 0.45), warp2 = c.fbm(2, 2, 3, 0.45), cloud = c.fbm(2, 2, 5, 0.55);
    return {
      W, H, period: [P, P], normalScale: 0.4,
      fn: (u, v, s, t, px) => {
        const i = Math.floor(s / size), j = Math.floor(t / size), lx = s - i * size, ly = t - j * size;
        const ed = Math.min(lx, size - lx, ly, size - ly), joint = smooth(0.0006, 0.0018, ed);
        const ph = c.hash(i, j, 31);
        const w = warp(u + ph, v), w2 = warp2(u, v + ph);
        // one main family of soft diagonal veins with a halo, a sparser family of hairlines across it, grey clouds
        const f1 = Math.abs(Math.sin(Math.PI * (u + 2 * v + 0.9 * w + ph)));
        const f2 = Math.abs(Math.sin(Math.PI * (3 * u - v + 1.2 * w2 + ph * 2)));
        const vn = (1 - smooth(0.0, 0.05, f1)) * 0.75 + (1 - smooth(0.0, 0.3, f1)) * 0.18 + (1 - smooth(0.0, 0.018, f2)) * 0.35;
        const cl = cloud(u, v);
        put(px, mixRgb(base, vein, clamp(vn + 0.16 * clamp(cl + 0.2))), (1 + 0.02 * cl) * (0.75 + 0.25 * joint));
        px.h = -0.0008 * (1 - joint);
        px.ro = 0.12 + 0.05 * vn + 0.5 * (1 - joint);
      }
    };
  },

  // concrete: interior polished, or exterior broom-finished with saw-cut joints every `joints` metres
  concrete: (c, o) => {
    const P = o.period ?? 2.4, W = 512, H = 512, ext = !!o.exterior, joints = o.joints ?? 0;
    const base = rgbOf(o.color ?? (ext ? 0xb1aca3 : 0xa9a49c));
    const mott = c.fbm(3, 3, 5, 0.55), mid = c.fbm(16, 16, 3), broom = c.fbm(3, Math.round(P * 90), 2);
    return {
      W, H, period: [P, P], normalScale: ext ? 0.8 : 0.5,
      fn: (u, v, s, t, px) => {
        const m = mott(u, v), md = mid(u, v), br = ext ? broom(u, v) : 0;
        const x = Math.floor(u * W), y = Math.floor(v * H), hh = c.hash(x, y, 41);
        let k = 1 + 0.085 * m + 0.03 * md + 0.035 * br + (hh - 0.5) * 0.05;
        if (hh > 0.988) k += 0.16; else if (hh < 0.008) k -= 0.2;
        let jf = 1;
        if (joints) jf = smooth(0.002, 0.005, Math.min(wrapD(s, joints), wrapD(t, joints)));
        put(px, base, k * (0.7 + 0.3 * jf));
        px.h = 0.0003 * md + 0.00025 * br + (hh - 0.5) * 0.0002 - 0.004 * (1 - jf);
        px.ro = (ext ? 0.82 : 0.4) + 0.08 * m + (ext ? 0.04 * br : 0) + 0.15 * (1 - jf);
      }
    };
  },

  // terrazzo: chips hashed into 3 cm cells (two per cell, checked 3 × 3), ground flush and polished
  terrazzo: (c, o) => {
    const P = 1.2, W = 512, H = 512, cell = 0.03, N = Math.round(P / cell);
    const base = rgbOf(o.color ?? 0xe3dfd7), chips: RGB[] = (o.chips ?? [0x9a9994, 0x5d6062, 0xc6bfb3, 0xb3a38b, 0xf3f1ec, 0x33363a]).map(rgbOf);
    const mott = c.fbm(4, 4, 3), rmin = o.rmin ?? 0.002, rmax = o.rmax ?? 0.0085;
    return {
      W, H, period: [P, P], normalScale: 0.25,
      fn: (u, v, s, t, px) => {
        const ci = Math.floor(s / cell), cj = Math.floor(t / cell);
        let hit = -1;
        for (let dj = -1; dj <= 1 && hit < 0; dj++) for (let di = -1; di <= 1 && hit < 0; di++) {
          const i = ci + di, j = cj + dj, wi = ((i % N) + N) % N, wj = ((j % N) + N) % N;
          for (let k = 0; k < 2; k++) {
            const cx = (i + c.hash(wi, wj, 50 + k)) * cell, cy = (j + c.hash(wi, wj, 60 + k)) * cell;
            const r = rmin + (rmax - rmin) * Math.pow(c.hash(wi, wj, 70 + k), 2.2);
            const dx = s - cx, dy = t - cy; if (dx * dx + dy * dy > r * r * 1.7) continue;
            const a = c.hash(wi, wj, 80 + k) * Math.PI, ca = Math.cos(a), sa = Math.sin(a);
            const rx = dx * ca + dy * sa, ry = (-dx * sa + dy * ca) / (0.55 + 0.4 * c.hash(wi, wj, 90 + k));
            const rr = r * (1 + 0.22 * Math.sin(5 * Math.atan2(ry, rx) + k * 2.1 + c.hash(wi, wj, 95) * 6));
            if (rx * rx + ry * ry < rr * rr) { hit = Math.floor(c.hash(wi, wj, 99 + k) * chips.length); break; }
          }
        }
        const m = mott(u, v);
        if (hit >= 0) { put(px, chips[hit], 1 + 0.02 * m); px.ro = 0.14; px.h = 0.00002; }
        else { put(px, base, 1 + 0.04 * m); px.ro = 0.2 + 0.04 * m; }
      }
    };
  },

  // exterior deck: 0.146 m boards, 6 mm gaps, screws over 0.4 m joists, weathered
  deck: (c, o) => {
    const bw = 0.146, gap = 0.006, across = 8, pu = bw * across, pv = 2.4, W = 512, H = 1056;
    const base = rgbOf(o.color ?? 0x8c7862), dark: RGB = [34, 29, 25];
    const cols = boardLayout(c, across, pv, H, 1.2, 2.4);
    const streak = c.fbm(across * 10, 3, 3, 0.6), fine = c.fbm(across * 30, 8, 2);
    return {
      W, H, period: [pu, pv], normalScale: 1.0,
      fn: (u, v, s, t, px) => {
        const col = Math.min(across - 1, Math.floor(s / bw)), lx = s - col * bw, row = Math.min(H - 1, Math.floor(v * H));
        const L = cols[col], id = L.id[row];
        const h1 = c.hash(col, id, 101), h2 = c.hash(col, id, 102), off = c.hash(col, id, 103) * 0.4;
        const sd = Math.min(lx, bw - lx, L.dEnd[row]);
        const board = smooth(gap * 0.5, gap * 0.5 + 0.002, sd);
        const st = streak(u, v + off), fn = fine(u, v + off);
        const sx = Math.min(Math.abs(lx - 0.022), Math.abs(bw - 0.022 - lx));
        const screw = 1 - smooth(0.0018, 0.0034, Math.hypot(sx, wrapD(t, 0.4)));
        const tone = woodTone(base, h1, h2, 0.14);
        const k = (1 + 0.14 * st + 0.06 * fn) * (1 - 0.45 * screw);
        px.r = dark[0] + (tone[0] * k - dark[0]) * board; px.g = dark[1] + (tone[1] * k - dark[1]) * board; px.b = dark[2] + (tone[2] * k - dark[2]) * board;
        px.h = -0.02 * (1 - board) + 0.0002 * st + (h1 - 0.5) * 0.0006;
        px.ro = 0.72 + 0.1 * st + 0.2 * (1 - board);
      }
    };
  },

  // ---- roofs (coloured by the roof colour) -------------------------------------------------------------
  // architectural asphalt shingles: 143 mm courses of random-width laminated tabs, keyways, butt shadow
  'asphalt-shingle': (c, o) => {
    const expo = 0.143, courses = 8, pu = 1.6, pv = expo * courses, W = 512, H = Math.round(512 * pv / pu);
    const base = rgbOf(o.color ?? 0x2e2d2b);
    const tabs = [];
    for (let k = 0; k < courses; k++) {
      const t0 = c.rng() * pu, cuts = [t0]; let x = t0;
      for (;;) { const w = 0.14 + c.rng() * 0.22; if (x + w > t0 + pu - 0.14) break; x += w; cuts.push(x); }
      tabs.push(cuts.map(q => q % pu).sort((a, b) => a - b));
    }
    const mott = c.fbm(4, 3, 3);
    return {
      W, H, period: [pu, pv], normalScale: 1.0,
      fn: (u, v, s, t, px) => {
        const k = Math.min(courses - 1, Math.floor(t / expo)), ly = t - k * expo, cuts = tabs[k];
        let ti = cuts.length - 1; for (let i = 0; i < cuts.length; i++) if (cuts[i] <= s) ti = i;
        const gapD = Math.min(wrapD(s - cuts[ti], pu), wrapD(cuts[(ti + 1) % cuts.length] - s, pu));
        const h1 = c.hash(k, ti, 201), h2 = c.hash(k, ti, 202);
        const lower = ly < expo * (0.3 + 0.4 * h2) ? 1 : 0;   // the laminated lower layer ("dragon tooth")
        const g = c.hash(Math.floor(u * W), Math.floor(v * H), 203);
        let kk = (0.9 + 0.18 * h1) * (lower ? 0.88 : 1) * (1 + (g - 0.5) * 0.16) * (1 + 0.05 * mott(u, v));   // tab tone ±9 %, not a checkerboard
        if (g > 0.975) kk *= 1.18;
        const key = 1 - smooth(0.0025, 0.0055, gapD);
        const butt = smooth(expo - 0.016, expo - 0.001, ly);
        kk *= (1 - 0.55 * key) * (1 - 0.42 * butt);
        put(px, base, kk);
        px.h = 0.006 * (1 - ly / expo) + 0.0015 * lower - 0.003 * key + (g - 0.5) * 0.0004;
        px.ro = 0.86 + 0.08 * (g - 0.5) + 0.06 * key;
      }
    };
  },

  // standing-seam metal: 0.45 m pans, 25 mm seams, two stiffening ribs per pan, faint run-off streaks
  'standing-seam': (c, o) => {
    const pan = 0.45, pu = pan * 2, pv = 2.0, W = 256, H = 568;
    const base = rgbOf(o.color ?? 0x3a3d40), streak = c.fbm(24, 2, 3, 0.6);
    return {
      W, H, period: [pu, pv], normalScale: 1.0, metalness: 0.35,
      fn: (u, v, s, t, px) => {
        const d = wrapD(s, pan), lx = ((s % pan) + pan) % pan;
        const seam = 1 - smooth(0.004, 0.013, d);
        const rib = Math.max(1 - smooth(0.0, 0.009, Math.abs(lx - pan / 3)), 1 - smooth(0.0, 0.009, Math.abs(lx - 2 * pan / 3)));
        const st = streak(u, v);
        put(px, base, (1 + 0.045 * st) * (1 + 0.08 * seam));
        px.h = 0.025 * seam + 0.0015 * rib;
        px.ro = 0.4 + 0.08 * st - 0.05 * seam;
      }
    };
  },

  // clay barrel tile: 0.22 m tiles in 0.3 m courses, per-tile firing variation, dark valleys
  'clay-tile': (c, o) => {
    const tw = 0.22, course = 0.3, pu = tw * 4, pv = course * 4, W = 512, H = Math.round(512 * pv / pu);
    const base = rgbOf(o.color ?? 0xa8634a), mott = c.fbm(6, 6, 3);
    return {
      W, H, period: [pu, pv], normalScale: 1.0,
      fn: (u, v, s, t, px) => {
        const col = Math.floor(s / tw), lx = s - col * tw, k = Math.min(3, Math.floor(t / course)), ly = t - k * course;
        const p = Math.sin(Math.PI * lx / tw);             // 0 in the valleys, 1 on the crown
        const h1 = c.hash(col, k, 301), h2 = c.hash(col, k, 302);
        let kk = 0.93 + 0.13 * h1; if (h2 < 0.1) kk *= 0.88;
        const butt = smooth(course - 0.035, course - 0.002, ly);
        kk *= (0.5 + 0.5 * Math.sqrt(p)) * (1 - 0.45 * butt) * (1 + 0.06 * mott(u, v));
        put(px, [base[0] * (1 + (h2 - 0.5) * 0.05), base[1], base[2] * (1 - (h2 - 0.5) * 0.06)], kk);
        px.h = 0.05 * p + 0.012 * (1 - ly / course);
        px.ro = 0.72 + 0.08 * (h1 - 0.5);
      }
    };
  },

  // single-ply membrane on flat roofs: 2 m sheets with welded laps, mottled, faint ponding stains
  membrane: (c, o) => {
    const P = 4, W = 512, H = 512, base = rgbOf(o.color ?? 0x7c8084);
    const mott = c.fbm(4, 4, 4), stain = c.fbm(2, 2, 3), fine = c.fbm(64, 64, 2);
    return {
      W, H, period: [P, P], normalScale: 0.8,
      fn: (u, v, s, t, px) => {
        const lap = 1 - smooth(0.012, 0.028, wrapD(s, 2)), cross = 1 - smooth(0.012, 0.028, wrapD(t + 1.3, 4));
        const sm = Math.max(lap, cross), m = mott(u, v), st = stain(u, v);
        put(px, base, (1 + 0.04 * m + 0.02 * fine(u, v) - 0.06 * clamp(st * 2)) * (1 + 0.05 * sm));
        px.h = 0.002 * sm + 0.0002 * m;
        px.ro = 0.78 + 0.06 * m - 0.1 * sm;
      }
    };
  },

  // ---- site surfaces -----------------------------------------------------------------------------------
  asphalt: (c, o) => {
    const P = 4, W = 512, H = 512, base = rgbOf(o.color ?? 0x36383b);
    const patch = c.fbm(3, 3, 4, 0.55), mid = c.fbm(24, 24, 2);
    return {
      W, H, period: [P, P], normalScale: 1.0,
      fn: (u, v, s, t, px) => {
        const x = Math.floor(u * W), y = Math.floor(v * H), g = c.hash(x, y, 401), g2 = c.hash(x, y, 402);
        let k = 1 + 0.08 * patch(u, v) + 0.04 * mid(u, v) + (g - 0.5) * 0.22;
        if (g2 > 0.965) k *= 1.45; else if (g2 < 0.03) k *= 0.7;
        put(px, base, k);
        px.h = (g - 0.5) * 0.0012 + (g2 > 0.965 ? 0.0008 : 0);
        px.ro = 0.88 + (g - 0.5) * 0.08;
      }
    };
  },

  lawn: (c, o) => {
    const P = 6, W = 512, H = 512;
    const base = rgbOf(o.color ?? 0x4e6a3a), dry = rgbOf(o.dry ?? 0x6a7048), deep = rgbOf(o.deep ?? 0x38502e);   // Pascal's lawns: muted green-grey — deep at dusk from the light, not the paint (0x384a2c read as dusk in daylight)
    const clump = c.fbm(14, 14, 3, 0.6), patch = c.fbm(2, 2, 4, 0.55);
    return {
      W, H, period: [P, P], normalScale: 0.7,
      fn: (u, v, s, t, px) => {
        const x = Math.floor(u * W), y = Math.floor(v * H), g = c.hash(x, y, 501), g2 = c.hash(x >> 1, y, 502);
        const cl = clump(u, v), pa = patch(u, v);
        let col = mixRgb(base, dry, 0.2 * clamp(pa * 1.6 - 0.1));
        col = mixRgb(col, deep, 0.6 * clamp(-pa * 1.4 + 0.1 * cl));
        put(px, col, 1 + 0.1 * cl + (g - 0.5) * 0.26 + (g2 - 0.5) * 0.12);
        px.h = (g - 0.5) * 0.004 + 0.002 * cl;
        px.ro = 0.93 + (g - 0.5) * 0.06;
      }
    };
  },

  sand: (c, o) => {
    const P = 6, W = 512, H = 512, base = rgbOf(o.color ?? 0xc5ae88);
    const dune = c.fbm(3, 3, 4), rip = c.fbm(2, 40, 2);
    return {
      W, H, period: [P, P], normalScale: 0.8,
      fn: (u, v, s, t, px) => {
        const g = c.hash(Math.floor(u * W), Math.floor(v * H), 601);
        const d = dune(u, v), r = rip(u + 0.3 * d, v);
        put(px, base, 1 + 0.07 * d + 0.03 * r + (g - 0.5) * 0.1);
        px.h = 0.004 * r + (g - 0.5) * 0.0008; px.ro = 0.95;
      }
    };
  },

  // still water: a normal map only (the kit's water material is flat-coloured and glossy): a long low swell
  // and a finer cat's-paw ripple, so reflections of the sky and the lamps break up without any per-frame motion
  water: (c, o) => {
    const P = 3, W = 256, H = 256, swell = c.fbm(2, 3, 3, 0.5), ripple = c.fbm(9, 7, 3, 0.55);
    return {
      W, H, period: [P, P], normalScale: 0.6,
      fn: (u, v, s, t, px) => { put(px, [128, 128, 128]); px.h = 0.006 * swell(u, v) + 0.0016 * ripple(u, v); px.ro = 0.04; }
    };
  },

  // forest floor: leaf litter over moss
  litter: (c, o) => {
    const P = 5, W = 512, H = 512, moss = rgbOf(o.color ?? 0x3b4a2c), leaf = rgbOf(0x5a4a33), dark = rgbOf(0x2a2a1f);
    const patch = c.fbm(3, 3, 4), clump = c.fbm(20, 20, 2);
    return {
      W, H, period: [P, P], normalScale: 0.8,
      fn: (u, v, s, t, px) => {
        const x = Math.floor(u * W), y = Math.floor(v * H), g = c.hash(x >> 1, y >> 1, 701), g2 = c.hash(x, y, 702);
        const pa = patch(u, v), cl = clump(u, v);
        let col = mixRgb(moss, leaf, clamp(0.45 + pa * 0.45 + (g - 0.5) * 0.5));
        col = mixRgb(col, dark, 0.3 * clamp(-cl * 1.2));
        put(px, col, 1 + (g2 - 0.5) * 0.2);
        px.h = (g - 0.5) * 0.004; px.ro = 0.95;
      }
    };
  },

  // ---- cladding (tinted by the wall colour; periods match the old canvases) ---------------------------
  brick: (c, o) => {
    const pu = 2.0, pv = 1.0, W = 512, H = 256, wall = rgbOf(o.color), mortar = mixRgb(wall, [214, 211, 209], 0.5);
    const m = 0.01, mott = c.fbm(8, 4, 3);
    const rows = Math.round(pv / (0.065 + m)), rowH = pv / rows, cols = Math.round(pu / (0.215 + m)), colW = pu / cols;
    return {
      W, H, period: [pu, pv], normalScale: 1.0,
      fn: (u, v, s, t, px) => {
        const r = Math.min(rows - 1, Math.floor(t / rowH)), off = (r % 2) * colW / 2;
        const ss = ((s + off) % pu + pu) % pu, ci = Math.floor(ss / colW);
        const lx = ss - ci * colW, ly = t - r * rowH;
        const brick = smooth(-0.0005, 0.0015, Math.min(lx, colW - m - lx, ly, rowH - m - ly));
        const j = (c.hash(ci, r, 801) - 0.5) * 0.24, mm = mott(u, v);
        const bc = mixRgb(wall, j > 0 ? [255, 255, 255] : [0, 0, 0], Math.abs(j));
        put(px, mixRgb(mortar, bc, brick), 1 + 0.05 * mm);
        px.h = -0.006 * (1 - brick) + 0.0004 * mm; px.ro = 0.86 + 0.08 * (1 - brick);
      }
    };
  },
  siding: (c, o) => {
    const pu = 2.0, pv = 1.2, W = 512, H = 308, wall = rgbOf(o.color), bh = 0.2, grain = c.fbm(12, 30, 2);
    return {
      W, H, period: [pu, pv], normalScale: 1.0,
      fn: (u, v, s, t, px) => {
        const k = Math.floor(t / bh), ly = t - k * bh;          // ly 0 = the lap's bottom (drip) edge
        const j = (c.hash(k, 0, 811) - 0.5) * 0.06;
        const shadow = smooth(bh - 0.022, bh - 0.002, ly);     // under the next lap
        put(px, wall, (1 + j + 0.015 * grain(u, v)) * (1 - 0.3 * shadow));
        px.h = 0.012 * (1 - ly / bh); px.ro = 0.62;
      }
    };
  },
  stucco: (c, o) => {
    const P = 2.0, W = 512, H = 512, wall = rgbOf(o.color), mott = c.fbm(6, 6, 4), fine = c.fbm(96, 96, 2);
    return {
      W, H, period: [P, P], normalScale: 0.9,
      fn: (u, v, s, t, px) => {
        const g = c.hash(Math.floor(u * W), Math.floor(v * H), 821), f = fine(u, v), m = mott(u, v);
        put(px, wall, 1 + 0.025 * m + 0.02 * f + (g - 0.5) * 0.03);
        px.h = 0.0008 * f + (g - 0.5) * 0.0004; px.ro = 0.9;
      }
    };
  },
  stone: (c, o) => {
    const pu = 2.4, pv = 1.2, W = 512, H = 256, wall = rgbOf(o.color), mortar = mixRgb(wall, [196, 190, 182], 0.5);
    const rowH = 0.3, rows = Math.round(pv / rowH), m = 0.012, mott = c.fbm(12, 6, 3);
    const rowsCuts = [];
    for (let r = 0; r < rows; r++) { const t0 = c.rng() * pu, cuts = [t0]; let x = t0; for (;;) { const w = 0.35 + c.rng() * 0.5; if (x + w > t0 + pu - 0.3) break; x += w; cuts.push(x); } rowsCuts.push(cuts.map(q => q % pu).sort((a, b) => a - b)); }
    return {
      W, H, period: [pu, pv], normalScale: 1.2,
      fn: (u, v, s, t, px) => {
        const r = Math.min(rows - 1, Math.floor(t / rowH)), ly = t - r * rowH, cuts = rowsCuts[r];
        let i = cuts.length - 1; for (let q = 0; q < cuts.length; q++) if (cuts[q] <= s) i = q;
        const ex = Math.min(wrapD(s - cuts[i], pu), wrapD(cuts[(i + 1) % cuts.length] - s, pu));
        const ed = Math.min(ex, ly, rowH - ly) - m / 2, st = smooth(-0.001, 0.004, ed);
        const j = (c.hash(i, r, 831) - 0.5) * 0.34, mm = mott(u, v), warm = (c.hash(i, r, 832) - 0.5) * 0.08;
        const sc = mixRgb(wall, j > 0 ? [255, 255, 255] : [0, 0, 0], Math.abs(j));
        put(px, mixRgb(mortar, [sc[0] * (1 + warm), sc[1], sc[2] * (1 - warm)], st), 1 + 0.14 * mm * st);
        px.h = -0.012 * (1 - st) + 0.003 * mm * st + 0.004 * smooth(0, 0.03, ed); px.ro = 0.9;
      }
    };
  },
  timber: (c, o) => {   // o.pow2: a 512 × 512 map (kit.finish's timber wall; the cladding keeps its own size)
    const pu = 1.8, pv = 2.0, W = 512, H = o.pow2 ? 512 : 568, wall = rgbOf(o.color), bw = 0.15, grain = c.fbm(12 * 12, 3, 3, 0.55);
    return {
      W, H, period: [pu, pv], normalScale: 1.0,
      fn: (u, v, s, t, px) => {
        const b = Math.floor(s / bw), lx = s - b * bw, seam = smooth(0.001, 0.005, Math.min(lx, bw - lx));
        const j = (c.hash(b, 0, 841) - 0.5) * 0.14;
        put(px, wall, (1 + j + 0.07 * grain(u, v + c.hash(b, 0, 842))) * (0.6 + 0.4 * seam));
        px.h = -0.004 * (1 - seam); px.ro = 0.78;
      }
    };
  },
  corrugated: (c, o) => {
    const pu = 1.064, pv = 2.0, W = 512, H = 962, wall = rgbOf(o.color), pitch = 0.076, streak = c.fbm(14, 2, 3);
    return {
      W, H, period: [pu, pv], normalScale: 1.0, metalness: 0.35,
      fn: (u, v, s, t, px) => {
        put(px, wall, 1 + 0.04 * streak(u, v));
        px.h = 0.009 * Math.sin(2 * Math.PI * s / pitch); px.ro = 0.42;
      }
    };
  },

  // ---- room finishes (kit.finish, plan S1: S2's per-room floors and walls). Power-of-two maps throughout. -----
  // hexagonal tile, flat-topped, `size` across the flats (default 0.2 m): two offset lattices, the nearer centre
  // owns the pixel, and the distance to that hexagon's edge draws the grout
  hextile: (c, o) => {
    const flat = o.size ?? 0.2, a = flat / Math.sqrt(3), cu = 3 * a, cv = Math.sqrt(3) * a, pu = 2 * cu, pv = 2 * cv, W = 512, H = 512, gw = o.grout ?? 0.003;
    const base = rgbOf(o.color ?? 0xe7e3dc), grout = rgbOf(o.groutColor ?? 0xb9b3a8), mott = c.fbm(4, 4, 3), rin = cv / 2;
    const N = [[0, 1], [Math.sqrt(3) / 2, 0.5], [-Math.sqrt(3) / 2, 0.5]];
    return {
      W, H, period: [pu, pv], normalScale: 0.7,
      fn: (u, v, s, t, px) => {
        let best = 1e9, bi = 0, bj = 0, bl = 0, dx = 0, dy = 0;
        for (let l = 0; l < 2; l++) for (let i = -1; i <= 2; i++) for (let j = -1; j <= 2; j++) {
          const cx = i * cu + (l ? 1.5 * a : 0), cy = j * cv + (l ? cv / 2 : 0), ex = s - cx, ey = t - cy, d = ex * ex + ey * ey;
          if (d < best) { best = d; bi = i; bj = j; bl = l; dx = ex; dy = ey; }
        }
        const hd = Math.max(...N.map(n => Math.abs(dx * n[0] + dy * n[1]))), ed = rin - hd;
        const k = smooth(gw * 0.5 - 0.0006, gw * 0.5 + 0.0006, ed);
        const id = (((bi % 2) + 2) % 2) * 2 + (((bj % 2) + 2) % 2);   // eight tiles a period, each its own tone
        const tone = 1 + (c.hash(id, bl, 51) - 0.5) * 0.08 + 0.04 * mott(u, v);
        px.r = grout[0] + (base[0] * tone - grout[0]) * k; px.g = grout[1] + (base[1] * tone - grout[1]) * k; px.b = grout[2] + (base[2] * tone - grout[2]) * k;
        px.h = -0.0012 * (1 - smooth(gw * 0.5, gw * 0.5 + 0.003, ed)); px.ro = 0.28 + 0.55 * (1 - k);
      }
    };
  },
  // checkerboard: `size` squares (default 0.3 m) alternating `color` and `color2`
  checker: (c, o) => {
    const size = o.size ?? 0.3, P = 2 * size, W = 512, H = 512, gw = 0.002;
    const A = rgbOf(o.color ?? 0xece8e1), B = rgbOf(o.color2 ?? 0x2b2c2e), grout = rgbOf(o.groutColor ?? 0x9d978d), mott = c.fbm(6, 6, 3);
    return {
      W, H, period: [P, P], normalScale: 0.5,
      fn: (u, v, s, t, px) => {
        const i = Math.floor(s / size), j = Math.floor(t / size), lx = s - i * size, ly = t - j * size;
        const ed = Math.min(lx, size - lx, ly, size - ly), k = smooth(gw * 0.5 - 0.0005, gw * 0.5 + 0.0005, ed);
        const col = (i + j) % 2 ? B : A, tone = 1 + (c.hash(i, j, 61) - 0.5) * 0.05 + 0.03 * mott(u, v);
        px.r = grout[0] + (col[0] * tone - grout[0]) * k; px.g = grout[1] + (col[1] * tone - grout[1]) * k; px.b = grout[2] + (col[2] * tone - grout[2]) * k;
        px.h = -0.001 * (1 - k); px.ro = 0.25 + 0.5 * (1 - k);
      }
    };
  },
  // terracotta: 0.3 m hand-made clay squares, warm, each tile its own fired tone, 6 mm sandy joints, soft edges
  terracotta: (c, o) => {
    const size = o.size ?? 0.3, n = 4, P = size * n, W = 512, H = 512, gw = 0.006;
    const base = rgbOf(o.color ?? 0xb0694a), grout = rgbOf(o.groutColor ?? 0xc9bba4), mott = c.fbm(8, 8, 4, 0.55), fine = c.fbm(64, 64, 2);
    return {
      W, H, period: [P, P], normalScale: 0.9,
      fn: (u, v, s, t, px) => {
        const i = Math.floor(s / size), j = Math.floor(t / size), lx = s - i * size, ly = t - j * size;
        const wob = 0.0015 * Math.sin(ly * 40 + c.hash(i, j, 71) * 6) + 0.0015 * Math.sin(lx * 37 + c.hash(i, j, 72) * 6);
        const ed = Math.min(lx, size - lx, ly, size - ly) + wob, k = smooth(gw * 0.5 - 0.001, gw * 0.5 + 0.0012, ed);
        const h1 = c.hash(i, j, 73), h2 = c.hash(i, j, 74);
        const tc: RGB = [base[0] * (1 + (h1 - 0.5) * 0.22), base[1] * (1 + (h1 - 0.5) * 0.18 - (h2 - 0.5) * 0.1), base[2] * (1 + (h2 - 0.5) * 0.2)];
        const g = 1 + 0.08 * mott(u, v) + 0.04 * fine(u, v);
        px.r = grout[0] + (tc[0] * g - grout[0]) * k; px.g = grout[1] + (tc[1] * g - grout[1]) * k; px.b = grout[2] + (tc[2] * g - grout[2]) * k;
        px.h = -0.002 * (1 - k) + 0.0003 * mott(u, v); px.ro = 0.72 + 0.1 * (1 - k);
      }
    };
  },
  // stone pavers: ashlar courses 0.4 m deep, lengths 0.4–0.9 m, 8 mm joints, each stone its own tone
  pavers: (c, o) => {
    const pu = 2.0, pv = 1.6, W = 512, H = 512, rowH = 0.4, rows = Math.round(pv / rowH), m = 0.008;
    const base = rgbOf(o.color ?? 0xb9b2a5), joint = rgbOf(o.groutColor ?? 0x8f897e), mott = c.fbm(10, 8, 4);
    const rowsCuts: number[][] = [];
    for (let r = 0; r < rows; r++) { const t0 = c.rng() * pu, cuts = [t0]; let x = t0; for (;;) { const w = 0.4 + c.rng() * 0.5; if (x + w > t0 + pu - 0.35) break; x += w; cuts.push(x); } rowsCuts.push(cuts.map(q => q % pu).sort((a, b) => a - b)); }
    return {
      W, H, period: [pu, pv], normalScale: 1.0,
      fn: (u, v, s, t, px) => {
        const r = Math.min(rows - 1, Math.floor(t / rowH)), ly = t - r * rowH, cuts = rowsCuts[r];
        let i = cuts.length - 1; for (let q = 0; q < cuts.length; q++) if (cuts[q] <= s) i = q;
        const ex = Math.min(wrapD(s - cuts[i], pu), wrapD(cuts[(i + 1) % cuts.length] - s, pu));
        const ed = Math.min(ex, ly, rowH - ly) - m / 2, st = smooth(-0.001, 0.003, ed);
        const tone = 1 + (c.hash(i, r, 81) - 0.5) * 0.18, warm = (c.hash(i, r, 82) - 0.5) * 0.06, mm = mott(u, v);
        const sc: RGB = [base[0] * tone * (1 + warm), base[1] * tone, base[2] * tone * (1 - warm)];
        put(px, mixRgb(joint, sc, st), 1 + 0.08 * mm * st);
        px.h = -0.004 * (1 - st) + 0.0008 * mm * st; px.ro = 0.8 + 0.1 * (1 - st);
      }
    };
  },
  // carpet: a cut-pile field — fine fibre noise over a slow mottle, matte, almost no relief
  carpet: (c, o) => {
    const P = 1.0, W = 512, H = 512, base = rgbOf(o.color ?? 0xb8ae9f), mott = c.fbm(3, 3, 4), fib = c.fbm(96, 96, 2);
    return {
      W, H, period: [P, P], normalScale: 0.35,
      fn: (u, v, s, t, px) => {
        const g = c.hash(Math.floor(u * W), Math.floor(v * H), 91), m = mott(u, v), f = fib(u, v);
        put(px, base, 1 + 0.05 * m + 0.05 * f + (g - 0.5) * 0.06);
        px.h = 0.0006 * f + (g - 0.5) * 0.0003; px.ro = 0.97;
      }
    };
  },
  // flat interior paint: the roller's faint orange-peel and nothing else
  paint: (c, o) => {
    const P = 2.0, W = 256, H = 256, base = rgbOf(o.color ?? 0xefece6), mott = c.fbm(4, 4, 3), fine = c.fbm(64, 64, 2);
    return {
      W, H, period: [P, P], normalScale: 0.25,
      fn: (u, v, s, t, px) => { put(px, base, 1 + 0.012 * mott(u, v) + 0.008 * fine(u, v)); px.h = 0.0002 * fine(u, v); px.ro = 0.88; }
    };
  },
  // painted brick: a running bond under one coat of paint — the bond reads by relief, the colour barely varies
  paintedbrick: (c, o) => {
    const pu = 2.0, pv = 1.0, W = 512, H = 256, wall = rgbOf(o.color ?? 0xeeeae3), m = 0.01, mott = c.fbm(8, 4, 3);
    const rows = Math.round(pv / (0.065 + m)), rowH = pv / rows, cols = Math.round(pu / (0.215 + m)), colW = pu / cols;
    const mortar = mixRgb(wall, [0, 0, 0], 0.08);
    return {
      W, H, period: [pu, pv], normalScale: 1.1,
      fn: (u, v, s, t, px) => {
        const r = Math.min(rows - 1, Math.floor(t / rowH)), off = (r % 2) * colW / 2;
        const ss = ((s + off) % pu + pu) % pu, ci = Math.floor(ss / colW), lx = ss - ci * colW, ly = t - r * rowH;
        const brick = smooth(-0.0005, 0.002, Math.min(lx, colW - m - lx, ly, rowH - m - ly));
        put(px, mixRgb(mortar, wall, brick), 1 + 0.02 * mott(u, v) + (c.hash(ci, r, 95) - 0.5) * 0.02);
        px.h = -0.005 * (1 - brick) + 0.0004 * mott(u, v); px.ro = 0.82;
      }
    };
  },
  // wallpaper: one 0.52 m roll repeat — pattern 'stripe' (two widths), 'dot' (staggered spots) or 'botanical'
  // (seeded sprigs: a stem and four leaves, one sprig a cell) in color2 over color
  wallpaper: (c, o) => {
    const pattern = o.pattern || 'stripe', pu = 0.52, pv = pattern === 'stripe' ? 0.52 : 0.52, W = 512, H = 512;
    const A = rgbOf(o.color ?? 0xeae4d8), base = rgbOf(o.color ?? 0xeae4d8);
    const B = rgbOf(o.color2 ?? (() => { const k = (A[0] + A[1] + A[2]) / 765; return k > 0.6 ? mixRgb(A, [70, 90, 80], 0.45) : mixRgb(A, [255, 255, 255], 0.45); })());
    const paper = c.fbm(32, 32, 2), sprigs: Array<[number, number, number, number]> = [];
    if (pattern === 'botanical') for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) sprigs.push([(i + 0.2 + c.rng() * 0.6) / 4 * pu, (j + 0.2 + c.rng() * 0.6) / 4 * pv, (c.rng() - 0.5) * 1.6, 0.035 + c.rng() * 0.02]);
    const signedWrap = (d: number, p: number) => (((d + p / 2) % p) + p) % p - p / 2;   // nearest image, signed
    const leaf = (s: number, t: number, x: number, y: number, ang: number, L: number, wr = 0.38) => {   // an ellipse along ang
      const dx = signedWrap(s - x, pu), dy = signedWrap(t - y, pv);
      const ca = Math.cos(ang), sa = Math.sin(ang), a = dx * ca + dy * sa, b = -dx * sa + dy * ca;
      return (a / L) ** 2 + (b / (L * wr)) ** 2;
    };
    return {
      W, H, period: [pu, pv], normalScale: 0.2,
      fn: (u, v, s, t, px) => {
        let k = 0;
        if (pattern === 'stripe') { const x = s / pu; k = (x % 0.25) < 0.09 ? 1 : ((x % 0.25) > 0.16 && (x % 0.25) < 0.18 ? 0.6 : 0); }
        else if (pattern === 'dot') {
          const g = 0.065, r = 0.011, row = Math.floor(t / g), off = (row % 2) * g / 2;
          const dx = wrapD(s - off - Math.round((s - off) / g) * g, pu), dy = t - (row + 0.5) * g;
          k = 1 - smooth(r - 0.0012, r + 0.0012, Math.hypot(dx, dy));
        } else {
          for (const [x, y, ang, L] of sprigs) {
            for (let q = 0; q < 4; q++) {
              const a2 = ang + (q % 2 ? 0.7 : -0.7), off = (q < 2 ? 0.3 : 0.75) * L * 1.6;
              const lx = x + Math.sin(ang) * off, ly = y + Math.cos(ang) * off;
              k = Math.max(k, 1 - smooth(0.8, 1.1, leaf(s, t, lx, ly, Math.PI / 2 - a2, L * 0.55)));
            }
            k = Math.max(k, 1 - smooth(0.8, 1.1, leaf(s, t, x + Math.sin(ang) * L * 0.8, y + Math.cos(ang) * L * 0.8, Math.PI / 2 - ang, L * 1.25, 0.045)));   // the stem: a thin ellipse
          }
        }
        const p = 1 + 0.015 * paper(u, v);
        put(px, mixRgb(base, B, k), p);
        px.h = 0.0001 * paper(u, v) + 0.00008 * k; px.ro = 0.8 - 0.1 * k;
      }
    };
  },
  // wainscot: raised panels to `h` (default 0.9 m, a chair rail on top) and paint above, in one colour; the
  // material's world-UV offset puts t = 0 on the storey's floor (kit.finish's yBase), the period is 3.2 m tall
  wainscot: (c, o) => {
    const pu = 0.6, pv = 3.2, W = 256, H = 1024, hh = o.h ?? 0.9, base = rgbOf(o.color ?? 0xf1eee8), fine = c.fbm(16, 64, 2);
    return {
      W, H, period: [pu, pv], normalScale: 1.0,
      fn: (u, v, s, t, px) => {
        let h = 0, k = 1;
        if (t < hh) {
          const ex = Math.min(s - 0.06, pu - 0.06 - s), ey = Math.min(t - 0.18, hh - 0.12 - t), inPanel = Math.min(ex, ey);
          h = inPanel > 0 ? 0.004 + 0.002 * smooth(0, 0.02, inPanel) : 0.006;   // stiles and rails proud, panel fields raised
          if (t < 0.12) { h = 0.012; k = 0.97; }   // the skirting
          k *= inPanel > -0.004 && inPanel < 0.004 ? 0.9 : 1;   // the field's bevel shadow
        } else if (t < hh + 0.05) { h = 0.014; k = 0.98; }   // the chair rail
        put(px, base, k * (1 + 0.006 * fine(u, v)));
        px.h = h; px.ro = t < hh + 0.05 ? 0.55 : 0.88;
      }
    };
  },
  // board and batten: 0.3 m vertical boards with 50 mm battens over the joints
  battens: (c, o) => {
    const bw = 0.3, pu = 1.2, pv = 2.4, W = 512, H = 1024, wall = rgbOf(o.color ?? 0xece8df), grain = c.fbm(8, 24, 2);
    return {
      W, H, period: [pu, pv], normalScale: 1.1,
      fn: (u, v, s, t, px) => {
        const b = Math.floor(s / bw), lx = s - b * bw, d = Math.min(lx, bw - lx), batten = 1 - smooth(0.022, 0.027, d);
        put(px, wall, (1 + 0.012 * grain(u, v)) * (1 - 0.1 * (1 - smooth(0.02, 0.034, d)) * (1 - batten)));
        px.h = 0.012 * batten; px.ro = 0.7;
      }
    };
  },
};

export const TEXTURE_KINDS = Object.keys(GEN);

// ---------------------------------------------------------------------------------------------------------
// Library: set(kind, opts) → { map, normalMap, roughnessMap, period, normalScale, metalness, mean }, cached
// per (kind, opts). `rngFor(key)` is the kit's seeded stream factory (mulberry32 ∘ fnv1a over the house id).
// ---------------------------------------------------------------------------------------------------------
export function createTextureLibrary({ THREE, rngFor }: { THREE: any; rngFor: (key: string) => () => number }) {
  const cache = new Map();
  const tex = (data: Uint8Array, W: number, H: number, srgb: boolean) => {
    const t = new THREE.DataTexture(data, W, H, THREE.RGBAFormat, THREE.UnsignedByteType);
    t.wrapS = t.wrapT = THREE.RepeatWrapping; t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearMipmapLinearFilter;
    t.generateMipmaps = true; t.anisotropy = 8; t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace; t.needsUpdate = true;
    return t;
  };
  function set(kind: string, opts: any = {}) {
    if (!GEN[kind]) return null;
    const key = kind + ':' + JSON.stringify(opts);
    if (cache.has(key)) return cache.get(key);
    const rng = rngFor('tex:' + key);
    const ctx: Ctx = { rng, hash: hasher(Math.floor(rng() * 4294967296) >>> 0), fbm: (fx, fy, oct, gain) => fbm(rng, fx, fy, oct, gain) };
    const gen = GEN[kind](ctx, opts);
    const { alb, rgh, nrm, mean, meanHex } = raster(gen);
    const out = {
      kind, period: gen.period, normalScale: gen.normalScale ?? 1, metalness: gen.metalness ?? 0, mean, meanHex,
      map: tex(alb, gen.W, gen.H, true), normalMap: tex(nrm, gen.W, gen.H, false), roughnessMap: tex(rgh, gen.W, gen.H, false)
    };
    for (const k of ['map', 'normalMap', 'roughnessMap']) { out[k].name = `${kind}.${k}`; out[k].userData.period = gen.period; }
    cache.set(key, out);
    return out;
  }
  return { set };
}

// ---------------------------------------------------------------------------------------------------------
// worldUV: map a material's map / normalMap / roughnessMap in world metres, divided by the set's period.
//   'plan'  — world XZ from above (north up), for floors and ground
//   'auto'  — by dominant world normal: tops take XZ, walls take their own face plane (never mirrored)
//   'slope' — along the eave (T = up × N) and up the slope (B = N × T): shingle courses run level on every
//             roof plane, gable or hip; flat faces fall back to XZ
// UVs are computed per vertex from the world position and face normal, so they are exact on flat faces;
// normal mapping uses three's derivative tangent frame, which follows these UVs. `macro` modulates the albedo
// with a second, 7.3× larger lookup of the same map to break visible tiling on big surfaces (lawn, road).
// ---------------------------------------------------------------------------------------------------------
const WUV_VERT_DECL = `
uniform vec2 uWuvPeriod; uniform vec2 uWuvRot; uniform vec2 uWuvOffset;
#ifdef WUV_MACRO
varying vec2 vWuvMacro;
#endif
`;
const WUV_VERT = `
{
  vec4 wuvW = vec4( transformed, 1.0 );
  #ifdef USE_INSTANCING
    wuvW = instanceMatrix * wuvW;
  #endif
  wuvW = modelMatrix * wuvW;
  vec3 wuvN = normalize( mat3( modelMatrix ) * objectNormal );
  vec2 wuv;
  #if WUV_MODE == 1
    if ( abs( wuvN.y ) > 0.999 ) wuv = vec2( wuvW.x, - wuvW.z );
    else { vec3 wT = normalize( cross( vec3( 0.0, 1.0, 0.0 ), wuvN ) ); vec3 wB = cross( wuvN, wT ); wuv = vec2( dot( wuvW.xyz, wT ), dot( wuvW.xyz, wB ) ); }
  #elif WUV_MODE == 2
    wuv = vec2( wuvW.x, - wuvW.z );
  #else
    wuv = abs( wuvN.y ) > 0.5 ? vec2( wuvW.x, - wuvW.z ) : ( abs( wuvN.x ) > 0.5 ? vec2( - wuvW.z * sign( wuvN.x ), wuvW.y ) : vec2( wuvW.x * sign( wuvN.z ), wuvW.y ) );
  #endif
  wuv = vec2( uWuvRot.x * wuv.x - uWuvRot.y * wuv.y, uWuvRot.y * wuv.x + uWuvRot.x * wuv.y ) + uWuvOffset;
  wuv /= uWuvPeriod;
  #ifdef USE_MAP
    vMapUv = wuv;
  #endif
  #ifdef USE_NORMALMAP
    vNormalMapUv = wuv;
  #endif
  #ifdef USE_ROUGHNESSMAP
    vRoughnessMapUv = wuv;
  #endif
  #ifdef USE_METALNESSMAP
    vMetalnessMapUv = wuv;
  #endif
  #ifdef WUV_MACRO
    vWuvMacro = wuv * 0.137 + vec2( 0.371, 0.713 );
  #endif
}
`;
const WUV_FRAG_DECL = `
#ifdef WUV_MACRO
varying vec2 vWuvMacro; uniform float uWuvMacro; uniform float uWuvMacroMean;
#endif
`;
const WUV_FRAG = `
#if defined( WUV_MACRO ) && defined( USE_MAP )
  {
    float wuvM = dot( texture2D( map, vWuvMacro ).rgb, vec3( 0.3333 ) ) / max( uWuvMacroMean, 0.02 );
    diffuseColor.rgb *= mix( 1.0, clamp( wuvM, 0.6, 1.5 ), uWuvMacro );
  }
#endif
`;
// Everything the mapping needs travels inside onBeforeCompile: the mode and macro switches are written into the
// injected source as #defines rather than set on `mat.defines`, and the material's clone() re-applies worldUV.
// A consumer that clones a kit material (the roof builder's own(), a fade, a wall mode) therefore gets a working
// copy. Material.copy() resets a MeshStandardMaterial's defines to { STANDARD }, and a `#if WUV_MODE` left
// without its define is a compile error in GLSL ES 3 (an undefined identifier in #if does not default to 0):
// that is how a cloned kit roof used to vanish.
export function worldUV(THREE: any, mat: any, opts: any = {}) {
  const { period = [1, 1], mode = 'auto', rotation = 0, offset = [0, 0], macro = 0, macroMean = 0.25 } = opts;
  const uniforms = {
    uWuvPeriod: { value: new THREE.Vector2(period[0], period[1]) },
    uWuvRot: { value: new THREE.Vector2(Math.cos(rotation), Math.sin(rotation)) },
    uWuvOffset: { value: new THREE.Vector2(offset[0], offset[1]) },
    uWuvMacro: { value: macro }, uWuvMacroMean: { value: macroMean }
  };
  const modeId = mode === 'slope' ? 1 : mode === 'plan' ? 2 : 0;
  const defs = `#define WUV_MODE ${modeId}\n${macro > 0 ? '#define WUV_MACRO 1\n' : ''}`;
  mat.onBeforeCompile = shader => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\n' + defs + WUV_VERT_DECL)
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\n' + WUV_VERT);
    if (macro > 0) shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\n' + defs + WUV_FRAG_DECL)
      .replace('#include <map_fragment>', '#include <map_fragment>\n' + WUV_FRAG);
  };
  mat.customProgramCacheKey = () => `wuv${modeId}${macro > 0 ? 'm' : ''}`;
  mat.clone = function () { return worldUV(THREE, new this.constructor().copy(this), opts); };
  mat.userData.worldUV = { period: [...period], mode, rotation };
  return mat;
}
