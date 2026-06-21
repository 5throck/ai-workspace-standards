// @version 1.1.0
// Generate a slide deck PDF from slidedata.json using pdf-lib.
// Merges gen_full.py + gen_sample5.py — use --sample N to limit slide count.
// Usage:
//   bun scripts/gen-slides-pdf.ts --project presentations/<project> [--out name.pdf] [--sample 5]
//   --project  project folder (relative to workspace root)
//   --out      output PDF filename (default: <folder>.pdf or <folder>_sample<N>.pdf)
//   --sample   limit to first N slides only (omit for full deck)
//   --font-dir directory containing MaruBuri TTF files (default: fonts/)
//   --data     path to slidedata.json (default: <project>/slidedata.json)
// Requires: pdf-lib @pdf-lib/fontkit (bun install pdf-lib @pdf-lib/fontkit)

import { PDFDocument, PDFFont, PDFPage, rgb, RGB } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import { readFileSync, writeFileSync, existsSync, statSync } from 'fs';
import { join, resolve, dirname } from 'path';

// ── Constants ─────────────────────────────────────────────────────────────────

const MM_TO_PT = 2.835;
const mm = (v: number) => v * MM_TO_PT;

// ── Spec merge helpers ────────────────────────────────────────────────────────

function deepMerge(base: any, override: any): any {
  if (!override) return base;
  const result = { ...base };
  for (const key of Object.keys(override)) {
    if (typeof override[key] === 'object' && !Array.isArray(override[key]) && override[key] !== null) {
      result[key] = deepMerge(base[key] ?? {}, override[key]);
    } else {
      result[key] = override[key];
    }
  }
  return result;
}

// Convert an [R, G, B] array (0-255) to a pdf-lib RGB value
const toRGB = (arr: number[]) => rgb(arr[0] / 255, arr[1] / 255, arr[2] / 255);

// ── Frontmatter parser ────────────────────────────────────────────────────────

function parseFrontmatter(content: string): Record<string, any> {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return {};
  const frontmatterContent = match[1];
  const lines = frontmatterContent.split('\n');
  const result: Record<string, any> = {};
  for (const line of lines) {
    const themeMatch = line.match(/^\s{2}theme:\s*(\S+)/);
    const styleMatch = line.match(/^\s{2}style:\s*(\S+)/);
    if (themeMatch) result.theme = themeMatch[1];
    if (styleMatch) result.style = styleMatch[1];
  }
  const overrides = parseLayoutOverrides(frontmatterContent);
  if (Object.keys(overrides).length > 0) {
    result.layout_overrides = overrides;
  }
  return result;
}

function parseScalar(raw: string): any {
  // RGB array: [R, G, B]
  const arrMatch = raw.match(/^\[(\d+),\s*(\d+),\s*(\d+)\]$/);
  if (arrMatch) return [Number(arrMatch[1]), Number(arrMatch[2]), Number(arrMatch[3])];
  // Number
  if (/^-?\d+(\.\d+)?$/.test(raw)) return Number(raw);
  // Boolean
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  // String (strip optional quotes)
  return raw.replace(/^["']|["']$/g, '');
}

function parseIndentedBlock(lines: string[], baseIndent: number): { value: Record<string, any>, consumed: number } {
  const result: Record<string, any> = {};
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const indent = line.search(/\S/);
    if (indent < 0) { i++; continue; }  // blank line
    if (indent < baseIndent) break;
    if (indent > baseIndent) { i++; continue; }  // unexpected deeper indent, skip

    const match = line.match(/^(\s*)([\w_-]+):\s*(.*)/);
    if (!match) { i++; continue; }

    const key = match[2];
    const rawVal = match[3].trim();

    if (!rawVal) {
      // Nested object — collect child lines
      const childLines = lines.slice(i + 1);
      const { value, consumed } = parseIndentedBlock(childLines, indent + 2);
      result[key] = value;
      i += 1 + consumed;
    } else {
      // Scalar value
      result[key] = parseScalar(rawVal);
      i++;
    }
  }

  return { value: result, consumed: i };
}

function parseLayoutOverrides(frontmatter: string): Record<string, any> {
  const lines = frontmatter.split('\n');

  // Find the layout_overrides: line (uncommented)
  let startIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (trimmed === 'layout_overrides:' && !lines[i].trimStart().startsWith('#')) {
      startIdx = i;
      break;
    }
  }
  if (startIdx === -1) return {};

  // Collect subsequent indented uncommented lines
  const block: string[] = [];
  for (let i = startIdx + 1; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;  // skip blank/comment
    // Stop if we hit a top-level key (no leading spaces)
    if (line.length > 0 && line[0] !== ' ') break;
    block.push(line);
  }

  // Parse indented block into nested object
  return parseIndentedBlock(block, 0).value;
}

