// A minimal MP4 (ISO BMFF) writer for one H.264 video track — what the editor's Record button (assets/ui/recorder.ts)
// wraps WebCodecs' output in. Plan §6 P0 1 asks for "a vendored muxer": this is ours, written for exactly this job, so
// there is no third-party code or licence to carry. It writes a progressive (not fragmented) file with the movie box
// in front ("fast start"): ftyp · moov · mdat, one chunk holding every sample.
//
//   muxMp4({ width, height, fps, avcC, samples: [{ data, key, pts }], colour }) → Uint8Array
//
// `avcC` is the AVCDecoderConfigurationRecord — WebCodecs hands it over as `metadata.decoderConfig.description` when
// the encoder is configured with `avc: { format: 'avc' }` — and each sample's `data` is one access unit in the same
// length-prefixed (AVCC) form. `pts` is the presentation time in microseconds (EncodedVideoChunk.timestamp), in
// decode order; when it runs out of step with the decode clock (an encoder that reorders frames) the composition
// offsets go in a ctts box. The media clock is 90 kHz, so 24, 25, 30, 50 and 60 fps all have a whole-tick frame.
//
// Deterministic: no creation dates (they are 0), nothing from the clock — the same samples give the same bytes.
// THREE-free and DOM-free, so scripts/test-ui-units.mts runs it in Node against ffprobe.

export type Sample = { data: Uint8Array; key: boolean; pts: number };
export type Colour = { primaries?: string | null; transfer?: string | null; matrix?: string | null; fullRange?: boolean | null };
export type Mp4Input = { width: number; height: number; fps: number; avcC: Uint8Array; samples: Sample[]; colour?: Colour | null };

export const MP4_TIMESCALE = 90000;

// WebCodecs VideoColorSpace names → ISO/IEC 23091-2 code points (what an nclx colr box and the H.264 VUI carry)
const PRIMARIES: Record<string, number> = { bt709: 1, bt470bg: 5, smpte170m: 6, bt2020: 9, smpte432: 12 };
const TRANSFER: Record<string, number> = { bt709: 1, smpte170m: 6, 'iec61966-2-1': 13, linear: 8, pq: 16, hlg: 18 };
const MATRIX: Record<string, number> = { rgb: 0, bt709: 1, bt470bg: 5, smpte170m: 6, 'bt2020-ncl': 9 };

// ---- a byte writer for the (small) header boxes ------------------------------------------------------------------
class Bytes {
  parts: number[] = [];
  u8(v: number) { this.parts.push(v & 0xff); return this; }
  u16(v: number) { this.parts.push((v >>> 8) & 0xff, v & 0xff); return this; }
  u32(v: number) { this.parts.push((v >>> 24) & 0xff, (v >>> 16) & 0xff, (v >>> 8) & 0xff, v & 0xff); return this; }
  i16(v: number) { return this.u16(v < 0 ? 0x10000 + v : v); }
  str(s: string) { for (let i = 0; i < s.length; i++) this.parts.push(s.charCodeAt(i) & 0xff); return this; }
  zeros(n: number) { for (let i = 0; i < n; i++) this.parts.push(0); return this; }
  bytes(b: ArrayLike<number>) { for (let i = 0; i < b.length; i++) this.parts.push(b[i]); return this; }
  out() { return Uint8Array.from(this.parts); }
}
function box(type: string, ...payload: Uint8Array[]): Uint8Array {
  const len = 8 + payload.reduce((a, p) => a + p.length, 0);
  const out = new Uint8Array(len);
  const h = new Bytes().u32(len).str(type).out();
  out.set(h, 0);
  let o = 8;
  for (const p of payload) { out.set(p, o); o += p.length; }
  return out;
}
const full = (version: number, flags: number) => new Bytes().u8(version).u8(flags >>> 16).u8(flags >>> 8).u8(flags);
const MATRIX_UNITY = [0x00010000, 0, 0, 0, 0x00010000, 0, 0, 0, 0x40000000];

/** The frame duration in 90 kHz ticks; throws for a rate that has no whole tick (use one that does). */
export function frameTicks(fps: number): number {
  const d = MP4_TIMESCALE / fps;
  if (!(fps > 0) || Math.abs(d - Math.round(d)) > 1e-9) throw new Error(`mp4: ${fps} fps has no whole 90 kHz frame duration`);
  return Math.round(d);
}

