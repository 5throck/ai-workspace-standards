/**
 * Unit tests for lib/template-release-classify.ts (v1.0.0, spec
 * docs/designs/2026-09-27-auto-template-release-design.md AC-2): the nightly
 * auto-release classifier — every rule-table row class, minor>patch and
 * manual-review>minor precedence, all four manual-review triggers (R6), and
 * the no-op case. Pure function; rows are raw `git diff -M --name-status`
 * lines, no git fixtures needed (upgrade-delivered-diff.test.ts conventions).
 *
 * @version 1.0.0
 */
import { describe, test, expect } from 'bun:test';
import {
  classifyTemplateChanges,
  isDeliveredPath,
  bumpVersion,
} from '../../scripts/lib/template-release-classify.ts';

const SEMVER = { currentVersion: '0.6.0', tagExists: true, otherTemplateTagsExist: true };

describe('rule table (design §4.2)', () => {
  test('M-only classifies PATCH', () => {
    const r = classifyTemplateChanges(['M\ttemplates/common/skills/translate/SKILL.md'], SEMVER);
    expect(r.level).toBe('patch');
    expect(r.nextVersion).toBe('0.6.1');
  });

  test('A (new delivered path) classifies MINOR', () => {
    const r = classifyTemplateChanges(['A\ttemplates/common/skills/new-skill/SKILL.md'], SEMVER);
    expect(r.level).toBe('minor');
    expect(r.nextVersion).toBe('0.7.0');
  });

  test('D (deleted delivered path) classifies MINOR', () => {
    const r = classifyTemplateChanges(['D\ttemplates/co-abap/agents/pm.md'], SEMVER);
    expect(r.level).toBe('minor');
  });

  test('R### rename at any similarity score classifies MINOR', () => {
    for (const status of ['R100', 'R099', 'R075', 'R']) {
      const r = classifyTemplateChanges([`${status}\ttemplates/common/old.md\ttemplates/common/new.md`], SEMVER);
      expect(r.level).toBe('minor');
    }
  });

  test('A+M mix: minor beats patch (precedence R5)', () => {
    const r = classifyTemplateChanges(
      ['A\ttemplates/common/skills/x/SKILL.md', 'M\ttemplates/common/agents/pm.md'],
      SEMVER,
    );
    expect(r.level).toBe('minor');
  });

  test('full backlog mix (A/M/D/R) classifies MINOR', () => {
    const r = classifyTemplateChanges(
      [
        'A\ttemplates/common/skills/a/SKILL.md',
        'M\ttemplates/common/agents/pm.md',
        'D\ttemplates/co-work/skills/gone/SKILL.md',
        'R100\ttemplates/co-deck/old.md\ttemplates/co-deck/new.md',
      ],
      SEMVER,
    );
    expect(r.level).toBe('minor');
    expect(r.nextVersion).toBe('0.7.0');
  });
});

describe('scope and release-metadata exclusion (R2)', () => {
  test('empty input is a no-op', () => {
    const r = classifyTemplateChanges([], SEMVER);
    expect(r.level).toBe('no-op');
    expect(r.nextVersion).toBeNull();
    expect(r.counts.scopedTotal).toBe(0);
  });

  test('release-metadata-only diff is a no-op — no phantom classification', () => {
    const r = classifyTemplateChanges(
      ['M\ttemplates/CHANGELOG.md', 'M\ttemplates/README.md', 'M\ttemplates/README_ko.md'],
      SEMVER,
    );
    expect(r.level).toBe('no-op');
    expect(r.counts.scopedTotal).toBe(0);
    expect(r.reasons).toHaveLength(0);
  });

  test('non-delivered templates/ rows (top-level files, unknown dirs) stay out of scope', () => {
    const r = classifyTemplateChanges(
      ['M\ttemplates/LICENSE', 'A\ttemplates/not-a-variant/file.md', 'D\tdocs/elsewhere.md'],
      SEMVER,
    );
    expect(r.level).toBe('no-op');
    expect(r.counts.scopedTotal).toBe(0);
  });

  test('rename into the delivered surface is in scope (either endpoint counts)', () => {
    const r = classifyTemplateChanges(['R100\ttemplates/README.md\ttemplates/common/README.md'], SEMVER);
    expect(r.level).toBe('minor');
  });

  test('rename between two non-delivered paths is out of scope', () => {
    const r = classifyTemplateChanges(['R100\ttemplates/README.md\ttemplates/README_ko.md'], SEMVER);
    expect(r.level).toBe('no-op');
  });

  test('delivered endpoints feed per-directory counts', () => {
    const r = classifyTemplateChanges(
      ['M\ttemplates/common/agents/pm.md', 'A\ttemplates/co-abap/skills/x/SKILL.md'],
      SEMVER,
    );
    expect(r.counts.byDir).toEqual({ common: 1, 'co-abap': 1 });
    expect(r.counts.deliveredPaths).toBe(2);
  });
});

