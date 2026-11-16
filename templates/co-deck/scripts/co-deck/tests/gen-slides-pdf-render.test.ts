// @version 1.5.0 — v1.14.9 pins: photo-aware scrim + body-navy ink when a
//   background was drawn (legacy grey without), tall-card × long-gloss ladder
//   pin (no drop, full text, Tm in-page)
// @version 1.4.0 — v1.14.8 footnote-wrap pin (long gloss list wraps upward and
//   stays fully in the extracted text layer; no bottom-of-page clipping)
// @version 1.3.0 — v1.14.7 background resolution precedence pins (scope-all
//   per-slide binding wins, workspace-relative global pool base, divider
//   image-before-text paint order) on top of the v1.14.6 profile pins
// @version 1.2.0 — v1.14.6 profile-slide background parity pins (bgDrawn card +
//   skipped C_BG repaint; legacy no-background path unchanged)
// @version 1.1.0 — punchline **keyword** bold-accent (v1.14.5) no literal asterisks
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
const FONT_DIR = join(ROOT, 'deliverables/assets/fonts');
const haveFonts = existsSync(join(FONT_DIR, 'MaruBuri-Regular.ttf')) ||
                  existsSync(join(FONT_DIR, 'Pretendard-Regular.ttf'));
const havePdftotext = spawnSync('pdftotext', ['-v'], { encoding: 'utf-8' }).status !== null;
const havePdftoppm  = spawnSync('pdftoppm', ['-v'], { encoding: 'utf-8' }).status !== null;

const tmpDirs: string[] = [];
afterAll(() => { for (const d of tmpDirs) rmSync(d, { recursive: true, force: true }); });

