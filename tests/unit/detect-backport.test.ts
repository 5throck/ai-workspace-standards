/**
 * Tests for scripts/detect-backport.ts (spec
 * docs/designs/2026-11-17-sync-auto-detection-design.md §8, detection batch
 * PR-B / T-20261118-001): gate off no-op, E1-E4 evidence classes, cap
 * allocation order, state-file dedupe, the unresolved_template_defects block,
 * drafted_symptom hygiene, --dry-run, and the --json report shape.
 *
 * Fixtures are hermetic temp git repos: a baseline commit tagged as
 * refs/remotes/origin/main, then a landing commit on HEAD — origin/main...HEAD
 * is the landed diff surface the detector reads. Evidence-class exclusivity
 * (§5.5 priority E1 > E2 > E3 > E4, per file) shapes the fixtures: E2 targets
 * are baseline files edited in the landing, E4 targets are new managed-surface
 * files, E1 marker files are excluded from E2/E4.
 *
 * @version 1.0.0
 */
import { afterAll, beforeEach, describe, expect, test } from 'bun:test';
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import {
  computeUnresolvedTemplateDefects,
  dedupeToken,
  isManagedSurface,
  isMechanicalPath,
  parseSyncDetection,
  runDetection,
  type Candidate,
  type DetectBackportState,
  type DetectBackportReport,
} from '../../scripts/detect-backport.ts';

const ROOTS: string[] = [];

function makeProject(): string {
  const dir = mkdtempSync(join(tmpdir(), 'detect-backport-'));
  ROOTS.push(dir);
  return dir;
}

let gitEnv: Record<string, string>;

beforeEach(() => {
  gitEnv = {
    ...process.env,
    GIT_AUTHOR_NAME: 'fixture',
    GIT_AUTHOR_EMAIL: 'fixture@example.test',
    GIT_COMMITTER_NAME: 'fixture',
    GIT_COMMITTER_EMAIL: 'fixture@example.test',
    GIT_CONFIG_GLOBAL: '/dev/null',
    GIT_CONFIG_NOSYSTEM: '1',
  };
});

function git(cwd: string, args: string[]): string {
  const res = spawnSync('git', args, { cwd, env: gitEnv, encoding: 'utf-8' });
  if (res.status !== 0) throw new Error(`git ${args.join(' ')} failed: ${res.stderr}`);
  return (res.stdout ?? '').trim();
}

interface SeedSpec {
  /** Runs before the origin/main baseline commit (baseline/delivered files). */
  baseline?: (root: string) => void;
  /** Runs before the landing commit (the landed diff surface). */
  landing: (root: string) => void;
  variantJson?: Record<string, unknown>;
}

/** A fixture project: baseline commit tagged as origin/main, then a landing commit on HEAD. */
function seedProject(spec: SeedSpec): string {
  const root = makeProject();
  git(root, ['init', '-q', '-b', 'main']);
  git(root, ['config', 'user.email', 'fixture@example.test']);
  git(root, ['config', 'user.name', 'fixture']);
  if (spec.variantJson) writeFileSync(join(root, 'variant.json'), `${JSON.stringify(spec.variantJson, null, 2)}\n`);
  spec.baseline?.(root);
  git(root, ['add', '-A']);
  git(root, ['commit', '-qm', 'baseline']);
  git(root, ['update-ref', 'refs/remotes/origin/main', 'HEAD']);
  spec.landing(root);
  git(root, ['add', '-A']);
  git(root, ['commit', '-q', '--allow-empty', '-m', 'landing']);
  return root;
}

function gateBlock(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return { name: 'co-fixture', syncDetection: { enabled: true, retired_tokens: ['graft'], ...overrides } };
}

function reportFor(root: string, opts: { dryRun?: boolean } = {}): DetectBackportReport {
  const result = runDetection({ projectRoot: root, dryRun: opts.dryRun });
  if (result.disabled || !result.report) throw new Error(`expected detection to run: ${result.disabledReason}`);
  return result.report;
}

function gitDirOf(root: string): string {
  return join(root, '.git');
}