// ── Slide renderer ────────────────────────────────────────────────────────────

class Renderer {
  private page!: PDFPage;
  private regular: PDFFont;
  private bold: PDFFont;
  private curFont: PDFFont;
  private curSize = 12;
  private curColor: RGB;
  readonly pageW: number;   // pts
  readonly pageH: number;   // pts

  constructor(regular: PDFFont, bold: PDFFont, pageWMm: number, pageHMm: number, defaultColor: RGB) {
    this.regular   = regular;
    this.bold      = bold;
    this.curFont   = regular;
    this.curColor  = defaultColor;
    this.pageW     = mm(pageWMm);
    this.pageH     = mm(pageHMm);
  }

  setPage(p: PDFPage) { this.page = p; }

  // Convert mm (fpdf2-style top-left origin) → pts bottom-left (pdf-lib)
  private pt(v: number) { return mm(v); }
  private fy(yMm: number) { return this.pageH - mm(yMm); }  // flip Y: top → bottom

  setFont(bold: boolean, sizePt: number) {
    this.curFont = bold ? this.bold : this.regular;
    this.curSize = sizePt;
  }
  setColor(c: RGB) { this.curColor = c; }

  fillRect(xMm: number, yMm: number, wMm: number, hMm: number, color: RGB) {
    this.page.drawRectangle({
      x: this.pt(xMm),
      y: this.fy(yMm + hMm),   // bottom-left y
      width:  this.pt(wMm),
      height: this.pt(hMm),
      color,
    });
  }

  // Draw a single line of text. yMm is the top of the line (fpdf2 style).
  // We approximate the baseline as yMm + cellH * 0.68 (empirical for typical fonts).
  private drawLine(text: string, xMm: number, yMm: number, cellH: number) {
    const baselineY = this.fy(yMm + cellH * 0.72);
    this.page.drawText(text, {
      x: this.pt(xMm),
      y: baselineY,
      size:  this.curSize,
      font:  this.curFont,
      color: this.curColor,
    });
  }

  // Single-line cell (no wrapping)
  cell(wMm: number, hMm: number, text: string, xMm: number, yMm: number, align: 'L' | 'R' | 'C' = 'L') {
    if (!text) return;
    let drawX = xMm;
    if (align !== 'L') {
      const tw = this.stringWidth(text);
      drawX = align === 'C' ? xMm + (wMm - tw) / 2 : xMm + wMm - tw;
    }
    this.drawLine(text, drawX, yMm, hMm);
  }

  // Multi-line cell — returns Y position after last line (mm from top)
  multiCell(wMm: number, hMm: number, text: string, xMm: number, yMm: number, align: 'L' | 'R' | 'C' = 'L'): number {
    const lines = this.wrapText(text, wMm);
    let y = yMm;
    for (const line of lines) {
      this.cell(wMm, hMm, line, xMm, y, align);
      y += hMm;
    }
    return y;
  }

  // Returns text width in mm
  stringWidth(text: string): number {
    return this.curFont.widthOfTextAtSize(text, this.curSize) / MM_TO_PT;
  }

  wrapText(text: string, maxWidthMm: number): string[] {
    const words = text.split(' ');
    const lines: string[] = [];
    let line = '';
    let lineW = 0;

    for (let i = 0; i < words.length; i++) {
      const word   = words[i];
      const suffix = i < words.length - 1 ? ' ' : '';
      const ww     = this.stringWidth(word + suffix);

      if (lineW > 0 && lineW + ww > maxWidthMm) {
        lines.push(line.trimEnd());
        line  = word + suffix;
        lineW = this.stringWidth(word + suffix);
      } else {
        line  += word + suffix;
        lineW += ww;
      }
    }
    if (line.trim()) lines.push(line.trimEnd());
    return lines;
  }

  // Estimate total rendered height of a bullet list in mm
  estimateBulletHeight(bullets: string[], widthMm: number, tBul: number, lhBul: number, bulGap: number): number {
    this.setFont(false, tBul);
    let total = 0;
    let nValid = 0;
    for (const b of bullets) {
      const t = strip(b);
      if (!t) continue;
      nValid++;
      total += this.wrapText(t, widthMm).length * lhBul + bulGap;
    }
    if (nValid > 0) total -= bulGap;
    return total;
  }

