// @version 1.4.0
// v1.4.0 (2026-11-21, U-20261119-009 / design docs/designs/2026-11-20-co-deck-pipeline-batch-2-design.md §R3):
// svgLayoutSafetyIssues() — static layout-safety audit alongside svgMinFontSize:
// WARNs on negative-length segments (degenerate zero-length lines; axis-aligned
// lines whose endpoint precedes their start — the collapsed-gap artifact) and
// elements extending outside the viewBox (line/path/rect/circle/ellipse/text).
// Inter-node gap floors stay contract-only (agents/diagram-specialist.md) — node
// rects are generator-specific. Consumed by gen-visual-images' non-fatal WARN.
// v1.3.2 (2026-11-16, U-20261116-002): svgMinFontSize() —
// smallest declared font-size in an SVG, consumed by gen-visual-images'
// legibility WARN (labels rendering under ~11px at 1280x720 bubble widths). — U-20261105-006: stripDiagramFooterText() + svgTextDuplicatesSlide()
// v1.3.1 (2026-11-15, spec docs/designs/2026-11-15-co-deck-deliverables-migration-design.md): doc-only — usage comments and path constants follow the fleet's deliverables/ consolidation (presentations/ → deliverables/); no logic change.
// (SVGs must not embed caption/takeaway/source lines — slidedata visualCaption /
// visualSource own them; deterministic dedup audit for bullet echoes).
// Prior 1.2.0: default canvas matches pitch-enhanced right-panel aspect ratio.
// Shared SVG utilities for diagram generation.
// Imported by each project's deliverables/<project>/diagram-defs.ts and by
// gen-visual-images.ts (which runs the strip + audit after every generator).
// Do NOT add project-specific content here — keep this infrastructure-only.

import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { platform } from 'node:os';
import { Resvg } from '@resvg/resvg-js';

// Default canvas dimensions. Match the pitch-enhanced .right-panel aspect ratio
// (0.85fr column in a 16:9 slide with padding). Diagram-defs.ts may override
// by passing explicit w/h to svgWrap(). Previous values W=420 H=470 produced
// near-square diagrams that got heavily cropped by object-fit:cover.
export const W = 380, H = 520;

// ── OS-aware Korean font discovery ─────────────────────────────────────────────
// Searches system font directories + user font directories per platform.
// Order matters: earlier entries are preferred.

const systemFontCandidates: string[] = (() => {
  const p = platform();
  const home = homedir();
  const candidates: string[] = [];

  if (p === 'win32') {
    const winFonts = 'C:/Windows/Fonts';
    candidates.push(
      join(winFonts, 'Pretendard-Regular.ttf'),
      join(winFonts, 'MaruBuri-Regular.ttf'),
      join(winFonts, 'malgun.ttf'),
      join(winFonts, 'Malgun Gothic.ttf'),
      join(winFonts, 'HANDotum.ttf'),
      join(winFonts, 'NanumGothic.ttf'),
    );
  } else if (p === 'darwin') {
    candidates.push(
      join(home, 'Library/Fonts/Pretendard-Regular.ttf'),
      join(home, 'Library/Fonts/MaruBuri-Regular.ttf'),
      '/Library/Fonts/Pretendard-Regular.ttf',
      '/Library/Fonts/AppleSDGothicNeo-Regular.otf',
      '/System/Library/Fonts/PingFang.ttc',
      join(home, 'Library/Fonts/NanumGothic.ttf'),
    );
  } else {
    // Linux
    candidates.push(
      join(home, '.local/share/fonts/Pretendard-Regular.ttf'),
      join(home, '.local/share/fonts/MaruBuri-Regular.ttf'),
      '/usr/share/fonts/truetype/nanum/NanumGothic.ttf',
      '/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc',
      '/usr/share/fonts/truetype/noto/NotoSansCJK-Regular.ttc',
    );
  }

  return candidates;
})();

export const fontPath = systemFontCandidates.find(existsSync);

export function svgToPng(svg: string): Buffer {
  const opts: Record<string, any> = { fitTo: { mode: 'original' } };
  if (fontPath) opts.font = { fontFiles: [fontPath], loadSystemFonts: false };
  const resvg = new Resvg(svg, opts);
  return Buffer.from(resvg.render().asPng());
}

export function svgWrap(inner: string, bg = '#0F172A', w = W, h = H): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <rect width="${w}" height="${h}" fill="${bg}"/>
  <style>
    text { font-family: "Malgun Gothic", "HAN Dotum", "Nanum Gothic", sans-serif; }
  </style>
  ${inner}
