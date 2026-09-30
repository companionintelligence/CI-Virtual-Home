// Patterns — procedural pictures for the soft furnishings: rug and textile patterns and the wall-art motif library.
// Each is a pure function (u, v) → colour over the unit square, rasterised once into a DataTexture (2 × 2
// supersampled, sRGB, mipmapped) and cached by (kind, name, colours, size), so a house with twelve striped rugs
// holds one texture. No canvas, no Math.random: the same inputs give the same pixels in every browser.
//
//   patternTexture(THREE, name, colours, { w, d })   a rug / textile pattern, tiled once over a w × d piece
//   motifTexture(THREE, name, colours, { w, h })      a painting for wall-art / gallery-wall
//   RUG_PATTERNS, ART_MOTIFS                          the names each accepts (the catalog publishes them)
//
// colours: [base, c1, c2, c3] — the material kit's role colours (or a room palette's), already restrained, so the
// pictures sit in the house's scheme. A textured material is left alone by the kit's theme() (it skips mapped
// materials), so what is painted here is what renders.
//
// Owner: S3 (compose).

export const RUG_PATTERNS = ['solid', 'border', 'stripe', 'check', 'diamond', 'kilim', 'medallion', 'dots', 'abstract', 'play', 'shag', 'jute', 'flatweave', 'hide'] as const;
export const ART_MOTIFS = ['abstract', 'geometric', 'line', 'landscape', 'botanical', 'seascape', 'sunset', 'sunburst', 'map', 'animal', 'story-moon', 'story-whale', 'story-balloon', 'mountains', 'floral', 'arches', 'colourfield', 'skyline', 'lemons'] as const;