  estimateTextHeight(text: string, widthMm: number, sizePt: number, lhMm: number, bold = false): number {
    this.setFont(bold, sizePt);
    return this.wrapText(text, widthMm).length * lhMm;
  }

  drawHLine(x1Mm: number, y1Mm: number, x2Mm: number, widthMm: number, color: RGB) {
    this.page.drawLine({
      start: { x: this.pt(x1Mm), y: this.fy(y1Mm) },
      end:   { x: this.pt(x2Mm), y: this.fy(y1Mm) },
      color,
      thickness: this.pt(widthMm),
    });
  }

  drawEllipse(xMm: number, yMm: number, diamMm: number, color: RGB) {
    // fpdf2 ellipse(x, y, w, h): x,y = top-left of bounding box, w,h = diameter
    const cx = this.pt(xMm + diamMm / 2);
    const cy = this.fy(yMm + diamMm / 2);
    this.page.drawEllipse({ x: cx, y: cy, xScale: this.pt(diamMm / 2), yScale: this.pt(diamMm / 2), color });
  }

  async placeImage(doc: PDFDocument, imgPath: string, xMm: number, yMm: number, mwMm: number, mhMm: number) {
    try {
      const data = readFileSync(imgPath);
      const ext  = imgPath.split('.').pop()?.toLowerCase();
      const img  = ext === 'png' ? await doc.embedPng(data) : await doc.embedJpg(data);
      const { width: ow, height: oh } = img;
      const asp = oh / ow;
      let iw = mwMm, ih = iw * asp;
      if (ih > mhMm) { ih = mhMm; iw = ih / asp; }
      const ix = xMm + (mwMm - iw) / 2;
      const iy = yMm + (mhMm - ih) / 2;
      this.page.drawImage(img, {
        x: this.pt(ix),
        y: this.fy(iy + ih),
        width:  this.pt(iw),
        height: this.pt(ih),
      });
    } catch (e: any) {
      console.warn(`  img err: ${e.message}`);
    }
  }
}

// ── Text utilities ────────────────────────────────────────────────────────────

function strip(s: string | undefined | null): string {
  return (s ?? '').replace(/<[^>]+>/g, '').replace(/\*\*/g, '');
}

function imgPath(src: string | undefined, imgDir: string): string | null {
  if (!src) return null;
  const fname = src.replace('images/', '');
  const p = join(imgDir, fname);
  return existsSync(p) ? p : null;
}

// ── Slide data type ───────────────────────────────────────────────────────────

interface SlideData {
  section?:       string;
  title?:         string;
  subtitle?:      string;
  meta?:          string;
  desc?:          string;
  partNum?:       string;
  bullets?:       string[];
  visualImage?:   string;
  visualTitle?:   string;
  visualDisplay?: string;
  isTitleSlide?:  boolean;
  isDividerSlide?: boolean;
  isPunchline?:   boolean;
}

// ── Layout spec type ──────────────────────────────────────────────────────────

interface LayoutSpec {
  page?: {
    width_mm?: number;
    height_mm?: number;
    margin_mm?: number;
  };
  calibration?: {
    viewport_px?: number;
  };
  fonts?: {
    title_pt?: number;
    bullet_pt?: number;
    punchline_pt?: number;
    punchline_sub_pt?: number;
  };
  layout?: {
    pad_x?: number;
    hdr_y?: number;
    hdr_h?: number;
    title_y?: number;
    main_y?: number;
    bul_w?: number;
    vis_x?: number;
    vis_y?: number;
    vis_w?: number;
    vis_h?: number;
    vis_pad?: number;
    ts_title_y?: number;
    ts_sub_y?: number;
    ts_meta_y?: number;
    ts_w?: number;
    div_img_x?: number;
    div_img_y?: number;
    div_img_w?: number;
    div_img_h?: number;
    div_txt_w?: number;
  };
  colors?: {
    background?: number[];
    white?: number[];
    dark?: number[];
    text?: number[];
    text_muted?: number[];
    accent?: number[];
    border?: number[];
    body?: number[];
    vis_bg?: number[];
    dark2?: number[];
    dark3?: number[];
    meta?: number[];
  };
}

// ── Slide render functions ────────────────────────────────────────────────────

