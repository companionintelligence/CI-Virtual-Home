// Deterministic recording (plan §6 P0 1; Completeness I): a shot is stepped frame by frame through the page's offline
// renderer — the same __houseRenderBegin / __houseRenderFrames / __houseRenderEnd path the golden images, the videos
// and the frame-hash test use, at the shot's own duration and a fixed frame rate — and each frame is handed to
// WebCodecs, never captured off a running clock. H.264 into an MP4 (assets/ui/mp4-mux.ts) where the browser can
// encode it, VP9 into a WebM (webm-mux.ts) where it cannot.
//
//   recordFrames(hooks, { prefer, bitrate, keyEvery, signal, onProgress }) → RecordResult
//
// hooks.begin() sizes the renderer for the film and returns { w, h, fps, frames, duration }; hooks.frame(i) leaves
// frame i on hooks.canvas (the WebGL canvas, drawn with preserveDrawingBuffer); hooks.end() puts the page back. Frame
// i is handed to the encoder in the same task that drew it (animate() may repaint the canvas between tasks), and
// before it is encoded its pixels are hashed — sha256 of the raw RGBA readPixels rows, bottom row first, 16 hex
// digits — so a test can prove the film is the frames __houseRenderFrames draws even though H.264 is lossy (the file
// itself is checked by PSNR, frame count and duration: scripts/test-ui.mts).
//
// The loop yields to the event loop after every frame, so the progress toast paints and Cancel works; an aborted
// signal stops it, closes the encoder and still calls hooks.end().
import { muxMp4 } from './mp4-mux.js';
import { muxWebm } from './webm-mux.js';

export type RecordHooks = {
  begin: () => { w: number; h: number; fps: number; frames: number; duration: number };
  frame: (i: number) => void;
  end: () => void;
  canvas: HTMLCanvasElement;
  gl: WebGLRenderingContext | WebGL2RenderingContext;
};
export type CodecChoice = { kind: 'h264' | 'vp9'; codec: string; mimeType: string; ext: 'mp4' | 'webm'; label: string };
export type RecordOptions = {
  prefer?: 'h264' | 'vp9';
  bitrate?: number;
  keyEvery?: number;          // seconds between keyframes (default 1)
  hash?: boolean;             // hash every frame before encoding (default true)
  signal?: AbortSignal;
  onProgress?: (done: number, total: number) => void;
  onStart?: (info: { w: number; h: number; fps: number; frames: number; duration: number; codec: CodecChoice }) => void;
};
export type RecordResult = {
  blob: Blob; mimeType: string; ext: 'mp4' | 'webm'; codec: string; kind: 'h264' | 'vp9';
  width: number; height: number; fps: number; frames: number; duration: number; bitrate: number;
  frameHashes: string[]; encodeMs: number;
};

// H.264 High profile at the lowest level that holds the film (ITU-T H.264 Table A-1: max macroblocks a second and a frame)
const AVC_LEVELS: Array<[string, number, number]> = [
  ['1f', 108000, 3600], ['28', 245760, 8192], ['2a', 522240, 8704], ['32', 589824, 22080], ['33', 983040, 36864], ['34', 2073600, 36864],
];
export function avcCodecFor(w: number, h: number, fps: number): string[] {
  const fs = Math.ceil(w / 16) * Math.ceil(h / 16), mbps = fs * fps;
  return AVC_LEVELS.filter(([, maxMbps, maxFs]) => mbps <= maxMbps && fs <= maxFs).map(([lv]) => `avc1.6400${lv}`);
}
/** Bits a second for a film: ~0.15 bit a pixel a frame, never under 8 Mb/s — high enough that a frame decodes
 *  within 40 dB PSNR of what was rendered (scripts/test-ui.mts checks it). */
export function bitrateFor(w: number, h: number, fps: number): number {
  return Math.round(Math.max(8e6, Math.min(80e6, w * h * fps * 0.15)));
}

/** The codec this browser will encode the film with: H.264 (MP4) when it can, else VP9 (WebM); null without WebCodecs. */
export async function pickCodec(w: number, h: number, fps: number, prefer: 'h264' | 'vp9' = 'h264'): Promise<CodecChoice | null> {
  const VE = (globalThis as any).VideoEncoder;
  if (!VE || !VE.isConfigSupported) return null;
  const bitrate = bitrateFor(w, h, fps);
  const tryOne = async (codec: string, extra: object = {}) => {
    try { return (await VE.isConfigSupported({ codec, width: w, height: h, bitrate, framerate: fps, ...extra })).supported === true; } catch { return false; }
  };
  const h264 = async (): Promise<CodecChoice | null> => {
    for (const codec of avcCodecFor(w, h, fps)) if (await tryOne(codec, { avc: { format: 'avc' } })) return { kind: 'h264', codec, mimeType: 'video/mp4', ext: 'mp4', label: 'H.264 in MP4' };
    return null;
  };
  const vp9 = async (): Promise<CodecChoice | null> => {
    for (const codec of ['vp09.00.10.08', 'vp09.00.40.08', 'vp09.00.50.08']) if (await tryOne(codec)) return { kind: 'vp9', codec, mimeType: 'video/webm', ext: 'webm', label: 'VP9 in WebM' };
    return null;
  };
  return prefer === 'vp9' ? (await vp9()) || (await h264()) : (await h264()) || (await vp9());
}

