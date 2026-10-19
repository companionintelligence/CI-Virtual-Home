// The film's sound: the SAME recorded clips the live tour plays (the m4a files the voice lock names), laid on a silent timeline at the offsets the film
// clock gives them, normalised to the delivery loudness by the two-pass method of CI-Common's loudness.ts (measure, then a linear gain, then a true-peak
// limiter that leaves the AAC encode a decibel of room), and handed to the video encode. Needs ffmpeg. Owner: video-tool.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import type { Placement } from '../../assets/story/film/layout.js';

/** Streaming delivery: -14 LUFS integrated, -1 dBTP. The limiter is set 1 dB lower because the AAC encode overshoots its own samples. */
export const TARGET = { I: -14, TP: -1, LRA: 11 } as const;
/** The limiter sits this far under the delivery peak. The kit provisions 1 dB for a 192k encode; the web film is AAC 64k mono, which overshoots its own samples by about 1.1 dB on this voice (measured: a -2.0 dBTP
 *  limiter gave -0.9 dBTP after the encode), so 2 dB. */
export const ENCODE_HEADROOM_DB = 2;
/** the clips are 24 kHz mono; the timeline is built at that rate (nothing is resampled until the very end) */
export const CLIP_RATE = 24000;
export const OUT_RATE = 48000;

const ff = (args: string[], opts: { input?: Buffer } = {}) => spawnSync('ffmpeg', ['-hide_banner', '-nostdin', ...args], { encoding: 'utf8', maxBuffer: 256 << 20, input: opts.input });

/** Decode one clip to mono float at 24 kHz. */
export function decodeClip(file: string): Float32Array {
  const r = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-nostdin', '-i', file, '-f', 'f32le', '-ac', '1', '-ar', String(CLIP_RATE), '-'], { maxBuffer: 256 << 20 });
  if (r.status !== 0) throw new Error(`cannot decode ${file}: ${String(r.stderr).slice(-300)}`);
  const buf = r.stdout as Buffer, out = new Float32Array(Math.floor(buf.byteLength / 4));
  for (let i = 0; i < out.length; i++) out[i] = buf.readFloatLE(i * 4);
  return out;
}

/** The timeline in samples: each clip at round(atS * rate). Clips never overlap (layout.audioPlacements checks); if they did the samples would add. */
export function mixTimeline(clips: Array<{ atS: number; samples: Float32Array }>, durationS: number, rate = CLIP_RATE): Float32Array {
  const out = new Float32Array(Math.ceil(durationS * rate));
  for (const c of clips) {
    const at = Math.round(c.atS * rate);
    if (at < 0) throw new Error('a clip starts before the film does');
    for (let i = 0; i < c.samples.length && at + i < out.length; i++) out[at + i] += c.samples[i];
  }
  return out;
}

/** A 32-bit float mono WAV (format 3). */
export function floatWav(samples: Float32Array, rate = CLIP_RATE): Buffer {
  const data = samples.length * 4, b = Buffer.alloc(44 + data);
  b.write('RIFF', 0); b.writeUInt32LE(36 + data, 4); b.write('WAVE', 8); b.write('fmt ', 12);
  b.writeUInt32LE(16, 16); b.writeUInt16LE(3, 20); b.writeUInt16LE(1, 22); b.writeUInt32LE(rate, 24); b.writeUInt32LE(rate * 4, 28); b.writeUInt16LE(4, 32); b.writeUInt16LE(32, 34);
  b.write('data', 36); b.writeUInt32LE(data, 40);
  for (let i = 0; i < samples.length; i++) b.writeFloatLE(samples[i], 44 + i * 4);
  return b;
}

export type Loud = { I: number; TP: number; LRA: number };
/** Integrated loudness, true peak and range of the audio in a file. */
export function measure(file: string): Loud | null {
  const r = ff(['-vn', '-i', file, '-af', 'ebur128=peak=true:framelog=quiet', '-f', 'null', '-']);
  const out = `${r.stdout ?? ''}${r.stderr ?? ''}`, tail = out.slice(out.lastIndexOf('Integrated loudness'));
  const num = (label: string) => { const m = tail.match(new RegExp(`${label}:\\s*(-?[\\d.]+)`)); return m ? Number(m[1]) : null; };
  const I = num('I'); if (I === null) return null;
  return { I, LRA: num('LRA') ?? 0, TP: num('Peak') ?? 0 };
}

