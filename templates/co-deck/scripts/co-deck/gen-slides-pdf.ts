// @version 1.2.0
// Generate a slide deck PDF from slidedata.json using pdf-lib.
// Region-based layout model (ADR-0045 Decision #2): buildCoords() resolves
// `regions.*` uniformly for every theme; renderers iterate `slide_types[type].regions`.
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
    if (override[key] === null) {
      // Explicit null overrides (e.g. toc: null) — clear the slot.
      result[key] = null;
    } else if (typeof override[key] === 'object' && !Array.isArray(override[key])) {
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
  // We approximate the baseline as yMm + cellH * 0.72 (empirical for typical fonts).
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

// ── Region-based layout spec type (ADR-0045 Decision #2) ──────────────────────

interface Region {
  x_pct: number;
  y_pct: number;
  w_pct: number;
  h_pct: number;
  fit?:  'contain' | 'cover';
}

interface LayoutSpec {
  version?:     string;
  page?: {
    width_mm?:  number;
    height_mm?: number;
    margin_mm?: number;
    aspect_ratio?: string;
  };
  calibration?: {
    viewport_px?: number | null;
  };
  regions?: Record<string, Region | null>;
  slide_types?: Record<string, {
    regions?: string[];
  }>;
  slide_type_overrides?: Record<string, Record<string, Region | null>>;
  fonts?: {
    title_pt?:         number;
    bullet_pt?:        number;
    punchline_pt?:     number;
    punchline_sub_pt?: number;
    div_title_pt?:     number;
    div_desc_pt?:      number;
    section_px?:       number;
    slide_num_px?:     number;
    vis_title_px?:     number;
    vis_body_px?:      number;
    ts_title_px?:      number;
    ts_sub_px?:        number;
    ts_meta_px?:       number;
    div_part_px?:      number;
  };
  line_heights?: {
    title_px?:       number;
    bullet_px?:      number;
    bullet_gap_px?:  number;
    ts_title_px?:    number;
    div_title_px?:   number;
    div_desc_px?:    number;
    punchline_px?:   number;
  };
  content_constraints?: Record<string, any>;
  print?: Record<string, any>;
  image_zones?: Record<string, any>;
  toc?: any;
  colors?: Record<string, number[]>;
}

// A region resolved to absolute mm coordinates relative to the page top-left.
interface ResolvedRegion {
  x: number; y: number; w: number; h: number; fit?: 'contain' | 'cover';
}

const RESOLVE_ERROR_PREFIX = '[region-spec] ';

// ── Slide render helpers ──────────────────────────────────────────────────────

// Render the header bar for standard/title/divider slides. The header region
// encodes the TEXT BAND (hdr_y, hdr_h); the dark bar extends from the card top
// (CX, CY) down to headerR.y + headerR.h to mirror the pre-rewrite fillRect.
// Section/number baseline math mirrors the pre-rewrite drawHeader exactly.
function drawHeaderBar(
  r: Renderer,
  sec: string, n: number, total: number,
  headerR: ResolvedRegion, contentR: ResolvedRegion | null,
  titleX: number,
  cardTopY: number,   // CY — top of the card (dark bar starts here)
  C_DARK: RGB, C_ACCENT: RGB, C_MUTED: RGB, C_BORDER: RGB,
  T_SECT: number, T_NUM: number,
) {
  // Dark bar: from cardTopY down to the bottom of the header text band.
  const barH = (headerR.y - cardTopY) + headerR.h;
  r.fillRect(headerR.x, cardTopY, headerR.w, barH, C_DARK);
  const hy      = headerR.y + headerR.h * 0.18;
  const numX    = headerR.x + headerR.w - 45;  // ~30mm-wide right-aligned number cell
  const lineEnd = headerR.x + headerR.w - (contentR ? (contentR.x - headerR.x) : 0);
  r.setFont(true,  T_SECT); r.setColor(C_ACCENT);
  r.cell(180, headerR.h * 0.6, sec.toUpperCase(), titleX, hy, 'L');
  r.setFont(false, T_NUM);  r.setColor(C_MUTED);
  r.cell(30, headerR.h * 0.6, `${n} / ${total}`, numX, hy, 'R');
  r.drawHLine(titleX, headerR.y + headerR.h, lineEnd, 0.088, C_BORDER);
}

// ── Slide render functions (region-driven) ────────────────────────────────────
//
// Each render function receives a `region(name)` resolver that returns the
// ResolvedRegion for the requested region name. Regions not declared by the
// slide type are NOT resolved — accessing one is a hard error (AC-7). Renderers
// iterate only the regions declared in slide_types[type].regions (AC-2).

interface RenderCtx {
  r:        Renderer;
  doc:      PDFDocument;
  data:     SlideData;
  n:        number;
  total:    number;
  imgDir?:  string;
  spec:     LayoutSpec;
  coords:   ReturnType<typeof buildCoords>;
  colors:   ReturnType<typeof buildColors>;
  sizes:    ReturnType<typeof buildSizes>;
  declared: string[];                 // slide_types[type].regions
  region:   (name: string) => ResolvedRegion;
}

function renderTitleSlide(ctx: RenderCtx) {
  const { r, data, spec, coords, colors, sizes, region } = ctx;
  const { C_ACCENT, C_MUTED, C_WHITE, C_META, C_DARK, C_BORDER } = colors;
  const { T_TS_TITLE, T_TS_SUB, T_TS_META, T_SECT, T_NUM } = sizes;

  // Title slide layout: optional header (if declared), then a large title block
  // + subtitle + meta line. Regions declared: ["title", "subtitle"] at minimum;
  // scroll also declares "header" on its title slide_type to preserve the
  // section bar drawn by the pre-rewrite renderer.
  const titleR = region('title');
  const subR   = tryRegion(ctx, 'subtitle') ?? titleR;
  const metaR  = tryRegion(ctx, 'meta')     ?? subR;
  const hdrR   = tryRegion(ctx, 'header');

  if (hdrR) {
    // Mirrors the pre-rewrite title-slide header: dark bar + section text + number.
    drawHeaderBar(r, strip(data.section), ctx.n, ctx.total, hdrR, titleR, titleR.x, ctx.coords.CY, C_DARK, C_ACCENT, C_MUTED, C_BORDER, T_SECT, T_NUM);
  }

  r.setFont(true,  T_TS_TITLE); r.setColor(C_WHITE);
  r.multiCell(titleR.w, coords.px2mm(70.0), strip(data.title), titleR.x, titleR.y);

  r.setFont(false, T_TS_SUB); r.setColor(C_MUTED);
  r.multiCell(subR.w, coords.px2mm(36), strip(data.subtitle), subR.x, subR.y);

  const meta = strip(data.meta);
  if (meta) {
    r.setFont(true, T_TS_META); r.setColor(C_META);
    r.multiCell(metaR.w, coords.px2mm(24), meta, metaR.x, metaR.y);
  }
}

function renderDividerSlide(ctx: RenderCtx) {
  const { r, doc, data, imgDir, spec, coords, colors, sizes, region } = ctx;
  const { C_DARK2, C_DARK3, C_DARK, C_BORDER, C_ACCENT, C_MUTED, C_TEXT } = colors;
  const { CX, CY, CW, CH } = coords;
  const lh = spec.line_heights ?? {};
  const { T_DIV_PART, T_DIV_TITLE, T_DIV_DESC, T_SECT, T_NUM } = sizes;

  // Divider fills the full card with a darker shade, then (if declared) draws
  // the section header bar, then places a part/title/desc block on the left and
  // an image (optional) on the right.
  r.fillRect(CX, CY, CW, CH, C_DARK2);

  const titleR = region('title');
  const visR   = region('visual');
  const hdrR   = tryRegion(ctx, 'header');

  if (hdrR) {
    drawHeaderBar(r, strip(data.section), ctx.n, ctx.total, hdrR, titleR, titleR.x, ctx.coords.CY, C_DARK, C_ACCENT, C_MUTED, C_BORDER, T_SECT, T_NUM);
  }

  const LH_T = lh.div_title_px ? coords.px2mm(lh.div_title_px) : coords.px2mm(56.0);
  const LH_D = lh.div_desc_px  ? coords.px2mm(lh.div_desc_px)  : coords.px2mm(28.16);

  const py0 = titleR.y;
  r.setFont(true, T_DIV_PART); r.setColor(C_ACCENT);
  r.cell(titleR.w, coords.px2mm(28), (strip(data.partNum)).toUpperCase(), titleR.x, py0, 'L');

  const py1 = py0 + coords.px2mm(34);
  r.setFont(true, T_DIV_TITLE); r.setColor(C_TEXT);
  const afterTitle = r.multiCell(titleR.w, LH_T, strip(data.title), titleR.x, py1, 'L');

  const py2 = afterTitle + coords.px2mm(16);
  r.setFont(false, T_DIV_DESC); r.setColor(C_MUTED);
  r.multiCell(titleR.w, LH_D, strip(data.desc), titleR.x, py2, 'L');

  const ip = imgPath(data.visualImage, imgDir ?? '');
  if (ip) {
    r.fillRect(visR.x, visR.y, visR.w, visR.h, C_DARK3);
    r.placeImage(doc, ip, visR.x, visR.y, visR.w, visR.h);
  }
}

function renderPunchlineSlide(ctx: RenderCtx) {
  const { r, data, spec, colors, region } = ctx;
  const { C_BG, C_ACCENT, C_MUTED } = colors;
  const f = spec.fonts ?? {};

  const punchlinePt    = f.punchline_pt    ?? 48;
  const punchlineSubPt = f.punchline_sub_pt ?? 20;

  // Punchline regions: title + subtitle, both centered in their boxes.
  const titleR = region('title');
  const subR   = tryRegion(ctx, 'subtitle') ?? titleR;

  // Fill background across the title+subtitle bounding box (use title region as
  // the punchline content box when present in slide_type_overrides).
  const bgR = (titleR.w > 0 && titleR.h > 0) ? titleR : { x: 0, y: 0, w: r.pageW / MM_TO_PT, h: r.pageH / MM_TO_PT };
  r.fillRect(bgR.x, bgR.y, bgR.w, bgR.h, C_BG);

  const titleLh = punchlinePt / MM_TO_PT;
  const subLh   = punchlineSubPt / MM_TO_PT;
  const gap     = 6;
  const blockH  = titleLh + gap + subLh;
  const startY  = titleR.y + Math.max(0, (titleR.h - blockH) / 2);

  r.setFont(true, punchlinePt); r.setColor(C_ACCENT);
  r.multiCell(titleR.w, titleLh, strip(data.title), titleR.x, startY, 'C');

  const subText = strip(data.subtitle) || strip((data.bullets ?? [])[0]);
  if (subText) {
    r.setFont(false, punchlineSubPt); r.setColor(C_MUTED);
    r.multiCell(subR.w, subLh, subText, subR.x, startY + titleLh + gap, 'C');
  }
}

async function renderStandardSlide(ctx: RenderCtx) {
  const { r, doc, data, n, total, imgDir, spec, coords, colors, sizes, declared, region } = ctx;
  const { C_DARK, C_ACCENT, C_MUTED, C_BORDER, C_WHITE, C_BODY, C_VIS_BG } = colors;
  const lh  = spec.line_heights ?? {};
  const { T_SECT, T_NUM, T_TITLE, T_BUL, T_VIS_T, T_VIS_B } = sizes;

  const LH_TITLE = lh.title_px      ? coords.px2mm(lh.title_px)     : coords.px2mm(46.0);
  const LH_BUL   = lh.bullet_px     ? coords.px2mm(lh.bullet_px)    : coords.px2mm(29.44);
  const BUL_GAP  = lh.bullet_gap_px ? coords.px2mm(lh.bullet_gap_px): coords.px2mm(19.2);

  // Resolve the regions this standard slide type declares. Some themes omit
  // header/meta/visual — access defensively for those.
  const headerR  = tryRegion(ctx, 'header');
  const titleR   = tryRegion(ctx, 'title')   ?? (headerR ? { x: headerR.x, y: headerR.y + headerR.h + coords.px2mm(8), w: headerR.w, h: 30 } : null)!;
  const contentR = tryRegion(ctx, 'content') ?? titleR;
  const visR     = tryRegion(ctx, 'visual');
  const metaR    = tryRegion(ctx, 'meta');

  if (headerR) {
    drawHeaderBar(r, strip(data.section), n, total, headerR, contentR, titleR.x, coords.CY, C_DARK, C_ACCENT, C_MUTED, C_BORDER, T_SECT, T_NUM);
  }

  const hasRight = !!(data.visualImage || data.visualDisplay || data.visualTitle) && !!visR;
  const titleW   = titleR.w;
  const bulTxtW  = hasRight ? Math.min(contentR.w, visR!.x - contentR.x - 6) : contentR.w;

  r.setFont(true, T_TITLE); r.setColor(C_WHITE);
  r.multiCell(titleW, LH_TITLE, strip(data.title), titleR.x, titleR.y, 'L');

  const bullets = data.bullets ?? [];
  const totalBh = r.estimateBulletHeight(bullets, bulTxtW - 6, T_BUL, LH_BUL, BUL_GAP);
  // Vertically center the bullet block inside the content region. The -4 mm
  // bottom margin mirrors the pre-rewrite availableH computation so scroll
  // bullet placement is preserved bit-for-bit.
  const availableH = contentR.h - 4;
  let by = contentR.y + Math.max(0, (availableH - totalBh) / 2);

  for (const b of bullets) {
    const txt = strip(b);
    if (!txt) continue;
    if (by > contentR.y + contentR.h - 6) break;
    r.drawEllipse(contentR.x, by + LH_BUL * 0.28, 3.2, C_ACCENT);
    r.setFont(false, T_BUL); r.setColor(C_BODY);
    const afterBul = r.multiCell(bulTxtW - 6, LH_BUL, txt, contentR.x + 6, by, 'L');
    by = afterBul + BUL_GAP;
  }

  if (hasRight) {
    r.fillRect(visR!.x, visR!.y, visR!.w, visR!.h, C_VIS_BG);
    const ip = imgPath(data.visualImage, imgDir ?? '');
    if (ip) {
      const pad = visR!.w * 0.052;
      await r.placeImage(doc, ip, visR!.x + pad, visR!.y + pad, visR!.w - pad * 2, visR!.h - pad * 2);
    } else {
      const vt = strip(data.visualTitle);
      const vd = strip(data.visualDisplay);
      const lhVt = coords.px2mm(20), lhVb = coords.px2mm(24), gap = 4;
      const hVt = vt ? r.estimateTextHeight(vt, visR!.w - 8, T_VIS_T, lhVt, true)  : 0;
      const hVb = vd ? r.estimateTextHeight(vd, visR!.w - 8, T_VIS_B, lhVb, false) : 0;
      const totalH = hVt + (vt && vd ? gap : 0) + hVb;
      let vy = visR!.y + Math.max(0, (visR!.h - totalH) / 2);
      if (vt) {
        r.setFont(true,  T_VIS_T); r.setColor(C_ACCENT);
        vy = r.multiCell(visR!.w - 8, lhVt, vt, visR!.x + 4, vy, 'C') + gap;
      }
      if (vd) {
        r.setFont(false, T_VIS_B); r.setColor(C_MUTED);
        r.multiCell(visR!.w - 8, lhVb, vd, visR!.x + 4, vy, 'C');
      }
    }
  }

  if (metaR) {
    // Slide counter (e.g. slideshow's counter_x_pct/counter_y_pct).
    r.setFont(false, T_NUM); r.setColor(C_MUTED);
    r.cell(metaR.w, metaR.h, `${n} / ${total}`, metaR.x, metaR.y, 'R');
  }
}

// Resolve a region WITHOUT erroring if it's not declared by this slide type.
// Used by renderers to support optional regions (subtitle, meta, header) without
// forcing every theme to declare them.
function tryRegion(ctx: RenderCtx, name: string): ResolvedRegion | null {
  if (!ctx.declared.includes(name)) return null;
  try {
    return ctx.region(name);
  } catch {
    return null;
  }
}

// ── Region resolver (theme-agnostic) ──────────────────────────────────────────

function buildCoords(spec: LayoutSpec) {
  const PW  = spec.page?.width_mm  ?? 338.7;
  const PH  = spec.page?.height_mm ?? 190.5;
  const CM  = spec.page?.margin_mm ?? 0.0;
  const VP  = spec.calibration?.viewport_px ?? 611.4;

  const CX = CM, CY = CM;
  const CW = PW - CM * 2;
  const CH = PH - CM * 2;

  const px2pt = (px: number) => (px / VP) * CH * 2.835;
  const px2mm = (px: number) => (px / VP) * CH;

  const regions       = spec.regions ?? {};
  const typeOverrides = spec.slide_type_overrides ?? {};

  // Resolve a region for a given slide type. Resolution order:
  //   1. slide_type_overrides[type][name]  (per-slide-type value)
  //   2. regions[name]                       (theme-wide value)
  // A null at either level means "this region is not defined for this slide".
  // Throws loudly if both are absent/null (AC-7: no silent empty rendering).
  const region = (name: string, slideType?: string): ResolvedRegion => {
    let raw: Region | null | undefined;
    if (slideType && typeOverrides[slideType]) {
      raw = typeOverrides[slideType][name];
    }
    if (raw === undefined) raw = regions[name] ?? null;
    if (raw === null || raw === undefined) {
      throw new Error(
        `${RESOLVE_ERROR_PREFIX}Required region "${name}"${
          slideType ? ` for slide_type "${slideType}"` : ''
        } is not defined. Check regions.* / slide_type_overrides in pdf_layout_spec.json.`,
      );
    }
    return {
      x: CX + raw.x_pct * CW,
      y: CY + raw.y_pct * CH,
      w: raw.w_pct * CW,
      h: raw.h_pct * CH,
      fit: raw.fit,
    };
  };

  return {
    PW, PH, CM, CX, CY, CW, CH,
    px2pt, px2mm,
    region,
    // Back-compat helpers for code paths that still want page-level constants.
    pageW: PW, pageH: PH,
  };
}

// ── Color builder ─────────────────────────────────────────────────────────────

function buildColors(spec: LayoutSpec) {
  // Color key resolution mirrors the pre-rewrite buildColors exactly so scroll
  // rendering is preserved bit-for-bit. The pre-rewrite code looked up short
  // keys (dark, dark2, dark3, text, body, vis_bg, meta); style pdf_color_spec
  // uses long keys (card_dark*, text_*), so most roles fall through to the
  // hardcoded defaults unless a project override provides the short key.
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
    T_SECT      : f.section_px   ? px2pt(f.section_px)   : px2pt(13.6),
    T_NUM       : f.slide_num_px ? px2pt(f.slide_num_px) : px2pt(14.4),
    T_TITLE     : f.title_pt  ?? 28.0,
    T_BUL       : f.bullet_pt ?? 12.5,
    T_VIS_T     : f.vis_title_px ? px2pt(f.vis_title_px) : px2pt(13.6),
    T_VIS_B     : f.vis_body_px  ? px2pt(f.vis_body_px)  : px2pt(16.0),
    T_TS_TITLE  : f.ts_title_px ? px2pt(f.ts_title_px) : px2pt(56.0),
    T_TS_SUB    : f.ts_sub_px   ? px2pt(f.ts_sub_px)   : px2pt(24.0),
    T_TS_META   : f.ts_meta_px  ? px2pt(f.ts_meta_px)  : px2pt(16.0),
    T_DIV_PART  : f.div_part_px ? px2pt(f.div_part_px) : px2pt(22.4),
    T_DIV_TITLE : f.div_title_pt ?? f.title_pt ?? 28.0,
    T_DIV_DESC  : f.div_desc_pt  ?? 13.0,
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
  const style = lectureProfile.style ?? 'premium-dark';

  // ── Load spec files (4-layer merge: base → theme → style colors → overrides) ──
  // AC-7: missing base/theme spec files are HARD ERRORS (no silent fallback).
  const basePath   = resolve(workspaceRoot, 'docs/html-themes/themes/_shared/layout_base.json');
  const themePath  = resolve(workspaceRoot, `docs/html-themes/themes/${theme}/pdf_layout_spec.json`);
  const stylePath  = resolve(workspaceRoot, `docs/html-themes/styles/${style}/pdf_color_spec.json`);

  for (const [label, p] of [['layout_base', basePath], ['theme spec', themePath]] as const) {
    if (!existsSync(p)) {
      console.error(`${RESOLVE_ERROR_PREFIX}${label} not found: ${p}`);
      process.exit(1);
    }
  }
  // Style color spec is optional-but-warned (themes still have color defaults).
  let styleSpec: any = {};
  if (existsSync(stylePath)) {
    styleSpec = JSON.parse(readFileSync(stylePath, 'utf-8'));
  } else {
    console.warn(`[region-spec] style color spec not found: ${stylePath} — falling back to theme color defaults.`);
  }

  const baseSpec:  LayoutSpec = JSON.parse(readFileSync(basePath,  'utf-8'));
  const themeSpec: LayoutSpec = JSON.parse(readFileSync(themePath, 'utf-8'));

  // Final spec = deepMerge(layout_base, theme_spec, style_colors, project_overrides).
  let layoutSpec: LayoutSpec = deepMerge(baseSpec, themeSpec);
  if (styleSpec.colors) {
    layoutSpec = deepMerge(layoutSpec, { colors: styleSpec.colors });
  }
  if (lectureProfile.layout_overrides) {
    layoutSpec = deepMerge(layoutSpec, lectureProfile.layout_overrides);
  }

  // ── Validate the merged spec has a usable region model ─────────────────────
  if (!layoutSpec.regions || Object.keys(layoutSpec.regions).length === 0) {
    console.error(`${RESOLVE_ERROR_PREFIX}merged spec has no "regions" block (theme=${theme}).`);
    process.exit(1);
  }
  if (!layoutSpec.slide_types || Object.keys(layoutSpec.slide_types).length === 0) {
    console.error(`${RESOLVE_ERROR_PREFIX}merged spec has no "slide_types" block (theme=${theme}).`);
    process.exit(1);
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

    // AC-2: dispatch is driven by which slide_types the THEME declares, not by
    // theme name. isDividerSlide + declared "divider"  → renderDividerSlide;
    // isPunchline     + declared "punchline" → renderPunchlineSlide;
    // isTitleSlide    + declared "title"      → renderTitleSlide;
    // otherwise                            → "standard".
    const slideTypes = layoutSpec.slide_types ?? {};
    const has        = (t: string) => !!(slideTypes[t] && slideTypes[t].regions);

    let type: 'title' | 'divider' | 'punchline' | 'standard';
    if (data.isTitleSlide && has('title')) {
      type = 'title';
    } else if (data.isDividerSlide && has('divider')) {
      type = 'divider';
    } else if (data.isPunchline && has('punchline')) {
      type = 'punchline';
    } else {
      type = 'standard';
    }

    const declared = slideTypes[type]?.regions ?? [];
    // Per-slide-type region resolver: honours slide_type_overrides[type][name].
    const region = (name: string) => coords.region(name, type);

    const ctx: RenderCtx = {
      r: renderer, doc: pdfDoc, data, n, total: TOTAL, imgDir,
      spec: layoutSpec, coords, colors, sizes, declared, region,
    };

    if (type === 'title')          renderTitleSlide(ctx);
    else if (type === 'divider')   await renderDividerSlide(ctx);
    else if (type === 'punchline') renderPunchlineSlide(ctx);
    else                           await renderStandardSlide(ctx);

    if ((idx + 1) % 10 === 0 || idx + 1 === TOTAL) {
      console.log(`  Slide ${idx + 1}/${TOTAL}... [${type}]`);
    }
  }

  const pdfBytes = await pdfDoc.save();
  writeFileSync(outPath, pdfBytes);

  const sizeKb = Math.round(statSync(outPath).size / 1024);
  console.log(`\nSaved -> ${outPath}`);
  console.log(`   Size: ${sizeKb}KB`);
}

main().catch(err => { console.error('Error:', err); process.exit(1); });
