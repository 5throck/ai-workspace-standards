// @version 1.0.1
// v1.0.1 (2026-11-15, spec docs/designs/2026-11-15-co-deck-deliverables-migration-design.md): doc-only — usage comments and path constants follow the fleet's deliverables/ consolidation (presentations/ → deliverables/); no logic change.
// lib-pdf-font-patch.test.ts — pin the CustomFontEmbedder patch
// (U-20261105-005 items 1+2): /W entries must be integers (PDF 32000-1
// §9.7.4.3), shaped-glyph closure must cover glyphs reachable only through
// OpenType calt alternates, and the prototype patch must be idempotent.
//
// The real-font /W coverage check runs only when a Pretendard/NotoSansKR TTF
// pair is discoverable (dev machines with project font pools); CI without
// fonts skips it.
//
// Run: bun test scripts/co-deck/tests/lib-pdf-font-patch.test.ts

import { describe, expect, test } from 'bun:test';
import { existsSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { platform, homedir } from 'node:os';
import { collectShapedGlyphs, integerizeWidths, patchCustomFontEmbedder } from '../lib/pdf-font-patch';

const ROOT = resolve(dirname(import.meta.path), '../../..');

describe('integerizeWidths', () => {
  test('rounds scalars and nested sections, preserves structure', () => {
    const w = [1, [250.9765625, 645.5078125], 7, [88.2]];
    expect(integerizeWidths(w as any)).toEqual([1, [251, 646], 7, [88]]);
  });
});

describe('collectShapedGlyphs', () => {
  test('unions base set with probed alternates (stub font)', () => {
    const font = {
      characterSet: [0x41, 0x3a], // 'A', ':'
      layout(t: string) {
        // fake calt: ':' adjacent to letters becomes gid 9999
        const ids = [...t].map((c) => (c === ':' ? { id: 9999, advanceWidth: 520 } : { id: c.codePointAt(0)!, advanceWidth: 600 }));
        return { glyphs: ids };
      },
      glyphForCodePoint(cp: number) { return { id: cp, advanceWidth: 600 }; },
    };
    const base = [{ id: 0x41, advanceWidth: 600 }, { id: 0x3a, advanceWidth: 520 }];
    const merged = collectShapedGlyphs(font, base);
    const ids = merged.map((g: any) => g.id);
    expect(ids).toContain(0x41);
    expect(ids).toContain(0x3a);
    expect(ids).toContain(9999); // shaped alternate now covered
    // sorted ascending
    expect([...ids].sort((a, b) => a - b)).toEqual(ids);
  });
});

describe('patchCustomFontEmbedder', () => {
  test('idempotent — repeated calls keep a single patch flag', () => {
    // Requires pdf-lib importable from the co-deck package context.
    try {
      patchCustomFontEmbedder();
      patchCustomFontEmbedder();
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { CustomFontEmbedder } = require('pdf-lib');
      // Flag lives on the CLASS (both cjs + es copies are patched); `for` must
      // be the wrapping factory.
      expect((CustomFontEmbedder as any).__coDeckShapedGlyphPatch).toBe(true);
      expect(String((CustomFontEmbedder as any).for)).toContain('origFor');
    } catch (e) {
      throw new Error(`pdf-lib not resolvable in test context: ${e}`);
    }
  });
});

// ── Real-font /W coverage (skipped when no local font pool) ─────────────────
const fontDirs = [
  join(ROOT, 'deliverables/assets/fonts'),
  join(homedir(), 'Library/Fonts'),
];
const fontPath = fontDirs
  .flatMap((d) => [join(d, 'Pretendard-Regular.ttf'), join(d, 'NotoSansKR.otf')])
  .find((p) => existsSync(p));

describe('real-font shaped-glyph coverage', () => {
  test.skipIf(!fontPath)('fontkit layout of punctuation contexts is fully covered by the probed set', async () => {
    const fontkit = (await import('@pdf-lib/fontkit')).default;
    const font: any = (fontkit as any).create(await import('node:fs').then((m) => m.readFileSync(fontPath!)));
    const base = font.characterSet.map((cp: number) => font.glyphForCodePoint(cp));
    const merged = collectShapedGlyphs(font, base);
    const ids = new Set(merged.map((g: any) => g.id));
    // Decks draw punctuation inside running text — shaped alternates must be covered.
    for (const probe of ['외식물가: 두 번째', '3- Tier', 'A:B-C_D']) {
      for (const g of font.layout(probe).glyphs) {
        expect(ids.has(g.id)).toBe(true);
      }
    }
  }, 30000);
});