async function drawHeader(
  r: Renderer,
  sec: string,
  n: number,
  total: number,
  spec: LayoutSpec,
  // derived coords passed in
  CX: number, CY: number, CW: number, CH: number,
  hdr_y: number, hdr_h: number, bul_x: number, pad_x: number,
  C_DARK: RGB, C_ACCENT: RGB, C_MUTED: RGB, C_BORDER: RGB,
  T_SECT: number, T_NUM: number,
) {
  r.fillRect(CX, CY, CW, hdr_y - CY + hdr_h, C_DARK);
  const hy = hdr_y + hdr_h * 0.18;
  r.setFont(true,  T_SECT); r.setColor(C_ACCENT);
  r.cell(180, hdr_h * 0.6, sec.toUpperCase(), bul_x, hy, 'L');
  r.setFont(false, T_NUM);  r.setColor(C_MUTED);
  r.cell(30, hdr_h * 0.6, `${n} / ${total}`, CX + CW - 45, hy, 'R');
  r.drawHLine(bul_x, hdr_y + hdr_h, CX + CW - pad_x, 0.088, C_BORDER);
}

async function renderTitleSlide(
  r: Renderer,
  doc: PDFDocument,
  data: SlideData,
  n: number,
  total: number,
  spec: LayoutSpec,
  coords: ReturnType<typeof buildCoords>,
  colors: ReturnType<typeof buildColors>,
  sizes: ReturnType<typeof buildSizes>,
) {
  const { CX, CY, CW, CH, hdr_y, hdr_h, bul_x, pad_x, ts_w, ts_title_y, ts_sub_y, ts_meta_y, px2mm } = coords;
  const { C_DARK, C_ACCENT, C_MUTED, C_BORDER, C_WHITE, C_META } = colors;
  const { T_SECT, T_NUM, T_TS_TITLE, T_TS_SUB, T_TS_META } = sizes;

  await drawHeader(r, strip(data.section), n, total, spec, CX, CY, CW, CH, hdr_y, hdr_h, bul_x, pad_x, C_DARK, C_ACCENT, C_MUTED, C_BORDER, T_SECT, T_NUM);

  r.setFont(true,  T_TS_TITLE); r.setColor(C_WHITE);
  r.multiCell(ts_w, px2mm(70.0), strip(data.title), bul_x, ts_title_y);

  r.setFont(false, T_TS_SUB); r.setColor(C_MUTED);
  r.multiCell(ts_w, px2mm(36), strip(data.subtitle), bul_x, ts_sub_y);

  r.setFont(true,  T_TS_META); r.setColor(C_META);
  r.multiCell(ts_w, px2mm(24), strip(data.meta), bul_x, ts_meta_y);
}

async function renderDividerSlide(
  r: Renderer,
  doc: PDFDocument,
  data: SlideData,
  n: number,
  total: number,
  imgDir: string,
  spec: LayoutSpec,
  coords: ReturnType<typeof buildCoords>,
  colors: ReturnType<typeof buildColors>,
  sizes: ReturnType<typeof buildSizes>,
) {
  const { CX, CY, CW, CH, hdr_y, hdr_h, bul_x, pad_x, div_img_x, div_img_y, div_img_w, div_img_h, div_txt_w, px2mm } = coords;
  const { C_DARK, C_ACCENT, C_MUTED, C_BORDER, C_TEXT, C_DARK2, C_DARK3 } = colors;
  const { T_SECT, T_NUM, T_DIV_PART, T_DIV_TITLE, T_DIV_DESC } = sizes;

  r.fillRect(CX, CY, CW, CH, C_DARK2);
  await drawHeader(r, strip(data.section), n, total, spec, CX, CY, CW, CH, hdr_y, hdr_h, bul_x, pad_x, C_DARK, C_ACCENT, C_MUTED, C_BORDER, T_SECT, T_NUM);

  const py0 = CY + 0.40 * CH;
  r.setFont(true, T_DIV_PART); r.setColor(C_ACCENT);
  r.cell(div_txt_w, px2mm(28), (strip(data.partNum)).toUpperCase(), bul_x, py0, 'L');

  const py1 = py0 + px2mm(34);
  r.setFont(true, T_DIV_TITLE); r.setColor(C_TEXT);
  const LH_DIV_TITLE = px2mm(56.0);
  const afterTitle = r.multiCell(div_txt_w, LH_DIV_TITLE, strip(data.title), bul_x, py1, 'L');

  const py2 = afterTitle + px2mm(16);
  r.setFont(false, T_DIV_DESC); r.setColor(C_MUTED);
  const LH_DIV_DESC = px2mm(28.16);
  r.multiCell(div_txt_w, LH_DIV_DESC, strip(data.desc), bul_x, py2, 'L');

  const ip = imgPath(data.visualImage, imgDir);
  if (ip) {
    r.fillRect(div_img_x, div_img_y, div_img_w, div_img_h, C_DARK3);
    await r.placeImage(doc, ip, div_img_x, div_img_y, div_img_w, div_img_h);
  }
}

