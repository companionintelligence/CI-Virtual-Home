#!/usr/bin/env -S node --experimental-strip-types
// pnpm run prep:assets: fetches the CC0 sources named in scripts/assets-sources.json and writes the compressed,
// content-hashed files the live player loads lazily, plus the two files that describe them.
//
//   pnpm run prep:assets [--only <id,id>] [--offline] [--fetch-only]
//     --only    redo these ids only (the rest of the manifest is read from the previous run)
//     --offline use the downloads already in .cache/prep-tools/downloads (never touches the network)
//
// WRITES
//   assets/media/assets/tex/<id>-<part>-<sha256[0:8]>.webp    albedo (512 and 1024), normal (512), roughness (512)
//   assets/media/assets/models/<id>-<sha256[0:8]>.glb         meshopt + quantized + WebP textures
//   assets/media/assets/files.json                            the portal guard's manifest (scripts/portal-assets.mts)
//   assets/media-assets.ts                                    ids, files, bytes, triangles, boxes, periods, mean colours,
//                                                             licences, tiers: what the player's registry imports
//
// WHY THE TOOLS ARE NOT DEPENDENCIES. @gltf-transform/*, sharp and meshoptimizer make the files; the site never runs
// them. They are installed on first use into the gitignored .cache/prep-tools/ (pinned versions in
// assets-sources.json, recorded in THIRD_PARTY.md) so the lockfile, CI and the deploy job stay untouched.
//
// WHERE THE BYTES COME FROM. Poly Haven through api.polyhaven.com/files/<id> (their API terms ask for a unique
// User-Agent and few calls: one files call per asset, cached, md5 of every download checked against it) and ambientCG
// through ambientcg.com/get?file=<id>_1K-JPG.zip. No page is scraped. Every download is logged with its URL and size.
//
// WHAT A TEXTURE BECOMES. The player keeps the house's palette and lighting presets exactly as tuned, so a photographed
// albedo may carry only the DETAIL of the surface, not its colour: the albedo is reduced to its luma (with a chosen share
// of its local colour variation kept for brick and clay), its contrast is softened, cavity occlusion is baked in, and it is
// renormalised to a known mean. The runtime tints the material by (the procedural set's mean colour) / (this mean), so the
// surface lands on the same average colour it had and gains the relief, grain and joints. The normal map is kept (GL, re-
// normalised, strength per asset); the roughness is kept. All maps are written with row 0 = v 0 (flipped), the kit's own
// convention (assets/textures.ts), so the loader sets flipY = false and a normal's green is still "up".
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const ROOT = path.resolve(import.meta.dirname, '..');
const CACHE = path.join(ROOT, '.cache', 'prep-tools');
const DL = path.join(CACHE, 'downloads');
const OUT = path.join(ROOT, 'assets', 'media', 'assets');
const SOURCES_FILE = path.join(ROOT, 'scripts', 'assets-sources.json');
const argv = process.argv.slice(2);
const flag = (n: string) => argv.includes(`--${n}`);
const opt = (n: string) => { const i = argv.indexOf(`--${n}`); return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : ''; };
const sources = JSON.parse(fs.readFileSync(SOURCES_FILE, 'utf8'));
const only = new Set(opt('only').split(',').filter(Boolean));
const offline = flag('offline');
const log: string[] = [];
const say = (s: string) => { console.log(s); log.push(s); };

