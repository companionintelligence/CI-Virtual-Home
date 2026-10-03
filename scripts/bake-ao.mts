#!/usr/bin/env -S node --experimental-strip-types
// Bake each house's ambient-occlusion volume: content/ao/<id>.<sha8>.bin and content/ao/manifest.json.
//
//   pnpm run ao [--house aurora,cocoon] [--workers 8] [--out-dir <dir>] [--check] [--quiet]
//
//   (no flags)   every house in content/houses/index.json: export its occluders from the player, bake, write
//   --house      only these (the manifest keeps the other entries)
//   --workers    worker threads (default: cores - 1, at most 8). The volume is the same bytes for any number
//   --out-dir    write there instead of content/ao/ (the live check bakes into a scratch directory)
//   --manifest   with --check: compare against this manifest instead of content/ao/manifest.json (the live check's stale test)
//   --check      bake nothing: export every house and compare its fingerprint with the manifest's. Exit 1 on a stale or
//                missing entry. check-house.mts runs this as its `ao` step
//
// THE VOLUME. A grid of 0.25 m cells over the house's plan bounds plus a 1.5 m margin, from the ground to the top
// storey plus 1.2 m. For each cell centre, 32 rays (a Fibonacci sphere, turned about the vertical by an angle from an
// FNV-1a hash of the cell's integer coordinates, so the cells' sampling patterns differ without a random number) look 1.5 m
// for the first triangle of the house's opaque geometry, either side. The cell's visibility is 1 - mean(1 - t/R) over
// the rays: 1 in the open, falling as occluders crowd closer. (A flat wall in the open measures 0.701 at the 0.2 m the
// shader samples off the surface; the shader divides by that, so only concavities darken.) A cell with more than 40 % of
// its rays leaving through a back face within 0.35 m is inside a wall: it is marked solid, and refilled from its free
// neighbours over three passes, so a wall's own cells do not darken the air beside it. An 8-ray probe that finds nothing
// within R ends a cell early (most of the volume is open air).
//
// THE OCCLUDERS come from the real player: the page is opened with ?aoexport=1 and assets/realism-ao.ts hands back the
// opaque triangles of the very scene the volume will be drawn on (batched, as the player has it, before the shot's
// dressing). Positions are snapped to 1/1024 m so the bake is a function of integers.
//
// DETERMINISM. No Math.random, no clock in anything that decides a byte; the work is split into slabs of cells, each
// independent, so the bytes do not depend on the worker count. The file name carries the hash of its content, so a rebake
// of an unchanged tree rewrites nothing.
//
// three-mesh-bvh is vendored under scripts/vendor/ (MIT, see THIRD_PARTY.md) and is used here only: the player never
// loads it.
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';
import * as THREE from '../assets/vendor/three/three.module.min.js';
import * as BVH from './vendor/three-mesh-bvh.0.9.15.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');
const CELL = 0.25, RAYS = 32, RADIUS = 1.5, SOLID_FRACTION = 0.4, SOLID_DEPTH = 0.35, PROBES = 8, FILL_PASSES = 3, QUANT = 1024;
const HEADER = 40, VERSION = 1;

// ---------------------------------------------------------------------------------------------------- the bake itself
const fnv1a = (i: number, j: number, k: number): number => {
  let h = 2166136261 >>> 0;
  for (const x of [i, j, k]) { h ^= x & 255; h = Math.imul(h, 16777619) >>> 0; h ^= (x >> 8) & 255; h = Math.imul(h, 16777619) >>> 0; }
  return h;
};

