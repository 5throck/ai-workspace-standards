/**
 * Integration tests for agent-lifecycle-audit.ts v1.3.0 lifecycle-modernization
 * checks (2026-09-21-agent-skill-lifecycle-modernization-design.md):
 * Check 12 — skill `owner:` naming a nonexistent agent FAILs (L0 skills/ only);
 * Check 13 — dangling `handoff_to`/`handoff_from` FAILs;
 * Check 14 — deprecated agents need a `removal_review:` date, overdue dates FAIL.
 *
 * @version 1.0.0
 */
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { describe, test, expect } from 'bun:test';

const workspaceRoot = resolve(import.meta.dir, '..', '..');
const auditScript = join(workspaceRoot, 'scripts', 'agent-lifecycle-audit.ts');

function makeTempWorkspace(): string {
  return mkdtempSync(join(tmpdir(), 'agent-audit-13-'));
}

function writeAgent(tmp: string, name: string, frontmatter: string): void {
  mkdirSync(join(tmp, 'agents'), { recursive: true });
  writeFileSync(join(tmp, 'agents', `${name}.md`), `---\n${frontmatter}---\n\n# ${name}\n`);
}

function writeSkill(tmp: string, name: string, owner: string): void {
  mkdirSync(join(tmp, 'skills', name), { recursive: true });
  writeFileSync(
    join(tmp, 'skills', name, 'SKILL.md'),
    `---\nname: ${name}\nstatus: active\nowner: ${owner}\nversion: 1.0.0\ndescription: test\n---\n\nBody.\n`
  );
}

function runAudit(tmp: string): { status: number; out: string } {
  const r = spawnSync('bun', [auditScript], { cwd: tmp, encoding: 'utf-8', timeout: 120000 });
  return { status: r.status ?? -1, out: (r.stdout ?? '') + (r.stderr ?? '') };
}

describe('agent-lifecycle-audit v1.3.0 lifecycle checks', () => {
  test('Check 12 FAILs when a skill owner names a nonexistent agent', () => {
    const tmp = makeTempWorkspace();
    try {
      writeAgent(tmp, 'pm', 'name: pm\nrole: orchestrator\nstatus: active\n');
      writeSkill(tmp, 'orphan-owned', 'nobody-agent');
      const { status, out } = runAudit(tmp);
      expect(status).toBe(1);
      expect(out).toContain('Skill owner references nonexistent agent: nobody-agent');
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  }, 120000);

  test('Check 13 FAILs on a dangling handoff_to reference', () => {
    const tmp = makeTempWorkspace();
    try {
      writeAgent(tmp, 'pm', 'name: pm\nrole: orchestrator\nstatus: active\nhandoff_to: ghost-agent\n');
      const { status, out } = runAudit(tmp);
      expect(status).toBe(1);
      expect(out).toContain("Dangling handoff_to reference: agent 'ghost-agent' does not exist");
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  }, 120000);

  test('Check 14 FAILs when a deprecated agent lacks a removal_review date', () => {
    const tmp = makeTempWorkspace();
    try {
      writeAgent(tmp, 'pm', 'name: pm\nrole: orchestrator\nstatus: active\n');
      writeAgent(tmp, 'old-agent', 'name: old-agent\nrole: retired role\nstatus: deprecated\n');
      const { status, out } = runAudit(tmp);
      expect(status).toBe(1);
      expect(out).toContain('Deprecated agent has no removal_review date');
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  }, 120000);

  test('Check 14 FAILs when a removal_review date has passed without a review', () => {
    const tmp = makeTempWorkspace();
    try {
      writeAgent(tmp, 'pm', 'name: pm\nrole: orchestrator\nstatus: active\n');
      writeAgent(tmp, 'old-agent', 'name: old-agent\nrole: retired role\nstatus: deprecated\nremoval_review: 2026-01-01\n');
      const { status, out } = runAudit(tmp);
      expect(status).toBe(1);
      expect(out).toContain('Removal review overdue');
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  }, 120000);

  test("status 'retired' is accepted as a legacy alias with a warning", () => {
    const tmp = makeTempWorkspace();
    try {
      writeAgent(tmp, 'pm', 'name: pm\nrole: orchestrator\nstatus: active\n');
      writeAgent(tmp, 'legacy', 'name: legacy\nrole: legacy role\nstatus: retired\nremoval_review: 2099-01-01\n');
      const { out } = runAudit(tmp);
      expect(out).toContain("status 'retired' is a legacy alias");
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  }, 120000);
});
