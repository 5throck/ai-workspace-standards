/**
 * Marker-zone exemption fixture test (spec:
 * docs/designs/2026-09-25-variant-hygiene-batch-design.md, R2 / AC-3).
 *
 * Proves both directions of the v2.44.0 audit.ts exemption:
 * - POSITIVE: a duplicate section OUTSIDE any COMMON-CONTEXT zone still
 *   reaches the stale-promoted overlap comparison (>50% → the check warns).
 * - NEGATIVE: the identical duplicate carried INSIDE a marker zone is
 *   stripped before section-splitting → nothing reaches the comparison →
 *   the check stays silent (sanctioned ADR-0062 delivery channel).
 *
 * audit.ts itself is not import-safe (checks run at import), so the fixture
 * replays the check's exact comparison pipeline over the same exported
 * primitives the check uses (stripMarkerZones + splitIntoSections +
 * getContentLines from helpers/context-sections.ts).
 */
import { describe, test, expect } from 'bun:test';
import { stripMarkerZones, splitIntoSections, getContentLines } from '../../scripts/helpers/context-sections.ts';

/** The common (promotion target) section body — what docs/context.md owns. */
const COMMON_SECTION_HEADING = '## Shared Policy';
const COMMON_SECTION_BODY = [
    'Common policy line one.',
    'Common policy line two.',
    'Common policy line three.',
    'Common policy line four.',
].join('\n');

/** Replica of checkStalePromotedContent()'s per-section overlap decision. */
function stalePromotedFlags(variantContent: string): number {
    const commonLines = getContentLines(COMMON_SECTION_BODY);
    let flagged = 0;
    for (const { heading, body } of splitIntoSections(stripMarkerZones(variantContent))) {
        if (heading !== 'shared policy') continue;
        const variantLines = getContentLines(body);
        if (variantLines.size < 3) continue;
        let intersection = 0;
        for (const line of variantLines) if (commonLines.has(line)) intersection++;
        const denominator = Math.min(variantLines.size, commonLines.size);
        const similarity = denominator > 0 ? intersection / denominator : 0;
        if (similarity > 0.50) flagged++;
    }
    return flagged;
}

describe('marker-zone exemption (audit.ts v2.44.0 / context-sections.ts v1.7.0)', () => {
    test('positive: non-zone duplicate still warns', () => {
        const variant = [
            COMMON_SECTION_HEADING,
            '',
            COMMON_SECTION_BODY,
            '',
            '<!-- COMMON-CONTEXT:START -->',
            '### Unrelated Zone Section',
            '',
            'Zone content that must not mask the duplicate.',
            '',
            '<!-- COMMON-CONTEXT:END -->',
        ].join('\n');
        expect(stalePromotedFlags(variant)).toBe(1);
    });

    test('negative: identical duplicate inside a marker zone stays silent', () => {
        const variant = [
            '# Variant Context',
            '',
            '<!-- COMMON-CONTEXT:START -->',
            COMMON_SECTION_HEADING,
            '',
            COMMON_SECTION_BODY,
            '<!-- COMMON-CONTEXT:END -->',
        ].join('\n');
        expect(stalePromotedFlags(variant)).toBe(0);
    });

    test('unterminated zone is NOT stripped (content kept verbatim)', () => {
        const unterminated = [
            COMMON_SECTION_HEADING,
            '',
            COMMON_SECTION_BODY,
            '',
            '<!-- COMMON-CONTEXT:START -->',
            'orphaned zone opener with no closer',
        ].join('\n');
        expect(stripMarkerZones(unterminated)).toBe(unterminated);
    });

    test('multiple zones: only complete spans stripped, surroundings preserved', () => {
        const before = '## Intro';
        const between = '## Owned Section';
        const after = '## Tail';
        const zone = '<!-- COMMON-CONTEXT:START -->\nzone a\n<!-- COMMON-CONTEXT:END -->';
        const zone2 = '<!-- COMMON-CONTEXT:START -->\nzone b\n<!-- COMMON-CONTEXT:END -->';
        const content = [before, zone, between, zone2, after].join('\n');
        const stripped = stripMarkerZones(content);
        expect(stripped).toBe([before, between, after].join('\n'));
    });

    test('content without any marker is returned unchanged (byte-preserving)', () => {
        const plain = '# Title\n\n## Section\n\nBody line.\n';
        expect(stripMarkerZones(plain)).toBe(plain);
    });
});