async function renderPunchlineSlide(
  r: Renderer,
  doc: PDFDocument,
  data: SlideData,
  n: number,
  total: number,
  spec: LayoutSpec,
  coords: ReturnType<typeof buildCoords>,
  colors: ReturnType<typeof buildColors>,
  sizes: ReturnType<typeof buildSizes>,
) {
  const { CX, CY, CW, CH } = coords;
  const { C_BG, C_ACCENT, C_MUTED } = colors;

  const punchlinePt    = spec.fonts?.punchline_pt    ?? 48;
  const punchlineSubPt = spec.fonts?.punchline_sub_pt ?? 20;

  // Fill background
  r.fillRect(CX, CY, CW, CH, C_BG);

  // Center title vertically
  const titleLh  = punchlinePt / MM_TO_PT;
  const subLh    = punchlineSubPt / MM_TO_PT;
  const gap      = 6;
  const blockH   = titleLh + gap + subLh;
  const startY   = CY + (CH - blockH) / 2;

  r.setFont(true, punchlinePt); r.setColor(C_ACCENT);
  r.multiCell(CW, titleLh, strip(data.title), CX, startY, 'C');

  const subText = strip(data.subtitle) || strip((data.bullets ?? [])[0]);
  if (subText) {
    r.setFont(false, punchlineSubPt); r.setColor(C_MUTED);
    r.multiCell(CW, subLh, subText, CX, startY + titleLh + gap, 'C');
  }
}

async function renderStandardSlide(
  r: Renderer,
  doc: PDFDocument,
  data: SlideData,
  n: number,
  total: number,
  imgDir: string,
  spec: LayoutSpec,
  coords: ReturnType<typeof buildCoords>,
  colors: ReturnType<typeof buildColors>,
  sizes: ReturnType<typeof buildSizes>,
) {
  const { CX, CY, CW, CH, hdr_y, hdr_h, bul_x, pad_x, vis_x, vis_y, vis_w, vis_h, img_pad, title_y, main_y, bul_w, px2mm } = coords;
  const { C_DARK, C_ACCENT, C_MUTED, C_BORDER, C_WHITE, C_BODY, C_VIS_BG } = colors;
  const { T_SECT, T_NUM, T_TITLE, T_BUL, T_VIS_T, T_VIS_B } = sizes;

  const LH_TITLE = px2mm(46.0);
  const LH_BUL   = px2mm(29.44);
  const BUL_GAP  = px2mm(19.2);

  await drawHeader(r, strip(data.section), n, total, spec, CX, CY, CW, CH, hdr_y, hdr_h, bul_x, pad_x, C_DARK, C_ACCENT, C_MUTED, C_BORDER, T_SECT, T_NUM);

  const hasRight = !!(data.visualImage || data.visualDisplay || data.visualTitle);
  const titleW   = CW - pad_x * 2;
  const bulTxtW  = hasRight ? bul_w : CW - pad_x * 2;

  r.setFont(true, T_TITLE); r.setColor(C_WHITE);
  r.multiCell(titleW, LH_TITLE, strip(data.title), bul_x, title_y, 'L');

  const bullets     = data.bullets ?? [];
  const availableH  = (CY + CH) - main_y - 4;
  const totalBh     = r.estimateBulletHeight(bullets, bulTxtW - 6, T_BUL, LH_BUL, BUL_GAP);
  let by            = main_y + Math.max(0, (availableH - totalBh) / 2);

  for (const b of bullets) {
    const txt = strip(b);
    if (!txt) continue;
    if (by > CY + CH - 6) break;
    r.drawEllipse(bul_x, by + LH_BUL * 0.28, 3.2, C_ACCENT);
    r.setFont(false, T_BUL); r.setColor(C_BODY);
    const afterBul = r.multiCell(bulTxtW - 6, LH_BUL, txt, bul_x + 6, by, 'L');
    by = afterBul + BUL_GAP;
  }

  if (hasRight) {
    r.fillRect(vis_x, vis_y, vis_w, vis_h, C_VIS_BG);
    const ip = imgPath(data.visualImage, imgDir);
    if (ip) {
      await r.placeImage(doc, ip, vis_x + img_pad, vis_y + img_pad, vis_w - img_pad * 2, vis_h - img_pad * 2);
    } else {
      const vt = strip(data.visualTitle);
      const vd = strip(data.visualDisplay);
      const lhVt = px2mm(20), lhVb = px2mm(24), gap = 4;
      const hVt = vt ? r.estimateTextHeight(vt, vis_w - 8, T_VIS_T, lhVt, true)  : 0;
      const hVb = vd ? r.estimateTextHeight(vd, vis_w - 8, T_VIS_B, lhVb, false) : 0;
      const totalH = hVt + (vt && vd ? gap : 0) + hVb;
      let vy = vis_y + Math.max(0, (vis_h - totalH) / 2);
      if (vt) {
        r.setFont(true,  T_VIS_T); r.setColor(C_ACCENT);
        vy = r.multiCell(vis_w - 8, lhVt, vt, vis_x + 4, vy, 'C') + gap;
      }
      if (vd) {
        r.setFont(false, T_VIS_B); r.setColor(C_MUTED);
        r.multiCell(vis_w - 8, lhVb, vd, vis_x + 4, vy, 'C');
      }
    }
  }
}