const hex = (buf: ArrayBuffer, n = 16) => [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('').slice(0, n);
const tick = () => new Promise<void>(r => setTimeout(r, 0));

export async function recordFrames(hooks: RecordHooks, opts: RecordOptions = {}): Promise<RecordResult> {
  const VE = (globalThis as any).VideoEncoder, VF = (globalThis as any).VideoFrame;
  if (!VE || !VF) throw new Error('This browser has no WebCodecs video encoder. Use a recent Chrome, Edge or Safari.');
  const { signal, onProgress, onStart, keyEvery = 1, hash = true } = opts;
  const info = hooks.begin();
  let encoder: any = null;
  try {
    const { w, h, fps, frames, duration } = info;
    const choice = await pickCodec(w, h, fps, opts.prefer || 'h264');
    if (!choice) throw new Error(`This browser cannot encode a ${w} × ${h} film at ${fps} fps as H.264 or VP9.`);
    const bitrate = opts.bitrate || bitrateFor(w, h, fps);
    onStart?.({ ...info, codec: choice });

    const samples: Array<{ data: Uint8Array; key: boolean; pts: number }> = [];
    let description: Uint8Array | null = null, colour: any = null, failure: Error | null = null;
    encoder = new VE({
      output: (chunk: any, meta: any) => {
        const data = new Uint8Array(chunk.byteLength); chunk.copyTo(data);
        samples.push({ data, key: chunk.type === 'key', pts: chunk.timestamp });
        if (meta && meta.decoderConfig) {
          if (meta.decoderConfig.description) description = new Uint8Array(meta.decoderConfig.description instanceof ArrayBuffer ? meta.decoderConfig.description : meta.decoderConfig.description.buffer.slice(meta.decoderConfig.description.byteOffset, meta.decoderConfig.description.byteOffset + meta.decoderConfig.description.byteLength));
          if (meta.decoderConfig.colorSpace) colour = meta.decoderConfig.colorSpace;
        }
      },
      error: (e: Error) => { failure = e; },
    });
    encoder.configure({ codec: choice.codec, width: w, height: h, bitrate, framerate: fps, latencyMode: 'quality', ...(choice.kind === 'h264' ? { avc: { format: 'avc' } } : {}) });

    const gl = hooks.gl, px = hash ? new Uint8Array(w * h * 4) : null;
    const hashes: Array<Promise<string>> = [];
    const keyPeriod = Math.max(1, Math.round(keyEvery * fps)), frameUs = 1e6 / fps;
    const t0 = performance.now();
    for (let i = 0; i < frames; i++) {
      if (signal?.aborted) throw new DOMException('Recording cancelled', 'AbortError');
      if (failure) throw failure;
      // draw, hash and wrap frame i in one task: the live loop may repaint the canvas as soon as this one yields
      hooks.frame(i);
      if (px) { gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, px); hashes.push(crypto.subtle.digest('SHA-256', px).then(b => hex(b))); }
      const vf = new VF(hooks.canvas, { timestamp: Math.round(i * frameUs), duration: Math.round(frameUs) });
      encoder.encode(vf, { keyFrame: i % keyPeriod === 0 });
      vf.close();
      onProgress?.(i + 1, frames);
      // keep the encoder's queue short (memory), and let the page paint the progress and hear Cancel
      while (encoder.encodeQueueSize > 3 && !failure) await new Promise<void>(r => setTimeout(r, 4));
      await tick();
    }
    await encoder.flush();
    encoder.close();
    if (failure) throw failure;
    if (samples.length !== frames) throw new Error(`the encoder returned ${samples.length} frames of ${frames}`);
    const data = choice.kind === 'h264'
      ? muxMp4({ width: w, height: h, fps, avcC: description!, samples, colour })
      : muxWebm({ width: w, height: h, fps, codec: 'V_VP9', samples });
    return {
      blob: new Blob([data as Uint8Array<ArrayBuffer>], { type: choice.mimeType }), mimeType: choice.mimeType, ext: choice.ext, codec: choice.codec, kind: choice.kind,
      width: w, height: h, fps, frames, duration, bitrate, frameHashes: await Promise.all(hashes), encodeMs: Math.round(performance.now() - t0),
    };
  } finally {
    if (encoder && encoder.state !== 'closed') { try { encoder.close(); } catch { /* already closed */ } }
    hooks.end();
  }
}
