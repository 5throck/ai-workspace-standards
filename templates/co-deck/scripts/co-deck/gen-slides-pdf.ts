// @version 1.0.0
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

// ── Page geometry (mm) ────────────────────────────────────────────────────────

const PW = 338.7;   // landscape width mm  (16:9)
const PH = 190.5;   // landscape height mm
const CM = 5.0;     // card margin mm
const CX = CM, CY = CM;
const CW = PW - CM * 2;   // 328.7
const CH = PH - CM * 2;   // 180.5

const MM_TO_PT = 2.835;
const mm = (v: number) => v * MM_TO_PT;

// ── Pixel → PDF unit helpers (calibrated from measure_layout.py output) ──────

const px2pt = (px: number) => (px / 611.4) * CH * 2.835;
const px2mm = (px: number) => (px / 611.4) * CH;

// ── Font sizes (pt) ───────────────────────────────────────────────────────────

const T_SECT      = px2pt(13.6);
const T_NUM       = px2pt(14.4);
const T_TITLE     = 28.0;
const T_BUL       = 12.5;
const T_VIS_T     = px2pt(13.6);
const T_VIS_B     = px2pt(16.0);
const T_TS_TITLE  = px2pt(56.0);
const T_TS_SUB    = px2pt(24.0);
const T_TS_META   = px2pt(16.0);
const T_DIV_PART  = px2pt(22.4);
const T_DIV_TITLE = 28.0;
const T_DIV_DESC  = 13.0;

// ── Line heights (mm) ─────────────────────────────────────────────────────────

const LH_TITLE     = px2mm(46.0);
const LH_BUL       = px2mm(29.44);
const BUL_GAP      = px2mm(19.2);
const LH_TS_TITLE  = px2mm(70.0);
const LH_DIV_TITLE = px2mm(56.0);
const LH_DIV_DESC  = px2mm(28.16);

// ── Layout percentages ────────────────────────────────────────────────────────

const P_PAD_X       = 0.0438;
const P_HDR_Y       = 0.091;
const P_HDR_H       = 0.064;
const P_TITLE_Y     = 0.224;
const P_MAIN_Y      = 0.349;
const P_BUL_W       = 0.503;
const P_VIS_X       = 0.584;
const P_VIS_Y       = 0.390;
const P_VIS_W       = 0.372;
const P_VIS_H       = 0.561;
const P_VIS_PAD     = 0.052;
const P_TS_TITLE_Y  = 0.3967;
const P_TS_SUB_Y    = 0.5346;
const P_TS_META_Y   = 0.6676;
const P_TS_W        = 0.9123;
const P_DIV_IMG_X   = 0.5582;
const P_DIV_IMG_Y   = 0.2613;
const P_DIV_IMG_W   = 0.3972;
const P_DIV_IMG_H   = 0.6059;
const P_DIV_TXT_W   = 0.4766;

// ── Derived mm coords ─────────────────────────────────────────────────────────

const pad_x    = P_PAD_X * CW;
const hdr_y    = CY + P_HDR_Y * CH;
const hdr_h    = P_HDR_H * CH;
const bul_x    = CX + pad_x;
const bul_w    = P_BUL_W * CW;
const title_y  = CY + P_TITLE_Y * CH;
const main_y   = CY + P_MAIN_Y * CH;
const vis_x    = CX + P_VIS_X * CW;
const vis_y    = CY + P_VIS_Y * CH;
const vis_w    = P_VIS_W * CW;
const vis_h    = P_VIS_H * CH;
const img_pad  = P_VIS_PAD * vis_w;

const ts_w        = P_TS_W * CW;
const ts_title_y  = CY + P_TS_TITLE_Y * CH;
const ts_sub_y    = CY + P_TS_SUB_Y * CH;
const ts_meta_y   = CY + P_TS_META_Y * CH;

const div_img_x = CX + P_DIV_IMG_X * CW;
const div_img_y = CY + P_DIV_IMG_Y * CH;
const div_img_w = P_DIV_IMG_W * CW;
const div_img_h = P_DIV_IMG_H * CH;
const div_txt_w = P_DIV_TXT_W * CW;

// ── Colour palette ────────────────────────────────────────────────────────────

