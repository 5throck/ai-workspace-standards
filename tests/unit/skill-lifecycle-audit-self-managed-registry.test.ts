/**
 * skill-lifecycle-audit: registry rows vs self-managed skills (T-20261113-002)
 * @version 1.0.0
 *
 * Spec: docs/designs/2026-11-13-skill-audit-self-managed-registry-design.md
 *
 * Fixture projects (no CONSTITUTION.md => project mode) are audited by spawning
 * the script with cwd set to the fixture. A registry row for a self-managed
 * skill (skills/graft/, external-deps install_dirs) is tolerated; a row with
 * no skill at all still fails; the removal-date check still applies.
 */

import { afterAll, describe, expect, test } from 'bun:test';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';

const SCRIPT = resolve(import.meta.dir, '../../scripts/skill-lifecycle-audit.ts');
const roots: string[] = [];

const DEMO_ROW = '| `demo` | 1.0.0 | active | pm | 2026-11-01 | — | — |';

function write(root: string, rel: string, content: string): void {
  const p = join(root, rel);
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, content);
}

function fixture(rows: string[], extra: (root: string) => void = () => {}): string {
  const root = mkdtempSync(join(tmpdir(), 'skill-audit-sm-'));
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
    `# Skills\n\n## Registry\n\n| Skill | Version | Status | Owner | Last Reviewed | Removal Date | Notes |\n|---|---|---|---|---|---|---|\n${rows.join('\n')}\n`,
  );
  extra(root);
  return root;
}

function graftSkill(root: string): void {
  write(root, 'skills/graft/SKILL.md', '---\nname: graft\ndescription: Code graph tool.\nversion: 1.0.0\n---\n\n# graft\n');
}

function audit(root: string): { code: number; stdout: string; json: any } {
  const r = Bun.spawnSync(['bun', SCRIPT, '--json'], { cwd: root, stdout: 'pipe', stderr: 'pipe' });
  const stdout = r.stdout.toString();
  let json: any = null;
  try {
    json = JSON.parse(stdout);
  } catch {
    /* leave null */
  }
  return { code: r.exitCode, stdout, json };
}

const messages = (j: any): string[] => (j?.errors ?? []).map((e: any) => e.message);

afterAll(() => {
  for (const r of roots) rmSync(r, { recursive: true, force: true });
});

describe('skill-lifecycle-audit registry rows vs self-managed skills', () => {
  test('baseline fixture is clean', () => {
    const { code, json } = audit(fixture([DEMO_ROW]));
    expect(messages(json)).toEqual([]);
    expect(code).toBe(0);
  });

  test('T1: graft dir + graft registry row passes (regression)', () => {
    const root = fixture([DEMO_ROW, '| `graft` | 1.0.0 | active | pm | 2026-10-01 | — | — |'], graftSkill);
    const { code, json } = audit(root);
    expect(messages(json).filter((m) => m.includes('no matching runtime skill'))).toEqual([]);
    expect(code).toBe(0);
  });

  test('T2: graft dir with no row passes', () => {
    const { code } = audit(fixture([DEMO_ROW], graftSkill));
    expect(code).toBe(0);
  });

  test('T3: a row with no skill dir still fails', () => {
    const root = fixture([DEMO_ROW, '| `ghost` | 1.0.0 | active | pm | 2026-10-01 | — | — |']);
    const { code, json } = audit(root);
    expect(code).toBe(1);
    expect(messages(json).some((m) => m.includes('no matching runtime skill: ghost'))).toBe(true);
  });

  test('T3b: a self-managed row does not mask a different ghost row', () => {
    const root = fixture(
      [DEMO_ROW, '| `graft` | 1.0.0 | active | pm | 2026-10-01 | — | — |', '| `ghost` | 1.0.0 | active | pm | 2026-10-01 | — | — |'],
      graftSkill,
    );
    const { code, json } = audit(root);
    expect(code).toBe(1);
    expect(messages(json).filter((m) => m.includes('no matching runtime skill')).length).toBe(1);
  });

  test('T7: removal-date check still applies to a self-managed row', () => {
    const root = fixture([DEMO_ROW, '| `graft` | 1.0.0 | active | pm | 2026-10-01 | 2026-01-01 | — |'], graftSkill);
    const { code, json } = audit(root);
    expect(code).toBe(1);
    expect(messages(json).some((m) => m.includes('Removal date expired for graft'))).toBe(true);
  });

  test('T4/T5: external-deps vendored skill passes with and without a row', () => {
    const vend = (root: string): void => {
      write(root, 'external-deps.json', JSON.stringify({ dependencies: [{ id: 'vend', install_dir: 'external/vend' }] }));
      write(root, 'external/vend/skills/vend/SKILL.md', '---\nname: vend\ndescription: Vendored.\n---\n\n# vend\n');
    };
    expect(audit(fixture([DEMO_ROW], vend)).code).toBe(0);
    expect(audit(fixture([DEMO_ROW, '| `vend` | 1.0.0 | active | pm | 2026-10-01 | — | — |'], vend)).code).toBe(0);
  });

  test('T6: text mode reports an honest count and the INFO line', () => {
    const root = fixture([DEMO_ROW, '| `graft` | 1.0.0 | active | pm | 2026-10-01 | — | — |'], graftSkill);
    const r = Bun.spawnSync(['bun', SCRIPT], { cwd: root, stdout: 'pipe', stderr: 'pipe' });
    const out = r.stdout.toString();
    expect(r.exitCode).toBe(0);
    expect(out).toContain('Skills found: 2 (1 self-managed, not audited)');
    expect(out).toContain('Skills scanned: 1');
    expect(out).toContain('row `graft` belongs to a self-managed skill');
  });
});
