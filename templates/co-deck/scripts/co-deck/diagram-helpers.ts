// @version 1.3.0 — U-20261105-006: stripDiagramFooterText() + svgTextDuplicatesSlide()
// (SVGs must not embed caption/takeaway/source lines — slidedata visualCaption /
// visualSource own them; deterministic dedup audit for bullet echoes).
// Prior 1.2.0: default canvas matches pitch-enhanced right-panel aspect ratio.
// Shared SVG utilities for diagram generation.
// Imported by each project's presentations/<project>/diagram-defs.ts and by
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
