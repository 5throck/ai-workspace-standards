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
 * v1.2.0 (2026-09-24, platform-parity P1 bugs 3+4 — spec
 *         docs/designs/2026-09-24-platform-parity-p1-bugfixes-design.md D3/D4/D8):
 *         new CODEX OVERWRITE GUARDS describe block — the VARIANT ASSET DIRS pass
 *         must skip the variant's top-level .codex/ (project .codex/** is
 *         ADD_IF_MISSING per upgrade-policy), and a divergent project CODEX.md
 *         must get no TEMPLATE TREE SYNC overwrite verdict (MERGE_MANAGED claim).
 *
 * v1.3.0 (2026-09-25, T-20260924-010/-011 — spec
 *         2026-09-25-codex-merge-claim-routing-design.md D4 rows 2+4): two new
 *         describe blocks. CODEX MERGE — an apply-mode upgrade merges a stale
 *         COMMON-CODEX zone into a customized project CODEX.md (byte-identical
 *         prose outside the zone, no overwrite verdict from any non-MERGE pass).
 *         VARIANT ASSET DIRS CLAIM ROUTING — a committed project edit under
 *         procedures/<owned-entry>/ is never overwritten by the asset-dir pass
 *         (the dedicated PROCEDURES pass owns the entry); a missing entry is
 *         still seeded NEW.
 *
 * @version 1.3.0
 */
