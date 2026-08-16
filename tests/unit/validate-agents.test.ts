/**
 * Tests for validate-agents.ts — regression guards for Bug A and Bug B
 *
 * Bug A (fixed 2026-08-15): parseFrontmatter/hasNestedField matched frontmatter
 * delimiter anchored to string start only (no multiline flag). Files with a
 * leading comment line before frontmatter were silently treated as "no frontmatter."
 * Fix: add multiline flag so delimiter anchor matches at the start of any line.
 *
 * Bug B (fixed 2026-08-15): file filter excluded exactly README.md by exact-string
 * comparison, but not README_ko.md or underscore-prefixed files. Korean READMEs
 * in agents/ were flagged for missing lifecycle frontmatter.
 * Fix: broadened filter to exclude any README(_*).md variant plus underscore-prefixed files.
 *
 * @version 1.0.0
 */
import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { hasNestedField, parseFrontmatter, isAgentFile } from '../../scripts/validate-agents.ts';

const scratchRoot = path.resolve(import.meta.dir, '..', '.temp', 'validate-agents-test');

describe('validate-agents regression guards', () => {
  beforeEach(() => {
    fs.rmSync(scratchRoot, { recursive: true, force: true });
    fs.mkdirSync(scratchRoot, { recursive: true });
  });
  afterEach(() => fs.rmSync(scratchRoot, { recursive: true, force: true }));

  describe('Bug A regression: leading-comment frontmatter (multiline flag)', () => {
    test('hasNestedField with leading comment before frontmatter', () => {
      // Fixture: a file with a leading comment line (like co-deck's @resolved-from annotation)
      // followed by valid frontmatter. The old regex without 'm' flag would fail to find
      // the frontmatter block at position 0, so hasNestedField would return false.
      const fixture = `# @resolved-from: L0/common/agents/pm.md
---
lifecycle:
  status: active
  phase: production
---
# Body content
`;

      // This must pass with the multiline flag fix. Before the fix, this returned false.
      expect(hasNestedField(fixture, 'lifecycle.status')).toBe(true);
      expect(hasNestedField(fixture, 'lifecycle.phase')).toBe(true);
    });

    test('hasNestedField without leading comment (baseline)', () => {
      // Baseline test: frontmatter at the start of the file should work even before the fix
      const fixture = `---
lifecycle:
  status: active
---
# Body
`;

      expect(hasNestedField(fixture, 'lifecycle.status')).toBe(true);
    });

    test('hasNestedField with missing field returns false', () => {
      const fixture = `# @resolved-from: L0/common/agents/pm.md
---
lifecycle:
  status: active
---
# Body
`;

      // Field doesn't exist, should return false
      expect(hasNestedField(fixture, 'lifecycle.nonexistent')).toBe(false);
    });
  });

  describe('Bug B regression: README_ko.md and underscore-prefixed exclusion', () => {
    test('isAgentFile excludes README.md', () => {
      expect(isAgentFile('README.md')).toBe(false);
    });

    test('isAgentFile excludes README_ko.md (Bug B fix)', () => {
      // This is the key regression guard: the old exact-string check for "README.md"
      // would not exclude README_ko.md. The new regex !/^README(_\w+)?\.md$/ catches all variants.
      expect(isAgentFile('README_ko.md')).toBe(false);
    });

    test('isAgentFile excludes other README variants', () => {
      expect(isAgentFile('README_en.md')).toBe(false);
      expect(isAgentFile('README_ja.md')).toBe(false);
    });

    test('isAgentFile excludes underscore-prefixed files', () => {
      // Bug B fix: also exclude internal-notes files starting with underscore
      expect(isAgentFile('_internal-notes.md')).toBe(false);
      expect(isAgentFile('_old-version.md')).toBe(false);
    });

    test('isAgentFile includes valid agent files', () => {
      expect(isAgentFile('pm.md')).toBe(true);
      expect(isAgentFile('architect.md')).toBe(true);
      expect(isAgentFile('auditor.md')).toBe(true);
    });

    test('full scenario: temp agents directory with mixed files', () => {
      // Fixture: temp directory with various file types
      const agentsDir = path.join(scratchRoot, 'agents');
      fs.mkdirSync(agentsDir, { recursive: true });

      // Create fixture files
      fs.writeFileSync(
        path.join(agentsDir, 'README.md'),
        '# Agents Documentation\n'
      );

      fs.writeFileSync(
        path.join(agentsDir, 'README_ko.md'),
        '# 에이전트 문서\n'
      );

      fs.writeFileSync(
        path.join(agentsDir, '_internal-notes.md'),
        'Internal notes\n'
      );

      // Valid agent file with lifecycle frontmatter
      const agentContent = `---
lifecycle:
  phase: production
  status: active
---
# Agent documentation
`;
      fs.writeFileSync(path.join(agentsDir, 'pm.md'), agentContent);

      // Read back and filter using isAgentFile
      const files = fs.readdirSync(agentsDir);
      const agentFiles = files.filter(isAgentFile);

      // Must include pm.md and exclude all others
      expect(agentFiles).toContain('pm.md');
      expect(agentFiles).not.toContain('README.md');
      expect(agentFiles).not.toContain('README_ko.md');
      expect(agentFiles).not.toContain('_internal-notes.md');
      expect(agentFiles.length).toBe(1);
    });
  });

  describe('parseFrontmatter integration', () => {
    test('parseFrontmatter captures top-level keys', () => {
      const fixture = `# @resolved-from: L0/common/agents/pm.md
---
lifecycle:
  status: active
extends: common/agents/pm
---
# Body
`;

      const fields = parseFrontmatter(fixture);
      // parseFrontmatter captures "lifecycle" and "extends" as top-level keys
      expect('lifecycle' in fields).toBe(true);
      expect('extends' in fields).toBe(true);
    });

    test('parseFrontmatter with dotted key', () => {
      const fixture = `---
lifecycle.status: active
extends: common/agents/pm
---
# Body
`;

      const fields = parseFrontmatter(fixture);
      // Direct dotted key should be captured
      expect('lifecycle.status' in fields).toBe(true);
      expect('extends' in fields).toBe(true);
    });
  });
});
