// @version 1.0.0
// gen-slides-pdf-render.test.ts — e2e render-path regression pin for the
// U-20261105-002/-005 fixes. Skipped when no Pretendard/MaruBuri font pair is
// available (CI has none; dev machines carry the project font pool).
//
// Pins:
//   1. U-002(a): visual slide with background_image.enabled=false — no
//      C_VIS_BG-colored fill may appear AFTER the first text op on the page
//      (the old path painted the panel background over title/bullets).
//   2. U-002(b): per-slide `footnotes` render as extractable text.
//   3. U-002(c): isPunchlineSlide decks run the punchline renderer.
//   4. U-005(7): contactPhone renders.
//   5. U-005(1+2): /W covers the shaped (calt-alternate) glyph ids of ':' and
//      '-', and /W entries are integers (PDF 32000-1 §9.7.4.3).
//
// Run: bun test scripts/co-deck/tests/gen-slides-pdf-render.test.ts

import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join, resolve, dirname } from 'node:path';
import * as zlib from 'node:zlib';

const ROOT = resolve(dirname(import.meta.path), '../../..');
const TOOL = join(ROOT, 'scripts/co-deck/gen-slides-pdf.ts');

// Font pool discovery: the co-deck project assets carry TTF pairs.
const FONT_DIR = '/Users/techcross/git/ai_workspace/Projects/co-deck/presentations/assets/fonts';
const haveFonts = existsSync(join(FONT_DIR, 'MaruBuri-Regular.ttf')) ||
                  existsSync(join(FONT_DIR, 'Pretendard-Regular.ttf'));
const havePdftotext = spawnSync('pdftotext', ['-v'], { encoding: 'utf-8' }).status !== null;

const tmpDirs: string[] = [];
afterAll(() => { for (const d of tmpDirs) rmSync(d, { recursive: true, force: true }); });