/** a function that bakes one slab of cells (z from k0 to k1): visibility 0…255 and the solid mask, x fastest */
function slabBaker(tris: Float32Array, origin: [number, number, number], dims: [number, number, number]) {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(tris.slice(), 3));   // (MeshBVH reorders the geometry's index in place: it gets a copy of its own)
  const bvh = new BVH.MeshBVH(geo, { strategy: BVH.SAH, targetLeafSize: 10 });
  const [nx, ny] = dims, [ox, oy, oz] = origin;
  const base: number[][] = [];
  for (let n = 0; n < RAYS; n++) { const y = 1 - 2 * (n + 0.5) / RAYS, r = Math.sqrt(1 - y * y), phi = n * 2.399963229728653; base.push([r * Math.cos(phi), y, r * Math.sin(phi)]); }
  const ray = new THREE.Ray();
  return (k0: number, k1: number): { vis: Uint8Array; solid: Uint8Array; rays: number } => {
    const vis = new Uint8Array(nx * ny * (k1 - k0)), solid = new Uint8Array(vis.length);
    let rays = 0;
    for (let k = k0; k < k1; k++) for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
      const idx = i + nx * (j + ny * (k - k0));
      ray.origin.set(ox + (i + 0.5) * CELL, oy + (j + 0.5) * CELL, oz + (k + 0.5) * CELL);
      const ang = (fnv1a(i, j, k) / 4294967296) * Math.PI * 2, ca = Math.cos(ang), sa = Math.sin(ang);
      let any = false;
      for (let n = 0; n < RAYS; n += RAYS / PROBES) { const b = base[n]; ray.direction.set(b[0] * ca - b[2] * sa, b[1], b[0] * sa + b[2] * ca); rays++; if (bvh.raycastFirst(ray, THREE.DoubleSide, 0, RADIUS)) { any = true; break; } }
      if (!any) { vis[idx] = 255; continue; }
      let occl = 0, back = 0;
      for (let n = 0; n < RAYS; n++) {
        const b = base[n]; ray.direction.set(b[0] * ca - b[2] * sa, b[1], b[0] * sa + b[2] * ca);
        const h = bvh.raycastFirst(ray, THREE.DoubleSide, 0, RADIUS); rays++;
        if (h) { occl += 1 - h.distance / RADIUS; if (h.face.normal.dot(ray.direction) > 0 && h.distance < SOLID_DEPTH) back++; }
      }
      if (back / RAYS > SOLID_FRACTION) { solid[idx] = 1; vis[idx] = 255; } else vis[idx] = Math.round(255 * (1 - occl / RAYS));
    }
    return { vis, solid, rays };
  };
}

/** the solid cells take the mean of their free neighbours, three passes outward */
function fillSolid(vis: Uint8Array, solid: Uint8Array, dims: [number, number, number]) {
  const [nx, ny, nz] = dims;
  const nb = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
  for (let pass = 0; pass < FILL_PASSES; pass++) {
    const upd: [number, number][] = [];
    for (let k = 0; k < nz; k++) for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
      const idx = i + nx * (j + ny * k);
      if (!solid[idx]) continue;
      let s = 0, c = 0;
      for (const [dx, dy, dz] of nb) {
        const ii = i + dx, jj = j + dy, kk = k + dz;
        if (ii < 0 || jj < 0 || kk < 0 || ii >= nx || jj >= ny || kk >= nz) continue;
        const q = ii + nx * (jj + ny * kk);
        if (!solid[q]) { s += vis[q]; c++; }
      }
      if (c) upd.push([idx, Math.round(s / c)]);
    }
    for (const [idx, v] of upd) { vis[idx] = v; solid[idx] = 0; }
  }
}

/** One [1 2 1] pass along each axis. A cell's 32 rays are a noisy estimate and neighbouring cells use differently turned
 *  rays, which shows as cloud-sized mottling on a large flat wall or ceiling; this takes most of it out. A cell that was
 *  solid (inside a wall) is left out of its neighbours' mean, so a wall's far side does not bleed through it. */
