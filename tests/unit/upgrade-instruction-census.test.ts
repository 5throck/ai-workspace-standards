/**
 * Engine e2e tests for the instruction-file region census (design
 * docs/designs/2026-10-28-instruction-ownership-backport-hardening-design.md
 * D1–D4): the upgrade MERGE/DOCS_MERGE pass classifies the out-of-zone delta
 * of the five instruction files into the unified decision log
 * (EVOLVED_REGION WARN for project adaptations — never silently reverted),
 * and the census gates the destructive unlabeled-block reconcile: an adapted
 * span is SKIPPED with a CONFLICT (ERROR) row unless --disposition
 * adopt-template covers the path, in which case the replace proceeds with its
 * recovery snapshot and records ADOPT.
 *
 * Fixture: a temp project whose AGENTS.md carries project-authored free-form
 * content (the co-design §4 dispatch-table shape), against the real workspace
 * templates (the established upgrade-decision-log temp-project pattern).
 *
 * @version 1.0.0
 */
import { existsSync, mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { describe, test, expect } from 'bun:test';

const workspaceRoot = resolve(import.meta.dir, '..', '..');
const upgradeScript = join(workspaceRoot, 'scripts', 'upgrade-project.ts');
const VARIANT = 'co-develop';
const AGENTS_REL = 'AGENTS.md';
// resolveTemplate semantics: the variant copy wins over common.
const agentsTemplate = readFileSync(
  existsSync(join(workspaceRoot, 'templates', VARIANT, AGENTS_REL))
    ? join(workspaceRoot, 'templates', VARIANT, AGENTS_REL)
    : join(workspaceRoot, 'templates', 'common', AGENTS_REL),
  'utf8',
);

/** Project-authored free-form content (I3 adaptation) appended to an
 *  otherwise template-faithful copy — the design's co-design §4 shape. */
const PROJECT_SECTION = [
  '',
  '## §9.2 Project Dispatch Table (project-authored)',
  '',
  '| task | agent |',
  '|------|-------|',
  '| [design specialist] | co-design mapping |',
  '| [implementation specialist] | co-design mapping |',
  '',
].join('\n');
const adaptedAgents = agentsTemplate.trimEnd() + '\n' + PROJECT_SECTION;

function makeTempProject(): string {
  const tmp = mkdtempSync(join(tmpdir(), 'upgrade-instruction-census-'));
  spawnSync('git', ['init', '-q'], { cwd: tmp, stdio: ['ignore', 'pipe', 'pipe'] });
  spawnSync('git', ['-C', tmp, 'config', 'user.email', 'test@example.com'], { cwd: tmp, stdio: ['ignore', 'pipe', 'pipe'] });
  spawnSync('git', ['-C', tmp, 'config', 'user.name', 'Test'], { cwd: tmp, stdio: ['ignore', 'pipe', 'pipe'] });
  mkdirSync(join(tmp, '.claude'), { recursive: true });
  writeFileSync(
    join(tmp, '.claude', 'template-version.txt'),
    `variant=${VARIANT}\nversion=0.0.0\ncountry=none\n`
  );
  return tmp;
}

function commitAll(tmp: string, message: string): void {
  spawnSync('git', ['-C', tmp, 'add', '-A'], { stdio: ['ignore', 'pipe', 'pipe'] });
  spawnSync('git', ['-C', tmp, 'commit', '-q', '-m', message], { stdio: ['ignore', 'pipe', 'pipe'] });
}

function runUpgrade(tmp: string, extraArgs: string[] = []): { status: number; out: string } {
  const result = spawnSync(
    'bun',
    [upgradeScript, tmp, '--variant', VARIANT, '--yes', ...extraArgs],
    { encoding: 'utf-8', timeout: 300000, stdio: ['ignore', 'pipe', 'pipe'] }
  );
  return { status: result.status ?? -1, out: `${result.stdout ?? ''}\n${result.stderr ?? ''}` };
}

function readManifest(tmp: string): {
  decisions: Array<{ path: string; verdict: string; severity: string; detail: string }>;
} {
  return JSON.parse(readFileSync(join(tmp, '.claude', 'last-upgrade-delivery.json'), 'utf8'));
}

describe('instruction-region census (D1/D2) — adapted free-form is classified, never reverted', () => {
  test('project-authored AGENTS.md free-form → EVOLVED_REGION (WARN) rows, byte-preserved copy, exit 0', () => {
    const tmp = makeTempProject();
    try {
      writeFileSync(join(tmp, AGENTS_REL), adaptedAgents);
      commitAll(tmp, 'chore: project-authored AGENTS.md adaptation');
      const { status, out } = runUpgrade(tmp);
      expect(status).toBe(0);
      // Census classified the adaptation (dry-run parity: rows print; apply
      // persists them).
      expect(out).toContain('CENSUS [EVOLVED_REGION] AGENTS.md');
      expect(out).toContain('CENSUS [REGION_IN_SYNC] AGENTS.md');
      // The project-authored section survives byte-for-byte — no silent
      // merge-back (the MERGE pass owns zones, never free-form).
      const after = readFileSync(join(tmp, AGENTS_REL), 'utf8');
      expect(after).toContain('## §9.2 Project Dispatch Table (project-authored)');
      expect(after).toContain('| [design specialist] | co-design mapping |');
      const manifest = readManifest(tmp);
      const evolved = manifest.decisions.filter((d) => d.path === AGENTS_REL && d.verdict === 'EVOLVED_REGION');
      expect(evolved.length).toBeGreaterThanOrEqual(1);
      expect(evolved.every((d) => d.severity === 'WARN')).toBe(true);
      expect(evolved[0]!.detail).toContain('adjudicated-port procedure');
      // No census ERROR rows for a pure divergence (Q1: ERROR only when a
      // write channel targets the span).
      expect(manifest.decisions.filter((d) => d.path === AGENTS_REL && d.severity === 'ERROR')).toEqual([]);
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  }, 300000);

  test('a template-faithful AGENTS.md produces ZERO census rows (§6 parity)', () => {
    const tmp = makeTempProject();
    try {
      writeFileSync(join(tmp, AGENTS_REL), agentsTemplate);
      commitAll(tmp, 'chore: template-faithful AGENTS.md');
      const { status, out } = runUpgrade(tmp);
      expect(status).toBe(0);
      expect(out).not.toContain('CENSUS [');
      const manifest = readManifest(tmp);
      expect(manifest.decisions.filter((d) => d.path === AGENTS_REL && d.verdict.startsWith('REGION'))).toEqual([]);
      expect(manifest.decisions.filter((d) => d.path === AGENTS_REL && d.verdict === 'EVOLVED_REGION')).toEqual([]);
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  }, 300000);
});

describe('instruction-region census gate (D2 §4.2) — the reconcile channel', () => {
  /** Duplicating the COMMON-AGENTS block trips the unlabeled count-mismatch
   *  reconcile; the project-authored prose between the two copies is the
   *  adapted span material the census must protect. Line-based surgery keeps
   *  both marker lines intact (a char-offset slice would cut the END marker
   *  mid-line and break the zone scan). */
  const tplLines = agentsTemplate.split('\n');
  const blockStartLine = tplLines.indexOf('<!-- COMMON-AGENTS:START -->');
  const blockEndLine = tplLines.indexOf('<!-- COMMON-AGENTS:END -->');
  expect(blockStartLine).toBeGreaterThanOrEqual(0);
  expect(blockEndLine).toBeGreaterThan(blockStartLine);
  const block = tplLines.slice(blockStartLine, blockEndLine + 1);
  const adaptedWithMismatch = [
    ...tplLines.slice(0, blockEndLine + 1),
    'project-authored prose between the duplicated blocks — must survive the reconcile',
    ...tplLines.slice(blockEndLine + 1),
    ...block,
  ].join('\n');

  test('adapted span + count mismatch, no grant → CONFLICT (ERROR), span preserved, exit 1', () => {
    const tmp = makeTempProject();
    try {
      writeFileSync(join(tmp, AGENTS_REL), adaptedWithMismatch);
      commitAll(tmp, 'chore: adapted AGENTS.md with block count mismatch');
      const { status, out } = runUpgrade(tmp);
      expect(status).toBe(1);
      expect(out).toContain('RECONCILE BLOCKED (adapted out-of-zone span): AGENTS.md');
      // The project-authored inter-block prose survives.
      expect(readFileSync(join(tmp, AGENTS_REL), 'utf8')).toContain('project-authored prose between the duplicated blocks');
      const manifest = readManifest(tmp);
      const conflict = manifest.decisions.find((d) => d.path === AGENTS_REL && d.verdict === 'CONFLICT');
      expect(conflict).toBeDefined();
      expect(conflict!.severity).toBe('ERROR');
      expect(conflict!.detail).toContain('instruction-region census');
      // D4: the CONFLICT row names the sanctioned promotion path.
      expect(conflict!.detail).toContain('adjudicated-port procedure');
      expect(conflict!.detail).toContain('skeleton-registry section');
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  }, 300000);

  test('the same adapted span under --disposition adopt-template delivers (ADOPT row, exit 0)', () => {
    const tmp = makeTempProject();
    try {
      writeFileSync(join(tmp, AGENTS_REL), adaptedWithMismatch);
      commitAll(tmp, 'chore: adapted AGENTS.md with block count mismatch');
      const { status, out } = runUpgrade(tmp, ['--disposition', 'adopt-template']);
      expect(status).toBe(0);
      expect(out).toContain('RECONCILED');
      expect(out).toContain('--disposition adopt-template');
      const manifest = readManifest(tmp);
      const adopt = manifest.decisions.find((d) => d.path === AGENTS_REL && d.verdict === 'ADOPT');
      expect(adopt).toBeDefined();
      expect(adopt!.detail).toContain('instruction-region census gate');
      // The grant delivered + re-baselined: the template block sequence won.
      expect(readFileSync(join(tmp, AGENTS_REL), 'utf8')).not.toContain('project-authored prose between the duplicated blocks');
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  }, 300000);
});
