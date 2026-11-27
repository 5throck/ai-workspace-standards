// lifecycle-sync-check-j.test.ts — Check J of lifecycle-sync-audit v1.23.0 (design
// docs/designs/2026-11-27-version-advance-lane-coverage-design.md §4.2): the pure
// decision core (extractTemplateVersionToken / stripStampLines /
// evaluateVersionAdvance). The git enumeration (runCheckJ) is a thin IO shell over
// these — the acceptance matrix below IS the check contract:
//   content-edit-without-bump → ERROR; with-bump → clean; stamp-only → clean;
//   first-time/deleted → exempt; versionless → J1-exempt (J2 counts it);
//   templates/VERSION advance → J2 clean; unchanged → J2 WARN with the mapping.

import { describe, expect, test } from 'bun:test';

import {
  evaluateVersionAdvance,
  extractTemplateVersionToken,
  stripStampLines,
  type VersionAdvanceEntry,
} from '../../scripts/lifecycle-sync-audit.ts';

const SKILL_V1 = `---
name: demo
version: 1.1.0
last_updated: 2026-01-01
---
body line
`;
const SKILL_V1_BUMPED = SKILL_V1.replace('version: 1.1.0', 'version: 1.2.0');
const SKILL_V1_CONTENT_EDIT = SKILL_V1.replace('body line', 'body line edited');
const SKILL_V1_STAMP_ONLY = SKILL_V1.replace('last_updated: 2026-01-01', 'last_updated: 2026-11-27');

const SCRIPT_V3 = `#!/usr/bin/env bun
// @version 3.4.0
// header comment
export const x = 1;
`;
const SCRIPT_V3_EDITED = SCRIPT_V3.replace('export const x = 1;', 'export const x = 2;');

const DOC_V1 = `# Guide

text

*engagement-orchestration.md version: 1.2 — footer note
`;
const DOC_V1_EDITED = DOC_V1.replace('text', 'text revised');

const entry = (path: string, head: string | null, worktree: string | null): VersionAdvanceEntry => ({
  path,
  head,
  worktree,
});

describe('Check J — extractTemplateVersionToken (path-class dispatch)', () => {
  test('skills/agents frontmatter version', () => {
    expect(extractTemplateVersionToken('templates/common/skills/demo/SKILL.md', SKILL_V1)).toBe('1.1.0');
    expect(extractTemplateVersionToken('templates/common/agents/architect.md', SKILL_V1)).toBe('1.1.0');
    expect(extractTemplateVersionToken('templates/co-hr/agents/pm.md', SKILL_V1)).toBe('1.1.0');
  });

  test('script @version', () => {
    expect(extractTemplateVersionToken('templates/common/scripts/demo.ts', SCRIPT_V3)).toBe('3.4.0');
    expect(extractTemplateVersionToken('templates/co-deck/scripts/deck/tool.py', SCRIPT_V3)).toBe('3.4.0');
  });

  test('docs inline footer (two-component, basename-keyed)', () => {
    expect(extractTemplateVersionToken('templates/co-consult/docs/engagement-orchestration.md', DOC_V1)).toBe('1.2');
    // A DIFFERENT file's footer must not match (the basename is escaped into the pattern).
    expect(extractTemplateVersionToken('templates/co-consult/docs/other.md', DOC_V1)).toBe('');
  });

  test('versionless files → empty token', () => {
    expect(extractTemplateVersionToken('templates/common/docs/_common/security.md', '# Security\nbody')).toBe('');
    expect(extractTemplateVersionToken('templates/common/.claude/settings.json', '{}')).toBe('');
  });
});

describe('Check J — stripStampLines (the provably-stamp-only exemption)', () => {
  test('version/last_updated/last_reviewed/@version/footer lines strip; body stays', () => {
    const stripped = stripStampLines('templates/common/skills/demo/SKILL.md', SKILL_V1);
    expect(stripped).not.toContain('version:');
    expect(stripped).not.toContain('last_updated:');
    expect(stripped).toContain('body line');
    expect(stripStampLines('templates/co-consult/docs/engagement-orchestration.md', DOC_V1)).not.toContain(
      'engagement-orchestration.md version:',
    );
  });

  test('stamp-only edit normalizes equal to HEAD', () => {
    expect(stripStampLines('templates/common/skills/demo/SKILL.md', SKILL_V1)).toBe(
      stripStampLines('templates/common/skills/demo/SKILL.md', SKILL_V1_STAMP_ONLY),
    );
  });
});