// ── Derived coordinate builder ────────────────────────────────────────────────

function buildCoords(spec: LayoutSpec) {
  const PW  = spec.page?.width_mm  ?? 338.7;
  const PH  = spec.page?.height_mm ?? 190.5;
  const CM  = spec.page?.margin_mm ?? 5.0;
  const VP  = spec.calibration?.viewport_px ?? 611.4;

  const CX = CM, CY = CM;
  const CW = PW - CM * 2;
  const CH = PH - CM * 2;

  const px2pt = (px: number) => (px / VP) * CH * 2.835;
  const px2mm = (px: number) => (px / VP) * CH;

  const L = spec.layout ?? {};

  const P_PAD_X      = L.pad_x      ?? 0.0438;
  const P_HDR_Y      = L.hdr_y      ?? 0.091;
  const P_HDR_H      = L.hdr_h      ?? 0.064;
  const P_TITLE_Y    = L.title_y    ?? 0.224;
  const P_MAIN_Y     = L.main_y     ?? 0.349;
  const P_BUL_W      = L.bul_w      ?? 0.503;
  const P_VIS_X      = L.vis_x      ?? 0.584;
  const P_VIS_Y      = L.vis_y      ?? 0.390;
  const P_VIS_W      = L.vis_w      ?? 0.372;
  const P_VIS_H      = L.vis_h      ?? 0.561;
  const P_VIS_PAD    = L.vis_pad    ?? 0.052;
  const P_TS_TITLE_Y = L.ts_title_y ?? 0.3967;
  const P_TS_SUB_Y   = L.ts_sub_y   ?? 0.5346;
  const P_TS_META_Y  = L.ts_meta_y  ?? 0.6676;
  const P_TS_W       = L.ts_w       ?? 0.9123;
  const P_DIV_IMG_X  = L.div_img_x  ?? 0.5582;
  const P_DIV_IMG_Y  = L.div_img_y  ?? 0.2613;
  const P_DIV_IMG_W  = L.div_img_w  ?? 0.3972;
  const P_DIV_IMG_H  = L.div_img_h  ?? 0.6059;
  const P_DIV_TXT_W  = L.div_txt_w  ?? 0.4766;

  const pad_x   = P_PAD_X * CW;
  const hdr_y   = CY + P_HDR_Y * CH;
  const hdr_h   = P_HDR_H * CH;
  const bul_x   = CX + pad_x;
  const bul_w   = P_BUL_W * CW;
  const title_y = CY + P_TITLE_Y * CH;
  const main_y  = CY + P_MAIN_Y * CH;
  const vis_x   = CX + P_VIS_X * CW;
  const vis_y   = CY + P_VIS_Y * CH;
  const vis_w   = P_VIS_W * CW;
  const vis_h   = P_VIS_H * CH;
  const img_pad = P_VIS_PAD * vis_w;

  const ts_w       = P_TS_W * CW;
  const ts_title_y = CY + P_TS_TITLE_Y * CH;
  const ts_sub_y   = CY + P_TS_SUB_Y * CH;
  const ts_meta_y  = CY + P_TS_META_Y * CH;

  const div_img_x = CX + P_DIV_IMG_X * CW;
  const div_img_y = CY + P_DIV_IMG_Y * CH;
  const div_img_w = P_DIV_IMG_W * CW;
  const div_img_h = P_DIV_IMG_H * CH;
  const div_txt_w = P_DIV_TXT_W * CW;

  return {
    PW, PH, CM, CX, CY, CW, CH,
    px2pt, px2mm,
    pad_x, hdr_y, hdr_h, bul_x, bul_w, title_y, main_y,
    vis_x, vis_y, vis_w, vis_h, img_pad,
    ts_w, ts_title_y, ts_sub_y, ts_meta_y,
    div_img_x, div_img_y, div_img_w, div_img_h, div_txt_w,
  };
}