function blur(vis: Uint8Array, solid: Uint8Array, dims: [number, number, number]) {
  const [nx, ny, nz] = dims, strides = [1, nx, nx * ny], sizes = [nx, ny, nz];
  for (let axis = 0; axis < 3; axis++) {
    const src = vis.slice(), st = strides[axis], n = sizes[axis];
    for (let k = 0; k < nz; k++) for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
      const idx = i + nx * (j + ny * k), c = [i, j, k][axis];
      let sum = 2 * src[idx], w = 2;
      if (c > 0 && !solid[idx - st]) { sum += src[idx - st]; w += 1; }
      if (c < n - 1 && !solid[idx + st]) { sum += src[idx + st]; w += 1; }
      vis[idx] = Math.round(sum / w);
    }
  }
}

if (!isMainThread) {
  // a worker builds the BVH once, then bakes whichever slabs it is handed
  const w = workerData as { tris: Float32Array; origin: [number, number, number]; dims: [number, number, number] };
  const bake = slabBaker(w.tris, w.origin, w.dims);
  parentPort!.on('message', (m: { k0: number; k1: number } | 'done') => {
    if (m === 'done') { process.exit(0); }
    const r = bake(m.k0, m.k1);
    parentPort!.postMessage({ k0: m.k0, ...r }, [r.vis.buffer as ArrayBuffer, r.solid.buffer as ArrayBuffer]);
  });
} else {
  await main();
}