function readState(root: string): DetectBackportState {
  return JSON.parse(readFileSync(join(gitDirOf(root), 'detect-backport-state.json'), 'utf-8')) as DetectBackportState;
}

function readPersistedReport(root: string): DetectBackportReport {
  return JSON.parse(readFileSync(join(gitDirOf(root), 'detect-backport-report.json'), 'utf-8')) as DetectBackportReport;
}

/** A delivered E2 target: baseline file edited in the landing (SYNC claim, non-empty diff). */
function seedDeliveredEdit(spec: Partial<SeedSpec> = {}): SeedSpec {
  return {
    ...spec,
    baseline: (r) => {
      writeFileSync(join(r, 'delivered.ts'), 'export const v = 1;\n');
      spec.baseline?.(r);
    },
    landing: (r) => {
      writeFileSync(join(r, 'delivered.ts'), 'export const v = 2;\n');
      spec.landing?.(r);
    },
  };
}

describe('gate (§5.1)', () => {
  test('gate absent → disabled, one-line reason, exit 0 via CLI, zero stdout noise', () => {
    const root = makeProject(); // no variant.json, not even a git repo
    const cli = join(import.meta.dir, '..', '..', 'scripts', 'detect-backport.ts');
    const res = spawnSync('bun', [cli, '--project', root, '--json'], { encoding: 'utf-8' });
    expect(res.status).toBe(0);
    expect((res.stdout ?? '').trim()).toBe(
      'sync-detection: disabled (no variant.json syncDetection gate and no --detect-backport flag)',
    );
    expect((res.stdout ?? '').match(/\n/g)?.length ?? 0).toBeLessThanOrEqual(1);
  });

  test('syncDetection.enabled: false → disabled even with the block present', () => {
    const root = seedProject({ landing: () => {}, variantJson: { ...gateBlock(), syncDetection: { enabled: false } } });
    const result = runDetection({ projectRoot: root });
    expect(result.disabled).toBe(true);
    expect(result.written).toEqual([]);
  });

  test('malformed gate (cap 9) → disabled with a warning, not silently on', () => {
    const root = seedProject({
      landing: () => {},
      variantJson: { ...gateBlock(), syncDetection: { enabled: true, max_tickets_per_sync: 9 } },
    });
    const result = runDetection({ projectRoot: root });
    expect(result.disabled).toBe(true);
    expect(result.warnings.join(' ')).toContain('max_tickets_per_sync');
  });

  test('parseSyncDetection: absent block null, defaults cap 3 and empty tokens, non-boolean enabled flagged', () => {
    expect(parseSyncDetection({})).toBeNull();
    const parsed = parseSyncDetection({ syncDetection: { enabled: true } });
    expect(parsed?.enabled).toBe(true);
    expect(parsed?.maxTicketsPerSync).toBe(3);
    expect(parsed?.retiredTokens).toEqual([]);
    expect(parseSyncDetection({ syncDetection: { enabled: 'yes' } })?.configError).toContain('boolean');
    expect(parseSyncDetection({ syncDetection: { enabled: true, retired_tokens: [1] } })?.configError).toContain('strings');
  });
});

describe('E1 — LOCAL-PATCH markers (§5.2)', () => {
  test('pending marker → one file-upstream template-defect candidate', () => {
    const root = seedProject({
      landing: (r) => {
        mkdirSync(join(r, 'scripts', 'co-fixture'), { recursive: true });
        writeFileSync(join(r, 'scripts', 'co-fixture', 'tool.ts'), '// LOCAL-PATCH(upstream-request: pending): divergence\n');
      },
      variantJson: gateBlock(),
    });
    const report = reportFor(root);
    const e1 = report.candidates.filter((c) => c.evidence_class === 'E1_LOCAL_PATCH');
    expect(e1).toHaveLength(1);
    expect(e1[0]?.candidate_type).toBe('template-defect');
    expect(e1[0]?.suggested_action).toBe('file-upstream');
    expect(e1[0]?.affected_paths).toEqual(['scripts/co-fixture/tool.ts']);
    expect(e1[0]?.evidence[0]?.file).toBe('scripts/co-fixture/tool.ts');
    // Per-file exclusivity: the marker file is not double-reported as E2/E4.
    expect(report.candidates.filter((c) => c.affected_paths.includes('scripts/co-fixture/tool.ts'))).toHaveLength(1);
  });

  test('marker with a real U-id → report-only, disposition already-filed, no cap consumption', () => {
    const root = seedProject({
      landing: (r) => {
        writeFileSync(join(r, 'patched.md'), '<!-- LOCAL-PATCH(upstream-request: U-20261117-007) -->\ncontent\n');
      },
      variantJson: gateBlock(),
    });
    const report = reportFor(root);
    const e1 = report.candidates.filter((c) => c.evidence_class === 'E1_LOCAL_PATCH');
    expect(e1).toHaveLength(1);
    expect(e1[0]?.disposition).toBe('already-filed');
    expect(e1[0]?.suggested_action).toBe('report-only');
    expect(report.notes.join(' ')).toContain('report-only');
    expect(report.counts.over_cap).toBe(0);
  });
});

