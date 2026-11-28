// @version 1.0.0
// theme-visual-regression.pixel-diff.test.ts — U-20261128-002 fixture tests.
//
// Pins the comparator's corrected behaviour at the unit level:
//   1. Bimodal PNG pair — SAME pixels, different byte lengths (the same image
//      deflate-encoded at level 9 and level 0) — must PASS at the suite's 0.5%
//      threshold (previously scored 100% by the size-mismatch early-return).
//   2. Genuine pixel regression — a real content band overwritten — must FAIL
//      the 0.5% threshold.
//   3. Dimension mismatch / undecodable input — fail closed at diffRatio 1.
//   4. Real Chromium baseline — the decoder handles adaptive-filtered
//      screenshot PNGs and discriminates real content (self-compare identical,
//      cross-slide diff far above threshold).
//
// The PNG fixtures are encoded in-file (no fixture binaries): filter-None
// scanlines + zlib deflate at two levels guarantees the bimodal byte lengths.

import { describe, expect, test } from 'bun:test';
import { deflateSync } from 'node:zlib';
import { existsSync } from 'fs';
import { join, dirname } from 'path';

import { comparePngBuffers, countDifferingPixels, decodePng } from './theme-visual-regression.pixel-diff.mjs';

// ── Minimal PNG encoder (8-bit RGBA, filter 0) for fixtures ────────────

const PNG_SIG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, 'ascii');
  Buffer.from(data).copy(out, 8);
  out.writeUInt32BE(crc32(out.subarray(4, 8 + data.length)), 8 + data.length);
  return out;
}

function encodePng(width, height, rgba, zlibOpts) {
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  const src = Buffer.from(rgba.buffer, rgba.byteOffset, rgba.byteLength);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0; // filter None
    src.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  return Buffer.concat([PNG_SIG, chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw, zlibOpts)), chunk('IEND', Buffer.alloc(0))]);
}

// Deterministic, compression-friendly pixels: smooth gradients + solid bands
// (like a real slide, so the two deflate levels produce clearly bimodal sizes).
function gradientPixels(width, height) {
  const px = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      px[i] = (x * 255) / width;
      px[i + 1] = (y * 255) / height;
      px[i + 2] = x < width / 4 ? 40 : 200; // solid band for compressibility
      px[i + 3] = 255;
    }
  }
  return px;
}

const W = 64;
const H = 64;
const THRESHOLD = 0.005; // the suite's DEFAULT_THRESHOLD

const PIXELS = gradientPixels(W, H);
// Same pixels, two encodings → guaranteed different byte lengths (bimodal).
const PNG_LEVEL9 = encodePng(W, H, PIXELS, { level: 9 });
const PNG_LEVEL0 = encodePng(W, H, PIXELS, { level: 0 });

// Genuine regression: an 8-row band (12.5% of pixels) overwritten with solid red.
function regressedPixels() {
  const px = Uint8Array.from(PIXELS);
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4;
      px[i] = 255; px[i + 1] = 0; px[i + 2] = 0; px[i + 3] = 255;
    }
  }
  return px;
}
const PNG_REGRESSED = encodePng(W, H, regressedPixels(), { level: 9 });

describe('pixel-diff fixtures — bimodal pair (U-20261128-002)', () => {
  test('fixture sanity: same pixels, different byte lengths', () => {
    expect(PNG_LEVEL9.length).not.toBe(PNG_LEVEL0.length);
  });

  test('re-encoded same-pixels PNG passes at the 0.5% threshold (was 100% under the old early-return)', () => {
    const r = comparePngBuffers(PNG_LEVEL9, PNG_LEVEL0);
    expect(r.identical).toBe(true);
    expect(r.diffRatio).toBe(0);
    // The comparator's judgment path: identical → pass; even without the
    // identical short-circuit, the ratio clears the suite threshold.
    expect(r.diffRatio <= THRESHOLD).toBe(true);
  });

  test('the byte lengths really are bimodal (fall-through would have been skipped before)', () => {
    // Under the old comparator this pair scored diffRatio 1 purely on length;
    // pin that the lengths differ so this test keeps exercising the fixed path.
    expect(PNG_LEVEL9.length).toBeLessThan(PNG_LEVEL0.length);
  });
});