/** The chain after resampling: loudnorm's own measurement, applied linearly (a gain, no compression), then the true-peak limiter. */
export function normaliseChain(m: { input_i: string; input_tp: string; input_lra: string; input_thresh: string; target_offset: string }): string {
  const measured = [`measured_I=${m.input_i}`, `measured_TP=${m.input_tp}`, `measured_LRA=${m.input_lra}`, `measured_thresh=${m.input_thresh}`, `offset=${m.target_offset}`, 'linear=true', 'print_format=summary'].join(':');
  const ceiling = 10 ** ((TARGET.TP - ENCODE_HEADROOM_DB) / 20);
  return `aresample=${OUT_RATE},loudnorm=I=${TARGET.I}:TP=${TARGET.TP}:LRA=${TARGET.LRA}:${measured},alimiter=limit=${ceiling.toFixed(6)}:level=disabled`;
}

/**
 * Build the film's audio: a 48 kHz mono 16-bit WAV at `outWav`, normalised. Returns the loudness measured on the WAV (before the AAC encode; the encoded
 * file is measured again by qa.mts, because that is what a listener's device decodes).
 */
export function buildAudio(placements: Placement[], clipFile: (p: Placement) => string, durationS: number, outWav: string, scratch: string): { loudness: Loud; clips: number } {
  fs.mkdirSync(scratch, { recursive: true });
  const clips = placements.map(p => ({ atS: p.atS, samples: decodeClip(clipFile(p)) }));
  const raw = path.join(scratch, 'timeline.f32.wav');
  fs.writeFileSync(raw, floatWav(mixTimeline(clips, durationS)));
  // pass 1: measure (resample first, so the measurement is of the signal that will be gained)
  const p1 = ff(['-i', raw, '-af', `aresample=${OUT_RATE},loudnorm=I=${TARGET.I}:TP=${TARGET.TP}:LRA=${TARGET.LRA}:print_format=json`, '-f', 'null', '-']);
  const blob = `${p1.stdout ?? ''}${p1.stderr ?? ''}`, json = blob.slice(blob.lastIndexOf('{'), blob.lastIndexOf('}') + 1);
  let m; try { m = JSON.parse(json); } catch { throw new Error(`cannot read loudnorm's measurement: ${blob.slice(-300)}`); }
  // pass 2: the gain and the limiter, to the length of the film exactly
  const p2 = ff(['-y', '-i', raw, '-af', `${normaliseChain(m)},apad=whole_dur=${durationS.toFixed(3)},atrim=0:${durationS.toFixed(3)}`, '-ar', String(OUT_RATE), '-ac', '1', '-c:a', 'pcm_s16le', outWav]);
  if (p2.status !== 0 || !fs.existsSync(outWav)) throw new Error(`audio normalisation failed: ${String(p2.stderr).slice(-300)}`);
  const loudness = measure(outWav);
  if (!loudness) throw new Error('the film has no measurable audio');
  return { loudness, clips: clips.length };
}

export type EncodeArgs = {
  /** the audio WAV from buildAudio */
  wav: string; fps: number;
  web: string; master?: string | null;
};
/** The ffmpeg command line for the two outputs from ONE stream of JPEG frames on stdin (no generation loss: the web file is not made from the master). */
export function encodeArgs(a: EncodeArgs): string[] {
  // -threads 1 on purpose: libx264 with frame threads is not reproducible (the same 241 JPEGs gave a different stream on each of three runs; with one thread, the same bytes every time).
  const common = ['-map', '0:v', '-map', '1:a', '-vf', 'scale=out_color_matrix=bt709:out_range=tv,format=yuv420p', '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-color_range', 'tv',
    '-c:v', 'libx264', '-threads', '1', '-pix_fmt', 'yuv420p', '-g', '90', '-flags:v', '+bitexact', '-flags:a', '+bitexact', '-fflags', '+bitexact', '-map_metadata', '-1', '-movflags', '+faststart'];
  const args = ['-y', '-loglevel', 'error', '-nostdin', '-fflags', '+bitexact', '-f', 'image2pipe', '-c:v', 'mjpeg', '-framerate', String(a.fps), '-i', '-', '-i', a.wav];
  // web: H.264 High, CRF 28 capped at 1.5 Mbit/s, AAC 64k mono
  args.push(...common, '-profile:v', 'high', '-preset', 'medium', '-crf', '28', '-maxrate', '1500k', '-bufsize', '3000k', '-c:a', 'aac', '-b:a', '64k', '-ac', '1', '-ar', String(OUT_RATE), a.web);
  // master: CRF 18, AAC 128k stereo; outside git and dist
  if (a.master) args.push(...common, '-profile:v', 'high', '-preset', 'slow', '-crf', '18', '-c:a', 'aac', '-b:a', '128k', '-ac', '2', '-ar', String(OUT_RATE), a.master);
  return args;
}