describe('Check J — evaluateVersionAdvance (the acceptance matrix)', () => {
  test('AC: content edit WITHOUT a version bump → ERROR naming bump-first (plus the J2 release-pending WARN)', () => {
    const issues = evaluateVersionAdvance(
      [entry('templates/common/skills/demo/SKILL.md', SKILL_V1, SKILL_V1_CONTENT_EDIT)],
      '0.30.0\n',
      '0.30.0\n',
    );
    const errors = issues.filter((i) => i.level === 'error');
    expect(errors).toHaveLength(1);
    expect(errors[0]!.file).toBe('templates/common/skills/demo/SKILL.md');
    expect(errors[0]!.message).toContain('without a version advance');
    expect(errors[0]!.message).toContain('bump-first');
    expect(issues.filter((i) => i.level === 'warning')).toHaveLength(1); // J2: templates/** moved
  });

  test('AC: the same edit WITH a bump → clean (a version-only diff is strip-equal: no J1, no J2 count)', () => {
    const issues = evaluateVersionAdvance(
      [entry('templates/common/skills/demo/SKILL.md', SKILL_V1, SKILL_V1_BUMPED)],
      '0.30.0\n',
      '0.30.0\n',
    );
    expect(issues).toHaveLength(0);
  });

  test('AC: stamp-only edit (version unchanged) → clean — the d82a73649 class', () => {
    const issues = evaluateVersionAdvance(
      [entry('templates/common/skills/demo/SKILL.md', SKILL_V1, SKILL_V1_STAMP_ONLY)],
      '0.30.0\n',
      '0.30.0\n',
    );
    expect(issues).toHaveLength(0); // not even J2: strip-equal edits are not content changes
  });

  test('AC: first-time file (no HEAD blob) → exempt', () => {
    const issues = evaluateVersionAdvance(
      [entry('templates/common/skills/new-skill/SKILL.md', null, SKILL_V1)],
      '0.30.0\n',
      '0.30.0\n',
    );
    expect(issues.filter((i) => i.level === 'error')).toHaveLength(0);
    // J2 does not count first-time files as content changes (deliberate: a new
    // asset's version is 1.0.0 by construction — nothing to advance).
    expect(issues).toHaveLength(0);
  });

  test('AC: deleted file (worktree null) → exempt', () => {
    const issues = evaluateVersionAdvance(
      [entry('templates/common/skills/old/SKILL.md', SKILL_V1, null)],
      '0.30.0\n',
      '0.30.0\n',
    );
    expect(issues).toHaveLength(0);
  });

  test('AC: versionless template file edit → no J1 row (J2 counts the change)', () => {
    const issues = evaluateVersionAdvance(
      [entry('templates/common/docs/_common/security.md', '# Security\nbody', '# Security\nbody plus')],
      '0.30.0\n',
      '0.30.0\n',
    );
    expect(issues.filter((i) => i.level === 'error')).toHaveLength(0);
    expect(issues.filter((i) => i.level === 'warning')).toHaveLength(1); // J2 release pending
  });

  test('AC: docs footer edit without a bump → ERROR; with a footer bump → clean', () => {
    const without = evaluateVersionAdvance(
      [entry('templates/co-consult/docs/engagement-orchestration.md', DOC_V1, DOC_V1_EDITED)],
      '0.30.0\n',
      '0.30.0\n',
    );
    expect(without.filter((i) => i.level === 'error')).toHaveLength(1);

    const bumped = DOC_V1_EDITED.replace('version: 1.2 —', 'version: 1.3 —');
    const withBump = evaluateVersionAdvance(
      [entry('templates/co-consult/docs/engagement-orchestration.md', DOC_V1, bumped)],
      '0.30.0\n',
      '0.30.0\n',
    );
    expect(withBump.filter((i) => i.level === 'error')).toHaveLength(0);
  });

  test('AC: script content edit without @version bump → ERROR', () => {
    const issues = evaluateVersionAdvance(
      [entry('templates/common/scripts/demo.ts', SCRIPT_V3, SCRIPT_V3_EDITED)],
      '0.30.0\n',
      '0.30.0\n',
    );
    expect(issues.filter((i) => i.level === 'error')).toHaveLength(1);
  });

  test('AC: J2 — templates/** moved without a VERSION advance → WARN naming the mapping', () => {
    const issues = evaluateVersionAdvance(
      [entry('templates/common/scripts/demo.ts', SCRIPT_V3, SCRIPT_V3.replace('@version 3.4.0', '@version 3.5.0'))],
      '0.30.0\n',
      '0.30.0\n',
    );
    expect(issues).toHaveLength(1);
    expect(issues[0]!.level).toBe('warning');
    expect(issues[0]!.file).toBe('templates/VERSION');
    expect(issues[0]!.message).toContain('release pending');
    expect(issues[0]!.message).toContain('feat → minor');
    expect(issues[0]!.message).toContain('fix/docs → patch');
  });

  test('AC: J2 — VERSION advanced in the same landing → clean', () => {
    const issues = evaluateVersionAdvance(
      [entry('templates/common/scripts/demo.ts', SCRIPT_V3, SCRIPT_V3.replace('@version 3.4.0', '@version 3.5.0'))],
      '0.30.0\n',
      '0.31.0\n',
    );
    expect(issues).toHaveLength(0);
  });

  test('AC: templates/VERSION itself is never a J1 row', () => {
    const issues = evaluateVersionAdvance(
      [entry('templates/VERSION', '0.30.0\n', '0.31.0\n')],
      '0.30.0\n',
      '0.31.0\n',
    );
    expect(issues).toHaveLength(0);
  });

  test('index-only churn with identical bytes → no findings', () => {
    const issues = evaluateVersionAdvance(
      [entry('templates/common/skills/demo/SKILL.md', SKILL_V1, SKILL_V1)],
      '0.30.0\n',
      '0.30.0\n',
    );
    expect(issues).toHaveLength(0);
  });
});
