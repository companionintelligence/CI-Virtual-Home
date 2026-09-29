#!/usr/bin/env -S node --experimental-strip-types
// The editor's pure UI modules (assets/ui/), in Node: the MP4 and WebM writers the Record button uses, checked by
// ffprobe and ffmpeg against streams libx264 and libvpx made themselves, and the timeline / plan / URL / size helpers.
// @check-house node-test
// @check-house quick
//
//   node --experimental-strip-types --test scripts/test-ui-units.mts        (needs `pnpm run build`; ffmpeg for the muxers)
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { muxMp4, mp4Boxes, mp4Summary, frameTicks } from '../assets/ui/mp4-mux.js';
import { muxWebm } from '../assets/ui/webm-mux.js';
import { avcCodecFor, bitrateFor } from '../assets/ui/recorder.js';
import { exportSize, downloadName, stamp, fmtClock, v1Phases, trackRates, shotLabel } from '../assets/ui/format.js';
import { readUiState, stateSearch } from '../assets/ui/url-state.js';
import { collectIssues, qaCounts } from '../assets/ui/qa.js';
import { createUndo } from '../assets/ui/undo.js';
import { storeyOf, levelAt } from '../assets/ui/plan-inset.js';
import { posterKey, sheetLayout } from '../assets/ui/compare.js';

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'vh-ui-'));
const has = (bin: string) => spawnSync(bin, ['-version'], { stdio: 'ignore' }).status === 0;
const FFMPEG = has('ffmpeg') && has('ffprobe');
const run = (bin: string, args: string[]) => { const r = spawnSync(bin, args, { encoding: 'utf8', maxBuffer: 64 << 20 }); if (r.status !== 0) throw new Error(`${bin} ${args.join(' ')}\n${r.stderr}`); return r.stdout; };
const probe = (file: string) => JSON.parse(run('ffprobe', ['-v', 'error', '-count_frames', '-show_streams', '-show_format', '-of', 'json', file]));
const framemd5 = (file: string) => run('ffmpeg', ['-v', 'error', '-i', file, '-f', 'framemd5', '-']).split('\n').filter(l => l && !l.startsWith('#')).map(l => l.split(',').pop()!.trim());

// ---- H.264: an Annex B stream (one AUD per access unit) → length-prefixed samples + avcC ------------------------
function nalUnits(buf: Uint8Array): Uint8Array[] {
  const marks: Array<[number, number]> = [];   // [where the start code begins, where the NAL unit begins]
  for (let i = 0; i + 2 < buf.length; i++) {
    if (buf[i] === 0 && buf[i + 1] === 0 && buf[i + 2] === 1) { marks.push([i > 0 && buf[i - 1] === 0 ? i - 1 : i, i + 3]); i += 2; }
  }
  return marks.map(([, s], k) => buf.subarray(s, k + 1 < marks.length ? marks[k + 1][0] : buf.length));
}
function annexBToSamples(buf: Uint8Array, fps: number) {
  let sps: Uint8Array | null = null, pps: Uint8Array | null = null;
  const aus: Uint8Array[][] = [];
  for (const n of nalUnits(buf)) {
    const t = n[0] & 0x1f;
    if (t === 9) { aus.push([]); continue; }
    if (t === 7) { sps = sps || n; continue; }
    if (t === 8) { pps = pps || n; continue; }
    if (!aus.length) aus.push([]);
    aus[aus.length - 1].push(n);
  }
  const samples = aus.filter(a => a.length).map((au, i) => {
    const len = au.reduce((a, n) => a + 4 + n.length, 0), data = new Uint8Array(len);
    let o = 0;
    for (const n of au) { new DataView(data.buffer).setUint32(o, n.length); data.set(n, o + 4); o += 4 + n.length; }
    return { data, key: au.some(n => (n[0] & 0x1f) === 5), pts: Math.round(i * 1e6 / fps) };
  });
  const avcC = Uint8Array.from([1, sps![1], sps![2], sps![3], 0xff, 0xe1, sps!.length >> 8, sps!.length & 0xff, ...sps!, 1, pps!.length >> 8, pps!.length & 0xff, ...pps!]);
  return { samples, avcC };
}

test('frameTicks: whole 90 kHz ticks for the usual rates, a clear error otherwise', () => {
  assert.deepEqual([24, 25, 30, 50, 60].map(frameTicks), [3750, 3600, 3000, 1800, 1500]);
  assert.throws(() => frameTicks(7), /no whole 90 kHz/);
});