function writeSolidPng(w: number, h: number, [r, g, b]: [number, number, number]): Buffer {
  // Solid-colour PNG built by hand (no external asset dependency)
  const raw = Buffer.concat(Array.from({ length: h }, () => {
    const row = Buffer.alloc(1 + w * 3);
    for (let x = 0; x < w; x++) { row[1 + x * 3] = r; row[2 + x * 3] = g; row[3 + x * 3] = b; }
    return row;
  }));
  const crcTable: number[] = [];
  for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; crcTable[n] = c >>> 0; }
  const crc32 = (buf: Buffer) => { let c = 0xffffffff; for (const x of buf) c = crcTable[(c ^ x) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
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

function writeTinyPng(): Buffer {
  // 32x32 red PNG (legacy fixture used by the U-002/U-005 pins)
  return writeSolidPng(32, 32, [0xff, 0x00, 0x00]);
}

/** Read one pixel from a binary PPM (P6) produced by pdftoppm. */
function readPpmPixel(file: string, fx: number, fy: number): [number, number, number] | null {
  const buf = readFileSync(file);
  let i = 0;
  const readToken = (): string => {
    while (i < buf.length && /[\s]/.test(String.fromCharCode(buf[i]))) i++;
    if (buf[i] === 0x23) { while (i < buf.length && buf[i] !== 0x0a) i++; return readToken(); }
    let s = '';
    while (i < buf.length && !/[\s]/.test(String.fromCharCode(buf[i]))) { s += String.fromCharCode(buf[i]); i++; }
    return s;
  };
  if (readToken() !== 'P6') return null;
  const w = parseInt(readToken(), 10);
  const h = parseInt(readToken(), 10);
  readToken();               // maxval
  i++;                       // single whitespace before the raster
  const x = Math.min(w - 1, Math.floor(w * fx));
  const y = Math.min(h - 1, Math.floor(h * fy));
  const off = i + (y * w + x) * 3;
  if (!Number.isFinite(w) || !Number.isFinite(h) || off + 2 >= buf.length) return null;
  return [buf[off], buf[off + 1], buf[off + 2]];
}

/** Pixel at a page-relative position (fractions), rendered at low DPI. */
function pagePixel(pdfPath: string, page: number, dir: string, fx: number, fy: number) {
  if (!havePdftoppm) return null;
  const root = join(dir, `ppm_${page}`);
  const res = spawnSync('pdftoppm', ['-r', '24', '-f', String(page), '-l', String(page), pdfPath, root],
    { encoding: 'utf-8' });
  if (res.status !== 0) return null;
  const ppm = join(dir, `ppm_${page}-${page}.ppm`);
  if (!existsSync(ppm)) return null;
  return readPpmPixel(ppm, fx, fy);
}

function makeProject(): { dir: string; rel: string } {
  const name = `_render_test_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const dir = join(ROOT, 'deliverables', name);
  mkdirSync(join(dir, 'images'), { recursive: true });
  tmpDirs.push(dir);
  writeFileSync(join(dir, 'images', 'test.png'), writeTinyPng());
  writeFileSync(join(dir, 'lecture-profile.md'),
    '---\npresentation:\n  theme: zen\n  style: white-bubble\nbackground_image:\n  enabled: false\n---\n# t\n');
  writeFileSync(join(dir, 'slidedata.json'), JSON.stringify([
    { section: 'S1', title: 'Visual **Bold** Slide', bullets: ['bullet **one** here', 'bullet two', 'bullet three'], visualImage: 'images/test.png' },
    { section: 'S1', title: 'Footnotes', bullets: ['one two three four five', 'six seven eight nine ten', 'eleven twelve thirteen fourteen'], footnotes: ['SMR: Small Modular Reactor'] },
    { isPunchlineSlide: true, title: 'Punch Head', text: 'The key **message** lands here', sub: 'support' },
    { isContactSlide: true, title: '감사합니다', contactEmail: 'a@b.c', contactPhone: '010-1234-5678', contactNote: 'CTA' },
  ]));
  return { dir, rel: join('deliverables', name) };
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
    expect(txt!.replace(/\s+/g, ' ')).toContain('The key message lands here');
    expect(txt).not.toContain('**');
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

// ── v1.14.6 profile-slide background parity (U-20261114-008/-009) ────────────
//
// renderProfileSlide used to repaint the flat C_BG full-page surface over the
// per-slide background photo the generic loop had just drawn (erasing it), and
// drew the speaker name in C_WHITE — invisible on the white-bubble wash. The
// fix honours ctx.bgDrawn: skip the repaint, draw the white-bubble card behind
// the profile block, name → ink (C_DARK), bio → body ink (C_BODY).
//
// Observability: the generator's CARD_RECTS_OUT env hook reports every
// drawBubbleBehind() rect as page fractions, so the branch is pinned
// structurally instead of by pixel diff.
const WHITE_BUBBLE_BG_OP = '0.9254901960784314 0.9137254901960784 0.8901960784313725 rg'; // background [236,233,227] (C_BG)
const WHITE_CARD_OP      = '1 1 1 rg';                                                    // card_dark [255,255,255] (C_CARD)

describe.skipIf(!haveFonts)('v1.14.6 profile-slide background parity', () => {
  function makeProfileProject(bgDrawn: boolean): { dir: string; rel: string } {
    const name = `_prof_test_${bgDrawn ? 'bg' : 'nobg'}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const dir = join(ROOT, 'deliverables', name);
    mkdirSync(join(dir, 'images'), { recursive: true });
    writeFileSync(join(dir, 'images', 'test.png'), writeTinyPng());
    writeFileSync(join(dir, 'lecture-profile.md'), [
      '---',
      'presentation:',
      '  theme: zen',
      '  style: white-bubble',
      'background_image:',
      `  enabled: ${bgDrawn}`,
      '  scope: individual',
      '  source: download',
      '  overlay:',
      '    color: [0, 0, 0]',
      '    opacity: 0.4',
      '  keywords: []',
      '  fallback_color: null',
      '---',
      '# t',
      '',
    ].join('\n'));
    const slide: Record<string, any> = {
      section: 'Opening',
      isProfileSlide: true,
      title: 'Speaker Intro',
      speakerName: 'Test Speaker',
      speakerTitle: 'Chief Tester',
      speakerBio: 'first bio line\nsecond bio line',
    };
    if (bgDrawn) slide.backgroundImage = 'images/test.png';
    writeFileSync(join(dir, 'slidedata.json'), JSON.stringify([slide]));
    tmpDirs.push(dir);
    return { dir, rel: join('deliverables', name) };
  }

  function renderProfile(bgDrawn: boolean) {
    const { dir, rel } = makeProfileProject(bgDrawn);
    const cardsPath = join(dir, 'cards.json');
    const res = spawnSync('bun', [TOOL, '--project', rel, '--font-dir', FONT_DIR],
      { cwd: ROOT, encoding: 'utf-8', timeout: 120000,
        env: { ...process.env, CARD_RECTS_OUT: cardsPath } });
    expect(res.status).toBe(0);
    const pdfPath = join(dir, `${rel.split(/[\\/]/).pop()}.pdf`);
    expect(existsSync(pdfPath)).toBe(true);
    const cards = existsSync(cardsPath) ? JSON.parse(readFileSync(cardsPath, 'utf-8')) : [];
    // Page-1 content stream (the only page) — the graphic stream that carries
    // glyph text; prefer the one that also carries a drawn image when present.
    const streams = decompressedStreams(pdfPath);
    const page = streams.find((s) => s.includes('Tj') && s.includes('BT') && /\/Image/.test(s))
              ?? streams.find((s) => s.includes('Tj') && s.includes('BT'));
    return { pdfPath, cards, page };
  }

  const bgRun     = renderProfile(true);
  const legacyRun = renderProfile(false);

  const lines = (stream: string) => stream.split('\n').map((l) => l.trim());

  test('bgDrawn: white bubble card is drawn behind the profile block', () => {
    expect(bgRun.cards.length).toBe(1);
    const card = bgRun.cards[0];
    expect(card.n).toBe(1);
    // A card, not a hairline: wide enough to host the bio lines, tall enough
    // for eyebrow + name + affiliation + 2 bio lines.
    expect(card.w).toBeGreaterThan(0.15);
    expect(card.h).toBeGreaterThan(0.15);
    // Horizontally centred (HTML .slide-content is centred in the frame).
    expect(Math.abs(card.x + card.w / 2 - 0.5)).toBeLessThan(0.02);
  });

  test('bgDrawn: the flat C_BG full-page repaint no longer follows the background photo', () => {
    expect(bgRun.page).toBeDefined();
    const ls = lines(bgRun.page!);
    const imgIdx = ls.findIndex((l) => /\/Image/.test(l) && /\bDo$/.test(l));
    expect(imgIdx).toBeGreaterThan(-1);
    // The regression: renderProfileSlide's fillRect(C_BG) painted over the photo.
    const after = ls.slice(imgIdx);
    expect(after).not.toContain(WHITE_BUBBLE_BG_OP);
    // The card + ink text must come AFTER the photo (layering: photo → card → text).
    const cardIdx = after.findIndex((l) => l === WHITE_CARD_OP);
    const firstTj = after.findIndex((l) => l.endsWith('Tj'));
    expect(cardIdx).toBeGreaterThan(-1);
    expect(firstTj).toBeGreaterThan(cardIdx);
  });

  test('bgDrawn: speaker name and bio render (extractable text)', () => {
    const txt = extractText(bgRun.pdfPath);
    if (txt === null) return;
    expect(txt).toContain('Test Speaker');
    expect(txt).toContain('first bio line');
    expect(txt).toContain('second bio line');
  });

  test('legacy (no drawn background): no card is drawn and the flat surface stays', () => {
    expect(legacyRun.cards.length).toBe(0);
    expect(legacyRun.page).toBeDefined();
    // Without an image the flat C_BG surface is still painted (unchanged path).
    expect(lines(legacyRun.page!)).toContain(WHITE_BUBBLE_BG_OP);
  });
});

