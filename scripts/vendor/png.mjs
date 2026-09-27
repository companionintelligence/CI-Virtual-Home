// Minimal PNG codec — encode and decode 8-bit truecolour, non-interlaced, on node:zlib alone.
//
// First-party (not vendored from anywhere; it lives beside pixelmatch because the golden gate uses both).
// The capture scripts' only runtime dependency is Playwright; everything else is a Node built-in. There is
// no image package in package.json to reach for, and pngjs would be a new direct dependency for one job
// that zlib already does.
//
// Decode handles what any encoder may emit for a truecolour 8-bit image: colour type 2 (RGB) or 6 (RGBA),
// all five scanline filters, and any number of IDAT chunks. It rejects interlaced, paletted, 16-bit and
// greyscale files rather than guessing — nothing in this pipeline writes them.
//
// Encode takes RGBA and writes colour type 2, dropping the alpha channel, because readPixels on this
// pipeline's opaque canvas returns a constant 255 (asserted below, not assumed) — a quarter of every golden
// would otherwise be a wasted channel. Scanlines are Paeth-filtered: on renders like these, per-scanline
// prediction beats storing raw by a third or more, and the decoder already reconstructs all five filters.

import zlib from 'node:zlib';

const SIG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

// CRC-32 over the chunk type + data, per the PNG spec's own table formulation
const CRC = new Int32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  CRC[n] = c;
}
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const out = Buffer.alloc(data.length + 12);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, 'ascii');
  data.copy(out, 8);
  const body = out.subarray(4, 8 + data.length);
  out.writeUInt32BE(crc32(body), 8 + data.length);
  return out;
}

/**
 * RGBA bytes (w * h * 4) → a PNG buffer, colour type 2 (RGB), Paeth-filtered.
 * Throws if any alpha is not 255: dropping the channel is only lossless while that holds, and a silent
 * change to the canvas (a transparent background mode, say) must not quietly corrupt a baseline.
 */
export function encodePNG(rgba, width, height, { level = 9 } = {}) {
  if (rgba.length !== width * height * 4) throw new Error(`encodePNG: got ${rgba.length} bytes for ${width}×${height} RGBA (want ${width * height * 4})`);
  for (let i = 3; i < rgba.length; i += 4) if (rgba[i] !== 255) throw new Error(`encodePNG: alpha ${rgba[i]} at pixel ${(i - 3) / 4} — this encoder writes opaque RGB only`);

  const stride = width * 3;
  const raw = Buffer.alloc((stride + 1) * height);
  let prev = Buffer.alloc(stride);                                  // the previous row, already un-filtered
  const row = Buffer.alloc(stride);
  for (let y = 0; y < height; y++) {
    for (let x = 0, s = y * width * 4; x < stride; x += 3, s += 4) { row[x] = rgba[s]; row[x + 1] = rgba[s + 1]; row[x + 2] = rgba[s + 2]; }
    const o = y * (stride + 1);
    raw[o] = 4;                                                     // filter: Paeth
    for (let x = 0; x < stride; x++) {
      const a = x >= 3 ? row[x - 3] : 0, b = prev[x], c = x >= 3 ? prev[x - 3] : 0;
      const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
      raw[o + 1 + x] = (row[x] - (pa <= pb && pa <= pc ? a : pb <= pc ? b : c)) & 0xff;
    }
    row.copy(prev);
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0); ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;    // bit depth
  ihdr[9] = 2;    // colour type: truecolour, no alpha
  ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;   // deflate / adaptive filtering / no interlace
  return Buffer.concat([SIG, chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw, { level })), chunk('IEND', Buffer.alloc(0))]);
}

/** A PNG buffer → { width, height, data } with data as RGBA bytes. */
export function decodePNG(buf) {
  if (buf.length < 8 || !buf.subarray(0, 8).equals(SIG)) throw new Error('decodePNG: not a PNG');
  let width = 0, height = 0, depth = 0, colour = 0, interlace = 0;
  const idat = [];
  for (let p = 8; p + 8 <= buf.length;) {
    const len = buf.readUInt32BE(p), type = buf.toString('ascii', p + 4, p + 8), data = buf.subarray(p + 8, p + 8 + len);
    if (type === 'IHDR') {
      width = data.readUInt32BE(0); height = data.readUInt32BE(4);
      depth = data[8]; colour = data[9]; interlace = data[12];
    } else if (type === 'IDAT') idat.push(data);
    else if (type === 'IEND') break;
    p += 12 + len;
  }
  if (depth !== 8) throw new Error(`decodePNG: bit depth ${depth} (only 8 is supported)`);
  if (colour !== 2 && colour !== 6) throw new Error(`decodePNG: colour type ${colour} (only 2 and 6 are supported)`);
  if (interlace) throw new Error('decodePNG: interlaced');
  if (!idat.length) throw new Error('decodePNG: no IDAT');

  const ch = colour === 6 ? 4 : 3;                                  // bytes per pixel in the file
  const stride = width * ch;
  const raw = zlib.inflateSync(Buffer.concat(idat));
  if (raw.length < (stride + 1) * height) throw new Error(`decodePNG: ${raw.length} inflated bytes for ${width}×${height}`);

  // Un-filter in place, row by row: every filter reads the already-reconstructed row above.
  const out = Buffer.alloc(stride * height);
  for (let y = 0; y < height; y++) {
    const ft = raw[y * (stride + 1)];
    const src = y * (stride + 1) + 1, dst = y * stride, up = dst - stride;
    for (let x = 0; x < stride; x++) {
      const v = raw[src + x];
      const a = x >= ch ? out[dst + x - ch] : 0;                    // left
      const b = y > 0 ? out[up + x] : 0;                            // above
      const c = y > 0 && x >= ch ? out[up + x - ch] : 0;            // upper left
      let recon;
      if (ft === 0) recon = v;
      else if (ft === 1) recon = v + a;
      else if (ft === 2) recon = v + b;
      else if (ft === 3) recon = v + ((a + b) >> 1);
      else if (ft === 4) {                                          // Paeth
        const pp = a + b - c, pa = Math.abs(pp - a), pb = Math.abs(pp - b), pc = Math.abs(pp - c);
        recon = v + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c);
      } else throw new Error(`decodePNG: filter ${ft} on row ${y}`);
      out[dst + x] = recon & 0xff;
    }
  }
  if (ch === 4) return { width, height, data: out };
  const rgba = Buffer.alloc(width * height * 4);                    // widen RGB to RGBA
  for (let i = 0, j = 0; i < out.length; i += 3, j += 4) { rgba[j] = out[i]; rgba[j + 1] = out[i + 1]; rgba[j + 2] = out[i + 2]; rgba[j + 3] = 255; }
  return { width, height, data: rgba };
}
