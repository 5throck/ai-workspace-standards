/**
 * diagram-helpers.ts pins (U-20261105-006 caption/source dedup + U-20261119-009
 * layout-safety audit).
 *
 * SVGs must not embed caption/takeaway/source lines — slidedata
 * visualCaption / visualSource own that text (html-build + PDF render it).
 * Pins: stripDiagramFooterText removes footer-band caption/source lines and
 * re-fits the viewBox, is idempotent, and keeps content labels;
 * svgTextDuplicatesSlide flags echoes of the slide's caption/source/bullets;
 * svgLayoutSafetyIssues flags negative-length segments (zero-length runs,
 * axis-aligned lines pointing backward) and elements outside the viewBox.
 *
 * @version 1.1.0
 */
import { describe, expect, test } from 'bun:test';
import {
  normalizeDiagramText,
  stripDiagramFooterText,
  svgTextDuplicatesSlide,
  svgLayoutSafetyIssues,
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

describe('svgLayoutSafetyIssues (U-20261119-009)', () => {
  const svgOf = (inner: string, w = 560, h = 560): string =>
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${inner}</svg>`;

  test('clean SVG produces no issues', () => {
    const svg = svgOf(`
      <rect x="20" y="20" width="120" height="48" rx="8"/>
      <line x1="140" y1="44" x2="240" y2="44" stroke="#FCD34D" stroke-width="3"/>
      <circle cx="300" cy="300" r="60"/>
      <text x="30" y="500" font-size="22">라벨</text>
      <path d="M 40 100 L 140 100 L 140 160"/>
    `);
    expect(svgLayoutSafetyIssues(svg)).toEqual([]);
  });

  test('flags an axis-aligned line whose endpoint precedes its start', () => {
    // The collapsed-gap artifact: vertical connector pointing backward.
    const svg = svgOf('<line x1="100" y1="200" x2="100" y2="175"/>');
    const issues = svgLayoutSafetyIssues(svg);
    expect(issues).toHaveLength(1);
    expect(issues[0].kind).toBe('negative-segment');
    expect(issues[0].el).toBe('line');
    expect(issues[0].detail).toContain('backward');
  });

  test('flags a horizontal backward line and a zero-length line', () => {
    const svg = svgOf('<line x1="200" y1="50" x2="150" y2="50"/><line x1="80" y1="80" x2="80" y2="80"/>');
    const issues = svgLayoutSafetyIssues(svg);
    expect(issues.filter((i) => i.kind === 'negative-segment')).toHaveLength(2);
  });

  test('does NOT flag diagonals or free directions (fan/cycle layouts)', () => {
    const svg = svgOf('<line x1="280" y1="280" x2="100" y2="100"/><line x1="280" y1="280" x2="400" y2="120"/>');
    expect(svgLayoutSafetyIssues(svg)).toEqual([]);
  });

  test('flags zero-length path segments', () => {
    const svg = svgOf('<path d="M 40 100 L 40 100 L 140 100"/>');
    const issues = svgLayoutSafetyIssues(svg);
    expect(issues).toHaveLength(1);
    expect(issues[0].kind).toBe('negative-segment');
    expect(issues[0].el).toBe('path');
  });

  test('parses relative path commands and repeat groups', () => {
    const svg = svgOf('<path d="M 40 100 l 60 0 60 40 z"/>');
    expect(svgLayoutSafetyIssues(svg)).toEqual([]);
    // Relative endpoint (40+60+60, 100+40) = (160,140) stays inside.
    const out = svgOf('<path d="M 500 500 l 100 0"/>');
    const issues = svgLayoutSafetyIssues(out);
    expect(issues).toHaveLength(1);
    expect(issues[0].kind).toBe('outside-viewbox');
  });

  test('flags elements extending outside the viewBox', () => {
    const svg = svgOf(`
      <rect x="520" y="20" width="120" height="48"/>
      <circle cx="550" cy="300" r="20"/>
      <ellipse cx="20" cy="20" rx="40" ry="10"/>
      <line x1="100" y1="100" x2="600" y2="100"/>
      <text x="300" y="600" font-size="22">넘침</text>
      <path d="M 0 0 L 700 0"/>
    `);
    const issues = svgLayoutSafetyIssues(svg);
    expect(issues.filter((i) => i.kind === 'outside-viewbox')).toHaveLength(6);
    expect(new Set(issues.map((i) => i.el))).toEqual(new Set(['rect', 'circle', 'ellipse', 'line', 'text', 'path']));
  });

  test('tolerates coordinates exactly on the viewBox edge and float noise', () => {
    const svg = svgOf(`
      <rect x="0" y="0" width="560" height="560"/>
      <line x1="0" y1="0" x2="560.000000000004" y2="280"/>
      <text x="560" y="560" font-size="22">edge</text>
    `);
    expect(svgLayoutSafetyIssues(svg)).toEqual([]);
  });

  test('flags negative rect/shape extents as negative-segment', () => {
    const svg = svgOf('<rect x="50" y="50" width="-40" height="30"/><circle cx="100" cy="100" r="-5"/>');
    const issues = svgLayoutSafetyIssues(svg);
    expect(issues.filter((i) => i.kind === 'negative-segment')).toHaveLength(2);
  });

  test('skips bounds checks when the viewBox is missing', () => {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg"><line x1="-100" y1="0" x2="900" y2="0"/></svg>';
    expect(svgLayoutSafetyIssues(svg)).toEqual([]);
  });

  test('horizontal forward lines and free vertical direction stay clean', () => {
    // Vertical line pointing "up" is legitimate in bottom-up layouts when the
    // y positions are equal-x but upward arrows come from paths, not lines —
    // only axis-aligned backward lines flag; this one is forward-downward.
    const svg = svgOf('<line x1="100" y1="100" x2="100" y2="200"/><line x1="100" y1="100" x2="300" y2="100"/>');
    expect(svgLayoutSafetyIssues(svg)).toEqual([]);
  });
});