// ── v1.14.7 background resolution + divider paint order (U-20261114-011) ─────
//
// Two defects, one root cause class (the deck backdrop silently never drew):
//   (1) scope `all` ignored every per-slide binding, so the per-chapter
//       background order (slideData.backgroundImage on every slide) was
//       unreachable and a global backdrop repainted the whole deck.
//   (2) the global pool path ("deliverables/assets/images/…", workspace-
//       relative) was resolved against imgDir only → ENOENT → bgDrawn=false
//       deck-wide. The individual branch always tried both bases.
// Plus (3): a photo-less divider painted its own full-page `visual` AFTER its
// title text, blanking the page under zen.
//
// Colour is the observable: each candidate background is a solid-colour PNG,
// rendered with hinting off via pdftoppm, sampled at a page corner (outside the
// content card).
const RED:  [number, number, number] = [0xff, 0x00, 0x00];
const BLUE: [number, number, number] = [0x00, 0x00, 0xff];

describe.skipIf(!haveFonts)('v1.14.7 background resolution precedence', () => {
  const poolFiles: string[] = [];
  afterAll(() => { for (const f of poolFiles) rmSync(f, { force: true }); });

  function makeScopeAllProject(): { dir: string; rel: string } {
    const tag = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const name = `_bgprec_test_${tag}`;
    const dir = join(ROOT, 'deliverables', name);
    mkdirSync(join(dir, 'images'), { recursive: true });
    // Slide 1 owns a BLUE binding; slide 2 has none → must fall back to the
    // global pool backdrop (RED), which lives at the workspace root so only the
    // workspace-relative base can resolve it.
    writeFileSync(join(dir, 'images', 'own.png'), writeSolidPng(32, 32, BLUE));
    const poolAbs = join(ROOT, 'deliverables', `_bgpool_${tag}.png`);
    writeFileSync(poolAbs, writeSolidPng(32, 32, RED));
    poolFiles.push(poolAbs);
    const poolRel = `deliverables/_bgpool_${tag}.png`;
    writeFileSync(join(dir, 'image-manifest.json'), JSON.stringify({
      background_image: { enabled: true, scope: 'all', path: poolRel, overlay_color: [0, 0, 0], overlay_opacity: 0.4 },
      slides: [],
    }));
    writeFileSync(join(dir, 'lecture-profile.md'), [
      '---',
      'presentation:',
      '  theme: zen',
      '  style: white-bubble',
      'background_image:',
      '  enabled: true',
      '  scope: all',
      '  source: download',
      '  overlay:',
      '    color: [0, 0, 0]',
      '    opacity: 0.4',
      '  keywords: []',
      '  fallback_color: null',
      '---',
      '# t',
      '',
    ].join('\n'));
    writeFileSync(join(dir, 'slidedata.json'), JSON.stringify([
      { section: 'S1', title: 'Own binding wins', bullets: ['one', 'two'], backgroundImage: 'images/own.png' },
      { section: 'S1', title: 'Global fallback', bullets: ['one', 'two'] },
    ]));
    tmpDirs.push(dir);
    return { dir, rel: join('deliverables', name) };
  }

  const run = (() => {
    const { dir, rel } = makeScopeAllProject();
    const res = spawnSync('bun', [TOOL, '--project', rel, '--font-dir', FONT_DIR],
      { cwd: ROOT, encoding: 'utf-8', timeout: 120000 });
    expect(res.status).toBe(0);
    const pdfPath = join(dir, `${rel.split(/[\\/]/).pop()}.pdf`);
    expect(existsSync(pdfPath)).toBe(true);
    return { dir, pdfPath };
  })();

  test('scope all: a per-slide binding wins over the global backdrop', () => {
    const px = pagePixel(run.pdfPath, 1, run.dir, 0.03, 0.05);
    if (px === null) return;                       // pdftoppm unavailable
    expect(px[2]).toBeGreaterThan(px[0] + 40);     // blue, not red
  });

  test('scope all: a slide with no binding falls back to the global pool image (workspace-relative base)', () => {
    const px = pagePixel(run.pdfPath, 2, run.dir, 0.03, 0.05);
    if (px === null) return;
    expect(px[0]).toBeGreaterThan(px[2] + 40);     // red: global resolved via workspaceRoot
  });
});