</svg>`;
}

export function wrapText(text: string, maxChars: number): string[] {
  if (text.length <= maxChars) return [text];
  const breakPoints = [' — ', ' ', '—', '·'];
  for (const bp of breakPoints) {
    const idx = text.indexOf(bp, Math.floor(maxChars * 0.4));
    if (idx > 0 && idx <= maxChars + bp.length) {
      const first = text.slice(0, idx + (bp === ' ' ? 0 : bp.length));
      const rest  = text.slice(idx + (bp === ' ' ? 1 : bp.length));
      return [first.trim(), ...wrapText(rest.trim(), maxChars)];
    }
  }
  return [text.slice(0, maxChars), ...wrapText(text.slice(maxChars), maxChars)];
}

// ── Caption/source dedup (U-20261105-006) ─────────────────────────────────────
// Single source of truth for caption/takeaway/source text is the slideData
// entry (visualCaption / visualSource) — html-build and the PDF render those.
// Generators that additionally draw caption/source lines into the SVG produce
// duplicated text on the slide; these helpers strip the footer lines
// deterministically and audit for bullet echoes.

const FOOTER_BAND_DEFAULT = 70;
// Footer text conventions seen in generator output (caption / source lines).
const CAPTION_SOURCE_PREFIXES = [
  '출처', 'Source', 'source', 'SOURCE',
  'Caption', 'caption', '캡션',
  'Takeaway', 'takeaway', '핵심 메시지',
];

function decodeSvgEntities(s: string): string {
  return s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'");
}

/** Normalize text for the duplication audit (port of the project dupcheck.py).
 * Unicode-aware: JS `\W` is ASCII-only, so Hangul/CJK must be kept explicitly. */
export function normalizeDiagramText(t: string): string {
  const stripped = decodeSvgEntities(t)
    .replace(/\[Source[^\]]*\]/g, '')
    .replace(/\*\*|`/g, '');
  return stripped.replace(/[^\p{L}\p{N}]+/gu, '');
}

function viewBoxHeight(svg: string): number {
  const m = svg.match(/viewBox="0 0 ([\d.]+) ([\d.]+)"/);
  return m ? parseFloat(m[2]) : NaN;
}

/**
 * Remove caption/takeaway/source <text> lines drawn into the SVG footer band
 * (port of the project's strip_caps.mjs, generalized). A text element is
 * stripped when BOTH hold:
 *   1. its baseline y is inside the bottom band (y >= viewBox height - band),
 *   2. its decoded content starts with a caption/source convention prefix,
 *      or its x matches one of the explicit footerXs (when provided).
 * The viewBox height is then re-fit to the remaining content (max text y + 16)
 * so the diagram does not ship dead space below the lowest surviving label.
 * Idempotent: running twice yields the same SVG.
 */
export function stripDiagramFooterText(
  svg: string,
  opts?: { band?: number; footerXs?: number[] },
): string {
  const band = opts?.band ?? FOOTER_BAND_DEFAULT;
  const footerXs = opts?.footerXs;
  const H = viewBoxHeight(svg);
  if (!Number.isFinite(H)) return svg;

  const kept: string[] = [];
  let maxY = 0;
  const textRe = /<text\b[^>]*>[^<]*<\/text>/g;
  let lastEnd = 0;
  let m: RegExpExecArray | null;
  while ((m = textRe.exec(svg)) !== null) {
    kept.push(svg.slice(lastEnd, m.index));
    lastEnd = m.index + m[0].length;
    const el = m[0];
    const yM = el.match(/ y="([\d.]+)"/);
    const xM = el.match(/ x="([\d.]+)"/);
    const y = yM ? parseFloat(yM[1]) : NaN;
    const x = xM ? parseFloat(xM[1]) : NaN;
    const content = decodeSvgEntities(el.replace(/^<text\b[^>]*>/, '').replace(/<\/text>$/, '')).trim();
    const inBand = Number.isFinite(y) && y >= H - band;
    const xHit = footerXs ? footerXs.some((fx) => x === fx) : false;
    const prefixHit = CAPTION_SOURCE_PREFIXES.some((p) => content.startsWith(p));
    if (inBand && (xHit || prefixHit)) continue; // drop the footer line
    kept.push(el);
    if (Number.isFinite(y)) {
      const fsM = el.match(/font-size="([\d.]+)"/);
      maxY = Math.max(maxY, y + (fsM ? parseFloat(fsM[1]) : 16));
    }
  }
  kept.push(svg.slice(lastEnd));

  let out = kept.join('');
  const nh = Math.ceil(maxY + 16);
  if (Number.isFinite(nh) && nh > 0 && nh < H) {
    out = out
      .replace(/viewBox="0 0 ([\d.]+) [\d.]+"/, `viewBox="0 0 $1 ${nh}"`)
      .replace(/(<svg\b[^>]*?) height="[\d.]+"/, `$1 height="${nh}"`);
  }
  return out;
}

