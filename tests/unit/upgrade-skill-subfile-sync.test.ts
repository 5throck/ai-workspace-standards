/**
 * Integration test for upgrade-project.ts's common-skills sub-file delivery
 * (2026-09-21-upgrade-project-skill-subfile-sync-design.md): NEW/UPDATE copy the
 * skill's whole directory (not just SKILL.md), and equal-version skills get
 * additive catch-up for missing files while same-version differing files are
 * reported as DRIFT and left untouched.
 *
 * Regression: the 2026-09-20 handbook v0.6.0 fleet upgrade shipped SKILL.md to
 * every project while references/KOREAN_LANGUAGE.md and the localized
 * assets/js/copy-code.js stayed absent — the skill was non-functional fleet-wide.
 *
 * @version 1.0.0
 */
import { existsSync, mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync, cpSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { describe, test, expect } from 'bun:test';

const workspaceRoot = resolve(import.meta.dir, '..', '..');
const upgradeScript = join(workspaceRoot, 'scripts', 'upgrade-project.ts');
const VARIANT = 'co-develop';
const tplHandbook = join(workspaceRoot, 'templates', 'common', 'skills', 'handbook');

function makeTempProject(): string {
  const tmp = mkdtempSync(join(tmpdir(), 'upgrade-skill-subfile-'));
  spawnSync('git', ['init', '-q'], { cwd: tmp });
  spawnSync('git', ['-C', tmp, 'config', 'user.email', 'test@example.com'], { cwd: tmp });
  spawnSync('git', ['-C', tmp, 'config', 'user.name', 'Test'], { cwd: tmp });
  mkdirSync(join(tmp, '.claude'), { recursive: true });
  writeFileSync(
    join(tmp, '.claude', 'template-version.txt'),
    `variant=${VARIANT}\nversion=0.0.0\ncountry=none\n`
  );
  return tmp;
}

function commitAll(tmp: string, message: string): void {
  spawnSync('git', ['-C', tmp, 'add', '-A'], { cwd: tmp });
  spawnSync('git', ['-C', tmp, 'commit', '-q', '-m', message], { cwd: tmp });
}

interface UpgradeResult {
  status: number | null;
  out: string;
}

function runUpgrade(tmp: string, dryRun: boolean): UpgradeResult {
  const args = [upgradeScript, tmp, '--variant', VARIANT, '--yes'];
  if (dryRun) args.push('--dry-run');
  const result = spawnSync('bun', args, { encoding: 'utf-8', timeout: 300000 });
  if (result.status !== 0) {
    console.error('--- upgrade spawn failed ---');
    console.error('status:', result.status, 'signal:', result.signal, 'error:', result.error);
    console.error('stderr:', (result.stderr ?? '').slice(0, 3000));
    console.error('stdout:', (result.stdout ?? '').slice(0, 3000));
  }
  return { status: result.status, out: result.stdout ?? '' };
}

describe('upgrade-project.ts common-skills sub-file delivery', () => {
  test('UPDATE delivers the whole skill directory, not just SKILL.md', () => {
    const tmp = makeTempProject();
    try {
      // Seed a one-generation-old handbook: current SKILL.md downgraded to 0.5.9,
      // sub-files removed — the exact shape the 2026-09-20 fleet incident produced.
      mkdirSync(join(tmp, 'skills', 'handbook'), { recursive: true });
      const tplSkill = readFileSync(join(tplHandbook, 'SKILL.md'), 'utf-8');
      writeFileSync(join(tmp, 'skills', 'handbook', 'SKILL.md'), tplSkill.replace(/^version: 0\.6\.0$/m, 'version: 0.5.9'));
      commitAll(tmp, 'chore: seed stale handbook');

      const { status, out } = runUpgrade(tmp, false);
      expect(status).toBe(0);
      expect(out).toContain('UPDATE skills/handbook/SKILL.md');
      expect(out).toContain('COPIED: skills/handbook/ (whole directory)');

      // SKILL.md bumped AND sub-files delivered in the same run.
      const projSkill = readFileSync(join(tmp, 'skills', 'handbook', 'SKILL.md'), 'utf-8');
      expect(projSkill).toContain('version: 0.6.0');
      expect(existsSync(join(tmp, 'skills', 'handbook', 'references', 'KOREAN_LANGUAGE.md'))).toBe(true);
      expect(existsSync(join(tmp, 'skills', 'handbook', 'references', 'MAINTENANCE_PLAYBOOK.md'))).toBe(true);
      expect(
        readFileSync(join(tmp, 'skills', 'handbook', 'assets', 'js', 'copy-code.js'), 'utf-8')
      ).toBe(readFileSync(join(tplHandbook, 'assets', 'js', 'copy-code.js'), 'utf-8'));
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  }, 300000);

  test('equal-version project gets additive catch-up; same-version drift is warned, not clobbered', () => {
    const tmp = makeTempProject();
    try {
      // Seed the current handbook verbatim, then remove one reference file and
      // locally diverge another at the same declared version.
      mkdirSync(join(tmp, 'skills'), { recursive: true });
      cpSync(tplHandbook, join(tmp, 'skills', 'handbook'), { recursive: true });
      rmSync(join(tmp, 'skills', 'handbook', 'references', 'KOREAN_LANGUAGE.md'));
      writeFileSync(
        join(tmp, 'skills', 'handbook', 'references', 'QUALITY_CHECKLIST.md'),
        '# Locally adapted checklist — do not clobber\n'
      );
      commitAll(tmp, 'chore: seed same-version handbook with gaps');

      const { status, out } = runUpgrade(tmp, false);
      expect(status).toBe(0);
      // Missing file delivered without a version bump…
      expect(out).toContain('CATCH-UP skills/handbook/');
      expect(existsSync(join(tmp, 'skills', 'handbook', 'references', 'KOREAN_LANGUAGE.md'))).toBe(true);
      expect(
        readFileSync(join(tmp, 'skills', 'handbook', 'references', 'KOREAN_LANGUAGE.md'), 'utf-8')
      ).toBe(readFileSync(join(tplHandbook, 'references', 'KOREAN_LANGUAGE.md'), 'utf-8'));
      // …while the locally adapted same-version file survives with a DRIFT warning.
      expect(
        readFileSync(join(tmp, 'skills', 'handbook', 'references', 'QUALITY_CHECKLIST.md'), 'utf-8')
      ).toContain('Locally adapted checklist');
      expect(out).toContain('DRIFT (preserved) skills/handbook/references/QUALITY_CHECKLIST.md');
      expect(out).toContain('left untouched');
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  }, 300000);

  test('registry reconcile runs AFTER delivery: stale row ends at the delivered version', () => {
    const tmp = makeTempProject();
    try {
      // Seed a stale SKILL.md (0.5.9) while the registry row already claims the
      // template version — the pre-fix reconcile ran before delivery, set the row
      // BACK to 0.5.9, and the delivery then invalidated it (co-game/co-architect
      // rollout failures, 2026-09-21).
      mkdirSync(join(tmp, 'skills', 'handbook'), { recursive: true });
      const tplSkill = readFileSync(join(tplHandbook, 'SKILL.md'), 'utf-8');
      writeFileSync(join(tmp, 'skills', 'handbook', 'SKILL.md'), tplSkill.replace(/^version: 0\.6\.0$/m, 'version: 0.5.9'));
      mkdirSync(join(tmp, 'skills'), { recursive: true });
      writeFileSync(
        join(tmp, 'skills', 'SKILLS.md'),
        `# Skills\n\n### Workspace Skills\n\n| skill | version | status | owner | last_reviewed | removal-date | notes | layer |\n|---|---|---|---|---|---|---|---|\n| \`handbook\` | 0.6.0 | active | pm | 2026-09-20 | — | — |\n`
      );
      commitAll(tmp, 'chore: seed stale handbook with current row');

      const { status } = runUpgrade(tmp, false);
      expect(status).toBe(0);
      const rowLine = readFileSync(join(tmp, 'skills', 'SKILLS.md'), 'utf-8')
        .split('\n').find(l => l.includes('`handbook`'));
      expect(rowLine).toContain('0.6.0');
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  }, 300000);

  test('delivery manifest is written in apply mode (rollout hardening R3)', () => {
    const tmp = makeTempProject();
    try {
      mkdirSync(join(tmp, 'skills', 'handbook'), { recursive: true });
      const tplSkill = readFileSync(join(tplHandbook, 'SKILL.md'), 'utf-8');
      writeFileSync(join(tmp, 'skills', 'handbook', 'SKILL.md'), tplSkill.replace(/^version: 0\.6\.0$/m, 'version: 0.5.9'));
      commitAll(tmp, 'chore: seed stale handbook');

      const { status } = runUpgrade(tmp, false);
      expect(status).toBe(0);
      const manifestPath = join(tmp, '.claude', 'last-upgrade-delivery.json');
      expect(existsSync(manifestPath)).toBe(true);
      const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'));
      expect(Array.isArray(manifest.files)).toBe(true);
      expect(manifest.files.some((f: string) => f.includes('skills/handbook/SKILL.md'))).toBe(true);
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  }, 300000);

  test('dry-run reports the whole-directory delivery but writes nothing', () => {
    const tmp = makeTempProject();
    try {
      mkdirSync(join(tmp, 'skills', 'handbook'), { recursive: true });
      const tplSkill = readFileSync(join(tplHandbook, 'SKILL.md'), 'utf-8');
      writeFileSync(join(tmp, 'skills', 'handbook', 'SKILL.md'), tplSkill.replace(/^version: 0\.6\.0$/m, 'version: 0.5.9'));
      commitAll(tmp, 'chore: seed stale handbook');

      const { status, out } = runUpgrade(tmp, true);
      expect(status).toBe(0);
      expect(out).toContain('COPIED: skills/handbook/ (whole directory)');
      expect(existsSync(join(tmp, 'skills', 'handbook', 'references'))).toBe(false);
      expect(readFileSync(join(tmp, 'skills', 'handbook', 'SKILL.md'), 'utf-8')).toContain('version: 0.5.9');
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  }, 300000);
});
