/**
 * Engine tests for the D9 stub-composed compare and delivery (T-20261028-013,
 * spec docs/designs/2026-10-28-instruction-ownership-backport-hardening-
 * design.md D9): the upgrade-time agents/ pass composes an extends-stub over
 * its `extends:` target via helpers/resolve-pm-stub.ts composeResolvedAgentContent —
 * the exact bytes the scaffold (new-project §2.3b) wrote — and runs the
 * version gate, drift arms, and delivery against those bytes, so
 * variant-scoped stub frontmatter (co-design `phases: [4]`, co-develop
 * `phases: [5]`) converges instead of surfacing as a permanent PROJECT_EVOLVED
 * CONFLICT (ERROR).
 *
 * Fixtures use the co-develop stub (`phases: [5]`, version 1.1.0) against the
 * real workspace templates (the established upgrade-decision-log temp-project
 * pattern). MERGE_MANAGED exclusion (agents/pm.md — the MERGE pass owns the
 * body) and the D9 stub version-bump advisory row (§10 Q5, INFO-only) are
 * pinned here too.
 *
 * @version 1.0.0
 */
import { existsSync, mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { describe, test, expect } from 'bun:test';

import {
  DECISION_SEVERITY_CONTRACT,
  baselineKeyFor,
  type DecisionBaseline,
} from '../../scripts/lib/upgrade-policy.ts';
import { composeResolvedAgentContent } from '../../scripts/helpers/resolve-pm-stub.ts';

const workspaceRoot = resolve(import.meta.dir, '..', '..');
const upgradeScript = join(workspaceRoot, 'scripts', 'upgrade-project.ts');
const VARIANT = 'co-develop';
const I18N_REL = 'agents/i18n-specialist.md';
const stubPath = join(workspaceRoot, 'templates', VARIANT, 'agents', 'i18n-specialist.md');
const targetPath = join(workspaceRoot, 'templates', 'common', 'agents', 'i18n-specialist.md');
const stubRaw = readFileSync(stubPath, 'utf8');
const targetRaw = readFileSync(targetPath, 'utf8');
/** The exact bytes the scaffold wrote into the project (new-project §2.3b). */
const composed = composeResolvedAgentContent(stubPath, targetPath, VARIANT);
if (!composed.composed) throw new Error('fixture setup: the co-develop i18n stub did not compose');
const composedContent = composed.content;

function makeTempProject(): string {
  const tmp = mkdtempSync(join(tmpdir(), 'upgrade-stub-composed-'));
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
  baselines: Record<string, DecisionBaseline>;
  decisions: Array<{ path: string; verdict: string; severity: string; detail: string }>;
} {
  return JSON.parse(readFileSync(join(tmp, '.claude', 'last-upgrade-delivery.json'), 'utf8'));
}

function seedPriorDelivery(tmp: string, rel: string, baselineContent: string): void {
  const manifestPath = join(tmp, '.claude', 'last-upgrade-delivery.json');
  const manifest = existsSync(manifestPath)
    ? JSON.parse(readFileSync(manifestPath, 'utf8'))
    : { schemaVersion: 2, timestamp: 'test', project: 'fixture', templateVersion: '0.0.0', templateSha: '', baseSha: '', files: [rel], baselines: {}, decisions: [] };
  manifest.schemaVersion = 2;
  manifest.baselines = manifest.baselines ?? {};
  manifest.baselines[rel] = { hash: baselineKeyFor(rel, baselineContent), templateVersion: '0.0.0' };
  if (!manifest.files.includes(rel)) manifest.files.push(rel);
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
}

describe('D9 stub-composed compare and delivery (T-20261028-013)', () => {
  test('the composed expectation carries the variant-scoped stub frontmatter; the L1 target never does', () => {
    // The whole point of D9: phases exists on BOTH sides of the compare.
    expect(composedContent).toMatch(/phases:/);
    expect(stubRaw).toMatch(/phases: \[5\]/);
    // The common body must NOT carry variant values (no leak into L1).
    expect(targetRaw).not.toMatch(/^phases:/m);
    expect(targetRaw).not.toMatch(/variant: co-/m);
  });

  test('a scaffold-composed project copy is IN_SYNC — no CONFLICT, no re-delivery loop', () => {
    const tmp = makeTempProject();
    try {
      mkdirSync(join(tmp, 'agents'), { recursive: true });
      writeFileSync(join(tmp, I18N_REL), composedContent);
      seedPriorDelivery(tmp, I18N_REL, composedContent);
      commitAll(tmp, 'chore: scaffold-composed agent copy');
      const { status, out } = runUpgrade(tmp);
      expect(status).toBe(0);
      // The compare used composed bytes (the D9 line), and the file converged:
      // no COPIED line (a version-gt ADOPT here would mean the gate read the
      // TARGET's version — 1.3.0 > 1.1.0 — instead of the composed stub
      // version, which would re-adopt on every run).
      expect(out).toContain('STUB → delivers composed extends target:');
      expect(out).not.toContain('COPIED: agents/i18n-specialist.md');
      expect(out).not.toContain('CONFLICT DISPOSITION (SKIP): agents/i18n-specialist.md');
      expect(readFileSync(join(tmp, I18N_REL), 'utf8')).toBe(composedContent);
      const manifest = readManifest(tmp);
      expect(manifest.decisions.filter((d) => d.path === I18N_REL)).toEqual([]);
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  }, 300000);

  test('a pre-D9 bare-target delivery heals to composed bytes (DRIFT_RESTORED, WARN) — phases re-lands, never reverts', () => {
    const tmp = makeTempProject();
    try {
      mkdirSync(join(tmp, 'agents'), { recursive: true });
      // What the pre-D9 engine delivered: the bare extends-target bytes, with
      // the variant-scoped stub fields clobbered away.
      writeFileSync(join(tmp, I18N_REL), targetRaw);
      seedPriorDelivery(tmp, I18N_REL, targetRaw);
      commitAll(tmp, 'chore: pre-D9 delivered bytes');
      const { status, out } = runUpgrade(tmp);
      expect(status).toBe(0);
      expect(out).toContain('STUB → delivers composed extends target:');
      const delivered = readFileSync(join(tmp, I18N_REL), 'utf8');
      // The one-time migration heal delivers COMPOSED bytes — the variant
      // value re-lands template-side instead of being reverted (the old loop:
      // wave reverts phases, project re-fixes, wave reverts…).
      expect(delivered).toMatch(/phases:/);
      const manifest = readManifest(tmp);
      const restored = manifest.decisions.find((d) => d.path === I18N_REL && d.verdict === 'DRIFT_RESTORED');
      expect(restored).toBeDefined();
      expect(restored!.severity).toBe('WARN');
      // The stub changed template-side (composed ≠ bare-target baseline)
      // while the version gate could not fire → the Q5 advisory row fires.
      const advice = manifest.decisions.find((d) => d.path === I18N_REL && d.verdict === 'STUB_VERSION_BUMP_ADVICE');
      expect(advice).toBeDefined();
      expect(advice!.severity).toBe('INFO');
      expect(advice!.detail).toContain('stub-owned fields changed template-side');
      expect(advice!.detail).toContain('bump the stub version in the port PR');
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  }, 300000);

  test('genuine project evolution on a stub-composed file still escalates to CONFLICT (ERROR) and is preserved', () => {
    const tmp = makeTempProject();
    try {
      mkdirSync(join(tmp, 'agents'), { recursive: true });
      const evolved = `${composedContent.trimEnd()}\n\n<!-- project-authored divergence -->\n`;
      writeFileSync(join(tmp, I18N_REL), evolved);
      seedPriorDelivery(tmp, I18N_REL, composedContent);
      commitAll(tmp, 'chore: committed agent evolution');
      const { status, out } = runUpgrade(tmp);
      expect(status).toBe(1);
      expect(readFileSync(join(tmp, I18N_REL), 'utf8')).toBe(evolved);
      expect(out).toContain('CONFLICT DISPOSITION (SKIP): agents/i18n-specialist.md');
      const manifest = readManifest(tmp);
      const conflict = manifest.decisions.find((d) => d.path === I18N_REL && d.verdict === 'CONFLICT');
      expect(conflict).toBeDefined();
      expect(conflict!.severity).toBe('ERROR');
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  }, 300000);

  test('MERGE_MANAGED files stay excluded — agents/pm.md never delivers through the composed arm', () => {
    const tmp = makeTempProject();
    try {
      mkdirSync(join(tmp, 'agents'), { recursive: true });
      const pmStub = '---\nextends: ../../../agents/pm.md\nname: pm\nversion: "2.0.1"\ntier: medium\nstatus: active\n---\n';
      writeFileSync(join(tmp, 'agents', 'pm.md'), pmStub);
      commitAll(tmp, 'chore: pm stub fixture');
      const { out } = runUpgrade(tmp);
      expect(out).toContain('STUB (resolved at scaffold): agents/pm.md');
      expect(out).not.toMatch(/composed extends target:.*pm\.md/);
      // The agents/ STUB_SKIP branch never whole-file-writes pm.md (the
      // MERGE pass owns the body — any pm.md body change in the output comes
      // from that pass, which is out of D9's scope).
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  }, 300000);
});

describe('D9 advisory contract (design §10 Q5 — advisory-only this wave)', () => {
  test('STUB_VERSION_BUMP_ADVICE joins the decision contract at INFO', () => {
    expect(DECISION_SEVERITY_CONTRACT.STUB_VERSION_BUMP_ADVICE).toBe('INFO');
  });
});