describe('E2 — delivered edits (§5.2)', () => {
  test('SYNC-claim file edited in origin/main...HEAD → candidate; mechanical edit → none', () => {
    const root = seedProject(
      seedDeliveredEdit({
        landing: (r) => {
          mkdirSync(join(r, '.claude'), { recursive: true });
          writeFileSync(join(r, '.claude', 'last-upgrade-delivery.json'), '{"files":[]}\n');
        },
        variantJson: gateBlock(),
      }),
    );
    const report = reportFor(root);
    const e2 = report.candidates.filter((c) => c.evidence_class === 'E2_DELIVERED_EDIT');
    expect(e2.map((c) => c.affected_paths[0])).toEqual(['delivered.ts']);
    expect(isMechanicalPath('.claude/last-upgrade-delivery.json')).toBe(true);
    expect(isMechanicalPath('.claude/template-version.txt')).toBe(true);
    expect(isMechanicalPath('docs/VERSION_MANIFEST.md')).toBe(true);
    expect(isMechanicalPath('memory/2026-11-18.md')).toBe(true);
    expect(isMechanicalPath('scripts/lib/delivered-leaf.ts')).toBe(false);
  });

  test('mechanical-only landing produces no E2 candidates', () => {
    const root = seedProject({
    landing: (r) => {
      mkdirSync(join(r, '.claude'), { recursive: true });
      writeFileSync(join(r, '.claude', 'template-version.txt'), '0.99.0\n');
    },
      variantJson: gateBlock(),
    });
    const report = reportFor(root);
    expect(report.candidates.filter((c) => c.evidence_class === 'E2_DELIVERED_EDIT')).toHaveLength(0);
  });
});

describe('E3 — retired tokens (§4 worked example, AC-3)', () => {
  test('graft replica: .agents/mcp.json carrying graft → template-defect with file:line and suspected_layer L1', () => {
    const root = seedProject({
      landing: (r) => {
        mkdirSync(join(r, '.agents'), { recursive: true });
        writeFileSync(
          join(r, '.agents', 'mcp.json'),
          '{\n  "servers": { "graft": { "command": "graft", "args": ["serve"] } }\n}\n',
        );
      },
      variantJson: gateBlock(),
    });
    const report = reportFor(root);
    const e3 = report.candidates.filter((c) => c.evidence_class === 'E3_RETIRED_TOKEN');
    expect(e3).toHaveLength(1);
    expect(e3[0]?.candidate_type).toBe('template-defect');
    expect(e3[0]?.suspected_layer).toBe('L1');
    expect(e3[0]?.affected_paths).toEqual(['.agents/mcp.json']);
    expect(e3[0]?.evidence.some((e) => e.file === '.agents/mcp.json' && typeof e.line === 'number' && e.line >= 2)).toBe(true);
  });

  test('whole-token matching: the token as a substring of a larger word does not fire E3', () => {
    const root = seedProject({
      landing: (r) => {
        writeFileSync(join(r, 'notes.md'), 'grafted configs and grafting notes\n');
      },
      variantJson: gateBlock(),
    });
    const report = reportFor(root);
    expect(report.candidates.filter((c) => c.evidence_class === 'E3_RETIRED_TOKEN')).toHaveLength(0);
  });
});

