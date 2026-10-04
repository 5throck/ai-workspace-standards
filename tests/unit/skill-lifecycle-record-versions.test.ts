/**
 * Lifecycle-record Metadata Version parity (Check MV, T-20261004-020)
 * @version 1.0.0
 *
 * Covers the pure parser behind skill-lifecycle-audit Check MV: a record's
 * footer Metadata Version must equal the header's and the SKILL.md
 * frontmatter's (comparison itself lives in the audit loop).
 */

import { describe, expect, test } from 'bun:test';
import { lifecycleRecordVersions } from '../../scripts/skill-lifecycle-audit.ts';

const RECORD = `# Ci-Triage Skill Lifecycle

## Metadata
- **Skill**: ci-triage
- **Status**: active
- **Version**: 0.2.0
- **Created**: 2026-09-08
- **Last Updated**: 2026-10-04

## Description
Body.

## Usage Statistics
- **Total Invocations**: 0

## Metadata
- **Current Phase**: production
- **Version**: 0.2.0
- **Owner**: pm
- **Last Updated**: 2026-10-04
- **Last Reviewer**: pm
`;

describe('lifecycleRecordVersions (Check MV)', () => {
  test('reads the first Metadata block as header and the last as footer', () => {
    expect(lifecycleRecordVersions(RECORD)).toEqual({ header: '0.2.0', footer: '0.2.0' });
  });

  test('a drifted footer is reported verbatim (the ci-triage 2026-10-04 window)', () => {
    const drifted = RECORD.replace('- **Current Phase**: production\n- **Version**: 0.2.0', '- **Current Phase**: production\n- **Version**: 0.1.0');
    expect(lifecycleRecordVersions(drifted)).toEqual({ header: '0.2.0', footer: '0.1.0' });
  });

  test('Last Updated never masquerades as Version', () => {
    const v = lifecycleRecordVersions(RECORD);
    expect(v?.header).not.toBe('2026-10-04');
    expect(v?.footer).not.toBe('2026-10-04');
  });

  test('fewer than two Metadata blocks returns null (shape drift, not this check)', () => {
    expect(lifecycleRecordVersions('# Record\n\n## Metadata\n- **Version**: 1.0.0\n')).toBeNull();
    expect(lifecycleRecordVersions('# no metadata at all\n')).toBeNull();
  });

  test('a block without a Version line returns null', () => {
    const noVersion = RECORD.replace('- **Version**: 0.2.0\n- **Owner**: pm\n', '- **Owner**: pm\n');
    expect(lifecycleRecordVersions(noVersion)).toBeNull();
  });
});