test('avcCodecFor picks a High-profile level that holds the film; bitrateFor has a floor', () => {
  assert.equal(avcCodecFor(1920, 1080, 60)[0], 'avc1.64002a');
  assert.equal(avcCodecFor(1920, 1080, 30)[0], 'avc1.640028');
  assert.equal(avcCodecFor(3840, 2160, 60)[0], 'avc1.640034');
  assert.equal(avcCodecFor(640, 360, 30)[0], 'avc1.64001f');
  assert.equal(bitrateFor(640, 360, 30), 20e6);
  assert.equal(bitrateFor(3840, 2160, 60), 80e6);
});

test('muxMp4 writes a file ffprobe reads as the frames it was given, and they decode bit for bit', { skip: !FFMPEG && 'no ffmpeg/ffprobe' }, () => {
  const fps = 30, n = 45;
  const raw = path.join(TMP, 'src.h264');
  run('ffmpeg', ['-v', 'error', '-y', '-f', 'lavfi', '-i', `testsrc2=size=320x240:rate=${fps}`, '-frames:v', String(n), '-c:v', 'libx264', '-profile:v', 'main', '-bf', '0', '-g', '15', '-x264-params', 'aud=1', '-f', 'h264', raw]);
  const { samples, avcC } = annexBToSamples(new Uint8Array(fs.readFileSync(raw)), fps);
  assert.equal(samples.length, n);
  const mp4 = muxMp4({ width: 320, height: 240, fps, avcC, samples, colour: { primaries: 'bt709', transfer: 'bt709', matrix: 'bt709', fullRange: false } });
  const file = path.join(TMP, 'out.mp4'); fs.writeFileSync(file, mp4);
  // the file's own account of itself
  assert.deepEqual(mp4Boxes(mp4).map(b => b.type), ['ftyp', 'moov', 'mdat']);
  const sum = mp4Summary(mp4);
  assert.deepEqual(sum, { samples: n, duration: n / fps, keyframes: 3, fps, width: 320, height: 240 });
  // ffprobe's
  const p = probe(file), v = p.streams[0];
  assert.equal(v.codec_name, 'h264');
  assert.equal(Number(v.nb_read_frames), n);
  assert.equal(v.r_frame_rate, `${fps}/1`);
  assert.ok(Math.abs(Number(p.format.duration) - n / fps) < 1e-3, `duration ${p.format.duration}`);
  assert.equal(v.color_primaries, 'bt709');
  // and every frame decodes to what the raw stream decodes to
  assert.deepEqual(framemd5(file), framemd5(raw));
  // deterministic: the same samples, the same bytes
  assert.deepEqual(muxMp4({ width: 320, height: 240, fps, avcC, samples }), muxMp4({ width: 320, height: 240, fps, avcC, samples }));
});

test('muxMp4 writes composition offsets when an encoder reorders frames', { skip: !FFMPEG && 'no ffmpeg/ffprobe' }, () => {
  const fps = 30, raw = path.join(TMP, 'src.h264');
  if (!fs.existsSync(raw)) return;
  const { samples, avcC } = annexBToSamples(new Uint8Array(fs.readFileSync(raw)), fps);
  // pretend frames 1 and 2 were emitted in the other order (a B-frame): pts no longer follows decode order
  const swapped = samples.map((s, i) => ({ ...s, pts: i === 1 ? samples[2].pts : i === 2 ? samples[1].pts : s.pts }));
  const mp4 = muxMp4({ width: 320, height: 240, fps, avcC, samples: swapped });
  const stbl = mp4Boxes(mp4)[1].children![1].children!.find(b => b.type === 'mdia')!.children!.find(b => b.type === 'minf')!.children!.find(b => b.type === 'stbl')!;
  assert.ok(stbl.children!.some(b => b.type === 'ctts'), 'ctts written');
  const file = path.join(TMP, 'ctts.mp4'); fs.writeFileSync(file, mp4);
  assert.equal(Number(probe(file).streams[0].nb_read_frames), samples.length);
});

