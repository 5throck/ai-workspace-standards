// @version 1.8.0 — Increased PDF body/bullet font sizes for readability. bullet_pt raised
//   from 11-13pt to 14-15pt across all themes; bullet_px/line_heights adjusted proportionally.
//   Auto-calibrate FONT_PT_MULT tuned from 0.85→0.94 to produce readable estimates.
//   v1.7.0: Background image support. When lecture-profile.md → background_image.enabled
//   is true, renders full-bleed background image (cover-crop) with semi-transparent overlay.
//   Supports scope: all | divider-cover | individual. Reads background_image config from
//   lecture-profile frontmatter; resolves image path from image-manifest.json or slideData.
//   v1.6.0: OS-aware font search paths (Windows, macOS, Linux).
// Generate a slide deck PDF from slidedata.json using pdf-lib.
// Region-based layout model (ADR-0045 Decision #2): buildCoords() resolves
// `regions.*` uniformly for every theme; renderers iterate `slide_types[type].regions`.
// Merges gen_full.py + gen_sample5.py — use --sample N to limit slide count.
// Usage:
//   bun scripts/gen-slides-pdf.ts --project presentations/<project> [--out name.pdf] [--sample 5]
//   bun scripts/gen-slides-pdf.ts --auto-calibrate --project presentations/<project>
//   --auto-calibrate  estimate fonts/line_heights from CSS and print layout_overrides YAML (no PDF)
//   --project  project folder (relative to workspace root)
//   --out      output PDF filename (default: <folder>.pdf or <folder>_sample<N>.pdf)
//   --sample   limit to first N slides only (omit for full deck)
//   --font-dir directory containing font TTF files (default: presentations/assets/fonts/)
//   --data     path to slidedata.json (default: <project>/slidedata.json)
// Requires: pdf-lib @pdf-lib/fontkit (bun install pdf-lib @pdf-lib/fontkit)

import { PDFDocument, PDFFont, PDFPage, rgb, RGB,
  pushGraphicsState, popGraphicsState, moveTo, lineTo, closePath, clip, endPath } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import { readFileSync, writeFileSync, existsSync, statSync } from 'fs';
import { join, resolve, dirname } from 'path';
import { platform, homedir } from 'os';

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

  // Determine the base indent from the first non-blank block line so that
  // parseIndentedBlock sees the correct depth (block lines are already indented
  // relative to the YAML root, not to column 0).
  const minIndent = block.reduce((min, l) => {
    const ind = l.search(/\S/);
    return ind >= 0 ? Math.min(min, ind) : min;
  }, Infinity);
  const baseIndent = minIndent === Infinity ? 0 : minIndent;
  return parseIndentedBlock(block, baseIndent).value;
}

// ── Background image config parser ───────────────────────────────────────────
// Reads the background_image: section from lecture-profile.md frontmatter.
// Returns null when background_image is not configured or disabled.

interface BgImageConfig {
  enabled: boolean;
  scope: 'all' | 'divider-cover' | 'individual';
  source: string;
  overlay: { color: number[]; opacity: number };
  keywords: string[];
  fallback_color: number[] | null;
}

function parseBackgroundImage(frontmatter: string): BgImageConfig | null {
  const lines = frontmatter.split('\n');
  let startIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (trimmed === 'background_image:' && !lines[i].trimStart().startsWith('#')) {
      startIdx = i;
      break;
    }
  }
  if (startIdx === -1) return null;

  const block: string[] = [];
  for (let i = startIdx + 1; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    if (line.length > 0 && line[0] !== ' ') break;
    block.push(line);
  }
  if (block.length === 0) return null;

  const minIndent = block.reduce((min, l) => {
    const ind = l.search(/\S/);
    return ind >= 0 ? Math.min(min, ind) : min;
  }, Infinity);
  const parsed = parseIndentedBlock(block, minIndent === Infinity ? 0 : minIndent).value as Record<string, any>;

  const enabled = parsed.enabled === true;
  if (!enabled) return null;

  return {
    enabled: true,
    scope: parsed.scope ?? 'divider-cover',
    source: parsed.source ?? 'download',
    overlay: {
      color: parsed.overlay?.color ?? [0, 0, 0],
      opacity: parsed.overlay?.opacity ?? 0.4,
    },
    keywords: parsed.keywords ?? [],
    fallback_color: parsed.fallback_color ?? null,
  };
}