// ------------------------------------------------------------------------------------------------ the tools
function bootstrap(): void {
  fs.mkdirSync(CACHE, { recursive: true });
  const pkg = path.join(CACHE, 'package.json');
  const want = JSON.stringify({ name: 'ci-virtual-home-prep-tools', private: true, type: 'module', dependencies: sources.tools }, null, 2) + '\n';
  if (!fs.existsSync(pkg) || fs.readFileSync(pkg, 'utf8') !== want) fs.writeFileSync(pkg, want);
  if (!fs.existsSync(path.join(CACHE, 'node_modules', 'sharp'))) {
    if (offline) throw new Error('--offline: the prep tools are not installed in .cache/prep-tools');
    say('# installing the prep tools into .cache/prep-tools (npm, pinned versions; not a dependency of the repo)');
    execFileSync('npm', ['install', '--no-audit', '--no-fund', '--loglevel=error'], { cwd: CACHE, stdio: 'inherit' });
  }
}
async function tools() {
  const req = createRequire(path.join(CACHE, 'package.json'));
  const imp = (n: string) => import(pathToFileURL(req.resolve(n)).href);
  const sharp = (await imp('sharp')).default;
  const core = await imp('@gltf-transform/core');
  const ext = await imp('@gltf-transform/extensions');
  const fn = await imp('@gltf-transform/functions');
  const mo = await imp('meshoptimizer');
  const version = (n: string): string => JSON.parse(fs.readFileSync(path.join(CACHE, 'node_modules', n, 'package.json'), 'utf8')).version;
  for (const [n, v] of Object.entries(sources.tools as Record<string, string>)) if (n !== '@gltf-transform/cli' && version(n) !== v) throw new Error(`${n} is ${version(n)}, expected ${v}`);
  return { sharp, core, ext, fn, MeshoptEncoder: mo.MeshoptEncoder, MeshoptDecoder: mo.MeshoptDecoder, MeshoptSimplifier: mo.MeshoptSimplifier };
}

// ------------------------------------------------------------------------------------------------ downloads
const md5 = (b: Buffer): string => crypto.createHash('md5').update(b).digest('hex');
async function http(url: string): Promise<Buffer> {
  const r = await fetch(url, { headers: { 'User-Agent': sources.userAgent }, redirect: 'follow' });
  if (!r.ok) throw new Error(`${url}: HTTP ${r.status}`);
  return Buffer.from(await r.arrayBuffer());
}
/** download `url` to `dest` once (a present file is kept); the md5 from the API is checked when there is one */
async function getFile(url: string, dest: string, sum?: string, why = ''): Promise<string> {
  if (fs.existsSync(dest) && (!sum || md5(fs.readFileSync(dest)) === sum)) return dest;
  if (offline) throw new Error(`--offline: ${dest} is not in the cache`);
  const b = await http(url);
  if (sum && md5(b) !== sum) throw new Error(`${url}: md5 ${md5(b)} is not the API's ${sum}`);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, b);
  say(`  downloaded ${path.relative(DL, dest)}  ${(b.length / 1024).toFixed(0)} KB  ${url}${why ? `  (${why})` : ''}`);
  return dest;
}
const apiCache = new Map<string, any>();
async function phFiles(id: string): Promise<any> {
  if (apiCache.has(id)) return apiCache.get(id);
  const f = path.join(DL, 'api', `${id}.json`);
  if (!fs.existsSync(f)) {
    if (offline) throw new Error(`--offline: no cached files list for ${id}`);
    fs.mkdirSync(path.dirname(f), { recursive: true });
    fs.writeFileSync(f, (await http(`https://api.polyhaven.com/files/${id}`)).toString());
    say(`  api.polyhaven.com/files/${id}`);
  }
  const j = JSON.parse(fs.readFileSync(f, 'utf8'));
  apiCache.set(id, j);
  return j;
}

// ------------------------------------------------------------------------------------------------ pixel helpers
type Img = { w: number; h: number; c: number; d: Uint8Array | Float32Array };
const SRGB2LIN = new Float32Array(256).map((_, i) => { const x = i / 255; return x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4; });
const lin2srgb = (x: number): number => { x = x < 0 ? 0 : x > 1 ? 1 : x; return Math.round(255 * (x <= 0.0031308 ? x * 12.92 : 1.055 * x ** (1 / 2.4) - 0.055)); };
async function readRaw(sharp: any, file: string, size: number, channels: 1 | 3): Promise<Img> {
  let s = sharp(file).resize(size, size, { fit: 'fill', kernel: 'lanczos3' });
  s = channels === 1 ? s.greyscale() : s.removeAlpha().toColourspace('srgb');
  const { data, info } = await s.raw().toBuffer({ resolveWithObject: true });
  return { w: info.width, h: info.height, c: info.channels, d: new Uint8Array(data) };
}
/** rotate counter-clockwise by 90° × k (x → -y for a tangent-space vector, done by the caller for normal maps) */
function rotCCW(img: Img, k: number): Img {
  k = ((k % 4) + 4) % 4;
  let cur = img;
  for (let n = 0; n < k; n++) {
    const { w, h, c } = cur, out = new (cur.d.constructor as any)(w * h * c);
    // a pixel at (x, y) (y down) goes to (y, w - 1 - x) in the rotated image of size h × w
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const s = (y * w + x) * c, d = ((w - 1 - x) * h + y) * c; for (let q = 0; q < c; q++) out[d + q] = cur.d[s + q]; }
    cur = { w: h, h: w, c, d: out };
  }
  return cur;
}
function flipV(img: Img): Img {
  const { w, h, c } = img, out = new (img.d.constructor as any)(w * h * c);
  for (let y = 0; y < h; y++) out.set(img.d.subarray((h - 1 - y) * w * c, (h - y) * w * c), y * w * c);
  return { ...img, d: out };
}
const webp = (sharp: any, d: Uint8Array | Float32Array, w: number, h: number, c: number, quality: number): Promise<Buffer> =>
  sharp(Buffer.from(d.buffer, d.byteOffset, d.byteLength), { raw: { width: w, height: h, channels: c } }).webp({ quality, effort: 6, smartSubsample: false }).toBuffer();

