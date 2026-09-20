/**
 * Integration tests for skill-lifecycle-audit.ts v1.5.0 lifecycle-modernization
 * checks (2026-09-21-agent-skill-lifecycle-modernization-design.md):
 * Check RI  — unresolvable backtick skill references in SKILL.md bodies FAIL,
 *             with docs/lifecycle/reference-allowlist.json as the escape hatch;
 * Check RI-d — references to deprecated skills WARN;
 * Check RD  — expired removal-date on a still-present skill FAILs.
 *
 * @version 1.0.0
 */
import { existsSync, mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { describe, test, expect } from 'bun:test';

const workspaceRoot = resolve(import.meta.dir, '..', '..');
const auditScript = join(workspaceRoot, 'scripts', 'skill-lifecycle-audit.ts');

function makeTempWorkspace(): string {
  const tmp = mkdtempSync(join(tmpdir(), 'skill-audit-ri-'));
  // The RI/LC checks run at workspace root only (IS_WORKSPACE_ROOT is keyed on
  // CONSTITUTION.md); a stub marks the temp dir as an audit root.
  writeFileSync(join(tmp, 'CONSTITUTION.md'), '# test stub\n');
  return tmp;
}

function writeSkill(tmp: string, name: string, body: string): void {
  mkdirSync(join(tmp, 'skills', name), { recursive: true });
  writeFileSync(join(tmp, 'skills', name, 'SKILL.md'), body);
}

function runAudit(tmp: string): { status: number; out: string } {
  const r = spawnSync('bun', [auditScript], { cwd: tmp, encoding: 'utf-8', timeout: 120000 });
  return { status: r.status ?? -1, out: (r.stdout ?? '') + (r.stderr ?? '') };
}

const ACTIVE_SKILL = `---
name: my-skill
status: active
owner: pm
version: 1.0.0
scope: workspace
metadata:
  type: process
  triggers:
    - test
---

## Overview

Body.

## Related Skills

`;
const REAL_SKILL = ACTIVE_SKILL.replace('my-skill', 'real-skill');

describe('skill-lifecycle-audit v1.5.0 reference integrity', () => {
  test('Check RI FAILs when a Related Skills entry resolves to no skill', () => {
    const tmp = makeTempWorkspace();
    try {
      writeSkill(tmp, 'my-skill', ACTIVE_SKILL + '- `ghost-skill` — does not exist\n');
      writeSkill(tmp, 'real-skill', REAL_SKILL);
      const { status, out } = runAudit(tmp);
      expect(status).toBe(1);
      expect(out).toContain('Reference integrity');
      expect(out).toContain('`ghost-skill`');
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  }, 120000);

  test('Check RI passes when the reference is allowlisted as an intentional historical note', () => {
    const tmp = makeTempWorkspace();
    try {
      writeSkill(tmp, 'my-skill', ACTIVE_SKILL + '- `ghost-skill` — replaced by a real workflow\n');
      writeSkill(tmp, 'real-skill', REAL_SKILL);
      mkdirSync(join(tmp, 'docs', 'lifecycle'), { recursive: true });
      writeFileSync(
        join(tmp, 'docs', 'lifecycle', 'reference-allowlist.json'),
        JSON.stringify({ allow: [{ file_substring: 'skills/my-skill', refs: ['ghost-skill'], reason: 'history' }] })
      );
      const { status, out } = runAudit(tmp);
      expect(status).toBe(0);
      expect(out).not.toContain('`ghost-skill`');
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  }, 120000);

  test('Check RI-d WARNs on a reference to a deprecated skill', () => {
    const tmp = makeTempWorkspace();
    try {
      writeSkill(tmp, 'my-skill', ACTIVE_SKILL + '- `old-skill` — deprecated predecessor\n');
      writeSkill(tmp, 'old-skill', REAL_SKILL.replace('real-skill', 'old-skill').replace('status: active', 'status: deprecated'));
      const { status, out } = runAudit(tmp);
      expect(out).toContain('points at a deprecated skill');
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  }, 120000);

  test('Check RD FAILs on an expired removal-date while the skill still exists', () => {
    const tmp = makeTempWorkspace();
    try {
      writeSkill(tmp, 'old-skill', REAL_SKILL.replace('real-skill', 'old-skill').replace('status: active', 'status: deprecated'));
      mkdirSync(join(tmp, 'skills'), { recursive: true });
      writeFileSync(
        join(tmp, 'skills', 'SKILLS.md'),
        `# Skills\n\n### Workspace Skills\n\n| Skill | Version | Status | Owner | Last Reviewed | Removal Date | Notes | Layer |\n|---|---|---|---|---|---|---|---|\n| \`old-skill\` | 1.0.0 | deprecated | pm | 2026-01-01 | 2026-01-02 | — | — |\n`
      );
      const { status, out } = runAudit(tmp);
      expect(status).toBe(1);
      expect(out).toContain('Removal date expired');
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  }, 120000);

  test('Check LC WARNs when an active skill has no lifecycle record', () => {
    const tmp = makeTempWorkspace();
    try {
      writeSkill(tmp, 'my-skill', ACTIVE_SKILL);
      const { out } = runAudit(tmp);
      expect(out).toContain('No lifecycle record');
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  }, 120000);
});
