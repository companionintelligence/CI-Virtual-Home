// The persona cut's encode: one stream of JPEG frames on stdin, one silent H.264 file. Pure functions that build the ffmpeg command line (no process is started here),
// so scripts/test-ads.mts can check the flags that decide the file: the codec, the pixel format, the colour tags, the single thread and bitexact flags that make the
// same frames give the same bytes, and the audio decision. Owner: ad-kit.
//
// Audio decision (reference/story/ads.md): a cut is silent by design (it is watched muted, with burned captions), so by default the file has NO audio stream: one stream,
// the cleanest ffprobe, and every placement the campaign names (Meta, TikTok, YouTube Shorts, LinkedIn) takes it. `--audio silent` adds one silent AAC stereo track
// at 48 kHz for a placement or an ad server that insists on an audio stream; it is the same picture and the same video bytes.
export type AudioMode = 'none' | 'silent';
export type EncodeOpts = {
  fps: number;
  /** the canvas the frames are drawn at, and the delivered size (a scale between them when they differ: a 1:1 or a 4:5 cut is drawn a little larger than it is delivered) */
  from: { w: number; h: number }; out: { w: number; h: number };
  file: string; audio?: AudioMode; durationS?: number;
};
export const CRF = 18, MAXRATE = '12M', BUFSIZE = '24M', GOP = 60;

export function encodeArgs(a: EncodeOpts): string[] {
  const audio = a.audio ?? 'none';
  // one scale filter: to the delivered size when the canvas is drawn at another (a 1:1 or 4:5 cut), and in either case to bt709 limited range
  const scale = `scale=${a.from.w === a.out.w && a.from.h === a.out.h ? '' : `${a.out.w}:${a.out.h}:flags=lanczos:`}out_color_matrix=bt709:out_range=tv`;
  // -threads 1 on purpose, as the film's: libx264 with frame threads is not reproducible; one thread gives the same bytes every time.
  const args = ['-y', '-loglevel', 'error', '-nostdin', '-fflags', '+bitexact', '-f', 'image2pipe', '-c:v', 'mjpeg', '-framerate', String(a.fps), '-i', '-'];
  if (audio === 'silent') args.push('-f', 'lavfi', '-i', 'anullsrc=channel_layout=stereo:sample_rate=48000');
  args.push('-map', '0:v');
  if (audio === 'silent') args.push('-map', '1:a');
  args.push(
    '-vf', `${scale},format=yuv420p`, '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-color_range', 'tv',
    '-c:v', 'libx264', '-threads', '1', '-pix_fmt', 'yuv420p', '-g', String(GOP), '-profile:v', 'high', '-preset', 'medium', '-crf', String(CRF), '-maxrate', MAXRATE, '-bufsize', BUFSIZE,
    '-flags:v', '+bitexact', '-fflags', '+bitexact', '-map_metadata', '-1', '-movflags', '+faststart',
  );
  if (audio === 'silent') args.push('-c:a', 'aac', '-b:a', '64k', '-ac', '2', '-ar', '48000', '-flags:a', '+bitexact', '-shortest');
  else args.push('-an');
  args.push(a.file);
  return args;
}
