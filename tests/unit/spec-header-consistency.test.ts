// T-20261029-002: registry-vs-design-header status consistency
// (helpers/spec-header-consistency.ts) consumed by audit.ts's spec-check
// Check 6 — spec-register flips the REGISTRY status, and the design doc's own
// Status header must move with it; the four docs repaired in d8d55f8a0 are the
// failure class this pins.
import { describe, expect, test } from 'bun:test';
import {
  classifySpecHeader,
  extractStatusHeaderValue,
  parseDocStatus,
  parseStatusHeaderValue,
  SPEC_STATUS_VOCABULARY,
} from '../../scripts/helpers/spec-header-consistency.ts';

describe('extractStatusHeaderValue (T-20261029-002)', () => {
  test('finds the house-style Status list line', () => {
    const text = [
      '# Design: Something',
      '',
      '- **Spec ID**: `2026-10-29-x-design`',
      '- **Status**: implemented (registry SSOT)',
      '',
      '## 0. Body',
    ].join('\n');
    expect(extractStatusHeaderValue(text)).toBe('implemented (registry SSOT)');
  });

  test('takes the FIRST Status line only (prose later mentioning **Status** is not a header)', () => {
    const text = [
      '- **Status**: draft',
      '',
      'The `**Status**:` mention in prose does not count.',
    ].join('\n');
    expect(extractStatusHeaderValue(text)).toBe('draft');
  });

  test('tolerates * bullet and leading whitespace', () => {
    expect(extractStatusHeaderValue('* **Status**: approved')).toBe('approved');
    expect(extractStatusHeaderValue('  - **Status**:  planned ')).toBe('planned');
  });

  test('returns null when no Status header line exists (legacy doc)', () => {
    expect(extractStatusHeaderValue('# Design\n\nSome body text. **Status** bolded inline.\n')).toBeNull();
  });
});

describe('parseStatusHeaderValue (T-20261029-002)', () => {
  test('THE INCIDENT: annotated implemented value parses as implemented, not draft', () => {
    // The l0-only-governance-doc-cleanup header after the T-20261029-002 flip.
    expect(
      parseStatusHeaderValue(
        'implemented (registry SSOT; retro-marked from proposed per T-20261029-002 — the fork rewrite, pipeline edits, and remove-retired-governance-docs.ts landed)',
      ),
    ).toBe('implemented');
  });

  test('bare vocabulary values parse directly, case-insensitively', () => {
    expect(parseStatusHeaderValue('Implemented (2026-10-28)')).toBe('implemented');
    expect(parseStatusHeaderValue('draft')).toBe('draft');
    expect(parseStatusHeaderValue('Archived')).toBe('archived');
  });

  test('earliest occurrence wins over later qualifiers', () => {
    expect(parseStatusHeaderValue('draft — will be implemented after approval')).toBe('draft');
    expect(parseStatusHeaderValue('superseded — the implemented successor is X')).toBe('superseded');
  });

  test('word-boundary: superseded_by does not read as superseded', () => {
    expect(parseStatusHeaderValue('see superseded_by pointer in the registry')).toBeNull();
  });

  test('no vocabulary word → null (unparseable)', () => {
    expect(parseStatusHeaderValue('shipped and verified')).toBeNull();
  });

  test('vocabulary matches audit.ts spec-check Check 4 exactly', () => {
    // The helper and the gate must not drift on the legal status set.
    expect(SPEC_STATUS_VOCABULARY).toEqual([
      'draft', 'proposed', 'approved', 'planned', 'implemented', 'superseded', 'drifted', 'archived',
    ]);
  });
});

describe('parseDocStatus (T-20261029-002)', () => {
  test('full-doc composition on a realistic header block', () => {
    const text = [
      '# Validator-Hardening Retroactive Design Record',
      '',
      '- **Spec ID**: `2026-10-27-validator-hardening-retro-design`',
      '- **Date**: 2026-10-27',
      '- **Status**: implemented (retrospective record - the changes landed 2026-10-27 via commits)',
      '',
      'Body.',
    ].join('\n');
    expect(parseDocStatus(text)).toBe('implemented');
  });

  test('doc without a header → null', () => {
    expect(parseDocStatus('# No header\n\nBody only.\n')).toBeNull();
  });
});

describe('classifySpecHeader (T-20261029-002)', () => {
  test('match when doc header agrees with registry', () => {
    expect(classifySpecHeader('implemented', '- **Status**: implemented (landed)')).toEqual({
      verdict: 'match',
      status: 'implemented',
    });
  });

  test('mismatch when spec-register flipped the registry but the header stayed behind', () => {
    expect(classifySpecHeader('implemented', '- **Status**: draft')).toEqual({
      verdict: 'mismatch',
      registryStatus: 'implemented',
      docStatus: 'draft',
    });
    expect(classifySpecHeader('implemented', '- **Status**: proposed')).toEqual({
      verdict: 'mismatch',
      registryStatus: 'implemented',
      docStatus: 'proposed',
    });
  });

  test('legacy doc without a header classifies unparseable (WARN, never FAIL)', () => {
    expect(classifySpecHeader('implemented', '# Legacy design\n\nNo header line.\n')).toEqual({
      verdict: 'unparseable',
    });
    expect(classifySpecHeader('implemented', null)).toEqual({ verdict: 'unparseable' });
  });
});
