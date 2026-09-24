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
 * @version 1.5.0
 * v1.5.0 (T-20260924-001, spec 2026-09-25-propagation-engine-batch-design):
 *         Check B projection arm — compareMirrorProjection semantics
 *         (AC-12: drifted fixture → error whose fix hint names the generator;
 *         identical → clean) plus a live-state run of runCheckBProjection on
 *         the post-normalization tree.
 * v1.4.3: new-project record pin 1.28.0 → 1.28.1 (platform-SSOT constant
 * v1.4.3: new-project record pin 1.28.0 → 1.28.1 (platform-SSOT constant
 *         adoption — behavior-neutral, spec
 *         docs/designs/2026-09-24-platform-ssot-constant-design.md).
 * v1.4.2: new-project record pin 1.24.0 → 1.25.0 (resolve-pm-stub extraction,
 *         adopt-project engine prerequisites).
 * v1.4.1: new-project record pin 1.23.0 → 1.24.0 (ticket batch T-20260921-002/003).
 * v1.4.0: new-project record pin 1.22.0 → 1.23.0 (graft-first build fallback).
 * v1.3.0: new-project record pin 1.21.0 → 1.22.0 (--platform both → all rename).
 * v1.2.0 (T-20260916-002): new-project record pin 1.19.0 → 1.20.0
 *          (provenance fallback alignment version bump).
 * v1.1.0 (T-20260915-009): Check H coverage — compareScriptRecordVersion
 *          helper semantics (agreement null / mismatch ERROR / missing-field
 *          WARNING) and live-state parity for the 3 script records.
 *          (T-20260915-008): upgrade-project fixture 1.4.1 → 1.5.0.
 * v1.3.1 (T-20260921-007): upgrade-project fixture 1.5.0 → 1.5.1
 *          (--platform doc fix; SKILL.md + lifecycle record bumped in lockstep).
 */
import { describe, test, expect } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { scrubConstitutionRefs } from '../../scripts/lib/constitution-scrub.ts';
import {
  runCheckC,
  runCheckE,
  runCheckH,
  runCheckBProjection,
  compareMirrorProjection,
  compareScriptRecordVersion,
  extractRecordField,
  parseSkillFrontmatter,
} from '../../scripts/lifecycle-sync-audit.ts';
import { buildMirrorRegistrySpan, extractRegistrySpan } from '../../scripts/generate-scripts-mirror.ts';

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
      ['sync', '1.6.0', 'pm'],
      ['security-scan', '1.2.0', 'pm'],
      ['upgrade-project', '1.5.1', 'pm'],
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

describe('lifecycle-sync-audit Check H (script record version gate, T-20260915-009)', () => {
  test('compareScriptRecordVersion: agreement returns null', () => {
    expect(compareScriptRecordVersion('1.4.0', '1.4.0', 'record.md')).toBeNull();
    expect(compareScriptRecordVersion('v1.4.0', '1.4.0', 'record.md')).toBeNull();
    expect(compareScriptRecordVersion('1.4.0', 'v1.4.0', 'record.md')).toBeNull();
  });

  test('compareScriptRecordVersion: mismatch is an ERROR with a backfill fix hint', () => {
    const verdict = compareScriptRecordVersion('1.10.0', '1.18.0', 'docs/lifecycle/scripts/new-project.md');
    expect(verdict).not.toBeNull();
    expect(verdict!.level).toBe('error');
    expect(verdict!.message).toContain('1.10.0');
    expect(verdict!.message).toContain('1.18.0');
    expect(verdict!.fix).toContain('1.18.0');
  });

  test('compareScriptRecordVersion: missing Version field is a WARNING (Check E semantics)', () => {
    const verdict = compareScriptRecordVersion(undefined, '0.3.1', 'docs/lifecycle/scripts/validate-pm-extends.md');
    expect(verdict).not.toBeNull();
    expect(verdict!.level).toBe('warning');
    expect(verdict!.fix).toContain('- **Version**: 0.3.1');
    const blank = compareScriptRecordVersion('', '0.3.1', 'record.md');
    expect(blank!.level).toBe('warning');
  });

  test('every current script lifecycle record is at parity (backfilled 2026-09-16)', () => {
    const errors = runCheckH().filter(i => i.level === 'error');
    expect(errors).toEqual([]);
  });

  test('the three known script records carry a Version field matching SCRIPTS.md', () => {
    const cases: Array<[string, string]> = [
      ['error-handling', '1.4.0'],
      ['new-project', '1.29.0'],
      ['validate-pm-extends', '0.3.1'],
    ];
    for (const [record, version] of cases) {
      const content = readFileSync(
        join(workspaceRoot, 'docs', 'lifecycle', 'scripts', `${record}.md`),
        'utf-8',
      );
      expect(extractRecordField(content, 'Version')).toBe(version);
    }
  });
});

describe('lifecycle-sync-audit Check B projection arm (T-20260924-001, AC-12)', () => {
  const HEADER = '| script | source | version | status | removal-date | security-advisory | layer | pair |';
  const SEPARATOR = '|--------|--------|---------|--------|--------------|-------------------|-------|------|';
  const row = (key: string, version = '1.0.0') =>
    `| \`${key}\` | L0 | ${version} | active | —| —| L0+L1 | —|`;

  test('a drifted fixture produces an error whose fix hint names the generator', () => {
    const expected = [HEADER, SEPARATOR, row('audit.ts', '2.0.0')].join('\n');
    const drifted = [HEADER, SEPARATOR, row('audit.ts', '9.9.9')].join('\n');
    const issues = compareMirrorProjection(expected, drifted);
    expect(issues).toHaveLength(1);
    expect(issues[0].level).toBe('error');
    expect(issues[0].fix).toBe('bun scripts/generate-scripts-mirror.ts');
    expect(issues[0].file).toBe('templates/common/scripts/SCRIPTS.md');
  });

  test('an identical projection is clean', () => {
    const span = [HEADER, SEPARATOR, row('audit.ts', '2.0.0')].join('\n');
    expect(compareMirrorProjection(span, span)).toEqual([]);
  });

  test('a missing mirror span (no | script | header) is an error naming the generator', () => {
    const issues = compareMirrorProjection([HEADER, SEPARATOR].join('\n'), null);
    expect(issues).toHaveLength(1);
    expect(issues[0].level).toBe('error');
    expect(issues[0].fix).toBe('bun scripts/generate-scripts-mirror.ts');
  });

  test('live state: runCheckBProjection reports no issue on the normalized tree', async () => {
    const issues = await runCheckBProjection();
    expect(issues).toEqual([]);
  });

  test('live state: the projection matches the mirror byte-for-byte (independent rebuild)', () => {
    const rootContent = readFileSync(join(workspaceRoot, 'scripts', 'SCRIPTS.md'), 'utf-8');
    const mirrorContent = readFileSync(join(workspaceRoot, 'templates', 'common', 'scripts', 'SCRIPTS.md'), 'utf-8');
    const expected = buildMirrorRegistrySpan(rootContent, join(workspaceRoot, 'templates', 'common', 'scripts'));
    expect(extractRegistrySpan(mirrorContent)).toBe(expected);
  });
});
