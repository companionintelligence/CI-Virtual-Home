// What a species costs and covers, measured on the geometry the site kit really builds (the vendored three, in Node —
// no browser): the numbers behind assets/site-species-masks.ts (what a plant hides of the mulch under it) and the
// triangle budget of scripts/test-site-species.mts.
//
//   measureSpecies()   → { [species]: { tris, cover, mask, h, r } } for every non-tree species, one plant at its mean size
//     tris    triangles one plant of the species costs (foliage, flower heads, centres, stems)
//     cover   the share of the crown disc (radius = the plant's planning radius) its top-down silhouette fills —
//             foliage AND blooms, so a lavender's spikes count
//     mask    the silhouette itself: MASK_N × MASK_N cells over [−MASK_REACH, MASK_REACH]² in crown radii, 1 = covered
//   encodeMask / decodeMask   the hex the generated table stores it as (4 cells a character, row by row)
import fs from 'node:fs';
import path from 'node:path';

export const ROOT = path.resolve(import.meta.dirname, '..');
export const MASK_N = 32, MASK_REACH = 1.6;   // the mask spans ±MASK_REACH crown radii: a bloom stands a little past the crown
const SUPER = 3;                                // measured 3 × 3 finer, then each cell is covered when most of it is

export async function loadKit() {
  const THREE = await import(path.join(ROOT, 'assets', 'vendor', 'three', 'three.module.min.js'));
  const K = await import(path.join(ROOT, 'assets', 'site.js'));
  const P = await import(path.join(ROOT, 'assets', 'site-planting.js'));
  const std = (color: number, o: any = {}) => new THREE.MeshStandardMaterial({ color, ...o });
  const spec = { id: 'species-measure', levels: [{ y: 0, footprint: [{ x: -40, z: -40, w: 8, d: 6 }] }], site: [] };
  const kit = K.createSiteKit({ THREE, seed: 'species-measure', std, mix: (a: any) => a, keepOut: [], spec, surface: null, gen2: false });
  return { THREE, K, P, kit, std };
}
export const mulberry = (a: number) => () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };

/** triangles of a built group (instances counted) */
export function trisOf(g: any): number {
  let n = 0;
  g.traverse((m: any) => { if (!m.isMesh) return; const geo = m.geometry; n += (geo.index ? geo.index.count : geo.attributes.position.count) / 3 * (m.isInstancedMesh ? m.count : 1); });
  return n;
}

/** rasterise every triangle of a group, seen from above, into a silhouette (SUPER × finer than the mask) */
function silhouette(THREE: any, g: any, crownR: number): Uint8Array {
  const N = MASK_N * SUPER, fine = new Uint8Array(N * N), cell = 2 * MASK_REACH / N;
  g.updateMatrixWorld(true);
  const m4 = new THREE.Matrix4(), v = new THREE.Vector3();
  const stamp = (geo: any, world: any) => {
    const pos = geo.attributes.position, idx = geo.index, n = idx ? idx.count : pos.count;
    const P = (i: number): [number, number] => { const j = idx ? idx.getX(i) : i; v.set(pos.getX(j), pos.getY(j), pos.getZ(j)).applyMatrix4(world); return [v.x / crownR, v.z / crownR]; };
    for (let t = 0; t < n; t += 3) {
      const a = P(t), b = P(t + 1), c = P(t + 2);
      const x0 = Math.max(0, Math.floor((Math.min(a[0], b[0], c[0]) + MASK_REACH) / cell)), x1 = Math.min(N - 1, Math.floor((Math.max(a[0], b[0], c[0]) + MASK_REACH) / cell));
      const z0 = Math.max(0, Math.floor((Math.min(a[1], b[1], c[1]) + MASK_REACH) / cell)), z1 = Math.min(N - 1, Math.floor((Math.max(a[1], b[1], c[1]) + MASK_REACH) / cell));
      const den = (b[1] - c[1]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[1] - c[1]);
      if (Math.abs(den) < 1e-12) continue;
      for (let zi = z0; zi <= z1; zi++) for (let xi = x0; xi <= x1; xi++) {
        const px = -MASK_REACH + (xi + 0.5) * cell, pz = -MASK_REACH + (zi + 0.5) * cell;
        const l1 = ((b[1] - c[1]) * (px - c[0]) + (c[0] - b[0]) * (pz - c[1])) / den, l2 = ((c[1] - a[1]) * (px - c[0]) + (a[0] - c[0]) * (pz - c[1])) / den, l3 = 1 - l1 - l2;
        if (l1 >= -0.02 && l2 >= -0.02 && l3 >= -0.02) fine[zi * N + xi] = 1;
      }
    }
  };
  g.traverse((o: any) => {
    if (!o.isMesh) return;
    if (o.isInstancedMesh) for (let i = 0; i < o.count; i++) { o.getMatrixAt(i, m4); stamp(o.geometry, m4.premultiply(o.matrixWorld)); }
    else stamp(o.geometry, o.matrixWorld);
  });
  const mask = new Uint8Array(MASK_N * MASK_N);
  for (let zi = 0; zi < MASK_N; zi++) for (let xi = 0; xi < MASK_N; xi++) {
    let k = 0; for (let a = 0; a < SUPER; a++) for (let b = 0; b < SUPER; b++) k += fine[(zi * SUPER + a) * N + xi * SUPER + b];
    mask[zi * MASK_N + xi] = k * 2 > SUPER * SUPER ? 1 : 0;
  }
  return mask;
}

export const coverOfMask = (mask: Uint8Array) => { let n = 0; for (let i = 0; i < mask.length; i++) n += mask[i]; const cell = 2 * MASK_REACH / MASK_N; return n * cell * cell / Math.PI; };
export function encodeMask(mask: Uint8Array): string {
  let out = '';
  for (let i = 0; i < mask.length; i += 4) out += ((mask[i] << 3) | (mask[i + 1] << 2) | (mask[i + 2] << 1) | mask[i + 3]).toString(16);
  return out;
}
export function decodeMask(hex: string): Uint8Array {
  const m = new Uint8Array(MASK_N * MASK_N);
  for (let i = 0; i < m.length; i++) m[i] = (parseInt(hex[i >> 2], 16) >> (3 - (i & 3))) & 1;
  return m;
}

export type SpeciesStat = { draw: string; tris: number; cover: number; mask: Uint8Array | null; h: number; r: number };
/** every species, one plant at its mean size, stamped at the origin (a tree has a cost but no silhouette mask) */
export async function measureSpecies(only?: string[]): Promise<Record<string, SpeciesStat>> {
  const { THREE, P, kit, std } = await loadKit();
  const out: Record<string, SpeciesStat> = {};
  for (const [sp, S] of Object.entries<any>(P.SPECIES)) {
    if (only && !only.includes(sp)) continue;
    const tree = S.draw.startsWith('tree:');
    const r = (S.r[0] + S.r[1]) / 2, h = (S.h[0] + S.h[1]) / 2;
    const g = new THREE.Group();
    kit.drawPlants(g, [{ sp, x: 0, z: 0, y: 0, h, r, rot: 0, tint: 1, bloom: S.bloom ? S.bloom[0] : null, layer: 'x' }], mulberry(7), (c: number, o: any = {}) => std(c, o), 0);
    const mask = tree ? null : silhouette(THREE, g, r);
    out[sp] = { draw: S.draw, tris: Math.round(trisOf(g)), cover: mask ? +coverOfMask(mask).toFixed(3) : 0.8, mask, h, r };
  }
  return out;
}

export function readJson(p: string) { return JSON.parse(fs.readFileSync(p, 'utf8')); }