describe.skipIf(!haveFonts)('v1.14.7 divider paint order', () => {
  function makeDividerProject(): { dir: string; rel: string } {
    const name = `_divorder_test_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const dir = join(ROOT, 'deliverables', name);
    mkdirSync(join(dir, 'images'), { recursive: true });
    writeFileSync(join(dir, 'images', 'test.png'), writeTinyPng());
    // No background_image config: the divider must rely on its OWN visual and
    // still keep its title card on top of it.
    writeFileSync(join(dir, 'lecture-profile.md'),
      '---\npresentation:\n  theme: zen\n  style: white-bubble\nbackground_image:\n  enabled: false\n---\n# t\n');
    writeFileSync(join(dir, 'slidedata.json'), JSON.stringify([{
      isDividerSlide: true, partNum: 'PART 01',
      title: 'Divider Title Legible', desc: 'divider description line',
      visualImage: 'images/test.png',
    }]));
    tmpDirs.push(dir);
    return { dir, rel: join('deliverables', name) };
  }

  const run = (() => {
    const { dir, rel } = makeDividerProject();
    const res = spawnSync('bun', [TOOL, '--project', rel, '--font-dir', FONT_DIR],
      { cwd: ROOT, encoding: 'utf-8', timeout: 120000 });
    expect(res.status).toBe(0);
    const pdfPath = join(dir, `${rel.split(/[\\/]/).pop()}.pdf`);
    expect(existsSync(pdfPath)).toBe(true);
    const page = decompressedStreams(pdfPath).find((s) => s.includes('Tj') && s.includes('BT'))!;
    return { dir, pdfPath, page };
  })();

  test('the divider image is drawn BEFORE its title text (no self-overpaint)', () => {
    const ls = run.page.split('\n').map((l) => l.trim());
    const imgIdx = ls.findIndex((l) => /\/Image/.test(l) && /\bDo$/.test(l));
    const firstTj = ls.findIndex((l) => l.endsWith('Tj'));
    expect(imgIdx).toBeGreaterThan(-1);
    expect(firstTj).toBeGreaterThan(-1);
    expect(imgIdx).toBeLessThan(firstTj);
  });

  test('the divider title and description are still present', () => {
    const txt = extractText(run.pdfPath);
    if (txt === null) return;
    expect(txt).toContain('Divider Title Legible');
    expect(txt).toContain('divider description line');
  });
});

// ── v1.14.8 footnote wrapping ────────────────────────────────────────────────
//
// multiCell already wrapped the joined gloss list, but the band was anchored at
// a fixed bottom offset and grew DOWNWARD, so every line after the first landed
// off-page and was clipped (S11 lost its FY gloss, S48 its AP2 gloss). The pin
// is behavioural: a gloss list long enough to need 2+ lines must still yield
// EVERY token in the extracted text layer — the tail token is the one the old
// layout dropped.
describe.skipIf(!haveFonts)('v1.14.8 footnote wrapping', () => {
  // Four glosses, deliberately long enough to exceed one text line at 9pt.
  const TAIL = 'TailTokenEndsHere';
  const FOOTNOTES = [
    'ARR = Annual Recurring Revenue — 연환산 반복 매출 (annualized recurring revenue measure)',
    'RPO = Remaining Performance Obligation — 잔여 계약 잔액 (contracted but unrecognized revenue)',
    'AWU = Agent Work Unit — 에이전트가 수행한 일의 단위 (agent work unit accounting)',
    `FY = Fiscal Year — 회사 회계연도 (the company fiscal year definition) ${TAIL}`,
  ];

  function makeFootnotesProject(): { dir: string; rel: string } {
    const name = `_footwrap_test_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const dir = join(ROOT, 'deliverables', name);
    mkdirSync(join(dir, 'images'), { recursive: true });
    writeFileSync(join(dir, 'lecture-profile.md'),
      '---\npresentation:\n  theme: zen\n  style: white-bubble\nbackground_image:\n  enabled: false\n---\n# t\n');
    writeFileSync(join(dir, 'slidedata.json'), JSON.stringify([{
      section: 'S1', title: 'Long Footnote Slide',
      bullets: ['first bullet line', 'second bullet line'],
      footnotes: FOOTNOTES,
    }]));
    tmpDirs.push(dir);
    return { dir, rel: join('deliverables', name) };
  }

  const run = (() => {
    const { dir, rel } = makeFootnotesProject();
    const res = spawnSync('bun', [TOOL, '--project', rel, '--font-dir', FONT_DIR],
      { cwd: ROOT, encoding: 'utf-8', timeout: 120000 });
    expect(res.status).toBe(0);
    const pdfPath = join(dir, `${rel.split(/[\\/]/).pop()}.pdf`);
    expect(existsSync(pdfPath)).toBe(true);
    return { dir, pdfPath, log: String(res.stdout ?? '') };
  })();

  test('the generator reports the footnote band placement', () => {
    // v1.14.9 logs one placement line per footnote slide (rung + band rect).
    expect(run.log).toMatch(/footnotes \(slide 1\): \d+ line\(s\) @9\.00pt below-card/);
  });

  test('every gloss — including the tail token — survives into the text layer', () => {
    const txt = extractText(run.pdfPath);
    if (txt === null) return;
    const flat = txt.replace(/\s+/g, ' ');
    expect(flat).toContain('ARR = Annual Recurring Revenue');
    expect(flat).toContain('RPO = Remaining Performance Obligation');
    expect(flat).toContain('AWU = Agent Work Unit');
    expect(flat).toContain('FY = Fiscal Year');
    // The token that used to live on the clipped second line.
    expect(flat).toContain(TAIL);
  });

  test('the wrapped band stays inside the page (no line drawn below the bottom edge)', () => {
    // Content stream: every text-positioning op (Tm / Td with an explicit y)
    // must have y above the page bottom. pdf-lib emits per-run `... Tm` ops;
    // the page height in pt is 540.067, so a negative/below-zero y is off-page.
    const page = decompressedStreams(run.pdfPath).find((s) => s.includes('Tj') && s.includes('BT'))!;
    const ys: number[] = [];
    for (const m of page.matchAll(/(-?[\d.]+)\s+(-?[\d.]+)\s+(-?[\d.]+)\s+(-?[\d.]+)\s+(-?[\d.]+)\s+(-?[\d.]+)\s+Tm/g)) {
      ys.push(parseFloat(m[6]));
    }
    expect(ys.length).toBeGreaterThan(0);
    // fy() flips y so drawing below the page edge yields a NEGATIVE value.
    expect(Math.min(...ys)).toBeGreaterThan(0);
  });
});