describe('E4 — managed-surface new files (§5.2)', () => {
  test('new skills/<x>/SKILL.md in the landed diff → reusable-asset, layer unsure', () => {
    const root = seedProject({
      landing: (r) => {
        mkdirSync(join(r, 'skills', 'fixture-skill'), { recursive: true });
        writeFileSync(join(r, 'skills', 'fixture-skill', 'SKILL.md'), '---\nname: fixture-skill\n---\nbody\n');
      },
      variantJson: gateBlock(),
    });
    const report = reportFor(root);
    const e4 = report.candidates.filter((c) => c.evidence_class === 'E4_MANAGED_NEW_FILE');
    expect(e4).toHaveLength(1);
    expect(e4[0]?.candidate_type).toBe('reusable-asset');
    expect(e4[0]?.suspected_layer).toBe('unsure');
    expect(e4[0]?.suggested_action).toBe('file-asset-report');
  });

  test('modified (not new) managed file and non-managed new file do not fire E4', () => {
    const root = seedProject({
      baseline: (r) => {
        mkdirSync(join(r, 'skills', 'existing'), { recursive: true });
        writeFileSync(join(r, 'skills', 'existing', 'SKILL.md'), '---\nname: existing\n---\n');
      },
      landing: (r) => {
        writeFileSync(join(r, 'skills', 'existing', 'SKILL.md'), '---\nname: existing\n---\nchanged\n');
        writeFileSync(join(r, 'scratch-note.md'), 'not managed\n');
      },
      variantJson: gateBlock(),
    });
    const report = reportFor(root);
    expect(report.candidates.filter((c) => c.evidence_class === 'E4_MANAGED_NEW_FILE')).toHaveLength(0);
  });

  test('managed-surface pattern set', () => {
    expect(isManagedSurface('skills/x/SKILL.md')).toBe(true);
    expect(isManagedSurface('skills/x/REFERENCES.md')).toBe(false);
    expect(isManagedSurface('scripts/helpers/foo.ts')).toBe(true);
    expect(isManagedSurface('scripts/lib/foo.ts')).toBe(true);
    expect(isManagedSurface('scripts/co-x/tool.ts')).toBe(false);
    expect(isManagedSurface('evidence-models/model.md')).toBe(true);
    expect(isManagedSurface('agents/x.md')).toBe(true);
    expect(isManagedSurface('agents/deep/nested.md')).toBe(false);
  });
});

describe('cap allocation (§5.5)', () => {
  function fourClassFixture(overrides: Record<string, unknown> = {}): Record<string, unknown> {
    return {
      baseline: (r: string) => {
        writeFileSync(join(r, 'delivered.ts'), 'export const v = 1;\n');
      },
      landing: (r: string) => {
        writeFileSync(join(r, 'delivered.ts'), 'export const v = 2;\n'); // E2
        writeFileSync(join(r, 'e1.md'), '<!-- LOCAL-PATCH(upstream-request: pending) -->\n'); // E1
        mkdirSync(join(r, '.agents'), { recursive: true });
        writeFileSync(join(r, '.agents', 'mcp.json'), '{ "uses": "graft" }\n'); // E3
        mkdirSync(join(r, 'skills', 'new-skill'), { recursive: true });
        writeFileSync(join(r, 'skills', 'new-skill', 'SKILL.md'), '---\nname: new-skill\n---\n'); // E4
      },
      variantJson: gateBlock(overrides),
    };
  }

  test('cap 3 with 4 candidates → 4th over-cap, and the order E1 > E2 > E3 > E4 holds', () => {
    const root = seedProject(fourClassFixture({ max_tickets_per_sync: 3 }));
    const report = reportFor(root);
    expect(report.counts.candidates).toBe(4);
    expect(report.counts.cap).toBe(3);
    expect(report.counts.over_cap).toBe(1);
    expect(report.candidates.map((c) => c.evidence_class)).toEqual([
      'E1_LOCAL_PATCH',
      'E2_DELIVERED_EDIT',
      'E3_RETIRED_TOKEN',
      'E4_MANAGED_NEW_FILE',
    ]);
    expect(report.candidates[3]?.disposition).toBe('over-cap');
    expect(report.candidates[3]?.candidate_type).toBe('reusable-asset');
    for (const c of report.candidates.slice(0, 3)) expect(c.disposition).toBe('within-cap');
  });

  test('cap 1 with an E1 candidate consumes the budget before E2', () => {
    const root = seedProject(fourClassFixture({ max_tickets_per_sync: 1 }));
    const report = reportFor(root);
    const e1 = report.candidates.find((c) => c.evidence_class === 'E1_LOCAL_PATCH');
    const e2 = report.candidates.find((c) => c.evidence_class === 'E2_DELIVERED_EDIT');
    expect(e1?.disposition).toBe('within-cap');
    expect(e2?.disposition).toBe('over-cap');
    expect(report.counts.over_cap).toBe(3);
  });
});