export interface DiagramDupHit {
  kind: 'caption' | 'source' | 'bullet';
  text: string;
}

/**
 * Audit whether the SVG's text echoes the slide's own caption, source or
 * bullets (port of the project's dupcheck.py). Returns one hit per duplicated
 * item — the caller (gen-visual-images.ts) reports them as WARNs; the diagram
 * agent must regenerate rather than hand-strip content labels.
 */
export function svgTextDuplicatesSlide(
  svg: string,
  slide: { visualCaption?: string; visualSource?: string; bullets?: string[] },
): DiagramDupHit[] {
  const svgText = normalizeDiagramText(
    Array.from(svg.matchAll(/<text\b[^>]*>([^<]*)<\/text>/g)).map((mm) => mm[1]).join(' '),
  );
  const items: DiagramDupHit[] = [];
  if (slide.visualCaption) items.push({ kind: 'caption', text: slide.visualCaption });
  if (slide.visualSource) items.push({ kind: 'source', text: slide.visualSource });
  for (const b of slide.bullets ?? []) items.push({ kind: 'bullet', text: b });
  const hits: DiagramDupHit[] = [];
  for (const it of items) {
    const norm = normalizeDiagramText(it.text);
    if (it.text && norm.length >= 8 && svgText.includes(norm.slice(0, 14))) {
      hits.push(it);
    }
  }
  return hits;
}

// ── Colour palettes ───────────────────────────────────────────────────────────

export const DARK_AMBER = {
  BG:        '#0F172A',
  ACCENT:    '#D97706',
  ACCENT_L:  '#FCD34D',
  TEXT:      '#F1F5F9',
  TEXT_M:    'rgba(241,245,249,0.55)',
  BORDER:    'rgba(255,255,255,0.14)',
  RED_BG:    'rgba(248,113,113,0.10)',
  RED_BORD:  'rgba(248,113,113,0.35)',
  RED_TEXT:  '#FCA5A5',
  AMBER_BG:  'rgba(217,119,6,0.10)',
  AMBER_BOR: 'rgba(217,119,6,0.40)',
  CARD_BG:   'rgba(255,255,255,0.035)',
};

export const B2B_NAVY = {
  BG:      '#141C2A',
  ACCENT:  '#D97706',
  ACCENT_L:'#FCD34D',
  TEXT_P:  '#E2E8F0',
  TEXT_S:  '#CBD5E1',
  TEXT_M:  '#9CA3AF',
  BORDER:  '#1F2937',
};

/**
 * Smallest font-size declared in the SVG (U-20261116-002). Text without an
 * explicit font-size inherits the SVG default (16) and is not counted — the
 * audit targets labels the generator sized down.
 */
export function svgMinFontSize(svg: string): number | null {
  let min: number | null = null;
  const re = /font-size="([\d.]+)"/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(svg)) !== null) {
    const v = parseFloat(m[1]);
    if (Number.isFinite(v) && (min === null || v < min)) min = v;
  }
  return min;
}

// ── Layout-safety audit (U-20261119-009) ──────────────────────────────────────
// The deck defect this guards: a generator computed inter-node gaps as leftover
// space, gaps collapsed to 1.5–7.5px, and connector lines were emitted with the
// endpoint BEFORE the start along the flow axis (negative-length arrows) plus
// nodes pushed outside the viewBox. Static, lintable proxies below — no node
// geometry knowledge required (gap floors themselves stay contract-only, see
// agents/diagram-specialist.md — node rects are generator-specific).

export interface DiagramLayoutIssue {
  kind: 'negative-segment' | 'outside-viewbox';
  el: string;
  detail: string;
}

// Tolerance for float noise in emitted coordinates (e.g. 380.000000000004).
const LAYOUT_EPS = 0.01;

interface Bounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

function parseViewBox(svg: string): Bounds | null {
  const m = svg.match(/viewBox="\s*([-\d.eE+]+)[\s,]+([-\d.eE+]+)[\s,]+([\d.eE+]+)[\s,]+([\d.eE+]+)\s*"/);
  if (!m) return null;
  const [minX, minY, w, h] = [parseFloat(m[1]), parseFloat(m[2]), parseFloat(m[3]), parseFloat(m[4])];
  if (![minX, minY, w, h].every(Number.isFinite) || w <= 0 || h <= 0) return null;
  return { minX, minY, maxX: minX + w, maxY: minY + h };
}