export function muxMp4({ width, height, fps, avcC, samples, colour = null }: Mp4Input): Uint8Array {
  if (!samples.length) throw new Error('mp4: no samples');
  if (!avcC || !avcC.length) throw new Error('mp4: no avcC (configure the encoder with avc: { format: "avc" })');
  const delta = frameTicks(fps), n = samples.length, duration = n * delta;
  // composition offsets: pts in ticks against the decode clock i·delta
  const cts = samples.map(s => Math.round(s.pts * MP4_TIMESCALE / 1e6));
  const offsets = cts.map((c, i) => c - i * delta);
  const minOff = Math.min(...offsets);
  const shifted = offsets.map(o => o - Math.min(0, minOff));   // ctts v0 offsets are unsigned
  const needCtts = shifted.some(o => o !== 0);
  const mdatBytes = samples.reduce((a, s) => a + s.data.length, 0);
  if (mdatBytes + 8 > 0xffffffff) throw new Error('mp4: over 4 GB — record a shorter or smaller film');

  const ftyp = box('ftyp', new Bytes().str('isom').u32(0x200).str('isom').str('iso2').str('avc1').str('mp41').out());

  const mvhd = box('mvhd', full(0, 0).u32(0).u32(0).u32(MP4_TIMESCALE).u32(duration).u32(0x00010000).u16(0x0100).zeros(2).zeros(8)
    .bytes(MATRIX_UNITY.flatMap(v => [(v >>> 24) & 0xff, (v >>> 16) & 0xff, (v >>> 8) & 0xff, v & 0xff])).zeros(24).u32(2).out());
  const tkhd = box('tkhd', full(0, 3).u32(0).u32(0).u32(1).zeros(4).u32(duration).zeros(8).u16(0).u16(0).u16(0).zeros(2)
    .bytes(MATRIX_UNITY.flatMap(v => [(v >>> 24) & 0xff, (v >>> 16) & 0xff, (v >>> 8) & 0xff, v & 0xff])).u32(width * 0x10000).u32(height * 0x10000).out());
  // an edit list only when reordering pushed the first frame's composition time past 0: play from that time
  const edts = needCtts && shifted[0] > 0
    ? box('edts', box('elst', full(0, 0).u32(1).u32(duration).u32(shifted[0]).u16(1).u16(0).out())) : null;
  const mdhd = box('mdhd', full(0, 0).u32(0).u32(0).u32(MP4_TIMESCALE).u32(duration).u16(0x55c4).u16(0).out());   // 'und'
  const hdlr = box('hdlr', full(0, 0).u32(0).str('vide').zeros(12).str('VideoHandler').u8(0).out());
  const vmhd = box('vmhd', full(0, 1).u16(0).zeros(6).out());
  const dinf = box('dinf', box('dref', full(0, 0).u32(1).out(), box('url ', full(0, 1).out())));

  const extras: Uint8Array[] = [box('avcC', avcC)];
  if (colour && (colour.primaries || colour.transfer || colour.matrix)) {
    extras.push(box('colr', new Bytes().str('nclx').u16(PRIMARIES[colour.primaries || ''] ?? 2).u16(TRANSFER[colour.transfer || ''] ?? 2)
      .u16(MATRIX[colour.matrix || ''] ?? 2).u8(colour.fullRange ? 0x80 : 0).out()));
  }
  extras.push(box('pasp', new Bytes().u32(1).u32(1).out()));
  const name = 'AVC Coding';
  const avc1 = box('avc1', new Bytes().zeros(6).u16(1).u16(0).u16(0).zeros(12).u16(width).u16(height).u32(0x00480000).u32(0x00480000)
    .u32(0).u16(1).u8(name.length).str(name).zeros(31 - name.length).u16(0x0018).i16(-1).out(), ...extras);
  const stsd = box('stsd', full(0, 0).u32(1).out(), avc1);
  const stts = box('stts', full(0, 0).u32(1).u32(n).u32(delta).out());
  let ctts: Uint8Array | null = null;
  if (needCtts) {
    const runs: Array<[number, number]> = [];
    for (const o of shifted) { const last = runs[runs.length - 1]; if (last && last[1] === o) last[0]++; else runs.push([1, o]); }
    const b = full(0, 0).u32(runs.length); for (const [c, o] of runs) b.u32(c).u32(o);
    ctts = box('ctts', b.out());
  }
  const keys = samples.map((s, i) => (s.key ? i + 1 : 0)).filter(Boolean);
  const stssB = full(0, 0).u32(keys.length); for (const k of keys) stssB.u32(k);
  const stss = box('stss', stssB.out());
  const stsc = box('stsc', full(0, 0).u32(1).u32(1).u32(n).u32(1).out());
  const stszB = full(0, 0).u32(0).u32(n); for (const s of samples) stszB.u32(s.data.length);
  const stsz = box('stsz', stszB.out());

  const build = (chunkOffset: number) => {
    const stco = box('stco', full(0, 0).u32(1).u32(chunkOffset).out());
    const stbl = box('stbl', ...[stsd, stts, ctts, stss, stsc, stsz, stco].filter(Boolean) as Uint8Array[]);
    const minf = box('minf', vmhd, dinf, stbl);
    const mdia = box('mdia', mdhd, hdlr, minf);
    const trak = box('trak', ...[tkhd, edts, mdia].filter(Boolean) as Uint8Array[]);
    return box('moov', mvhd, trak);
  };
  const moovLen = build(0).length;   // the offset field is fixed width, so the length does not depend on its value
  const moov = build(ftyp.length + moovLen + 8);

  const out = new Uint8Array(ftyp.length + moov.length + 8 + mdatBytes);
  let o = 0;
  out.set(ftyp, o); o += ftyp.length;
  out.set(moov, o); o += moov.length;
  out.set(new Bytes().u32(8 + mdatBytes).str('mdat').out(), o); o += 8;
  for (const s of samples) { out.set(s.data, o); o += s.data.length; }
  return out;
}

