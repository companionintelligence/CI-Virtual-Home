// Runs scripts/voice/synth.py in the existing CI-Common Kokoro environment and turns each synthesised clip into a QA-checked,
// content-hashed .m4a. Shared by the family build (build-voiceover.mts) and the listening sheet (sheet.mts).
//
// This module downloads nothing. If the environment is missing, `requireEngine()` explains how the owner can install it and the
// caller stops.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { ROOT, hash10, sha256 } from './lib.mts';
import type { Expected, LockClip, VoiceRegistry } from './lib.mts';
import { SAMPLE_RATE, ffmpegVersion, gate, have, normaliseAndEncode, run } from './audio.mts';
import type { Encoded } from './audio.mts';

export const KOKORO_HOME = process.env.CI_VIDEO_KOKORO_HOME ?? path.join(os.homedir(), '.cache', 'ci-video-kit', 'kokoro');
export const VENV_PYTHON = path.join(KOKORO_HOME, 'venv', 'bin', 'python');
const MARKER = path.join(KOKORO_HOME, '.ready');
const SYNTH = path.join(ROOT, 'scripts', 'voice', 'synth.py');
/** Pinned thread count: see the synth.py docstring. Recorded in every lock's engine block. */
export const THREADS = 4;

export class EngineMissing extends Error {}

export interface EngineEnv { python: string; espeakLib: string }

export function requireEngine(): EngineEnv {
  const missing: string[] = [];
  if (!have('ffmpeg')) missing.push('ffmpeg (brew install ffmpeg)');
  if (!have('ffprobe')) missing.push('ffprobe (comes with ffmpeg)');
  const venvOk = fs.existsSync(VENV_PYTHON) && fs.existsSync(MARKER);
  if (!venvOk) missing.push(`the Kokoro Python environment (${VENV_PYTHON})`);
  if (missing.length) {
    throw new EngineMissing([
      `story:voice cannot run: missing ${missing.join(', ')}.`,
      '',
      'This tool downloads nothing. To install the local Kokoro engine (about 3 GB of Python packages and 330 MB of model weights,',
      'so it needs the owner\'s approval), run CI-Common\'s setup script yourself:',
      '',
      '    bash <CI-Common>/packages/video-kit/scripts/kokoro-setup.sh',
      '',
      '(CI-Common is companionintelligence/CI-Common. The script installs under ~/.cache/ci-video-kit/kokoro and nowhere else;',
      'set CI_VIDEO_KOKORO_HOME to put it elsewhere.) Then re-run this command.',
    ].join('\n'));
  }
  const m = fs.readFileSync(MARKER, 'utf8').match(/espeak_lib=(.+)/);
  return { python: VENV_PYTHON, espeakLib: m ? m[1].trim() : '' };
}

export interface Item { key: string; voice: string; speed: number; text: string }
export interface Synth { wav: string; samples: number; rawSamples?: number; trimmedLeadMs: number; peak: number; clippedSamples: number; words: [string, number, number][]; untimed: number; phonemes: string; error?: string }
export interface SynthResult { engine: Record<string, unknown>; clips: Record<string, Synth> }

/** Synthesise a batch; `text` is the already lexicon-applied string. Returns the engine block and one result per key. */
export async function synthesise(env: EngineEnv, reg: VoiceRegistry, items: Item[], workDir: string): Promise<SynthResult> {
  const job = {
    lang: 'b', device: 'cpu', seed: 0, threads: THREADS, modelRevision: reg.engine.modelRevision,
    espeakLib: env.espeakLib, silenceDb: -48, leadKeepMs: reg.encoding.trimLeadMs, tailKeepMs: 150,
    items: items.map(i => ({ id: i.key, voice: i.voice, speed: i.speed, text: i.text })),
  };
  fs.mkdirSync(workDir, { recursive: true });
  const jobFile = path.join(workDir, 'job.json');
  fs.writeFileSync(jobFile, JSON.stringify(job));
  // stream stderr: synth.py logs one progress line a clip, and a family takes minutes on a busy machine
  const status = await new Promise<{ code: number | null; err: string[] }>((resolve, reject) => {
    const child = spawn(env.python, [SYNTH, '--job', jobFile, '--out-dir', workDir], { stdio: ['ignore', 'inherit', 'pipe'], env: { ...process.env, PYTHONWARNINGS: 'ignore' } });
    const err: string[] = [];
    let buf = '';
    child.stderr!.setEncoding('utf8');
    child.stderr!.on('data', (d: string) => {
      buf += d;
      let i;
      while ((i = buf.indexOf('\n')) >= 0) {
        const l = buf.slice(0, i); buf = buf.slice(i + 1);
        if (l.startsWith('synth.py:')) console.log('  ' + l.replace(/^synth\.py:\s*/, '')); else if (l.trim() && !/Warning|warn|super\(\)|WeightNorm/.test(l)) err.push(l);
      }
    });
    child.on('error', reject);
    child.on('close', code => resolve({ code, err }));
  });
  if (status.code !== 0) throw new Error(`synth.py failed (exit ${status.code}):\n${status.err.slice(-12).join('\n')}`);
  const result = JSON.parse(fs.readFileSync(path.join(workDir, 'result.json'), 'utf8')) as SynthResult;
  // the registry pins the weights by hash; a different file under the same revision name must not be recorded
  if (reg.engine.weightsSha256 && result.engine.weightsSha256 !== reg.engine.weightsSha256) {
    throw new Error(`Kokoro weights are ${result.engine.weightsSha256} but content/story/voices.json pins ${reg.engine.weightsSha256}`);
  }
  const idToKey = new Map(items.map(i => [i.key, i]));
  for (const k of idToKey.keys()) if (!result.clips[k]) throw new Error(`synth.py returned nothing for ${k}`);
  return result;
}

