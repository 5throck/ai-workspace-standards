/**
 * Integration + unit tests for the sync-overwrite-policy delivery-decision
 * engine (T-20261027-004, spec docs/designs/2026-10-27-sync-overwrite-policy-
 * design.md): provenance baselines (D1), the disposition matrix (D2), the
 * unified decision log (D3), the --disposition flag, the non-zero exit on
 * ERROR dispositions, and v1-manifest compatibility of isDeliveredDiff.
 *
 * Pure-helper suites run against scripts/lib/upgrade-policy.ts exports;
 * engine suites spawn scripts/upgrade-project.ts against a temp project and
 * the real workspace templates (the established upgrade-tree-sync pattern).
 *
 * @version 1.0.0
 */
import { cpSync, existsSync, mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { describe, test, expect } from 'bun:test';

import {
  DECISION_SEVERITY_CONTRACT,
  baselineKeyFor,
  classifyProjectState,
  globToRegExp,
  isDeliveredDiff,
  lifecyclelessText,
  manifestHasUnresolvedErrors,
  resolveDisposition,
  sha256Hex,
  type DecisionBaseline,
} from '../../scripts/lib/upgrade-policy.ts';

const workspaceRoot = resolve(import.meta.dir, '..', '..');
const upgradeScript = join(workspaceRoot, 'scripts', 'upgrade-project.ts');
const VARIANT = 'co-develop';
const PHASE_DEFS_REL = 'docs/phase-definitions.md';
// resolveTemplate semantics: the variant copy wins over common (co-develop ships its own).
const phaseDefsTemplate = existsSync(join(workspaceRoot, 'templates', VARIANT, PHASE_DEFS_REL))
  ? readFileSync(join(workspaceRoot, 'templates', VARIANT, PHASE_DEFS_REL), 'utf8')
  : readFileSync(join(workspaceRoot, 'templates', 'common', PHASE_DEFS_REL), 'utf8');

function makeTempProject(): string {
  const tmp = mkdtempSync(join(tmpdir(), 'upgrade-decision-log-'));
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

function runUpgrade(tmp: string, extraArgs: string[] = []): { status: number; out: string } {
  const result = spawnSync(
    'bun',
    [upgradeScript, tmp, '--variant', VARIANT, '--yes', ...extraArgs],
    { encoding: 'utf-8', timeout: 300000 }
  );
  return { status: result.status ?? -1, out: `${result.stdout ?? ''}\n${result.stderr ?? ''}` };
}

function readManifest(tmp: string): {
  schemaVersion: number;
  files: string[];
  baselines: Record<string, DecisionBaseline>;
  decisions: Array<{ path: string; policy: string; pass: string; verdict: string; severity: string; baseline?: DecisionBaseline; detail: string }>;
} {
  return JSON.parse(readFileSync(join(tmp, '.claude', 'last-upgrade-delivery.json'), 'utf8'));
}

// ═════════════════════════════════════════════════════════════════════════════
// Pure helpers (D1 classification, D2 disposition, D3 severity contract)
// ═════════════════════════════════════════════════════════════════════════════
describe('upgrade-policy decision-log helpers (sync-overwrite-policy)', () => {
  const project = 'project bytes\n';
  const deliverable = 'template bytes v2\n';
  const baselineOf = (content: string): DecisionBaseline => ({ hash: sha256Hex(content), templateVersion: '0.20.1' });

  test('classifyProjectState: UNTOUCHED / IN_SYNC / PROJECT_EVOLVED / NO_BASELINE', () => {
    const base = baselineOf('delivered bytes\n');
    // Project content == delivered baseline → UNTOUCHED.
    const untouched = classifyProjectState('docs/x.md', 'delivered bytes\n', deliverable, base);
    expect(untouched.state).toBe('UNTOUCHED');
    expect(untouched.templateChanged).toBe(true); // today's deliverable differs from the baseline
    // Project already equals today's deliverable → IN_SYNC (no clobber possible).
    const inSync = classifyProjectState('docs/x.md', deliverable, deliverable, base);
    expect(inSync.state).toBe('IN_SYNC');
    expect(inSync.matchesDeliverable).toBe(true);
    // Project differs from both baseline and deliverable → PROJECT_EVOLVED.
    const evolved = classifyProjectState('docs/x.md', project, deliverable, base);
    expect(evolved.state).toBe('PROJECT_EVOLVED');
    expect(evolved.templateChanged).toBe(true);
    // No baseline → degrade (first run after the policy lands).
    const noBaseline = classifyProjectState('docs/x.md', project, deliverable, undefined);
    expect(noBaseline.state).toBe('NO_BASELINE');
    expect(noBaseline.templateChanged).toBe(false);
  });

  test('classifyProjectState: template-unchanged evolution reports templateChanged=false', () => {
    // Baseline == today's deliverable (template content unchanged since delivery).
    const base = baselineOf(deliverable);
    const evolved = classifyProjectState('docs/x.md', project, deliverable, base);
    expect(evolved.state).toBe('PROJECT_EVOLVED');
    expect(evolved.templateChanged).toBe(false);
  });

  test('baselineKeyFor: raw bytes for plain files, lifecycleless bytes for agents/', () => {
    expect(baselineKeyFor('docs/x.md', 'a\n')).toBe(sha256Hex('a\n'));
    const withLifecycle = '---\nname: x\nversion: 1.0.0\nlifecycle:\n  phase: production\nlast_updated: 2026-01-01\n---\nbody\n';
    const withNewDate = withLifecycle.replace('2026-01-01', '2026-10-27');
    // The agents/ key ignores the lifecycle block and the re-stamped date.
    expect(baselineKeyFor('agents/x.md', withLifecycle)).toBe(baselineKeyFor('agents/x.md', withNewDate));
    expect(baselineKeyFor('agents/x.md', withLifecycle)).toBe(sha256Hex(lifecyclelessText(withLifecycle)));
  });

  test('DECISION_SEVERITY_CONTRACT: ERROR/WARN/INFO assignments (design §7)', () => {
    expect(DECISION_SEVERITY_CONTRACT.CONFLICT).toBe('ERROR');
    expect(DECISION_SEVERITY_CONTRACT.EVOLVED).toBe('WARN');
    expect(DECISION_SEVERITY_CONTRACT.DRIFT_PRESERVE).toBe('WARN');
    expect(DECISION_SEVERITY_CONTRACT.SKELETON_COLLISION).toBe('WARN');
    expect(DECISION_SEVERITY_CONTRACT.SEED_SKIP).toBe('INFO');
    expect(DECISION_SEVERITY_CONTRACT.STUB_SKIP).toBe('INFO');
    expect(DECISION_SEVERITY_CONTRACT.ADOPT).toBe('INFO');
  });

  test('resolveDisposition: ERROR default-skip, adopt flip, EVOLVED deliver, non-evolved pass-through', () => {
    const evolvedChanged = { state: 'PROJECT_EVOLVED' as const, matchesDeliverable: false, templateChanged: true };
    const evolvedUnchanged = { state: 'PROJECT_EVOLVED' as const, matchesDeliverable: false, templateChanged: false };
    // Default: CONFLICT (ERROR), delivery skipped.
    const def = resolveDisposition(evolvedChanged, 'docs/x.md', { mode: 'default' });
    expect(def.deliver).toBe(false);
    expect(def.verdict).toBe('CONFLICT');
    expect(def.severity).toBe('ERROR');
    // Explicit adopt-template: deliver + ADOPT (INFO).
    const adopted = resolveDisposition(evolvedChanged, 'docs/x.md', { mode: 'adopt-template', matches: () => true });
    expect(adopted).toEqual({ deliver: true, verdict: 'ADOPT', severity: 'INFO', detail: expect.any(String) });
    // Glob narrowing: only matching paths adopt.
    const narrowed = resolveDisposition(evolvedChanged, 'docs/x.md', {
      mode: 'adopt-template', matches: (rel) => globToRegExp('docs/other.md').test(rel),
    });
    expect(narrowed.deliver).toBe(false);
    // Template content unchanged → deliver as today, EVOLVED (WARN).
    const unchanged = resolveDisposition(evolvedUnchanged, 'docs/x.md', { mode: 'default' });
    expect(unchanged.deliver).toBe(true);
    expect(unchanged.verdict).toBe('EVOLVED');
    expect(unchanged.severity).toBe('WARN');
    // Non-evolved states pass through (the caller logs its own verdict).
    const untouched = resolveDisposition({ state: 'UNTOUCHED', matchesDeliverable: false, templateChanged: true }, 'docs/x.md', { mode: 'default' });
    expect(untouched.deliver).toBe(true);
  });

  test('globToRegExp: **, *, ? with anchoring', () => {
    expect(globToRegExp('docs/**').test('docs/a/b.md')).toBe(true);
    expect(globToRegExp('docs/**').test('agents/a.md')).toBe(false);
    expect(globToRegExp('docs/*.md').test('docs/a.md')).toBe(true);
    expect(globToRegExp('docs/*.md').test('docs/sub/a.md')).toBe(false);
    expect(globToRegExp('docs/?.md').test('docs/a.md')).toBe(true);
    expect(globToRegExp('docs/?.md').test('docs/ab.md')).toBe(false);
  });

  test('manifestHasUnresolvedErrors: v2 with ERROR → true; clean v2 and v1 → false', () => {
    expect(manifestHasUnresolvedErrors({
      schemaVersion: 2, files: [], baselines: {},
      decisions: [{ path: 'a', policy: 'SYNC', pass: 'P', verdict: 'CONFLICT', severity: 'ERROR', detail: 'x' }],
    })).toBe(true);
    expect(manifestHasUnresolvedErrors({
      schemaVersion: 2, files: [], baselines: {},
      decisions: [{ path: 'a', policy: 'SYNC', pass: 'P', verdict: 'ADOPT', severity: 'INFO', detail: 'x' }],
    })).toBe(false);
    // v1-shaped manifest: no decisions key at all.
    expect(manifestHasUnresolvedErrors({ timestamp: '...', files: ['a'] })).toBe(false);
    expect(manifestHasUnresolvedErrors(null)).toBe(false);
    expect(manifestHasUnresolvedErrors('garbage')).toBe(false);
  });

  test('isDeliveredDiff accepts v1 and v2 manifest shapes (files array is the contract)', () => {
    const changed = ['docs/a.md', 'CHANGELOG.md', 'memory/2026-10-27.md'];
    const v1 = { timestamp: 't', files: ['docs/a.md'] };
    const v2 = {
      schemaVersion: 2, timestamp: 't', project: 'p', templateVersion: '1', templateSha: 's', baseSha: 'b',
      files: ['docs/a.md'], baselines: { 'docs/a.md': { hash: 'h', templateVersion: '1' } }, decisions: [],
    };
    expect(isDeliveredDiff(changed, v1.files)).toBe(true);
    expect(isDeliveredDiff(changed, JSON.parse(JSON.stringify(v2)).files)).toBe(true);
    expect(isDeliveredDiff(['docs/other.md'], v2.files)).toBe(false);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// Engine integration (temp project × real templates)
// ═════════════════════════════════════════════════════════════════════════════

/** Seed a v2 manifest claiming `rel` was delivered with `baselineContent` at
 *  template 0.0.0 — the hand-crafted prior-delivery state the escalation
 *  fixtures classify against. */
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

describe('upgrade-project.ts delivery baselines (D1)', () => {
  test('apply run writes a v2 manifest with baselines for delivered files', () => {
    const tmp = makeTempProject();
    try {
      const { status } = runUpgrade(tmp);
      expect(status).toBe(0);
      const manifest = readManifest(tmp);
      expect(manifest.schemaVersion).toBe(2);
      expect(Array.isArray(manifest.files)).toBe(true);
      expect(manifest.files.length).toBeGreaterThan(0);
      expect(Object.keys(manifest.baselines).length).toBeGreaterThan(0);
      // Every baseline hash equals the content key of the bytes on disk.
      for (const [rel, entry] of Object.entries(manifest.baselines)) {
        expect(existsSync(join(tmp, rel))).toBe(true);
        expect(baselineKeyFor(rel, readFileSync(join(tmp, rel), 'utf8'))).toBe(entry.hash);
        expect(entry.templateVersion.length).toBeGreaterThan(0);
      }
      // Decisions recorded with the full schema.
      expect(manifest.decisions.length).toBeGreaterThan(0);
      for (const d of manifest.decisions) {
        expect(typeof d.path).toBe('string');
        expect(typeof d.policy).toBe('string');
        expect(typeof d.pass).toBe('string');
        expect(typeof d.verdict).toBe('string');
        expect(['INFO', 'WARN', 'ERROR']).toContain(d.severity);
        expect(typeof d.detail).toBe('string');
      }
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  }, 120000);

  test('decision-log completeness: NEW / SEED_SKIP verdicts for a fresh project', () => {
    const tmp = makeTempProject();
    try {
      // Pre-existing LICENSE → the GOVERNANCE add-if-missing seed must be
      // recorded as SEED_SKIP rather than staying silent.
      writeFileSync(join(tmp, 'LICENSE'), 'custom project license\n');
      const { status } = runUpgrade(tmp);
      expect(status).toBe(0);
      const manifest = readManifest(tmp);
      const seedSkip = manifest.decisions.find((d) => d.verdict === 'SEED_SKIP' && d.path === 'LICENSE');
      expect(seedSkip).toBeDefined();
      expect(seedSkip!.pass).toBe('GOVERNANCE FILES');
      // Uncovered template docs reach a fresh project as NEW.
      expect(manifest.decisions.some((d) => d.verdict === 'NEW' && d.path === 'docs/user-guide.md')).toBe(true);
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  }, 120000);
});

describe('upgrade-project.ts CONFLICT disposition (D2 — the U-005 vector)', () => {
  const OLD_DELIVERED = '# phase definitions — old delivered revision\n\nstale body the template no longer ships\n';
  const EVOLVED = '# phase definitions — project evolved\n\ncommitted project-side customization\n';

  function makeConflictProject(): string {
    const tmp = makeTempProject();
    // The prior delivery recorded OLD_DELIVERED; the project then committed a
    // divergent body (≠ baseline, ≠ current template) — the U-005 shape.
    mkdirSync(join(tmp, 'docs'), { recursive: true });
    writeFileSync(join(tmp, PHASE_DEFS_REL), EVOLVED);
    seedPriorDelivery(tmp, PHASE_DEFS_REL, OLD_DELIVERED);
    commitAll(tmp, 'chore: committed project evolution');
    return tmp;
  }

  test('default disposition: ERROR skip preserves the project copy and exits non-zero', () => {
    const tmp = makeConflictProject();
    try {
      const { status, out } = runUpgrade(tmp);
      expect(status).toBe(1);
      // The project copy is preserved byte-for-byte — no silent overwrite.
      expect(readFileSync(join(tmp, PHASE_DEFS_REL), 'utf8')).toBe(EVOLVED);
      expect(out).toContain('CONFLICT DISPOSITION (SKIP)');
      expect(out).toContain('DELIVERY CONFLICTS');
      expect(out).toContain('adjudicated-port');
      // The decision log carries the ERROR entry.
      const manifest = readManifest(tmp);
      const conflict = manifest.decisions.find((d) => d.path === PHASE_DEFS_REL && d.verdict === 'CONFLICT');
      expect(conflict).toBeDefined();
      expect(conflict!.severity).toBe('ERROR');
      // D3.1: the manifest now blocks dev-sync step 3.9 auto-E5.
      expect(manifestHasUnresolvedErrors(manifest)).toBe(true);
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  }, 180000);

  test('--disposition adopt-template delivers, logs ADOPT, exits 0, and re-baselines', () => {
    const tmp = makeConflictProject();
    try {
      const { status, out } = runUpgrade(tmp, ['--disposition', 'adopt-template']);
      expect(status).toBe(0);
      // The template copy landed.
      expect(readFileSync(join(tmp, PHASE_DEFS_REL), 'utf8')).toBe(phaseDefsTemplate);
      expect(out).toContain('DISPOSITION (adopt-template): docs/phase-definitions.md');
      const manifest = readManifest(tmp);
      expect(manifestHasUnresolvedErrors(manifest)).toBe(false);
      const adopt = manifest.decisions.find((d) => d.path === PHASE_DEFS_REL && d.verdict === 'ADOPT');
      expect(adopt).toBeDefined();
      // Re-baselined: the recorded hash equals the delivered bytes on disk.
      expect(manifest.baselines[PHASE_DEFS_REL].hash).toBe(baselineKeyFor(PHASE_DEFS_REL, phaseDefsTemplate));
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  }, 180000);

  test('absent baseline degrades to today\'s behavior (overwrite, exit 0, decision logged)', () => {
    const tmp = makeTempProject();
    try {
      // No prior manifest at all — the first run after the policy lands.
      mkdirSync(join(tmp, 'docs'), { recursive: true });
      writeFileSync(join(tmp, PHASE_DEFS_REL), EVOLVED);
      commitAll(tmp, 'chore: evolved, never delivered under the v2 manifest');
      const { status } = runUpgrade(tmp);
      expect(status).toBe(0);
      // Today's behavior: the whole-content overwrite proceeds.
      expect(readFileSync(join(tmp, PHASE_DEFS_REL), 'utf8')).toBe(phaseDefsTemplate);
      const manifest = readManifest(tmp);
      const decision = manifest.decisions.find((d) => d.path === PHASE_DEFS_REL);
      expect(decision).toBeDefined();
      expect(decision!.severity).not.toBe('ERROR');
      // And the delivery seeded the baseline for the next run.
      expect(manifest.baselines[PHASE_DEFS_REL].hash).toBe(baselineKeyFor(PHASE_DEFS_REL, phaseDefsTemplate));
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  }, 180000);
});

describe('upgrade-project.ts agents/ equal-version escalation (D2 dedicated row)', () => {
  const agentTplPath = join(workspaceRoot, 'templates', 'common', 'agents', 'i18n-specialist.md');
  const agentTpl = readFileSync(agentTplPath, 'utf8');
  const agentVersion = agentTpl.match(/^version:\s*"?(\d+\.\d+\.\d+)"?/m)!.slice(1).join('');
  const EVOLVED_AGENT = `---\nname: i18n-specialist\nversion: "${agentVersion}"\ndomain: _shared\ntier: medium\n---\n\n# i18n Specialist — project-evolved body\n\nCommitted project-side divergence the template never shipped.\n`;

  test('PROJECT_EVOLVED at equal version → ERROR skip preserves the project body', () => {
    const tmp = makeTempProject();
    try {
      mkdirSync(join(tmp, 'agents'), { recursive: true });
      writeFileSync(join(tmp, 'agents', 'i18n-specialist.md'), EVOLVED_AGENT);
      seedPriorDelivery(tmp, 'agents/i18n-specialist.md', '---\nname: i18n-specialist\nversion: "1.0.0"\n---\nold scaffold body\n');
      commitAll(tmp, 'chore: committed agent evolution');
      const { status, out } = runUpgrade(tmp);
      expect(status).toBe(1);
      expect(readFileSync(join(tmp, 'agents', 'i18n-specialist.md'), 'utf8')).toBe(EVOLVED_AGENT);
      expect(out).toContain('CONFLICT DISPOSITION (SKIP): agents/i18n-specialist.md');
      const manifest = readManifest(tmp);
      const conflict = manifest.decisions.find((d) => d.path === 'agents/i18n-specialist.md' && d.verdict === 'CONFLICT');
      expect(conflict).toBeDefined();
      expect(conflict!.severity).toBe('ERROR');
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  }, 180000);

  test('baseline-clean equal-version drift still heals to canonical (DRIFT_RESTORED, WARN)', () => {
    const tmp = makeTempProject();
    try {
      mkdirSync(join(tmp, 'agents'), { recursive: true });
      // Delivered-then-untouched content: the baseline hash matches the project
      // bytes exactly, so the file is UNTOUCHED — the canonical heal keeps
      // today's behavior (deliver), now with a WARN decision. The drift is a
      // body line appended after the frontmatter (the template carries no body
      // headings, so the marker cannot corrupt the frontmatter).
      const untouchedDrift = `${agentTpl.trimEnd()}\n<!-- drift marker: untouched since delivery -->\n`;
      writeFileSync(join(tmp, 'agents', 'i18n-specialist.md'), untouchedDrift);
      seedPriorDelivery(tmp, 'agents/i18n-specialist.md', untouchedDrift);
      commitAll(tmp, 'chore: untouched drift');
      const { status } = runUpgrade(tmp);
      expect(status).toBe(0);
      expect(readFileSync(join(tmp, 'agents', 'i18n-specialist.md'), 'utf8')).toBe(agentTpl);
      const manifest = readManifest(tmp);
      const restored = manifest.decisions.find((d) => d.path === 'agents/i18n-specialist.md' && d.verdict === 'DRIFT_RESTORED');
      expect(restored).toBeDefined();
      expect(restored!.severity).toBe('WARN');
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  }, 180000);
});