import { cpSync, existsSync, mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
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

// ============================================================================
// CODEX OVERWRITE GUARDS (P1 bugs 3+4 — spec 2026-09-24-platform-parity-p1-bugfixes-design.md D3/D4/D8)
// The VARIANT ASSET DIRS pass must never treat the variant's top-level .codex/
// as a generic asset dir (project .codex/** is ADD_IF_MISSING, ADR-0076 D4), and
// a divergent project CODEX.md must get no TEMPLATE TREE SYNC overwrite verdict
// (CODEX.md joins MERGE_MANAGED_FILES — the MERGE pass owns delivery).
// ============================================================================
describe('upgrade-project.ts CODEX OVERWRITE GUARDS (P1 bugs 3+4)', () => {
  test('divergent project .codex file and CODEX.md get no overwrite verdicts (dry-run exits 0)', () => {
    const tmp = makeTempProject();
    try {
      // Project-owned copy of a co-develop .codex template file, deliberately
      // divergent — pre-fix the VARIANT ASSET DIRS pass hash-synced it
      // (UPDATE/COPIED verdicts), overwriting project-owned Codex config.
      mkdirSync(join(tmp, '.codex', 'prompts'), { recursive: true });
      writeFileSync(join(tmp, '.codex', 'prompts', 'security-check.md'),
        '# project-owned security prompt — local customization\n');
      // Divergent project CODEX.md (committed → clean tree → the tree-sync hash
      // branch fires pre-fix and wholesale-overwrites with the raw template).
      writeFileSync(join(tmp, 'CODEX.md'),
        '# CODEX.md — project-customized\n\nMy local agent instructions that must survive upgrades.\n');

      spawnSync('git', ['-C', tmp, 'add', '-A'], { cwd: tmp });
      spawnSync('git', ['-C', tmp, 'commit', '-q', '-m', 'chore: project-owned codex state'], { cwd: tmp });

      const result = spawnSync(
        'bun',
        [upgradeScript, tmp, '--variant', VARIANT, '--dry-run', '--yes'],
        { encoding: 'utf-8', timeout: 300000 }
      );
      if (result.status !== 0) {
        console.error('stdout:', (result.stdout ?? '').slice(-3000));
        console.error('stderr:', (result.stderr ?? '').slice(0, 2000));
      }
      // Integration guard (D8): the full run must exit 0 — the skip-set change
      // must not disturb neighboring passes.
      expect(result.status).toBe(0);
      const out = result.stdout ?? '';

      // Bug 3: no VARIANT ASSET DIRS verdict for the project-owned .codex file.
      expect(out).not.toContain('UPDATE .codex/prompts/security-check.md');
      expect(out).not.toContain('COPIED: .codex/prompts/security-check.md');

      // Bug 4 (integration assert): no TEMPLATE TREE SYNC overwrite verdict for
      // the divergent project CODEX.md. (The MERGE pass still prints its own
      // "MERGE: CODEX.md" line — that is the owning pass, not an overwrite.)
      expect(out).not.toContain('UPDATE CODEX.md');
      expect(out).not.toContain('COPIED: CODEX.md');
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  }, 300000);
});

// ============================================================================
// CODEX MERGE (T-20260924-010 — spec 2026-09-25-codex-merge-claim-routing-design.md D4 row 2)
// With the COMMON-CODEX pattern in MANAGED_PATTERNS, the MERGE pass delivers the
// template zone into project CODEX.md copies: stale zone refreshed from the
// template, prose outside the zone preserved byte-for-byte, no overwrite verdict
// from any pass other than MERGE.
// ============================================================================
describe('upgrade-project.ts CODEX MERGE (COMMON-CODEX zone — T-20260924-010)', () => {
  const codexTemplatePath = join(workspaceRoot, 'templates', 'common', 'CODEX.md');
  const ZONE_RE = /<!-- COMMON-CODEX:START -->[\s\S]*?<!-- COMMON-CODEX:END -->/;
  const PROSE_SENTINEL = 'Project-owned intro line that must survive every upgrade.';

  /** Project CODEX.md seeded from the live common template: zone interior made
   *  stale (marker text untouched) + one project-owned prose line before the zone. */
  function seededProjectCodex(): string {
    const tpl = readFileSync(codexTemplatePath, 'utf8');
    const tplZone = tpl.match(ZONE_RE)![0];
    const staleZone = tplZone.replace('Skill Resolution Priority', 'Skill Resolution Priority (STALE COPY)');
    expect(staleZone).not.toBe(tplZone);
    return tpl
      .replace(ZONE_RE, () => staleZone)
      .replace('<!-- COMMON-CODEX:START -->', () => `${PROSE_SENTINEL}\n\n<!-- COMMON-CODEX:START -->`);
  }

  function seedCommittedCodex(tmp: string): string {
    const seeded = seededProjectCodex();
    writeFileSync(join(tmp, 'CODEX.md'), seeded);
    spawnSync('git', ['-C', tmp, 'add', '-A'], { cwd: tmp });
    spawnSync('git', ['-C', tmp, 'commit', '-q', '-m', 'chore: seeded CODEX.md'], { cwd: tmp });
    return seeded;
  }

  test('apply run merges the stale COMMON-CODEX zone; customized prose survives byte-identical', () => {
    const tmp = makeTempProject();
    try {
      const seeded = seedCommittedCodex(tmp);
      const result = spawnSync(
        'bun',
        [upgradeScript, tmp, '--variant', VARIANT, '--yes'],
        { encoding: 'utf-8', timeout: 300000 }
      );
      if (result.status !== 0) {
        console.error('stdout:', (result.stdout ?? '').slice(-3000));
        console.error('stderr:', (result.stderr ?? '').slice(0, 2000));
      }
      expect(result.status).toBe(0);
      const out = result.stdout ?? '';
      // The MERGE pass owns the file and delivered the zone union.
      expect(out).toContain('MERGE: CODEX.md');
      expect(out).toContain('MERGED COMMON-CODEX block in: CODEX.md');

      const applied = readFileSync(join(tmp, 'CODEX.md'), 'utf8');
      const tplZone = readFileSync(codexTemplatePath, 'utf8').match(ZONE_RE)![0];
      const projZone = seeded.match(ZONE_RE)![0];
      // Zone refreshed to the template's bytes…
      expect(applied.match(ZONE_RE)![0]).toBe(tplZone);
      expect(applied).not.toContain('(STALE COPY)');
      // …and the result is EXACTLY the seeded file with only the zone span
      // replaced — outside-zone prose byte-identical.
      expect(applied).toBe(seeded.replace(projZone, () => tplZone));
      expect(applied).toContain(PROSE_SENTINEL);
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  }, 300000);

  test('no overwrite verdict for CODEX.md from any pass other than MERGE (holds pre- and post-fix)', () => {
    const tmp = makeTempProject();
    try {
      seedCommittedCodex(tmp);
      const result = spawnSync(
        'bun',
        [upgradeScript, tmp, '--variant', VARIANT, '--dry-run', '--yes'],
        { encoding: 'utf-8', timeout: 300000 }
      );
      expect(result.status).toBe(0);
      const out = result.stdout ?? '';
      expect(out).toContain('MERGE: CODEX.md');
      expect(out).not.toContain('UPDATE CODEX.md');
      expect(out).not.toContain('COPIED: CODEX.md');
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  }, 300000);
});

// ============================================================================
// VARIANT ASSET DIRS CLAIM ROUTING (T-20260924-011 — spec 2026-09-25-codex-merge-claim-routing-design.md D4 row 4)
// The asset-dir pass must deliver only files whose resolveClaim pass is the
// VARIANT ASSET DIRS pass. procedures/** claims ADD_IF_MISSING on the dedicated
// PROCEDURES pass — a committed project edit under an owned procedure entry is
// never overwritten by the asset pass; a missing entry is still seeded NEW.
// ============================================================================
describe('upgrade-project.ts VARIANT ASSET DIRS claim routing (T-20260924-011)', () => {
  test('modified committed procedure file under an owned entry survives the upgrade', () => {
    const tmp = makeTempProject();
    try {
      // Seed procedures/ from the variant template, then:
      //  - architecture-design/schema.yaml: locally modified + committed (clean tree)
      //  - technical-planning/: left untouched (hash-equal)
      //  - security-release-retrospective/: deleted → the PROCEDURES pass must
      //    still seed it NEW (its add-if-missing contract).
      const tplProc = join(workspaceRoot, 'templates', VARIANT, 'procedures');
      mkdirSync(join(tmp, 'procedures'), { recursive: true });
      for (const entry of ['architecture-design', 'technical-planning', 'security-release-retrospective', '_output-types.yaml']) {
        const src = join(tplProc, entry);
        expect(existsSync(src)).toBe(true);
        cpSync(src, join(tmp, 'procedures', entry), { recursive: true });
      }
      const modifiedRel = join('procedures', 'architecture-design', 'schema.yaml');
      const modifiedContent = readFileSync(join(tmp, modifiedRel), 'utf8')
        + '\n# project-local workflow edit that must survive the upgrade\n';
      writeFileSync(join(tmp, modifiedRel), modifiedContent);
      rmSync(join(tmp, 'procedures', 'security-release-retrospective'), { recursive: true, force: true });
      spawnSync('git', ['-C', tmp, 'add', '-A'], { cwd: tmp });
      spawnSync('git', ['-C', tmp, 'commit', '-q', '-m', 'chore: seeded procedures'], { cwd: tmp });

      const result = spawnSync(
        'bun',
        [upgradeScript, tmp, '--variant', VARIANT, '--yes'],
        { encoding: 'utf-8', timeout: 300000 }
      );
      if (result.status !== 0) {
        console.error('stdout:', (result.stdout ?? '').slice(-3000));
        console.error('stderr:', (result.stderr ?? '').slice(0, 2000));
      }
      expect(result.status).toBe(0);
      const out = result.stdout ?? '';

      // No asset-dir verdict for any procedures/ path — the modified file is
      // neither UPDATEd nor CONFLICT-reported nor COPIED by this pass.
      expect(out).not.toContain('UPDATE procedures/');
      expect(out).not.toContain('CONFLICT procedures/');
      expect(out).not.toContain('COPIED: procedures/');

      // The dedicated PROCEDURES pass reports the owned entries preserved…
      expect(out).toContain('OK     procedures/architecture-design/  (project-owned — preserved)');
      expect(out).toContain('OK     procedures/technical-planning/  (project-owned — preserved)');
      // …and still seeds the missing entry NEW.
      expect(out).toContain('NEW    procedures/security-release-retrospective/');
      expect(existsSync(join(tmp, 'procedures', 'security-release-retrospective'))).toBe(true);

      // Bytes: the committed project edit survived; the untouched entry is
      // hash-equal to the template (unchanged).
      expect(readFileSync(join(tmp, modifiedRel), 'utf8')).toBe(modifiedContent);
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  }, 300000);

  test('positive control: a divergent unmodified generic-asset file still gets UPDATE + template content (co-design decisions/)', () => {
    // D4 row 5: proves the claim filter did not neuter the pass — files whose
    // claim pass IS the VARIANT ASSET DIRS pass keep the hash-sync semantics.
    const CONTROL_VARIANT = 'co-design';
    const tmp = makeTempProject();
    try {
      // Seed decisions/gates.yaml from the co-design template, diverge it
      // project-side, commit (clean tree → UPDATE, not CONFLICT).
      const rel = join('decisions', 'gates.yaml');
      const tplContent = readFileSync(join(workspaceRoot, 'templates', CONTROL_VARIANT, rel), 'utf8');
      mkdirSync(join(tmp, 'decisions'), { recursive: true });
      writeFileSync(join(tmp, rel), tplContent + '\n# project-side divergence that the pass must overwrite back\n');
      spawnSync('git', ['-C', tmp, 'add', '-A'], { cwd: tmp });
      spawnSync('git', ['-C', tmp, 'commit', '-q', '-m', 'chore: diverged decisions file'], { cwd: tmp });

      const result = spawnSync(
        'bun',
        [upgradeScript, tmp, '--variant', CONTROL_VARIANT, '--yes'],
        { encoding: 'utf-8', timeout: 300000 }
      );
      if (result.status !== 0) {
        console.error('stdout:', (result.stdout ?? '').slice(-3000));
        console.error('stderr:', (result.stderr ?? '').slice(0, 2000));
      }
      expect(result.status).toBe(0);
      const out = result.stdout ?? '';
      expect(out).toContain('UPDATE decisions/gates.yaml');
      expect(out).toContain('COPIED: decisions/gates.yaml');
      // Template content restored (the divergence was overwritten back).
      expect(readFileSync(join(tmp, rel), 'utf8')).toBe(tplContent);
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  }, 300000);
});