function attrNum(attrs: string, name: string): number {
  const m = attrs.match(new RegExp(`${name}="\\s*([-\\d.eE+]+)`));
  return m ? parseFloat(m[1]) : NaN;
}

function fmt(n: number): string {
  return String(Math.round(n * 100) / 100);
}

/** Parse an SVG path `d` into drawn segments (straight segment endpoints per
 * command; curves contribute their endpoints only — control points are not
 * bounds-checked to keep false positives low on decorative curves). */
function pathPoints(d: string): Array<{ x: number; y: number; drawn: boolean }> {
  const tokens = d.match(/[MmLlHhVvCcSsQqTtAaZz]|[-\d.eE+]+/g) ?? [];
  const pts: Array<{ x: number; y: number; drawn: boolean }> = [];
  const isCmd = (t: string) => /^[MmLlHhVvCcSsQqTtAaZz]$/.test(t);
  let cx = NaN, cy = NaN, cmd = '';
  let i = 0;
  const num = () => parseFloat(tokens[i++]);
  while (i < tokens.length) {
    const t = tokens[i];
    if (isCmd(t)) {
      cmd = t; i++;
      if (cmd === 'Z' || cmd === 'z') continue;
    } else if (cmd === '') {
      i++; // stray number before any command — skip
      continue;
    }
    const rel = cmd === cmd.toLowerCase();
    const U = cmd.toUpperCase();
    // Parameter count per command (A: rx ry rot laf sf x y).
    const count: Record<string, number> = { M: 2, L: 2, H: 1, V: 1, C: 6, S: 4, Q: 4, T: 2, A: 7 }[U] ?? 0;
    if (count === 0) { i++; continue; }
    // Repeat-group support: trailing numbers repeat the last command.
    const args: number[] = [];
    for (let k = 0; k < count && i < tokens.length && !isCmd(tokens[i]); k++) args.push(num());
    if (args.length < count) break;
    let px = cx, py = cy, dx = 0, dy = 0, drawn = true;
    if (U === 'H') { dx = args[0]; py = cy; }
    else if (U === 'V') { px = cx; dy = args[0]; }
    else { dx = args[args.length - 2]; dy = args[args.length - 1]; }
    px = (Number.isFinite(px) && rel ? px + dx : dx);
    py = (Number.isFinite(py) && rel ? py + dy : dy);
    if (U === 'M') drawn = false; // moveto: no segment drawn to this point
    pts.push({ x: px, y: py, drawn });
    cx = px; cy = py;
    if (U === 'M') cmd = rel ? 'l' : 'L'; // implicit lineto after moveto
  }
  return pts;
}

/**
 * Static layout-safety audit for a generated diagram SVG (U-20261119-009).
 * Returns one issue per finding; the caller (gen-visual-images.ts) reports
 * them as non-fatal WARNs — the diagram agent regenerates rather than ships.
 *
 * Flags:
 *   1. negative-segment — degenerate zero-length segments, axis-aligned
 *      `<line>` connectors whose endpoint precedes their start along the
 *      drawing axis, and rects/circles/ellipses with negative radius/extent.
 *   2. outside-viewbox — any coordinate of a line/path/rect/circle/ellipse/
 *      text element outside the viewBox.
 *
 * Known limits (documented, WARN-only): element transforms are not resolved —
 * generators in this pipeline emit absolute coordinates; curve control points
 * are not bounds-checked; the axis-aligned backward check applies to `<line>`
 * only (shape outlines legitimately travel both directions along an edge).
 */
