#!/usr/bin/env -S node --experimental-strip-types
// R4: luma metrics of a rendered frame (plan 5.1; the definitions are the light-and-finish design's, scripts/metrics.py, so the
// numbers are comparable with the audit's), used by LIGHT's G1 and by the before/after reading of every stream.
//
//   clip    share of pixels with luma >= 0.97 (blown highlights, %)          lower is better
//   crush   share of pixels with luma <= 0.05 (crushed shadows, %)           lower is better
//   mean    mean luma, 0..1
//   p5 p50 p95 and range = p95 - p5 (tonal range)                            higher is better until it clips
//   ceil    mean luma of the top 12 % of the frame (the ceiling and upper-wall band)
//   cont    mean standard deviation of luma over 8 x 8 blocks (a flatness proxy: block contrast)
//   luma is display-referred: 0.2126 R + 0.7152 G + 0.0722 B of the sRGB bytes / 255, read from the final JPEG.
//
//   node --experimental-strip-types scripts/review/luma.mts <image...> [--json out.json]      a table for any images
//   node --experimental-strip-types scripts/review/luma.mts --manifest before.manifest.json --dir <dir> --out <file.json>   every frame of a set
//   node --experimental-strip-types scripts/review/luma.mts --compare before.metrics.json after.metrics.json [--gate light]   deltas, and LIGHT's acceptance
//
// Images are decoded by ffmpeg (rgb24 raw), the same decoder every run: the metrics are a pure function of the file's bytes.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { parseArgs, readJson, round, stableJson, writeText, rel, BASELINES } from './lib.mts';
import { loadManifest } from './manifest.mts';

export interface Luma { clip: number; crush: number; mean: number; p5: number; p50: number; p95: number; range: number; ceil: number; cont: number }

/** metrics of an interleaved RGB (3 bytes a pixel) frame */
export function lumaMetrics(rgb: Uint8Array, w: number, h: number): Luma {
  const n = w * h, y = new Float32Array(n);
  let sum = 0, clip = 0, crush = 0;
  for (let i = 0, j = 0; i < n; i++, j += 3) {
    const v = Math.fround(0.2126 * (rgb[j] / 255) + 0.7152 * (rgb[j + 1] / 255) + 0.0722 * (rgb[j + 2] / 255));
    y[i] = v; sum += v; if (v >= 0.97) clip++; if (v <= 0.05) crush++;
  }
  const sorted = Float32Array.from(y).sort();
  const pct = (p: number) => { const k = (n - 1) * p / 100, f = Math.floor(k), c = Math.min(f + 1, n - 1); return sorted[f] + (sorted[c] - sorted[f]) * (k - f); };   // linear interpolation, as numpy
  const topRows = Math.floor(h * 0.12);
  let top = 0; for (let i = 0; i < topRows * w; i++) top += y[i];
  const bh = Math.floor(h / 8), bw = Math.floor(w / 8);
  let blk = 0;
  for (let by = 0; by < bh; by++) for (let bx = 0; bx < bw; bx++) {
    let s = 0, s2 = 0;
    for (let yy = 0; yy < 8; yy++) { const o = (by * 8 + yy) * w + bx * 8; for (let xx = 0; xx < 8; xx++) { const v = y[o + xx]; s += v; s2 += v * v; } }
    const m = s / 64; blk += Math.sqrt(Math.max(0, s2 / 64 - m * m));
  }
  const p5 = pct(5), p95 = pct(95);
  return { clip: 100 * clip / n, crush: 100 * crush / n, mean: sum / n, p5, p50: pct(50), p95, range: p95 - p5, ceil: top / (topRows * w), cont: blk / (bh * bw) };
}
export const roundLuma = (m: Luma): Luma => Object.fromEntries(Object.entries(m).map(([k, v]) => [k, round(v as number, 5)])) as unknown as Luma;

