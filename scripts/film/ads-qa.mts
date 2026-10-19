// The persona cut's gates: what a finished mp4 must be before it is kept. ffprobe for the streams, the size, the frame rate, the frame count and the length;
// freezedetect for a picture that stopped; blackdetect for a dark frame (a cut is daylight, and its dips are chalk); the pixels of the first and last frame for a
// blank render. Needs ffmpeg and ffprobe. A film (scripts/film/qa.mts) and a cut share nothing but the idea: a cut has no audio to measure and no title card to forgive. Owner: ad-kit.
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
import type { AudioMode } from './ads-encode.mts';
import { CUT } from '../../assets/story/film/cut/plan.js';

const run = (cmd: string, args: string[], opts: any = {}) => spawnSync(cmd, args, { encoding: 'utf8', maxBuffer: 256 << 20, ...opts });
export const MAX_BYTES = 60 * 1024 * 1024, WARN_BYTES = 25 * 1024 * 1024;
/** a frame whose luma spread (0 to 255) is under this has nothing in it */
export const BLANK_STD = 3;
export const FREEZE_ERR_S = 2.5, FREEZE_WARN_S = 1.5, DURATION_TOL_S = 0.1;

export type Probe = {
  duration: number; bytes: number; streams: number; stderr: string;
  video: { codec: string; profile: string; w: number; h: number; fps: number; frames: number; pix: string; colorSpace: string | null } | null;
  audio: { codec: string; rate: number; channels: number } | null;
};
export function probe(file: string): Probe {
  const r = run('ffprobe', ['-v', 'error', '-count_packets', '-show_streams', '-show_format', '-of', 'json', file]);
  if (r.status !== 0) throw new Error(`ffprobe failed on ${file}: ${String(r.stderr).slice(-200)}`);
  const j = JSON.parse(r.stdout), v = j.streams.find((s: any) => s.codec_type === 'video'), a = j.streams.find((s: any) => s.codec_type === 'audio');
  const rate = (x: string) => { const [n, d] = String(x).split('/').map(Number); return d ? n / d : n; };
  return {
    duration: Number(j.format.duration), bytes: fs.statSync(file).size, streams: j.streams.length, stderr: String(r.stderr),
    video: v ? { codec: v.codec_name, profile: v.profile, w: v.width, h: v.height, fps: rate(v.r_frame_rate), frames: Number(v.nb_read_packets ?? v.nb_frames), pix: v.pix_fmt, colorSpace: v.color_space || null } : null,
    audio: a ? { codec: a.codec_name, rate: Number(a.sample_rate), channels: a.channels } : null,
  };
}
type Span = [number, number];
function spans(file: string, vf: string, key: 'freeze' | 'black'): Span[] {
  const r = run('ffmpeg', ['-hide_banner', '-nostdin', '-an', '-i', file, '-vf', vf, '-f', 'null', '-']);
  const out = `${r.stdout}${r.stderr}`, found: Span[] = []; let open: number | null = null;
  const re = key === 'freeze' ? /freeze_(start|end):\s*(-?[\d.]+)/g : /black_(start|end):\s*(-?[\d.]+)/g;
  for (const m of out.matchAll(re)) { const v = Number(m[2]); if (m[1] === 'start') open = v; else if (open !== null) { found.push([open, v]); open = null; } }
  if (open !== null) found.push([open, Infinity]);
  return found;
}
export const freezes = (file: string): Span[] => spans(file, 'freezedetect=n=0.001:d=1.5', 'freeze');
export const blacks = (file: string): Span[] => spans(file, 'blackdetect=d=0.1:pix_th=0.12', 'black');

/** the luma spread (standard deviation, 0 to 255) of the first and the last frame of an encoded file: a render that came out blank encodes to a flat picture */
export function edgeSpread(file: string, frames: number): { first: number; last: number } {
  const r = run('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-nostdin', '-i', file, '-vf', `select='eq(n\\,0)+eq(n\\,${frames - 1})',scale=64:64,format=gray`, '-vsync', '0', '-f', 'rawvideo', '-'], { encoding: 'buffer' });
  const b = r.stdout as unknown as Buffer, n = 64 * 64, std = (o: number) => { let s = 0, q = 0; for (let i = 0; i < n; i++) { const v = b[o + i] ?? 0; s += v; q += v * v; } const m = s / n; return Math.sqrt(Math.max(0, q / n - m * m)); };
  return b.length >= 2 * n ? { first: std(0), last: std(n) } : { first: b.length >= n ? std(0) : 0, last: 0 };
}

