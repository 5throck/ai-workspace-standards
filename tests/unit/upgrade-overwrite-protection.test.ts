/**
 * Engine replay fixtures for the upgrade overwrite-protection design PR-A
 * (docs/designs/2026-11-11-upgrade-overwrite-protection-design.md, DEC-20261111-01):
 *
 *  - E1 EVOLVED_PRESERVE — a PROJECT_EVOLVED file whose template content did not
 *    change since the baseline is preserved (SKIP, baseline kept, WARN), on every
 *    hash/version-gated pass (DOCS_OVERWRITE, TEMPLATE TREE SYNC), including the
 *    co-newbiz `delete-merged-branches.yml` re-stale loop and the co-deck
 *    `docs/phase-definitions.md` / yaml shapes of the fleet audit
 *    (docs/reports/2026-11-11-template-overwrite-fleet-audit.md). The
 *    --disposition adopt-template grant is the only restore path.
 *  - A1 marker recognition — every LOCAL-PATCH form flips an unbaselined
 *    divergence to CONFLICT (ERROR) (design replay fixture 3).
 *  - E2 MARKER_LOSS (ERROR) on the non-guard write paths: equal-version script
 *    restore, core-locked restore, agents/ drift restore, whole-skill-directory
 *    copy, ci.yml MERGE, instruction-file MERGE, prune, and the platform
 *    skill-mirror regeneration; an unmarked control row per path proves the
 *    guard fires on markers only. Dry-run vs apply parity is asserted per path.
 *
 * Engine runs spawn scripts/upgrade-project.ts against a temp project and the
 * real workspace templates (the upgrade-decision-log pattern). One run per
 * seeded shape; scenarios ride the shared run as read-only assertions.
 *
 * @version 1.0.3 (file joins the test-runner FILE_TIME_BUDGETS; every in-body engine spawn carries a 60s per-test budget)
 * v1.0.1 (re-stale loop test gets a 60s per-test budget — windows-latest 15.03s vs 15s ceiling)
 */
