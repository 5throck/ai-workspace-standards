import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { mkdirSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { extractScriptVersion, preserveLifecycleFrontmatter } from '../../scripts/helpers/upgrade-versions.ts';

// ── extractScriptVersion ──────────────────────────────────────────────────────

describe('extractScriptVersion', () => {
  let dir = '';

  beforeAll(() => {
    dir = join(tmpdir(), `upgrade-versions-test-${Date.now()}`);
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'line.ts'), '#!/usr/bin/env bun\n// @version 1.2.3\nconsole.log("x");\n');
    writeFileSync(join(dir, 'jsdoc.ts'), '/**\n * @version 2.0.1\n * Security validator\n */\nexport const x = 1;\n');
    writeFileSync(join(dir, 'inline.ts'), '/** @version 4.5.6 */\nexport const x = 1;\n');
    writeFileSync(join(dir, 'midline.ts'), ' * Level: L0 | Status: active | @version 5.0.0\n * Header comment\n');
    writeFileSync(join(dir, 'both.ts'), '// @version 3.0.0\n/**\n * @version 9.9.9 (dependency note, not the file version)\n */\nexport const x = 1;\n');
    writeFileSync(join(dir, 'none.ts'), '// no version header here\nexport const x = 1;\n');
  });

  afterAll(() => {
    if (existsSync(dir)) rmSync(dir, { recursive: true, force: true });
  });

  test('extracts line-comment // @version', () => {
    expect(extractScriptVersion(join(dir, 'line.ts'))).toBe('1.2.3');
  });

  test('extracts JSDoc block * @version (security-validator.ts case)', () => {
    expect(extractScriptVersion(join(dir, 'jsdoc.ts'))).toBe('2.0.1');
  });

  test('extracts inline JSDoc /** @version ... */ (qa-gate.ts case)', () => {
    expect(extractScriptVersion(join(dir, 'inline.ts'))).toBe('4.5.6');
  });

  test('extracts mid-line header | @version (validate-model-registry.ts case)', () => {
    expect(extractScriptVersion(join(dir, 'midline.ts'))).toBe('5.0.0');
  });

  test('prefers line-comment version when both styles exist', () => {
    expect(extractScriptVersion(join(dir, 'both.ts'))).toBe('3.0.0');
  });

  test('returns empty string when no version header exists', () => {
    expect(extractScriptVersion(join(dir, 'none.ts'))).toBe('');
  });

  test('returns empty string for missing file', () => {
    expect(extractScriptVersion(join(dir, 'missing.ts'))).toBe('');
  });
});

// ── preserveLifecycleFrontmatter ──────────────────────────────────────────────

describe('preserveLifecycleFrontmatter', () => {
  const tpl = `---
name: design
version: 1.0.0
status: active
---
# Design Agent
template body`;
  const projWithLifecycle = `---
name: design
version: 1.0.0
status: active
lifecycle:
  phase: production
  created: "2026-05-29"
  last_updated: "2026-07-20"
  governance: docs/lifecycle/agents/design.md
---
# Design Agent
project body`;
  const projPlain = `---
name: design
version: 1.0.0
status: active
---
# Design Agent
no lifecycle`;

  test('inserts the project lifecycle block into template frontmatter', () => {
    const merged = preserveLifecycleFrontmatter(tpl, projWithLifecycle);
    expect(merged).toContain('lifecycle:');
    expect(merged).toContain('  phase: production');
    expect(merged).toContain('  governance: docs/lifecycle/agents/design.md');
    // Template body preserved, project body not carried over.
    expect(merged).toContain('template body');
    expect(merged).not.toContain('project body');
    // Frontmatter still closed exactly once before the body.
    const head = merged.split('# Design Agent')[0];
    expect(head.match(/^---$/gm)).toHaveLength(2);
  });

  test('returns template content unchanged when project has no lifecycle block', () => {
    expect(preserveLifecycleFrontmatter(tpl, projPlain)).toBe(tpl);
  });
});
