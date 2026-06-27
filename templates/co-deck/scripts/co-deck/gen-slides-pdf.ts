// @version 1.9.0 — CJK fallback font + contact slide LinkedIn fix.
//   When primary font (Pretendard/MaruBuri) lacks glyphs for CJK characters (e.g. 한자),
//   automatically falls back to NotoSansKR (system or project font). Fixes tofu/box
//   rendering on profile slides with 한자 bio text. Also fixed: renderContactSlide now
//   renders contactLinkedIn field from slidedata.json.
//   v1.8.0: Increased PDF body/bullet font sizes for readability. bullet_pt raised
//   from 11-13pt to 14-15pt across all themes; bullet_px/line_heights adjusted proportionally.
//   Auto-calibrate FONT_PT_MULT tuned from 0.85→0.94 to produce readable estimates.
//   v1.7.0: Background image support. When lecture-profile.md → background_image.enabled
//   is true, renders full-bleed background image (cover-crop) with semi-transparent overlay.
//   Supports scope: all | divider-cover | individual. Reads background image config from
//   lecture-profile.md frontmatter; resolves image path from image-manifest.json or slideData.
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
import fontkit, { create as fontkitCreate } from '@pdf-lib/fontkit';
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
  /** CJK fallback font for glyphs missing in primary font (e.g. 한자 in Pretendard). */
  private fallbackRegular: PDFFont | null = null;
  private fallbackBold: PDFFont | null = null;
  /**
   * Set of Unicode code points known to be MISSING in the primary font.
   * Built from fontkit's hasGlyphForCodePoint at font load time.
   * Used at render time to switch to fallback font for these code points.
   */
  private missingCps: Set<number> = new Set();
  private curFont: PDFFont;
  private curSize = 12;
  private curColor: RGB;
  readonly pageW: number;   // pts
  readonly pageH: number;   // pts

  constructor(regular: PDFFont, bold: PDFFont, pageWMm: number, pageHMm: number, defaultColor: RGB,
              fallbackRegular?: PDFFont | null, fallbackBold?: PDFFont | null,
              missingCps?: Set<number>) {
    this.regular         = regular;
    this.bold            = bold;
    this.fallbackRegular = fallbackRegular ?? null;
    this.fallbackBold    = fallbackBold ?? null;
    this.missingCps      = missingCps ?? new Set();
    this.curFont         = regular;
    this.curColor        = defaultColor;
    this.pageW           = mm(pageWMm);
    this.pageH           = mm(pageHMm);
  }

  setPage(p: PDFPage) { this.page = p; }

  // Convert mm (fpdf2-style top-left origin) → pts bottom-left (pdf-lib)
  private pt(v: number) { return mm(v); }
  private fy(yMm: number) { return this.pageH - mm(yMm); }  // flip Y: top → bottom

  /**
   * Check if the given code point is missing from the primary font
   * (and thus should use the fallback font).
   */
  private needsFallback(cp: number): boolean {
    return this.missingCps.has(cp);
  }

  /**
   * Get the effective font for a code point: primary if it has the glyph,
   * otherwise the fallback font (or primary if no fallback available).
   */
  private effectiveFontForCp(cp: number): PDFFont {
    if (!this.needsFallback(cp)) return this.curFont;
    const fb = this.curFont === this.bold ? this.fallbackBold : this.fallbackRegular;
    return fb ?? this.curFont;
  }

  /**
   * Split a string into mono-font runs where each run uses a single PDFFont.
   * Consecutive characters sharing the same effective font are grouped together.
   */
  private buildFontRuns(text: string): Array<{ text: string; font: PDFFont }> {
    // Fast path: no fallback font or no missing code points in text
    if (!this.fallbackRegular) return [{ text, font: this.curFont }];
    let anyMissing = false;
    for (const ch of text) {
      if (this.missingCps.has(ch.codePointAt(0)!)) { anyMissing = true; break; }
    }
    if (!anyMissing) return [{ text, font: this.curFont }];

    const runs: Array<{ text: string; font: PDFFont }> = [];
    for (const ch of text) {
      const cp = ch.codePointAt(0)!;
      const font = this.effectiveFontForCp(cp);
      if (runs.length > 0 && runs[runs.length - 1].font === font) {
        runs[runs.length - 1].text += ch;
      } else {
        runs.push({ text: ch, font });
      }
    }
    return runs;
  }

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
  // Supports CJK fallback: splits text into mono-font runs for characters that
  // the primary font cannot render (e.g. 한자 in Pretendard).
  private drawLine(text: string, xMm: number, yMm: number, cellH: number) {
    const baselineY = this.fy(yMm + cellH * 0.72);
    const runs = this.buildFontRuns(text);
    let curX = xMm;
    for (const run of runs) {
      this.page.drawText(run.text, {
        x: this.pt(curX),
        y: baselineY,
        size:  this.curSize,
        font:  run.font,
        color: this.curColor,
      });
      curX += run.font.widthOfTextAtSize(run.text, this.curSize) / MM_TO_PT;
    }
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

  // Multi-line cell — returns Y position after last line (mm from top).
  // Empty lines (from consecutive \n) consume a full hMm row as blank spacing.
  multiCell(wMm: number, hMm: number, text: string, xMm: number, yMm: number, align: 'L' | 'R' | 'C' = 'L'): number {
    const lines = this.wrapText(text, wMm);
    let y = yMm;
    for (const line of lines) {
      if (line) {
        this.cell(wMm, hMm, line, xMm, y, align);
      }
      y += hMm;
    }
    return y;
  }

  // Returns text width in mm (accounts for CJK fallback font width differences)
  stringWidth(text: string): number {
    const runs = this.buildFontRuns(text);
    let total = 0;
    for (const run of runs) {
      total += run.font.widthOfTextAtSize(run.text, this.curSize);
    }
    return total / MM_TO_PT;
  }

  wrapText(text: string, maxWidthMm: number): string[] {
    const lines: string[] = [];
    for (const segment of text.split('\n')) {
      const words = segment.split(' ');
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
      // Preserve empty lines as empty strings so multiCell renders blank spacing.
      lines.push(line.trimEnd());
    }
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
  contactName?:      string;
  contactEmail?:     string;
  contactLinkedIn?:  string;
  contactPhone?:     string;
  contactNote?:      string;
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
    font_px_to_pt?: number;
  };
  regions?: Record<string, Region | null>;
  slide_types?: Record<string, {
    regions?: string[];
  }>;
  slide_type_overrides?: Record<string, Record<string, Region | null>>;
  // Font sizes in CSS px (v2.0). Legacy _pt keys are auto-converted.
  fonts?: {
    // CSS px keys (preferred)
    section_px?:       number;
    slide_num_px?:     number;
    title_px?:         number;
    bullet_px?:        number;
    punchline_px?:     number;
    punchline_sub_px?: number;
    vis_title_px?:     number;
    vis_body_px?:      number;
    ts_eyebrow_px?:    number;
    ts_title_px?:      number;
    ts_subtitle_px?:   number;
    ts_meta_px?:       number;
    div_part_px?:      number;
    div_title_px?:     number;
    div_desc_px?:      number;
    // Legacy pt keys (auto-converted via buildSizes)
    title_pt?:         number;
    bullet_pt?:        number;
    punchline_pt?:     number;
    punchline_sub_pt?: number;
    div_title_pt?:     number;
    div_desc_pt?:      number;
  };
  // Line heights in CSS px (v2.0). One cssPx value = font-size × line-height-ratio.
  line_heights?: {
    title_px?:         number;
    bullet_px?:        number;
    bullet_gap_px?:    number;
    punchline_px?:     number;
    div_title_px?:     number;
    div_desc_px?:      number;
    vis_title_px?:     number;
    vis_body_px?:      number;
    ts_eyebrow_px?:    number;
    ts_title_px?:      number;
    ts_subtitle_px?:   number;
    ts_meta_px?:       number;
    div_part_px?:      number;
    punch_tag_px?:     number;
    punch_mark_px?:    number;
    punch_text_px?:    number;
    punch_sub_px?:     number;
    prof_eyebrow_px?:  number;
    prof_name_px?:     number;
    prof_affil_px?:    number;
    prof_bio_px?:      number;
    cont_thanks_px?:   number;
    cont_line_px?:     number;
    cont_note_px?:     number;
  };
  // Gaps between elements in CSS px.
  gaps_px?: {
    ts_eye_ttl_px?:      number;
    ts_ttl_sub_px?:      number;
    ts_sub_meta_px?:     number;
    div_part_title_px?:  number;
    div_title_desc_px?:  number;
    punch_tag_mark_px?:  number;
    punch_mark_text_px?: number;
    punch_text_sub_px?:  number;
    prof_eyebrow_name_px?: number;
    prof_name_affil_px?:  number;
    prof_affil_bio_px?:   number;
    cont_thanks_line_px?: number;
    cont_line_note_px?:   number;
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

async function renderTitleSlide(ctx: RenderCtx) {
  const { r, doc, data, imgDir, spec, coords, colors, sizes, region } = ctx;
  const { C_ACCENT, C_MUTED, C_WHITE, C_META, C_DARK, C_BORDER } = colors;
  const {
    T_TS_EYEBROW, T_TS_TITLE, T_TS_SUB, T_TS_META, T_SECT, T_NUM,
    LH_TS_EYEBROW, LH_TS_TITLE, LH_TS_SUB, LH_TS_META,
    GAP_TS_EYE_TTL, GAP_TS_TTL_SUB, GAP_TS_SUB_META,
  } = sizes;

  const titleR = region('title');
  const subR   = tryRegion(ctx, 'subtitle') ?? titleR;
  const metaR  = tryRegion(ctx, 'meta')     ?? subR;
  const visR   = tryRegion(ctx, 'visual');
  const hdrR   = tryRegion(ctx, 'header');

  if (hdrR) {
    drawHeaderBar(r, strip(data.section), ctx.n, ctx.total, hdrR, titleR, titleR.x, ctx.coords.CY, C_DARK, C_ACCENT, C_MUTED, C_BORDER, T_SECT, T_NUM);
  }

  const ip = imgPath(data.visualImage, imgDir ?? '');
  const hasImage = !!(ip && visR);

  if (hasImage) {
    // HTML: .slide-content 1fr/1fr grid — slide-left (L-aligned text) + right-panel (image)
    // Left column: from slide margin to visR, gap = 3rem
    const margin  = coords.CX + coords.px2mm(56);          // padding-left 3.5rem
    const textW   = visR!.x - margin - coords.px2mm(48);   // gap 3rem

    const eyebrow  = strip(data.section);
    const titleTxt = strip(data.title);
    const subtitle = strip(data.subtitle);
    const meta     = strip(data.meta);

    r.setFont(true, T_TS_TITLE);
    const titleLineCount = r.wrapText(titleTxt, textW).length;
    const hEye   = eyebrow  ? LH_TS_EYEBROW + GAP_TS_EYE_TTL                       : 0;
    const hTitle = titleLineCount * LH_TS_TITLE + (subtitle || meta ? GAP_TS_TTL_SUB : 0);
    const hSub   = subtitle ? LH_TS_SUB + (meta ? GAP_TS_SUB_META : 0)           : 0;
    const hMeta  = meta     ? LH_TS_META                                              : 0;
    const blockH = hEye + hTitle + hSub + hMeta;

    let vy = coords.CY + coords.px2mm(48)
           + Math.max(0, (coords.CH - coords.px2mm(96) - blockH) / 2);

    if (eyebrow) {
      r.setFont(true, T_TS_EYEBROW); r.setColor(C_ACCENT);
      r.multiCell(textW, LH_TS_EYEBROW, eyebrow.toUpperCase(), margin, vy, 'L');
      vy += LH_TS_EYEBROW + GAP_TS_EYE_TTL;
    }
    r.setFont(true, T_TS_TITLE); r.setColor(C_WHITE);
    vy = r.multiCell(textW, LH_TS_TITLE, titleTxt, margin, vy, 'L');
    if (subtitle || meta) vy += GAP_TS_TTL_SUB;
    if (subtitle) {
      r.setFont(false, T_TS_SUB); r.setColor(C_MUTED);
      vy = r.multiCell(textW, LH_TS_SUB, subtitle, margin, vy, 'L');
      if (meta) vy += GAP_TS_SUB_META;
    }
    if (meta) {
      r.setFont(false, T_TS_META); r.setColor(C_META);
      r.multiCell(textW, LH_TS_META, meta, margin, vy, 'L');
    }
    await r.placeImage(doc, ip!, visR!.x, visR!.y, visR!.w, visR!.h);
  } else {
    // No image: single centered column (HTML: grid-template-columns: 1fr, text-align: center)
    const eyebrow = strip(data.section);
    if (eyebrow && metaR) {
      r.setFont(true, T_TS_EYEBROW); r.setColor(C_ACCENT);
      r.multiCell(metaR.w, LH_TS_META, eyebrow.toUpperCase(), metaR.x, metaR.y, 'C');
    }
    r.setFont(true, T_TS_TITLE); r.setColor(C_WHITE);
    r.multiCell(titleR.w, LH_TS_TITLE, strip(data.title), titleR.x, titleR.y, 'C');
    r.setFont(false, T_TS_SUB); r.setColor(C_MUTED);
    r.multiCell(subR.w, LH_TS_SUB, strip(data.subtitle), subR.x, subR.y, 'C');
    const meta = strip(data.meta);
    if (meta) {
      const metaY = subR.y + LH_TS_SUB + GAP_TS_SUB_META;
      r.setFont(false, T_TS_META); r.setColor(C_META);
      r.multiCell(subR.w, LH_TS_META, meta, subR.x, metaY, 'C');
    }
  }
}

async function renderDividerSlide(ctx: RenderCtx) {
  const { r, doc, data, imgDir, spec, coords, colors, sizes, region } = ctx;
  const { C_BG, C_DARK3, C_DARK, C_BORDER, C_ACCENT, C_MUTED, C_TEXT } = colors;
  const { CX, CY, CW, CH } = coords;
  const {
    T_DIV_PART, T_DIV_TITLE, T_DIV_DESC, T_SECT, T_NUM,
    LH_DIV_PART, LH_DIV_TITLE, LH_DIV_DESC,
    GAP_DIV_PART_TITLE, GAP_DIV_TITLE_DESC,
  } = sizes;

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

  const ip = imgPath(data.visualImage, imgDir ?? '');
  const align: 'L' | 'C' = ip ? 'L' : 'C';

  // Estimate actual block height accounting for title/desc text wrapping.
  // For image dividers, center vertically within the full card (not just titleR).
  // For text-only dividers, center within titleR as before.
  r.setFont(true, T_DIV_TITLE);
  const titleH_est = r.estimateTextHeight(strip(data.title), titleR.w, T_DIV_TITLE, LH_DIV_TITLE, true);
  r.setFont(false, T_DIV_DESC);
  const descH_est  = r.estimateTextHeight(strip(data.desc ?? ''), titleR.w, T_DIV_DESC, LH_DIV_DESC, false);
  const blockH = LH_DIV_PART + GAP_DIV_PART_TITLE + titleH_est + GAP_DIV_TITLE_DESC + descH_est;
  const py0 = ip
    ? coords.CY + Math.max(LH_DIV_PART, (coords.CH - blockH) / 2)
    : titleR.y + Math.max(0, (titleR.h - blockH) / 2);

  r.setFont(true, T_DIV_PART); r.setColor(C_ACCENT);
  r.cell(titleR.w, LH_DIV_PART, (strip(data.partNum)).toUpperCase(), titleR.x, py0, align);

  const py1 = py0 + LH_DIV_PART + GAP_DIV_PART_TITLE;
  r.setFont(true, T_DIV_TITLE); r.setColor(C_TEXT);
  const afterTitle = r.multiCell(titleR.w, LH_DIV_TITLE, strip(data.title), titleR.x, py1, align);

  const py2 = afterTitle + GAP_DIV_TITLE_DESC;
  r.setFont(false, T_DIV_DESC); r.setColor(C_MUTED);
  r.multiCell(titleR.w, LH_DIV_DESC, strip(data.desc), titleR.x, py2, align);

  if (ip) {
    r.fillRect(visR.x, visR.y, visR.w, visR.h, C_DARK3);
    await r.placeImageCover(doc, ip, visR.x, visR.y, visR.w, visR.h);
  }
}

function renderPunchlineSlide(ctx: RenderCtx) {
  const { r, data, spec, coords, colors, sizes, region } = ctx;
  const { C_BG, C_ACCENT, C_WHITE, C_BODY } = colors;
  const {
    T_PUNCH_TAG, T_PUNCH_MARK, T_PUNCH_TEXT, T_PUNCH_SUB,
    LH_PUNCH_TAG, LH_PUNCH_MARK, LH_PUNCH_TEXT, LH_PUNCH_SUB,
    GAP_PUNCH_TAG_MARK, GAP_PUNCH_MARK_TEXT, GAP_PUNCH_TEXT_SUB,
  } = sizes;

  const titleR = region('title');
  const box    = tryRegion(ctx, 'content') ?? titleR;   // center within the large content region
  const bandW  = box.w;

  // HTML constrains .punch-text to max-width: 32ch (≈607px ≈160.6mm) so the statement
  // wraps to ~2 centered lines. Reproduce that exact max-width (measured from slide-7,
  // whose natural width 169.3mm > 160.6mm → wraps). Count the wrapped lines so blockH /
  // vertical centering accounts for the ACTUAL statement height.
  const statement = strip(data.text) || strip(data.title);
  r.setFont(true, T_PUNCH_TEXT);
  const textBand = Math.min(bandW, coords.px2mm(607));
  const textX    = box.x + (bandW - textBand) / 2;
  const textLineH = (statement ? r.wrapText(statement, textBand).length : 1) * LH_PUNCH_TEXT;

  const blockH = LH_PUNCH_TAG + GAP_PUNCH_TAG_MARK + LH_PUNCH_MARK + GAP_PUNCH_MARK_TEXT + textLineH + GAP_PUNCH_TEXT_SUB + LH_PUNCH_SUB;
  let y = box.y + Math.max(0, (box.h - blockH) / 2);

  // Full-bleed dark background (HTML .slide[data-type=”punchline”] is radial navy).
  r.fillRect(0, 0, coords.CW, coords.CH, C_BG);

  // part-tag (gold, uppercase) — e.g. “PART 01 · 패러다임 전환”
  const sec = strip(data.section);
  if (sec) {
    r.setFont(false, T_PUNCH_TAG); r.setColor(C_ACCENT);
    r.cell(bandW, LH_PUNCH_TAG, sec.toUpperCase(), box.x, y, 'C');
    y += LH_PUNCH_TAG + GAP_PUNCH_TAG_MARK;
  }

  // decorative gold quote mark (“) above the statement
  r.setFont(false, T_PUNCH_MARK); r.setColor(C_ACCENT);
  r.cell(bandW, LH_PUNCH_MARK, '”', box.x, y, 'C');
  y += LH_PUNCH_MARK + GAP_PUNCH_MARK_TEXT;

  // punch-text (WHITE, bold) — the statement (data.text, fallback title), wrapped at the
  // HTML max-width (textBand), centered on the same axis as the tag/mark/sub above.
  r.setFont(true, T_PUNCH_TEXT); r.setColor(C_WHITE);
  const afterText = r.multiCell(textBand, LH_PUNCH_TEXT, statement, textX, y, 'C');
  y = afterText + GAP_PUNCH_TEXT_SUB;

  // punch-sub (slate) — support line (data.sub, fallback subtitle/bullets)
  const subText = strip(data.sub) || strip(data.subtitle) || strip((data.bullets ?? [])[0]);
  if (subText) {
    r.setFont(false, T_PUNCH_SUB); r.setColor(C_BODY);
    r.multiCell(bandW, LH_PUNCH_SUB, subText, box.x, y, 'C');
  }
}

function renderProfileSlide(ctx: RenderCtx) {
  const { r, data, coords, colors, sizes } = ctx;
  const { C_BG, C_ACCENT, C_WHITE, C_MUTED } = colors;
  const {
    T_PROF_EYEBROW, T_PROF_NAME, T_PROF_AFFIL, T_PROF_BIO,
    LH_PROF_EYEBROW, LH_PROF_NAME, LH_PROF_AFFIL, LH_PROF_BIO,
    GAP_PROF_EYEBROW_NAME, GAP_PROF_NAME_AFFIL, GAP_PROF_AFFIL_BIO,
  } = sizes;

  // HTML pitch-enhanced .slide[data-type="profile"]:
  //   flex column, centered, text-align:center, padding: 4rem
  //   profile-eyebrow (section) → profile-name → profile-affiliation (accent) → profile-bio
  //   No slide-title element.
  r.fillRect(0, 0, coords.CW, coords.CH, C_BG);

  const bandW = coords.CW * 0.80;
  const bandX = coords.CX + (coords.CW - bandW) / 2;

  const eyebrowTxt = strip(data.section);
  const nameTxt    = strip(data.speakerName);
  const affilTxt   = strip(data.speakerTitle);
  const bioLines   = (data.speakerBio ?? '')
    .split(/\n|<br\s*\/?>/i).map((s: string) => strip(s).trim()).filter(Boolean);

  const blockH = LH_PROF_EYEBROW + GAP_PROF_EYEBROW_NAME + LH_PROF_NAME + GAP_PROF_NAME_AFFIL
               + LH_PROF_AFFIL + GAP_PROF_AFFIL_BIO + LH_PROF_BIO * Math.max(1, bioLines.length);
  let y = coords.CY + Math.max(0, (coords.CH - blockH) / 2);

  r.setFont(true,  T_PROF_EYEBROW); r.setColor(C_ACCENT);
  r.cell(bandW, LH_PROF_EYEBROW, eyebrowTxt.toUpperCase(), bandX, y, 'C');
  y += LH_PROF_EYEBROW + GAP_PROF_EYEBROW_NAME;

  r.setFont(true,  T_PROF_NAME); r.setColor(C_WHITE);
  r.cell(bandW, LH_PROF_NAME, nameTxt, bandX, y, 'C');
  y += LH_PROF_NAME + GAP_PROF_NAME_AFFIL;

  r.setFont(false, T_PROF_AFFIL); r.setColor(C_ACCENT);   // CSS: var(--accent-color)
  r.cell(bandW, LH_PROF_AFFIL, affilTxt, bandX, y, 'C');
  y += LH_PROF_AFFIL + GAP_PROF_AFFIL_BIO;

  r.setFont(false, T_PROF_BIO); r.setColor(C_MUTED);
  for (const line of bioLines) {
    r.cell(bandW, LH_PROF_BIO, line, bandX, y, 'C');
    y += LH_PROF_BIO;
  }
}

function renderContactSlide(ctx: RenderCtx) {
  const { r, data, coords, colors, sizes } = ctx;
  const { C_BG, C_ACCENT, C_WHITE, C_BODY } = colors;
  const {
    T_CONT_THANKS, T_CONT_LINE, T_CONT_NOTE,
    LH_CONT_THANKS, LH_CONT_LINE, LH_CONT_NOTE,
    GAP_CONT_THANKS_LINE, GAP_CONT_LINE_NOTE,
  } = sizes;

  r.fillRect(0, 0, coords.CW, coords.CH, C_BG);   // full-bleed surface, no header strip

  const bandW = coords.CW * 0.80;                 // centered 80% band (HTML centers everything)
  const bandX = coords.CX + (coords.CW - bandW) / 2;

  const thanks = strip(data.title);
  const name   = strip(data.contactName);
  const email  = strip(data.contactEmail);
  const linkedin = strip(data.contactLinkedIn);
  const note   = strip(data.contactNote);
  const nLines = (name ? 1 : 0) + (email ? 1 : 0) + (linkedin ? 1 : 0) || 1;

  r.setFont(false, T_CONT_NOTE);
  const noteLines = note ? Math.max(1, r.wrapText(note, bandW).length) : 1;

  // Vertically center the whole contact group, then stack with measured gaps.
  const blockH = LH_CONT_THANKS + GAP_CONT_THANKS_LINE + LH_CONT_LINE * nLines + GAP_CONT_LINE_NOTE + LH_CONT_NOTE * noteLines;
  let y = coords.CY + Math.max(0, (coords.CH - blockH) / 2);

  // "감사합니다" — WHITE bold (HTML .contact-thanks is white, not gold)
  r.setFont(true, T_CONT_THANKS); r.setColor(C_WHITE);
  r.cell(bandW, LH_CONT_THANKS, thanks, bandX, y, 'C');
  y += LH_CONT_THANKS + GAP_CONT_THANKS_LINE;

  // contact lines — secondary #CBD5E1 (C_BODY), regular weight
  r.setFont(false, T_CONT_LINE); r.setColor(C_BODY);
  if (name)     { r.cell(bandW, LH_CONT_LINE, name,     bandX, y, 'C'); y += LH_CONT_LINE; }
  if (email)    { r.cell(bandW, LH_CONT_LINE, email,    bandX, y, 'C'); y += LH_CONT_LINE; }
  if (linkedin) { r.cell(bandW, LH_CONT_LINE, linkedin, bandX, y, 'C'); y += LH_CONT_LINE; }

  // note / CTA — GOLD (HTML .contact-next is accent gold)
  y += GAP_CONT_LINE_NOTE;
  r.setFont(false, T_CONT_NOTE); r.setColor(C_ACCENT);
  r.multiCell(bandW, LH_CONT_NOTE, note, bandX, y, 'C');
}

async function renderStandardSlide(ctx: RenderCtx) {
  const { r, doc, data, n, total, imgDir, spec, coords, colors, sizes, declared, region } = ctx;
  const { C_DARK, C_ACCENT, C_MUTED, C_BORDER, C_WHITE, C_BODY, C_VIS_BG } = colors;
  const {
    T_SECT, T_NUM, T_TITLE, T_BUL, T_VIS_T, T_VIS_B,
    LH_TITLE, LH_BULLET, LH_BULLET_GAP, LH_VIS_TITLE, LH_VIS_BODY,
  } = sizes;

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
  const totalBh  = r.estimateBulletHeight(bullets, bulTxtW - 6, T_BUL, LH_BULLET, LH_BULLET_GAP);
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
    r.drawEllipse(contentR.x, by + LH_BULLET * 0.28, 3.2, C_ACCENT);
    r.setFont(false, T_BUL); r.setColor(C_BODY);
    const afterBul = r.multiCell(bulTxtW - 6, LH_BULLET, txt, contentR.x + 6, by, 'L');
    by = afterBul + LH_BULLET_GAP;
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
      const vd = strip((visualDisplay ?? '').replace(/<br\s*\/?>/gi, '\n'));
      const gap = 5;
      // CSS-derived inner padding: read visual_inner_padding_px from spec (e.g. 24px for 1.5rem),
      // with a 2mm minimum floor for readability when CSS padding is 0.
      const visPad = Math.max(2, coords.px2mm(ctx.spec.visual_inner_padding_px ?? 0));
      const hVt = vt ? r.estimateTextHeight(vt, visR!.w - visPad * 2, T_VIS_T, LH_VIS_TITLE, true)  : 0;
      const hVb = vd ? r.estimateTextHeight(vd, visR!.w - visPad * 2, T_VIS_B, LH_VIS_BODY, false) : 0;
      const totalH = hVt + (vt && vd ? gap : 0) + hVb;
      let vy = visR!.y + visPad + Math.max(0, (visR!.h - visPad * 2 - totalH) / 2);
      if (vt) {
        r.setFont(true,  T_VIS_T); r.setColor(C_ACCENT);
        vy = r.multiCell(visR!.w - visPad * 2, LH_VIS_TITLE, vt, visR!.x + visPad, vy, 'L') + gap;
      }
      if (vd) {
        r.setFont(true, T_VIS_B); r.setColor(C_WHITE);
        r.multiCell(visR!.w - visPad * 2, LH_VIS_BODY, vd, visR!.x + visPad, vy, 'L');
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

// ── Unified CSS px → PDF size builder ─────────────────────────────────────────
//
// All font sizes and line heights are specified in CSS px (as rendered in the
// browser). A single ratio `font_px_to_pt` from calibration converts them to
// PDF pt (font sizes) or PDF mm (line heights/gaps).
//
// Legacy _pt keys (title_pt, bullet_pt, etc.) are auto-converted to CSS px
// using the inverse ratio, so existing layout_overrides remain compatible.

// ── Font + LineHeight + Gap sizes (all in PDF units) ──────────────────────────

interface FontSizes {
  // Font sizes (PDF pt)
  T_SECT: number;  T_NUM: number;  T_TITLE: number;  T_BUL: number;
  T_VIS_T: number;  T_VIS_B: number;
  T_TS_EYEBROW: number;  T_TS_TITLE: number;  T_TS_SUB: number;  T_TS_META: number;
  T_DIV_PART: number;  T_DIV_TITLE: number;  T_DIV_DESC: number;
  T_PUNCH_TAG: number;  T_PUNCH_MARK: number;  T_PUNCH_TEXT: number;  T_PUNCH_SUB: number;
  T_PROF_EYEBROW: number;  T_PROF_NAME: number;  T_PROF_AFFIL: number;  T_PROF_BIO: number;
  T_CONT_THANKS: number;  T_CONT_LINE: number;  T_CONT_NOTE: number;
  // Line heights (PDF mm)
  LH_TITLE: number;  LH_BULLET: number;  LH_BULLET_GAP: number;
  LH_VIS_TITLE: number;  LH_VIS_BODY: number;
  LH_TS_EYEBROW: number;  LH_TS_TITLE: number;  LH_TS_SUB: number;  LH_TS_META: number;
  LH_DIV_PART: number;  LH_DIV_TITLE: number;  LH_DIV_DESC: number;
  LH_PUNCH_TAG: number;  LH_PUNCH_MARK: number;  LH_PUNCH_TEXT: number;  LH_PUNCH_SUB: number;
  LH_PROF_EYEBROW: number;  LH_PROF_NAME: number;  LH_PROF_AFFIL: number;  LH_PROF_BIO: number;
  LH_CONT_THANKS: number;  LH_CONT_LINE: number;  LH_CONT_NOTE: number;
  // Gaps (PDF mm)
  GAP_TS_EYE_TTL: number;  GAP_TS_TTL_SUB: number;  GAP_TS_SUB_META: number;
  GAP_DIV_PART_TITLE: number;  GAP_DIV_TITLE_DESC: number;
  GAP_PUNCH_TAG_MARK: number;  GAP_PUNCH_MARK_TEXT: number;  GAP_PUNCH_TEXT_SUB: number;
  GAP_PROF_EYEBROW_NAME: number;  GAP_PROF_NAME_AFFIL: number;  GAP_PROF_AFFIL_BIO: number;
  GAP_CONT_THANKS_LINE: number;  GAP_CONT_LINE_NOTE: number;
}

function buildSizes(spec: LayoutSpec): FontSizes {
  const f = spec.fonts ?? {};
  const lh = spec.line_heights ?? {};
  const gp = spec.gaps_px ?? {};
  const mult = spec.calibration?.font_px_to_pt ?? 0.85;

  // CSS px → PDF pt
  const pt = (cssPx: number | undefined, fallback: number) =>
    ((cssPx ?? fallback) * mult);

  // CSS px → PDF mm (pt / MM_TO_PT)
  const mm = (cssPx: number | undefined, fallback: number) =>
    ((cssPx ?? fallback) * mult) / MM_TO_PT;

  // ── Legacy _pt → CSS px conversion ──
  // If a legacy _pt key exists but no corresponding _px key, convert it.
  const legacyPt2CssPx = (ptVal: number | undefined) =>
    ptVal !== undefined ? ptVal / mult : undefined;

  const sectionPx   = f.section_px   ?? legacyPt2CssPx(f.title_pt !== undefined || f.section_px !== undefined ? undefined : undefined) ?? 11.2;
  const titlePx     = f.title_px     ?? legacyPt2CssPx(f.title_pt) ?? 35.2;
  const bulletPx    = f.bullet_px    ?? legacyPt2CssPx(f.bullet_pt) ?? 15.2;
  const punchPx     = f.punchline_px ?? legacyPt2CssPx(f.punchline_pt) ?? 38.4;
  const punchSubPx  = f.punchline_sub_px ?? legacyPt2CssPx(f.punchline_sub_pt) ?? 16.0;
  const visTitlePx  = f.vis_title_px ?? legacyPt2CssPx(undefined) ?? 18.4;
  const visBodyPx   = f.vis_body_px  ?? legacyPt2CssPx(undefined) ?? 14.72;
  const tsEyebrowPx = f.ts_eyebrow_px ?? 12.8;
  const tsTitlePx   = f.ts_title_px  ?? 48.0;
  const tsSubPx     = f.ts_subtitle_px ?? 20.8;
  const tsMetaPx    = f.ts_meta_px   ?? 12.8;
  const divPartPx   = f.div_part_px  ?? 12.0;
  const divTitlePx  = f.div_title_px ?? legacyPt2CssPx(f.div_title_pt) ?? 36.8;
  const divDescPx   = f.div_desc_px  ?? legacyPt2CssPx(f.div_desc_pt) ?? 16.0;
  const slideNumPx  = f.slide_num_px ?? 11.2;

  return {
    // Font sizes (pt)
    T_SECT:          pt(sectionPx, 11.2),
    T_NUM:           pt(slideNumPx, 11.2),
    T_TITLE:         pt(titlePx, 35.2),
    T_BUL:           pt(bulletPx, 15.2),
    T_VIS_T:         pt(visTitlePx, 18.4),
    T_VIS_B:         pt(visBodyPx, 14.72),
    T_TS_EYEBROW:    pt(tsEyebrowPx, 12.8),
    T_TS_TITLE:      pt(tsTitlePx, 48.0),
    T_TS_SUB:        pt(tsSubPx, 20.8),
    T_TS_META:       pt(tsMetaPx, 12.8),
    T_DIV_PART:      pt(divPartPx, 12.0),
    T_DIV_TITLE:     pt(divTitlePx, 36.8),
    T_DIV_DESC:      pt(divDescPx, 16.0),
    T_PUNCH_TAG:     pt(f.punchline_sub_px ?? 12.0, 12.0),
    T_PUNCH_MARK:    pt(57.6, 57.6),
    T_PUNCH_TEXT:    pt(punchPx, 38.4),
    T_PUNCH_SUB:     pt(punchSubPx, 16.0),
    T_PROF_EYEBROW:  pt(12.0, 12.0),
    T_PROF_NAME:     pt(44.8, 44.8),
    T_PROF_AFFIL:    pt(17.6, 17.6),
    T_PROF_BIO:      pt(16.0, 16.0),
    T_CONT_THANKS:   pt(41.6, 41.6),
    T_CONT_LINE:     pt(15.2, 15.2),
    T_CONT_NOTE:     pt(14.08, 14.08),
    // Line heights (mm)
    LH_TITLE:         mm(lh.title_px, 42.24),
    LH_BULLET:        mm(lh.bullet_px, 22.8),
    LH_BULLET_GAP:    mm(lh.bullet_gap_px, 15.2),
    LH_VIS_TITLE:     mm(lh.vis_title_px, 23.92),
    LH_VIS_BODY:      mm(lh.vis_body_px, 24.32),
    LH_TS_EYEBROW:    mm(lh.ts_eyebrow_px, 16.0),
    LH_TS_TITLE:      mm(lh.ts_title_px, 55.2),
    LH_TS_SUB:        mm(lh.ts_subtitle_px, 33.28),
    LH_TS_META:       mm(lh.ts_meta_px, 19.2),
    LH_DIV_PART:      mm(lh.div_part_px, 16.0),
    LH_DIV_TITLE:     mm(lh.div_title_px, 44.16),
    LH_DIV_DESC:      mm(lh.div_desc_px, 25.6),
    LH_PUNCH_TAG:     mm(lh.punch_tag_px, 16.0),
    LH_PUNCH_MARK:    mm(lh.punch_mark_px, 28.8),
    LH_PUNCH_TEXT:    mm(lh.punch_text_px, 55.68),
    LH_PUNCH_SUB:     mm(lh.punch_sub_px, 27.2),
    LH_PROF_EYEBROW:  mm(lh.prof_eyebrow_px, 18.0),
    LH_PROF_NAME:     mm(lh.prof_name_px, 55.2),
    LH_PROF_AFFIL:    mm(lh.prof_affil_px, 28.0),
    LH_PROF_BIO:      mm(lh.prof_bio_px, 27.2),
    LH_CONT_THANKS:   mm(lh.cont_thanks_px, 49.92),
    LH_CONT_LINE:     mm(lh.cont_line_px, 24.0),
    LH_CONT_NOTE:     mm(lh.cont_note_px, 22.4),
    // Gaps (mm)
    GAP_TS_EYE_TTL:       mm(gp.ts_eye_ttl_px, 24.0),
    GAP_TS_TTL_SUB:       mm(gp.ts_ttl_sub_px, 24.0),
    GAP_TS_SUB_META:      mm(gp.ts_sub_meta_px, 24.0),
    GAP_DIV_PART_TITLE:   mm(gp.div_part_title_px, 24.0),
    GAP_DIV_TITLE_DESC:   mm(gp.div_title_desc_px, 24.0),
    GAP_PUNCH_TAG_MARK:   mm(gp.punch_tag_mark_px, 24.0),
    GAP_PUNCH_MARK_TEXT:  mm(gp.punch_mark_text_px, 24.0),
    GAP_PUNCH_TEXT_SUB:   mm(gp.punch_text_sub_px, 24.0),
    GAP_PROF_EYEBROW_NAME: mm(gp.prof_eyebrow_name_px, 16.0),
    GAP_PROF_NAME_AFFIL:   mm(gp.prof_name_affil_px, 8.0),
    GAP_PROF_AFFIL_BIO:    mm(gp.prof_affil_bio_px, 32.0),
    GAP_CONT_THANKS_LINE:  mm(gp.cont_thanks_line_px, 32.0),
    GAP_CONT_LINE_NOTE:    mm(gp.cont_line_note_px, 32.0),
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

  // Helper: round to 1 decimal place
  const r1 = (n: number) => Math.round(n * 10) / 10;

  // Read font_px_to_pt from theme spec (default 0.85)
  const themeSpecPath = resolve(workspaceRoot, `docs/html-themes/themes/${theme}/pdf_layout_spec.json`);
  let fontPxToPt = 0.85;
  if (existsSync(themeSpecPath)) {
    const spec = JSON.parse(readFileSync(themeSpecPath, 'utf-8'));
    fontPxToPt = spec.calibration?.font_px_to_pt ?? 0.85;
  }

  // Helper: CSS px → PDF mm (same formula as buildSizes mm())
  const cssPxToMm = (cssPx: number) => (cssPx * fontPxToPt) / MM_TO_PT;
  // Helper: CSS px → PDF pt
  const cssPxToPt = (cssPx: number) => cssPx * fontPxToPt;

  // Extract relevant CSS values
  const titleFontSize   = remToPx(cssVars['font-size-title'] ?? '2rem');        // ~32px
  const subtitleFontSize = remToPx(cssVars['font-size-subtitle'] ?? '1.3rem');  // ~20.8px
  const bodyFontSize    = remToPx(cssVars['font-size-body'] ?? '1rem');         // 16px
  const sectionFontSize = remToPx(cssVars['font-size-section'] ?? '0.7rem');    // ~11.2px
  const bulletGap       = remToPx(cssVars['bullet-gap'] ?? '0.6rem');           // ~9.6px
  const lineHeightBody  = parseFloat(cssVars['line-height-body'] ?? '1.65');     // 1.65
  const lineHeightTitle = parseFloat(cssVars['line-height-title'] ?? '1.2');      // 1.2

  console.log(`\n📐 Auto-Calibrate: ${theme} theme, ${style} style`);
  console.log(`   font_px_to_pt: ${fontPxToPt}\n`);

  console.log('   CSS values read:');
  console.log(`     --font-size-title:    ${cssVars['font-size-title'] ?? '2rem'} = ${titleFontSize}px`);
  console.log(`     --font-size-subtitle: ${cssVars['font-size-subtitle'] ?? '1.3rem'} = ${subtitleFontSize}px`);
  console.log(`     --font-size-body:     ${cssVars['font-size-body'] ?? '1rem'} = ${bodyFontSize}px`);
  console.log(`     --font-size-section:  ${cssVars['font-size-section'] ?? '0.7rem'} = ${sectionFontSize}px`);
  console.log(`     --bullet-gap:         ${cssVars['bullet-gap'] ?? '0.6rem'} = ${bulletGap}px`);
  console.log(`     --line-height-body:   ${lineHeightBody}`);
  console.log(`     --line-height-title:  ${lineHeightTitle}`);
  console.log('');

  // ── Compute CSS px font sizes ──
  // All values are in CSS px — the same unit used in pdf_layout_spec.json fonts.*_px
  const fonts = {
    title_px:     r1(titleFontSize),                          // 32.0
    bullet_px:    r1(bodyFontSize),                            // 16.0
    section_px:   r1(sectionFontSize),                         // 11.2
    div_title_px: r1(titleFontSize * 1.1),                    // 35.2
    div_desc_px:  r1(subtitleFontSize),                        // 20.8
    punchline_px: r1(titleFontSize * 1.2),                     // 38.4
    punchline_sub_px: r1(bodyFontSize),                        // 16.0
  };

  // ── Compute CSS px line heights (font-size × line-height-ratio) ──
  const lineHeights = {
    title_px:       r1(titleFontSize * lineHeightTitle),          // 38.4
    bullet_px:      r1(bodyFontSize * lineHeightBody),            // 26.4
    bullet_gap_px:  r1(bulletGap),                                // 9.6
    div_title_px:   r1(titleFontSize * 1.1 * lineHeightTitle),    // 42.2
    div_desc_px:    r1(subtitleFontSize * lineHeightBody),        // 34.3
  };

  // ── Compute CSS px gaps ──
  const gaps = {
    bullet_gap_px: r1(bulletGap),                                 // 9.6
  };

  console.log('   Estimated layout_overrides for lecture-profile.md:');
  console.log('   ─────────────────────────────────────────────────');

  const yaml = [
    '  layout_overrides:',
    '    fonts:',
    `      title_px: ${fonts.title_px}`,
    `      bullet_px: ${fonts.bullet_px}`,
    `      section_px: ${fonts.section_px}`,
    `      div_title_px: ${fonts.div_title_px}`,
    `      div_desc_px: ${fonts.div_desc_px}`,
    `      punchline_px: ${fonts.punchline_px}`,
    `      punchline_sub_px: ${fonts.punchline_sub_px}`,
    '    line_heights:',
    `      title_px: ${lineHeights.title_px}`,
    `      bullet_px: ${lineHeights.bullet_px}`,
    `      bullet_gap_px: ${lineHeights.bullet_gap_px}`,
    `      div_title_px: ${lineHeights.div_title_px}`,
    `      div_desc_px: ${lineHeights.div_desc_px}`,
    '    gaps_px:',
    `      bullet_gap_px: ${gaps.bullet_gap_px}`,
  ];
  for (const line of yaml) console.log(line);

  // ── Validation: line_mm must exceed font_mm ──
  console.log('');
  console.log('   Validation (CSS px → PDF mm via font_px_to_pt):');

  const checks = [
    { name: 'title',  fontPx: fonts.title_px,  lhPx: lineHeights.title_px },
    { name: 'bullet', fontPx: fonts.bullet_px,  lhPx: lineHeights.bullet_px },
  ];
  let allOk = true;
  for (const c of checks) {
    const fontMm = cssPxToMm(c.fontPx);
    const lineMm = cssPxToMm(c.lhPx);
    const ok = lineMm > fontMm;
    if (!ok) allOk = false;
    console.log(`     ${c.name}:   font_mm=${fontMm.toFixed(2)}, line_mm=${lineMm.toFixed(2)} ${ok ? '✅' : '❌ (line < font!)'}`);
  }

  if (!allOk) {
    console.log('\n   ⚠️  Validation failed — line heights too small for font sizes.');
    console.log('   Increase line_heights values above or decrease fonts.');
  }

  console.log('\n   💡 Copy the YAML block above into your lecture-profile.md frontmatter.');
  console.log('   All values are in CSS px; PDF conversion uses font_px_to_pt ratio.');
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
  const sizes  = buildSizes(layoutSpec);

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

  // CJK fallback font families: used when primary font lacks glyphs (e.g. 한자).
  // Variable fonts (.ttf with fvar table) are supported by pdf-lib/fontkit.
  const CJK_FALLBACK_FONTS: Array<[string, string]> = [
    ['NotoSansKR-Regular.ttf', 'NotoSansKR-Bold.ttf'],
    ['NotoSansKR-VF.ttf',      'NotoSansKR-VF.ttf'],
    ['NotoSansKR.otf',         'NotoSansKR-Bold.otf'],
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

  // Resolve CJK fallback font (optional — best-effort, no error if not found)
  let cjkFontR = '', cjkFontB = '';
  for (const [r, b] of CJK_FALLBACK_FONTS) {
    // For variable fonts where regular == bold (same file), check that at least regular exists
    const rExists = (dir: string) => existsSync(join(dir, r));
    const bExists = (dir: string) => existsSync(join(dir, b));
    for (const dir of [fontDir, ...sysFontDirs]) {
      if (r === b) {
        // Same file for regular and bold (variable font)
        if (rExists(dir)) { cjkFontR = join(dir, r); cjkFontB = cjkFontR; break; }
      } else if (rExists(dir) && bExists(dir)) {
        cjkFontR = join(dir, r); cjkFontB = join(dir, b); break;
      }
    }
    if (cjkFontR) break;
  }
  if (cjkFontR) {
    console.log(`CJK fallback font: ${cjkFontR}`);
  } else {
    console.log('CJK fallback font: none found (한자 glyphs may not render)');
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

  // Embed CJK fallback font (optional)
  let cjkRegularFont: PDFFont | null = null;
  let cjkBoldFont: PDFFont | null = null;
  if (cjkFontR) {
    try {
      cjkRegularFont = await pdfDoc.embedFont(readFileSync(cjkFontR));
      if (cjkFontB && cjkFontB !== cjkFontR) {
        cjkBoldFont = await pdfDoc.embedFont(readFileSync(cjkFontB));
      } else {
        cjkBoldFont = cjkRegularFont;  // variable font: same file for both weights
      }
    } catch (e: any) {
      console.warn(`CJK fallback font embed failed: ${e.message}`);
    }
  }

  // Build missing-code-point set: scan primary font for characters that the
  // fallback font CAN render but primary CANNOT. This avoids calling
  // hasGlyphForCodePoint per-character at render time.
  const missingCps = new Set<number>();
  if (cjkRegularFont) {
    try {
      const primaryFk  = fontkitCreate(readFileSync(fontR));
      const fallbackFk = fontkitCreate(readFileSync(cjkFontR));
      // Collect all code points from slidedata that are in fallback but not primary.
      // We scan all text fields once at startup.
      const allText = JSON.stringify(slideData);
      for (let i = 0; i < allText.length; i++) {
        const cp = allText.codePointAt(i);
        if (cp === undefined || cp < 0x20) continue;
        // Skip chars > 0xFFFF (surrogate pairs) — rare in Korean text
        if (cp > 0xFFFF) continue;
        if (fallbackFk.hasGlyphForCodePoint(cp) && !primaryFk.hasGlyphForCodePoint(cp)) {
          missingCps.add(cp);
        }
      }
      console.log(`CJK fallback: ${missingCps.size} code points missing in primary font`);
      if (missingCps.size > 0) {
        const sample = [...missingCps].slice(0, 5).map(cp => String.fromCodePoint(cp)).join('');
        console.log(`  Missing chars sample: ${sample}`);
      }
    } catch (e: any) {
      console.warn(`CJK glyph scan failed: ${e.message}`);
    }
  }

  const renderer = new Renderer(regularFont, boldFont, PW, PH, colors.C_WHITE, cjkRegularFont, cjkBoldFont, missingCps);

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

    if (type === 'title')          await renderTitleSlide(ctx);
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