type RGB = [number, number, number];
const rgb = (c: number): RGB => [(c >> 16) & 255, (c >> 8) & 255, c & 255];
const lerp = (a: RGB, b: RGB, t: number): RGB => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const shade = (a: RGB, t: number): RGB => (t >= 0 ? lerp(a, [255, 255, 255], t) : lerp(a, [0, 0, 0], -t));
const frac = (x: number) => x - Math.floor(x);
// an integer hash in [0, 1): the weave's grain, the same in every engine
const hash = (x: number, y: number, s = 0) => { let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(s | 0, 2246822519); h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
const inEllipse = (u: number, v: number, cx: number, cy: number, rx: number, ry: number) => ((u - cx) / rx) ** 2 + ((v - cy) / ry) ** 2 <= 1;
const inTri = (u: number, v: number, a: number[], b: number[], c: number[]) => {
  const s = (p: number[], q: number[]) => (u - q[0]) * (p[1] - q[1]) - (p[0] - q[0]) * (v - q[1]);
  const d1 = s(a, b), d2 = s(b, c), d3 = s(c, a);
  return !((d1 < 0 || d2 < 0 || d3 < 0) && (d1 > 0 || d2 > 0 || d3 > 0));
};
const segDist = (u: number, v: number, x0: number, y0: number, x1: number, y1: number) => { const dx = x1 - x0, dy = y1 - y0, l = dx * dx + dy * dy || 1e-9, t = Math.max(0, Math.min(1, ((u - x0) * dx + (v - y0) * dy) / l)); return Math.hypot(u - x0 - dx * t, v - y0 - dy * t); };

// smooth value noise over the integer lattice (the cowhide's patches)
const vnoise = (x: number, y: number, seed = 0) => {
  const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi, sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
  const a = hash(xi, yi, seed), b = hash(xi + 1, yi, seed), c = hash(xi, yi + 1, seed), d = hash(xi + 1, yi + 1, seed);
  return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
};

type Painter = (u: number, v: number, a: number) => RGB;   // a: the piece's aspect (w / d or w / h)

// ---- rugs and textiles: u across the piece's width, v along its length --------------------------------------------
function rugPainter(name: string, [base, c1, c2, c3]: RGB[]): Painter {
  const border = (u: number, v: number, a: number, at = 0.06, band = 0.035) => { const e = Math.min(u * a, (1 - u) * a, v, 1 - v) / Math.max(a, 1); return e > at && e < at + band; };
  switch (name) {
    case 'border': return (u, v, a) => {
      const e = Math.min(u, 1 - u, v, 1 - v);
      return e < 0.05 ? c1 : e < 0.065 ? c2 : e > 0.1 && e < 0.11 ? c1 : base;
    };
    case 'stripe': return (u, v) => {
      const k = Math.floor(v * 14), band = [0, 1, 0, 2, 0, 0, 3, 0, 0, 2, 0, 1, 0, 0][k % 14];
      return band === 1 ? c1 : band === 2 ? c2 : band === 3 ? c3 : base;
    };
    case 'check': return (u, v, a) => {
      const bu = frac(u * a * 5) < 0.45, bv = frac(v * 5) < 0.45;
      return bu && bv ? shade(c1, -0.12) : bu || bv ? lerp(base, c1, 0.55) : base;
    };
    case 'diamond': return (u, v, a) => {   // a trellis of diamonds, lines of c1 on the base
      const x = frac(u * a * 3), y = frac(v * 3), d = Math.abs(x - 0.5) + Math.abs(y - 0.5);
      return Math.abs(d - 0.45) < 0.035 ? c1 : d < 0.12 ? c2 : base;
    };
    case 'kilim': return (u, v, a) => {   // rows of stepped diamonds between bands
      const row = Math.floor(v * 6), y = frac(v * 6), x = frac(u * a * 2.5 + (row % 2) * 0.5);
      if (y < 0.1 || y > 0.9) return c3;
      const step = Math.round((Math.abs(x - 0.5) + Math.abs(y - 0.5)) * 8) / 8;
      return step < 0.2 ? c1 : step < 0.34 ? c2 : row % 2 ? base : shade(base, -0.08);
    };
    case 'medallion': return (u, v, a) => {
      const e = Math.min(u, 1 - u, v, 1 - v);
      if (e < 0.06) return c1; if (e < 0.075) return c2;
      const x = (u - 0.5) * a, y = v - 0.5, r = Math.hypot(x / Math.max(a, 1) * 1.6, y * 1.6);
      if (r < 0.18) return c2; if (r < 0.26) return c1; if (Math.abs(r - 0.32) < 0.015) return c3;
      const cr = Math.min(Math.hypot(u * a, v), Math.hypot((1 - u) * a, v), Math.hypot(u * a, 1 - v), Math.hypot((1 - u) * a, 1 - v));
      return cr < 0.25 ? c1 : base;
    };
    case 'dots': return (u, v, a) => { const x = frac(u * a * 6), y = frac(v * 6 + (Math.floor(u * a * 6) % 2) * 0.5); return Math.hypot(x - 0.5, y - 0.5) < 0.16 ? c1 : base; };
    case 'abstract': return (u, v, a) => {
      const x = u * a;
      if (Math.hypot(x - a * 0.3, v - 0.35) < 0.22) return c1;
      if (Math.abs(Math.hypot(x - a * 0.72, v - 0.7) - 0.2) < 0.03) return c2;
      if (v > 0.8 && x < a * 0.45) return c3;
      return base;
    };
    case 'play': return (u, v, a) => {   // a kid's play rug: a road loop with a dashed centre line, hopscotch squares
      const x = u * a, r = Math.min(x, a - x, v, 1 - v);
      if (r > 0.12 && r < 0.26) return Math.abs(r - 0.19) < 0.012 && frac((x + v) * 6) < 0.5 ? [238, 234, 220] : [92, 96, 102];
      const cx = Math.floor((x - a * 0.35) / 0.14), cy = Math.floor((v - 0.35) / 0.14);
      if (cx >= 0 && cx < 2 && cy >= 0 && cy < 3) return [c1, c2, c3][(cx + cy) % 3];
      return base;
    };
    case 'shag': return (u, v, a) => {   // a deep pile: fine speckle in two tones
      const h = hash(Math.floor(u * a * 48), Math.floor(v * 48), 11);
      return h < 0.18 ? shade(base, -0.14) : h > 0.86 ? shade(base, 0.12) : h > 0.7 ? lerp(base, c1, 0.12) : base;
    };
    case 'jute': return (u, v, a) => {   // a chunky basket weave: blocks of strands, alternately across and along
      const x = u * a * 12, y = v * 12, i = Math.floor(x), j = Math.floor(y), fx = frac(x), fy = frac(y), across = (i + j) % 2 === 0;
      const t = across ? fy : fx, ridge = 1 - Math.abs(t * 4 % 1 - 0.5) * 0.5;   // four strands a block
      const gap = Math.min(fx, fy, 1 - fx, 1 - fy) < 0.04;
      return gap ? shade(base, -0.4) : shade(base, (ridge - 0.85) * 0.5 + (across ? 0.03 : -0.03));
    };
    case 'flatweave': return (u, v, a) => {   // a flat-woven dhurrie: fine warp and weft, a banded border and two centre bands
      const e = Math.min(u * a, (1 - u) * a, v, 1 - v);
      if (e < 0.05) return c1; if (e > 0.06 && e < 0.075) return c2;
      if (Math.abs(v - 0.5) < 0.05 && e > 0.1) return c2; if (Math.abs(v - 0.5) > 0.09 && Math.abs(v - 0.5) < 0.1 && e > 0.1) return c1;
      const warp = frac(u * a * 40) < 0.5 ? 0.03 : -0.03, weft = frac(v * 40) < 0.5 ? 0.02 : -0.02;
      return shade(base, warp + weft);
    };
    case 'hide': return (u, v, a) => {   // a cowhide: cream with big dark patches
      const n = vnoise(u * a * 3.2 + 4, v * 3.2 + 9, 5) * 0.65 + vnoise(u * a * 7, v * 7, 6) * 0.35;
      return n > 0.6 ? shade(c3, -0.62) : n > 0.57 ? shade(c3, -0.3) : shade(base, 0.08);
    };
    default: return () => base;   // solid
  }
}

// ---- paintings: u across, v DOWN from the top ----------------------------------------------------------------------
function artPainter(name: string, [bg, c1, c2, c3]: RGB[]): Painter {
  const sky = (v: number) => lerp(shade(c3, 0.55), shade(c3, 0.25), v);
  switch (name) {
    case 'geometric': return (u, v) => {   // a Bauhaus grid of quarter-circles and halves
      const i = Math.floor(u * 3), j = Math.floor(v * 3), x = frac(u * 3), y = frac(v * 3), k = (i * 7 + j * 3) % 4;
      const cols = [c1, c2, c3, shade(c1, 0.4)];
      const qx = k % 2 ? x : 1 - x, qy = k < 2 ? y : 1 - y;
      if (Math.hypot(qx, qy) < 0.95) return cols[(i + j) % 4];
      return (i + j) % 2 ? bg : shade(bg, -0.06);
    };
    case 'line': return (u, v, a) => {   // one continuous line drawing: a face in profile, ink on paper
      const x = u, y = v;
      const d = Math.min(
        Math.abs(y - (0.25 + 0.5 * x + 0.06 * Math.sin(x * 18))) * 0.8 + (x < 0.2 || x > 0.8 ? 1 : 0),
        segDist(x, y, 0.5, 0.2, 0.42, 0.75), Math.abs(Math.hypot(x - 0.6, y - 0.45) - 0.18));
      return d < 0.012 ? shade(c1, -0.45) : bg;
    };
    case 'landscape': return (u, v) => {
      const h1 = 0.55 + 0.08 * Math.sin(u * 5 + 1), h2 = 0.68 + 0.06 * Math.sin(u * 8 + 3);
      if (v > h2) return shade(c1, -0.15); if (v > h1) return c2;
      if (Math.hypot(u - 0.72, v - 0.3) < 0.09) return shade(c3, -0.1);
      return sky(v);
    };
    case 'botanical': return (u, v) => {   // a stem of paired leaves on cream
      const x = u - 0.5, y = v;
      if (Math.abs(x + 0.03 * Math.sin(y * 6)) < 0.008 && y > 0.12 && y < 0.9) return shade(c2, -0.3);
      for (let k = 0; k < 5; k++) { const ly = 0.2 + k * 0.14, s = k % 2 ? 1 : -1; if (inEllipse(x - s * 0.11, y - ly, 0, 0, 0.11, 0.045)) return k % 2 ? c2 : shade(c2, 0.18); }
      return bg;
    };
    case 'seascape': return (u, v) => {
      if (v > 0.58) return frac(v * 14 + 0.3 * Math.sin(u * 12)) < 0.2 ? shade(c3, 0.3) : c3;
      if (inTri(u, v, [0.52, 0.28], [0.52, 0.55], [0.7, 0.55])) return bg;
      if (v > 0.55 && v < 0.58 && u > 0.45 && u < 0.72) return shade(c1, -0.2);
      return sky(v);
    };
    case 'sunset': return (u, v) => {
      if (Math.hypot(u - 0.5, v - 0.62) < 0.18 && v < 0.62) return shade(c1, 0.25);
      if (v > 0.62) return lerp(c2, shade(c2, -0.3), (v - 0.62) / 0.38);
      return lerp(shade(c1, 0.45), c1, v / 0.62);
    };
    case 'sunburst': return (u, v, a) => {
      const x = (u - 0.5) * a, y = v - 0.5, r = Math.hypot(x, y), t = Math.atan2(y, x);
      if (r < 0.1) return c1;
      return frac(t / (Math.PI * 2) * 16) < 0.5 && r < 0.45 ? shade(c1, 0.2) : bg;
    };
    case 'map': return (u, v) => {
      if (frac(u * 8) < 0.02 || frac(v * 8) < 0.02) return shade(c3, -0.1);
      const land = Math.hypot(u - 0.35, v - 0.45) < 0.22 + 0.04 * Math.sin(u * 20) || Math.hypot(u - 0.75, v - 0.3) < 0.12 + 0.03 * Math.sin(v * 25);
      return land ? shade(c2, 0.3) : shade(c3, 0.45);
    };
    case 'animal': return (u, v) => {   // a bird on a branch
      if (segDist(u, v, 0.08, 0.72, 0.92, 0.62) < 0.015) return shade(c2, -0.35);
      if (inEllipse(u, v, 0.5, 0.52, 0.16, 0.1)) return c1;
      if (Math.hypot(u - 0.63, v - 0.42) < 0.07) return c1;
      if (inTri(u, v, [0.69, 0.41], [0.76, 0.43], [0.69, 0.45])) return shade(c3, -0.1);
      if (inTri(u, v, [0.36, 0.5], [0.2, 0.42], [0.22, 0.56])) return shade(c1, -0.2);
      return bg;
    };
    case 'story-moon': return (u, v) => {   // a nursery night sky: a crescent moon, stars
      const night: RGB = shade(c3, -0.45);
      if (Math.hypot(u - 0.62, v - 0.4) < 0.2 && Math.hypot(u - 0.7, v - 0.34) > 0.17) return [245, 226, 170];
      for (let k = 0; k < 9; k++) { const sx = hash(k, 1, 7), sy = hash(k, 2, 7); if (Math.abs(u - sx) + Math.abs(v - sy) < 0.022) return [250, 240, 205]; }
      return night;
    };
    case 'story-whale': return (u, v) => {
      if (v > 0.7) return frac(v * 10 + 0.2 * Math.sin(u * 14)) < 0.3 ? shade(c3, 0.3) : c3;
      if (inEllipse(u, v, 0.48, 0.55, 0.26, 0.14) && v < 0.66) return shade(c3, -0.25);
      if (inTri(u, v, [0.72, 0.52], [0.9, 0.38], [0.88, 0.62])) return shade(c3, -0.25);
      if (Math.abs(u - 0.4) < 0.01 && v > 0.28 && v < 0.42) return shade(c3, 0.5);
      return shade(c3, 0.6);
    };
    case 'story-balloon': return (u, v) => {
      if (v > 0.78) return shade(c2, -0.1);
      if (Math.hypot(u - 0.5, v - 0.3) < 0.18) return frac((u - 0.32) / 0.36 * 4) < 0.5 ? c1 : shade(c1, 0.35);
      if (Math.abs(u - 0.5) < 0.05 && v > 0.52 && v < 0.6) return shade(c2, -0.4);
      if ((Math.abs(u - 0.43 - (v - 0.45) * 0.3) < 0.006 || Math.abs(u - 0.57 + (v - 0.45) * 0.3) < 0.006) && v > 0.45 && v < 0.53) return shade(c2, -0.4);
      return shade(c3, 0.55);
    };
    case 'mountains': return (u, v) => {   // three ranges under a sun, hazing toward the sky
      const ridge = (k: number, f: number, o: number) => 0.42 + k * 0.12 + 0.09 * Math.sin(u * f + o) + 0.04 * Math.sin(u * f * 2.3 + o * 1.7);
      if (v > ridge(2, 5, 4)) return shade(c1, -0.25);
      if (v > ridge(1, 6, 2)) return shade(c1, -0.05);
      if (v > ridge(0, 7, 0)) return shade(c1, 0.25);
      if (Math.hypot(u - 0.7, v - 0.22) < 0.08) return shade(c2, 0.5);
      return sky(v);
    };
    case 'floral': return (u, v, a) => {   // one big bloom on its stem
      const x = (u - 0.5) * a, y = v - 0.4, r = Math.hypot(x, y) / 0.3, t = Math.atan2(y, x);
      if (r < 0.28) return shade(c2, -0.1);
      if (r < 0.55 + 0.4 * Math.abs(Math.cos(2.5 * t))) return c1;
      if (Math.abs(u - 0.5) < 0.012 && v > 0.55) return shade(c3, -0.3);
      if (inEllipse(u, v, 0.4, 0.78, 0.09, 0.035) || inEllipse(u, v, 0.6, 0.68, 0.09, 0.035)) return shade(c3, -0.1);
      return bg;
    };
    case 'arches': return (u, v, a) => {   // nested arches in warm colours (a boho pair)
      const x = (u - 0.5) * a, y = v;
      const inArch = (w: number) => y < 0.9 && (y >= 0.48 ? Math.abs(x) < w : Math.hypot(x, 0.48 - y) < w);
      if (inArch(0.34)) return inArch(0.25) ? (inArch(0.16) ? c3 : c2) : c1;
      return bg;
    };
    case 'colourfield': return (u, v) => {   // two soft rectangles of colour on a ground
      const soft = (x: number, y: number, x0: number, y0: number, x1: number, y1: number) => x > x0 && x < x1 && y > y0 && y < y1;
      if (soft(u, v, 0.1, 0.1, 0.9, 0.46)) return c1;
      if (soft(u, v, 0.1, 0.52, 0.9, 0.9)) return c2;
      return bg;
    };
    case 'skyline': return (u, v) => {   // a city skyline, windows lit
      const i = Math.floor(u * 9), top = 0.3 + hash(i, 3, 2) * 0.4;
      if (v > top && frac(u * 9) > 0.08) { const win = frac(u * 9 * 4) > 0.3 && frac((v - top) * 12) > 0.4; return win ? [246, 226, 150] : shade(c1, -0.35 + hash(i, 5, 1) * 0.25); }
      return sky(v);
    };
    case 'lemons': return (u, v) => {   // a still life: lemons and a leaf on a ledge
      if (v > 0.72) return shade(c2, -0.1);
      if (inEllipse(u, v, 0.4, 0.62, 0.12, 0.09) || inEllipse(u, v, 0.58, 0.64, 0.11, 0.085)) return [232, 200, 70];
      if (inEllipse(u, v, 0.5, 0.5, 0.06, 0.02) && u > 0.45) return shade(c3, -0.2);
      return bg;
    };
    default: return (u, v, a) => {   // abstract: overlapping discs and a bar
      const x = u * a;
      if (Math.hypot(x - a * 0.38, v - 0.42) < 0.24) return Math.hypot(x - a * 0.6, v - 0.55) < 0.2 ? lerp(c1, c2, 0.5) : c1;
      if (Math.hypot(x - a * 0.6, v - 0.55) < 0.2) return c2;
      if (v > 0.78 && v < 0.84 && x > a * 0.15 && x < a * 0.85) return c3;
      return bg;
    };
  }
}

// ---- rasterise + cache ----------------------------------------------------------------------------------------------
const cache = new Map<string, any>();
function raster(THREE: any, key: string, paint: Painter, W: number, H: number, aspect: number, grain: number) {
  const hit = cache.get(key); if (hit) return hit;
  const data = new Uint8Array(W * H * 4);
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
    let r = 0, g = 0, b = 0;
    for (const [sx, sy] of [[0.25, 0.25], [0.75, 0.25], [0.25, 0.75], [0.75, 0.75]]) { const c = paint((i + sx) / W, (j + sy) / H, aspect); r += c[0]; g += c[1]; b += c[2]; }
    const n = grain ? 1 + (hash(i, j, 3) - 0.5) * grain : 1, o = ((H - 1 - j) * W + i) * 4;   // row 0 of a DataTexture is uv v = 0 (the bottom), so a painter's v runs DOWN from the top
    data[o] = Math.max(0, Math.min(255, Math.round(r / 4 * n))); data[o + 1] = Math.max(0, Math.min(255, Math.round(g / 4 * n))); data[o + 2] = Math.max(0, Math.min(255, Math.round(b / 4 * n))); data[o + 3] = 255;
  }
  const tex = new THREE.DataTexture(data, W, H, THREE.RGBAFormat);
  tex.colorSpace = THREE.SRGBColorSpace; tex.magFilter = THREE.LinearFilter; tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.generateMipmaps = true; tex.anisotropy = 4; tex.needsUpdate = true;
  cache.set(key, tex);
  return tex;
}
const pow2 = (n: number) => 2 ** Math.round(Math.log2(Math.max(16, Math.min(256, n))));

/** A rug / textile pattern texture over one w × d piece (u across w, v along d). */
export function patternTexture(THREE: any, name: string, colours: number[], { w = 2, d = 1.4 } = {}) {
  const nm = (RUG_PATTERNS as readonly string[]).includes(name) ? name : 'solid';
  const W = pow2(64 * Math.max(1, w / d)), H = pow2(64 * Math.max(1, d / w));
  return raster(THREE, `rug:${nm}:${colours.join(',')}:${W}x${H}:${(w / d).toFixed(2)}`, rugPainter(nm, colours.map(rgb)), W, H, w / d, 0.07);
}

/** A painting for a w × h canvas (u across, v down). */
export function motifTexture(THREE: any, name: string, colours: number[], { w = 0.8, h = 0.6 } = {}) {
  const nm = (ART_MOTIFS as readonly string[]).includes(name) ? name : 'abstract';
  const W = pow2(128 * Math.max(1, w / h)), H = pow2(128 * Math.max(1, h / w));
  const paint = artPainter(nm, colours.map(rgb));
  return raster(THREE, `art:${nm}:${colours.join(',')}:${W}x${H}:${(w / h).toFixed(2)}`, paint, W, H, w / h, 0.03);
}