const C_BG     = rgb(17/255,  24/255,  39/255);
const C_WHITE  = rgb(1, 1, 1);
const C_DARK   = rgb(11/255,  15/255,  25/255);
const C_TEXT   = rgb(226/255, 232/255, 240/255);
const C_MUTED  = rgb(156/255, 163/255, 175/255);
const C_ACCENT = rgb(217/255, 119/255, 6/255);
const C_BORDER = rgb(31/255,  41/255,  55/255);
const C_BODY   = rgb(203/255, 213/255, 225/255);
const C_VIS_BG = rgb(20/255,  28/255,  42/255);
const C_DARK2  = rgb(10/255,  14/255,  22/255);
const C_DARK3  = rgb(8/255,   12/255,  22/255);
const C_META   = rgb(100/255, 108/255, 120/255);

// ── Slide renderer ────────────────────────────────────────────────────────────

class Renderer {
  private page!: PDFPage;
  private regular: PDFFont;
  private bold: PDFFont;
  private curFont: PDFFont;
  private curSize = 12;
  private curColor: RGB = C_WHITE;
  readonly pageW: number;   // pts
  readonly pageH: number;   // pts

  constructor(regular: PDFFont, bold: PDFFont) {
    this.regular  = regular;
    this.bold     = bold;
    this.curFont  = regular;
    this.pageW    = mm(PW);
    this.pageH    = mm(PH);
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
  estimateBulletHeight(bullets: string[], widthMm: number): number {
    this.setFont(false, T_BUL);
    let total = 0;
    let nValid = 0;
    for (const b of bullets) {
      const t = strip(b);
      if (!t) continue;
      nValid++;
      total += this.wrapText(t, widthMm).length * LH_BUL + BUL_GAP;
    }
    if (nValid > 0) total -= BUL_GAP;
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

// ── Slide render functions ────────────────────────────────────────────────────

async function drawHeader(r: Renderer, sec: string, n: number, total: number) {
  r.fillRect(CX, CY, CW, hdr_y - CY + hdr_h, C_DARK);
  const hy = hdr_y + hdr_h * 0.18;
  r.setFont(true,  T_SECT); r.setColor(C_ACCENT);
  r.cell(180, hdr_h * 0.6, sec.toUpperCase(), bul_x, hy, 'L');
  r.setFont(false, T_NUM);  r.setColor(C_MUTED);
  r.cell(30, hdr_h * 0.6, `${n} / ${total}`, CX + CW - 45, hy, 'R');
  r.drawHLine(bul_x, hdr_y + hdr_h, CX + CW - pad_x, 0.088, C_BORDER);
}

async function renderTitleSlide(r: Renderer, doc: PDFDocument, data: SlideData, n: number, total: number) {
  await drawHeader(r, strip(data.section), n, total);

  r.setFont(true,  T_TS_TITLE); r.setColor(C_WHITE);
  r.multiCell(ts_w, LH_TS_TITLE, strip(data.title), bul_x, ts_title_y);

  r.setFont(false, T_TS_SUB); r.setColor(C_MUTED);
  r.multiCell(ts_w, px2mm(36), strip(data.subtitle), bul_x, ts_sub_y);

  r.setFont(true,  T_TS_META); r.setColor(C_META);
  r.multiCell(ts_w, px2mm(24), strip(data.meta), bul_x, ts_meta_y);
}

async function renderDividerSlide(r: Renderer, doc: PDFDocument, data: SlideData, n: number, total: number, imgDir: string) {
  r.fillRect(CX, CY, CW, CH, C_DARK2);
  await drawHeader(r, strip(data.section), n, total);

  const py0 = CY + 0.40 * CH;
  r.setFont(true, T_DIV_PART); r.setColor(C_ACCENT);
  r.cell(div_txt_w, px2mm(28), (strip(data.partNum)).toUpperCase(), bul_x, py0, 'L');

  const py1 = py0 + px2mm(34);
  r.setFont(true, T_DIV_TITLE); r.setColor(C_TEXT);
  const afterTitle = r.multiCell(div_txt_w, LH_DIV_TITLE, strip(data.title), bul_x, py1, 'L');

  const py2 = afterTitle + px2mm(16);
  r.setFont(false, T_DIV_DESC); r.setColor(C_MUTED);
  r.multiCell(div_txt_w, LH_DIV_DESC, strip(data.desc), bul_x, py2, 'L');

  const ip = imgPath(data.visualImage, imgDir);
  if (ip) {
    r.fillRect(div_img_x, div_img_y, div_img_w, div_img_h, C_DARK3);
    await r.placeImage(doc, ip, div_img_x, div_img_y, div_img_w, div_img_h);
  }
}

async function renderStandardSlide(r: Renderer, doc: PDFDocument, data: SlideData, n: number, total: number, imgDir: string) {
  await drawHeader(r, strip(data.section), n, total);

  const hasRight = !!(data.visualImage || data.visualDisplay || data.visualTitle);
  const titleW   = CW - pad_x * 2;
  const bulTxtW  = hasRight ? bul_w : CW - pad_x * 2;

  r.setFont(true, T_TITLE); r.setColor(C_WHITE);
  r.multiCell(titleW, LH_TITLE, strip(data.title), bul_x, title_y, 'L');

  const bullets     = data.bullets ?? [];
  const availableH  = (CY + CH) - main_y - 4;
  const totalBh     = r.estimateBulletHeight(bullets, bulTxtW - 6);
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
}

// ── CLI ───────────────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  const get  = (flag: string) => { const i = args.indexOf(flag); return i >= 0 ? args[i + 1] : undefined; };
  const has  = (flag: string) => args.includes(flag);

  const projectArg = get('--project');
  if (!projectArg) {
    console.error('사용법: bun scripts/gen-slides-pdf.ts --project presentations/<project> [--out name.pdf] [--sample 5] [--font-dir fonts/] [--data path/to/slidedata.json]');
    process.exit(1);
  }

  const workspaceRoot = resolve(dirname(import.meta.path), '../..');
  const projectDir    = resolve(workspaceRoot, projectArg);
  if (!existsSync(projectDir)) {
    console.error(`❌ 프로젝트 폴더 없음: ${projectDir}`); process.exit(1);
  }

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
    console.error(`❌ slidedata.json 없음: ${dataPath}`);
    console.error('   먼저 bun scripts/extract_slidedata.mjs <html> 를 실행하세요.');
    process.exit(1);
  }

  const fontR = join(fontDir, 'MaruBuri-Regular.ttf');
  const fontB = join(fontDir, 'MaruBuri-Bold.ttf');
  if (!existsSync(fontR) || !existsSync(fontB)) {
    console.error(`❌ 폰트 파일 없음: ${fontDir}/MaruBuri-*.ttf`);
    console.error('   먼저 bun scripts/download-font.ts maruburi 를 실행하세요.');
    process.exit(1);
  }

  console.log(`📁 프로젝트: ${projectDir}`);
  console.log(`📄 출력: ${outPath}`);
  console.log(`Card ${CW.toFixed(1)}×${CH.toFixed(1)}mm`);

  let slideData: SlideData[] = JSON.parse(readFileSync(dataPath, 'utf-8'));
  if (sampleCount != null) slideData = slideData.slice(0, sampleCount);

  const TOTAL = slideData.length;

  const pdfDoc = await PDFDocument.create();
  pdfDoc.registerFontkit(fontkit);

  const regularFont = await pdfDoc.embedFont(readFileSync(fontR));
  const boldFont    = await pdfDoc.embedFont(readFileSync(fontB));
  const renderer    = new Renderer(regularFont, boldFont);

  for (let idx = 0; idx < slideData.length; idx++) {
    const data = slideData[idx];
    const page = pdfDoc.addPage([mm(PW), mm(PH)]);
    renderer.setPage(page);

    renderer.fillRect(0, 0, PW, PH, C_DARK);
    renderer.fillRect(CX, CY, CW, CH, C_BG);

    const n = idx + 1;

    if (data.isTitleSlide) {
      await renderTitleSlide(renderer, pdfDoc, data, n, TOTAL);
    } else if (data.isDividerSlide) {
      await renderDividerSlide(renderer, pdfDoc, data, n, TOTAL, imgDir);
    } else {
      await renderStandardSlide(renderer, pdfDoc, data, n, TOTAL, imgDir);
    }

    if ((idx + 1) % 10 === 0 || idx + 1 === TOTAL) {
      console.log(`  슬라이드 ${idx + 1}/${TOTAL} 처리 중...`);
    }
  }

  const pdfBytes = await pdfDoc.save();
  writeFileSync(outPath, pdfBytes);

  const sizeKb = Math.round(statSync(outPath).size / 1024);
  console.log(`\n✅ 저장 → ${outPath}`);
  console.log(`   크기: ${sizeKb}KB`);
}

main().catch(err => { console.error('❌', err); process.exit(1); });