/** decode an image file to RGB bytes with ffmpeg */
export function decode(file: string): { rgb: Uint8Array; w: number; h: number } {
  const p = spawnSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height', '-of', 'csv=p=0', file], { encoding: 'utf8' });
  const [w, h] = (p.stdout || '').trim().split(',').map(Number);
  if (p.status !== 0 || !w || !h) throw new Error(`ffprobe could not read ${file}: ${(p.stderr || '').trim()}`);
  const r = spawnSync('ffmpeg', ['-v', 'error', '-i', file, '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'], { maxBuffer: w * h * 3 + 1024 });
  if (r.status !== 0 || r.stdout.length !== w * h * 3) throw new Error(`ffmpeg could not decode ${file}`);
  return { rgb: new Uint8Array(r.stdout.buffer, r.stdout.byteOffset, r.stdout.length), w, h };
}
export const lumaOfFile = (file: string): Luma => { const { rgb, w, h } = decode(file); return lumaMetrics(rgb, w, h); };

// ---- LIGHT's acceptance (plan 5.2), read off two metric sets of the same cameras --------------------------------------------
export interface Row { check: string; frame: string; value: number; limit: string; ok: boolean }
type Metrics = Record<string, Luma>;
/** The thresholds of the plan's LIGHT acceptance that luma can judge, on the NW frames the thresholds were calibrated on:
 *  clip <= 1.0 on every dusk and night frame of the five bench rooms; night crush <= 12 (seraphine living) and <= 6 (cutestarter
 *  bedroom); ceiling luma >= 0.17 on the two worst night frames of BEFORE and >= 0.60 by day on aurora living and riverbend
 *  family room; day range (p95 - p5) at least +0.04 over BEFORE on aurora living, kitchen and cutestarter bedroom. */
export function lightAcceptance(before: Metrics, after: Metrics): Row[] {
  const rows: Row[] = [];
  const get = (m: Metrics, id: string) => m[id];
  const bench = ['aurora-living', 'aurora-primary-bedroom', 'aurora-kitchen', 'cutestarter-bedroom', 'seraphine-living'];
  for (const r of bench) for (const tod of ['dusk', 'night']) {
    const id = `${r}/NW/${tod}`, a = get(after, id); if (!a) continue;
    rows.push({ check: 'clip <= 1.0', frame: id, value: a.clip, limit: '1.0', ok: a.clip <= 1.0 });
  }
  for (const [r, lim] of [['seraphine-living', 12], ['cutestarter-bedroom', 6]] as const) {
    const id = `${r}/NW/night`, a = get(after, id); if (a) rows.push({ check: `night crush <= ${lim}`, frame: id, value: a.crush, limit: String(lim), ok: a.crush <= lim });
  }
  const nights = bench.map(r => `${r}/NW/night`).filter(id => get(before, id) && get(after, id)).sort((p, q) => before[p].ceil - before[q].ceil).slice(0, 2);
  for (const id of nights) rows.push({ check: 'night ceiling luma >= 0.17 (two worst of BEFORE)', frame: id, value: after[id].ceil, limit: '0.17', ok: after[id].ceil >= 0.17 });
  for (const r of ['aurora-living', 'riverbend-family-room']) { const id = `${r}/NW/day`, a = get(after, id); if (a) rows.push({ check: 'day ceiling luma >= 0.60', frame: id, value: a.ceil, limit: '0.60', ok: a.ceil >= 0.60 }); }
  for (const r of ['aurora-living', 'aurora-kitchen', 'cutestarter-bedroom']) {
    const id = `${r}/NW/day`, a = get(after, id), b = get(before, id);
    if (a && b) rows.push({ check: 'day range gain >= +0.04', frame: id, value: a.range - b.range, limit: '+0.04', ok: a.range - b.range >= 0.04 });
  }
  return rows;
}