// ── Color builder ─────────────────────────────────────────────────────────────

function buildColors(spec: LayoutSpec) {
  const c = spec.colors ?? {};
  return {
    C_BG     : toRGB(c.background  ?? [17,  24,  39]),
    C_WHITE  : toRGB(c.white       ?? [255, 255, 255]),
    C_DARK   : toRGB(c.dark        ?? [11,  15,  25]),
    C_TEXT   : toRGB(c.text        ?? [226, 232, 240]),
    C_MUTED  : toRGB(c.text_muted  ?? [156, 163, 175]),
    C_ACCENT : toRGB(c.accent      ?? [217, 119, 6]),
    C_BORDER : toRGB(c.border      ?? [31,  41,  55]),
    C_BODY   : toRGB(c.body        ?? [203, 213, 225]),
    C_VIS_BG : toRGB(c.vis_bg      ?? [20,  28,  42]),
    C_DARK2  : toRGB(c.dark2       ?? [10,  14,  22]),
    C_DARK3  : toRGB(c.dark3       ?? [8,   12,  22]),
    C_META   : toRGB(c.meta        ?? [100, 108, 120]),
  };
}

// ── Font size builder ─────────────────────────────────────────────────────────

function buildSizes(spec: LayoutSpec, px2pt: (px: number) => number) {
  const f = spec.fonts ?? {};
  return {
    T_SECT      : px2pt(13.6),
    T_NUM       : px2pt(14.4),
    T_TITLE     : f.title_pt  ?? 28.0,
    T_BUL       : f.bullet_pt ?? 12.5,
    T_VIS_T     : px2pt(13.6),
    T_VIS_B     : px2pt(16.0),
    T_TS_TITLE  : px2pt(56.0),
    T_TS_SUB    : px2pt(24.0),
    T_TS_META   : px2pt(16.0),
    T_DIV_PART  : px2pt(22.4),
    T_DIV_TITLE : f.title_pt  ?? 28.0,
    T_DIV_DESC  : 13.0,
  };
}

