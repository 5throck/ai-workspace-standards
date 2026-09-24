/**
 * Integration test for upgrade-project.ts's TEMPLATE TREE SYNC pass
 * (2026-09-11-upgrade-policy-coverage-design.md): template files with no dedicated claiming
 * pass must now reach existing projects — the variant docs tree, .github/, platform
 * settings.json (JSON-merged), root stragglers — while project-owned files stay untouched.
 *
 * v1.1.0 (2026-09-24, scaffold identity overview — spec
 *         2026-09-24-scaffold-identity-overview-design.md §13): new IDENTITY SEED
 *         describe block — AC5a regression for upgrade-project's dedicated
 *         docs/project.md add-if-missing seed step (verdict style, TODO fallback
 *         survival, dry-run parity, AC4 never-overwrite).
 *
 * @version 1.1.0
 */
import { existsSync, mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { describe, test, expect } from 'bun:test';

const workspaceRoot = resolve(import.meta.dir, '..', '..');
const upgradeScript = join(workspaceRoot, 'scripts', 'upgrade-project.ts');
const VARIANT = 'co-develop';

function makeTempProject(): string {
  const tmp = mkdtempSync(join(tmpdir(), 'upgrade-tree-sync-'));
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

describe('upgrade-project.ts TEMPLATE TREE SYNC', () => {
  test('dry-run reports NEW for uncovered docs and .github files and writes nothing', () => {
    const tmp = makeTempProject();
    try {
      const result = spawnSync(
        'bun',
        [upgradeScript, tmp, '--variant', VARIANT, '--dry-run', '--yes'],
        { encoding: 'utf-8', timeout: 180000 }
      );

      if (result.status !== 0) {
        console.error('--- dry-run spawn failed ---');
        console.error('status:', result.status, 'signal:', result.signal, 'error:', result.error);
        console.error('stderr:', (result.stderr ?? '').slice(0, 3000));
        console.error('stdout:', (result.stdout ?? '').slice(0, 3000));
      }
      expect(result.status).toBe(0);
      const out = result.stdout ?? '';
      expect(out).toContain('TEMPLATE TREE SYNC');
      expect(out).toContain('NEW    docs/user-guide.md');
      expect(out).toContain('NEW    .github/CODEOWNERS');
      expect(out).toContain('NEW    .editorconfig');
      // Dry-run must not have written anything.
      expect(existsSync(join(tmp, 'docs', 'user-guide.md'))).toBe(false);
      expect(existsSync(join(tmp, '.github'))).toBe(false);
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  }, 60000);

  test('apply run delivers uncovered files, preserves project-owned files, JSON-merges settings', () => {
    const tmp = makeTempProject();
    try {
      // Pre-seed project-owned state (files upgrade must never clobber)
      mkdirSync(join(tmp, 'docs', 'designs'), { recursive: true });
      writeFileSync(join(tmp, 'docs', 'README.md'), '# Custom project docs index\n');
      writeFileSync(join(tmp, 'docs', 'designs', 'local-note.md'), '# Project-local design note\n');
      // Pre-seed platform settings with a project-only permission grant
      writeFileSync(join(tmp, '.claude', 'settings.json'), JSON.stringify({
        permissions: { allow: ['Bash(my-project-tool *)'] },
        projectFlag: true,
      }, null, 2) + '\n');

      spawnSync('git', ['-C', tmp, 'add', '-A'], { cwd: tmp });
      spawnSync('git', ['-C', tmp, 'commit', '-q', '-m', 'chore: pre-upgrade'], { cwd: tmp });

      const result = spawnSync(
        'bun',
        [upgradeScript, tmp, '--variant', VARIANT, '--yes'],
        { encoding: 'utf-8', timeout: 300000 }
      );
      expect(result.status).toBe(0);
      const out = result.stdout ?? '';
      expect(out).toContain('Tree-sync delivered');

      // Delivered: previously-uncovered template files now reach the project
      expect(existsSync(join(tmp, 'docs', 'user-guide.md'))).toBe(true);
      expect(existsSync(join(tmp, 'docs', 'handoff-spec.md'))).toBe(true);
      expect(existsSync(join(tmp, '.github', 'CODEOWNERS'))).toBe(true);
      expect(existsSync(join(tmp, '.editorconfig'))).toBe(true);

      // Preserved: project-owned files untouched
      expect(readFileSync(join(tmp, 'docs', 'README.md'), 'utf8')).toBe('# Custom project docs index\n');
      expect(readFileSync(join(tmp, 'docs', 'designs', 'local-note.md'), 'utf8')).toBe('# Project-local design note\n');

      // JSON-merged: template settings keys arrived, project-only entries survived.
      // co-develop ships its own .claude/settings.json (variant-first scaffold parity):
      // its allow entries are ['WebSearch(*)', 'WebFetch(*)'].
      const settings = JSON.parse(readFileSync(join(tmp, '.claude', 'settings.json'), 'utf8'));
      expect(settings.projectFlag).toBe(true);
      expect(settings.permissions.allow).toContain('Bash(my-project-tool *)');
      expect(settings.permissions.allow).toContain('WebSearch(*)');
      expect(out).toContain('MERGE  .claude/settings.json');
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  }, 120000);
});

// ============================================================================
// docs/context.md project-only preservation (T-20260912-001, upgrade-project v1.25.0)
// ============================================================================
describe('upgrade-project.ts docs/context.md CONTEXT PRESERVE gate', () => {
  const contextTemplatePath = join(workspaceRoot, 'templates', 'common', 'docs', 'context.md');
  const FOOTER_RE = /\n---\n\n\*context\.md version:[^*\n]*\*\s*$/;

  function seedProjectContext(tmp: string, content: string): void {
    mkdirSync(join(tmp, 'docs'), { recursive: true });
    writeFileSync(join(tmp, 'docs', 'context.md'), content);
    spawnSync('git', ['-C', tmp, 'add', '-A'], { cwd: tmp });
    spawnSync('git', ['-C', tmp, 'commit', '-q', '-m', 'chore: seed context'], { cwd: tmp });
  }

  function templateWithOlderFooter(): string {
    // Project scaffolded one MINOR version behind the live template footer —
    // the version delta is what drives the SYNC branch's inline-version
    // comparison. Derived dynamically so template footer bumps (2.6 → 2.7 → …)
    // don't silently break the fixture (they did: the hardcoded 2.6→2.5 pair
    // stopped matching after the 2026-09-13 footer 2.7 bump).
    const tpl = readFileSync(contextTemplatePath, 'utf8');
    const m = tpl.match(/\*context\.md version: (\d+)\.(\d+)/);
    if (!m) throw new Error('cannot parse templates/common/docs/context.md version footer');
    const behind = `${m[1]}.${Number(m[2]) - 1}`;
    return tpl.replace(/\*context\.md version: \d+\.\d+/, `*context.md version: ${behind}`);
  }

  test('a. project-only section → PRESERVE (dry-run and apply), template NOT applied', () => {
    const tmp = makeTempProject();
    try {
      const tpl = templateWithOlderFooter();
      const footerMatch = tpl.match(FOOTER_RE);
      expect(footerMatch).not.toBeNull();
      const body = tpl.slice(0, footerMatch!.index);
      const footer = tpl.slice(footerMatch!.index);
      const seededContent = body + '\n\n## Project Only Section\nproject-specific content that must survive the upgrade\n' + footer;
      mkdirSync(join(tmp, 'docs'), { recursive: true });
      writeFileSync(join(tmp, 'docs', 'context.md'), seededContent);
      spawnSync('git', ['-C', tmp, 'add', '-A'], { cwd: tmp });
      spawnSync('git', ['-C', tmp, 'commit', '-q', '-m', 'chore: seed context'], { cwd: tmp });

      // Dry-run must produce the identical PRESERVE verdict.
      const dry = spawnSync('bun', [upgradeScript, tmp, '--variant', VARIANT, '--dry-run', '--yes'],
        { encoding: 'utf-8', timeout: 300000 });
      expect(dry.status).toBe(0);
      expect(dry.stdout).toContain('CONTEXT PRESERVE docs/context.md');
      expect(dry.stdout).toContain('project-only: project only section');
      expect(dry.stdout).toContain('preserved — re-run with --force-context-sync');
      expect(readFileSync(join(tmp, 'docs', 'context.md'), 'utf8')).toBe(seededContent);

      // Apply run: file preserved byte-for-byte, template content NOT applied.
      const result = spawnSync('bun', [upgradeScript, tmp, '--variant', VARIANT, '--yes'],
        { encoding: 'utf-8', timeout: 300000 });
      expect(result.status).toBe(0);
      expect(result.stdout).toContain('CONTEXT PRESERVE docs/context.md');
      expect(result.stdout).toContain('project-only: project only section');
      expect(readFileSync(join(tmp, 'docs', 'context.md'), 'utf8')).toBe(seededContent);
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  }, 400000);

  test('b. --force-context-sync applies the template and logs the discarded sections', () => {
    const tmp = makeTempProject();
    try {
      const tpl = templateWithOlderFooter();
      const footerMatch = tpl.match(FOOTER_RE)!;
      const seededContent = tpl.slice(0, footerMatch.index)
        + '\n\n## Project Only Section\nproject-specific content that must survive the upgrade\n'
        + tpl.slice(footerMatch.index);
      seedProjectContext(tmp, seededContent);

      const result = spawnSync(
        'bun',
        [upgradeScript, tmp, '--variant', VARIANT, '--yes', '--force-context-sync'],
        { encoding: 'utf-8', timeout: 300000 });
      expect(result.status).toBe(0);
      expect(result.stdout).toContain('FORCED OVERWRITE docs/context.md');
      expect(result.stdout).toContain('1 project-only section(s) discarded');

      // Template version applied: project-only section gone, footer back at template text.
      const applied = readFileSync(join(tmp, 'docs', 'context.md'), 'utf8');
      expect(applied).not.toContain('## Project Only Section');
      // Footer version asserted against the LIVE template (not a hardcoded
      // literal — the 2.6 pin broke on the 2026-09-13 footer 2.7 bump).
      const liveVersion = readFileSync(contextTemplatePath, 'utf8').match(/\*context\.md version: [^*\n]+\*/);
      expect(liveVersion).not.toBeNull();
      expect(applied).toContain(liveVersion![0]);
      expect(applied).toBe(readFileSync(contextTemplatePath, 'utf8'));
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  }, 400000);

  test('c. no project-only content (drift inside shared sections) → UPDATE fires unchanged', () => {
    const tmp = makeTempProject();
    try {
      // Same shared headings as the template; only inline wording inside a shared
      // section drifted + footer is one version behind.
      const seededContent = templateWithOlderFooter().replace(
        '#### Schema Governance',
        '#### Schema Governance (local note)',
      );
      expect(seededContent).not.toBe(readFileSync(contextTemplatePath, 'utf8'));
      seedProjectContext(tmp, seededContent);

      const result = spawnSync('bun', [upgradeScript, tmp, '--variant', VARIANT, '--yes'],
        { encoding: 'utf-8', timeout: 300000 });
      expect(result.status).toBe(0);
      expect(result.stdout).not.toContain('CONTEXT PRESERVE');
      expect(result.stdout).toMatch(/UPDATE docs\/context\.md/);

      // The template version was applied (current pre-preservation behavior preserved).
      expect(readFileSync(join(tmp, 'docs', 'context.md'), 'utf8'))
        .toBe(readFileSync(contextTemplatePath, 'utf8'));
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  }, 400000);

  test('d. project copy with no version footer → PRESERVE (wholeFileOwned)', () => {
    const tmp = makeTempProject();
    try {
      const tpl = readFileSync(contextTemplatePath, 'utf8');
      const footerMatch = tpl.match(FOOTER_RE)!;
      const noFooter = tpl.slice(0, footerMatch.index).trimEnd() + '\n';
      seedProjectContext(tmp, noFooter);

      const result = spawnSync('bun', [upgradeScript, tmp, '--variant', VARIANT, '--yes'],
        { encoding: 'utf-8', timeout: 300000 });
      expect(result.status).toBe(0);
      expect(result.stdout).toContain('CONTEXT PRESERVE docs/context.md');
      expect(result.stdout).toContain('(entire file — no version footer; treated as project-owned)');
      expect(readFileSync(join(tmp, 'docs', 'context.md'), 'utf8')).toBe(noFooter);
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  }, 400000);
});

// ── IDENTITY SEED (AC5a regression — spec 2026-09-24-scaffold-identity-overview-design §13) ──
// The TEMPLATE TREE SYNC walk enumerates template-side files only, so docs/project.md can
// never be delivered by the upgrade-policy ADD_IF_MISSING claim (no template-side
// counterpart; docs/project.template.md stays TEMPLATE_ONLY). §13 added a dedicated
// add-if-missing seed step after that pass. These tests pin the seed contract: verdict
// style, TODO(project-overview) fallback survival (audit-WARN-visible per R4), dry-run
// write parity, and the AC4 never-overwrite guarantee.
describe('upgrade-project.ts IDENTITY SEED (docs/project.md, §13.2)', () => {
  test('AC5a-a: absent docs/project.md → dry-run prints the seed verdict, writes nothing', () => {
    const tmp = makeTempProject();
    try {
      const result = spawnSync('bun', [upgradeScript, tmp, '--variant', VARIANT, '--dry-run', '--yes'],
        { encoding: 'utf-8', timeout: 300000 });
      expect(result.status).toBe(0);
      expect(result.stdout).toContain('NEW    docs/project.md  (identity seed — add-if-missing)');
      expect(existsSync(join(tmp, 'docs', 'project.md'))).toBe(false);
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  }, 300000);

  test('AC5a-b: apply run seeds docs/project.md with the TODO(project-overview) fallback intact', () => {
    const tmp = makeTempProject();
    try {
      const result = spawnSync('bun', [upgradeScript, tmp, '--variant', VARIANT, '--yes'],
        { encoding: 'utf-8', timeout: 300000 });
      expect(result.status).toBe(0);
      expect(result.stdout).toContain('NEW    docs/project.md  (identity seed — add-if-missing)');
      const seeded = readFileSync(join(tmp, 'docs', 'project.md'), 'utf8');
      // applySubstitutions rendered the project name from basename(projectDir)…
      expect(seeded).not.toContain('[Project Name]');
      // …while the non-token TODO(project-overview) fallback lines survived untouched
      // (an undescribed seeded project lands in the audit-WARN-visible state R4 intends).
      expect(seeded).toContain('TODO(project-overview): [One-sentence description');
      expect(seeded).toContain('TODO(project-overview): [TBD]');
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  }, 300000);

  test('AC5a-c: second run seeds nothing — no verdict, file byte-unchanged', () => {
    const tmp = makeTempProject();
    try {
      const first = spawnSync('bun', [upgradeScript, tmp, '--variant', VARIANT, '--yes'],
        { encoding: 'utf-8', timeout: 300000 });
      expect(first.status).toBe(0);
      const seeded = readFileSync(join(tmp, 'docs', 'project.md'), 'utf8');

      const second = spawnSync('bun', [upgradeScript, tmp, '--variant', VARIANT, '--yes'],
        { encoding: 'utf-8', timeout: 300000 });
      expect(second.status).toBe(0);
      expect(second.stdout).not.toContain('(identity seed');
      expect(readFileSync(join(tmp, 'docs', 'project.md'), 'utf8')).toBe(seeded);
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  }, 600000);

  test('AC5a-d: pre-existing user-edited docs/project.md is never written (AC4)', () => {
    const tmp = makeTempProject();
    try {
      const dest = join(tmp, 'docs', 'project.md');
      mkdirSync(join(tmp, 'docs'), { recursive: true });
      writeFileSync(dest, '# user-edited — Project Overview\n\n- **Description**: Our real description.\n- **Type**: api\n');
      spawnSync('git', ['-C', tmp, 'add', '-A'], { cwd: tmp });
      spawnSync('git', ['-C', tmp, 'commit', '-q', '-m', 'chore: user identity'], { cwd: tmp });

      const result = spawnSync('bun', [upgradeScript, tmp, '--variant', VARIANT, '--dry-run', '--yes'],
        { encoding: 'utf-8', timeout: 300000 });
      expect(result.status).toBe(0);
      expect(result.stdout).not.toContain('(identity seed');
      expect(readFileSync(dest, 'utf8')).toContain('Our real description.');
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  }, 300000);
});

describe('upgrade-project.ts IDENTITY SEED — dirty-tree corner (§13.2 guard)', () => {
  test('AC5a-e: present-but-uncommitted docs/project.md is never seeded (dirty-tree guard)', () => {
    const tmp = makeTempProject();
    try {
      const dest = join(tmp, 'docs', 'project.md');
      mkdirSync(join(tmp, 'docs'), { recursive: true });
      // Present but deliberately NOT committed (no HEAD in this fixture, so the
      // pre-upgrade rollback snapshot is skipped and the file stays on disk):
      // preUpgradeDirty carries the path, and isLocallyModified must keep the
      // seed off — AC4 holds for dirty trees, not just committed ones.
      writeFileSync(dest, '# user-edited uncommitted — Project Overview\n\n- **Description**: Uncommitted identity.\n- **Type**: web\n');
      const result = spawnSync('bun', [upgradeScript, tmp, '--variant', VARIANT, '--yes'],
        { encoding: 'utf-8', timeout: 300000 });
      expect(result.status).toBe(0);
      expect(result.stdout).not.toContain('(identity seed');
      expect(readFileSync(dest, 'utf8')).toContain('Uncommitted identity.');
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  }, 300000);
});