describe('pixel-diff fixtures — genuine regression', () => {
  test('real content change (12.5% band) fails the 0.5% threshold', () => {
    const r = comparePngBuffers(PNG_REGRESSED, PNG_LEVEL9);
    expect(r.identical).toBe(false);
    expect(r.diffRatio).toBeGreaterThan(THRESHOLD);
    expect(r.diffPixels).toBe(8 * W);
    expect(r.totalPixels).toBe(W * H);
  });

  test('sub-threshold pixel noise (one row = 1.5%) is distinguishable from the regression', () => {
    const px = Uint8Array.from(PIXELS);
    for (let x = 0; x < W; x++) {
      px[x * 4 + 3] = 0; // alpha drop on one row — delta 255 on every pixel of the row
    }
    const r = comparePngBuffers(encodePng(W, H, px, { level: 9 }), PNG_LEVEL9);
    expect(r.diffPixels).toBe(W);
    expect(r.diffRatio).toBeCloseTo(1 / H, 5);
    expect(r.diffRatio).toBeGreaterThan(THRESHOLD); // 1/64 = 1.56% > 0.5% → fails
  });
});

describe('pixel-diff — tolerance and fail-closed semantics', () => {
  test('channel delta of exactly 8 counts as identical; 9 counts as differing', () => {
    const base = { width: 1, height: 1, channels: 4, rgba: Uint8Array.from([100, 100, 100, 255]) };
    const atTolerance = { width: 1, height: 1, channels: 4, rgba: Uint8Array.from([108, 100, 100, 255]) };
    const overTolerance = { width: 1, height: 1, channels: 4, rgba: Uint8Array.from([109, 100, 100, 255]) };
    expect(countDifferingPixels(base, atTolerance)).toBe(0);
    expect(countDifferingPixels(base, overTolerance)).toBe(1);
  });

  test('dimension mismatch fails closed at diffRatio 1', () => {
    const r = comparePngBuffers(PNG_LEVEL9, encodePng(32, H, gradientPixels(32, H), { level: 9 }));
    expect(r.diffRatio).toBe(1);
    expect(r.reason).toContain('dimension mismatch');
  });

  test('undecodable input fails closed at diffRatio 1', () => {
    const r = comparePngBuffers(Buffer.from('not a png at all'), PNG_LEVEL9);
    expect(r.diffRatio).toBe(1);
    expect(r.reason).toContain('pixel comparison unavailable');
  });
});

describe('pixel-diff — real Chromium baselines (adaptive-filter decode)', () => {
  const baselinesRoot = join(dirname(import.meta.path), '../../../docs/html-themes/baselines');
  const slide1 = join(baselinesRoot, 'outline', 'classic', 'slide-1.png');
  const slide2 = join(baselinesRoot, 'outline', 'classic', 'slide-2.png');

  test('a real screenshot decodes at canonical viewport and self-compares identical', () => {
    if (!existsSync(slide1)) {
      console.log('skip: no committed baseline at outline/classic');
      return;
    }
    const buf = require('fs').readFileSync(slide1);
    const img = decodePng(buf);
    expect(img.width).toBe(1280);
    expect(img.height).toBe(720);
    const r = comparePngBuffers(buf, buf);
    expect(r.identical).toBe(true);
    expect(r.diffRatio).toBe(0);
  });

  test('two genuinely different slides diff far above the threshold', () => {
    if (!existsSync(slide1) || !existsSync(slide2)) {
      console.log('skip: no committed baselines at outline/classic');
      return;
    }
    const fs = require('fs');
    const r = comparePngBuffers(fs.readFileSync(slide1), fs.readFileSync(slide2));
    expect(r.identical).toBe(false);
    expect(r.diffRatio).toBeGreaterThan(THRESHOLD);
  });
});