// ── CLI ───────────────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  const get  = (flag: string) => { const i = args.indexOf(flag); return i >= 0 ? args[i + 1] : undefined; };

  const projectArg = get('--project');
  if (!projectArg) {
    console.error('Usage: bun scripts/gen-slides-pdf.ts --project presentations/<project> [--out name.pdf] [--sample 5] [--font-dir fonts/] [--data path/to/slidedata.json]');
    process.exit(1);
  }

  const workspaceRoot = resolve(dirname(import.meta.path), '../..');
  const projectDir    = resolve(workspaceRoot, projectArg);
  if (!existsSync(projectDir)) {
    console.error(`Project folder not found: ${projectDir}`); process.exit(1);
  }

  // ── Read lecture-profile.md and parse theme/style ─────────────────────────
  const lectureProfilePath = join(projectDir, 'lecture-profile.md');
  let lectureProfile: Record<string, any> = {};
  if (existsSync(lectureProfilePath)) {
    const profileContent = readFileSync(lectureProfilePath, 'utf-8');
    lectureProfile = parseFrontmatter(profileContent);
  }

  const theme = lectureProfile.theme ?? 'scroll';
  const style = lectureProfile.style ?? 'classic';

  // ── Load spec files (3-layer merge) ──────────────────────────────────────
  const themeSpecPath = resolve(workspaceRoot, `docs/html-themes/themes/${theme}/pdf_layout_spec.json`);
  const styleSpecPath = resolve(workspaceRoot, `docs/html-themes/styles/${style}/pdf_color_spec.json`);

  const themeSpec: LayoutSpec = existsSync(themeSpecPath) ? JSON.parse(readFileSync(themeSpecPath, 'utf-8')) : {};
  const styleSpec: any        = existsSync(styleSpecPath) ? JSON.parse(readFileSync(styleSpecPath, 'utf-8')) : {};

  // Merge: themeSpec base → styleSpec colors → layout_overrides
  let layoutSpec: LayoutSpec = themeSpec;
  if (styleSpec.colors) {
    layoutSpec = deepMerge(layoutSpec, { colors: styleSpec.colors });
  }
  if (lectureProfile.layout_overrides) {
    layoutSpec = deepMerge(layoutSpec, lectureProfile.layout_overrides);
  }

  // ── Build derived geometry, colors, and font sizes ────────────────────────
  const coords = buildCoords(layoutSpec);
  const colors = buildColors(layoutSpec);
  const sizes  = buildSizes(layoutSpec, coords.px2pt);

  const { PW, PH, CW, CH, CX, CY } = coords;
  const { C_DARK, C_BG } = colors;

  // ── Parse remaining CLI flags ─────────────────────────────────────────────
  const sampleArg   = get('--sample');
  const sampleCount = sampleArg ? parseInt(sampleArg, 10) : null;

  const defaultPdfName = sampleCount != null
    ? `${projectDir.split(/[/\\]/).pop()}_sample${sampleCount}.pdf`
    : `${projectDir.split(/[/\\]/).pop()}.pdf`;

  const outName  = get('--out') ?? defaultPdfName;
  const fontDir  = resolve(workspaceRoot, get('--font-dir') ?? 'presentations/assets/fonts');
  const dataPath = resolve(get('--data') ?? join(projectDir, 'slidedata.json'));
  const imgDir   = resolve(workspaceRoot, 'presentations/assets/images');
  const outPath  = join(projectDir, outName);

  if (!existsSync(dataPath)) {
    console.error(`slidedata.json not found: ${dataPath}`);
    console.error('   Run bun scripts/extract_slidedata.mjs <html> first.');
    process.exit(1);
  }

  const fontR = join(fontDir, 'MaruBuri-Regular.ttf');
  const fontB = join(fontDir, 'MaruBuri-Bold.ttf');
  if (!existsSync(fontR) || !existsSync(fontB)) {
    console.error(`Font files not found: ${fontDir}/MaruBuri-*.ttf`);
    console.error('   Run bun scripts/download-font.ts maruburi first.');
    process.exit(1);
  }

  console.log(`Project: ${projectDir}`);
  console.log(`Output:  ${outPath}`);
  console.log(`Theme: ${theme}  Style: ${style}`);
  console.log(`Card ${CW.toFixed(1)}x${CH.toFixed(1)}mm`);

  let slideData: SlideData[] = JSON.parse(readFileSync(dataPath, 'utf-8'));
  if (sampleCount != null) slideData = slideData.slice(0, sampleCount);

  const TOTAL = slideData.length;

  const pdfDoc = await PDFDocument.create();
  pdfDoc.registerFontkit(fontkit);

  const regularFont = await pdfDoc.embedFont(readFileSync(fontR));
  const boldFont    = await pdfDoc.embedFont(readFileSync(fontB));
  const renderer    = new Renderer(regularFont, boldFont, PW, PH, colors.C_WHITE);

  for (let idx = 0; idx < slideData.length; idx++) {
    const data = slideData[idx];
    const page = pdfDoc.addPage([mm(PW), mm(PH)]);
    renderer.setPage(page);

    renderer.fillRect(0, 0, PW, PH, C_DARK);
    renderer.fillRect(CX, CY, CW, CH, C_BG);

    const n = idx + 1;

    if (data.isTitleSlide) {
      await renderTitleSlide(renderer, pdfDoc, data, n, TOTAL, layoutSpec, coords, colors, sizes);
    } else if (data.isDividerSlide && theme === 'scroll') {
      await renderDividerSlide(renderer, pdfDoc, data, n, TOTAL, imgDir, layoutSpec, coords, colors, sizes);
    } else if (data.isPunchline && theme === 'slideshow') {
      await renderPunchlineSlide(renderer, pdfDoc, data, n, TOTAL, layoutSpec, coords, colors, sizes);
    } else {
      await renderStandardSlide(renderer, pdfDoc, data, n, TOTAL, imgDir, layoutSpec, coords, colors, sizes);
    }

    if ((idx + 1) % 10 === 0 || idx + 1 === TOTAL) {
      console.log(`  Slide ${idx + 1}/${TOTAL}...`);
    }
  }

  const pdfBytes = await pdfDoc.save();
  writeFileSync(outPath, pdfBytes);

  const sizeKb = Math.round(statSync(outPath).size / 1024);
  console.log(`\nSaved -> ${outPath}`);
  console.log(`   Size: ${sizeKb}KB`);
}

main().catch(err => { console.error('Error:', err); process.exit(1); });