export function svgLayoutSafetyIssues(svg: string): DiagramLayoutIssue[] {
  const issues: DiagramLayoutIssue[] = [];
  const vb = parseViewBox(svg);
  const outOf = (x: number, y: number): boolean =>
    vb !== null && (x < vb.minX - LAYOUT_EPS || x > vb.maxX + LAYOUT_EPS || y < vb.minY - LAYOUT_EPS || y > vb.maxY + LAYOUT_EPS);
  const vbLabel = vb ? `viewBox [${fmt(vb.minX)},${fmt(vb.maxX)}]×[${fmt(vb.minY)},${fmt(vb.maxY)}]` : 'viewBox';

  const elRe = /<(line|path|rect|circle|ellipse|text)\b([^>]*)>/g;
  let m: RegExpExecArray | null;
  while ((m = elRe.exec(svg)) !== null) {
    const el = m[1];
    const attrs = m[2];

    if (el === 'line') {
      const [x1, y1, x2, y2] = [attrNum(attrs, 'x1'), attrNum(attrs, 'y1'), attrNum(attrs, 'x2'), attrNum(attrs, 'y2')];
      if (![x1, y1, x2, y2].every(Number.isFinite)) continue;
      const dx = x2 - x1, dy = y2 - y1;
      if (dx === 0 && dy === 0) {
        issues.push({ kind: 'negative-segment', el, detail: `line (${fmt(x1)},${fmt(y1)})→(${fmt(x2)},${fmt(y2)}): zero-length segment — gap math collapsed` });
      } else if ((dx === 0 && dy < 0) || (dy === 0 && dx < 0)) {
        issues.push({ kind: 'negative-segment', el, detail: `line (${fmt(x1)},${fmt(y1)})→(${fmt(x2)},${fmt(y2)}): axis-aligned segment points backward — endpoint before start` });
      }
      if (outOf(x1, y1) || outOf(x2, y2)) {
        issues.push({ kind: 'outside-viewbox', el, detail: `line (${fmt(x1)},${fmt(y1)})→(${fmt(x2)},${fmt(y2)}) outside ${vbLabel}` });
      }
    } else if (el === 'path') {
      const dM = attrs.match(/ d="([^"]*)"/);
      if (!dM) continue;
      const pts = pathPoints(dM[1]);
      let prev: { x: number; y: number } | null = null;
      let outside = false;
      for (const p of pts) {
        if (outOf(p.x, p.y)) outside = true;
        if (prev !== null && p.drawn && p.x === prev.x && p.y === prev.y) {
          issues.push({ kind: 'negative-segment', el, detail: `path zero-length segment at (${fmt(p.x)},${fmt(p.y)}) — gap math collapsed` });
        }
        prev = { x: p.x, y: p.y };
      }
      if (outside) {
        issues.push({ kind: 'outside-viewbox', el, detail: `path d="${dM[1].slice(0, 60)}…" has points outside ${vbLabel}` });
      }
    } else if (el === 'rect') {
      const x = attrNum(attrs, 'x'), y = attrNum(attrs, 'y');
      const w = attrNum(attrs, 'width'), h = attrNum(attrs, 'height');
      if (!Number.isFinite(w) || !Number.isFinite(h)) continue;
      const rx = Number.isFinite(x) ? x : 0, ry = Number.isFinite(y) ? y : 0;
      if (w < 0 || h < 0) {
        issues.push({ kind: 'negative-segment', el, detail: `rect ${fmt(w)}×${fmt(h)} at (${fmt(rx)},${fmt(ry)}): negative extent` });
      } else if (vb && (rx < vb.minX - LAYOUT_EPS || ry < vb.minY - LAYOUT_EPS || rx + w > vb.maxX + LAYOUT_EPS || ry + h > vb.maxY + LAYOUT_EPS)) {
        issues.push({ kind: 'outside-viewbox', el, detail: `rect (${fmt(rx)},${fmt(ry)}) ${fmt(w)}×${fmt(h)} outside ${vbLabel}` });
      }
    } else if (el === 'circle' || el === 'ellipse') {
      const cx = attrNum(attrs, 'cx'), cy = attrNum(attrs, 'cy');
      const rxE = el === 'circle' ? attrNum(attrs, 'r') : attrNum(attrs, 'rx');
      const ryE = el === 'circle' ? attrNum(attrs, 'r') : attrNum(attrs, 'ry');
      if (![cx, cy, rxE, ryE].every(Number.isFinite)) continue;
      if (rxE < 0 || ryE < 0) {
        issues.push({ kind: 'negative-segment', el, detail: `${el} radius ${fmt(rxE)}×${fmt(ryE)} at (${fmt(cx)},${fmt(cy)}): negative radius` });
      } else if (vb && (cx - rxE < vb.minX - LAYOUT_EPS || cy - ryE < vb.minY - LAYOUT_EPS || cx + rxE > vb.maxX + LAYOUT_EPS || cy + ryE > vb.maxY + LAYOUT_EPS)) {
        issues.push({ kind: 'outside-viewbox', el, detail: `${el} (${fmt(cx)},${fmt(cy)}) r ${fmt(rxE)}×${fmt(ryE)} outside ${vbLabel}` });
      }
    } else if (el === 'text') {
      const x = attrNum(attrs, 'x'), y = attrNum(attrs, 'y');
      if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
      if (outOf(x, y)) {
        issues.push({ kind: 'outside-viewbox', el, detail: `text at (${fmt(x)},${fmt(y)}) outside ${vbLabel}` });
      }
    }
  }
  return issues;
}