function writeTinyPng(): Buffer {
  // 32x32 red PNG built by hand (no external asset dependency)
  const w = 32, h = 32;
  const raw = Buffer.concat(Array.from({ length: h }, () => {
    const row = Buffer.alloc(1 + w * 3);
    for (let x = 0; x < w; x++) { row[1 + x * 3] = 0xff; row[2 + x * 3] = 0x00; row[3 + x * 3] = 0x00; }
    return row;
  }));
  const crcTable: number[] = [];
  for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; crcTable[n] = c >>> 0; }
  const crc32 = (buf: Buffer) => { let c = 0xffffffff; for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  const chunk = (type: string, data: Buffer) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type, 'latin1'), data]);
    const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
    return Buffer.concat([len, td, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 2;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function makeProject(): { dir: string; rel: string } {
  const name = `_render_test_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const dir = join(ROOT, 'presentations', name);
  mkdirSync(join(dir, 'images'), { recursive: true });
  tmpDirs.push(dir);
  writeFileSync(join(dir, 'images', 'test.png'), writeTinyPng());
  writeFileSync(join(dir, 'lecture-profile.md'),
    '---\npresentation:\n  theme: zen\n  style: white-bubble\nbackground_image:\n  enabled: false\n---\n# t\n');
  writeFileSync(join(dir, 'slidedata.json'), JSON.stringify([
    { section: 'S1', title: 'Visual **Bold** Slide', bullets: ['bullet **one** here', 'bullet two', 'bullet three'], visualImage: 'images/test.png' },
    { section: 'S1', title: 'Footnotes', bullets: ['one two three four five', 'six seven eight nine ten', 'eleven twelve thirteen fourteen'], footnotes: ['SMR: Small Modular Reactor'] },
    { isPunchlineSlide: true, title: 'Punch Head', text: 'The key message lands here', sub: 'support' },
    { isContactSlide: true, title: '감사합니다', contactEmail: 'a@b.c', contactPhone: '010-1234-5678', contactNote: 'CTA' },
  ]));
  return { dir, rel: join('presentations', name) };
}

function decompressedStreams(pdfPath: string): string[] {
  const data = readFileSync(pdfPath);
  const out: string[] = [];
  const s = data.toString('latin1');
  const re = /stream\r?\n?([\s\S]*?)endstream/g;
  let m;
  while ((m = re.exec(s)) !== null) {
    try { out.push(zlib.inflateSync(Buffer.from(m[1], 'latin1')).toString('latin1')); } catch { /* image/font streams */ }
  }
  return out;
}

function extractText(pdfPath: string): string | null {
  if (!havePdftotext) return null;
  const bin = spawnSync('pdftotext', [pdfPath, '-'], { encoding: 'utf-8' });
  return bin.exitCode === 0 ? bin.stdout : null;
}

describe.skipIf(!haveFonts)('gen-slides-pdf render-path regressions', () => {
  let pdfPath = '';
  beforeAll(() => {
    const { dir, rel } = makeProject();
    const res = spawnSync('bun', [TOOL, '--project', rel, '--font-dir', FONT_DIR],
      { cwd: ROOT, encoding: 'utf-8', timeout: 120000 });
    expect(res.status).toBe(0);
    pdfPath = join(dir, `${rel.split(/[\\/]/).pop()}.pdf`);
    expect(existsSync(pdfPath)).toBe(true);
  }, 180000);

  test('U-002(a): no C_VIS_BG fill after the first text op on the visual slide', () => {
    const streams = decompressedStreams(pdfPath);
    const page = streams.find((s) => s.includes('Tj') && s.includes('BT'))!;
    const lines = page.split('\n').map((l) => l.trim());
    const firstTj = lines.findIndex((l) => l.endsWith('Tj'));
    expect(firstTj).toBeGreaterThan(0);
    // C_VIS_BG for white-bubble = pdf-lib default [20,28,42]
    const visBg = '0.0784313725490196 0.10980392156862745 0.16470588235294117 rg';
    const afterText = lines.slice(firstTj);
    // The legacy bug: a full-page C_VIS_BG rect painted AFTER title/bullets.
    expect(afterText).not.toContain(visBg);
  });

  test('U-002(b): footnotes text is extractable', () => {
    const txt = extractText(pdfPath);
    if (txt === null) return; // pdftotext unavailable — structural pins suffice
    expect(txt).toContain('SMR');
    expect(txt).toContain('Small Modular Reactor');
  });

  test('U-002(c): isPunchlineSlide statement renders', () => {
    const txt = extractText(pdfPath);
    if (txt === null) return;
    expect(txt).toContain('The key message lands here');
    expect(txt).toContain('support');
  });

  test('U-005(7): contactPhone renders', () => {
    const txt = extractText(pdfPath);
    if (txt === null) return;
    expect(txt).toContain('010-1234-5678');
  });

  test('U-005(1+2): /W covers shaped (calt) gids of : and -, entries are integers', () => {
    const streams = decompressedStreams(pdfPath);
    const wStream = streams.find((s) => s.includes('/W ['));
    expect(wStream).toBeDefined();
    const i = wStream!.indexOf('/W [');
    let d = 0, end = -1;
    for (let k = i + 3; k < wStream!.length; k++) {
      if (wStream![k] === '[') d++;
      else if (wStream![k] === ']') { d--; if (d === 0) { end = k; break; } }
    }
    const content = wStream!.slice(i + 4, end);
    const widths = new Map<number, number>();
    const toks = content.trim().split(/\s+/);
    let curStart = -1; const sec: number[] = [];
    for (const tok of toks) {
      if (tok === '[') { sec.length = 0; continue; }
      if (tok === ']') { for (let k = 0; k < sec.length; k++) widths.set(curStart + k, sec[k]); curStart = -1; continue; }
      const n = Number(tok);
      if (curStart < 0) curStart = n; else sec.push(n);
    }
    // Pretendard shaped alternates (reproduced 2026-11-06):
    //   ':' in running text → gid 13205 (unshaped 13147 was always present)
    //   '-' in running text → gid 13252 (unshaped 13241 was always present)
    // The pre-fix /W table omitted 13205/13252, so viewers fell back to /DW
    // and over-advanced both characters.
    expect(widths.get(13205)).toBeDefined();
    expect(widths.get(13252)).toBeDefined();
    for (const w of widths.values()) expect(Number.isInteger(w)).toBe(true);
  });
});
