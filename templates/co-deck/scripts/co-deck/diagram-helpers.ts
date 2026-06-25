// @version 1.2.0 — Default canvas matches pitch-enhanced right-panel aspect ratio.
// Shared SVG utilities for diagram generation.
// Imported by each project's presentations/<project>/diagram-defs.ts.
// Do NOT add project-specific content here — keep this infrastructure-only.

import { existsSync } from 'node:fs';
import { join, homedir } from 'node:path';
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
