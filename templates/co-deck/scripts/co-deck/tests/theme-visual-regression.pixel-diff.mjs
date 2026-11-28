// @version 1.0.0
// theme-visual-regression.pixel-diff.mjs — true pixel-level PNG comparison for
// the visual-regression comparator (U-20261128-002).
//
// WHY THIS EXISTS: the comparator used to score ANY PNG byte-length mismatch as
// a 100% diff ("different size = definitely different"). A handful of
// antialiasing-noise pixels cascades through DEFLATE, so nearly every
// non-identical re-render of the same slide has a different byte length —
// measured on the co-deck baselines: 0.058–0.068% actual pixel diff scored as
// 100%. Same-pixels-different-bytes captures (re-encoded or noise-touched) are
// now decoded and compared by pixels; only genuinely different images fail.
//
// Scope: pure functions, no side effects — importable from both the browser
// script (theme-visual-regression.browser.mjs) and bun tests. Decode supports
// 8-bit non-interlaced PNG (color types 0/2/4/6 — Chromium screenshot output);
// anything else fails closed via comparePngBuffers' diffRatio 1.
//
// Tolerance: a pixel counts as differing when any compared channel delta
// exceeds 8 (the ticket forensics' measurement basis — the AA-noise class sits
// at channel deltas ≤ 44 over 0.068% of pixels, far under the suite's 0.5%
// threshold either way; the tolerance only stops single-quantum rasterizer
// jitter from counting).

import { inflateSync } from 'node:zlib';

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

export function decodePng(buf) {
  if (!PNG_SIGNATURE.equals(buf.subarray(0, 8))) throw new Error('not a PNG (bad signature)');
  let off = 8;
  let width = 0, height = 0, bitDepth = 0, colorType = 0, interlace = 0;
  const idat = [];
  while (off + 8 <= buf.length) {
    const len = buf.readUInt32BE(off);
    const type = buf.toString('ascii', off + 4, off + 8);
    if (off + 12 + len > buf.length) throw new Error(`truncated ${type} chunk`);
    const data = buf.subarray(off + 8, off + 8 + len);
    if (type === 'IHDR') {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      bitDepth = data[8];
      colorType = data[9];
      interlace = data[12];
    } else if (type === 'IDAT') {
      idat.push(data);
    } else if (type === 'IEND') {
      break;
    }
    off += 12 + len; // length + type + data + CRC
  }
  if (!width || !height) throw new Error('IHDR missing or empty dimensions');
  if (idat.length === 0) throw new Error('no IDAT chunks');
  if (bitDepth !== 8) throw new Error(`unsupported bit depth ${bitDepth} (only 8)`);
  if (interlace !== 0) throw new Error('interlaced PNG not supported');
  const channels = { 0: 1, 2: 3, 4: 2, 6: 4 }[colorType];
  if (!channels) throw new Error(`unsupported color type ${colorType}`);
  const raw = inflateSync(Buffer.concat(idat));
  const stride = width * channels;
  if (raw.length < (stride + 1) * height) throw new Error('truncated pixel data');

  // Undo the per-scanline filters (0 None, 1 Sub, 2 Up, 3 Average, 4 Paeth).
  const out = Buffer.alloc(stride * height);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)];
    const src = y * (stride + 1) + 1;
    const dst = y * stride;
    for (let x = 0; x < stride; x++) {
      const v = raw[src + x];
      const left = x >= channels ? out[dst + x - channels] : 0;
      const up = y > 0 ? out[dst + x - stride] : 0;
      const ul = y > 0 && x >= channels ? out[dst + x - stride - channels] : 0;
      let rec;
      if (filter === 0) rec = v;
      else if (filter === 1) rec = v + left;
      else if (filter === 2) rec = v + up;
      else if (filter === 3) rec = v + ((left + up) >> 1);
      else {
        const p = left + up - ul;
        const pa = Math.abs(p - left), pb = Math.abs(p - up), pc = Math.abs(p - ul);
        rec = v + (pa <= pb && pa <= pc ? left : pb <= pc ? up : ul);
      }
      out[dst + x] = rec & 0xff;
    }
  }
  return { width, height, channels, rgba: out };
}

export function countDifferingPixels(a, b, tolerance = 8) {
  if (a.width !== b.width || a.height !== b.height) {
    throw new Error(`dimension mismatch: ${a.width}x${a.height} vs ${b.width}x${b.height}`);
  }
  const ch = Math.min(a.channels, b.channels);
  const { width, height } = a;
  let diff = 0;
  for (let i = 0; i < width * height; i++) {
    for (let c = 0; c < ch; c++) {
      if (Math.abs(a.rgba[i * a.channels + c] - b.rgba[i * b.channels + c]) > tolerance) {
        diff++;
        break;
      }
    }
  }
  return diff;
}

// Compare two PNG byte buffers at the pixel level. Never throws: an
// undecodable PNG or a dimension mismatch scores diffRatio 1 (fail-closed —
// the caller's threshold judgment then fails the slide).
export function comparePngBuffers(actualBuf, baselineBuf, tolerance = 8) {
  try {
    const actual = decodePng(actualBuf);
    const baseline = decodePng(baselineBuf);
    if (actual.width !== baseline.width || actual.height !== baseline.height) {
      return {
        identical: false,
        diffRatio: 1,
        reason: `dimension mismatch: actual ${actual.width}x${actual.height} vs baseline ${baseline.width}x${baseline.height}`,
      };
    }
    const totalPixels = actual.width * actual.height;
    if (totalPixels === 0) return { identical: true, diffRatio: 0 };
    const diffPixels = countDifferingPixels(actual, baseline, tolerance);
    return {
      identical: diffPixels === 0,
      diffRatio: diffPixels / totalPixels,
      diffPixels,
      totalPixels,
      pixelTolerance: tolerance,
    };
  } catch (e) {
    return { identical: false, diffRatio: 1, reason: `pixel comparison unavailable: ${e.message}` };
  }
}