// ------------------------------------------------------------------------------------------------ writing files
const written: string[] = [];
function writeHashed(dir: string, stem: string, ext: string, bytes: Buffer): { file: string; bytes: number } {
  const h = crypto.createHash('sha256').update(bytes).digest('hex').slice(0, 8);
  const name = `${stem}-${h}.${ext}`;
  fs.mkdirSync(path.join(OUT, dir), { recursive: true });
  fs.writeFileSync(path.join(OUT, dir, name), bytes);
  written.push(`${dir}/${name}`);
  return { file: `${dir}/${name}`, bytes: bytes.length };
}

// ------------------------------------------------------------------------------------------------ textures
async function fetchTexture(t: any): Promise<{ diff: string; nor: string; rough: string; ao: string | null }> {
  const dir = path.join(DL, t.source, t.sourceId);
  if (t.source === 'polyhaven') {
    const f = await phFiles(t.sourceId);
    const pick = (k: string) => f[k]?.['1k']?.jpg;
    const need = (k: string) => { const e = pick(k); if (!e) throw new Error(`${t.sourceId}: no 1k jpg for ${k}`); return e; };
    const get = (k: string, e: any) => getFile(e.url, path.join(dir, path.basename(e.url)), e.md5, `${t.id} ${k}`);
    const diff = await get('diffuse', need('Diffuse')), nor = await get('normal_gl', need('nor_gl'));
    if (pick('arm')) { const arm = await get('arm', need('arm')); return { diff, nor, rough: arm, ao: arm, ...{ armPacked: true } } as any; }
    return { diff, nor, rough: await get('rough', need('Rough')), ao: pick('AO') ? await get('ao', pick('AO')) : null };
  }
  // ambientCG: one zip with the Color / NormalGL / Roughness / AmbientOcclusion jpgs
  const url = `https://ambientcg.com/get?file=${t.sourceId}_1K-JPG.zip`, zip = await getFile(url, path.join(dir, `${t.sourceId}_1K-JPG.zip`), undefined, `${t.id} zip`);
  const ex = path.join(dir, 'unzipped');
  if (!fs.existsSync(ex)) execFileSync('unzip', ['-q', '-o', zip, '-d', ex]);
  const find = (s: string) => { const f = fs.readdirSync(ex).find(n => n.endsWith(`_${s}.jpg`)); if (!f) throw new Error(`${t.sourceId}: no ${s} in the zip`); return path.join(ex, f); };
  return { diff: find('Color'), nor: find('NormalGL'), rough: find('Roughness'), ao: fs.readdirSync(ex).some(n => n.endsWith('_AmbientOcclusion.jpg')) ? find('AmbientOcclusion') : null };
}