describe('manual-review triggers (R6)', () => {
  test('(a) unknown status code on a scoped row forces manual-review', () => {
    const r = classifyTemplateChanges(['C90\ttemplates/common/a.md\ttemplates/common/b.md'], SEMVER);
    expect(r.level).toBe('manual-review');
    expect(r.counts.other).toBe(1);
    expect(r.reasons.join('\n')).toContain("unknown status code 'C90'");
  });

  test('(a) typechange status T on a scoped row forces manual-review', () => {
    const r = classifyTemplateChanges(['T\ttemplates/common/link'], SEMVER);
    expect(r.level).toBe('manual-review');
  });

  test('(a) unknown status outside the delivered scope does not trigger', () => {
    const r = classifyTemplateChanges(['C90\ttemplates/README.md\ttemplates/README2.md'], SEMVER);
    expect(r.level).toBe('no-op');
    expect(r.reasons).toHaveLength(0);
  });

  test('(b) non-semver templates/VERSION forces manual-review', () => {
    const r = classifyTemplateChanges(['M\ttemplates/common/agents/pm.md'], {
      ...SEMVER,
      currentVersion: '0.6',
    });
    expect(r.level).toBe('manual-review');
    expect(r.reasons.join('\n')).toContain('does not match X.Y.Z');
  });

  test('(c) missing current tag with older tags present forces manual-review', () => {
    const r = classifyTemplateChanges(['M\ttemplates/common/agents/pm.md'], {
      ...SEMVER,
      tagExists: false,
    });
    expect(r.level).toBe('manual-review');
    expect(r.reasons.join('\n')).toContain('previous release incomplete');
  });

  test('(c) missing tag with no older tags is a first release, not an inconsistency', () => {
    const r = classifyTemplateChanges(['M\ttemplates/common/agents/pm.md'], {
      ...SEMVER,
      tagExists: false,
      otherTemplateTagsExist: false,
    });
    expect(r.level).toBe('patch');
  });

  test('(c) unchecked tag facts (undefined) do not trigger', () => {
    const r = classifyTemplateChanges(['M\ttemplates/common/agents/pm.md'], { currentVersion: '0.6.0' });
    expect(r.level).toBe('patch');
  });

  test('(d) templates/VERSION in the pending diff forces manual-review even though it is excluded from counts', () => {
    const r = classifyTemplateChanges(['M\ttemplates/VERSION'], SEMVER);
    expect(r.level).toBe('manual-review');
    expect(r.counts.scopedTotal).toBe(0); // excluded from classification, still watched
    expect(r.reasons.join('\n')).toContain('uncommitted bump signature');
  });

  test('manual-review beats minor: D rows plus a non-semver VERSION stay manual-review', () => {
    const r = classifyTemplateChanges(['D\ttemplates/common/skills/x/SKILL.md'], {
      ...SEMVER,
      currentVersion: 'latest',
    });
    expect(r.level).toBe('manual-review');
  });

  test('manual-review never resolves to a next version', () => {
    const r = classifyTemplateChanges(['A\ttemplates/common/skills/x/SKILL.md'], {
      ...SEMVER,
      tagExists: false,
    });
    expect(r.level).toBe('manual-review');
    expect(r.nextVersion).toBeNull();
  });
});

describe('reporting helpers (R4)', () => {
  test('samples capture up to 5 scoped paths per family', () => {
    const rows = [
      'A\ttemplates/common/1.md',
      'A\ttemplates/common/2.md',
      'M\ttemplates/common/3.md',
      'D\ttemplates/co-work/4.md',
      'R100\ttemplates/co-work/5.md\ttemplates/co-work/6.md',
    ];
    const r = classifyTemplateChanges(rows, SEMVER);
    expect(r.samples.added).toEqual(['templates/common/1.md', 'templates/common/2.md']);
    expect(r.samples.modified).toEqual(['templates/common/3.md']);
    expect(r.samples.deleted).toEqual(['templates/co-work/4.md']);
    expect(r.samples.renamed).toEqual(['templates/co-work/5.md -> templates/co-work/6.md']);
  });

  test('bumpVersion mirrors release-template.ts math for patch and minor', () => {
    expect(bumpVersion('0.6.0', 'patch')).toBe('0.6.1');
    expect(bumpVersion('0.6.0', 'minor')).toBe('0.7.0');
    expect(bumpVersion('1.2.3', 'minor')).toBe('1.3.0');
  });

  test('isDeliveredPath matches common and co-* variants only', () => {
    expect(isDeliveredPath('templates/common/skills/x/SKILL.md')).toBe(true);
    expect(isDeliveredPath('templates/co-abap/agents/pm.md')).toBe(true);
    expect(isDeliveredPath('templates/VERSION')).toBe(false);
    expect(isDeliveredPath('templates/CHANGELOG.md')).toBe(false);
    expect(isDeliveredPath('templates/README.md')).toBe(false);
    expect(isDeliveredPath('docs/context.md')).toBe(false);
  });
});
