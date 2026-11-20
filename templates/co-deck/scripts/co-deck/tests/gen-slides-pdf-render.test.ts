// @version 1.9.0 — batch-2 PR-A2 pins (U-20261119-010, design
//   2026-11-20-co-deck-pipeline-batch-2-design R1b): opt-in framed PDF↔HTML
//   parity — spec gates (pitch-enhanced ships the measured `frame` block, no
//   other theme does), source gates (every frame consumption site checks
//   spec.frame/layoutSpec.frame presence), framed render pins (post-pass mask
//   paints the outside-frame margin page_rgb, background covers the frame not
//   the page, footnotes move inside the frame, visualCaption renders on
//   standard slides, punchline drops the `”` mark and accents the first
//   statement line, framed contact two-column with the visual, framed video
//   caption chip sits bottom-left, no header-bar counter), and legacy-path
//   contrast pins (the no-frame pitch sibling keeps the header counter and the
//   legacy two-column card geometry; zen keeps the punchline `”` mark). The
//   v1.16.0 U-007 geometry pins move to `pitch` — the no-frame sibling of
//   pitch-enhanced with the identical legacy standard renderer — because the
//   frame block now routes every pitch-enhanced standard slide to the framed
//   renderer (the block IS the compat gate, so the legacy path stays exercised
//   only by no-frame themes).
// @version 1.8.0 — batch-2 PR-A1 pins (U-20261119-007, design
//   2026-11-20-co-deck-pipeline-batch-2 R1a): premium-dark bgDrawn ink derives
//   from the actual card fill — cover title/punchline/contact/profile ink ≠
//   card fill (title white via readableTextOn, sub/meta/statement muted ops),
//   C_DARK fallback source pin; two-column geometry — hasRight card rect left
//   of the visual panel + no text op crossing it (legacy panel-after-text
//   z-order kept), single-column card stays page-centered; the v1.15.0
//   statement-ink pins (sub_bold, contact primary) updated to the
//   readableTextOn contract ([31,42,68] on white-bubble — the hardcoded
//   C_DARK [11,15,25] was the premium-dark defect).
// @version 1.7.1 — bgprec pool image moved into the per-test project dir so
//   aborted runs no longer leak deliverables/_bgpool_*.png into the template.
// @version 1.7.0 — PR-5 reference pins (design 2026-11-17-co-deck-pdf-followups
//   T-20261117-005, owner decision O-5 default Option A): the PDF side of the
//   contactName parity pin. ZERO renderer change — gen-slides-pdf has rendered
//   contactName all along (v1.14.3 known-list order: name, email, linkedin,
//   phone; primaryFirst bold is the bullets fallback only). These pins freeze
//   the contract the zen template now aligns to: a contactName+bullets mixed
//   slide renders the name and NOT the bullets (the PDF side of the mixed
//   parity pin; HTML side in ppt-engine-integration.test.ts), and a
//   contactName-only slide renders the name.
// @version 1.6.0 — v1.15.0 pins (design 2026-11-16-co-deck-pdf-html-backport
//   PR-1): U-010 shared-parser adoption (source pin + dotted/nested render
//   parity with estimate-layout), U-008(2) notes band merged sources-first,
//   U-008(3) \n punchline equal sentence rows + U+2060 strip, U-008(4) PDF
//   contact bullets fallback (max 5, contact*-first unchanged), U-011
//   punchline_sub_bold ink flip (absent key unchanged), zen spec
//   punch_text_px/punchline_sub_px keys reach the renderer; Amendment A
//   (DEC-20261116-05) punch_tag_px decoupling pins
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
  // PR-5: read `status` too — bun's spawnSync leaves `exitCode` undefined on
  // success, so the exitCode-only check silently vacated every null-guarded
  // pdftotext pin below (they passed without asserting). Non-behavioral for
  // the renderer; test-correctness only.
  return bin.status === 0 || bin.exitCode === 0 ? bin.stdout : null;
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
  function makeScopeAllProject(): { dir: string; rel: string } {
    const tag = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const name = `_bgprec_test_${tag}`;
    const dir = join(ROOT, 'deliverables', name);
    mkdirSync(join(dir, 'images'), { recursive: true });
    // Slide 1 owns a BLUE binding; slide 2 has none → must fall back to the
    // global pool backdrop (RED). The pool lives inside the per-test project dir
    // (cleaned via tmpDirs) but is addressed workspace-relative, so imgDir
    // (= projectDir) + that path does not exist and only the workspace base resolves it.
    writeFileSync(join(dir, 'images', 'own.png'), writeSolidPng(32, 32, BLUE));
    writeFileSync(join(dir, '_pool.png'), writeSolidPng(32, 32, RED));
    const poolRel = `deliverables/${name}/_pool.png`;
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

// ── v1.15.0 pins (design 2026-11-16-co-deck-pdf-html-backport PR-1) ──────────
//
// U-010 — the shared layout-overrides parser reaches the renderer. The deleted
// private parser silently dropped DOTTED keys (`fonts.punchline_px: 32`), so a
// dotted override passed the estimate-layout gate but never changed the render.
// Observable: the punchline statement's Tf size in the content stream
// (zen calibration font_px_to_pt = 0.75 → 32px = 24pt; unfixed = 48pt).
// U-008(2) — `notes` (sources) render in the footnote band, sources FIRST,
// then `footnotes` (abbreviations); zero drops.
// U-008(3) — a `\n` punchline title renders as equal full-size sentence rows
// and no U+2060/U+FEFF reaches any drawn run.
// U-008(4) — a bullets-only contact slide falls back to `bullets` (max 5,
// contact*-first order keeps existing decks unchanged).
// U-011 — `fonts.punchline_sub_bold` flips the sub's ink; the absent key keeps
// today's regular/C_BODY output.
// Amendment A (DEC-20261116-05) — `fonts.punch_tag_px` decouples the punch tag
// from punchline_sub_px: zen tag stays 12pt (16.0 × zen 0.75) while the zen sub
// enlarges to 34.5pt (46 × 0.75); layout_base-only decks keep 16 × calibration.
import { parseFrontmatter, deepMerge } from '../lib/layout-overrides';

const ESTIMATE_TOOL = join(ROOT, 'scripts/co-deck/estimate-layout.ts');
const PAGE_W_PT = 338.7 * 2.835;                        // zen page width in pt
const C_DARK_OP  = `${11 / 255} ${15 / 255} ${25 / 255} rg`;   // colors.dark default [11,15,25]

// One entry per drawn text run: the active Tf size / rg colour / Tm position.
function textRunOps(page: string): Array<{ size: number; x: number; y: number; rg: string | null }> {
  const out: Array<{ size: number; x: number; y: number; rg: string | null }> = [];
  let size = NaN, x = NaN, y = NaN, rg: string | null = null;
  for (const raw of page.split('\n')) {
    const l = raw.trim();
    const tf = l.match(/^\/\S+\s+([\d.]+)\s+Tf$/);
    if (tf) { size = parseFloat(tf[1]); continue; }
    const rgM = l.match(/^(-?[\d.]+)\s+(-?[\d.]+)\s+(-?[\d.]+)\s+rg$/);
    if (rgM) { rg = l; continue; }
    const tm = l.match(/^(-?[\d.]+)\s+(-?[\d.]+)\s+(-?[\d.]+)\s+(-?[\d.]+)\s+(-?[\d.]+)\s+(-?[\d.]+)\s+Tm$/);
    if (tm) { x = parseFloat(tm[1]); y = parseFloat(tm[6]); continue; }
    if (l.endsWith('Tj') && Number.isFinite(size) && Number.isFinite(y)) out.push({ size, x, y, rg });
  }
  return out;
}

/** bgDrawn-enabling profile extra (scope individual binding), the v1.14.6
 *  fixture shape — without it bgImageConfig stays null and bgDrawn is always
 *  false regardless of slideData.backgroundImage. */
const BG_PROFILE = [
  'background_image:',
  '  enabled: true',
  '  scope: individual',
  '  source: download',
  '  overlay:',
  '    color: [0, 0, 0]',
  '    opacity: 0.4',
  '  keywords: []',
  '  fallback_color: null',
];

/** Render one punchline/contact/standard fixture and return its paths. */
function renderFixture(
  name: string,
  profileExtra: string[],
  slides: Record<string, any>[],
  theme = 'zen',
  style = 'white-bubble',
) {
  const dir = join(ROOT, 'deliverables', name);
  mkdirSync(dir, { recursive: true });
  tmpDirs.push(dir);
  writeFileSync(join(dir, 'lecture-profile.md'), [
    '---',
    'presentation:',
    `  theme: ${theme}`,
    `  style: ${style}`,
    ...profileExtra,
    '---',
    '# t',
    '',
  ].join('\n'));
  writeFileSync(join(dir, 'slidedata.json'), JSON.stringify(slides));
  return { dir, rel: join('deliverables', name) };
}

function runTool(tool: string, rel: string) {
  return spawnSync('bun', [tool, '--project', rel, '--font-dir', FONT_DIR],
    { cwd: ROOT, encoding: 'utf-8', timeout: 120000 });
}

describe('v1.15.0 U-010: shared layout-overrides parser', () => {
  test('gen-slides-pdf imports the shared lib and no private parser copies remain', () => {
    const src = readFileSync(TOOL, 'utf-8');
    expect(src).toContain("from './lib/layout-overrides'");
    expect(src).not.toMatch(/function parseLayoutOverrides\b/);
    expect(src).not.toMatch(/function parseFrontmatter\b/);
    expect(src).not.toMatch(/function parseScalar\b/);
  });

  test('gen-slides-pdf-side pin: mixed flat + dotted + nested forms parse and merge (U-010 repro)', () => {
    const md = [
      '---',
      'presentation:',
      '  theme: zen',
      '  style: white-bubble',
      'layout_overrides:',
      '  fonts.punchline_px: 32',
      '  fonts:',
      '    title_px: 40',
      '  bullet_px: 18',
      '---',
      '# t',
    ].join('\n');
    const fm = parseFrontmatter(md);
    expect(fm.layout_overrides).toEqual({
      fonts: { punchline_px: 32, title_px: 40 },
      bullet_px: 18,
    });
    const merged = deepMerge({ fonts: { punchline_px: 64, bullet_px: 16 } }, fm.layout_overrides);
    expect(merged.fonts.punchline_px).toBe(32);
    expect(merged.fonts.title_px).toBe(40);
    expect(merged.bullet_px).toBe(18);
  });

  const dottedRun = (() => {
    const tag = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const { dir, rel } = renderFixture(`_dotovr_${tag}`, [
      'layout_overrides:',
      '  fonts.punchline_px: 32',
    ], [{ isPunchlineSlide: true, text: 'Dotted override lands' }]);
    const res = runTool(TOOL, rel);
    expect(res.status).toBe(0);
    const pdfPath = join(dir, `${rel.split(/[\\/]/).pop()}.pdf`);
    expect(existsSync(pdfPath)).toBe(true);
    return { dir, rel, pdfPath, page: decompressedStreams(pdfPath).find((s) => s.includes('Tj'))! };
  })();

  test.skipIf(!haveFonts)('ticket repro: dotted fonts.punchline_px: 32 reaches the renderer (24pt, not the zen 48pt)', () => {
    const runs = textRunOps(dottedRun.page);
    expect(runs.some((r) => r.size === 24)).toBe(true);   // 32px × 0.75
    expect(runs.some((r) => r.size === 48)).toBe(false);  // the silently-dropped era: zen 64px
  });

  test.skipIf(!haveFonts)('every drawn run stays inside the page (no past-the-band giant atom)', () => {
    const runs = textRunOps(dottedRun.page);
    expect(runs.length).toBeGreaterThan(0);
    for (const r of runs) {
      expect(r.x).toBeGreaterThanOrEqual(0);
      expect(r.x).toBeLessThan(PAGE_W_PT);
    }
  });

  const nestedRun = (() => {
    const tag = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const { dir, rel } = renderFixture(`_nestovr_${tag}`, [
      'layout_overrides:',
      '  fonts:',
      '    punchline_px: 44',
    ], [{ isPunchlineSlide: true, text: 'Nested override lands' }]);
    const res = runTool(TOOL, rel);
    expect(res.status).toBe(0);
    const pdfPath = join(dir, `${rel.split(/[\\/]/).pop()}.pdf`);
    expect(existsSync(pdfPath)).toBe(true);
    return { pdfPath, page: decompressedStreams(pdfPath).find((s) => s.includes('Tj'))! };
  })();

  test.skipIf(!haveFonts)('nested form still applies (legacy dialect unchanged: 33pt)', () => {
    const runs = textRunOps(nestedRun.page);
    expect(runs.some((r) => r.size === 33)).toBe(true);   // 44px × 0.75
    expect(runs.some((r) => r.size === 48)).toBe(false);
  });

  test.skipIf(!haveFonts)('parity: estimate-layout sees the same dotted override for the same profile', () => {
    const res = runTool(ESTIMATE_TOOL, dottedRun.rel);
    expect(res.status).toBe(0);
    expect(String(res.stdout ?? '')).toContain('punchline_px=32');
  });
});

describe('v1.15.0 U-008(2): notes band merged sources-first', () => {
  const run = (() => {
    const tag = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const { dir, rel } = renderFixture(`_notesbd_${tag}`, [], [{
      section: 'S1', title: 'Notes And Footnotes',
      bullets: ['first bullet line', 'second bullet line'],
      notes: ['Source: Co-deck Annual Data 2026'],
      footnotes: ['ABBRZ = Abbreviation Definition Line'],
    }]);
    const res = runTool(TOOL, rel);
    expect(res.status).toBe(0);
    const pdfPath = join(dir, `${rel.split(/[\\/]/).pop()}.pdf`);
    expect(existsSync(pdfPath)).toBe(true);
    return { pdfPath, log: String(res.stdout ?? '') };
  })();

  test.skipIf(!haveFonts)('a slide with both fields renders both in one band, sources first', () => {
    const txt = extractText(run.pdfPath);
    if (txt === null) return;
    const flat = txt.replace(/\s+/g, ' ');
    expect(flat).toContain('Source: Co-deck Annual Data 2026');
    expect(flat).toContain('ABBRZ = Abbreviation Definition Line');
    expect(flat.indexOf('Source: Co-deck Annual Data')).toBeLessThan(flat.indexOf('ABBRZ ='));
  });

  test.skipIf(!haveFonts)('zero drops: the ladder reports placement and nothing is dropped', () => {
    expect(run.log).toMatch(/footnotes \(slide 1\): \d+ line\(s\)/);
    expect(run.log).not.toContain('DROPPED');
  });

  const notesOnlyRun = (() => {
    const tag = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const { dir, rel } = renderFixture(`_notesonly_${tag}`, [], [{
      section: 'S1', title: 'Notes Only Slide',
      bullets: ['first bullet line', 'second bullet line'],
      notes: ['Source: Notes Only Source Line'],
    }]);
    const res = runTool(TOOL, rel);
    expect(res.status).toBe(0);
    const pdfPath = join(dir, `${rel.split(/[\\/]/).pop()}.pdf`);
    expect(existsSync(pdfPath)).toBe(true);
    return { pdfPath };
  })();

  test.skipIf(!haveFonts)('a slide with only `notes` renders its source line', () => {
    const txt = extractText(notesOnlyRun.pdfPath);
    if (txt === null) return;
    expect(txt.replace(/\s+/g, ' ')).toContain('Source: Notes Only Source Line');
  });
});

describe('v1.15.0 U-008(3): punchline \\n sentence rows and U+2060 strip', () => {
  // zen defaults: statement 64px → 48pt, punch_text_px 76.8 → 57.6pt row delta
  // (both depend on the zen spec key rename reaching buildSizes).
  const TITLE = 'Bold equal one\nBold\u2060equal\u2060two';
  const run = (() => {
    const tag = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const { dir, rel } = renderFixture(`_nljoin_${tag}`, [], [
      { isPunchlineSlide: true, title: TITLE },
    ]);
    const res = runTool(TOOL, rel);
    expect(res.status).toBe(0);
    const pdfPath = join(dir, `${rel.split(/[\\/]/).pop()}.pdf`);
    expect(existsSync(pdfPath)).toBe(true);
    return { pdfPath, page: decompressedStreams(pdfPath).find((s) => s.includes('Tj'))! };
  })();

  test.skipIf(!haveFonts)('no U+2060 / U+FEFF reaches any drawn run', () => {
    const txt = extractText(run.pdfPath);
    if (txt === null) return;
    expect(txt).not.toContain('\u2060');
    expect(txt).not.toContain('\uFEFF');
    expect(txt.replace(/\s+/g, ' ')).toContain('Bold equal one');
  });

  test.skipIf(!haveFonts)('a \\n title produces exactly 2 equal-size statement rows at the zen punch_text line height', () => {
    const runs = textRunOps(run.page).filter((r) => r.size === 48);   // 64px × 0.75
    expect(runs.length).toBeGreaterThan(0);
    const ys = [...new Set(runs.map((r) => Math.round(r.y * 100) / 100))];
    ys.sort((a, b) => b - a);                                         // PDF y grows upward
    expect(ys.length).toBe(2);                                        // one row per sentence
    expect(Math.abs((ys[0] - ys[1]) - 57.6)).toBeLessThan(0.5);       // 76.8px × 0.75
  });

  test.skipIf(!haveFonts)('every statement run stays inside the page width (no overlap past the band)', () => {
    const runs = textRunOps(run.page).filter((r) => r.size === 48);
    for (const r of runs) {
      expect(r.x).toBeGreaterThanOrEqual(0);
      expect(r.x).toBeLessThan(PAGE_W_PT);
    }
  });

  test.skipIf(!haveFonts)('a single-sentence title renders at full size (legacy path unchanged)', () => {
    const singleRuns = textRunOps(run.page).filter((r) => r.size === 48);
    // Sentence 1 ("Bold equal one") is one unwrapped row of several word runs.
    expect(singleRuns.length).toBeGreaterThanOrEqual(3);
  });
});

describe('v1.15.0 U-008(4) PDF side: contact bullets fallback', () => {
  const run = (() => {
    const tag = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const { dir, rel } = renderFixture(`_cbulles_${tag}`, BG_PROFILE, [{
      isContactSlide: true, title: 'Thank You All',
      bullets: [
        'Contact bullet one', 'Contact bullet two', 'Contact bullet three',
        'Contact bullet four', 'Contact bullet five', 'Contact bullet six',
        'Contact bullet seven',
      ],
      backgroundImage: 'images/test.png',
    }]);
    mkdirSync(join(dir, 'images'), { recursive: true });
    writeFileSync(join(dir, 'images', 'test.png'), writeTinyPng());
    const res = runTool(TOOL, rel);
    expect(res.status).toBe(0);
    const pdfPath = join(dir, `${rel.split(/[\\/]/).pop()}.pdf`);
    expect(existsSync(pdfPath)).toBe(true);
    return { pdfPath, page: decompressedStreams(pdfPath).find((s) => s.includes('Tj'))! };
  })();

  test.skipIf(!haveFonts)('a bullets-only contact slide renders the speaker line and up to 5 bullets', () => {
    const txt = extractText(run.pdfPath);
    if (txt === null) return;
    const flat = txt.replace(/\s+/g, ' ');
    expect(flat).toContain('Thank You All');
    for (const b of ['one', 'two', 'three', 'four', 'five']) {
      expect(flat).toContain(`Contact bullet ${b}`);
    }
    expect(flat).not.toContain('Contact bullet six');
    expect(flat).not.toContain('Contact bullet seven');
  });

  test.skipIf(!haveFonts)('the first fallback line renders bold in the card ink (readableTextOn), the rest stay C_BODY', () => {
    const runs = textRunOps(run.page);
    expect(runs.length).toBeGreaterThan(0);
    // v1.16.0 (U-20261119-007): thanks hero + primary bullet render in
    // readableTextOn(colors.C_CARD) — on white-bubble (C_CARD = white) that is
    // [31,42,68], the hardcoded C_DARK [11,15,25] was invisible on premium-dark.
    const CARD_INK_WHITE_BUBBLE = `${31 / 255} ${42 / 255} ${68 / 255} rg`;
    expect(runs.filter((r) => r.rg === CARD_INK_WHITE_BUBBLE).length).toBeGreaterThanOrEqual(2);
    expect(runs.filter((r) => r.rg === C_BODY_OP).length).toBe(4);
  });

  const contactFirstRun = (() => {
    const tag = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const { dir, rel } = renderFixture(`_ccfirst_${tag}`, [], [{
      isContactSlide: true, title: 'Reach Out',
      contactEmail: 'keep@existing.deck',
      bullets: ['Fallback bullet that must stay hidden'],
    }]);
    const res = runTool(TOOL, rel);
    expect(res.status).toBe(0);
    const pdfPath = join(dir, `${rel.split(/[\\/]/).pop()}.pdf`);
    expect(existsSync(pdfPath)).toBe(true);
    return { pdfPath };
  })();

  test.skipIf(!haveFonts)('contact*-first order keeps existing decks unchanged (bullets ignored)', () => {
    const txt = extractText(contactFirstRun.pdfPath);
    if (txt === null) return;
    const flat = txt.replace(/\s+/g, ' ');
    expect(flat).toContain('keep@existing.deck');
    expect(flat).not.toContain('Fallback bullet that must stay hidden');
  });
});

// ── PR-5 (T-20261117-005, O-5 Option A): contactName parity — PDF reference ──
//
// The PDF is the side that already renders contactName; PR-5's zen change
// aligns the HTML to it (first plain line, gate widened). These pins freeze
// the PDF contract — no renderer change in this batch (design §4.2: "No PDF
// change"). The mixed fixture here plus its HTML twin in
// ppt-engine-integration.test.ts form the BOTH-sides mixed parity pin.

describe('PR-5 T-20261117-005 PDF side: contactName renders (reference pins, zero renderer change)', () => {
  const mixedRun = (() => {
    const tag = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const { dir, rel } = renderFixture(`_cnmixed_${tag}`, [], [{
      isContactSlide: true, title: 'Mixed Reach Out',
      contactName: 'Parity Deck Name',
      bullets: ['PDF mixed bullet that must stay hidden', 'Second hidden bullet'],
    }]);
    const res = runTool(TOOL, rel);
    expect(res.status).toBe(0);
    const pdfPath = join(dir, `${rel.split(/[\\/]/).pop()}.pdf`);
    expect(existsSync(pdfPath)).toBe(true);
    return { pdfPath };
  })();

  const nameOnlyRun = (() => {
    const tag = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const { dir, rel } = renderFixture(`_cnonly_${tag}`, [], [{
      isContactSlide: true, title: 'Name Only Reach Out',
      contactName: 'Solo Deck Name',
    }]);
    const res = runTool(TOOL, rel);
    expect(res.status).toBe(0);
    const pdfPath = join(dir, `${rel.split(/[\\/]/).pop()}.pdf`);
    expect(existsSync(pdfPath)).toBe(true);
    return { pdfPath };
  })();

  test.skipIf(!haveFonts)('a contactName+bullets mixed slide renders the name and NOT the bullets (PDF side of the mixed parity pin)', () => {
    const txt = extractText(mixedRun.pdfPath);
    if (txt === null) return;
    const flat = txt.replace(/\s+/g, ' ');
    expect(flat).toContain('Parity Deck Name');
    expect(flat).not.toContain('PDF mixed bullet that must stay hidden');
    expect(flat).not.toContain('Second hidden bullet');
  });

  test.skipIf(!haveFonts)('a contactName-only slide renders the name (the capability the zen change aligns to)', () => {
    const txt = extractText(nameOnlyRun.pdfPath);
    if (txt === null) return;
    const flat = txt.replace(/\s+/g, ' ');
    expect(flat).toContain('Solo Deck Name');
    expect(flat).toContain('Name Only Reach Out');
  });
});

describe('v1.15.0 U-011: punchline_sub_bold opt-in', () => {
  const makeSubProject = (tag: string, profileExtra: string[]) => {
    const name = `_subbold_${tag}`;
    const { dir, rel } = renderFixture(name, [...BG_PROFILE, ...profileExtra], [{
      isPunchlineSlide: true, title: 'Statement Head',
      text: 'Main **key** statement', sub: 'Sub support line',
      backgroundImage: 'images/test.png',
    }]);
    mkdirSync(join(dir, 'images'), { recursive: true });
    writeFileSync(join(dir, 'images', 'test.png'), writeTinyPng());
    const res = runTool(TOOL, rel);
    expect(res.status).toBe(0);
    const pdfPath = join(dir, `${rel.split(/[\\/]/).pop()}.pdf`);
    expect(existsSync(pdfPath)).toBe(true);
    return { page: decompressedStreams(pdfPath).find((s) => s.includes('Tj'))! };
  };

  // zen spec punchline_sub_px = 46 → sub Tf 34.5pt (46 × 0.75); the sub is the
  // only 34.5pt text on the page.
  const boldPage = makeSubProject(`${Date.now()}_on`, [
    'layout_overrides:',
    '  fonts.punchline_sub_bold: true',
  ]);
  const plainPage = makeSubProject(`${Date.now()}_off`, []);

  // v1.16.0 (U-20261119-007): the STATEMENT INK itself changed — bgDrawn bubble
  // ink derives from readableTextOn(colors.C_CARD) instead of hardcoded C_DARK
  // (premium-dark card fill == C_DARK fallback = invisible). On white-bubble
  // (C_CARD = white) readableTextOn returns [31,42,68], the HTML
  // .slide-content ink the hardcode approximated. The contract under test is
  // unchanged: bold sub renders in the statement ink.
  const STMT_INK_WHITE_BUBBLE = `${31 / 255} ${42 / 255} ${68 / 255} rg`;

  test.skipIf(!haveFonts)('punchline_sub_bold: true renders the sub bold in the statement ink (readableTextOn on the bubble)', () => {
    const subRuns = textRunOps(boldPage.page).filter((r) => r.size === 34.5);
    expect(subRuns.length).toBeGreaterThan(0);
    for (const r of subRuns) expect(r.rg).toBe(STMT_INK_WHITE_BUBBLE);
  });

  test.skipIf(!haveFonts)('absent key keeps today\u2019s output: regular weight, C_BODY ink', () => {
    const subRuns = textRunOps(plainPage.page).filter((r) => r.size === 34.5);
    expect(subRuns.length).toBeGreaterThan(0);
    for (const r of subRuns) expect(r.rg).toBe(C_BODY_OP);
  });
});

describe('v1.15.0 zen pdf_layout_spec keys reach the renderer', () => {
  const zenSpec = JSON.parse(
    readFileSync(join(ROOT, 'docs/html-themes/themes/zen/pdf_layout_spec.json'), 'utf-8'),
  );

  test('the legacy line-height key is renamed and the sub-size default lands', () => {
    expect(zenSpec.fonts.punchline_sub_px).toBe(46);
    expect(zenSpec.line_heights.punch_text_px).toBe(76.8);
    expect(zenSpec.line_heights.punch_sub_px).toBe(55.2);
    expect(zenSpec.line_heights.punchline_px).toBeUndefined();
  });

  test('layer-0 defaults stay 16/regular (no punchline_sub_bold at Layer 0)', () => {
    const base = JSON.parse(
      readFileSync(join(ROOT, 'docs/html-themes/themes/_shared/layout_base.json'), 'utf-8'),
    );
    expect(base.fonts.punchline_sub_px).toBe(16.0);
    expect(base.fonts.punchline_sub_bold).toBeUndefined();
  });
});

// ── v1.15.0 Amendment A (DEC-20261116-05, design §7.2): punch_tag_px decoupling
//
// T_PUNCH_TAG previously borrowed fonts.punchline_sub_px, so zen's new sub
// default (46px) would have ballooned the legacy punchline "PART" tag to
// 34.5pt. The tag now has its own key: 16.0 fallback (CSS px through the
// theme calibration — 12.0 would shrink the tag to 9pt on every deck),
// layout_base.json pins 16.0, and zen declares NO punch_tag_px entry so the
// zen tag stays at its pre-PR-1 12pt (16.0 × zen 0.75).
describe('v1.15.0 Amendment A: punch_tag_px decoupled from the sub size', () => {
  const zenRun = (() => {
    const tag = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const { dir, rel } = renderFixture(`_punchtag_${tag}`, [], [{
      isPunchlineSlide: true, section: 'PART 01 · Test',
      text: 'Statement body', sub: 'Sub line here',
    }]);                                     // legacy path: no background_image section → tag IS drawn
    const res = runTool(TOOL, rel);
    expect(res.status).toBe(0);
    const pdfPath = join(dir, `${rel.split(/[\\/]/).pop()}.pdf`);
    expect(existsSync(pdfPath)).toBe(true);
    return { page: decompressedStreams(pdfPath).find((s) => s.includes('Tj'))! };
  })();

  test.skipIf(!haveFonts)('zen punchline: tag stays 12pt while the sub renders 34.5pt (zen spec)', () => {
    const runs = textRunOps(zenRun.page);
    // Tag: fallback 16.0 × zen calibration 0.75 — the only 12pt runs on the
    // page (quote mark 43.2pt, statement 48pt, sub 34.5pt).
    expect(runs.some((r) => r.size === 12)).toBe(true);
    // Sub: the zen punchline_sub_px = 46 lands unchanged.
    expect(runs.some((r) => r.size === 34.5)).toBe(true);
    // Decoupling proof: the tag renders exactly once, at 12pt — not at the
    // 34.5pt the old sub-borrowing would have given it.
    expect(runs.filter((r) => r.size === 12).length).toBe(1);
  });

  const outlineRun = (() => {
    const tag = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    // outline: calibration font_px_to_pt 0.85, declares punchline, no
    // punch_tag_px override → the effective size comes from layout_base alone.
    // No `sub` on the slide: the tag is the only text at its size.
    const { dir, rel } = renderFixture(`_punchtag_out_${tag}`, [], [{
      isPunchlineSlide: true, section: 'Part One',
      text: 'Outline statement',
    }], 'outline', 'premium-dark');
    const res = runTool(TOOL, rel);
    expect(res.status).toBe(0);
    const pdfPath = join(dir, `${rel.split(/[\\/]/).pop()}.pdf`);
    expect(existsSync(pdfPath)).toBe(true);
    return { page: decompressedStreams(pdfPath).find((s) => s.includes('Tj'))! };
  })();

  test.skipIf(!haveFonts)('layout_base-only deck: tag = 16 × calibration (13.6pt on outline), unchanged from pre-PR-1', () => {
    const runs = textRunOps(outlineRun.page);
    expect(runs.some((r) => r.size === 13.6)).toBe(true);   // 16.0 × 0.85
    expect(runs.filter((r) => r.size === 13.6).length).toBe(1);
  });

  test('layout_base pins punch_tag_px 16.0; zen declares no punch_tag_px entry (Amendment A items 2-3)', () => {
    const base = JSON.parse(
      readFileSync(join(ROOT, 'docs/html-themes/themes/_shared/layout_base.json'), 'utf-8'),
    );
    expect(base.fonts.punch_tag_px).toBe(16.0);
    const zen = JSON.parse(
      readFileSync(join(ROOT, 'docs/html-themes/themes/zen/pdf_layout_spec.json'), 'utf-8'),
    );
    expect(zen.fonts.punch_tag_px).toBeUndefined();
  });
});

// ── v1.16.0 batch-2 PR-A1 pins (U-20261119-007, design
//    2026-11-20-co-deck-pipeline-batch-2 R1a) ─────────────────────────────────
//
// Two defects on premium-dark decks (Gate-5 LOCAL-PATCH reference, verified at
// origin/main d62ec06e2):
//   (1) invisible cover title — drawBubbleBehind fills the bgDrawn bubble with
//       colors.C_CARD (premium-dark card_dark = [11,15,25]) while the ink was
//       hardcoded C_DARK/C_BODY; C_DARK falls back to the SAME [11,15,25] (no
//       `dark` key in the spec) → title rendered at 1:1 contrast. All bgDrawn
//       bubble/card ink now derives via readableTextOn/readableMutedOn(C_CARD)
//       (divider-branch pattern): title slide, punchline statement, contact
//       thanks + primary fallback line, profile name/bio.
//   (2) two-column overflow — the hasRight hug card was page-centered
//       (cardW0 from titleW) while bullets anchored at contentR.x + shiftX and
//       the right visual panel painted AFTER the text, covering the card's
//       right portion. hasRight decks now anchor the card inside
//       [contentR.x, visR.x] and wrap to the column inner width.
//
// Observability: textRunOps (per-run ink + Tm origin), CARD_RECTS_OUT (card
// rect as page fractions), and the C_VIS_BG panel rect parsed from the content
// stream (drawRectangle emits `x y w h re` right after its `rg`).
const PD_CARD_FILL = C_DARK_OP;                                   // card_dark [11,15,25] == C_DARK fallback
const PD_TEXT_INK  = '1 1 1 rg';                                  // readableTextOn(dark navy)
const PD_MUTED_INK = `${203 / 255} ${213 / 255} ${225 / 255} rg`; // readableMutedOn(dark navy)

describe('v1.16.0 U-20261119-007: premium-dark bgDrawn ink derives from the actual card fill', () => {
  function makePremiumDeck(tag: string, slide: Record<string, any>) {
    const name = `_pdark_${tag}`;
    const { dir, rel } = renderFixture(name, BG_PROFILE, [slide], 'zen', 'premium-dark');
    mkdirSync(join(dir, 'images'), { recursive: true });
    writeFileSync(join(dir, 'images', 'test.png'), writeTinyPng());
    const res = runTool(TOOL, rel);
    expect(res.status).toBe(0);
    const pdfPath = join(dir, `${rel.split(/[\\/]/).pop()}.pdf`);
    expect(existsSync(pdfPath)).toBe(true);
    return {
      pdfPath,
      page: decompressedStreams(pdfPath).find((s) => s.includes('Tj') && s.includes('BT'))!,
    };
  }

  const titleRun = makePremiumDeck(`t_${Date.now()}`, {
    isTitleSlide: true, section: 'Opening',
    title: 'Cover Title Pin', subtitle: 'Cover subtitle pin', meta: 'Meta pin 2026',
    backgroundImage: 'images/test.png',
  });
  const punchRun = makePremiumDeck(`p_${Date.now()}`, {
    isPunchlineSlide: true, title: 'Punch Head', text: 'Premium statement pin',
    backgroundImage: 'images/test.png',
  });
  const contactRun = makePremiumDeck(`c_${Date.now()}`, {
    isContactSlide: true, title: '감사합니다', contactEmail: 'a@b.c', contactNote: 'CTA pin',
    backgroundImage: 'images/test.png',
  });
  const profileRun = makePremiumDeck(`pr_${Date.now()}`, {
    isProfileSlide: true, title: 'Profile Pin', speakerName: 'Test Speaker',
    speakerBio: 'bio line one\nbio line two',
    backgroundImage: 'images/test.png',
  });

  test.skipIf(!haveFonts)('cover title: no ink equals the card fill; title renders white on the dark bubble', () => {
    const runs = textRunOps(titleRun.page);
    expect(runs.length).toBeGreaterThan(0);
    // The defect: title (C_DARK) and sub/meta (C_BODY→light, but title itself)
    // carried the card-fill color on premium-dark — ink == fill, 1:1 contrast.
    for (const r of runs) expect(r.rg).not.toBe(PD_CARD_FILL);
    // Title = the largest runs on the page; readableTextOn(dark navy) = white.
    const maxSz = Math.max(...runs.map((r) => r.size));
    const titleRuns = runs.filter((r) => r.size === maxSz);
    expect(titleRuns.length).toBeGreaterThan(0);
    for (const r of titleRuns) expect(r.rg).toBe(PD_TEXT_INK);
    // Sub/meta derive from readableMutedOn(C_CARD) = light slate on the dark fill.
    expect(runs.some((r) => r.rg === PD_MUTED_INK)).toBe(true);
    const txt = extractText(titleRun.pdfPath);
    if (txt === null) return;
    expect(txt).toContain('Cover Title Pin');
  });

  test.skipIf(!haveFonts)('punchline statement: ink is readableTextOn on the bubble, never the card fill', () => {
    const runs = textRunOps(punchRun.page);
    expect(runs.length).toBeGreaterThan(0);
    for (const r of runs) expect(r.rg).not.toBe(PD_CARD_FILL);
    // zen punch statement = 64px × 0.75 = 48pt — the only 48pt runs on the page.
    const stmtRuns = runs.filter((r) => r.size === 48);
    expect(stmtRuns.length).toBeGreaterThan(0);
    for (const r of stmtRuns) expect(r.rg).toBe(PD_TEXT_INK);
    const txt = extractText(punchRun.pdfPath);
    if (txt === null) return;
    expect(txt).toContain('Premium statement pin');
  });

  test.skipIf(!haveFonts)('contact thanks: ink is readableTextOn on the bubble, never the card fill', () => {
    const runs = textRunOps(contactRun.page);
    expect(runs.length).toBeGreaterThan(0);
    for (const r of runs) expect(r.rg).not.toBe(PD_CARD_FILL);
    expect(runs.some((r) => r.rg === PD_TEXT_INK)).toBe(true);
    const txt = extractText(contactRun.pdfPath);
    if (txt === null) return;
    expect(txt).toContain('a@b.c');
  });

  test.skipIf(!haveFonts)('profile name/bio: ink derives from the card fill, never the card fill itself', () => {
    const runs = textRunOps(profileRun.page);
    expect(runs.length).toBeGreaterThan(0);
    for (const r of runs) expect(r.rg).not.toBe(PD_CARD_FILL);
    expect(runs.some((r) => r.rg === PD_TEXT_INK)).toBe(true);
    expect(runs.some((r) => r.rg === PD_MUTED_INK)).toBe(true);
    const txt = extractText(profileRun.pdfPath);
    if (txt === null) return;
    expect(txt).toContain('Test Speaker');
  });

  test('source pins: C_DARK fallback still exists in buildColors; bgDrawn ink sites resolve via readableTextOn/MutedOn', () => {
    const src = readFileSync(TOOL, 'utf-8');
    // The fallback stays (bare photos / legacy paths still consume C_DARK).
    expect(src).toMatch(/c\.dark\s*\?\?/);
    // Every former `bgDrawn ? C_DARK/C_BODY` bubble-ink site now derives from
    // the actual card fill (title sub+meta, punchline stmtInk, contact thanks +
    // primary, profile name+bio — plus the two pre-existing card-ink sites).
    const uses = src.match(/readable(?:Text|Muted)On\(colors\.C_CARD\)/g) ?? [];
    expect(uses.length).toBeGreaterThanOrEqual(9);
    expect(src).not.toMatch(/bgDrawn \? colors\.C_DARK/);
    expect(src).not.toMatch(/bgDrawn \? colors\.C_BODY/);
  });
});

describe('v1.16.0 U-20261119-007: two-column card anchors inside the text column', () => {
  // v1.9.0 (PR-A2): the frame block now routes EVERY pitch-enhanced standard
  // slide to the framed renderer (the block is the compat gate), so these
  // legacy-anchoring pins moved to `pitch` — the no-frame sibling theme with
  // the same legacy standard renderer (header/title/content/visual/meta
  // regions). The assertions are relationships, not absolute geometry, so the
  // theme swap keeps them valid.
  const PW_PT_EXACT = 338.7 * (72 / 25.4);   // pitch page width in pt

  /** Parse the C_VIS_BG panel left edge (pt) from the page stream. pdf-lib
   *  draws the rectangle as a translated path: `rg` then `1 0 0 1 tx ty cm`
   *  then the path outline — the panel's left edge is the translation tx. */
  function panelLeftPt(page: string): number | null {
    const lines = page.split('\n').map((l) => l.trim());
    const visBg = `${20 / 255} ${28 / 255} ${42 / 255} rg`;   // C_VIS_BG default [20,28,42]
    const i = lines.findIndex((l) => l === visBg);
    if (i < 0) return null;
    for (let k = i + 1; k < Math.min(i + 8, lines.length); k++) {
      const m = lines[k].match(/^1 0 0 1 (-?[\d.]+) (-?[\d.]+) cm$/);
      if (m) return parseFloat(m[1]);
    }
    return null;
  }

  function makePitchDeck(tag: string, slide: Record<string, any>) {
    const name = `_twocol_${tag}`;
    const { dir, rel } = renderFixture(name, [], [slide], 'pitch', 'premium-dark');
    mkdirSync(join(dir, 'images'), { recursive: true });
    writeFileSync(join(dir, 'images', 'test.png'), writeTinyPng());
    const cardsPath = join(dir, 'cards.json');
    const res = spawnSync('bun', [TOOL, '--project', rel, '--font-dir', FONT_DIR],
      { cwd: ROOT, encoding: 'utf-8', timeout: 120000,
        env: { ...process.env, CARD_RECTS_OUT: cardsPath } });
    expect(res.status).toBe(0);
    const pdfPath = join(dir, `${rel.split(/[\\/]/).pop()}.pdf`);
    expect(existsSync(pdfPath)).toBe(true);
    const cards = existsSync(cardsPath) ? JSON.parse(readFileSync(cardsPath, 'utf-8')) : [];
    const page = decompressedStreams(pdfPath).find((s) => s.includes('Tj') && s.includes('BT'))!;
    return { cards, page };
  }

  // The U-007 repro shape: two-column slide (content column [6%..58%],
  // visual panel [58.4%..95.7%] on pitch) with a right visual image.
  const twoCol = makePitchDeck(`v_${Date.now()}`, {
    section: 'S1', title: 'Two Column Pin',
    bullets: ['alpha bullet line for the geometry pin', 'beta bullet line for the geometry pin'],
    visualImage: 'images/test.png',
  });
  // Same theme, no visual: hasRight=false keeps the legacy page-centered card.
  const singleCol = makePitchDeck(`s_${Date.now()}`, {
    section: 'S1', title: 'Single Column Pin',
    bullets: ['alpha bullet line for the legacy pin', 'beta bullet line for the legacy pin'],
  });

  test.skipIf(!haveFonts)('hasRight: the card rect stays left of the visual panel and no text op crosses it', () => {
    expect(twoCol.cards.length).toBe(1);
    const panelX = panelLeftPt(twoCol.page);
    expect(panelX).not.toBeNull();
    const card = twoCol.cards[0];
    const cardRightPt = (card.x + card.w) * PW_PT_EXACT;
    // The defect: the page-centered card ran THROUGH visR.x and the panel
    // (painted after the text) covered its right portion.
    expect(cardRightPt).toBeLessThanOrEqual(panelX! + 0.5);
    // No text op may start at or beyond the panel's left edge.
    const runs = textRunOps(twoCol.page);
    expect(runs.length).toBeGreaterThan(0);
    for (const r of runs) expect(r.x).toBeLessThan(panelX! + 0.5);
    // Panel still paints after the text (legacy z-order kept) — safe now
    // because nothing extends under it.
    const ls = twoCol.page.split('\n').map((l) => l.trim());
    const lastTextIdx = ls.map((l) => l.endsWith('Tj')).lastIndexOf(true);
    const panelIdx = ls.findIndex((l) => l === `${20 / 255} ${28 / 255} ${42 / 255} rg`);
    expect(panelIdx).toBeGreaterThan(lastTextIdx);
  });

  test.skipIf(!haveFonts)('single-column: the legacy page-centered card geometry is unchanged', () => {
    expect(singleCol.cards.length).toBe(1);
    const card = singleCol.cards[0];
    // cardX = CX + (CW - cardW0)/2 — horizontally centered in the printable
    // area (the pre-v1.16.0 geometry, kept byte-for-byte for !hasRight decks).
    expect(Math.abs(card.x + card.w / 2 - 0.5)).toBeLessThan(0.02);
    const panel = panelLeftPt(singleCol.page);
    expect(panel).toBeNull();                       // no visual panel on this slide
  });
});

// ── v1.17.0 U-20261119-010: opt-in framed pitch-enhanced parity ───────────────
//
// The frame block IS the compat gate: when the theme's pdf_layout_spec.json
// declares `frame`, standard/title/divider/contact(with visualImage) slides
// route to the framed renderers, punchline drops the `”` mark and accents the
// first statement line, video slides get a bottom-left caption chip, bg
// images / video thumbnails fill the FRAME, footnotes render inside the frame,
// and a post-pass mask paints everything outside the rounded frame with
// frame.page_rgb. Decks whose spec has no `frame` key keep the 1.16.0
// rendering byte-for-byte (verified at PR time: all decompressed content
// streams of zen + pitch fixtures are identical old→new; only the embedded
// ModDate metadata string differs, which is inherent pdf-lib behavior).

const THEMES_ROOT = join(ROOT, 'docs/html-themes/themes');
const FRAME_PAGE_OP   = C_DARK_OP;                                    // frame.page_rgb [11,15,25]
const FRAME_ACCENT_OP = `${232 / 255} ${169 / 255} ${62 / 255} rg`;   // frame.accent_rgb [232,169,62]
const FRAME_VIDEO_CAPTION_OP = '0.92 0.93 0.95 rg';                   // rgb(0.92, 0.93, 0.95)
// 1280×720 reference viewport maps onto the 338.7×190.5mm page
// (k = 0.264609375 mm/px); MM_TO_PT = 2.835.
const FRAME_PX_TO_PT   = (338.7 / 1280) * 2.835;
const FRAME_BOTTOM_PT  = (720 - 86 - 548) * FRAME_PX_TO_PT;  // frame bottom edge above page bottom (≈64.5pt)
const FRAME_TEXT_PT    = 12 * FRAME_PX_TO_PT;                // eyebrow/caption/footnote px size (≈9.0pt)
const FRAME_VIDEO_CAP_PT = 13.6 * FRAME_PX_TO_PT;            // .video-caption chip (≈10.2pt)

/** Real page content streams. Embedded font binaries also contain the byte
 *  sequences "Tj"/"BT", so require an actual `Tf` operator line too. */
function pageStreams(pdfPath: string): string[] {
  return decompressedStreams(pdfPath).filter((s) => s.includes('BT') && s.includes('ET') && /\n\/\S+ [\d.]+ Tf\n/.test(s));
}

describe('v1.17.0 U-20261119-010: opt-in frame block gates', () => {
  const spec = JSON.parse(readFileSync(join(THEMES_ROOT, 'pitch-enhanced/pdf_layout_spec.json'), 'utf-8'));

  test('pitch-enhanced ships the frame block with the measured 1280×720 geometry', () => {
    const f = spec.frame;
    expect(f).toBeDefined();
    expect(f.ref_w_px).toBe(1280);
    // The shipped geometry must stay the measured .slide values (1280×720).
    expect(f.x_px).toBe(51); expect(f.y_px).toBe(86);
    expect(f.w_px).toBe(1178); expect(f.h_px).toBe(548); expect(f.radius_px).toBe(20);
    expect(f.page_rgb).toEqual([11, 15, 25]);    // #0B0F19 darker page
    expect(f.frame_rgb).toEqual([17, 24, 39]);   // #111827 .slide fill
    expect(f.panel_rgba).toEqual([255, 255, 255, 0.03]);
    // Renderer-required FrameSpec keys.
    for (const k of ['col_x_px', 'col_y_px', 'col_w_px', 'col_h_px', 'panel_x_px', 'panel_w_px',
      'text_rgb', 'body_rgb', 'accent_rgb', 'muted_rgb',
      'eyebrow_px', 'eyebrow_lh_px', 'eyebrow_gap_px', 'title_px', 'title_lh_px', 'title_gap_px',
      'bullet_px', 'bullet_lh_px', 'bullet_gap_px', 'bullet_indent_px',
      'caption_px', 'caption_lh_px', 'caption_gap_px',
      'footnote_px', 'footnote_lh_px', 'footnote_bottom_px']) {
      expect(f[k]).toBeDefined();
    }
  });

  test('no other shipped theme declares a frame block (compat gate)', () => {
    for (const t of ['zen', 'pitch', 'outline', 'vertical', 'outlook']) {
      const s = JSON.parse(readFileSync(join(THEMES_ROOT, t, 'pdf_layout_spec.json'), 'utf-8'));
      expect(s.frame).toBeUndefined();
    }
  });

  test('source: every frame consumption site is gated on frame presence', () => {
    const src = readFileSync(TOOL, 'utf-8');
    // Renderer routing gates.
    expect(src).toContain('if (ctx.spec.frame && !ctx.data.videoId) return renderFramedStandard(ctx);');
    expect(src).toContain("if (layoutSpec.frame && type === 'contact' && data.visualImage)");
    expect(src).toContain("else if (layoutSpec.frame && type === 'title')   renderFramedTitle(ctx);");
    expect(src).toContain("else if (layoutSpec.frame && type === 'divider')   await renderFramedDivider(ctx);");
    // Post-pass mask + in-frame footnotes + frame-cover bg/thumbnail gates.
    expect(src).toMatch(/if \(layoutSpec\.frame\) \{\n\s*const g = frameGeom\(layoutSpec, coords\);\n\s*renderer\.maskOutsideFrame/);
    expect(src).toMatch(/if \(fns\.length > 0 && layoutSpec\.frame\)/);
    expect(src.match(/const fg = layoutSpec\.frame \? frameGeom\(layoutSpec, coords\) : null;/g)?.length).toBe(2);
    // Punchline gates: tracked eyebrow framed-only, `”` mark framed-skipped,
    // first statement line accent.
    expect(src).toContain('if (sec && framed)');
    expect(src).toContain('if (!cardMode && !framed)');
    expect(src).toContain('const lineInk = framed && li === 0 ? toRGB(spec.frame!.accent_rgb) : stmtInk;');
    // Video gates: frame-centred play button + bottom-left caption chip.
    expect(src).toContain('const vg = spec.frame ? frameGeom(spec, coords) : null;');
    expect(src).toContain('if (pillText && spec.frame)');
  });
});

describe.skipIf(!haveFonts)('v1.17.0 U-20261119-010: framed pitch-enhanced render pins', () => {
  // One 3-slide deck exercising every framed surface: standard (two-column,
  // caption, in-frame footnotes, per-slide background), two-sentence punchline,
  // contact-with-visual. BG_PROFILE activates the per-slide background so the
  // frame-cover pin (photo fills the FRAME, mask repaints the outside-frame
  // margin) is live on slide 1.
  function makeFramedDeck(tag: string, slides: Record<string, any>[], profile = BG_PROFILE) {
    const name = `_framed_${tag}`;
    const { dir, rel } = renderFixture(name, profile, slides, 'pitch-enhanced', 'premium-dark');
    mkdirSync(join(dir, 'images'), { recursive: true });
    writeFileSync(join(dir, 'images', 'test.png'), writeTinyPng());
    const res = runTool(TOOL, rel);
    expect(res.status).toBe(0);
    const pdfPath = join(dir, `${rel.split(/[\\/]/).pop()}.pdf`);
    expect(existsSync(pdfPath)).toBe(true);
    return { dir, pdfPath, pages: pageStreams(pdfPath) };
  }

  const framed = makeFramedDeck(`m_${Date.now()}`, [
    { section: 'S1', title: 'Framed Standard Pin', bullets: ['plain alpha bullet', 'bold **accent** bullet'], visualImage: 'images/test.png', visualCaption: 'Caption pin text', footnotes: ['SMR: Small Modular Reactor'], backgroundImage: 'images/test.png' },
    { isPunchlineSlide: true, section: 'PART 01', title: 'Punch Head', text: 'First sentence lands here\nSecond sentence follows', sub: 'support sub' },
    { isContactSlide: true, title: '감사합니다', contactEmail: 'a@b.c', contactLinkedIn: 'in/d-pinning', visualImage: 'images/test.png' },
  ]);

  test('every framed page carries the 9-op page_rgb mask signature', () => {
    expect(framed.pages.length).toBeGreaterThanOrEqual(3);
    // Composition per page: the generic C_DARK page fill (1) + the post-pass
    // mask (4 margin rects + 4 rounded-corner paths = 8). The legacy path has
    // no mask, so 9 ops is the framed fingerprint.
    for (const p of framed.pages.slice(0, 3)) {
      const n = p.split('\n').map((l) => l.trim()).filter((l) => l === FRAME_PAGE_OP).length;
      expect(n).toBe(9);
    }
  });

  test.skipIf(!havePdftoppm)('mask paints the outside-frame margin page_rgb; the frame interior keeps its own surface', () => {
    const PAGE_RGB = [11, 15, 25], FRAME_BG = [17, 24, 39];
    // Slide 1: the per-slide background photo covers the FRAME — the
    // outside-frame margin strip is repainted page_rgb by the mask.
    const corner = pagePixel(framed.pdfPath, 1, framed.dir, 0.01, 0.01);
    expect(corner).not.toBeNull();
    for (let i = 0; i < 3; i++) expect(Math.abs(corner![i] - PAGE_RGB[i])).toBeLessThanOrEqual(2);
    const margin = pagePixel(framed.pdfPath, 1, framed.dir, 0.01, 0.5);
    for (let i = 0; i < 3; i++) expect(Math.abs(margin![i] - PAGE_RGB[i])).toBeLessThanOrEqual(2);
    // Slide 2 (punchline, no background): the frame interior stays flat C_BG
    // [17,24,39] — the mask only ever paints OUTSIDE the frame.
    const inner = pagePixel(framed.pdfPath, 2, framed.dir, 0.30, 0.30);
    for (let i = 0; i < 3; i++) expect(Math.abs(inner![i] - FRAME_BG[i])).toBeLessThanOrEqual(2);
  });

  test('text layer: caption, in-frame footnotes, contact two-column, two-sentence punchline, no quote mark, no header counter', () => {
    const txt = extractText(framed.pdfPath);
    if (txt === null) return; // pdftotext unavailable — structural pins suffice
    expect(txt).toContain('Caption pin text');                 // visualCaption renders (HTML .cdk-caption parity)
    expect(txt).toContain('SMR: Small Modular Reactor');       // footnotes drawn INSIDE the frame
    expect(txt).toContain('a@b.c');                            // framed contact email line
    expect(txt).toContain('in/d-pinning');                     // framed contact linkedIn line
    expect(txt).toContain('First sentence lands here');
    expect(txt).toContain('Second sentence follows');
    expect(txt).not.toContain('”');                            // the decorative mark is framed-skipped
    expect(txt).not.toMatch(/\d \/ \d/);                       // no header bar / slide counter on framed pages
  });

  test('eyebrow/caption/footnote-size runs all sit ABOVE the frame bottom edge (in-frame placement)', () => {
    // The legacy footnote ladder anchors below the frame (≈41pt baseline);
    // the framed branch draws at the frame bottom (≈83pt baseline) and the
    // post-pass mask would erase anything left outside the frame band.
    const runs = textRunOps(framed.pages[0]).filter((r) => r.size !== null && Math.abs(r.size - FRAME_TEXT_PT) < 0.2);
    expect(runs.length).toBeGreaterThan(0);
    for (const r of runs) expect(r.y).toBeGreaterThan(FRAME_BOTTOM_PT);
  });

  test('punchline: first statement line renders in frame accent, the rest in statement ink', () => {
    const runs = textRunOps(framed.pages[1]);
    const maxSz = Math.max(...runs.map((r) => r.size));
    const stmt = runs.filter((r) => r.size === maxSz);
    expect(stmt.length).toBeGreaterThan(0);
    const topY = Math.max(...stmt.map((r) => r.y));
    const bottomY = Math.min(...stmt.map((r) => r.y));
    expect(topY).toBeGreaterThan(bottomY);                     // two sentence rows
    // HTML `.slide-title::first-line { color: accent }` parity.
    for (const r of stmt.filter((r) => r.y === topY)) expect(r.rg).toBe(FRAME_ACCENT_OP);
    for (const r of stmt.filter((r) => r.y === bottomY)) expect(r.rg).toBe('1 1 1 rg');   // statement ink (bgDrawn=false)
  });

  // The no-frame side of the punchline gate: zen declares `punchline` and has
  // no frame block, so the decorative `”` mark MUST still render there.
  const zenPunch = (() => {
    const name = `_framed_zenpunch_${Date.now()}`;
    const { dir, rel } = renderFixture(name, [], [
      { isPunchlineSlide: true, title: 'Punch Head', text: 'First sentence lands here\nSecond sentence follows', sub: 'support sub' },
    ], 'zen', 'white-bubble');
    const res = runTool(TOOL, rel);
    expect(res.status).toBe(0);
    return { pdfPath: join(dir, `${rel.split(/[\\/]/).pop()}.pdf`) };
  })();

  test('legacy contrast: a no-frame punchline keeps the decorative quote mark', () => {
    const txt = extractText(zenPunch.pdfPath);
    if (txt === null) return;
    expect(txt).toContain('”');
  });

  // Framed video slides keep the legacy standard renderer (play button + full
  // page link) but the title pill becomes a bottom-left .video-caption chip.
  const videoRun = (() => {
    const run = makeFramedDeck(`v_${Date.now()}`, [
      { section: 'S4', title: 'Video Caption Pin', videoId: 'dQw4w9WgXcQ', videoThumbnail: 'images/test.png' },
    ], []);
    return { pdfPath: run.pdfPath, pages: run.pages };
  })();

  test('framed video slide: title renders as the bottom-left .video-caption chip, not the top pill', () => {
    expect(videoRun.pages.length).toBeGreaterThanOrEqual(1);
    const runs = textRunOps(videoRun.pages[0]).filter((r) => r.rg === FRAME_VIDEO_CAPTION_OP);
    expect(runs.length).toBeGreaterThan(0);
    for (const r of runs) {
      expect(r.size).toBeCloseTo(FRAME_VIDEO_CAP_PT, 1);
      expect(r.y).toBeLessThan(150);   // legacy pill baseline ≈505pt (page top); framed chip ≈84pt (frame bottom-left)
    }
  });
});