// ---- reading one back (the tests, and a sanity check after a recording) -----------------------------------------
export type Mp4Box = { type: string; start: number; size: number; children?: Mp4Box[] };
const CONTAINERS = new Set(['moov', 'trak', 'mdia', 'minf', 'stbl', 'edts', 'dinf']);
/** The box tree of an MP4 (containers opened, leaves left as byte ranges). */
export function mp4Boxes(buf: Uint8Array, from = 0, to = buf.length): Mp4Box[] {
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength), out: Mp4Box[] = [];
  for (let p = from; p + 8 <= to;) {
    const size = dv.getUint32(p), type = String.fromCharCode(buf[p + 4], buf[p + 5], buf[p + 6], buf[p + 7]);
    if (size < 8 || p + size > to) throw new Error(`mp4: bad box ${type} at ${p}`);
    const b: Mp4Box = { type, start: p, size };
    if (CONTAINERS.has(type)) b.children = mp4Boxes(buf, p + 8, p + size);
    out.push(b); p += size;
  }
  return out;
}
/** What the file says about itself: sample count, duration in seconds, sync samples, and its frame rate. */
export function mp4Summary(buf: Uint8Array): { samples: number; duration: number; keyframes: number; fps: number; width: number; height: number } {
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  const find = (bs: Mp4Box[], path: string[]): Mp4Box | null => {
    let cur: Mp4Box | null = null, list = bs;
    for (const t of path) { cur = list.find(b => b.type === t) || null; if (!cur) return null; list = cur.children || []; }
    return cur;
  };
  const top = mp4Boxes(buf);
  const stbl = ['moov', 'trak', 'mdia', 'minf', 'stbl'];
  const mdhd = find(top, ['moov', 'trak', 'mdia', 'mdhd'])!, stsz = find(top, [...stbl, 'stsz'])!, stts = find(top, [...stbl, 'stts'])!;
  const stss = find(top, [...stbl, 'stss']), tkhd = find(top, ['moov', 'trak', 'tkhd'])!;
  const timescale = dv.getUint32(mdhd.start + 20), dur = dv.getUint32(mdhd.start + 24);
  const samples = dv.getUint32(stsz.start + 16), delta = dv.getUint32(stts.start + 20);
  return {
    samples, duration: dur / timescale, keyframes: stss ? dv.getUint32(stss.start + 12) : samples, fps: timescale / delta,
    width: dv.getUint32(tkhd.start + 84) / 0x10000, height: dv.getUint32(tkhd.start + 88) / 0x10000,
  };
}