// ── v1.14.9 footnote scrim + placement ladder ────────────────────────────────
//
// The production-deck audit showed the band text present, on-page and clear of
// the card on all 24 gloss slides — but the bare C_MUTED grey line is
// unreadable on the photo backgrounds v1.14.7 now draws (all 24 backdrops
// measured p90 luminance 52–130 vs the ~115 grey ink): the "약어 글상자가
// 사라진다" report. v1.14.9 adds the deck injector's photo-aware scrim (white
// C_CARD pill @0.96 + body-navy C_BODY ink when a background was drawn) and a
// placement ladder (below-card → 11px floor → on-card padding → top margin →
// drop with a loud log).
const C_BODY_OP = '0.16862745098039217 0.21176470588235294 0.3137254901960784 rg';  // text_body [43,54,80]
const C_MUTED_OP = '0.43137254901960786 0.4627450980392157 0.5294117647058824 rg';  // text_muted [110,118,135]

describe.skipIf(!haveFonts)('v1.14.9 footnote scrim and placement ladder', () => {
  // Six long glosses: too tall for the below-card rung at either size on the
  // standard (content-hugged) card, so the ladder must keep walking — and must
  // NEVER reach the drop rung.
  const LONG_HEAD = 'ARR = Annual Recurring Revenue — 연환산 반복 매출 (annualized recurring revenue measure used across SaaS filings)';
  const LONG_TAIL = 'ZZTailTokenZZ = Fiscal Year — 회사 회계연도 (the company fiscal year definition used by every filing in this deck)';
  const LONG_FOOTNOTES = [
    LONG_HEAD,
    'RPO = Remaining Performance Obligation — 잔여 계약 잔액 (contracted but unrecognized revenue backlog)',
    'AWU = Agent Work Unit — 에이전트가 수행한 일의 단위 (agent work unit accounting baseline)',
    'NRR = Net Revenue Retention — 순수 매출 유지율 (expansion-adjusted retention metric)',
    'CAC = Customer Acquisition Cost — 고객 획득 비용 (fully loaded sales and marketing spend)',
    LONG_TAIL,
  ];

  function makeFootnoteFixture(bg: boolean): { dir: string; rel: string; log: string; pdfPath: string } {
    const name = `_fnscrim_test_${bg ? 'bg' : 'nobg'}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const dir = join(ROOT, 'deliverables', name);
    mkdirSync(join(dir, 'images'), { recursive: true });
    writeFileSync(join(dir, 'images', 'test.png'), writeTinyPng());
    writeFileSync(join(dir, 'lecture-profile.md'), [
      '---',
      'presentation:',
      '  theme: zen',
      '  style: white-bubble',
      'background_image:',
      `  enabled: ${bg}`,
      '  scope: individual',
      '  source: download',
      '  overlay:',
      '    color: [0, 0, 0]',
      '    opacity: 0.4',
      '  keywords: []',
      '  fallback_color: null',
      '---',
      '# t',
      '',
    ].join('\n'));
    // 20 bullets grow the content-hugged standard card to its 90%-page cap
    // (card bottom ≈ 95% page height) — the "tall card, little room below" case.
    const tallBullets = Array.from({ length: 20 }, (_, i) => `bullet line ${i + 1} with enough words to stay wrapped`);
    const slide: Record<string, any> = {
      section: 'S1', title: 'Scrim Footnote Slide',
      bullets: bg ? tallBullets : ['first bullet line', 'second bullet line'],
      footnotes: bg ? LONG_FOOTNOTES : [
        'ARR = Annual Recurring Revenue — 연환산 반복 매출',
        `FY = Fiscal Year — 회사 회계연도 ${TAIL_TOKEN}`,
      ],
    };
    if (bg) slide.backgroundImage = 'images/test.png';
    writeFileSync(join(dir, 'slidedata.json'), JSON.stringify([slide]));
    tmpDirs.push(dir);
    const rel = join('deliverables', name);
    const res = spawnSync('bun', [TOOL, '--project', rel, '--font-dir', FONT_DIR],
      { cwd: ROOT, encoding: 'utf-8', timeout: 120000 });
    expect(res.status).toBe(0);
    const pdfPath = join(dir, `${rel.split(/[\\/]/).pop()}.pdf`);
    expect(existsSync(pdfPath)).toBe(true);
    return { dir, rel, log: String(res.stdout ?? ''), pdfPath };
  }

  const TAIL_TOKEN = 'TailTokenEndsHere';
  const bgRun = makeFootnoteFixture(true);
  const noBgRun = makeFootnoteFixture(false);

  test('bgDrawn: the scrim pill is used and the ink switches to body navy', () => {
    expect(bgRun.log).toContain('footnotes (slide 1)');
    expect(bgRun.log).toContain('+ scrim');
    // Ink colour: the footnote text op must carry the C_BODY fill, not C_MUTED.
    const page = decompressedStreams(bgRun.pdfPath).find((s) => s.includes('Tj') && s.includes('BT'))!;
    expect(page).toContain(C_BODY_OP);
    expect(page).not.toContain(`${C_MUTED_OP}`);
  });

  test('no drawn background: legacy grey ink, no scrim', () => {
    expect(noBgRun.log).not.toContain('+ scrim');
    const page = decompressedStreams(noBgRun.pdfPath).find((s) => s.includes('Tj') && s.includes('BT'))!;
    expect(page).toContain(C_MUTED_OP);
    expect(page).not.toContain(C_BODY_OP);
  });

  test('PM pin: tall-card long-gloss ladder — full gloss text, nothing dropped, all Tm in-page', () => {
    // The ladder must never reach the drop rung for this fixture.
    expect(bgRun.log).not.toContain('DROPPED');
    // A placement line must exist for the fixture's footnote slide.
    expect(bgRun.log).toMatch(/footnotes \(slide 1\): \d+ line\(s\) @(8\.25|9)pt (below-card|on-card|top-margin)/);
    // Every gloss survives into the extracted text layer, head and tail.
    const txt = extractText(bgRun.pdfPath);
    if (txt === null) return;
    const flat = txt.replace(/\s+/g, ' ');
    expect(flat).toContain('ARR = Annual Recurring Revenue');
    expect(flat).toContain('NRR = Net Revenue Retention');
    expect(flat).toContain('ZZTailTokenZZ');
    // All text ops inside the page (fy flips: off-page → negative y).
    const page = decompressedStreams(bgRun.pdfPath).find((s) => s.includes('Tj') && s.includes('BT'))!;
    const ys: number[] = [];
    for (const m of page.matchAll(/(-?[\d.]+)\s+(-?[\d.]+)\s+(-?[\d.]+)\s+(-?[\d.]+)\s+(-?[\d.]+)\s+(-?[\d.]+)\s+Tm/g)) {
      ys.push(parseFloat(m[6]));
    }
    expect(ys.length).toBeGreaterThan(0);
    expect(Math.min(...ys)).toBeGreaterThan(0);
    expect(Math.max(...ys)).toBeLessThan(540.067);
  });

  test('legacy two-gloss footnote slide still lands below-card with the full text', () => {
    expect(noBgRun.log).toMatch(/footnotes \(slide 1\): \d+ line\(s\) @9\.00pt below-card/);
    const txt = extractText(noBgRun.pdfPath);
    if (txt === null) return;
    expect(txt).toContain(TAIL_TOKEN);
  });
});