import { existsSync, mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { describe, test, expect, afterAll } from 'bun:test';

import { baselineKeyFor, type DecisionBaseline } from '../../scripts/lib/upgrade-policy.ts';
import { gitCleanEnv } from '../../scripts/lib/git-env.ts';
import { assertCallerEnvSafeForGitFixtures, assertFixtureGitIdentity } from '../helpers/fixture-git.ts';

const workspaceRoot = resolve(import.meta.dir, '..', '..');
const upgradeScript = join(workspaceRoot, 'scripts', 'upgrade-project.ts');
const VARIANT = 'co-develop';

const tmpDirs: string[] = [];
afterAll(() => {
  for (const d of tmpDirs) rmSync(d, { recursive: true, force: true });
});

function git(tmp: string, ...args: string[]): void {
  spawnSync('git', ['-C', tmp, ...args], { env: gitCleanEnv(), stdio: ['ignore', 'pipe', 'pipe'] });
}

function makeTempProject(): string {
  const tmp = mkdtempSync(join(tmpdir(), 'upgrade-overwrite-protection-'));
  tmpDirs.push(tmp);
  assertCallerEnvSafeForGitFixtures(tmp);
  spawnSync('git', ['init', '-q'], { cwd: tmp, env: gitCleanEnv(), stdio: ['ignore', 'pipe', 'pipe'] });
  assertFixtureGitIdentity(tmp);
  git(tmp, 'config', 'user.email', 'test@example.com');
  git(tmp, 'config', 'user.name', 'Test');
  mkdirSync(join(tmp, '.claude'), { recursive: true });
  writeFileSync(join(tmp, '.claude', 'template-version.txt'), `variant=${VARIANT}\nversion=0.0.0\ncountry=none\n`);
  return tmp;
}

function commitAll(tmp: string, message: string): void {
  git(tmp, 'add', '-A');
  git(tmp, 'commit', '-q', '-m', message);
}

function runUpgrade(tmp: string, extraArgs: string[] = []): { status: number; out: string } {
  const result = spawnSync('bun', [upgradeScript, tmp, '--variant', VARIANT, '--yes', ...extraArgs], {
    encoding: 'utf-8',
    timeout: 300000,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  return { status: result.status ?? -1, out: `${result.stdout ?? ''}\n${result.stderr ?? ''}` };
}

interface Decision {
  path: string;
  policy: string;
  pass: string;
  verdict: string;
  severity: string;
  detail: string;
}
interface Manifest {
  files: string[];
  baselines: Record<string, DecisionBaseline>;
  decisions: Decision[];
}
const readManifest = (tmp: string): Manifest =>
  JSON.parse(readFileSync(join(tmp, '.claude', 'last-upgrade-delivery.json'), 'utf8'));
// The preserve-list pass (policy PRESERVE) adds an unrelated INFO SKIP row for listed docs; the
// delivery-decision rows under test are everything else.
const rowsFor = (m: Manifest, path: string): Decision[] =>
  m.decisions.filter((d) => d.path === path && d.policy !== 'PRESERVE');
const verdictsFor = (m: Manifest, path: string): string[] => rowsFor(m, path).map((d) => d.verdict);

/** resolveTemplate semantics: the variant copy wins over common. */
function templateBytes(rel: string): string {
  const variantCopy = join(workspaceRoot, 'templates', VARIANT, rel);
  return readFileSync(existsSync(variantCopy) ? variantCopy : join(workspaceRoot, 'templates', 'common', rel), 'utf8');
}

function write(tmp: string, rel: string, content: string): void {
  mkdirSync(dirname(join(tmp, rel)), { recursive: true });
  writeFileSync(join(tmp, rel), content);
}
const read = (tmp: string, rel: string): string => readFileSync(join(tmp, rel), 'utf8');

/** Seed (or extend) a v2 prior-delivery manifest recording `rel`'s baseline. */
function seedBaseline(tmp: string, rel: string, baselineContent: string): void {
  const manifestPath = join(tmp, '.claude', 'last-upgrade-delivery.json');
  const manifest = existsSync(manifestPath)
    ? JSON.parse(readFileSync(manifestPath, 'utf8'))
    : { schemaVersion: 2, timestamp: 'test', project: 'fixture', templateVersion: '0.0.0', templateSha: '', baseSha: '', files: [], baselines: {}, decisions: [] };
  manifest.baselines[rel] = { hash: baselineKeyFor(rel, baselineContent), templateVersion: '0.0.0' };
  if (!manifest.files.includes(rel)) manifest.files.push(rel);
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
}

const SKIP_LINE = (verdictLabel: string, rel: string): string => `${verdictLabel} (SKIP): ${rel}`;

// ═════════════════════════════════════════════════════════════════════════════
// E1 — EVOLVED_PRESERVE
// ═════════════════════════════════════════════════════════════════════════════

describe('E1 EVOLVED_PRESERVE (DEC-20261111-01 D1) — engine', () => {
  // co-deck audit cases #1/#2 (yaml / docs shape), the co-newbiz delete-merged-branches.yml
  // re-stale loop: baseline == today's template bytes, the project added content.
  const PHASE_DEFS = 'docs/phase-definitions.md'; // DOCS_OVERWRITE
  const WORKFLOWS = 'docs/governance/agents/workflows.md'; // TEMPLATE TREE SYNC
  const RESTALE = '.github/workflows/delete-merged-branches.yml'; // TEMPLATE TREE SYNC (co-newbiz loop)
  const rels = [PHASE_DEFS, WORKFLOWS, RESTALE];
  const evolvedOf = (rel: string): string => `${templateBytes(rel).trimEnd()}\n# project-only addition for ${rel}\n`;

  function seed(): string {
    const tmp = makeTempProject();
    for (const rel of rels) {
      write(tmp, rel, evolvedOf(rel));
      seedBaseline(tmp, rel, templateBytes(rel));
    }
    commitAll(tmp, 'seed evolved project');
    return tmp;
  }

  const dryProject = seed();
  const dry = runUpgrade(dryProject, ['--dry-run']);
  const applyProject = seed();
  const apply = runUpgrade(applyProject);
  const m1 = readManifest(applyProject);

  test('every evolved file is preserved byte-for-byte on the apply run', () => {
    for (const rel of rels) expect(read(applyProject, rel)).toBe(evolvedOf(rel));
  });

  test('each path records exactly EVOLVED_PRESERVE at WARN (no EVOLVED / ADOPT / CONFLICT row)', () => {
    for (const rel of rels) {
      const rows = rowsFor(m1, rel);
      expect(rows.map((r) => r.verdict)).toEqual(['EVOLVED_PRESERVE']);
      expect(rows[0].severity).toBe('WARN');
      expect(rows[0].detail).toContain('baseline kept');
    }
  });

  test('WARN-only: the run exits 0 and the delivered set (files[]) excludes the preserved paths', () => {
    expect(apply.status).toBe(0);
    for (const rel of rels) expect(m1.files).not.toContain(rel);
  });

  test('the baseline is kept (carry-forward) — not refreshed to the project bytes', () => {
    for (const rel of rels) {
      expect(m1.baselines[rel]).toEqual({ hash: baselineKeyFor(rel, templateBytes(rel)), templateVersion: '0.0.0' });
    }
  });

  test('the exit summary lists the preserved files and the way out', () => {
    expect(apply.out).toContain('PRESERVED (project-evolved, template unchanged)');
    for (const rel of rels) expect(apply.out).toContain(rel);
    expect(apply.out).toContain('--disposition adopt-template');
  });

  test('dry-run parity: identical PRESERVE rows, exit code and zero writes', () => {
    expect(dry.status).toBe(apply.status);
    const preserveLines = (out: string): string[] =>
      out.split('\n').filter((l) => l.includes('PRESERVE (project-evolved, template unchanged)')).sort();
    expect(preserveLines(dry.out)).toEqual(preserveLines(apply.out));
    expect(preserveLines(dry.out).length).toBe(rels.length);
    for (const rel of rels) expect(read(dryProject, rel)).toBe(evolvedOf(rel));
  });

  test('re-stale loop (co-newbiz): the second run gives the same verdict and still delivers nothing', () => {
    commitAll(applyProject, 'land first run');
    const second = runUpgrade(applyProject);
    expect(second.status).toBe(0);
    const m2 = readManifest(applyProject);
    for (const rel of rels) {
      expect(verdictsFor(m2, rel)).toEqual(['EVOLVED_PRESERVE']);
      expect(read(applyProject, rel)).toBe(evolvedOf(rel));
      expect(m2.baselines[rel].hash).toBe(baselineKeyFor(rel, templateBytes(rel)));
    }
    // This test spawns a full engine run inside the test body (a multi-step lifecycle that
    // cannot ride the shared run); windows-latest measured 15.03s against the 15s default
    // ceiling (PR #1963), so it carries an explicit per-test budget. Assertions unchanged.
  }, 60000);

  test('--disposition adopt-template=<path> is the only restore path and covers only that path', () => {
    const tmp = seed();
    const granted = runUpgrade(tmp, [`--disposition`, `adopt-template=${PHASE_DEFS}`]);
    expect(granted.status).toBe(0);
    const m = readManifest(tmp);
    expect(read(tmp, PHASE_DEFS)).toBe(templateBytes(PHASE_DEFS));
    expect(verdictsFor(m, PHASE_DEFS)).toContain('ADOPT');
    expect(verdictsFor(m, PHASE_DEFS)).not.toContain('EVOLVED_PRESERVE');
    // The un-granted paths stay preserved.
    for (const rel of [WORKFLOWS, RESTALE]) {
      expect(read(tmp, rel)).toBe(evolvedOf(rel));
      expect(verdictsFor(m, rel)).toEqual(['EVOLVED_PRESERVE']);
    }
  }, 60000);

  test('regression guard: template changed + project evolved is still CONFLICT (ERROR), exit 1', () => {
    const tmp = makeTempProject();
    // baseline differs from today's template => templateChanged
    write(tmp, PHASE_DEFS, `${templateBytes(PHASE_DEFS).trimEnd()}\n# project-only\n`);
    seedBaseline(tmp, PHASE_DEFS, '# an older delivered revision\n');
    commitAll(tmp, 'seed');
    const r = runUpgrade(tmp);
    expect(r.status).toBe(1);
    const rows = rowsFor(readManifest(tmp), PHASE_DEFS);
    expect(rows.map((x) => x.verdict)).toEqual(['CONFLICT']);
    expect(rows[0].severity).toBe('ERROR');
  }, 60000);

  test('UNTOUCHED + template changed still delivers (preserve fires only for project evolution)', () => {
    const tmp = makeTempProject();
    const old = '# old delivered revision\n';
    write(tmp, PHASE_DEFS, old);
    seedBaseline(tmp, PHASE_DEFS, old);
    commitAll(tmp, 'seed');
    const r = runUpgrade(tmp);
    expect(r.status).toBe(0);
    expect(read(tmp, PHASE_DEFS)).toBe(templateBytes(PHASE_DEFS));
  }, 60000);
});

// ═════════════════════════════════════════════════════════════════════════════
// A1 — every LOCAL-PATCH form is a marker (design replay fixture 3)
// ═════════════════════════════════════════════════════════════════════════════

describe('A1 marker forms — NO_BASELINE divergence is CONFLICT for every LOCAL-PATCH form', () => {
  const CASES: Array<{ rel: string; marker: string }> = [
    { rel: 'docs/governance/agents/workflows.md', marker: '<!-- LOCAL-PATCH(upstream-request: U-20991231-001): upstream form -->' },
    { rel: 'docs/governance/agents/execution-plan-templates.md', marker: '<!-- LOCAL-PATCH (design: DG-DECK-06 fallback): field form -->' },
    { rel: 'docs/phase-definitions.md', marker: '<!-- LOCAL-PATCH(project-local): project form -->' },
    { rel: '.github/workflows/delete-merged-branches.yml', marker: '# LOCAL-PATCH U-20261108-002 bare form' },
  ];
  const tmp = makeTempProject();
  for (const c of CASES) write(tmp, c.rel, `${templateBytes(c.rel).trimEnd()}\n${c.marker}\n`);
  commitAll(tmp, 'seed marked, never-baselined project');
  const r = runUpgrade(tmp);
  const m = readManifest(tmp);

  test('exit 1 — each marked, unbaselined divergence is CONFLICT (ERROR) and preserved', () => {
    expect(r.status).toBe(1);
    for (const c of CASES) {
      const rows = rowsFor(m, c.rel);
      expect(rows[0].verdict).toBe('CONFLICT');
      expect(rows[0].severity).toBe('ERROR');
      expect(rows[0].detail).toContain('LOCAL-PATCH marker');
      expect(read(tmp, c.rel)).toBe(`${templateBytes(c.rel).trimEnd()}\n${c.marker}\n`);
    }
  });

  test('the same divergence WITHOUT a marker stays UNBASELINED_OVERWRITE (WARN) and delivers', () => {
    const t2 = makeTempProject();
    const rel = 'docs/phase-definitions.md';
    write(t2, rel, `${templateBytes(rel).trimEnd()}\nunmarked project edit\n`);
    commitAll(t2, 'seed');
    const r2 = runUpgrade(t2);
    expect(r2.status).toBe(0);
    expect(verdictsFor(readManifest(t2), rel)).toContain('UNBASELINED_OVERWRITE');
    expect(read(t2, rel)).toBe(templateBytes(rel));
  }, 60000);

  test('an adopt grant overrides the A1 CONFLICT for the marked path', () => {
    const c = CASES[2];
    const t3 = makeTempProject();
    write(t3, c.rel, `${templateBytes(c.rel).trimEnd()}\n${c.marker}\n`);
    commitAll(t3, 'seed');
    const r3 = runUpgrade(t3, ['--disposition', `adopt-template=${c.rel}`]);
    expect(r3.status).toBe(0);
    expect(read(t3, c.rel)).toBe(templateBytes(c.rel));
  }, 60000);
});

// ═════════════════════════════════════════════════════════════════════════════
// E2 — MARKER_LOSS on the non-guard write paths
// ═════════════════════════════════════════════════════════════════════════════

describe('E2 MARKER_LOSS — every delivery path (DEC-20261111-01 D4)', () => {
  const MARK = '// LOCAL-PATCH(project-local): keep this project change';
  const withMark = (text: string): string => `${text.trimEnd()}\n${MARK}\n`;

  const EQUAL_SCRIPT = 'scripts/lib/git-env.ts'; // versioned; equal-version restore arm
  const EQUAL_CONTROL = 'scripts/lib/hermetic-test-roots.ts'; // same arm, unmarked control
  const CORE_MARKED = 'scripts/dev-sync.ts'; // core-locked script, marked equal-version fork
  const CORE_CONTROL = 'scripts/audit.ts'; // core-locked script, unmarked equal-version fork
  const AGENT = 'agents/architect.md'; // agents/ equal-version drift arm
  const SKILL = 'skills/explain-me/SKILL.md';
  const SKILL_SUB = 'skills/explain-me/references/BUILD_GUIDE.md';
  const CI = '.github/workflows/ci.yml';
  const MIRROR = '.claude/skills/local-only/SKILL.md';

  const tplVersion = (rel: string): string => templateBytes(rel).match(/@version\s+(\d+\.\d+\.\d+)/)?.[1] ?? '';

  function seed(): string {
    const tmp = makeTempProject();
    // equal-version restore arm: same @version, different bytes
    write(tmp, EQUAL_SCRIPT, withMark(templateBytes(EQUAL_SCRIPT)));
    write(tmp, EQUAL_CONTROL, `${templateBytes(EQUAL_CONTROL).trimEnd()}\n// unmarked local fork\n`);
    // core scripts, equal-version forks
    write(tmp, CORE_MARKED, withMark(templateBytes(CORE_MARKED)));
    write(tmp, CORE_CONTROL, `${templateBytes(CORE_CONTROL).trimEnd()}\n// unmarked local fork\n`);
    // agents/ drift arm: same frontmatter version, forked body, no baseline
    write(tmp, AGENT, withMark(templateBytes(AGENT)));
    // ci.yml: a marker inside a template-owned job
    write(tmp, CI, `${templateBytes(CI).trimEnd()}\n`.replace(/^(jobs:\n(?:.*\n)*?  audit:\n)/m, '$1    # LOCAL-PATCH(project-local): extra audit step\n'));
    // platform mirror carrying a marker its SSOT lacks (sync-skills must exist for the dry-run to model the invoke)
    write(tmp, 'scripts/sync-skills.ts', templateBytes('scripts/sync-skills.ts'));
    write(tmp, 'skills/local-only/SKILL.md', '---\nname: local-only\nversion: 1.0.0\n---\n# local only\n');
    write(tmp, MIRROR, '---\nname: local-only\nversion: 1.0.0\n---\n# local only\n<!-- LOCAL-PATCH(project-local): mirror-only patch -->\n');
    commitAll(tmp, 'seed marked forks');
    return tmp;
  }

  // The skill-directory / prune / instruction-file seeds need template facts; resolve lazily.
  const skillTplPath = join(workspaceRoot, 'templates', 'common', SKILL);
  const skillSubTplPath = join(workspaceRoot, 'templates', 'common', SKILL_SUB);
  const haveSkill = existsSync(skillTplPath) && existsSync(skillSubTplPath);

  const dryProject = seed();
  const applyProject = seed();
  if (haveSkill) {
    for (const p of [dryProject, applyProject]) {
      write(p, SKILL, readFileSync(skillTplPath, 'utf8').replace(/^version:.*$/m, 'version: "0.0.1"'));
      write(p, SKILL_SUB, `${readFileSync(skillSubTplPath, 'utf8').trimEnd()}\n<!-- LOCAL-PATCH(project-local): sub-file patch -->\n`);
      commitAll(p, 'seed skill dir');
    }
  }
  const dry = runUpgrade(dryProject, ['--dry-run']);
  const apply = runUpgrade(applyProject);
  const m = readManifest(applyProject);

  const lossRows = (rel: string): Decision[] => rowsFor(m, rel).filter((d) => d.verdict === 'MARKER_LOSS');

  test('the run exits non-zero and every MARKER_LOSS row is ERROR', () => {
    expect(apply.status).toBe(1);
    const loss = m.decisions.filter((d) => d.verdict === 'MARKER_LOSS');
    expect(loss.length).toBeGreaterThan(0);
    for (const d of loss) expect(d.severity).toBe('ERROR');
    expect(apply.out).toContain('DELIVERY CONFLICTS');
  });

  test('equal-version script restore: marked fork is MARKER_LOSS + kept; unmarked unproven control is CONFLICT + kept (E3)', () => {
    expect(tplVersion(EQUAL_SCRIPT)).not.toBe('');
    expect(lossRows(EQUAL_SCRIPT).length).toBe(1);
    expect(read(applyProject, EQUAL_SCRIPT)).toContain('LOCAL-PATCH(project-local)');
    expect(verdictsFor(m, EQUAL_SCRIPT)).not.toContain('DRIFT_RESTORED');
    expect(verdictsFor(m, EQUAL_CONTROL)).toContain('CONFLICT');
    expect(verdictsFor(m, EQUAL_CONTROL)).not.toContain('DRIFT_RESTORED');
    expect(read(applyProject, EQUAL_CONTROL)).toContain('// unmarked local fork');
  });

  test('core scripts (dev-sync.ts / audit.ts) equal-version fork: marked is MARKER_LOSS + kept; unmarked is restored', () => {
    expect(lossRows(CORE_MARKED).length).toBe(1);
    expect(read(applyProject, CORE_MARKED)).toContain('LOCAL-PATCH(project-local)');
    expect(verdictsFor(m, CORE_CONTROL)).toContain('DRIFT_RESTORED');
    expect(read(applyProject, CORE_CONTROL)).toBe(templateBytes(CORE_CONTROL));
  });

  test('agents/ drift restore (NO_BASELINE): marked body is MARKER_LOSS + kept, never DRIFT_RESTORED', () => {
    expect(lossRows(AGENT).length).toBe(1);
    expect(verdictsFor(m, AGENT)).not.toContain('DRIFT_RESTORED');
    expect(read(applyProject, AGENT)).toContain('LOCAL-PATCH(project-local)');
  });

  test('whole skill-directory copy: a marker in a NON-SKILL.md sub-file blocks the whole copy', () => {
    if (!haveSkill) return;
    expect(lossRows(SKILL_SUB).length).toBe(1);
    expect(read(applyProject, SKILL_SUB)).toContain('LOCAL-PATCH(project-local)');
    // SKILL.md was NOT delivered either (the whole-directory copy is skipped).
    expect(read(applyProject, SKILL)).toContain('version: "0.0.1"');
  });

  test('ci.yml MERGE: a marker inside a template-owned job is MARKER_LOSS and the merge write is skipped', () => {
    expect(lossRows(CI).length).toBe(1);
    expect(read(applyProject, CI)).toContain('LOCAL-PATCH(project-local): extra audit step');
    expect(verdictsFor(m, CI)).not.toContain('MERGE');
  });

  test('platform skill mirror: sync-skills is skipped and the mirror-only marker survives', () => {
    expect(lossRows(MIRROR).length).toBe(1);
    expect(apply.out).toContain('sync-skills.ts invoke SKIPPED');
    expect(read(applyProject, MIRROR)).toContain('mirror-only patch');
  });

  test('dry-run parity: the same MARKER_LOSS (SKIP) set and exit code, zero writes', () => {
    expect(dry.status).toBe(apply.status);
    const skips = (out: string): string[] =>
      out.split('\n').filter((l) => l.includes('MARKER_LOSS (SKIP):')).map((l) => l.trim().split(' — ')[0]).sort();
    const dryLines = skips(dry.out);
    const applyLines = skips(apply.out);
    expect(dryLines).toEqual(applyLines);
    expect(dryLines.length).toBeGreaterThanOrEqual(6);
    for (const rel of [EQUAL_SCRIPT, CORE_MARKED, AGENT, CI]) {
      expect(dry.out).toContain(SKIP_LINE('MARKER_LOSS', rel));
    }
    expect(read(dryProject, EQUAL_SCRIPT)).toContain('LOCAL-PATCH(project-local)');
    expect(existsSync(join(dryProject, '.claude', 'last-upgrade-delivery.json'))).toBe(false);
  });

  test('--disposition adopt-template=<path> overrides MARKER_LOSS for that path only and records the override', () => {
    const tmp = seed();
    const r = runUpgrade(tmp, ['--disposition', `adopt-template=${EQUAL_SCRIPT}`]);
    const mm = readManifest(tmp);
    expect(read(tmp, EQUAL_SCRIPT)).toBe(templateBytes(EQUAL_SCRIPT));
    const rows = rowsFor(mm, EQUAL_SCRIPT);
    expect(rows.some((d) => d.verdict === 'ADOPT' && d.detail.includes('marker count'))).toBe(true);
    expect(rows.some((d) => d.verdict === 'MARKER_LOSS')).toBe(false);
    // other marked paths remain protected -> still a non-zero exit
    expect(r.status).toBe(1);
    expect(rowsFor(mm, CORE_MARKED).some((d) => d.verdict === 'MARKER_LOSS')).toBe(true);
  }, 60000);
});

describe('E2 MARKER_LOSS — prune and instruction-file MERGE', () => {
  const REGISTRY_HEADER = `# Script Registry

<!-- verify-scripts.ts parses rows between the Registry header and the next ## header. -->

| script | source | version | status | removal-date | security-advisory | layer | pair |
|--------|--------|---------|--------|--------------|-------------------|-------|------|
`;
  const PRUNED = 'scripts/helpers/beta-lifecycle.ts';

  test('prune of a retired delivery that carries a marker is MARKER_LOSS and the file is kept; unmarked is pruned', () => {
    const run = (content: string): { tmp: string; status: number; out: string } => {
      const tmp = makeTempProject();
      mkdirSync(join(tmp, 'scripts', 'helpers'), { recursive: true });
      writeFileSync(
        join(tmp, 'scripts', 'SCRIPTS.md'),
        `${REGISTRY_HEADER}| \`helpers/beta-lifecycle.ts\` | L0 | 1.0.0 | active | —| —| L0 | —|\n`,
      );
      writeFileSync(join(tmp, PRUNED), content);
      commitAll(tmp, 'seed');
      const r = runUpgrade(tmp, ['--prune-removed']);
      return { tmp, ...r };
    };
    const marked = run('export const HELPER = 1; // LOCAL-PATCH(project-local): keep me\n');
    expect(marked.status).toBe(1);
    expect(existsSync(join(marked.tmp, PRUNED))).toBe(true);
    const rows = rowsFor(readManifest(marked.tmp), PRUNED);
    expect(rows.map((d) => d.verdict)).toEqual(['MARKER_LOSS']);
    expect(rows[0].severity).toBe('ERROR');
    expect(marked.out).not.toContain(`PRUNE  ${PRUNED}`);

    const unmarked = run('export const HELPER = 1;\n');
    expect(unmarked.status).toBe(0);
    expect(existsSync(join(unmarked.tmp, PRUNED))).toBe(false);
    expect(unmarked.out).toContain(`PRUNE  ${PRUNED}`);
  }, 60000);

  test('instruction-file MERGE: a marker inside a replaced managed zone is MARKER_LOSS and the merge write is skipped', () => {
    const tmp = makeTempProject();
    const tpl = templateBytes('CLAUDE.md');
    const zone = tpl.match(/<!-- COMMON-CLAUDE:START -->[\s\S]*?<!-- COMMON-CLAUDE:END -->/);
    if (!zone) return; // template carries no zone — nothing to assert
    const marked = tpl.replace(
      zone[0],
      zone[0].replace('<!-- COMMON-CLAUDE:END -->', '<!-- LOCAL-PATCH(project-local): zone patch -->\n<!-- COMMON-CLAUDE:END -->'),
    );
    write(tmp, 'CLAUDE.md', marked);
    commitAll(tmp, 'seed');
    const r = runUpgrade(tmp);
    const mm = readManifest(tmp);
    // The zone content differs from the template, so the merge would replace it and drop the marker.
    expect(verdictsFor(mm, 'CLAUDE.md')).toContain('MARKER_LOSS');
    expect(read(tmp, 'CLAUDE.md')).toBe(marked);
    expect(r.status).toBe(1);
  }, 60000);
});
