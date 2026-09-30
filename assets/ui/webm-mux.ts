// A minimal WebM (Matroska) writer for one VP9 video track — the Record button's fallback where the browser has no
// H.264 encoder (assets/ui/recorder.ts). Ours, like mp4-mux.ts: EBML header · Segment { Info · Tracks · Cluster… ·
// Cues }, one SimpleBlock per frame, a new Cluster at every keyframe, and a Cues index so a player can seek.
//
//   muxWebm({ width, height, fps, codec: 'V_VP9', samples: [{ data, key, pts }] }) → Uint8Array
//
// Block times are whole milliseconds (TimestampScale 1 ms), rounded from each sample's pts (µs); the Info Duration
// and each track's DefaultDuration carry the exact film length and frame period. Deterministic, THREE-free, DOM-free.

export type Sample = { data: Uint8Array; key: boolean; pts: number };
export type WebmInput = { width: number; height: number; fps: number; codec?: string; samples: Sample[] };

// ---- EBML ---------------------------------------------------------------------------------------------------------
function idBytes(id: number): number[] {
  const out: number[] = [];
  for (let v = id; v > 0; v = Math.floor(v / 256)) out.unshift(v & 0xff);
  return out;
}
/** an EBML variable-size integer: the shortest length that holds v (all-ones is reserved for "unknown") */
function vint(v: number): number[] {
  for (let len = 1; len <= 8; len++) {
    if (v < 2 ** (7 * len) - 1) {
      const out = new Array(len).fill(0);
      let x = v;
      for (let i = len - 1; i >= 0; i--) { out[i] = x % 256; x = Math.floor(x / 256); }
      out[0] |= 0x80 >> (len - 1);
      return out;
    }
  }
  throw new Error('webm: size too large');
}
function uintBytes(v: number): number[] {
  const out: number[] = [];
  for (let x = v; x > 0; x = Math.floor(x / 256)) out.unshift(x % 256);
  return out.length ? out : [0];
}
type Node = Uint8Array;
function concat(parts: Node[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((a, p) => a + p.length, 0));
  let o = 0;
  for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
}
function el(id: number, payload: Node | Node[]): Node {
  const body = Array.isArray(payload) ? concat(payload) : payload;
  return concat([Uint8Array.from([...idBytes(id), ...vint(body.length)]), body]);
}
const uint = (id: number, v: number) => el(id, Uint8Array.from(uintBytes(v)));
const str = (id: number, s: string) => el(id, Uint8Array.from([...s].map(c => c.charCodeAt(0) & 0xff)));
function float64(id: number, v: number): Node {
  const b = new Uint8Array(8); new DataView(b.buffer).setFloat64(0, v);
  return el(id, b);
}

const ID = {
  EBML: 0x1a45dfa3, EBMLVersion: 0x4286, EBMLReadVersion: 0x42f7, EBMLMaxIDLength: 0x42f2, EBMLMaxSizeLength: 0x42f3,
  DocType: 0x4282, DocTypeVersion: 0x4287, DocTypeReadVersion: 0x4285,
  Segment: 0x18538067, Info: 0x1549a966, TimestampScale: 0x2ad7b1, MuxingApp: 0x4d80, WritingApp: 0x5741, Duration: 0x4489,
  Tracks: 0x1654ae6b, TrackEntry: 0xae, TrackNumber: 0xd7, TrackUID: 0x73c5, TrackType: 0x83, FlagLacing: 0x9c, CodecID: 0x86,
  DefaultDuration: 0x23e383, Video: 0xe0, PixelWidth: 0xb0, PixelHeight: 0xba,
  Cluster: 0x1f43b675, Timestamp: 0xe7, SimpleBlock: 0xa3,
  Cues: 0x1c53bb6b, CuePoint: 0xbb, CueTime: 0xb3, CueTrackPositions: 0xb7, CueTrack: 0xf7, CueClusterPosition: 0xf1,
};

export function muxWebm({ width, height, fps, codec = 'V_VP9', samples }: WebmInput): Uint8Array {
  if (!samples.length) throw new Error('webm: no samples');
  const durationMs = samples.length * 1000 / fps;
  const ebml = el(ID.EBML, [uint(ID.EBMLVersion, 1), uint(ID.EBMLReadVersion, 1), uint(ID.EBMLMaxIDLength, 4), uint(ID.EBMLMaxSizeLength, 8),
    str(ID.DocType, 'webm'), uint(ID.DocTypeVersion, 4), uint(ID.DocTypeReadVersion, 2)]);
  const info = el(ID.Info, [uint(ID.TimestampScale, 1e6), str(ID.MuxingApp, 'ci-virtual-home'), str(ID.WritingApp, 'ci-virtual-home'), float64(ID.Duration, durationMs)]);
  const tracks = el(ID.Tracks, el(ID.TrackEntry, [uint(ID.TrackNumber, 1), uint(ID.TrackUID, 1), uint(ID.TrackType, 1), uint(ID.FlagLacing, 0),
    str(ID.CodecID, codec), uint(ID.DefaultDuration, Math.round(1e9 / fps)), el(ID.Video, [uint(ID.PixelWidth, width), uint(ID.PixelHeight, height)])]));

  // clusters: one per keyframe run (and never a block more than 32 s after its cluster's time)
  const clusters: Array<{ time: number; blocks: Node[] }> = [];
  for (const s of samples) {
    const ms = Math.round(s.pts / 1000);
    let c = clusters[clusters.length - 1];
    if (!c || s.key || ms - c.time > 32000) { c = { time: ms, blocks: [] }; clusters.push(c); }
    const rel = ms - c.time;
    const head = Uint8Array.from([0x81, (rel >> 8) & 0xff, rel & 0xff, s.key ? 0x80 : 0x00]);
    c.blocks.push(el(ID.SimpleBlock, concat([head, s.data])));
  }
  const clusterNodes = clusters.map(c => el(ID.Cluster, [uint(ID.Timestamp, c.time), ...c.blocks]));
  // Cues: each cluster's position, relative to the start of the Segment's data
  let pos = info.length + tracks.length;
  const cuePoints: Node[] = [];
  clusters.forEach((c, i) => {
    cuePoints.push(el(ID.CuePoint, [uint(ID.CueTime, c.time), el(ID.CueTrackPositions, [uint(ID.CueTrack, 1), uint(ID.CueClusterPosition, pos)])]));
    pos += clusterNodes[i].length;
  });
  const cues = el(ID.Cues, cuePoints);
  const segment = el(ID.Segment, [info, tracks, ...clusterNodes, cues]);
  return concat([ebml, segment]);
}