// ---------------------------------------------------------------------------------------------------- the driver
async function main() {
  const argv = process.argv.slice(2);
  const args: Record<string, string> = {};
  argv.forEach((a, i) => { if (a.startsWith('--')) args[a.slice(2)] = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : 'true'; });
  const CHECK = args.check === 'true', QUIET = args.quiet === 'true';
  const OUT = path.resolve(args['out-dir'] || path.join(ROOT, 'content', 'ao'));
  const WORKERS = Math.max(1, Number(args.workers) || Math.min(8, Math.max(1, os.cpus().length - 1)));
  const index = JSON.parse(fs.readFileSync(path.join(ROOT, 'content', 'houses', 'index.json'), 'utf8'));
  const all: string[] = (index.houses || []).map((h: { id: string }) => h.id);
  const ids = args.house ? args.house.split(',').filter(Boolean) : all;
  for (const id of ids) if (!all.includes(id)) { console.error(`ao: no house "${id}"`); process.exit(2); }
  const log = (...a: unknown[]) => { if (!QUIET) console.log(...a); };

  const manifestPath = path.join(OUT, 'manifest.json');
  const readManifest = () => (fs.existsSync(manifestPath) ? JSON.parse(fs.readFileSync(manifestPath, 'utf8')) : { version: VERSION, cell: CELL, rays: RAYS, radius: RADIUS, houses: {} });
  const manifest = readManifest();
  // the check compares against the committed manifest, wherever --out-dir points
  const committed = CHECK && (args['out-dir'] || args.manifest) ? JSON.parse(fs.readFileSync(args.manifest ? path.resolve(args.manifest) : path.join(ROOT, 'content', 'ao', 'manifest.json'), 'utf8')) : manifest;

  const { loadPlaywright, LAUNCH_ARGS, serve, stubGoogleFonts } = await import('./portal-lib.mts');
  const srv = await serve(ROOT, '/');
  const pw = await loadPlaywright();
  const browser = await pw.chromium.launch({ headless: true, args: LAUNCH_ARGS });
  let stale = 0;
  try {
    for (const id of ids) {
      const t0 = Date.now();
      const exp = await exportHouse(browser, srv, stubGoogleFonts, id, !CHECK);
      if (CHECK) {
        const e = committed.houses && committed.houses[id];
        const verdict = !e ? 'missing' : !sameFingerprint(e.fp, exp.fp) ? 'stale' : 'fresh';
        if (verdict !== 'fresh') stale++;
        console.log(`ao ${id.padEnd(14)} ${verdict}${verdict === 'stale' ? ` (baked from ${e.fp.n} triangles, now ${exp.fp.n})` : ''}`);
        continue;
      }
      const dims = exp.dims as [number, number, number];
      const origin = exp.box.min as [number, number, number];
      const t1 = Date.now();
      const { vis, rays } = await bakeVolume(exp.tris, origin, dims, WORKERS);
      const hash = crypto.createHash('sha256').update(Buffer.from(exp.tris.buffer, exp.tris.byteOffset, exp.tris.byteLength)).digest('hex').slice(0, 16);
      const file = Buffer.alloc(HEADER + vis.length);
      file.write('VHAO', 0, 'latin1');
      file.writeUInt16LE(dims[0], 4); file.writeUInt16LE(dims[1], 6); file.writeUInt16LE(dims[2], 8);
      file.writeUInt8(RAYS, 10); file.writeUInt8(VERSION, 11);
      file.writeFloatLE(CELL, 12); file.writeFloatLE(origin[0], 16); file.writeFloatLE(origin[1], 20); file.writeFloatLE(origin[2], 24); file.writeFloatLE(RADIUS, 28);
      Buffer.from(hash, 'hex').copy(file, 32);
      Buffer.from(vis.buffer, vis.byteOffset, vis.length).copy(file, HEADER);
      const sha8 = crypto.createHash('sha256').update(file).digest('hex').slice(0, 8);
      const name = `${id}.${sha8}.bin`;
      fs.mkdirSync(OUT, { recursive: true });
      for (const f of fs.readdirSync(OUT)) if (f.startsWith(`${id}.`) && f.endsWith('.bin') && f !== name) fs.rmSync(path.join(OUT, f));
      if (!fs.existsSync(path.join(OUT, name))) fs.writeFileSync(path.join(OUT, name), file);
      const round = (v: number) => Math.round(v * 1e4) / 1e4;
      manifest.houses[id] = { file: name, bytes: file.length, dims, tris: exp.tris.length / 9, fp: { n: exp.fp.n, c: exp.fp.c.map(round), q: exp.fp.q.map(round), a: round(exp.fp.a) } };
      log(`ao ${id.padEnd(14)} ${dims.join('x')} ${(file.length / 1024).toFixed(0)} KB  ${exp.tris.length / 9} tris  ${rays} rays  export ${((t1 - t0) / 1000).toFixed(1)} s  bake ${((Date.now() - t1) / 1000).toFixed(1)} s  ${name}`);
    }
  } finally { await browser.close(); await srv.close(); }

  if (CHECK) { console.log(stale ? `\n${stale} stale or missing: pnpm run ao${ids.length === all.length ? '' : ` --house ${ids.join(',')}`}` : '\nao volumes are fresh'); process.exit(stale ? 1 : 0); }
  const sorted: Record<string, unknown> = {};
  for (const k of Object.keys(manifest.houses).sort()) sorted[k] = manifest.houses[k];
  const out = JSON.stringify({ version: VERSION, cell: CELL, rays: RAYS, radius: RADIUS, houses: sorted }, null, 1) + '\n';
  if (!fs.existsSync(manifestPath) || fs.readFileSync(manifestPath, 'utf8') !== out) fs.writeFileSync(manifestPath, out);
  // a volume nobody lists is dropped (a renamed or removed house)
  if (!args.house) for (const f of fs.readdirSync(OUT)) if (f.endsWith('.bin') && !Object.values(sorted as Record<string, { file: string }>).some(e => e.file === f)) fs.rmSync(path.join(OUT, f));
}

