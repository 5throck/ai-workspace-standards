/**
 * diagram-helpers.ts caption/source dedup pins (U-20261105-006).
 *
 * SVGs must not embed caption/takeaway/source lines — slidedata
 * visualCaption / visualSource own that text (html-build + PDF render it).
 * Pins: stripDiagramFooterText removes footer-band caption/source lines and
 * re-fits the viewBox, is idempotent, and keeps content labels;
 * svgTextDuplicatesSlide flags echoes of the slide's caption/source/bullets.
 *
 * @version 1.0.0
 */
import { describe, expect, test } from 'bun:test';
import {
  normalizeDiagramText,
  stripDiagramFooterText,
  svgTextDuplicatesSlide,
} from '../diagram-helpers.ts';

function svgWith(texts: Array<{ x: number; y: number; s: string; fs?: number }>, h = 520, w = 380): string {
  const body = texts
    .map((t) => `<text x="${t.x}" y="${t.y}" font-size="${t.fs ?? 18}" fill="#fff">${t.s}</text>`)
    .join('\n  ');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <rect width="${w}" height="${h}" fill="#0F172A"/>
  ${body}
</svg>`;
}

describe('stripDiagramFooterText (U-20261105-006)', () => {
  test('strips footer-band source line and re-fits the viewBox', () => {
    const svg = svgWith([
      { x: 40, y: 200, s: '데이터 수집' },
      { x: 40, y: 300, s: '모델 학습' },
      { x: 40, y: 505, s: '출처: 한국IDC, 2025', fs: 12 },
    ]);
    const out = stripDiagramFooterText(svg);
    expect(out).not.toContain('출처: 한국IDC, 2025');
    expect(out).toContain('데이터 수집');
    expect(out).toContain('모델 학습');
    // viewBox re-fit: bottom content at y=300+18 -> ceil(318+16)=334
    expect(out).toMatch(/viewBox="0 0 380 334"/);
    expect(out).toMatch(/ height="334"/);
  });

  test('strips footer caption and takeaway prefixes', () => {
    const svg = svgWith([
      { x: 480, y: 500, s: 'Caption: 시장 규모 추이', fs: 12 },
      { x: 480, y: 515, s: 'Takeaway: AI 투자 가속', fs: 12 },
      { x: 40, y: 100, s: 'node' },
    ]);
    const out = stripDiagramFooterText(svg);
    expect(out).not.toContain('Caption: 시장 규모 추이');
    expect(out).not.toContain('Takeaway: AI 투자 가속');
    expect(out).toContain('node');
  });

  test('keeps content labels inside the footer band (no prefix match)', () => {
    const svg = svgWith([
      { x: 40, y: 490, s: '마지막 단계' },
    ]);
    const out = stripDiagramFooterText(svg);
    expect(out).toContain('마지막 단계');
  });

  test('is idempotent — second pass is byte-identical', () => {
    const svg = svgWith([
      { x: 40, y: 200, s: 'label' },
      { x: 40, y: 505, s: '출처: somewhere', fs: 12 },
    ]);
    const once = stripDiagramFooterText(svg);
    expect(stripDiagramFooterText(once)).toBe(once);
  });

  test('decodes entities before prefix matching', () => {
    const svg = svgWith([{ x: 40, y: 510, s: '출처: A &amp; B', fs: 12 }]);
    expect(stripDiagramFooterText(svg)).not.toContain('출처: A &amp; B');
  });

  test('non-SVG input passes through unchanged', () => {
    expect(stripDiagramFooterText('not an svg')).toBe('not an svg');
  });
});

describe('svgTextDuplicatesSlide (U-20261105-006)', () => {
  test('flags caption, source and bullet echoes', () => {
    const svg = svgWith([
      { x: 40, y: 100, s: 'AI 학습 사이클 4단계 구조' },
      { x: 40, y: 200, s: '출처: 한국IDC, 2025' },
      { x: 40, y: 300, s: '데이터 수집 → 모델 학습 → 배포 → 피드백 수집' },
    ]);
    const hits = svgTextDuplicatesSlide(svg, {
      visualCaption: 'AI 학습 사이클 4단계 구조',
      visualSource: '출처: 한국IDC, 2025',
      bullets: ['데이터 수집 → 모델 학습 → 배포 → 피드백 수집'],
    });
    expect(hits.map((h) => h.kind).sort()).toEqual(['bullet', 'caption', 'source']);
  });

  test('no hits when SVG text is independent of the slide text', () => {
    const svg = svgWith([{ x: 40, y: 100, s: 'stage label' }]);
    expect(
      svgTextDuplicatesSlide(svg, {
        visualCaption: '완전히 다른 캡션 텍스트입니다',
        bullets: ['슬라이드 불릿 내용'],
      }),
    ).toEqual([]);
  });

  test('short texts (<8 normalized chars) are exempt', () => {
    const svg = svgWith([{ x: 40, y: 100, s: 'ok' }]);
    expect(svgTextDuplicatesSlide(svg, { bullets: ['ok'] })).toEqual([]);
  });

  test('[Source ...] markers are ignored by normalization', () => {
    expect(normalizeDiagramText('[Source: 한국IDC]** 굵게 `코드`')).toBe('굵게코드');
  });
});
