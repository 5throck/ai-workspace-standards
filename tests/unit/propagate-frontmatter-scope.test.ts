/**
 * Tests for propagate-to-templates.ts — extractSkillFrontmatterScope() (M4).
 * The previous inline regex `/^---\n([\s\S]*?)\n---/` required LF-only line
 * endings and broke silently on CRLF-normalized SKILL.md files (a common
 * Windows checkout artifact), causing workspace-scoped skill filtering to
 * fail without any error.
 *
 * @version 1.0.0
 */
import { describe, test, expect } from 'bun:test';
import { extractSkillFrontmatterScope } from '../../scripts/propagate-to-templates.ts';

describe('extractSkillFrontmatterScope', () => {
    test('reads scope from LF frontmatter', () => {
        const content = '---\nname: demo\nscope: workspace\n---\n\n# Demo\n';
        expect(extractSkillFrontmatterScope(content)).toBe('workspace');
    });

    test('reads scope from CRLF frontmatter (previously broken)', () => {
        const content = '---\r\nname: demo\r\nscope: workspace\r\n---\r\n\r\n# Demo\r\n';
        expect(extractSkillFrontmatterScope(content)).toBe('workspace');
    });

    test('returns undefined when scope field is absent', () => {
        const content = '---\nname: demo\n---\n\n# Demo\n';
        expect(extractSkillFrontmatterScope(content)).toBeUndefined();
    });

    test('returns undefined (not a throw) when there is no frontmatter block', () => {
        expect(extractSkillFrontmatterScope('# Just a heading\n')).toBeUndefined();
    });

    test('returns undefined (not a throw) on malformed YAML', () => {
        const content = '---\nname: demo\n  scope: [unterminated\n---\n';
        expect(extractSkillFrontmatterScope(content)).toBeUndefined();
    });

    test('is case-insensitive and trims whitespace, matching prior behavior', () => {
        const content = '---\nscope:   Workspace  \n---\n';
        expect(extractSkillFrontmatterScope(content)).toBe('workspace');
    });
});