test('muxWebm writes a VP9 file ffprobe reads as the frames it was given, and they decode bit for bit', { skip: !FFMPEG && 'no ffmpeg/ffprobe' }, () => {
  const fps = 30, n = 40, ivf = path.join(TMP, 'src.ivf');
  run('ffmpeg', ['-v', 'error', '-y', '-f', 'lavfi', '-i', `testsrc2=size=320x240:rate=${fps}`, '-frames:v', String(n), '-c:v', 'libvpx-vp9', '-b:v', '1M', '-g', '15', '-auto-alt-ref', '0', '-lag-in-frames', '0', '-f', 'ivf', ivf]);
  const buf = new Uint8Array(fs.readFileSync(ivf)), dv = new DataView(buf.buffer, buf.byteOffset);
  const samples: Array<{ data: Uint8Array; key: boolean; pts: number }> = [];
  for (let p = dv.getUint16(6, true), i = 0; p + 12 <= buf.length; i++) {
    const size = dv.getUint32(p, true), data = buf.slice(p + 12, p + 12 + size);
    samples.push({ data, key: (data[0] & 0x04) === 0 && i % 15 === 0, pts: Math.round(i * 1e6 / fps) });   // VP9: frame_type bit 0 = key
    p += 12 + size;
  }
  assert.equal(samples.length, n);
  const webm = muxWebm({ width: 320, height: 240, fps, samples });
  const file = path.join(TMP, 'out.webm'); fs.writeFileSync(file, webm);
  const p = probe(file), v = p.streams[0];
  assert.equal(v.codec_name, 'vp9');
  assert.equal(Number(v.nb_read_frames), n);
  assert.ok(Math.abs(Number(p.format.duration) - n / fps) < 0.02, `duration ${p.format.duration}`);
  assert.deepEqual(framemd5(file), framemd5(ivf));
});

test('exportSize: the short side as asked, the long side capped at 3840, both even', () => {
  assert.deepEqual(exportSize(2160, '16:9'), { w: 3840, h: 2160 });
  assert.deepEqual(exportSize(2160, '9:16'), { w: 2160, h: 3840 });
  assert.deepEqual(exportSize(1080, '9:16'), { w: 1080, h: 1920 });
  assert.deepEqual(exportSize(2160, '1:1'), { w: 2160, h: 2160 });
  assert.deepEqual(exportSize(2160, '4:3'), { w: 2880, h: 2160 });
  assert.deepEqual(exportSize(2160, '21:9'), { w: 3840, h: 1646 });
  assert.deepEqual(exportSize(1440, '16:9'), { w: 2560, h: 1440 });
});

test('download names: no colons, the time of day in them', () => {
  const d = new Date(2026, 8, 28, 9, 5, 7);
  assert.equal(stamp(d), '20260928-090507');
  assert.equal(downloadName({ house: 'aurora', shot: 'door-to-core', tod: 'golden', date: d, ext: 'mp4' }), 'aurora-door-to-core-golden-20260928-090507.mp4');
  assert.equal(downloadName({ house: 'house:Weird Name!', shot: 'still', tod: null, date: d, ext: 'png', extra: '3840x2160' }), 'house-weird-name-still-3840x2160-20260928-090507.png');
  assert.equal(fmtClock(4.25), '0:04.25');
  assert.equal(fmtClock(75.5), '1:15.50');
  assert.equal(shotLabel('door-to-core'), 'Door to Core');
  assert.equal(shotLabel('door-to-core', 'front-door'), 'Front door');
});

test('v1 phases come from the shot\'s own structure, and the track rates from its samples', () => {
  const ph = v1Phases('door-to-core', { orbit: { t0: 0.8, tIn: 0.7 } }, { duration: 12, events: { enterT: 3 } });
  assert.deepEqual(ph.map(p => [p.name, +p.t0.toFixed(3), +p.t1.toFixed(3)]), [['outside', 0, 0.25], ['inside', 0.25, 0.7], ['push-in', 0.7, 0.8], ['orbit', 0.8, 1]]);
  assert.ok(ph.every(p => p.derived));
  assert.deepEqual(v1Phases('orbit', {}, null).map(p => p.name), ['orbit']);
  // a straight line at 2 m/s, turning at 90°/s
  const n = 121, dt = 1 / 120, pos = new Float32Array(3 * n), look = new Float32Array(3 * n);
  for (let i = 0; i < n; i++) { const t = i * dt, a = t * Math.PI / 2; pos[3 * i] = 2 * t; look[3 * i] = 2 * t + Math.sin(a); look[3 * i + 2] = Math.cos(a); }
  const r = trackRates({ samples: n, dt, pos, look });
  assert.ok(Math.abs(r.speed[60] - 2) < 1e-3, `speed ${r.speed[60]}`);
  assert.ok(Math.abs(r.yaw[60] - 90) < 0.5, `yaw ${r.yaw[60]}`);
});

