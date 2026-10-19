// ffmpeg side of the voice-over: loudness, encoding and the measurements the QA gates read.
// Needs ffmpeg and ffprobe on PATH (build-voiceover.mts checks first). Nothing here touches the network.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import { minSeconds as minSecondsFor } from './lib.mts';

export const TARGET_LUFS = -16;
/** Limiter ceiling before AAC (sample peak). The decoded true peak gate is -1.0 dBTP: AAC overshoots a limited signal by up to ~1.5 dB. */
export const LIMIT_DBFS = -3;
export const GATE = { truePeakDb: -1.0, loudnessLU: 0.7, clipLevel: 0.999, speechFrameDb: -50, minSpeechFraction: 0.3, minRmsDb: -40 } as const;
export const SAMPLE_RATE = 24000;

/** Light speech compression, then the limiter. The compressor is what lets a deep voice (a high crest factor: bm_lewis peaks 20 dB
 *  over its loudness) reach -16 LUFS without the limiter flattening its peaks. Fixed settings, so a clip is a pure function of its samples. */
const COMPRESS = 'acompressor=threshold=0.05:ratio=3:attack=5:release=80:knee=4:makeup=1';
const limiter = (ceilingDb: number) => `alimiter=limit=${(10 ** (ceilingDb / 20)).toFixed(4)}:attack=3:release=50:level=0`;

export function run(cmd: string, args: string[], opts: { maxBuffer?: number; encoding?: 'utf8' | 'buffer' } = {}) {
  const r = spawnSync(cmd, args, { maxBuffer: opts.maxBuffer ?? 256 * 1024 * 1024, encoding: opts.encoding === 'buffer' ? undefined : 'utf8' });
  if (r.error) throw new Error(`${cmd}: ${r.error.message}`);
  return r;
}
export const have = (cmd: string): boolean => spawnSync(cmd, ['-version'], { stdio: 'ignore' }).status === 0;
export function ffmpegVersion(): string {
  const r = run('ffmpeg', ['-version']);
  return String(r.stdout).split('\n')[0].replace(/^ffmpeg version\s+/, '').split(/\s+Copyright/)[0].trim();
}

export interface Loudness { I: number; TP: number }

/** Integrated loudness and true peak of a file, optionally after a filter chain, via loudnorm's analysis pass (EBU R128, 4x oversampled TP). */
export function measure(file: string, chain?: string): Loudness {
  const af = `${chain ? chain + ',' : ''}loudnorm=I=${TARGET_LUFS}:TP=-1.5:LRA=11:print_format=json`;
  const r = run('ffmpeg', ['-hide_banner', '-nostats', '-i', file, '-af', af, '-f', 'null', '-']);
  const err = String(r.stderr);
  const m = err.match(/\{[^{}]*"input_i"[^{}]*\}/);
  if (r.status !== 0 || !m) throw new Error(`loudness measurement failed for ${file}: ${err.slice(-400)}`);
  const j = JSON.parse(m[0]);
  const I = Number(j.input_i), TP = Number(j.input_tp);
  if (!Number.isFinite(I) || !Number.isFinite(TP)) throw new Error(`loudness of ${file} is not measurable (${j.input_i} LUFS); the clip is too short or silent`);
  return { I, TP };
}

const chainFor = (gainDb: number, ceilingDb: number) => `${COMPRESS},volume=${gainDb.toFixed(3)}dB,${limiter(ceilingDb)}`;

/** Gain (dB) that puts the compressed and limited signal at TARGET_LUFS. The limiter is non-linear, so it iterates; it ends in 2 to 4 passes. */
export function findGain(wav: string, ceilingDb: number, rawI = measure(wav).I): { gainDb: number; pre: Loudness; passes: number } {
  let gain = TARGET_LUFS - rawI + 3;       // the compressor costs a few dB; start there
  let pre = measure(wav, chainFor(gain, ceilingDb));
  let passes = 1;
  while (Math.abs(pre.I - TARGET_LUFS) > 0.1 && passes < 8) {
    gain += TARGET_LUFS - pre.I;
    pre = measure(wav, chainFor(gain, ceilingDb));
    passes++;
  }
  return { gainDb: Number(gain.toFixed(3)), pre, passes };
}

/**
 * AAC-LC, mono, 24 kHz, 32 kbps in an .m4a with no metadata. `-fflags +bitexact` (and the codec flag) keeps the muxer from writing
 * an encoder tag or a creation time, so the same samples always give the same bytes. `+faststart` puts the index first so a page can
 * start playing a clip before it has downloaded it.
 */
export function encode(wav: string, out: string, gainDb: number, ceilingDb = LIMIT_DBFS): void {
  const r = run('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-fflags', '+bitexact', '-i', wav, '-af', chainFor(gainDb, ceilingDb),
    '-ac', '1', '-ar', String(SAMPLE_RATE), '-c:a', 'aac', '-profile:a', 'aac_low', '-b:a', '32k', '-flags:a', '+bitexact',
    '-map_metadata', '-1', '-movflags', '+faststart', '-fflags', '+bitexact', out]);
  if (r.status !== 0 || !fs.existsSync(out)) throw new Error(`ffmpeg encode failed: ${String(r.stderr).slice(-400)}`);
}

