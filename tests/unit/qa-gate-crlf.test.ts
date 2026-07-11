/**
 * Tests for qa-gate.ts — CRLF-tolerant content comparison (M5).
 * Windows checkouts can normalize LF to CRLF; the L0 vs L1 sync check must
 * not report false-positive drift when the only difference is line endings.
 *
 * @version 1.0.0
 */
import { describe, test, expect } from 'bun:test';
import { normalizeLineEndings, sha256Normalized } from '../../scripts/qa-gate.ts';

describe('normalizeLineEndings', () => {
    test('converts CRLF to LF', () => {
        expect(normalizeLineEndings('line1\r\nline2\r\n')).toBe('line1\nline2\n');
    });

    test('leaves LF-only content unchanged', () => {
        expect(normalizeLineEndings('line1\nline2\n')).toBe('line1\nline2\n');
    });
});

describe('sha256Normalized', () => {
    test('produces identical hashes for CRLF vs LF versions of the same content', () => {
        const lf = 'const x = 1;\nconst y = 2;\n';
        const crlf = 'const x = 1;\r\nconst y = 2;\r\n';
        expect(sha256Normalized(lf)).toBe(sha256Normalized(crlf));
    });

    test('still distinguishes genuinely different content', () => {
        const a = 'const x = 1;\n';
        const b = 'const x = 2;\n';
        expect(sha256Normalized(a)).not.toBe(sha256Normalized(b));
    });
});
