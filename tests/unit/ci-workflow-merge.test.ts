/**
 * @version 1.0.0
 * Tests for scripts/lib/ci-workflow-merge.ts (T-20260930-026 PR-A, ADR-0094):
 * one case per error code, CRLF, block-scalar marker text, idempotence (plain and
 * migrated), legacy migration refusals, atomic write, and the real marker-less
 * template (pre-PR-B) behaviour.
 */
import { describe, test, expect } from 'bun:test';
import { mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import {
  applyCiWorkflowMerge,
  mergeCiWorkflow,
  validateCiWorkflow,
  type CiMergeErrorCode,
} from '../../scripts/lib/ci-workflow-merge.ts';

const HEAD = `name: CI

on:
  pull_request:
    branches: [main, master]
  push:
    branches: [main, master]

permissions:
  contents: read

jobs:
  audit:
    name: Documentation Audit
    runs-on: ubuntu-latest
    steps:
      - run: bun scripts/audit.ts

  secret-scan:
    name: Secret Scan
    runs-on: ubuntu-latest
    steps:
      - run: echo scan
`;
const TPL = `${HEAD}
  # PROJECT-JOBS-BEGIN
  # Project-local jobs go here.
  # PROJECT-JOBS-END
`;
const TEST_JOB = `  test:
    name: Project Tests
    runs-on: ubuntu-latest
    steps:
      - run: bun test
`;
const withRegion = (region: string, tpl = TPL): string =>
  tpl.replace('  # Project-local jobs go here.\n', region);

const M = (p: string, t = TPL, allow = false) => mergeCiWorkflow(p, t, { allowTriggerPermDiff: allow });
const codes = (r: { errors: { code: CiMergeErrorCode }[] }): CiMergeErrorCode[] => r.errors.map(e => e.code);

describe('merge: region preserved, template jobs authoritative', () => {
  test('region survives while a template job is refreshed', () => {
    const project = withRegion(TEST_JOB).replace('echo scan', 'echo STALE');
    const r = M(project);
    expect(r.ok).toBe(true);
    expect(r.content).toContain('name: Project Tests');
    expect(r.content).toContain('echo scan');
    expect(r.content).not.toContain('STALE');
    expect(r.warnings.some(w => w.startsWith('TEMPLATE_JOB_CHANGED'))).toBe(true);
  });

  test('second merge is byte-identical (plain)', () => {
    const first = M(withRegion(TEST_JOB));
    const second = M(first.content!);
    expect(second.ok).toBe(true);
    expect(second.content).toBe(first.content!);
    expect(first.content).toBe(withRegion(TEST_JOB));
  });

  test('CRLF input round-trips with CRLF', () => {
    const crlf = withRegion(TEST_JOB).replace(/\n/g, '\r\n');
    const r = M(crlf);
    expect(r.ok).toBe(true);
    expect(r.content).toBe(crlf);
    expect(r.content!.replace(/\r\n/g, '')).not.toContain('\n');
  });

  test('marker text inside a run: | block scalar is not a marker', () => {
    const job = `  test:
    runs-on: ubuntu-latest
    steps:
      - run: |
          # PROJECT-JOBS-BEGIN
          # PROJECT-JOBS-END
          echo done
`;
    const r = M(withRegion(job));
    expect(r.ok).toBe(true);
    expect(r.content).toBe(withRegion(job));
  });
});

describe('one case per error code', () => {
  test('MARKER_COUNT (duplicate BEGIN, missing END, nested)', () => {
    const dupBegin = TPL.replace('  # PROJECT-JOBS-END', '  # PROJECT-JOBS-BEGIN\n  # PROJECT-JOBS-END');
    expect(codes(M(dupBegin))).toContain('MARKER_COUNT');
    const noEnd = TPL.replace('  # PROJECT-JOBS-END\n', '');
    expect(codes(M(noEnd))).toContain('MARKER_COUNT');
    const nested = TPL.replace('  # PROJECT-JOBS-BEGIN', '  # PROJECT-JOBS-BEGIN\n  # PROJECT-JOBS-BEGIN').replace('  # PROJECT-JOBS-END', '  # PROJECT-JOBS-END\n  # PROJECT-JOBS-END');
    expect(codes(M(nested))).toContain('MARKER_COUNT');
  });

  test('MARKER_ORDER', () => {
    const swapped = TPL.replace('  # PROJECT-JOBS-BEGIN', '@@').replace('  # PROJECT-JOBS-END', '  # PROJECT-JOBS-BEGIN').replace('@@', '  # PROJECT-JOBS-END');
    expect(codes(M(swapped))).toContain('MARKER_ORDER');
  });

  test('MARKER_INDENT', () => {
    const bad = TPL.replace('  # PROJECT-JOBS-BEGIN', '    # PROJECT-JOBS-BEGIN');
    expect(codes(M(bad))).toContain('MARKER_INDENT');
  });

  test('REGION_INDENT', () => {
    const bad = withRegion('    deep-job:\n      runs-on: ubuntu-latest\n');
    expect(codes(M(bad))).toContain('REGION_INDENT');
  });

  test('YAML_PARSE', () => {
    const bad = withRegion('  test:\n    steps: [unclosed\n');
    expect(codes(M(bad))).toContain('YAML_PARSE');
  });

  test('DUPLICATE_KEY (inside the region and across the file)', () => {
    const inRegion = withRegion(`${TEST_JOB}${TEST_JOB}`);
    expect(codes(M(inRegion))).toContain('DUPLICATE_KEY');
    const acrossFile = withRegion('  audit:\n    runs-on: ubuntu-latest\n');
    expect(codes(M(acrossFile))).toContain('RESERVED_JOB');
    const dupTop = TPL.replace('permissions:\n  contents: read', 'permissions:\n  contents: read\n  contents: write');
    expect(codes(M(dupTop))).toContain('DUPLICATE_KEY');
  });

  test('RESERVED_JOB for audit, secret-scan, unit-tests', () => {
    for (const key of ['audit', 'secret-scan', 'unit-tests']) {
      const r = M(withRegion(`  ${key}:\n    runs-on: ubuntu-latest\n`));
      expect(r.ok).toBe(false);
      expect(codes(r)).toContain('RESERVED_JOB');
      expect(r.content).toBeNull();
    }
  });

  test('REGION_JOB_PRIVILEGE (permissions / environment / secrets)', () => {
    for (const line of ['permissions: write-all', 'environment: prod', 'secrets: inherit']) {
      const r = M(withRegion(`  test:\n    runs-on: ubuntu-latest\n    ${line}\n`));
      expect(codes(r)).toContain('REGION_JOB_PRIVILEGE');
    }
  });

  test('REGION_TOP_LEVEL', () => {
    expect(codes(M(withRegion('permissions:\n  contents: write\n')))).toContain('REGION_TOP_LEVEL');
    expect(codes(M(withRegion('  env:\n    runs-on: ubuntu-latest\n')))).toContain('REGION_TOP_LEVEL');
  });

  test('FORBIDDEN_TRIGGER', () => {
    const r = M(withRegion(`  test:\n    runs-on: ubuntu-latest\n    if: github.event_name == 'pull_request_target'\n`));
    expect(codes(r)).toContain('FORBIDDEN_TRIGGER');
    const onTrigger = validateCiWorkflow(TPL.replace('  push:', '  workflow_run:\n    workflows: [x]\n  push:'), TPL);
    expect(onTrigger.map(e => e.code)).toContain('FORBIDDEN_TRIGGER');
  });

  test('TEMPLATE_JOB_DRIFT (validator on a hand-edited merged file)', () => {
    const drifted = TPL.replace('echo scan', 'echo tampered');
    expect(validateCiWorkflow(drifted, TPL).map(e => e.code)).toContain('TEMPLATE_JOB_DRIFT');
    expect(validateCiWorkflow(TPL, TPL)).toEqual([]);
  });

  test('MIGRATION_UNSAFE: anchors, aliases, multi-doc, unknown top-level key', () => {
    const anchored = HEAD.replace('runs-on: ubuntu-latest\n    steps:\n      - run: bun scripts/audit.ts', 'runs-on: &r ubuntu-latest\n    steps:\n      - run: bun scripts/audit.ts') + TEST_JOB.replace('ubuntu-latest', '*r');
    expect(codes(M(anchored))).toContain('MIGRATION_UNSAFE');
    expect(codes(M(`---\n${HEAD}---\nname: other\n`))).toContain('MIGRATION_UNSAFE');
    expect(codes(M(`${HEAD.replace('jobs:', 'concurrency: x\njobs:')}${TEST_JOB}`))).toContain('MIGRATION_UNSAFE');
  });

  test('MIGRATION_UNSAFE: perm/trigger diff requires the explicit flag', () => {
    const project = `${HEAD.replace('contents: read', 'contents: write')}${TEST_JOB}`;
    const refused = M(project);
    expect(refused.ok).toBe(false);
    expect(codes(refused)).toContain('MIGRATION_UNSAFE');
    expect(refused.diff).toContain('permissions');
    const accepted = M(project, TPL, true);
    expect(accepted.ok).toBe(true);
    expect(accepted.content).toContain('contents: read');
    expect(accepted.content).not.toContain('contents: write');
  });
});

describe('legacy (marker-less) migration', () => {
  const legacy = `${HEAD}\n  # Project unit tests\n${TEST_JOB}`;

  test('project-only job copied as the original text slice into the region', () => {
    const r = M(legacy);
    expect(r.ok).toBe(true);
    expect(r.migrated).toEqual(['test']);
    expect(r.content).toContain(`# PROJECT-JOBS-BEGIN\n  # Project unit tests\n${TEST_JOB}`);
    expect(validateCiWorkflow(r.content!, TPL)).toEqual([]);
  });

  test('second merge is byte-identical (migrated)', () => {
    const first = M(legacy);
    const second = M(first.content!);
    expect(second.ok).toBe(true);
    expect(second.content).toBe(first.content!);
  });

  test('CRLF legacy file migrates and keeps CRLF', () => {
    const r = M(legacy.replace(/\n/g, '\r\n'));
    expect(r.ok).toBe(true);
    expect(r.content!.includes('\r\n')).toBe(true);
    expect(r.content!.replace(/\r\n/g, '').includes('\n')).toBe(false);
  });

  test('a project identical to a marker-less template is unchanged', () => {
    const r = M(HEAD, HEAD);
    expect(r.ok).toBe(true);
    expect(r.content).toBe(HEAD);
    expect(r.migrated).toEqual([]);
  });

  test('real marker-less template (pre-PR-B fixture): identical project is a no-op', () => {
    // The live template carries markers since PR-B; the legacy migration path is exercised
    // against the saved pre-PR-B snapshot instead.
    const tpl = readFileSync(resolve(import.meta.dir, '..', 'fixtures', 'ci-workflow', 'template-pre-pr-b.yml'), 'utf8');
    expect(tpl.includes('PROJECT-JOBS-BEGIN')).toBe(false);
    const r = mergeCiWorkflow(tpl, tpl, { allowTriggerPermDiff: false });
    expect(r.ok).toBe(true);
    expect(r.content).toBe(tpl);
    const withJob = mergeCiWorkflow(tpl + '\n' + TEST_JOB, tpl, { allowTriggerPermDiff: false });
    expect(withJob.ok).toBe(true);
    expect(withJob.migrated).toEqual(['test']);
    expect(mergeCiWorkflow(withJob.content!, tpl, { allowTriggerPermDiff: false }).content).toBe(withJob.content!);
  });
});

describe('applyCiWorkflowMerge atomic write', () => {
  const tmpDirs: string[] = [];
  function setup(projectText: string): { dir: string; file: string; tpl: string } {
    const dir = mkdtempSync(join(tmpdir(), 'ci-merge-'));
    tmpDirs.push(dir);
    const wf = join(dir, '.github', 'workflows');
    mkdirSync(wf, { recursive: true });
    const file = join(wf, 'ci.yml');
    const tpl = join(dir, 'template.yml');
    writeFileSync(file, projectText, 'utf8');
    writeFileSync(tpl, TPL, 'utf8');
    return { dir, file, tpl };
  }
  const cleanup = (): void => { for (const d of tmpDirs.splice(0)) rmSync(d, { recursive: true, force: true }); };
  const leftovers = (file: string): string[] => readdirSync(join(file, '..')).filter(n => n.includes('.tmp-'));

  test('injected bad region: file byte-identical, no tmp file left', () => {
    const bad = withRegion('  audit:\n    runs-on: ubuntu-latest\n');
    const { file, tpl } = setup(bad);
    try {
      const out = applyCiWorkflowMerge(file, tpl, { dryRun: false, allowTriggerPermDiff: false });
      expect(out.status).toBe('error');
      expect(out.errors.map(e => e.code)).toContain('RESERVED_JOB');
      expect(readFileSync(file, 'utf8')).toBe(bad);
      expect(leftovers(file)).toEqual([]);
    } finally { cleanup(); }
  }, 15000);

  test('post-write re-validation failure: original untouched, tmp removed', () => {
    const legacy = `${HEAD}\n${TEST_JOB}`;
    const { file, tpl } = setup(legacy);
    try {
      const out = applyCiWorkflowMerge(file, tpl, {
        dryRun: false, allowTriggerPermDiff: false,
        validateWritten: () => [{ code: 'YAML_PARSE', detail: 'injected' }],
      });
      expect(out.status).toBe('error');
      expect(readFileSync(file, 'utf8')).toBe(legacy);
      expect(leftovers(file)).toEqual([]);
    } finally { cleanup(); }
  }, 15000);

  test('dry-run never writes; apply migrates atomically and is then unchanged', () => {
    const legacy = `${HEAD}\n${TEST_JOB}`;
    const { file, tpl } = setup(legacy);
    try {
      const dry = applyCiWorkflowMerge(file, tpl, { dryRun: true, allowTriggerPermDiff: false });
      expect(dry.status).toBe('would-update');
      expect(dry.result?.migrated).toEqual(['test']);
      expect(readFileSync(file, 'utf8')).toBe(legacy);
      const real = applyCiWorkflowMerge(file, tpl, { dryRun: false, allowTriggerPermDiff: false });
      expect(real.status).toBe('updated');
      expect(readFileSync(file, 'utf8')).toContain('# PROJECT-JOBS-BEGIN');
      expect(leftovers(file)).toEqual([]);
      expect(applyCiWorkflowMerge(file, tpl, { dryRun: false, allowTriggerPermDiff: false }).status).toBe('unchanged');
    } finally { cleanup(); }
  }, 15000);

  test('missing project file: dry-run reports, apply creates from template', () => {
    const { dir, file, tpl } = setup(TPL);
    try {
      rmSync(file);
      expect(applyCiWorkflowMerge(file, tpl, { dryRun: true, allowTriggerPermDiff: false }).status).toBe('would-create');
      expect(applyCiWorkflowMerge(file, tpl, { dryRun: false, allowTriggerPermDiff: false }).status).toBe('created');
      expect(readFileSync(file, 'utf8')).toBe(TPL);
      expect(dir.length).toBeGreaterThan(0);
    } finally { cleanup(); }
  }, 15000);
});