export interface Decoded {
  durationMs: number; samples: number; peak: number; clipped: number; rmsDb: number; speechFraction: number;
}
/** Decode a file to 24 kHz mono float and measure it the way a listener's device would receive it. */
export function decodedStats(file: string): Decoded {
  const r = run('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-i', file, '-f', 'f32le', '-ac', '1', '-ar', String(SAMPLE_RATE), '-'], { encoding: 'buffer' });
  if (r.status !== 0) throw new Error(`decode failed for ${file}: ${String(r.stderr).slice(-300)}`);
  const buf = r.stdout as unknown as Buffer;
  const x = new Float32Array(buf.buffer, buf.byteOffset, Math.floor(buf.byteLength / 4));
  let peak = 0, clipped = 0, sum = 0;
  for (let i = 0; i < x.length; i++) {
    const a = Math.abs(x[i]);
    if (a > peak) peak = a;
    if (a >= GATE.clipLevel) clipped++;
    sum += x[i] * x[i];
  }
  const frame = SAMPLE_RATE / 50;          // 20 ms
  const thr = 10 ** (GATE.speechFrameDb / 20);
  let frames = 0, voiced = 0;
  for (let i = 0; i + frame <= x.length; i += frame) {
    let s = 0;
    for (let j = i; j < i + frame; j++) s += x[j] * x[j];
    frames++;
    if (Math.sqrt(s / frame) > thr) voiced++;
  }
  return {
    durationMs: Math.round((x.length / SAMPLE_RATE) * 1000), samples: x.length, peak, clipped,
    rmsDb: x.length ? 20 * Math.log10(Math.sqrt(sum / x.length) + 1e-12) : -Infinity,
    speechFraction: frames ? voiced / frames : 0,
  };
}

export function probe(file: string): { codec: string; profile: string; channels: number; sampleRate: number; bitRate: number; duration: number; tags: string[] } {
  const r = run('ffprobe', ['-v', 'error', '-show_streams', '-show_format', '-of', 'json', file]);
  const j = JSON.parse(String(r.stdout));
  const s = j.streams[0];
  return { codec: s.codec_name, profile: s.profile, channels: s.channels, sampleRate: Number(s.sample_rate), bitRate: Number(j.format.bit_rate), duration: Number(j.format.duration),
    tags: Object.keys(j.format.tags ?? {}).filter(k => !['major_brand', 'minor_version', 'compatible_brands'].includes(k)) };
}

export interface Encoded { gainDb: number; passes: number; loudness: Loudness; decoded: Decoded; attempts: number; ceilingDb: number }

/**
 * Normalise to TARGET_LUFS, encode, then measure the DECODED file and correct once or twice if AAC moved it. The prototype
 * measured -16 LUFS before encoding and overshot to -0.1 dBTP after, so the gates only ever trust the decoded measurement.
 */
export function normaliseAndEncode(wav: string, out: string): Encoded {
  const rawI = measure(wav).I;
  let ceiling = LIMIT_DBFS, trim = 0, attempts = 0, passes = 0, gain = 0, loudness: Loudness;
  for (;;) {
    attempts++;
    const g = findGain(wav, ceiling, rawI);
    passes += g.passes;
    gain = g.gainDb + trim;
    encode(wav, out, gain, ceiling);
    loudness = measure(out);
    const off = loudness.I - TARGET_LUFS;
    const peakOk = loudness.TP <= GATE.truePeakDb - 0.2;
    if ((Math.abs(off) <= 0.3 && peakOk) || attempts >= 4) break;
    if (!peakOk) ceiling -= loudness.TP - (GATE.truePeakDb - 0.5);   // AAC overshot the limiter; lower the ceiling by the excess and re-solve the gain
    trim -= off;                                                       // the codec moved the loudness; pull it back
  }
  return { gainDb: gain, passes, loudness, decoded: decodedStats(out), attempts, ceilingDb: ceiling };
}

/** The gates. Every string returned is a reason the clip fails; an empty list is a pass. */
export function gate(text: string, enc: Encoded, o: { clippedBeforeEncode: number; samplesBeforeEncode: number }): string[] {
  const why: string[] = [];
  const secs = enc.decoded.durationMs / 1000;
  const floor = minSecondsFor(text);
  if (secs < floor) why.push(`duration ${secs.toFixed(2)}s is below the syllable floor ${floor.toFixed(2)}s (truncated?)`);
  if (enc.decoded.rmsDb < GATE.minRmsDb || enc.decoded.speechFraction < GATE.minSpeechFraction) why.push(`mostly silent (rms ${enc.decoded.rmsDb.toFixed(1)} dBFS, ${(enc.decoded.speechFraction * 100).toFixed(0)}% of frames carry speech)`);
  if (o.clippedBeforeEncode > 0 || enc.decoded.clipped > 0) why.push(`clipped samples (${o.clippedBeforeEncode} in the synthesis, ${enc.decoded.clipped} after decode)`);
  if (enc.loudness.TP > GATE.truePeakDb) why.push(`decoded true peak ${enc.loudness.TP.toFixed(2)} dBTP is above ${GATE.truePeakDb}`);
  const dI = enc.loudness.I - TARGET_LUFS;
  if (Math.abs(dI) > GATE.loudnessLU) why.push(`decoded loudness ${enc.loudness.I.toFixed(2)} LUFS is ${dI.toFixed(2)} LU from ${TARGET_LUFS}`);
  return why;
}
