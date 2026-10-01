// The film's gates: what a finished mp4 must be before it is kept. About sixty lines of the logic in CI-Common's video-kit (loudness.ts, pacing.ts), lifted
// and not imported (the kit is not a dependency of this repo): ffprobe for the streams and the length, silencedetect for dead air, freezedetect for a
// picture that stopped, ebur128 for the loudness a listener's device decodes. Every string returned is a reason the film fails; `warnings` are printed.
// Needs ffmpeg and ffprobe. Owner: video-tool.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import { WEB_MAX_BYTES, sizeGuard } from './lib.mts';
import { measure, TARGET } from './mux.mts';
import { FILM } from '../../assets/story/film/layout.js';

const run = (cmd: string, args: string[]) => spawnSync(cmd, args, { encoding: 'utf8', maxBuffer: 64 << 20 });
/** the kit's silence threshold (`silencedetect=n=-45dB`) and a window that still sees a half-second breath */
export const SILENCE_DB = -45;
/** a silence this long, anywhere but the title card and the tail of the end card, is dead air */
export const DEAD_AIR_S = 2.0;
export const WARN_AIR_S = 1.25;
export const FREEZE_S = 2.0;
export const LOUDNESS_TOL_LU = 1.0;

export type Span = [number, number];
export type Probe = { duration: number; bytes: number; video: { codec: string; w: number; h: number; fps: number; frames: number; pix: string } | null; audio: { codec: string; rate: number; channels: number } | null; streams: number };

export function probe(file: string): Probe {
  const r = run('ffprobe', ['-v', 'error', '-count_packets', '-show_streams', '-show_format', '-of', 'json', file]);
  if (r.status !== 0) throw new Error(`ffprobe failed on ${file}: ${r.stderr.slice(-200)}`);
  const j = JSON.parse(r.stdout), v = j.streams.find((s: any) => s.codec_type === 'video'), a = j.streams.find((s: any) => s.codec_type === 'audio');
  const rate = (x: string) => { const [n, d] = String(x).split('/').map(Number); return d ? n / d : n; };
  return {
    duration: Number(j.format.duration), bytes: fs.statSync(file).size, streams: j.streams.length,
    video: v ? { codec: v.codec_name, w: v.width, h: v.height, fps: rate(v.r_frame_rate), frames: Number(v.nb_read_packets ?? v.nb_frames), pix: v.pix_fmt } : null,
    audio: a ? { codec: a.codec_name, rate: Number(a.sample_rate), channels: a.channels } : null,
  };
}

export function silences(file: string): Span[] {
  const r = run('ffmpeg', ['-hide_banner', '-nostdin', '-vn', '-i', file, '-af', `silencedetect=n=${SILENCE_DB}dB:d=0.5`, '-f', 'null', '-']);
  const out = `${r.stdout}${r.stderr}`, spans: Span[] = []; let open: number | null = null;
  for (const m of out.matchAll(/silence_(start|end):\s*(-?[\d.]+)/g)) {
    const v = Number(m[2]);
    if (m[1] === 'start') open = Math.max(0, v); else if (open !== null) { spans.push([open, v]); open = null; }
  }
  if (open !== null) spans.push([open, Infinity]);
  return spans;
}
export function freezes(file: string): Span[] {
  const r = run('ffmpeg', ['-hide_banner', '-nostdin', '-an', '-i', file, '-vf', 'freezedetect=n=0.001:d=1.5', '-f', 'null', '-']);
  const out = `${r.stdout}${r.stderr}`, spans: Span[] = []; let open: number | null = null;
  for (const m of out.matchAll(/freeze_(start|end):\s*(-?[\d.]+)/g)) {
    const v = Number(m[2]);
    if (m[1] === 'start') open = v; else if (open !== null) { spans.push([open, v]); open = null; }
  }
  if (open !== null) spans.push([open, Infinity]);
  return spans;
}

