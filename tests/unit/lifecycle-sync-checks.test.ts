/**
 * Tests for lifecycle-sync-audit.ts Check C normalization and Check E
 * (lifecycle record metadata gate) — T-20260912-010.
 *
 * Check C normalizes L0 skill content through the shared scrub
 * (scripts/lib/constitution-scrub.ts) before comparing against the L1 mirror,
 * so the intentional CONSTITUTION.md→context.md substitution no longer reports
 * as drift for skills that only differ by the scrub (sync, gateguard, translate
 * warned permanently before). Remaining drift is a FAILURE, and the fix hint
 * must never recommend an action that clobbers the intentional state.
 *
 * @version 1.0.0
 */
import { describe, test, expect } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { scrubConstitutionRefs } from '../../scripts/lib/constitution-scrub.ts';
import {
  runCheckC,
  runCheckE,
  extractRecordField,
  parseSkillFrontmatter,
} from '../../scripts/lifecycle-sync-audit.ts';

const workspaceRoot = resolve(import.meta.dir, '..', '..');

/** The skills whose permanent warnings motivated the normalization (T-20260912-010). */
const SCRUB_ONLY_SKILLS = ['sync', 'gateguard', 'translate'];

describe('lifecycle-sync-audit Check C normalization (T-20260912-010)', () => {
  test('scrubbed L0 content equals the L1 mirror for sync, gateguard, and translate', () => {
    for (const skill of SCRUB_ONLY_SKILLS) {
      const l0Path = join(workspaceRoot, 'skills', skill, 'SKILL.md');
      const l1Path = join(workspaceRoot, 'templates', 'common', 'skills', skill, 'SKILL.md');
      const l0 = readFileSync(l0Path, 'utf-8');
      const l1 = readFileSync(l1Path, 'utf-8');
      expect(scrubConstitutionRefs(l0, l0Path, l1Path)).toBe(l1);
    }
  });

  test('runCheckC reports no issues at all for sync, gateguard, and translate', () => {
    const issues = runCheckC();
    const flagged = issues
      .filter(i => i.level === 'error')
      .map(i => i.file);
    for (const skill of SCRUB_ONLY_SKILLS) {
      expect(flagged).not.toContain(`skills/${skill}/SKILL.md`);
    }
  });

  test('real drift is a FAILURE whose fix hint does not blindly recommend propagate', () => {
    const issues = runCheckC().filter(i => i.level === 'error');
    for (const issue of issues) {
      expect(issue.level).toBe('error');
      expect(issue.fix ?? '').toContain('verify whether the L1 copy diverged intentionally');
      expect(issue.fix ?? '').not.toContain('propagate:apply');
    }
  });
});

describe('lifecycle-sync-audit Check E (lifecycle record metadata gate)', () => {
  test('no record currently mismatches its SKILL.md frontmatter (records refreshed 2026-09-12)', () => {
    const errors = runCheckE().filter(i => i.level === 'error');
    expect(errors).toEqual([]);
  });

  test('extractRecordField reads - **Field**: value lines and tolerates absence', () => {
    const record = '## Metadata\n- **Version**: 1.5.0\n- **Owner**: pm\n';
    expect(extractRecordField(record, 'Version')).toBe('1.5.0');
    expect(extractRecordField(record, 'Owner')).toBe('pm');
    expect(extractRecordField(record, 'Last Reviewer')).toBeUndefined();
    expect(extractRecordField('no metadata here', 'Version')).toBeUndefined();
  });

  test('parseSkillFrontmatter reads version/owner incl. quoted values', () => {
    expect(parseSkillFrontmatter('---\nversion: "1.4.1"\nowner: pm\n---\n')).toEqual({
      version: '1.4.1',
      owner: 'pm',
    });
    expect(parseSkillFrontmatter('no frontmatter')).toEqual({});
  });

  test('the refreshed records agree with their SKILL.md frontmatter', () => {
    const cases: Array<[string, string, string]> = [
      ['sync', '1.5.0', 'pm'],
      ['security-scan', '1.2.0', 'pm'],
      ['upgrade-project', '1.4.1', 'pm'],
    ];
    for (const [skill, version, owner] of cases) {
      const fm = parseSkillFrontmatter(
        readFileSync(join(workspaceRoot, 'skills', skill, 'SKILL.md'), 'utf-8'),
      );
      const record = readFileSync(
        join(workspaceRoot, 'docs', 'lifecycle', 'skills', `${skill}.md`),
        'utf-8',
      );
      expect(extractRecordField(record, 'Version')).toBe(version);
      expect(extractRecordField(record, 'Owner')).toBe(owner);
      expect(fm.version).toBe(version);
      expect(fm.owner).toBe(owner);
    }
  });
});