const norm = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');

export interface Recorded {
  ok: boolean; why: string[];
  bytes: Uint8Array; sha: string; durationMs: number; trimmedLeadMs: number;
  words: [string, number, number][]; loudness: { I: number; TP: number }; tmpFile: string; enc: Encoded;
}

/** Encode one synthesised clip into `<workDir>/<n>.m4a`, then run every QA gate on the decoded file. */
export function finish(key: string, text: string, s: Synth, workDir: string, n: number): Recorded {
  const fail = (why: string[]): Recorded => ({ ok: false, why, bytes: new Uint8Array(), sha: '', durationMs: 0, trimmedLeadMs: 0, words: [], loudness: { I: 0, TP: 0 }, tmpFile: '', enc: undefined as unknown as Encoded });
  if (s.error) return fail([`synthesis failed: ${s.error}`]);
  const out = path.join(workDir, `${String(n).padStart(3, '0')}.m4a`);
  const enc = normaliseAndEncode(s.wav, out);
  const bytes = fs.readFileSync(out);
  const why = gate(text, enc, { clippedBeforeEncode: s.clippedSamples, samplesBeforeEncode: s.samples });
  const pcmMs = Math.round((s.samples / SAMPLE_RATE) * 1000);
  if (Math.abs(enc.decoded.durationMs - pcmMs) > 25) why.push(`encoded length ${enc.decoded.durationMs} ms differs from the synthesis ${pcmMs} ms`);
  // the word timings must cover exactly the words on the page, in order, or the caption highlight drifts
  if (s.untimed > 0) why.push(`${s.untimed} word(s) came back without a timing`);
  if (norm(s.words.map(w => w[0]).join('')) !== norm(text)) why.push('word timings do not spell the text');
  // Kokoro's word boundaries come from its predicted durations, not from the waveform, so the last word's end can fall a little past
  // the audible end (the tail below -48 dBFS is trimmed). Clamp to the file, and distrust timings that do not fit even the untrimmed
  // synthesis, which means the alignment is off.
  const dur = enc.decoded.durationMs;
  const words = s.words.map(([w, a, b]) => [w, Math.round(Math.min(a, dur)), Math.round(Math.min(b, dur))] as [string, number, number]);
  if (words.some((w, i) => w[2] < w[1] || (i > 0 && w[1] < words[i - 1][1]))) why.push('word timings are not in order');
  const rawEnd = s.rawSamples ? (s.rawSamples / SAMPLE_RATE) * 1000 - s.trimmedLeadMs : dur;
  const over = s.words.length ? s.words[s.words.length - 1][2] - rawEnd : 0;
  if (over > 150 || (words.length && words[words.length - 1][1] >= dur)) why.push(`word timings run ${Math.round(over)} ms past the synthesis`);
  return { ok: why.length === 0, why, bytes, sha: sha256(bytes), durationMs: enc.decoded.durationMs, trimmedLeadMs: s.trimmedLeadMs, words,
    loudness: { I: Math.round(enc.loudness.I * 100) / 100, TP: Math.round(enc.loudness.TP * 100) / 100 }, tmpFile: out, enc };
}

/** The lock entry for a clip that passed its gates. */
export function lockClip(e: Expected, r: Recorded): LockClip {
  return {
    text: e.text, textSha: e.textSha, spokenSha: e.spokenSha, voice: e.voice, kokoro: e.kokoro, speed: e.speed,
    file: `audio/${hashName(e.id, r.bytes)}`, sha256: r.sha, bytes: r.bytes.length, durationMs: r.durationMs, trimmedLeadMs: r.trimmedLeadMs,
    words: r.words, loudness: r.loudness,
  };
}

export const hashName = (id: string, bytes: Uint8Array) => `${id}.${hash10(bytes)}.m4a`;

/** `prior` is the engine block of the lock being updated: a run that records a few clips only loaded their voices, so keep the others' file hashes. */
export function engineBlock(synthEngine: Record<string, unknown>, prior?: Record<string, unknown>) {
  const voiceFiles = Object.fromEntries(Object.entries({ ...((prior?.voiceFiles as object) ?? {}), ...((synthEngine.voiceFiles as object) ?? {}) }).sort(([a], [b]) => (a < b ? -1 : 1)));
  return {
    name: 'kokoro' as const,
    kokoro: String(synthEngine.kokoro), misaki: String(synthEngine.misaki), torch: String(synthEngine.torch),
    model: String(synthEngine.model), modelRevision: String(synthEngine.modelRevision), seed: 0 as const, ffmpeg: ffmpegVersion(),
    encoder: 'aac (ffmpeg native), AAC-LC, 32 kbps mono 24 kHz, .m4a, -fflags +bitexact, no metadata, +faststart',
    normalise: '-16 LUFS integrated (EBU R128) after acompressor 3:1 and alimiter -3 dBFS; gates read the decoded file: true peak <= -1.0 dBTP, |dI| <= 0.7 LU',
    // provenance beyond the VoiceLock type: enough to tell why bytes moved after a toolchain change
    weightsSha256: synthEngine.weightsSha256, voiceFiles, numpy: synthEngine.numpy, soundfile: synthEngine.soundfile,
    phonemizerFork: synthEngine.phonemizerFork, espeakngLoader: synthEngine.espeakngLoader, python: synthEngine.python, device: synthEngine.device, threads: synthEngine.threads,
  };
}

export const scratch = (): string => fs.mkdtempSync(path.join(os.tmpdir(), 'ci-story-voice-'));
export { run };