async function makeTexture(T: any, t: any) {
  const src: any = await fetchTexture(t);
  const sharp = T.sharp, rot = (t.rotate || 0) / 90;
  const prep = (img: Img) => flipV(rotCCW(img, rot));
  // ---- albedo → a luma detail map
  const diff = await readRaw(sharp, src.diff, 1024, 3);
  const N = diff.w * diff.h;
  let ao: Img | null = null;
  if (src.ao) ao = await readRaw(sharp, src.ao, 1024, 3);   // (an ARM map has the occlusion in R; a plain AO map is grey)
  const lum = new Float32Array(N), ratio = new Float32Array(N * 3);
  let sum = 0;
  for (let i = 0; i < N; i++) {
    const r = SRGB2LIN[diff.d[i * 3]], g = SRGB2LIN[diff.d[i * 3 + 1]], b = SRGB2LIN[diff.d[i * 3 + 2]];
    let y = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    const yy = Math.max(y, 1e-4);
    ratio[i * 3] = r / yy; ratio[i * 3 + 1] = g / yy; ratio[i * 3 + 2] = b / yy;
    if (ao) y *= Math.max(0.05, ao.d[i * 3] / 255) ** (t.ao ?? 0.6);   // cavity occlusion into the albedo (the shader has no aoMap in worldUV space)
    lum[i] = y; sum += y;
  }
  const mean = sum / N, k = t.contrast ?? 0.8, chroma = t.chroma ?? 0;
  const rMean = [0, 0, 0];
  for (let i = 0; i < N; i++) for (let q = 0; q < 3; q++) rMean[q] += ratio[i * 3 + q] / N;
  const out = new Float32Array(N * 3);
  let peak = 0;
  for (let i = 0; i < N; i++) {
    const y = mean * (Math.max(lum[i], 1e-4) / mean) ** k;
    for (let q = 0; q < 3; q++) { const v = y * (1 + chroma * (ratio[i * 3 + q] / rMean[q] - 1)); out[i * 3 + q] = v; if (v > peak) peak = v; }
  }
  // peak = 99.8th percentile of the brightest channel, so one specular fleck does not set the scale
  const sample: number[] = []; for (let i = 0; i < N; i += 7) sample.push(Math.max(out[i * 3], out[i * 3 + 1], out[i * 3 + 2]));
  sample.sort((a, b) => a - b); const p = sample[Math.floor(sample.length * 0.998)] || peak, scale = 1 / p;
  const enc = new Uint8Array(N * 3), meanLin = [0, 0, 0];
  for (let i = 0; i < N; i++) for (let q = 0; q < 3; q++) { const v = Math.min(1, out[i * 3 + q] * scale); meanLin[q] += v / N; enc[i * 3 + q] = lin2srgb(v); }
  const alb1024 = prep({ w: 1024, h: 1024, c: 3, d: enc });
  const alb512 = await (async () => {   // from the encoded 1024 (a 2 × 2 box on sRGB values is what a mip chain does too)
    const b = await sharp(Buffer.from(alb1024.d.buffer), { raw: { width: 1024, height: 1024, channels: 3 } }).resize(512, 512, { kernel: 'lanczos3' }).raw().toBuffer();
    return { w: 512, h: 512, c: 3, d: new Uint8Array(b) } as Img;
  })();
  const a1024 = writeHashed('tex', `${t.id}-albedo1k`, 'webp', await webp(sharp, alb1024.d, 1024, 1024, 3, t.albedoQuality ?? 78));
  const a512 = writeHashed('tex', `${t.id}-albedo`, 'webp', await webp(sharp, alb512.d, 512, 512, 3, t.albedoQuality ?? 78));

  // ---- normal (GL): resized, rotated (its vectors with it), strength applied, renormalised
  let nor = await readRaw(sharp, src.nor, 512, 3);
  const st = t.normal ?? 0.85;
  const nd = new Uint8Array(512 * 512 * 3);
  for (let i = 0; i < 512 * 512; i++) {
    let x = nor.d[i * 3] / 127.5 - 1, y = nor.d[i * 3 + 1] / 127.5 - 1, z = nor.d[i * 3 + 2] / 127.5 - 1;
    x *= st; y *= st;
    const l = Math.hypot(x, y, z) || 1;
    nd[i * 3] = Math.round((x / l * 0.5 + 0.5) * 255); nd[i * 3 + 1] = Math.round((y / l * 0.5 + 0.5) * 255); nd[i * 3 + 2] = Math.round((z / l * 0.5 + 0.5) * 255);
  }
  nor = { w: 512, h: 512, c: 3, d: nd };
  for (let n = 0; n < ((rot % 4) + 4) % 4; n++) {   // each CCW quarter turn takes the vector (x, y) to (-y, x)
    const o = new Uint8Array(nd.length); for (let i = 0; i < 512 * 512; i++) { o[i * 3] = 255 - nor.d[i * 3 + 1]; o[i * 3 + 1] = nor.d[i * 3]; o[i * 3 + 2] = nor.d[i * 3 + 2]; }
    nor = { ...nor, d: o };
  }
  nor = flipV(rotCCW(nor, rot));
  const normal = writeHashed('tex', `${t.id}-normal`, 'webp', await webp(sharp, nor.d, 512, 512, 3, t.normalQuality ?? 85));

  // ---- roughness: G (an ARM map keeps it there; a plain map is grey), as the grey the shader reads from G
  const rg = await readRaw(sharp, src.rough, 512, 3);
  const rd = new Uint8Array(512 * 512 * 3);
  const rs = t.rough ?? 1;
  const rmin = (t.roughMin ?? 0.25) * 255;   // a photographed roughness reaches 0.02 on glazed tile and varnish: with no environment to reflect that is a mirror, not a finish
  for (let i = 0; i < 512 * 512; i++) { const v = Math.max(rmin, Math.min(255, Math.round(rg.d[i * 3 + (src.armPacked ? 1 : 0)] * rs))); rd[i * 3] = v; rd[i * 3 + 1] = v; rd[i * 3 + 2] = v; }
  const rough = writeHashed('tex', `${t.id}-rough`, 'webp', await webp(sharp, flipV(rotCCW({ w: 512, h: 512, c: 3, d: rd }, rot)).d, 512, 512, 3, t.roughQuality ?? 70));

  const meanSrgbLuma = lin2srgb(0.2126 * meanLin[0] + 0.7152 * meanLin[1] + 0.0722 * meanLin[2]) / 255;
  return {
    kind: 'tex', id: t.id, source: t.source, sourceId: t.sourceId, authors: t.authors, periodM: t.periodM, kinds: t.kinds, tier: t.tier,
    files: { albedo: a512, albedo1k: a1024, normal, rough },
    meanLin: meanLin.map(v => +v.toFixed(5)), meanSrgb: +meanSrgbLuma.toFixed(4), normalScale: t.normalScale ?? 1,
    ...(t.followSet ? { followSet: t.followSet } : {}), ...(t.rotUV ? { rotUV: t.rotUV } : {}),
    ...(t.optOut ? { optOut: true } : {}),
  };
}