function table(rows: Array<{ name: string; m: Luma }>) {
  console.log(`${'frame'.padEnd(46)} ${'clip%'.padStart(6)} ${'crush%'.padStart(6)} ${'mean'.padStart(5)} ${'p5'.padStart(5)} ${'p50'.padStart(5)} ${'p95'.padStart(5)} ${'range'.padStart(5)} ${'ceil'.padStart(5)} ${'cont'.padStart(5)}`);
  for (const { name, m } of rows) console.log(`${name.slice(0, 46).padEnd(46)} ${m.clip.toFixed(2).padStart(6)} ${m.crush.toFixed(2).padStart(6)} ${m.mean.toFixed(3).padStart(5)} ${m.p5.toFixed(3).padStart(5)} ${m.p50.toFixed(3).padStart(5)} ${m.p95.toFixed(3).padStart(5)} ${m.range.toFixed(3).padStart(5)} ${m.ceil.toFixed(3).padStart(5)} ${m.cont.toFixed(3).padStart(5)}`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = parseArgs(process.argv.slice(2));
  if (args.compare) {
    const files = process.argv.slice(2).filter(a => !a.startsWith('--') && a.endsWith('.json'));
    const [bf, af] = files; if (!bf || !af) { console.error('--compare before.metrics.json after.metrics.json'); process.exit(2); }
    const B = readJson(bf).frames as Metrics, A = readJson(af).frames as Metrics;
    console.log(`${'frame'.padEnd(46)}  clip% (b > a)    crush%         ceil           range`);
    for (const id of Object.keys(B)) if (A[id]) console.log(`${id.padEnd(46)}  ${B[id].clip.toFixed(2)} > ${A[id].clip.toFixed(2)}   ${B[id].crush.toFixed(2)} > ${A[id].crush.toFixed(2)}   ${B[id].ceil.toFixed(3)} > ${A[id].ceil.toFixed(3)}   ${B[id].range.toFixed(3)} > ${A[id].range.toFixed(3)}`);
    if (args.gate === 'light') {
      const rows = lightAcceptance(B, A);
      console.log('\nLIGHT acceptance (plan 5.2, luma part)');
      for (const r of rows) console.log(`  ${r.ok ? '✓' : '✗'} ${r.check.padEnd(50)} ${r.frame.padEnd(34)} ${r.value.toFixed(3)} (limit ${r.limit})`);
      const bad = rows.filter(r => !r.ok).length; console.log(bad ? `${bad} of ${rows.length} failed` : `all ${rows.length} pass`); process.exit(bad ? 1 : 0);
    }
  } else if (args.manifest) {
    const m = loadManifest(path.resolve(args.manifest)), dir = path.resolve(args.dir);
    const frames: Metrics = {}, listing: Array<{ name: string; m: Luma }> = [];
    for (const s of m.shots.filter(s => s.kind === 'eye')) { const lm = roundLuma(lumaOfFile(path.join(dir, s.file))); frames[s.id] = lm; listing.push({ name: s.id, m: lm }); }
    table(listing);
    const out = args.out && args.out !== 'true' ? path.resolve(args.out) : path.join(BASELINES, 'before.metrics.json');
    writeText(out, stableJson({ schema: 1, what: 'luma metrics (scripts/review/luma.mts) of the eye frames of a review set, from the JPEGs the manifest hashes', set: m.set, definitions: { clip: '% of pixels with luma >= 0.97', crush: '% of pixels with luma <= 0.05', mean: 'mean luma', p5: '5th percentile', p50: 'median', p95: '95th percentile', range: 'p95 - p5', ceil: 'mean luma of the top 12 % rows', cont: 'mean std of 8x8 block luma' }, frames }));
    console.log(`→ ${rel(out)} (${Object.keys(frames).length} frames)`);
  } else {
    const files = process.argv.slice(2).filter(a => !a.startsWith('--') && !(args.json && a === args.json));
    const listing = files.map(f => ({ name: path.basename(f), m: lumaOfFile(f) }));
    table(listing);
    if (args.json && args.json !== 'true') writeText(args.json, stableJson(listing.map(r => ({ file: r.name, ...roundLuma(r.m) }))));
  }
}
