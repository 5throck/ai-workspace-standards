/**
 * skill-lifecycle-audit: loop-top self-managed skip pins behaviour (T-20261113-003, D4)
 * @version 1.0.0
 *
 * Spec: docs/designs/2026-11-13-skill-audit-self-managed-registry-design.md section 5
 *
 * After v1.15.0 removed the unreachable isSelfManagedPath arms, a self-managed
 * skill is still skipped at the loop top (no owner / lifecycle record / registry
 * row needed, no per-skill output), while a non-self-managed skill keeps its
 * owner and lifecycle checks.
 */

import { afterAll, describe, expect, test } from 'bun:test';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';

const SCRIPT = resolve(import.meta.dir, '../../scripts/skill-lifecycle-audit.ts');
const roots: string[] = [];

function write(root: string, rel: string, content: string): void {
  const p = join(root, rel);
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, content);
}

function fixture(extra: (root: string) => void): string {
  const root = mkdtempSync(join(tmpdir(), 'skill-audit-skip-'));
  roots.push(root);
  write(root, 'AGENTS.md', '# Agents\n\n| Agent |\n|---|\n| `pm` |\n');
  write(root, 'agents/pm.md', '# pm\n');
  write(
    root,
    'skills/demo/SKILL.md',
    '---\nname: demo\ndescription: Demo skill. Use when: testing.\nowner: pm\nstatus: active\nversion: 1.0.0\nlast_reviewed: 2026-11-01\nscope: common\n---\n\n# Demo\n',
  );
  write(
    root,
    'skills/SKILLS.md',
    '# Skills\n\n## Registry\n\n| Skill | Version | Status | Owner | Last Reviewed | Removal Date | Notes |\n|---|---|---|---|---|---|---|\n| `demo` | 1.0.0 | active | pm | 2026-11-01 | — | — |\n',
  );
  extra(root);
  return root;
}

function run(root: string, json: boolean): { code: number; out: string } {
  const r = Bun.spawnSync(['bun', SCRIPT, ...(json ? ['--json'] : [])], {
    cwd: root,
    stdout: 'pipe',
    stderr: 'pipe',
    env: { ...process.env, NO_COLOR: '1' },
  });
  return { code: r.exitCode, out: r.stdout.toString() };
}

// Active self-managed skill: no owner, no lifecycle record, no registry row.
const selfManaged = (root: string): void =>
  write(root, 'skills/graft/SKILL.md', '---\nname: graft\ndescription: Code graph tool.\nstatus: active\nversion: 1.0.0\n---\n\n# graft\n');

afterAll(() => {
  for (const r of roots) rmSync(r, { recursive: true, force: true });
});

describe('self-managed skill is skipped at the loop top', () => {
  test('no error, no warning, no per-skill lifecycle INFO', () => {
    const root = fixture(selfManaged);
    const json = JSON.parse(run(root, true).out);
    expect(json.errors).toEqual([]);
    expect(JSON.stringify(json.warnings)).not.toContain('graft');
    const text = run(root, false);
    expect(text.code).toBe(0);
    expect(text.out).not.toContain('lifecycle record not required');
    expect(text.out).not.toContain('docs/self-managed-surfaces.json');
    expect(text.out).toContain('Skills found: 2 (1 self-managed, not audited)');
  });
});

describe('non-self-managed skills keep owner and lifecycle checks', () => {
  test('missing owner is still an error', () => {
    const root = fixture((r) =>
      write(r, 'skills/noown/SKILL.md', '---\nname: noown\ndescription: x.\nstatus: active\nversion: 1.0.0\n---\n\n# n\n'),
    );
    const { code, out } = run(root, true);
    expect(code).toBe(1);
    expect(JSON.parse(out).errors.some((e: any) => e.message === 'No owner defined')).toBe(true);
  });

  test('active skill without a lifecycle record still warns', () => {
    const { out } = run(fixture(() => {}), true);
    expect(JSON.parse(out).warnings.some((w: any) => w.message.includes('No lifecycle record'))).toBe(true);
  });

  test('skill missing from a non-empty registry is still an error', () => {
    const root = fixture((r) =>
      write(
        r,
        'skills/extra/SKILL.md',
        '---\nname: extra\ndescription: x.\nowner: pm\nstatus: active\nversion: 1.0.0\nlast_reviewed: 2026-11-01\n---\n\n# e\n',
      ),
    );
    const { code } = run(root, true);
    expect(code).toBe(1);
  });
});