/** Open the player on the house and take its occluders and fingerprint from the scene the volume will be drawn on. */
async function exportHouse(browser: any, srv: { url: (p: string) => string; origin: string }, stubGoogleFonts: any, id: string, withTris: boolean) {
  const ctx = await browser.newContext({ viewport: { width: 640, height: 360 }, deviceScaleFactor: 1 });
  try {
    const page = await ctx.newPage();
    const errs: string[] = [];
    page.on('pageerror', (e: Error) => errs.push(e.message));
    await stubGoogleFonts(page, srv.origin);
    // (no=compile: nothing here is drawn; no=ao,contact would leave the export out, so only the shader work is skipped)
    await page.goto(`${srv.url('room-creator.html')}?mode=view&house=${encodeURIComponent(id)}&shot=orbit&play=0&aoexport=1&no=compile,contact,water,sky,grass,assets,frame,fresnel`, { waitUntil: 'domcontentloaded', timeout: 240000 });
    try { await page.waitForFunction(() => !!(window as any).__vhAoExport, null, { timeout: 240000 }); }
    catch (e) { throw new Error(`ao: ${id} did not export its occluders (${errs.join('; ') || (e as Error).message})`); }
    const r = await page.evaluate((withTris: boolean) => {
      const e = (window as any).__vhAoExport;
      let s = '';
      if (withTris) { const u = new Uint8Array(e.tris.buffer, e.tris.byteOffset, e.tris.byteLength); for (let i = 0; i < u.length; i += 32768) s += String.fromCharCode.apply(null, Array.from(u.subarray(i, i + 32768))); }
      return { b64: btoa(s), box: e.box, fp: e.fp };
    }, withTris);
    const raw = new Float32Array(new Uint8Array(Buffer.from(r.b64, 'base64')).buffer);
    // snap to 1/1024 m: the bake is then a function of integers (and the hash below of those)
    for (let i = 0; i < raw.length; i++) raw[i] = Math.round(raw[i] * QUANT) / QUANT;
    const dims = [0, 1, 2].map(i => Math.ceil((r.box.max[i] - r.box.min[i]) / CELL - 1e-9));
    return { tris: raw, box: r.box as { min: number[]; max: number[] }, fp: r.fp as { n: number; c: number[]; q: number[]; a: number }, dims };
  } finally { await ctx.close(); }
}

async function bakeVolume(tris: Float32Array, origin: [number, number, number], dims: [number, number, number], workers: number): Promise<{ vis: Uint8Array; rays: number }> {
  const [nx, ny, nz] = dims;
  // more slabs than workers, handed out as workers free up, so one heavy slab does not hold the rest
  const n = Math.min(nz, workers * 4);
  const queue = Array.from({ length: n }, (_, s) => ({ k0: Math.floor(nz * s / n), k1: Math.floor(nz * (s + 1) / n) })).filter(s => s.k1 > s.k0);
  const vis = new Uint8Array(nx * ny * nz), solid = new Uint8Array(vis.length);
  let next = 0, rays = 0;
  await Promise.all(Array.from({ length: Math.min(workers, queue.length) }, () => new Promise<void>((res, rej) => {
    const w = new Worker(new URL(import.meta.url), { workerData: { tris, origin, dims }, execArgv: ['--experimental-strip-types'] });
    const give = () => { if (next < queue.length) w.postMessage(queue[next++]); else { w.postMessage('done'); res(); } };
    w.on('message', (m: { k0: number; vis: Uint8Array; solid: Uint8Array; rays: number }) => { const off = nx * ny * m.k0; vis.set(m.vis, off); solid.set(m.solid, off); rays += m.rays; give(); });
    w.once('error', rej);
    give();
  })));
  const wasSolid = solid.slice();
  fillSolid(vis, solid, dims);
  blur(vis, wasSolid, dims);
  return { vis, rays };
}

// the player's tolerance compare (assets/viewer-ao.ts sameFingerprint), restated: this file never imports the player's code
type Fp = { n: number; c: number[]; q: number[]; a: number };
function sameFingerprint(a: Fp, b: Fp): boolean {
  if (a.n !== b.n) return false;
  const pair = (x: number, y: number) => Math.abs(x - y) <= 0.01 + 1e-8 * Math.abs(x);
  return a.c.every((v, i) => pair(v, b.c[i])) && a.q.every((v, i) => pair(v, b.q[i])) && pair(a.a, b.a);
}