test('the URL state round-trips and keeps every other parameter', () => {
  const q = stateSearch('?res=1080&house=aurora&tone=agx', { shot: 'orbit', t: 0.41234, lighting: 'dusk', mode: 'review' });
  assert.equal(q, '?house=aurora&shot=orbit&t=0.412&lighting=dusk&mode=review&res=1080&tone=agx');
  assert.deepEqual(readUiState(q), { house: 'aurora', shot: 'orbit', t: 0.412, lighting: 'dusk', mode: 'review' });
  assert.equal(stateSearch(q, { t: null, lighting: '' }), '?house=aurora&shot=orbit&mode=review&res=1080&tone=agx');
  assert.equal(readUiState('?mode=view').mode, null);
  assert.equal(readUiState('?t=7').t, 1);
});

test('QA findings: errors first, the counts, a failed gate is an error', () => {
  const issues = collectIssues({ scene: { errors: [], warnings: [{ code: 'planting-grid', message: 'grid' }] }, shots: { 'door-to-core': { errors: [{ code: 'wall-clip', t: 0.4, tEnd: 0.41, message: 'm' }], warnings: [{ code: 'core-small', t: 1, message: 'n' }] }, orbit: { failed: 'boom' } } });
  assert.deepEqual(issues.map(i => `${i.level}:${i.code}`), ['error:wall-clip', 'error:qa-failed', 'warn:planting-grid', 'warn:core-small']);
  assert.deepEqual(qaCounts(issues), { errors: 2, warnings: 2 });
});

test('undo and redo', () => {
  let v = 0, dropped = 0;
  const seen: boolean[] = [];
  const u = createUndo({ onChange: s => seen.push(s.canUndo) });
  u.push({ label: 'a', undo: () => { v = 0; }, redo: () => { v = 1; } }); v = 1;
  u.push({ label: 'b', undo: () => { v = 1; }, redo: () => { v = 2; }, drop: () => { dropped++; } }); v = 2;
  assert.equal(u.undo()!.label, 'b'); assert.equal(v, 1);
  assert.equal(u.redo()!.label, 'b'); assert.equal(v, 2);
  u.undo(); u.push({ label: 'c', undo: () => {}, redo: () => {} });
  assert.equal(dropped, 1, 'a new step drops what could be redone');
  assert.equal(u.redo(), null);
  assert.ok(seen.length >= 5);
});

test('the plan inset\'s storey: by height over the house, the entry\'s outside it', () => {
  const spec = { entry: { level: 'l1' }, levels: [{ id: 'l1', y: 0, height: 2.8, footprint: [{ x: -5, z: -4, w: 10, d: 8 }] }, { id: 'l2', y: 2.8, height: 2.7, footprint: [{ x: -5, z: -4, w: 10, d: 8 }] }] };
  assert.equal(storeyOf(spec, [0, 4.2, 0]), 1);
  assert.equal(storeyOf(spec, [0, 1.5, 0]), 0);
  assert.equal(storeyOf(spec, [0, 9, 12]), 0, 'an establishing shot high over the lawn is at the entry');
  assert.equal(levelAt(spec.levels, 2.6), 1);
});

test('compare: a poster is cached by home, shot, moment and light — and by nothing else', () => {
  const o = { shot: 'orbit', t: 0.55, lighting: 'auto' };
  assert.equal(posterKey('aurora', o), posterKey('aurora', { ...o, t: 0.5500001 }), 'a moment is rounded to a thousandth');
  for (const other of [posterKey('mirage', o), posterKey('aurora', { ...o, shot: 'hero-reveal' }), posterKey('aurora', { ...o, t: 0.56 }), posterKey('aurora', { ...o, lighting: 'dusk' })]) assert.notEqual(other, posterKey('aurora', o));
});

test('compare: the sheet is a grid of cells with a caption band, and every cell is inside it', () => {
  const L = sheetLayout(30, 5, 384, 216, 34, 14);
  assert.equal(L.w, 14 + 5 * (384 + 14));
  assert.equal(L.h, 14 + 6 * (216 + 34 + 14));
  const last = L.cell(29);
  assert.ok(last.x + 384 <= L.w - 14 + 1e-9 && last.y + 216 + 34 <= L.h - 14 + 1e-9, 'the last cell and its caption end inside the margin');
  assert.deepEqual(L.cell(0), { x: 14, y: 14 });
  assert.deepEqual(L.cell(7), { x: 14 + 2 * 398, y: 14 + 264 });
  assert.equal(sheetLayout(2, 3, 384, 216, 34, 14).h, 14 + 264, 'two posters are one row');
});

test.after(() => fs.rmSync(TMP, { recursive: true, force: true }));
