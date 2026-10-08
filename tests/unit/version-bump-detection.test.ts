/**
 * Unit tests for scripts/helpers/version-bump.ts (dev-sync step 4.85: a staged version bump
 * forces `bun run test:unit` before the audit gate).
 * @version 1.0.0
 */
import { describe, expect, test } from 'bun:test';
import { classifyVersionedPath, detectVersionBumps, diffChangesVersion, hasTestUnitScript } from '../../scripts/helpers/version-bump.ts';

const skillBump = `diff --git a/skills/x/SKILL.md b/skills/x/SKILL.md
--- a/skills/x/SKILL.md
+++ b/skills/x/SKILL.md
@@ -4 +4 @@ description: x
-version: 1.0.0
+version: 1.1.0
`;
const skillBodyOnly = `--- a/skills/x/SKILL.md
+++ b/skills/x/SKILL.md
@@ -120,2 +120,2 @@ body
-version: 1.0.0 is documented here
+version: 1.1.0 is documented here
`;
const scriptSlashBump = `--- a/scripts/foo.ts
+++ b/scripts/foo.ts
@@ -1,0 +2,2 @@
+// @version 1.4.0
+// v1.4.0: change
`;
const scriptStarBump = `--- a/scripts/foo.ts
+++ b/scripts/foo.ts
@@ -3 +3 @@
- * @version 1.3.0
+ * @version 1.4.0
`;
const scriptNoBump = `--- a/scripts/foo.ts
+++ b/scripts/foo.ts
@@ -40,0 +41,1 @@
+const x = 1;
`;

describe('classifyVersionedPath', () => {
  test('recognizes SKILL.md and scripts/**.ts, ignores everything else', () => {
    expect(classifyVersionedPath('skills/x/SKILL.md')).toBe('skill');
    expect(classifyVersionedPath('templates/co-a/skills/y/SKILL.md')).toBe('skill');
    expect(classifyVersionedPath('scripts/lib/a.ts')).toBe('script');
    expect(classifyVersionedPath('templates/common/scripts/a.ts')).toBe('script');
    expect(classifyVersionedPath('docs/readme.md')).toBeNull();
    expect(classifyVersionedPath('tests/unit/a.test.ts')).toBeNull();
  });
});

describe('diffChangesVersion', () => {
  test('SKILL.md frontmatter version change is a bump', () => {
    expect(diffChangesVersion('skill', skillBump)).toBe(true);
  });
  test('a version-looking line deep in the body is not a bump', () => {
    expect(diffChangesVersion('skill', skillBodyOnly)).toBe(false);
  });
  test('script header @version change (// and * forms) is a bump', () => {
    expect(diffChangesVersion('script', scriptSlashBump)).toBe(true);
    expect(diffChangesVersion('script', scriptStarBump)).toBe(true);
  });
  test('script change without a header version edit is not a bump', () => {
    expect(diffChangesVersion('script', scriptNoBump)).toBe(false);
  });
  test('removal of the version line counts', () => {
    expect(diffChangesVersion('skill', '@@ -4 +3,0 @@\n-version: 1.0.0\n')).toBe(true);
  });
});

describe('detectVersionBumps', () => {
  test('returns only the staged files whose diff bumps a version', () => {
    const diffs: Record<string, string> = {
      'skills/x/SKILL.md': skillBump,
      'skills/y/SKILL.md': skillBodyOnly,
      'scripts/foo.ts': scriptSlashBump,
      'scripts/bar.ts': scriptNoBump,
    };
    const out = detectVersionBumps([...Object.keys(diffs), 'README.md'], (f) => diffs[f] ?? '');
    expect(out).toEqual([
      { file: 'skills/x/SKILL.md', kind: 'skill' },
      { file: 'scripts/foo.ts', kind: 'script' },
    ]);
  });
  test('empty change set yields no bumps', () => {
    expect(detectVersionBumps([], () => '')).toEqual([]);
  });
});

describe('hasTestUnitScript', () => {
  test('true only when package.json declares test:unit', () => {
    expect(hasTestUnitScript('{"scripts":{"test:unit":"bun scripts/test-runner.ts unit"}}')).toBe(true);
    expect(hasTestUnitScript('{"scripts":{"test":"x"}}')).toBe(false);
    expect(hasTestUnitScript('{}')).toBe(false);
    expect(hasTestUnitScript('not json')).toBe(false);
    expect(hasTestUnitScript(null)).toBe(false);
  });
});
