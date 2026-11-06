// @version 1.0.0
// lib-layout-overrides.test.ts — pin the shared layout_overrides parser
// dialect (U-20261105-003): flat + DOTTED + nested-indented keys must all
// parse, and dotted/nested forms at the same path must MERGE. Before the
// shared lib, gen-slides-pdf silently dropped dotted keys
// (`colors.card_dark: [R,G,B]`) that estimate-layout's gate accepted, so a
// dotted override passed the lint but never reached the PDF renderer.
//
// Run: bun test scripts/co-deck/tests/lib-layout-overrides.test.ts

import { describe, expect, test } from 'bun:test';
import { parseFrontmatter, parseLayoutOverrides, parseScalar, deepMerge } from '../lib/layout-overrides';

describe('parseScalar', () => {
  test('RGB array / number / boolean / string', () => {
    expect(parseScalar('[248, 246, 241]')).toEqual([248, 246, 241]);
    expect(parseScalar('140')).toBe(140);
    expect(parseScalar('0.75')).toBe(0.75);
    expect(parseScalar('true')).toBe(true);
    expect(parseScalar('"quoted"')).toBe('quoted');
  });
});

describe('parseLayoutOverrides (U-20261105-003 parity)', () => {
  test('dotted keys build nested objects', () => {
    const fm = [
      'layout_overrides:',
      '  colors.card_dark: [248, 246, 241]',
      '  content_constraints.standard.max_body_chars: 140',
    ].join('\n');
    expect(parseLayoutOverrides(fm)).toEqual({
      colors: { card_dark: [248, 246, 241] },
      content_constraints: { standard: { max_body_chars: 140 } },
    });
  });

  test('nested-indented blocks still parse (legacy dialect)', () => {
    const fm = [
      'layout_overrides:',
      '  fonts:',
      '    title_px: 40',
      '    bullet_px: 18',
    ].join('\n');
    expect(parseLayoutOverrides(fm)).toEqual({
      fonts: { title_px: 40, bullet_px: 18 },
    });
  });

  test('dotted + nested forms at the same path MERGE (mixed-form profile)', () => {
    const fm = [
      'layout_overrides:',
      '  colors.card_dark: [248, 246, 241]',
      '  colors:',
      '    accent: [200, 90, 12]',
    ].join('\n');
    expect(parseLayoutOverrides(fm)).toEqual({
      colors: { card_dark: [248, 246, 241], accent: [200, 90, 12] },
    });
  });

  test('block ends at first top-level (column-0) key; comments skipped', () => {
    const fm = [
      'layout_overrides:',
      '  fonts.title_px: 40',
      '  # colors.card_dark: [1, 2, 3]  (commented out)',
      'background_image:',
      '  enabled: false',
    ].join('\n');
    expect(parseLayoutOverrides(fm)).toEqual({ fonts: { title_px: 40 } });
  });

  test('deepMerge: scalars replace, objects merge, null clears', () => {
    const base = { colors: { dark: [1, 2, 3], accent: [4, 5, 6] }, toc: { a: 1 } };
    expect(deepMerge(base, { colors: { accent: [9, 9, 9] } })).toEqual({
      colors: { dark: [1, 2, 3], accent: [9, 9, 9] }, toc: { a: 1 },
    });
    expect(deepMerge(base, { toc: null }).toc).toBeNull();
  });
});

describe('parseFrontmatter', () => {
  test('theme/style pair + dotted overrides', () => {
    const md = [
      '---',
      'presentation:',
      '  title: T',
      '  theme: zen',
      '  style: white-bubble',
      'layout_overrides:',
      '  calibration.font_px_to_pt: 0.75',
      '---',
      '# body',
    ].join('\n');
    const fm = parseFrontmatter(md);
    expect(fm.theme).toBe('zen');
    expect(fm.style).toBe('white-bubble');
    expect(fm.layout_overrides).toEqual({ calibration: { font_px_to_pt: 0.75 } });
  });

  test('CRLF line endings still yield frontmatter', () => {
    const md = '---\r\npresentation:\r\n  theme: pitch\r\n  style: classic\r\n---\r\n# b';
    expect(parseFrontmatter(md).theme).toBe('pitch');
  });
});
