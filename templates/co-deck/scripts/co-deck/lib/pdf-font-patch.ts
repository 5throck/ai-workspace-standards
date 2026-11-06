// @version 1.0.0 — pdf-lib CustomFontEmbedder shaped-glyph coverage patch
// (U-20261105-005 item 1, item 2).
//
// ROOT CAUSE (reproduced 2026-11-06 with Pretendard-Regular.ttf, 2048 upm):
// pdf-lib builds the CIDFont /W table (CustomFontEmbedder.computeWidths) and
// the ToUnicode CMap (embedUnicodeCmap → createCmap) ONLY from the UNshaped
// glyph set — `glyphForCodePoint` over `font.characterSet`. But `encodeText`
// writes content-stream CIDs from fontkit's OpenType SHAPING (`font.layout`),
// which applies `calt` contextual alternates. Pretendard substitutes ':' →
// gid 13147→13205 and '-' → gid 13241→13252 in running text, so those CIDs:
//   • have NO /W entry — viewers fall back to /DW (spec default 1000) and
//     over-advance them ("3-  Tier", "외식물가:   두 번째");
//   • have NO ToUnicode mapping — text extraction garbles/drops them.
//
// FIX: before any embedFont call, patch CustomFontEmbedder.prototype.
// allGlyphsInFontSortedById (the glyph-cache producer captured at embedder
// construction) to return the union of the unshaped set and the glyphs
// reachable through shaping — probed by laying out every codepoint in
// adjacency contexts ("A<x>B", "2<x>2") that trigger the calt rules. Also
// rounds /W entries to integers: PDF 32000-1 §9.7.4.3 requires W-array
// entries to be integers, and pdf-lib emits fractional values for 2048-upm
// fonts (max error 0.5/1000 em — invisible, but spec-strict viewers truncate).
//
// The patch is idempotent (guarded) and applies to every CustomFontEmbedder
// instance created afterwards, including the CJK fallback font.

import { CustomFontEmbedder } from 'pdf-lib';
import { createRequire } from 'module';
import type { Glyph } from '@pdf-lib/fontkit';

/** Contexts that trigger OpenType contextual-alternate substitution. */
const SHAPING_PROBE_TEMPLATES = ['A{ch}B', '2{ch}2'];

interface GlyphLike {
  id: number;
  advanceWidth: number;
  codePoints?: number[];
}

/** Collect the shaped glyph set for a fontkit font (probe-based closure). */
export function collectShapedGlyphs(font: any, baseGlyphs: GlyphLike[]): GlyphLike[] {
  const byId = new Map<number, GlyphLike>(baseGlyphs.map((g) => [g.id, g]));
  const charSet: number[] = font.characterSet ?? [];
  for (const cp of charSet) {
    const ch = String.fromCodePoint(cp);
    for (const tpl of SHAPING_PROBE_TEMPLATES) {
      try {
        for (const g of font.layout(tpl.replace('{ch}', ch)).glyphs) {
          byId.set(g.id, g);
        }
      } catch {
        // Probe layout may fail on exotic codepoints — skip, the direct glyph
        // is already covered by the base set.
      }
    }
  }
  return [...byId.values()].sort((a, b) => a.id - b.id);
}

/** Round every number in a pdf-lib /W structure to an integer (spec §9.7.4.3). */
export function integerizeWidths(widths: (number | number[])[]): (number | number[])[] {
  return widths.map((w) =>
    typeof w === 'number' ? Math.round(w) : w.map((v) => Math.round(v)),
  );
}

interface PatchableEmbedder {
  prototype: Record<string, any>;
  for?: (...args: any[]) => Promise<any>;
}

/**
 * Idempotently patch CustomFontEmbedder so /W and ToUnicode cover shaped
 * (calt-alternate) glyphs and /W entries are integers. Must run BEFORE the
 * first `pdfDoc.embedFont(...)` call.
 *
 * Implementation notes:
 *  • `allGlyphsInFontSortedById` is an INSTANCE arrow-field (captured into
 *    glyphCache's lazy producer at construction), so patching the prototype
 *    has no effect. Instead wrap the STATIC `CustomFontEmbedder.for` factory:
 *    after the base embedder is constructed, swap its glyph-cache producer
 *    for the shaped-closure version. `computeWidths` IS a prototype method,
 *    so integer rounding patches cleanly there.
 *  • pdf-lib ships TWO builds (cjs "main" + es "module"); bundlers/runtimes
 *    may hold both as DISTINCT class objects (bun: PDFDocument.js internally
 *    calls the cjs copy while `import 'pdf-lib'` in a TS file can resolve the
 *    es copy). Patch every distinct copy we can reach — the cjs one via
 *    createRequire, the ESM-imported one directly.
 */
export function patchCustomFontEmbedder(): void {
  const candidates: any[] = [CustomFontEmbedder];
  try {
    const cjs = createRequire(import.meta.url)('pdf-lib') as any;
    if (cjs?.CustomFontEmbedder && !candidates.includes(cjs.CustomFontEmbedder)) {
      candidates.push(cjs.CustomFontEmbedder);
    }
  } catch {
    // createRequire unavailable in this runtime — the ESM copy may suffice.
  }

  for (const cls of candidates) {
    patchClass(cls);
  }
}

function patchClass(cls: any): void {
  if (!cls || cls.__coDeckShapedGlyphPatch) return;
  cls.__coDeckShapedGlyphPatch = true;

  if (typeof cls.for === 'function') {
    const origFor = cls.for;
    cls.for = async function (this: any, ...args: any[]) {
      const embedder = await origFor.apply(this, args);
      if (embedder && embedder.font) {
        const origProducer = embedder.allGlyphsInFontSortedById.bind(embedder);
        embedder.allGlyphsInFontSortedById = (): Glyph[] =>
          collectShapedGlyphs(embedder.font, origProducer() as unknown as GlyphLike[]) as unknown as Glyph[];
        // glyphCache is a lazy memo over the producer — rebuild it so both
        // computeWidths and embedUnicodeCmap see the shaped closure.
        let memo: Glyph[] | null = null;
        embedder.glyphCache = {
          access: (): Glyph[] => (memo ??= embedder.allGlyphsInFontSortedById()),
        };
      }
      return embedder;
    };
  }

  const proto = cls.prototype as Record<string, any>;
  const origComputeWidths = proto.computeWidths as
    | ((this: any) => (number | number[])[])
    | undefined;
  if (origComputeWidths) {
    proto.computeWidths = function (this: any): (number | number[])[] {
      return integerizeWidths(origComputeWidths.call(this));
    };
  }
}