export type Expect = { w: number; h: number; fps: number; frames: number; durationS: number; titleEnd: number; outroTail: number; web: boolean; channels: number };
export type Report = { errors: string[]; warnings: string[]; probe: Probe; loudness: { I: number; TP: number; LRA: number } | null; silences: Span[]; freezes: Span[] };

export function gate(file: string, e: Expect, over: { maxBytes?: number } = {}): Report {
  const errors: string[] = [], warnings: string[] = [], p = probe(file);
  if (p.streams !== 2 || !p.video || !p.audio) errors.push(`expected one video and one audio stream, found ${p.streams}`);
  if (p.video) {
    if (p.video.codec !== 'h264') errors.push(`video is ${p.video.codec}, not h264`);
    if (p.video.pix !== 'yuv420p') errors.push(`pixel format ${p.video.pix}, not yuv420p`);
    if (p.video.w !== e.w || p.video.h !== e.h) errors.push(`picture is ${p.video.w}x${p.video.h}, not ${e.w}x${e.h}`);
    if (Math.abs(p.video.fps - e.fps) > 0.01) errors.push(`${p.video.fps} fps, not ${e.fps}`);
    if (p.video.frames !== e.frames) errors.push(`${p.video.frames} frames, not ${e.frames}`);
  }
  if (p.audio) {
    if (p.audio.codec !== 'aac') errors.push(`audio is ${p.audio.codec}, not aac`);
    if (p.audio.channels !== e.channels) errors.push(`audio has ${p.audio.channels} channel(s), not ${e.channels}`);
  }
  if (Math.abs(p.duration - e.durationS) > 0.15) errors.push(`length ${p.duration.toFixed(2)} s, not ${e.durationS.toFixed(2)} s`);
  if (p.duration > FILM.maxS + 0.05) errors.push(`length ${p.duration.toFixed(1)} s is over the ${FILM.maxS} s cap`);
  else if (p.duration < 75) warnings.push(`length ${p.duration.toFixed(1)} s is under the 75 s a family film is designed for`);
  if (e.web) { const g = sizeGuard(p.bytes, 'the web film', over.maxBytes ?? WEB_MAX_BYTES); if (g) errors.push(g); }
  // dead air: the title card is silent by design, and so is the end card after the last word; nothing else may be
  const sil = silences(file);
  for (const [s, en] of sil) {
    const end = Number.isFinite(en) ? en : p.duration, len = end - s;
    if (s < 0.1 && end <= e.titleEnd + 1.2) continue;                       // the title card (and the first beat's lead)
    if (end >= p.duration - 0.2 && s >= p.duration - e.outroTail - 0.8) continue;    // the end card's hold
    if (len >= DEAD_AIR_S) errors.push(`${len.toFixed(1)} s of silence at ${s.toFixed(1)} s`);
    else if (len >= WARN_AIR_S) warnings.push(`${len.toFixed(1)} s of silence at ${s.toFixed(1)} s`);
  }
  const fr = freezes(file);
  for (const [s, en] of fr) { const len = (Number.isFinite(en) ? en : p.duration) - s; if (len >= FREEZE_S) errors.push(`the picture is frozen for ${len.toFixed(1)} s at ${s.toFixed(1)} s`); else warnings.push(`the picture holds still for ${len.toFixed(1)} s at ${s.toFixed(1)} s`); }
  const loud = measure(file);
  if (!loud) errors.push('no measurable audio');
  else {
    if (Math.abs(loud.I - TARGET.I) > LOUDNESS_TOL_LU) errors.push(`loudness ${loud.I.toFixed(1)} LUFS is more than ${LOUDNESS_TOL_LU} LU from ${TARGET.I}`);
    if (loud.TP > TARGET.TP) errors.push(`true peak ${loud.TP.toFixed(1)} dBTP is above ${TARGET.TP}`);
  }
  return { errors, warnings, probe: p, loudness: loud, silences: sil, freezes: fr };
}