describe('state-file dedupe (§5.5)', () => {
  test('second run marks a repeat candidate duplicate-local and never re-files it', () => {
    const root = seedProject(seedDeliveredEdit({ variantJson: gateBlock() }));
    const first = reportFor(root);
    const e2 = first.candidates.find((c) => c.evidence_class === 'E2_DELIVERED_EDIT');
    expect(e2?.disposition).toBe('within-cap');
    expect(readState(root).filed).toHaveLength(1);
    expect(readState(root).filed[0]?.dedupe_token).toBe(e2?.dedupe_token);

    const second = reportFor(root);
    const again = second.candidates.find((c) => c.evidence_class === 'E2_DELIVERED_EDIT');
    expect(again?.disposition).toBe('duplicate-local');
    expect(again?.suggested_action).toBe('report-only');
    expect(second.counts.over_cap).toBe(0);
    expect(readState(root).filed).toHaveLength(1);
  });

  test('duplicate rows do not consume cap: a duplicate plus a fresh candidate both fit', () => {
    const root = seedProject(
      seedDeliveredEdit({
        landing: (r) => {
          writeFileSync(join(r, 'delivered2.ts'), 'export const w = 1;\n');
        },
        baseline: (r) => {
          writeFileSync(join(r, 'delivered2.ts'), 'export const w = 0;\n');
        },
        variantJson: gateBlock({ max_tickets_per_sync: 1 }),
      }),
    );
    reportFor(root);
    // Second run: delivered.ts is duplicate-local (no cap), delivered2.ts takes the 1 slot.
    const second = reportFor(root);
    expect(second.candidates.map((c) => c.disposition).sort()).toEqual(['duplicate-local', 'within-cap']);
  });

  test('uid backfill from LOCAL-PATCH markers with real ids at the affected path', () => {
    const root = seedProject(seedDeliveredEdit({ variantJson: gateBlock() }));
    reportFor(root);
    const state1 = readState(root);
    expect(state1.filed[0]?.uid).toBeNull();
    // Session files the ticket and marks the patch site (§5.4 marker protocol).
    writeFileSync(join(root, 'delivered.ts'), 'export const v = 2;\n// LOCAL-PATCH(upstream-request: U-20261118-042)\n');
    git(root, ['add', '-A']);
    git(root, ['commit', '-qm', 'mark patch site']);
    git(root, ['update-ref', 'refs/remotes/origin/main', 'HEAD']);
    reportFor(root);
    const state2 = readState(root);
    expect(state2.filed[0]?.uid).toBe('U-20261118-042');
  });
});