// Resolve the background image file path for a given slide.
// Returns null if the slide should not have a background image or the file doesn't exist.
function resolveBgImagePath(
  data: SlideData,
  slideIdx: number,
  bgConfig: BgImageConfig,
  imgDir: string,
  globalBgPath: string | null,
  slideBgEntries: Map<number, string>,
): string | null {
  if (!bgConfig.enabled) return null;

  // Individual mode: only slides with explicit background entries
  if (bgConfig.scope === 'individual') {
    return slideBgEntries.get(slideIdx) ?? null;
  }

  // 'all' or 'divider-cover' mode: use global background image
  if (!globalBgPath) return null;

  if (bgConfig.scope === 'divider-cover') {
    // Only title, divider, punchline slides
    if (!data.isTitleSlide && !data.isDividerSlide && !data.isPunchline) return null;
  }

  // scope === 'all' or divider-cover with matching slide type
  const fullPath = resolve(imgDir, globalBgPath);
  return existsSync(fullPath) ? fullPath : null;
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

  // Fill a rectangle with semi-transparent overlay for background image readability.
  // Uses pdf-lib page opacity to achieve the transparency effect.
  fillRectOverlay(xMm: number, yMm: number, wMm: number, hMm: number, color: RGB, opacity: number) {
    const prevOpacity = (this.page as any).opacity ?? 1;
    this.page.drawRectangle({
      x: this.pt(xMm),
      y: this.fy(yMm + hMm),
      width:  this.pt(wMm),
      height: this.pt(hMm),
      color,
      opacity,
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

  /**
   * Detect actual image format from magic bytes, falling back to extension.
   * Prevents "SOI not found in JPEG" errors when a PNG is saved with .jpg extension.
   */
  private detectImageFormat(data: Buffer): 'png' | 'jpeg' {
    // PNG magic: 89 50 4E 47
    if (data.length >= 4 && data[0] === 0x89 && data[1] === 0x50 && data[2] === 0x4E && data[3] === 0x47) {
      return 'png';
    }
    // JPEG magic: FF D8 FF
    if (data.length >= 3 && data[0] === 0xFF && data[1] === 0xD8 && data[2] === 0xFF) {
      return 'jpeg';
    }
    return 'jpeg'; // fallback default
  }

  async embedImg(doc: PDFDocument, imgPath: string) {
    const data = readFileSync(imgPath);
    const format = this.detectImageFormat(data);
    return format === 'png' ? await doc.embedPng(data) : await doc.embedJpg(data);
  }

  drawEmbeddedImage(img: any, xMm: number, yMm: number, wMm: number, hMm: number) {
    this.page.drawImage(img, {
      x: this.pt(xMm), y: this.fy(yMm + hMm),
      width: this.pt(wMm), height: this.pt(hMm),
    });
  }

  async placeImageCover(doc: PDFDocument, imgPath: string, xMm: number, yMm: number, wMm: number, hMm: number) {
    try {
      const img = await this.embedImg(doc, imgPath);
      const { width: ow, height: oh } = img;
      const imgAsp = ow / oh;
      const boxAsp = wMm / hMm;
      let iw: number, ih: number;
      if (imgAsp > boxAsp) { ih = hMm; iw = ih * imgAsp; }
      else                 { iw = wMm; ih = iw / imgAsp; }
      const ix = xMm + (wMm - iw) / 2;
      const iy = yMm + (hMm - ih) / 2;
      const cx = this.pt(xMm), cy = this.fy(yMm + hMm);
      const cw = this.pt(wMm), ch = this.pt(hMm);
      this.page.pushOperators(
        pushGraphicsState(),
        moveTo(cx, cy), lineTo(cx + cw, cy), lineTo(cx + cw, cy + ch), lineTo(cx, cy + ch),
        closePath(), clip(), endPath(),
      );
      this.drawEmbeddedImage(img, ix, iy, iw, ih);
      this.page.pushOperators(popGraphicsState());
    } catch (e: any) {
      console.warn(`  img err: ${e.message}`);
    }
  }

  async placeImage(doc: PDFDocument, imgPath: string, xMm: number, yMm: number, mwMm: number, mhMm: number) {
    try {
      const img  = await this.embedImg(doc, imgPath);
      const { width: ow, height: oh } = img;
      const asp = oh / ow;
      let iw = mwMm, ih = iw * asp;
      if (ih > mhMm) { ih = mhMm; iw = ih / asp; }
      const ix = xMm + (mwMm - iw) / 2;
      const iy = yMm + (mhMm - ih) / 2;
      this.drawEmbeddedImage(img, ix, iy, iw, ih);
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
  // src is relative to the project dir; visualImage may reference .svg (HTML primary delivery format).
  // PDF pipeline only embeds .png/.jpg — auto-derive PNG path when src is SVG.
  const resolved = src.endsWith('.svg') ? src.replace(/\.svg$/, '.png') : src;
  const p = join(imgDir, resolved);
  return existsSync(p) ? p : null;
}

// ── Slide data type ───────────────────────────────────────────────────────────

interface SlideData {
  section?:       string;
  title?:         string;
  subtitle?:      string;
  text?:          string;   // punchline main statement (HTML .punch-text)
  sub?:           string;   // punchline support line (HTML .punch-sub)
  meta?:          string;
  desc?:          string;
  partNum?:       string;
  bullets?:       string[];
  visual?:        string;
  visualImage?:   string;
  backgroundImage?: string;   // relative path to full-bleed background image (from html-build)
  visualTitle?:   string;
  visualDisplay?: string;
  isTitleSlide?:  boolean;
  isDividerSlide?: boolean;
  isPunchline?:   boolean;
  isProfileSlide?: boolean;
  speakerName?:   string;
  speakerTitle?:  string;
  speakerBio?:    string;
  photoPath?:     string;
  isContactSlide?: boolean;
  contactName?:   string;
  contactEmail?:  string;
  contactNote?:   string;
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
  visual_inner_padding_px?: number;
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
// PPT themes with a header region declare "header" on their title slide_type to preserve the
// section bar drawn by the pre-rewrite renderer.
  const titleR = region('title');
  const subR   = tryRegion(ctx, 'subtitle') ?? titleR;
  const metaR  = tryRegion(ctx, 'meta')     ?? subR;
  const hdrR   = tryRegion(ctx, 'header');

  if (hdrR) {
    // Mirrors the pre-rewrite title-slide header: dark bar + section text + number.
    drawHeaderBar(r, strip(data.section), ctx.n, ctx.total, hdrR, titleR, titleR.x, ctx.coords.CY, C_DARK, C_ACCENT, C_MUTED, C_BORDER, T_SECT, T_NUM);
  }

  // meta (cover-eyebrow): drawn BEFORE title — small accent label above the main title
  const meta = strip(data.meta);
  if (meta && metaR) {
    r.setFont(true, T_TS_META); r.setColor(C_ACCENT);
    r.multiCell(metaR.w, coords.px2mm(24), meta.toUpperCase(), metaR.x, metaR.y, 'C');
  }

  r.setFont(true,  T_TS_TITLE); r.setColor(C_WHITE);
  r.multiCell(titleR.w, coords.px2mm(70.0), strip(data.title), titleR.x, titleR.y, 'C');

  r.setFont(false, T_TS_SUB); r.setColor(C_MUTED);
  r.multiCell(subR.w, coords.px2mm(36), strip(data.subtitle), subR.x, subR.y, 'C');
}

async function renderDividerSlide(ctx: RenderCtx) {
  const { r, doc, data, imgDir, spec, coords, colors, sizes, region } = ctx;
  const { C_BG, C_DARK3, C_DARK, C_BORDER, C_ACCENT, C_MUTED, C_TEXT } = colors;
  const { CX, CY, CW, CH } = coords;
  const lh = spec.line_heights ?? {};
  const { T_DIV_PART, T_DIV_TITLE, T_DIV_DESC, T_SECT, T_NUM } = sizes;

  // Divider fills the full card with the SAME surface as the cover/standard card
  // (C_BG). HTML .slide[data-type="divider"] uses --divider-bg which is identical
  // to --cover-bg (radial #1E293B→#0B0F19); the PDF flattens that radial to C_BG
  // for the cover, so the divider must too — otherwise it renders as a darker slab
  // (#0A0E16) that differs from every other slide. Then (if declared) draws the
  // section header bar, then places a part/title/desc block (left + optional image).
  r.fillRect(CX, CY, CW, CH, C_BG);

  const titleR = region('title');
  const visR   = region('visual');
  const hdrR   = tryRegion(ctx, 'header');

  if (hdrR) {
    drawHeaderBar(r, strip(data.section), ctx.n, ctx.total, hdrR, titleR, titleR.x, ctx.coords.CY, C_DARK, C_ACCENT, C_MUTED, C_BORDER, T_SECT, T_NUM);
  }

  const LH_T = lh.div_title_px ? coords.px2mm(lh.div_title_px) : coords.px2mm(56.0);
  const LH_D = lh.div_desc_px  ? coords.px2mm(lh.div_desc_px)  : coords.px2mm(28.16);

  const ip = imgPath(data.visualImage, imgDir ?? '');
  const align: 'L' | 'C' = ip ? 'L' : 'C';

  // Estimate actual block height accounting for title/desc text wrapping.
  // For image dividers, center vertically within the full card (not just titleR).
  // For text-only dividers, center within titleR as before.
  r.setFont(true, T_DIV_TITLE);
  const titleH_est = r.estimateTextHeight(strip(data.title), titleR.w, T_DIV_TITLE, LH_T, true);
  r.setFont(false, T_DIV_DESC);
  const descH_est  = r.estimateTextHeight(strip(data.desc ?? ''), titleR.w, T_DIV_DESC, LH_D, false);
  const blockH = coords.px2mm(34) + titleH_est + coords.px2mm(16) + descH_est;
  const py0 = ip
    ? coords.CY + Math.max(coords.px2mm(32), (coords.CH - blockH) / 2)
    : titleR.y + Math.max(0, (titleR.h - blockH) / 2);

  r.setFont(true, T_DIV_PART); r.setColor(C_ACCENT);
  r.cell(titleR.w, coords.px2mm(28), (strip(data.partNum)).toUpperCase(), titleR.x, py0, align);

  const py1 = py0 + coords.px2mm(34);
  r.setFont(true, T_DIV_TITLE); r.setColor(C_TEXT);
  const afterTitle = r.multiCell(titleR.w, LH_T, strip(data.title), titleR.x, py1, align);

  const py2 = afterTitle + coords.px2mm(16);
  r.setFont(false, T_DIV_DESC); r.setColor(C_MUTED);
  r.multiCell(titleR.w, LH_D, strip(data.desc), titleR.x, py2, align);

  if (ip) {
    r.fillRect(visR.x, visR.y, visR.w, visR.h, C_DARK3);
    await r.placeImageCover(doc, ip, visR.x, visR.y, visR.w, visR.h);
  }
}

function renderPunchlineSlide(ctx: RenderCtx) {
  const { r, data, spec, coords, colors, region } = ctx;
  const { C_BG, C_ACCENT, C_WHITE, C_BODY } = colors;
  const f = spec.fonts ?? {};

  // Per-item sizes aligned to HTML .punch-* (Playwright px × 0.75 = pt).
  // Key parity fix: HTML .punch-text is WHITE (--text-on-dark, gold glow), not gold.
  const SZ_TAG  = 9.6;                          // .part-tag   12.8px (gold, uppercase)
  const SZ_MARK = 43.2;                         // .punch-mark 57.6px (gold decorative quote)
  const SZ_TEXT = f.punchline_pt     ?? 24;     // .punch-text 32px (WHITE, bold)
  const SZ_SUB  = f.punchline_sub_pt ?? 12.24;  // .punch-sub  16.32px (slate)

  // Stack part-tag → mark → text → sub, centered as a block (mirrors HTML flex centering).
  // Gaps + box heights are the EXACT rendered element-to-element spacing measured from
  // slide-7 punchline (Playwright on the 720px design space): each GAP is box-bottom →
  // next-box-top. With these, the PDF element tops reproduce HTML exactly (text at +144px
  // from part-tag top, sub at +293px — matching HTML 346−202 and 495−202).
  const BOX_TAG      = coords.px2mm(18);    // .part-tag rendered height (12.8px font, normal LH)
  const GAP_TAG_MARK = coords.px2mm(56);    // part-tag box bottom → mark box top
  const BOX_MARK     = coords.px2mm(29);    // .punch-mark line-height 0.5 (57.6px font → 29px box)
  const GAP_MARK_TXT = coords.px2mm(41);    // mark box bottom → text top
  const LH_TEXT      = coords.px2mm(46.4);  // .punch-text line-height 1.45 (per line)
  const GAP_TXT_SUB  = coords.px2mm(56);    // text bottom → sub top
  const LH_SUB       = coords.px2mm(23);    // .punch-sub rendered height (16.32px font)

  const titleR = region('title');
  const box    = tryRegion(ctx, 'content') ?? titleR;   // center within the large content region
  const bandW  = box.w;

  // HTML constrains .punch-text to max-width: 32ch (≈607px ≈160.6mm) so the statement
  // wraps to ~2 centered lines. Reproduce that exact max-width (measured from slide-7,
  // whose natural width 169.3mm > 160.6mm → wraps). Count the wrapped lines so blockH /
  // vertical centering accounts for the ACTUAL statement height.
  const statement = strip(data.text) || strip(data.title);
  r.setFont(true, SZ_TEXT);
  const textBand = Math.min(bandW, coords.px2mm(607));
  const textX    = box.x + (bandW - textBand) / 2;
  const textLineH = (statement ? r.wrapText(statement, textBand).length : 1) * LH_TEXT;

  const blockH = BOX_TAG + GAP_TAG_MARK + BOX_MARK + GAP_MARK_TXT + textLineH + GAP_TXT_SUB + LH_SUB;
  let y = box.y + Math.max(0, (box.h - blockH) / 2);

  // Full-bleed dark background (HTML .slide[data-type="punchline"] is radial navy).
  r.fillRect(0, 0, coords.CW, coords.CH, C_BG);

  // part-tag (gold, uppercase) — e.g. "PART 01 · 패러다임 전환"
  const sec = strip(data.section);
  if (sec) {
    r.setFont(false, SZ_TAG); r.setColor(C_ACCENT);
    r.cell(bandW, BOX_TAG, sec.toUpperCase(), box.x, y, 'C');
    y += BOX_TAG + GAP_TAG_MARK;
  }

  // decorative gold quote mark (") above the statement
  r.setFont(false, SZ_MARK); r.setColor(C_ACCENT);
  r.cell(bandW, BOX_MARK, '“', box.x, y, 'C');
  y += BOX_MARK + GAP_MARK_TXT;

  // punch-text (WHITE, bold) — the statement (data.text, fallback title), wrapped at the
  // HTML max-width (textBand), centered on the same axis as the tag/mark/sub above.
  r.setFont(true, SZ_TEXT); r.setColor(C_WHITE);
  const afterText = r.multiCell(textBand, LH_TEXT, statement, textX, y, 'C');
  y = afterText + GAP_TXT_SUB;

  // punch-sub (slate) — support line (data.sub, fallback subtitle/bullets)
  const subText = strip(data.sub) || strip(data.subtitle) || strip((data.bullets ?? [])[0]);
  if (subText) {
    r.setFont(false, SZ_SUB); r.setColor(C_BODY);
    r.multiCell(bandW, LH_SUB, subText, box.x, y, 'C');
  }
}

function renderProfileSlide(ctx: RenderCtx) {
  const { r, data, coords, colors } = ctx;
  const { C_BG, C_ACCENT, C_WHITE, C_MUTED, C_BODY } = colors;

  // HTML .slide[data-type="profile"] .slide-card: flex column, centered H+V,
  // text-align:center. Render a vertically-centered column:
  //   eyebrow → title → name → affiliation → bio
  r.fillRect(0, 0, coords.CW, coords.CH, C_BG);

  const bandW = coords.CW * 0.80;
  const bandX = coords.CX + (coords.CW - bandW) / 2;

  // Font sizes (SZ, pt) aligned per-item to HTML .profile-* via px×0.75 (the px→pt
  // calibration ratio). Line-height boxes (LH) and inter-item gaps (GAP) are px values
  // measured from the rendered HTML slide-2 (Playwright on the 1280x720 natural design
  // space — viewport_px=720, so px→mm is exact); positions are already aligned, only
  // glyph sizes are tuned here. Inter-item gap model: card flex `gap:32px` + margin-top.
  const SZ_EYEBROW = 9.6,  LH_EYEBROW = coords.px2mm(18);   // .profile-eyebrow 12.8px
  const SZ_TITLE   = 24,   LH_TITLE   = coords.px2mm(40);   // .slide-title    32px
  const SZ_NAME    = 22.8, LH_NAME    = coords.px2mm(44);   // .profile-name   30.4px
  const SZ_AFFIL   = 12.6, LH_AFFIL   = coords.px2mm(24);   // .profile-title  16.8px
  const SZ_BIO     = 11,   LH_BIO     = coords.px2mm(25);   // .profile-bio    14.72px
  const GAP_E = coords.px2mm(32),   GAP_T = coords.px2mm(40),   // 32+0 , 32+8
        GAP_N = coords.px2mm(36.8), GAP_A = coords.px2mm(49.6); // 32+4.8, 32+17.6

  const eyebrowTxt = 'Introduction';                 // HTML .profile-eyebrow (hardcoded)
  const titleTxt   = strip(data.title);
  const nameTxt    = strip(data.speakerName);
  const affilTxt   = strip(data.speakerTitle);
  const bioLines   = (data.speakerBio ?? '')
    .split(/<br\s*\/?>/i).map((s: string) => strip(s).trim()).filter(Boolean);

  // Vertically center the block.
  const blockH = LH_EYEBROW + GAP_E + LH_TITLE + GAP_T + LH_NAME + GAP_N
               + LH_AFFIL + GAP_A + LH_BIO * Math.max(1, bioLines.length);
  let y = coords.CY + Math.max(0, (coords.CH - blockH) / 2);

  r.setFont(true,  SZ_EYEBROW); r.setColor(C_ACCENT);                // gold uppercase eyebrow
  r.cell(bandW, LH_EYEBROW, eyebrowTxt.toUpperCase(), bandX, y, 'C');
  y += LH_EYEBROW + GAP_E;

  r.setFont(true,  SZ_TITLE); r.setColor(C_WHITE);                   // "연자 소개"
  r.cell(bandW, LH_TITLE, titleTxt, bandX, y, 'C');
  y += LH_TITLE + GAP_T;

  r.setFont(true,  SZ_NAME); r.setColor(C_WHITE);                    // name = --text-on-dark (white)
  r.cell(bandW, LH_NAME, nameTxt, bandX, y, 'C');
  y += LH_NAME + GAP_N;

  r.setFont(false, SZ_AFFIL); r.setColor(C_BODY);                    // affiliation = --text-secondary
  r.cell(bandW, LH_AFFIL, affilTxt, bandX, y, 'C');
  y += LH_AFFIL + GAP_A;

  r.setFont(false, SZ_BIO); r.setColor(C_MUTED);                     // bio = --text-muted
  for (const line of bioLines) {
    r.cell(bandW, LH_BIO, line, bandX, y, 'C');
    y += LH_BIO;
  }
}

function renderContactSlide(ctx: RenderCtx) {
  const { r, data, coords, colors } = ctx;
  const { C_BG, C_ACCENT, C_WHITE, C_BODY } = colors;

  // HTML .slide-card is a centered flex column (gap ~32px); the 3 children — .contact-thanks,
  // .contact-line (name + email), .contact-next — are all horizontally centered. Measured from
  // slide-24 (Playwright, 720px design space):
  //   .contact-thanks 234–294  41.6px  WHITE bold   "감사합니다"
  //   .contact-line   336–384  15.2px  #CBD5E1 reg   name + email (2 lines)
  //   .contact-next   445–486  14.08px GOLD   reg    CTA (1 line)
  // No header bar (HTML contact slide has none). Everything sits on the C_BG surface, centered
  // in an 80% band — NOT the default (narrow, left-aligned) content region the old code used.
  const LH_THANKS = coords.px2mm(60);    // .contact-thanks box (41.6px, line-height ~1.44)
  const LH_LINE   = coords.px2mm(24.5);  // .contact-line per line (15.2px)
  const LH_NOTE   = coords.px2mm(24);    // .contact-next line (14.08px)
  const GAP_TL    = coords.px2mm(42);    // thanks bottom → contact-lines top
  const GAP_LN    = coords.px2mm(60);    // contact-lines bottom → note top

  const SZ_THANKS = 31.2;  // .contact-thanks 41.6px (px × 0.75)
  const SZ_LINE   = 11.4;  // .contact-line   15.2px
  const SZ_NOTE   = 10.56; // .contact-next   14.08px

  r.fillRect(0, 0, coords.CW, coords.CH, C_BG);   // full-bleed surface, no header strip

  const bandW = coords.CW * 0.80;                 // centered 80% band (HTML centers everything)
  const bandX = coords.CX + (coords.CW - bandW) / 2;

  const thanks = strip(data.title);
  const name   = strip(data.contactName);
  const email  = strip(data.contactEmail);
  const note   = strip(data.contactNote);
  const nLines = (name ? 1 : 0) + (email ? 1 : 0) || 1;

  r.setFont(false, SZ_NOTE);
  const noteLines = note ? Math.max(1, r.wrapText(note, bandW).length) : 1;

  // Vertically center the whole contact group, then stack with measured gaps.
  const blockH = LH_THANKS + GAP_TL + LH_LINE * nLines + GAP_LN + LH_NOTE * noteLines;
  let y = coords.CY + Math.max(0, (coords.CH - blockH) / 2);

  // "감사합니다" — WHITE bold (HTML .contact-thanks is white, not gold)
  r.setFont(true, SZ_THANKS); r.setColor(C_WHITE);
  r.cell(bandW, LH_THANKS, thanks, bandX, y, 'C');
  y += LH_THANKS + GAP_TL;

  // contact lines — secondary #CBD5E1 (C_BODY), regular weight
  r.setFont(false, SZ_LINE); r.setColor(C_BODY);
  if (name)  { r.cell(bandW, LH_LINE, name,  bandX, y, 'C'); y += LH_LINE; }
  if (email) { r.cell(bandW, LH_LINE, email, bandX, y, 'C'); y += LH_LINE; }

  // note / CTA — GOLD (HTML .contact-next is accent gold)
  y += GAP_LN;
  r.setFont(false, SZ_NOTE); r.setColor(C_ACCENT);
  r.multiCell(bandW, LH_NOTE, note, bandX, y, 'C');
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

  // data.visual (text description) maps to visualDisplay; "none" is excluded.
  const rawVisual = data.visual && data.visual.toLowerCase() !== 'none' ? data.visual : undefined;
  const visualDisplay = data.visualDisplay || (!data.visualImage ? rawVisual : undefined);
  const hasRight = !!(data.visualImage || visualDisplay || data.visualTitle) && !!visR;
  const titleW   = titleR.w;
  const bulTxtW  = hasRight ? Math.min(contentR.w, visR!.x - contentR.x - 6) : contentR.w;

  // HTML .slide-content uses justify-content: center — vertically center the
  // [title + gap + bullets] block as a unit in the available area below the header.
  const headerBottom = headerR ? headerR.y + headerR.h : coords.CY;
  const cardBottom   = coords.CY + coords.CH - coords.px2mm(8);
  const availStart   = headerBottom + coords.px2mm(8);
  const availH       = cardBottom - availStart;

  const bullets  = data.bullets ?? [];
  const titleH   = r.estimateTextHeight(strip(data.title), hasRight ? titleW : bulTxtW, T_TITLE, LH_TITLE, true);
  const totalBh  = r.estimateBulletHeight(bullets, bulTxtW - 6, T_BUL, LH_BUL, BUL_GAP);
  const blockGap = bullets.length > 0 ? coords.px2mm(24) : 0;
  const blockH   = titleH + blockGap + totalBh;
  const blockY   = availStart + Math.max(0, (availH - blockH) * 0.5);

  r.setFont(true, T_TITLE); r.setColor(C_WHITE);
  const afterTitle = r.multiCell(titleW, LH_TITLE, strip(data.title), titleR.x, blockY, 'L');

  let by = afterTitle + blockGap;
  for (const b of bullets) {
    const txt = strip(b);
    if (!txt) continue;
    if (by > cardBottom) break;
    r.drawEllipse(contentR.x, by + LH_BUL * 0.28, 3.2, C_ACCENT);
    r.setFont(false, T_BUL); r.setColor(C_BODY);
    const afterBul = r.multiCell(bulTxtW - 6, LH_BUL, txt, contentR.x + 6, by, 'L');
    by = afterBul + BUL_GAP;
  }

  if (hasRight) {
    const ip = imgPath(data.visualImage, imgDir ?? '');
    if (ip) {
      const pad = visR!.w * 0.052;
      r.fillRect(visR!.x, visR!.y, visR!.w, visR!.h, C_VIS_BG);
      await r.placeImage(doc, ip, visR!.x + pad, visR!.y + pad, visR!.w - pad * 2, visR!.h - pad * 2);
    } else {
      r.fillRect(visR!.x, visR!.y, visR!.w, visR!.h, C_VIS_BG);
      const vt = strip(data.visualTitle);
      const vd = strip(visualDisplay);
      const lhVt = coords.px2mm(24), lhVb = coords.px2mm(22), gap = 5;
      // CSS-derived inner padding: read visual_inner_padding_px from spec (e.g. 24px for 1.5rem),
      // with a 2mm minimum floor for readability when CSS padding is 0.
      const visPad = Math.max(2, coords.px2mm(ctx.spec.visual_inner_padding_px ?? 0));
      const hVt = vt ? r.estimateTextHeight(vt, visR!.w - visPad * 2, T_VIS_T, lhVt, true)  : 0;
      const hVb = vd ? r.estimateTextHeight(vd, visR!.w - visPad * 2, T_VIS_B, lhVb, false) : 0;
      const totalH = hVt + (vt && vd ? gap : 0) + hVb;
      let vy = visR!.y + visPad + Math.max(0, (visR!.h - visPad * 2 - totalH) / 2);
      if (vt) {
        r.setFont(true,  T_VIS_T); r.setColor(C_ACCENT);
        vy = r.multiCell(visR!.w - visPad * 2, lhVt, vt, visR!.x + visPad, vy, 'L') + gap;
      }
      if (vd) {
        r.setFont(true, T_VIS_B); r.setColor(C_WHITE);
        r.multiCell(visR!.w - visPad * 2, lhVb, vd, visR!.x + visPad, vy, 'L');
      }
    }
  }

  if (metaR && !headerR) {
    // Slide counter — skip when headerR is present since drawHeaderBar already
    // renders the number on the right side of the header bar.
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
// Color key resolution mirrors the pre-rewrite buildColors exactly so pre-rewrite
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
    T_BUL       : f.bullet_pt ?? 14.0,
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

// ── Auto-calibrate: estimate layout_overrides from CSS ───────────────────────
// Reads CSS custom properties (--font-size-title, --bullet-gap, etc.) from the
// project's theme CSS files and computes estimated fonts/line_heights values.
// Prints a YAML block suitable for pasting into lecture-profile.md.
// This is an OPTIONAL utility — existing static theme JSON remains the default.

async function autoCalibrate(workspaceRoot: string, projectArg: string) {
  const projectDir = resolve(workspaceRoot, projectArg);

  // Read lecture-profile.md for theme/style
  const profilePath = join(projectDir, 'lecture-profile.md');
  let theme = 'pitch-enhanced', style = 'premium-dark';
  if (existsSync(profilePath)) {
    const profile = parseFrontmatter(readFileSync(profilePath, 'utf-8'));
    theme = profile.theme ?? 'pitch-enhanced';
    style = profile.style ?? 'premium-dark';
  }

  // CSS files to read (in cascade order: base → theme → style)
  const cssFiles = [
    resolve(workspaceRoot, 'docs/html-themes/styles/base.css'),
    resolve(workspaceRoot, `docs/html-themes/themes/${theme}/theme.css`),
    resolve(workspaceRoot, `docs/html-themes/styles/${style}/style.css`),
  ];

  // Parse CSS custom properties
  const cssVars: Record<string, string> = {};
  for (const cssPath of cssFiles) {
    if (!existsSync(cssPath)) continue;
    const content = readFileSync(cssPath, 'utf-8');
    // Match: --var-name: value; (inside :root or other selectors)
    const varRegex = /--([a-zA-Z0-9-]+)\s*:\s*([^;{}]+)/g;
    let match;
    while ((match = varRegex.exec(content)) !== null) {
      cssVars[match[1]] = match[2].trim();
    }
  }

  // Helper: convert CSS rem value to px (1rem = 16px base)
  const remToPx = (val: string): number => {
    const s = val.replace(/\s/g, '');
    if (s.endsWith('rem')) return parseFloat(s) * 16;
    if (s.endsWith('px')) return parseFloat(s);
    const num = parseFloat(s);
    return isNaN(num) ? 0 : num;
  };

  // Extract relevant CSS values
  const titleFontSize = remToPx(cssVars['font-size-title'] ?? '2rem');       // 32px
  const subtitleFontSize = remToPx(cssVars['font-size-subtitle'] ?? '1.3rem'); // 20.8px
  const bodyFontSize = remToPx(cssVars['font-size-body'] ?? '1rem');          // 16px
  const headerHeight = remToPx(cssVars['header-height'] ?? '3.2rem');        // 51.2px
  const cardPaddingV = remToPx(cssVars['card-padding']?.split(' ')[0] ?? '2rem'); // 32px
  const bulletGap = remToPx(cssVars['bullet-gap'] ?? '0.6rem');             // 9.6px
  const imagePanelWidth = parseFloat(cssVars['image-panel-width'] ?? '45%'); // 45
  const lineHeightBody = parseFloat(cssVars['line-height-body'] ?? '1.65');  // 1.65

  // Get viewport_px from theme spec
  const themePath = resolve(workspaceRoot, `docs/html-themes/themes/${theme}/pdf_layout_spec.json`);
  let viewportPx = 720;
  if (existsSync(themePath)) {
    const spec = JSON.parse(readFileSync(themePath, 'utf-8'));
    viewportPx = spec.calibration?.viewport_px ?? 720;
  }

  const pageH = 190.5; // mm

  // Calibration multipliers (derived from analysis of existing tuned specs):
  // fonts: pt values are typically CSS_px × 0.75 × ~1.1-1.25 (PDF-optimized)
  // line_heights: values are typically CSS_px × ~1.8-2.0 (scaled to viewport space)
  const FONT_PT_MULT = 0.94;    // CSS px → PDF pt multiplier (tuned for readability)
  const LINE_H_MULT = 1.90;     // CSS px → viewport_px multiplier (tuned)

  // Compute estimated values
  const titlePt = Math.round(titleFontSize * FONT_PT_MULT * 10) / 10;
  const bulletPt = Math.round(bodyFontSize * FONT_PT_MULT * 10) / 10;
  const divTitlePt = Math.round(titleFontSize * 1.1 * FONT_PT_MULT * 10) / 10;  // divider slightly larger
  const divDescPt = Math.round(subtitleFontSize * FONT_PT_MULT * 10) / 10;

  const titlePx = Math.round(titleFontSize * lineHeightBody * LINE_H_MULT * 100) / 100;
  const bulletPx = Math.round(bodyFontSize * lineHeightBody * LINE_H_MULT * 100) / 100;
  const bulletGapPx = Math.round(bulletGap * LINE_H_MULT * 100) / 100;
  const divTitlePx = Math.round(titleFontSize * 1.1 * lineHeightBody * LINE_H_MULT * 100) / 100;
  const divDescPx = Math.round(subtitleFontSize * lineHeightBody * LINE_H_MULT * 100) / 100;

  // Validate: line_mm must exceed font_mm
  const titleLineMm = (titlePx / viewportPx) * pageH;
  const titleFontMm = titlePt / MM_TO_PT;
  const bulletLineMm = (bulletPx / viewportPx) * pageH;
  const bulletFontMm = bulletPt / MM_TO_PT;

  console.log(`\n📐 Auto-Calibrate: ${theme} theme, ${style} style`);
  console.log(`   Viewport: ${viewportPx}px | Page: ${pageH}mm\n`);

  console.log('   CSS values read:');
  console.log(`     --font-size-title: ${cssVars['font-size-title'] ?? '2rem'} = ${titleFontSize}px`);
  console.log(`     --font-size-body: ${cssVars['font-size-body'] ?? '1rem'} = ${bodyFontSize}px`);
  console.log(`     --bullet-gap: ${cssVars['bullet-gap'] ?? '0.6rem'} = ${bulletGap}px`);
  console.log(`     --line-height-body: ${lineHeightBody}`);
  console.log(`     --image-panel-width: ${imagePanelWidth}%`);
  console.log('');

  console.log('   Estimated layout_overrides for lecture-profile.md:');
  console.log('   ─────────────────────────────────────────────────');

  const yaml = [
    '  layout_overrides:',
    '    fonts:',
    `      title_pt: ${titlePt}`,
    `      bullet_pt: ${bulletPt}`,
    `      div_title_pt: ${divTitlePt}`,
    `      div_desc_pt: ${divDescPt}`,
    '    line_heights:',
    `      title_px: ${titlePx}`,
    `      bullet_px: ${bulletPx}`,
    `      bullet_gap_px: ${bulletGapPx}`,
    `      div_title_px: ${divTitlePx}`,
    `      div_desc_px: ${divDescPx}`,
  ];
  for (const line of yaml) console.log(line);

  console.log('');
  console.log('   Validation:');
  const titleOk = titleLineMm > titleFontMm;
  const bulletOk = bulletLineMm > bulletFontMm;
  console.log(`     title:   font_mm=${titleFontMm.toFixed(2)}, line_mm=${titleLineMm.toFixed(2)} ${titleOk ? '✅' : '❌ (line < font!)'}`);
  console.log(`     bullet:  font_mm=${bulletFontMm.toFixed(2)}, line_mm=${bulletLineMm.toFixed(2)} ${bulletOk ? '✅' : '❌ (line < font!)'}`);

  if (!titleOk || !bulletOk) {
    console.log('\n   ⚠️  Validation failed — line heights too small for font sizes.');
    console.log('   Increase line_heights values above or decrease fonts.');
  }

  console.log('\n   💡 Copy the YAML block above into your lecture-profile.md frontmatter.');
  console.log('   Compare with theme defaults in:');
  console.log(`     docs/html-themes/themes/${theme}/pdf_layout_spec.json`);
}

// ── CLI ───────────────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  const get  = (flag: string) => { const i = args.indexOf(flag); return i >= 0 ? args[i + 1] : undefined; };

  const projectArg = get('--project');
  if (!projectArg) {
    console.error('Usage: bun scripts/gen-slides-pdf.ts --project presentations/<project> [--out name.pdf] [--sample 5] [--font-dir fonts/] [--data path/to/slidedata.json]');
    console.error('       bun scripts/gen-slides-pdf.ts --auto-calibrate --project presentations/<project>');
    process.exit(1);
  }

  // ── --auto-calibrate mode: estimate layout_overrides from CSS ─────────────
  if (args.includes('--auto-calibrate')) {
    await autoCalibrate(workspaceRoot, projectArg);
    return;
  }

  const workspaceRoot = resolve(dirname(import.meta.path), '../..');
  const projectDir    = resolve(workspaceRoot, projectArg);
  if (!existsSync(projectDir)) {
    console.error(`Project folder not found: ${projectDir}`); process.exit(1);
  }

  // ── Read lecture-profile.md and parse theme/style ─────────────────────────
  const lectureProfilePath = join(projectDir, 'lecture-profile.md');
  let lectureProfile: Record<string, any> = {};
  let bgImageConfig: BgImageConfig | null = null;
  if (existsSync(lectureProfilePath)) {
    const profileContent = readFileSync(lectureProfilePath, 'utf-8');
    lectureProfile = parseFrontmatter(profileContent);
    bgImageConfig = parseBackgroundImage(profileContent);
  }

  const theme = lectureProfile.theme ?? 'pitch-enhanced';
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
  const imgDir   = projectDir;  // visualImage paths in slidedata.json are relative to projectDir (imgPath = join(imgDir, src), no prefix strip)
  const outPath  = join(projectDir, outName);

  if (!existsSync(dataPath)) {
    console.error(`slidedata.json not found: ${dataPath}`);
    console.error('   Run bun scripts/extract_slidedata.mjs <html> first.');
    process.exit(1);
  }

  // Resolve font files: prefer project dir, then OS system font directories
  const FONT_FAMILIES: Array<[string, string]> = [
    ['Pretendard-Regular.ttf', 'Pretendard-Bold.ttf'],
    ['MaruBuri-Regular.ttf',   'MaruBuri-Bold.ttf'],
  ];

  // Build search order: project fontDir → OS system dirs
  const sysFontDirs: string[] = (() => {
    const p = platform();
    const home = homedir();
    if (p === 'win32') return ['C:/Windows/Fonts'];
    if (p === 'darwin') return [join(home, 'Library/Fonts'), '/Library/Fonts', '/System/Library/Fonts'];
    return [join(home, '.local/share/fonts'), '/usr/share/fonts/truetype', '/usr/share/fonts'];
  })();

  let fontR = '', fontB = '';
  for (const [r, b] of FONT_FAMILIES) {
    for (const dir of [fontDir, ...sysFontDirs]) {
      const rp = join(dir, r), bp = join(dir, b);
      if (existsSync(rp) && existsSync(bp)) { fontR = rp; fontB = bp; break; }
    }
    if (fontR) break;
  }
  if (!fontR) {
    console.error(`Font files not found in: ${fontDir}`);
    console.error('   Expected Pretendard-Regular/Bold.ttf or MaruBuri-Regular/Bold.ttf');
    process.exit(1);
  }

  console.log(`Project: ${projectDir}`);
  console.log(`Output:  ${outPath}`);
  console.log(`Theme: ${theme}  Style: ${style}`);
  console.log(`Card ${CW.toFixed(1)}x${CH.toFixed(1)}mm`);

  let slideData: SlideData[] = JSON.parse(readFileSync(dataPath, 'utf-8'));
  if (sampleCount != null) slideData = slideData.slice(0, sampleCount);

  const TOTAL = slideData.length;

  // ── Background image setup ──────────────────────────────────────────────
  // Resolve the global background image path from image-manifest.json or slideData.
  let globalBgPath: string | null = null;
  const slideBgEntries = new Map<number, string>();  // slide_index → image path (individual mode)
  if (bgImageConfig) {
    // Try image-manifest.json first (global background_image section)
    const manifestPath = join(projectDir, 'image-manifest.json');
    if (existsSync(manifestPath)) {
      try {
        const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'));
        if (manifest.background_image?.path) {
          globalBgPath = manifest.background_image.path;
        }
        // Collect individual per-slide background entries
        for (const entry of (manifest.slides ?? [])) {
          if (entry.image_role === 'background' && entry.slide_index >= 0) {
            slideBgEntries.set(entry.slide_index, entry.path);
          }
        }
      } catch { /* ignore parse errors — background is optional */ }
    }
    // Fallback: check slideData backgroundImage fields for individual entries
    for (let i = 0; i < slideData.length; i++) {
      if (slideData[i].backgroundImage && !slideBgEntries.has(i)) {
        slideBgEntries.set(i, slideData[i].backgroundImage!);
      }
    }
    if (globalBgPath) {
      console.log(`Background image: ${globalBgPath} (scope: ${bgImageConfig.scope}, overlay: rgba(${bgImageConfig.overlay.color.join(',')},${bgImageConfig.overlay.opacity}))`);
    }
  }

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

    // ── Background image rendering (full-bleed + overlay) ────────────────
    if (bgImageConfig) {
      const bgPath = resolveBgImagePath(data, idx, bgImageConfig, imgDir, globalBgPath, slideBgEntries);
      if (bgPath) {
        try {
          // Draw full-bleed background image (cover-crop to entire page)
          const pageWmm = PW;  // page width in mm (same as PW from coords)
          const pageHmm = PH;  // page height in mm
          await renderer.placeImageCover(pdfDoc, bgPath, 0, 0, pageWmm, pageHmm);
          // Draw semi-transparent overlay for text readability
          if (bgImageConfig.overlay.opacity > 0) {
            const [or, og, ob] = bgImageConfig.overlay.color;
            renderer.fillRectOverlay(0, 0, pageWmm, pageHmm, rgb(or / 255, og / 255, ob / 255), bgImageConfig.overlay.opacity);
          }
        } catch (e: any) {
          console.warn(`  bg image err (slide ${idx + 1}): ${e.message}`);
        }
      }
    }

    const n = idx + 1;

    // AC-2: dispatch is driven by which slide_types the THEME declares, not by
    // theme name. isDividerSlide + declared "divider"  → renderDividerSlide;
    // isPunchline     + declared "punchline" → renderPunchlineSlide;
    // isTitleSlide    + declared "title"      → renderTitleSlide;
    // otherwise                            → "standard".
    const slideTypes = layoutSpec.slide_types ?? {};
    const has        = (t: string) => !!(slideTypes[t] && slideTypes[t].regions);

    let type: 'title' | 'divider' | 'punchline' | 'profile' | 'contact' | 'standard';
    if (data.isTitleSlide && has('title'))           type = 'title';
    else if (data.isDividerSlide && has('divider'))  type = 'divider';
    else if (data.isPunchline && has('punchline'))   type = 'punchline';
    else if (data.isProfileSlide && has('profile'))  type = 'profile';
    else if (data.isContactSlide && has('contact'))  type = 'contact';
    else                                             type = 'standard';

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
    else if (type === 'profile')   renderProfileSlide(ctx);
    else if (type === 'contact')   renderContactSlide(ctx);
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