// ------------------------------------------------------------------------------------------------ models
async function fetchModel(m: any): Promise<string> {
  const f = await phFiles(m.sourceId);
  const g = f.gltf?.['1k']?.gltf;
  if (!g) throw new Error(`${m.sourceId}: no 1k glTF`);
  const dir = path.join(DL, 'polyhaven', m.sourceId);
  const gltf = await getFile(g.url, path.join(dir, path.basename(g.url)), g.md5, `${m.id} gltf`);
  for (const [rel, e] of Object.entries<any>(g.include || {})) await getFile(e.url, path.join(dir, rel), e.md5, `${m.id} ${rel}`);
  return gltf;
}

async function makeModel(T: any, m: any) {
  const gltfPath = await fetchModel(m);
  const { NodeIO } = T.core, { EXTMeshoptCompression, EXTTextureWebP, KHRMeshQuantization } = T.ext;
  const { dedup, prune, weld, quantize, meshopt, textureCompress, simplify, reorder, getBounds } = T.fn;
  await T.MeshoptEncoder.ready; await T.MeshoptDecoder.ready; await T.MeshoptSimplifier.ready;
  const io = new NodeIO().registerExtensions([EXTMeshoptCompression, EXTTextureWebP, KHRMeshQuantization]).registerDependencies({ 'meshopt.encoder': T.MeshoptEncoder, 'meshopt.decoder': T.MeshoptDecoder });
  const doc = await io.read(gltfPath);
  const root = doc.getRoot();
  const tris = () => root.listMeshes().flatMap((x: any) => x.listPrimitives()).reduce((a: number, p: any) => a + (p.getIndices()?.getCount() ?? 0) / 3, 0);
  const trisIn = Math.round(tris());
  const b0 = getBounds(root.getDefaultScene() || root.listScenes()[0]);
  const size = [b0.max[0] - b0.min[0], b0.max[1] - b0.min[1], b0.max[2] - b0.min[2]];
  const biggest = Math.max(...size);
  const texSize = m.texSize ?? (biggest < 0.4 ? 512 : 1024);
  const noNormal = m.dropNormal ?? biggest < 0.15;
  if (noNormal) for (const mat of root.listMaterials()) { mat.setNormalTexture(null); }
  const cap = m.maxTris ?? 4000;
  await doc.transform(
    dedup(), prune(), weld({ tolerance: 1e-4 }),
    ...(tris() > cap ? [simplify({ simplifier: T.MeshoptSimplifier, ratio: cap / tris(), error: m.simplifyError ?? 0.01, lockBorder: false })] : []),
    prune(),
    reorder({ encoder: T.MeshoptEncoder }),
    quantize({ quantizePosition: 14, quantizeNormal: 8, quantizeTexcoord: 12 }),
    textureCompress({ encoder: T.sharp, targetFormat: 'webp', resize: [texSize, texSize], quality: m.textureQuality ?? 78, slots: /./ }),
    meshopt({ encoder: T.MeshoptEncoder, level: 'high' }),
  );
  const glb = Buffer.from(await io.writeBinary(doc));
  const f = writeHashed('models', m.id, 'glb', glb);
  const trisOut = Math.round(tris());
  const jsonLen = glb.readUInt32LE(12), json = JSON.parse(glb.subarray(20, 20 + jsonLen).toString());
  return {
    kind: 'model', id: m.id, source: 'polyhaven', sourceId: m.sourceId, authors: m.authors, file: f.file, bytes: f.bytes, tris: trisOut, trisSource: trisIn,
    bbox: [...b0.min, ...b0.max].map((v: number) => +v.toFixed(4)), texSize, tier: m.tier, types: m.types, group: m.group, ext: json.extensionsUsed || [],
    ...(m.fit ? { fit: m.fit } : {}),
    ...(m.optOut ? { optOut: true } : {}),
  };
}