describe('unresolved_template_defects (§5.8)', () => {
  function setResolution(root: string, token: string, patch: { uid?: string | null; resolution?: string | null }): void {
    const state = readState(root);
    for (const e of state.filed) {
      if (e.dedupe_token === token) {
        if (patch.uid !== undefined) e.uid = patch.uid;
        if (patch.resolution !== undefined) e.resolution = patch.resolution;
      }
    }
    writeFileSync(join(gitDirOf(root), 'detect-backport-state.json'), `${JSON.stringify(state, null, 2)}\n`);
  }

  test('filed U-id at resolution fixed drops out; not-fixed stays pending', () => {
    const root = seedProject(seedDeliveredEdit({ variantJson: gateBlock() }));
    const first = reportFor(root);
    const token = first.candidates.find((c) => c.evidence_class === 'E2_DELIVERED_EDIT')?.dedupe_token ?? '';
    expect(token).toBeTruthy();

    // resolution null → pending (filing alone does NOT clear a defect, §5.3).
    setResolution(root, token, { uid: 'U-20261118-010' });
    let report = reportFor(root);
    expect(report.unresolved_template_defects.count).toBeGreaterThan(0);
    expect(report.unresolved_template_defects.affected_files).toContain('delivered.ts');

    // resolution fixed → dropped from the pending set (§5.8, AC-8 refinement).
    setResolution(root, token, { resolution: 'fixed' });
    report = reportFor(root);
    expect(report.unresolved_template_defects.count).toBe(0);
    expect(report.unresolved_template_defects.affected_files).toEqual([]);
  });

  test('pure helper: run candidates plus unfixed state records, fixed records excluded', () => {
    const tokenA = dedupeToken('template-defect', ['a.md'], 'E2:a.md');
    const tokenB = dedupeToken('template-defect', ['b.md'], 'E3:graft');
    const state: DetectBackportState = {
      schema: 'detect-backport-state/1',
      updated_at: '',
      filed: [
        { dedupe_token: tokenA, candidate_type: 'template-defect', affected_paths: ['a.md'], uid: 'U-1', filed_at: '', resolution: 'fixed' },
        { dedupe_token: tokenB, candidate_type: 'template-defect', affected_paths: ['b.md'], uid: 'U-2', filed_at: '', resolution: null },
      ],
    };
    const candC: Candidate = {
      id: 'cand-001',
      candidate_type: 'template-defect',
      evidence_class: 'E2_DELIVERED_EDIT',
      suspected_layer: 'L1',
      evidence: [],
      affected_paths: ['c.md'],
      dedupe_token: dedupeToken('template-defect', ['c.md'], 'E2:c.md'),
      drafted_symptom: '',
      suggested_action: 'file-upstream',
      disposition: 'within-cap',
    };
    const unresolved = computeUnresolvedTemplateDefects([candC], state);
    expect(unresolved.count).toBe(2); // b.md (state, not fixed) + c.md (this run)
    expect(unresolved.affected_files).toEqual(['b.md', 'c.md']);
  });
});

describe('drafted_symptom hygiene (§5.3)', () => {
  test('all candidates: ≤600 chars and declarative (no imperative sentence openers)', () => {
    const root = seedProject({
      baseline: (r) => {
        writeFileSync(join(r, 'delivered.ts'), 'export const v = 1;\n');
      },
      landing: (r) => {
        writeFileSync(join(r, 'delivered.ts'), 'export const v = 2;\n'); // E2
        writeFileSync(join(r, 'e1.md'), '<!-- LOCAL-PATCH(upstream-request: pending) -->\n'); // E1
        mkdirSync(join(r, '.agents'), { recursive: true });
        writeFileSync(join(r, '.agents', 'mcp.json'), '{ "uses": "graft" }\n'); // E3
        mkdirSync(join(r, 'skills', 'new-skill'), { recursive: true });
        writeFileSync(join(r, 'skills', 'new-skill', 'SKILL.md'), '---\nname: new-skill\n---\n'); // E4
      },
      variantJson: gateBlock(),
    });
    const report = reportFor(root);
    expect(report.candidates.length).toBeGreaterThanOrEqual(4);
    const imperativeOpener = /^(run|file|merge|promote|execute|delete|update|create|remove|write|install|bypass|force)\b/i;
    for (const c of report.candidates) {
      expect(c.drafted_symptom.length).toBeLessThanOrEqual(600);
      expect(c.drafted_symptom.startsWith('Observed:')).toBe(true);
      for (const sentence of c.drafted_symptom.split(/(?<=[.!?])\s+/)) {
        expect(imperativeOpener.test(sentence)).toBe(false);
      }
    }
  });
});