export type Expect = { w: number; h: number; fps: number; frames: number; durationS: number; audio: AudioMode };
export type Report = { errors: string[]; warnings: string[]; probe: Probe; freezes: Span[]; blacks: Span[]; spread: { first: number; last: number } };

export function gate(file: string, e: Expect): Report {
  const errors: string[] = [], warnings: string[] = [], p = probe(file);
  const wantStreams = e.audio === 'silent' ? 2 : 1;
  if (p.streams !== wantStreams || !p.video) errors.push(`expected ${wantStreams} stream${wantStreams > 1 ? 's' : ''} (one H.264 video${e.audio === 'silent' ? ' and one silent AAC' : ', no audio'}), found ${p.streams}`);
  if (p.stderr.trim()) errors.push(`ffprobe is not clean: ${p.stderr.trim().slice(0, 120)}`);
  if (p.video) {
    if (p.video.codec !== 'h264') errors.push(`video is ${p.video.codec}, not h264`);
    if (p.video.pix !== 'yuv420p') errors.push(`pixel format ${p.video.pix}, not yuv420p`);
    if (p.video.w !== e.w || p.video.h !== e.h) errors.push(`picture is ${p.video.w}x${p.video.h}, not ${e.w}x${e.h}`);
    if (Math.abs(p.video.fps - e.fps) > 0.01) errors.push(`${p.video.fps} fps, not ${e.fps}`);
    if (p.video.frames !== e.frames) errors.push(`${p.video.frames} frames, not ${e.frames}`);
  }
  if (e.audio === 'silent' && p.audio) { if (p.audio.codec !== 'aac' || p.audio.rate !== 48000 || p.audio.channels !== 2) errors.push(`the silent track is ${p.audio.codec} ${p.audio.rate} Hz x${p.audio.channels}, not aac 48000 Hz x2`); }
  if (e.audio === 'none' && p.audio) errors.push('the file has an audio stream, and a cut is silent by default');
  if (Math.abs(p.duration - e.durationS) > DURATION_TOL_S) errors.push(`length ${p.duration.toFixed(2)} s, not ${e.durationS.toFixed(2)} s (within ${DURATION_TOL_S} s)`);
  if (p.duration < CUT.minS - DURATION_TOL_S || p.duration > CUT.maxS + DURATION_TOL_S) errors.push(`length ${p.duration.toFixed(1)} s is outside ${CUT.minS} to ${CUT.maxS} s`);
  if (p.bytes > MAX_BYTES) errors.push(`${(p.bytes / 1048576).toFixed(1)} MiB is over ${(MAX_BYTES / 1048576).toFixed(0)} MiB`);
  else if (p.bytes > WARN_BYTES) warnings.push(`${(p.bytes / 1048576).toFixed(1)} MiB is large for a 25 s ad`);
  const fr = freezes(file);
  for (const [s, en] of fr) { const len = (Number.isFinite(en) ? en : p.duration) - s; if (len >= FREEZE_ERR_S) errors.push(`the picture is frozen for ${len.toFixed(1)} s at ${s.toFixed(1)} s`); else if (len >= FREEZE_WARN_S) warnings.push(`the picture holds still for ${len.toFixed(1)} s at ${s.toFixed(1)} s`); }
  const bl = blacks(file);
  for (const [s, en] of bl) errors.push(`a dark picture for ${((Number.isFinite(en) ? en : p.duration) - s).toFixed(2)} s at ${s.toFixed(2)} s (a cut is daylight; its dips are chalk)`);
  const spread = edgeSpread(file, e.frames);
  if (spread.first < BLANK_STD) errors.push(`the first frame is blank (spread ${spread.first.toFixed(1)})`);
  if (spread.last < BLANK_STD) errors.push(`the last frame is blank (spread ${spread.last.toFixed(1)})`);
  return { errors, warnings, probe: p, freezes: fr, blacks: bl, spread };
}