// ------------------------------------------------------------------------------------------------ the manifest
const MEDIA_TS = path.join(ROOT, 'assets', 'media-assets.ts');
function readPrevious(): Record<string, any> {
  try {
    const txt = fs.readFileSync(MEDIA_TS, 'utf8');
    const m = /export const MEDIA_ASSETS: Record<string, MediaAsset> = (\{[\s\S]*?\n\});\n/.exec(txt);
    return m ? JSON.parse(m[1]) : {};
  } catch { return {}; }
}

// THIRD_PARTY.md's rows for these files are generated from the same data, between the 'assets' markers, so the two cannot disagree
function writeThirdParty(all: Record<string, any>, list: any[]): void {
  const f = path.join(ROOT, 'THIRD_PARTY.md');
  const txt = fs.readFileSync(f, 'utf8');
  const BEGIN = '<!-- realism:assets:begin -->', END = '<!-- realism:assets:end -->';
  const i = txt.indexOf(BEGIN), j = txt.indexOf(END);
  if (i < 0 || j < i) { console.warn('THIRD_PARTY.md has no assets markers: rows not written'); return; }
  const kb = (n: number) => `${(n / 1024).toFixed(0)} KB`;
  const row = (a: any, e: any): string => {
    const src = `[${a.source === 'polyhaven' ? 'Poly Haven' : 'ambientCG'} · ${a.sourceId}](${a.pageUrl})`;
    const lic = `CC0 1.0 — [${new URL(a.licencePage).host}${new URL(a.licencePage).pathname}](${a.licencePage})`;
    const authors = a.authors.join('; ');
    if (a.kind === 'tex') {
      const files = Object.values<any>(a.files).map(x => `\`${x.file}\``).join(', ');
      const mod = `Albedo reduced to its luma${e.chroma ? ` (keeping ${Math.round(e.chroma * 100)}% of the local colour variation)` : ''} with contrast ${e.contrast ?? 0.8}, cavity occlusion baked in, renormalised to a known mean and written at 512 and 1024 px; normal map (GL) resized to 512 px at strength ${e.normal ?? 0.85} and re-normalised; roughness (G of the ARM map${a.source === 'ambientcg' ? ' / the Roughness map' : ''}) at 512 px, floor ${e.roughMin ?? 0.25}; flipped vertically${e.rotate ? ` and turned ${e.rotate}°` : ''}; all WebP. Replaces the procedural \`${a.kinds.join(', ')}\` set at ${a.periodM} m.`;
      return `| ${src} | ${lic} | ${authors} | ${files} | ${mod} |`;
    }
    const mod = `glTF 1k → meshopt-compressed GLB: welded, ${a.trisSource === a.tris ? 'not simplified' : `simplified from ${a.trisSource} to ${a.tris} triangles`}, positions quantized to 14 bits, textures WebP at ${a.texSize} px${a.texSize === 512 ? '' : ''}${e.fit ? '; scaled and placed at run time to the procedural prop it stands in for' : ''}. ${a.types.length ? `Stands in for \`${a.types.join(', ')}\`.` : 'Placed in the fruit bowl where the procedural fruit sat.'}`;
    return `| ${src} | ${lic} | ${authors} | \`${a.file}\` (${kb(a.bytes)}) | ${mod} |`;
  };
  const rows = list.filter(e => all[e.id]).map(e => row(all[e.id], e));
  const block = `${BEGIN}
The CC0 detail textures and props of the live player (\`assets/media/assets/**\`, listed in \`assets/media/assets/files.json\`, described by
\`assets/media-assets.ts\`; both written by \`pnpm run prep:assets\` from \`scripts/assets-sources.json\`, as is this table). **Licence
evidence.** Poly Haven: <https://polyhaven.com/license> (fetched 2026-10-01) states that every asset is CC0 and needs no credit; its
API (\`api.polyhaven.com/info/<id>\`) has no per-asset licence field, so the site-wide page and the authors it lists are recorded. ambientCG:
<https://docs.ambientcg.com/license/> (fetched 2026-10-01) states that every asset is CC0 1.0 Universal. The authors are recorded although no
credit is required. Poly Haven's API terms (a unique User-Agent, few calls) are followed by the prep script; nothing is scraped.

The decoder for the models (\`assets/vendor/three/libs/meshopt_decoder.module.js\`, meshoptimizer, MIT) is part of the three.js row under *Vendored*.

| Source | Licence | Authors | Files | Modification |
|---|---|---|---|---|
${rows.join('\n')}

Considered and not used: ${sources.dropped.map((d: any) => `\`${d.sourceId}\` (${d.why})`).join('; ')}.
${END}`;
  fs.writeFileSync(f, txt.slice(0, i) + block + txt.slice(j + END.length));
}

async function main() {
  bootstrap();
  const T: any = flag('fetch-only') ? null : await tools();
  const prev = readPrevious();
  const all: Record<string, any> = {};
  const list = [...sources.textures.map((x: any) => ({ ...x, _t: 'tex' })), ...sources.models.map((x: any) => ({ ...x, _t: 'model' }))];
  // a run with --only rewrites those ids and keeps every other id's previous entry (and its files)
  const redo = (id: string) => !only.size || only.has(id);
  if (!only.size) fs.rmSync(OUT, { recursive: true, force: true });
  else for (const id of only) { const p = prev[id]; if (p) for (const f of p.kind === 'tex' ? Object.values<any>(p.files).map(x => x.file) : [p.file]) fs.rmSync(path.join(OUT, f), { force: true }); }
  for (const e of list) {
    if (!redo(e.id)) { if (prev[e.id]) all[e.id] = prev[e.id]; continue; }
    say(`# ${e._t} ${e.id}  (${e.source} ${e.sourceId})`);
    if (flag('fetch-only')) { if (e._t === 'tex') await fetchTexture(e); else await fetchModel(e); continue; }
    const a: any = e._t === "tex" ? await makeTexture(T, e) : await makeModel(T, e);
    const lic = sources.licences[a.source];
    all[e.id] = { ...a, licence: lic.licence, licencePage: lic.licencePage, pageUrl: a.source === 'polyhaven' ? `https://polyhaven.com/a/${a.sourceId}` : `https://ambientcg.com/a/${a.sourceId}` };
    const bytes = a.kind === 'tex' ? Object.values<any>(a.files).reduce((s, x) => s + x.bytes, 0) : a.bytes;
    say(`  -> ${(bytes / 1024).toFixed(0)} KB${a.kind === 'model' ? `, ${a.tris} triangles (source ${a.trisSource}), ${a.texSize}px textures` : ''}`);
  }
  if (flag('fetch-only')) return;

  // ---- the budget and the two description files
  const files: string[] = [];
  let total = 0;
  for (const a of Object.values<any>(all)) for (const f of a.kind === 'tex' ? Object.values<any>(a.files) : [a]) { files.push(f.file); total += f.bytes; }
  const budget = sources.budgetBytes;
  say(`\n${files.length} files, ${(total / 1048576).toFixed(2)} MB of ${(budget / 1048576).toFixed(0)} MB`);
  if (total > budget) throw new Error(`assets/media/assets is ${total} bytes; the budget is ${budget}`);
  // a file on disk that no entry lists (an earlier run's) goes
  const keep = new Set(files);
  for (const d of ['tex', 'models']) for (const n of fs.existsSync(path.join(OUT, d)) ? fs.readdirSync(path.join(OUT, d)) : []) if (!keep.has(`${d}/${n}`)) fs.rmSync(path.join(OUT, d, n));
  fs.writeFileSync(path.join(OUT, 'files.json'), JSON.stringify({ about: 'the files assets/media-assets.ts lists; written by scripts/prep-assets.mts, checked by scripts/portal-assets.mts', files: files.sort() }, null, 2) + '\n');
  const ordered = Object.fromEntries(Object.keys(all).sort().map(k => [k, all[k]]));
  fs.writeFileSync(MEDIA_TS, `// GENERATED by scripts/prep-assets.mts (pnpm run prep:assets) from scripts/assets-sources.json: do not edit.
// The CC0 detail textures and props the live player loads lazily (assets/media/assets/**; assets/media-registry.ts reads this).
// Every file name carries the first 8 hex digits of its sha256; the portal build refuses a file that is not listed in
// assets/media/assets/files.json or whose name does not match its content.
export type MediaFile = { file: string; bytes: number };
export type ModelFit = {
  /** which direct children of the item the model replaces: all (default), the first N, or all from index N */
  hide?: 'all' | { first: number } | { from: number };
  mode?: 'box' | 'height' | 'width' | 'footprint';
  /** degrees about Y, or 'auto' = whichever quarter turn fits the measured box best */
  rotY?: number | 'auto';
  anchorY?: 'floor' | 'center'; anchorZ?: 'center' | 'back' | 'front';
  /** the relative error per gated axis (x, y, z) above which the prop stays procedural */
  tol?: number; gate?: ('x' | 'y' | 'z')[]; mul?: number; offset?: [number, number, number];
};
export type MediaTexture = {
  kind: 'tex'; id: string; source: string; sourceId: string; authors: string[]; periodM: number; kinds: string[]; tier: number;
  files: { albedo: MediaFile; albedo1k: MediaFile; normal: MediaFile; rough: MediaFile };
  /** the mean of the albedo map in linear light, per channel: the runtime tints the material by (the set it replaces) / this */
  meanLin: [number, number, number]; meanSrgb: number; normalScale: number; optOut?: boolean;
  /** the procedural set's period (m) this map's periodM was measured against: a finish tile of another size scales it */
  followSet?: number;
  /** degrees added to the material's own rotation (the kit lays its herringbone at 45°; the photograph is already a chevron) */
  rotUV?: number;
  licence: string; licencePage: string; pageUrl: string;
};
export type MediaModel = {
  kind: 'model'; id: string; source: string; sourceId: string; authors: string[]; file: string; bytes: number; tris: number; trisSource: number;
  /** metres, the model as the source made it: [minX, minY, minZ, maxX, maxY, maxZ] */
  bbox: [number, number, number, number, number, number]; texSize: number; tier: number; types: string[]; group?: string; ext: string[]; optOut?: boolean;
  /** how the model stands in for the procedural prop (scripts/assets-sources.json documents the fields) */
  fit?: ModelFit;
  licence: string; licencePage: string; pageUrl: string;
};
export type MediaAsset = MediaTexture | MediaModel;
export const MEDIA_ASSETS: Record<string, MediaAsset> = ${JSON.stringify(ordered, null, 1)};
`);
  writeThirdParty(ordered, list);
  fs.mkdirSync(path.join(CACHE, 'logs'), { recursive: true });
  fs.writeFileSync(path.join(CACHE, 'logs', 'last-run.txt'), log.join('\n') + '\n');
  say(`wrote ${path.relative(ROOT, MEDIA_TS)} and assets/media/assets/files.json`);
}
await main();