describe('--dry-run and persistence (§5.3)', () => {
  test('--dry-run writes nothing (no report, no state file)', () => {
    const root = seedProject(seedDeliveredEdit({ variantJson: gateBlock() }));
    const result = runDetection({ projectRoot: root, dryRun: true });
    expect(result.disabled).toBe(false);
    expect(result.written).toEqual([]);
    expect(existsSync(join(gitDirOf(root), 'detect-backport-report.json'))).toBe(false);
    expect(existsSync(join(gitDirOf(root), 'detect-backport-state.json'))).toBe(false);
  });

  test('normal run persists the report under the git dir, outside the working tree', () => {
    const root = seedProject(seedDeliveredEdit({ variantJson: gateBlock() }));
    const result = runDetection({ projectRoot: root });
    expect(result.written).toHaveLength(2);
    expect(existsSync(join(gitDirOf(root), 'detect-backport-report.json'))).toBe(true);
    const persisted = readPersistedReport(root);
    expect(persisted.schema).toBe('detect-backport-report/1');
    expect(persisted.gate.source).toBe('variant.json');
    // Nothing leaked into the tracked tree.
    expect(git(root, ['status', '--porcelain'])).toBe('');
  });
});

describe('report shape (§5.3 schema detect-backport-report/1) and --json', () => {
  test('persisted report carries every §5.3 top-level key with well-typed values', () => {
    const root = seedProject(seedDeliveredEdit({ variantJson: gateBlock() }));
    const report = reportFor(root);
    expect(report.schema).toBe('detect-backport-report/1');
    expect(typeof report.generated_at).toBe('string');
    expect(report.project).toBe('co-fixture');
    expect(report.variant).toBe('co-fixture');
    expect(report.gate).toEqual({ source: 'variant.json', enabled: true });
    expect(report.diff_surface).toEqual({ base: 'origin/main', head: 'HEAD', changed_files: expect.any(Number) });
    expect(report.diff_surface.changed_files).toBeGreaterThan(0);
    expect(report.counts).toEqual({ candidates: expect.any(Number), cap: 3, over_cap: expect.any(Number) });
    expect(report.unresolved_template_defects).toEqual({ count: expect.any(Number), affected_files: expect.any(Array) });
    expect(Array.isArray(report.notes)).toBe(true);
    for (const c of report.candidates) {
      expect(c.id).toMatch(/^cand-\d{3}$/);
      expect(['template-defect', 'reusable-asset']).toContain(c.candidate_type);
      expect(['E1_LOCAL_PATCH', 'E2_DELIVERED_EDIT', 'E3_RETIRED_TOKEN', 'E4_MANAGED_NEW_FILE']).toContain(c.evidence_class);
      expect(['L1', 'L2', 'unsure']).toContain(c.suspected_layer);
      expect(c.dedupe_token).toMatch(/^sha256:[0-9a-f]{64}$/);
      expect(['file-upstream', 'file-asset-report', 'mark-local-patch', 'report-only']).toContain(c.suggested_action);
      expect(['within-cap', 'over-cap', 'duplicate-local', 'already-filed']).toContain(c.disposition);
    }
  });

  test('CLI --json prints the report JSON verbatim on stdout (skill step 3 piping contract)', () => {
    const root = seedProject(seedDeliveredEdit({ variantJson: gateBlock() }));
    const cli = join(import.meta.dir, '..', '..', 'scripts', 'detect-backport.ts');
    const res = spawnSync('bun', [cli, '--project', root, '--json'], { encoding: 'utf-8' });
    expect(res.status).toBe(0);
    const parsed = JSON.parse(res.stdout) as DetectBackportReport; // stdout must be pure JSON
    expect(parsed.schema).toBe('detect-backport-report/1');
    expect(parsed.candidates.length).toBeGreaterThan(0);
    expect(existsSync(join(gitDirOf(root), 'detect-backport-report.json'))).toBe(true);
  });

  test('--detect-backport argument overrides an enabled:false config (§5.1 precedence)', () => {
    const root = seedProject(
      seedDeliveredEdit({ variantJson: { ...gateBlock(), syncDetection: { enabled: false } } }),
    );
    const result = runDetection({ projectRoot: root, forceDetect: true });
    expect(result.disabled).toBe(false);
    expect(result.report?.gate.source).toBe('argument');
    expect(result.report?.gate.enabled).toBe(true);
  });
});
