/**
 * Integration + unit tests for the sync-overwrite-policy delivery-decision
 * engine (T-20261027-004, spec docs/designs/2026-10-27-sync-overwrite-policy-
 * design.md): provenance baselines (D1), the disposition matrix (D2), the
 * unified decision log (D3), the --disposition flag, the non-zero exit on
 * ERROR dispositions, and v1-manifest compatibility of isDeliveredDiff.
 *
 * v1.1.0 (2026-10-28, U-20261028-001 — spec
 *         docs/designs/2026-10-28-delivery-tombstone-ownership-design.md):
 *         delivery tombstones (D1–D3) — absent+baseline TOMBSTONED (ERROR)
 *         skip + non-zero exit, --tombstone recording (entry persisted with
 *         reason, honored immediately), TOMBSTONED_SKIP (INFO) carry-through,
 *         the carry-forward rule minus delivered paths, --clear-tombstone →
 *         next run delivers as NEW with the entry gone, adopt-template cannot
 *         override a tombstone (D3b), --dry-run refusal of the tombstone
 *         flags, and the agents/ version-gt CONFLICT escalation + NO_BASELINE
 *         migration-window detail (D4).
 *
 * v1.2.0 (2026-10-28, T-20261028-010 — spec
 *         docs/designs/2026-10-28-stub-frontmatter-backfill-design.md): stub
 *         frontmatter scalar backfill — backfillStubFrontmatter pure-helper
 *         cases (all-three-missing → tier/version from the counterpart +
 *         last_updated = delivery date; all-present → byte-identical no-op;
 *         non-stub content never touched; body bytes unchanged in every case;
 *         CRLF preserved; map-form/absent counterpart side fills nothing;
 *         invalid delivery date leaves last_updated unfilled), the
 *         STUB_FM_BACKFILL (INFO) severity-contract row, and engine cases
 *         (temp project stub agents/pm.md without the scalars gets them
 *         backfilled from the template counterpart with the manifest row; a
 *         stub already carrying the fields is untouched with no row).
 *
 * v1.3.0 (2026-10-28, T-20261028-013 — spec
 *         docs/designs/2026-10-28-instruction-ownership-backport-hardening-design.md
 *         D9): the stub-composed compare changes what "today's deliverable"
 *         means for the extends-stub i18n-specialist fixture — the agents/ pass
 *         now composes the stub over its L1 target (composeResolvedAgentContent)
 *         instead of comparing the bare target bytes, and the version gate reads
 *         the COMPOSED frontmatter (the stub version ladder). Fixtures updated:
 *         baselines meaning "template unchanged since delivery" seed the
 *         composed bytes; delivery expectations expect composed bytes; the
 *         version-gated ADOPT case rides the stub ladder (project version below
 *         the stub's). Pure helper suites and the tombstone/baseline suites are
 *         untouched.
 *
 * v1.4.0 (2026-10-29, spec docs/designs/2026-10-29-delivery-bookkeeping-engine-
 *         design.md, DEC-20261029-01 — PR1): (B1) the TOMBSTONE_CLEARED (INFO)
 *         retraction row — the existing clear → next-run-NEW regression gains
 *         row assertions, a glob-exactness engine case (non-matching tombstone
 *         + baseline entries survive the grant), and the pure tombstoneGuard
 *         no-fire pin for cleared paths; (B2) the tombstones carry-forward
 *         prunes template-departed entries (the v1.3.0 "carried forward
 *         verbatim" ghost expectation flips — the asymmetry with the baselines
 *         rule is closed) while template-present tombstones still survive;
 *         (D1) STUB_VERSION_DIVERGENCE (INFO) — a stub pinned at an older
 *         version than its template counterpart reports the divergence
 *         (backfill never overwrites; a sanctioned pin stays INFO), an
 *         equal-version stub reports nothing.
 *
 * Pure-helper suites run against scripts/lib/upgrade-policy.ts exports;
 * engine suites spawn scripts/upgrade-project.ts against a temp project and
 * the real workspace templates (the established upgrade-tree-sync pattern).
 *
 * @version 1.4.0
 */
import { cpSync, existsSync, mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { describe, test, expect } from 'bun:test';

import {
  DECISION_SEVERITY_CONTRACT,
  backfillStubFrontmatter,
  baselineKeyFor,
  classifyProjectState,
  globToRegExp,
  isDeliveredDiff,
  lifecyclelessText,
  manifestHasUnresolvedErrors,
  resolveDisposition,
  sha256Hex,
  tombstoneGuard,
  type DecisionBaseline,
} from '../../scripts/lib/upgrade-policy.ts';
import { composeResolvedAgentContent } from '../../scripts/helpers/resolve-pm-stub.ts';

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
  // Windows handle hygiene (PR #1677 CI, run 40603661108): the engine spawns
  // its own bun grandchildren (skill-graph / VERSION_MANIFEST / snapshot /
  // provenance regenerations). Pin the child's stdin closed ('ignore') so no
  // git or bun subprocess can ever block on an inherited stdin handle, and
  // keep stdout/stderr as fully consumed pipes. spawnSync reaps the direct
  // child before returning; the engine's own grandchildren exit before it.
  // The file-level CI wall is handled by the test-runner per-file budget
  // override (scripts/test-runner.ts v1.6.0).
  const result = spawnSync(
    'bun',
    [upgradeScript, tmp, '--variant', VARIANT, '--yes', ...extraArgs],
    { encoding: 'utf-8', timeout: 300000, stdio: ['ignore', 'pipe', 'pipe'] }
  );
  return { status: result.status ?? -1, out: `${result.stdout ?? ''}\n${result.stderr ?? ''}` };
}

function readManifest(tmp: string): {
  schemaVersion: number;
  files: string[];
  baselines: Record<string, DecisionBaseline>;
  tombstones?: Record<string, { hash: string; templateVersion: string; recordedAt: string; reason: string }>;
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
    // v1.31.0 verdicts (2026-10-29-delivery-bookkeeping-engine B1/D1): both
    // INFO — a retraction is expected mechanics and a pinned stub version is
    // sanctioned divergence (WARN would fire on every legitimate pin).
    expect(DECISION_SEVERITY_CONTRACT.TOMBSTONE_CLEARED).toBe('INFO');
    expect(DECISION_SEVERITY_CONTRACT.STUB_VERSION_DIVERGENCE).toBe('INFO');
  });

  test('tombstoneGuard: no fire for a path whose entries were cleared (B1 regression)', () => {
    // The clear grant drops matching tombstones AND carried-forward baselines
    // (94a390945) — with both gone the D2 fire condition
    // `absent && (tombstones[rel] || baselines[rel])` cannot fire, so the next
    // run delivers the path as a clean NEW.
    const cleared = { tombstones: {}, baselines: {} };
    expect(tombstoneGuard(WORKFLOWS_REL, cleared, true).fires).toBe(false);
    // The catch-22 the baseline drop prevents: a retained baseline re-fires
    // TOMBSTONED (ERROR) on the next run.
    const baselineOnly = { tombstones: {}, baselines: { [WORKFLOWS_REL]: { hash: 'h', templateVersion: '0.0.0' } } };
    const fired = tombstoneGuard(WORKFLOWS_REL, baselineOnly, true);
    expect(fired.fires).toBe(true);
    expect(fired.verdict).toBe('TOMBSTONED');
    expect(fired.severity).toBe('ERROR');
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

  test('globToRegExp: /**/ zero-segment semantics (T-20261028-002)', () => {
    // a/**/b must match a/b (zero intermediate segments) and any depth below.
    expect(globToRegExp('a/**/b').test('a/b')).toBe(true);
    expect(globToRegExp('a/**/b').test('a/x/b')).toBe(true);
    expect(globToRegExp('a/**/b').test('a/x/y/b')).toBe(true);
    expect(globToRegExp('a/**/b').test('a/x/c')).toBe(false);
    // leading **/ matches top level.
    expect(globToRegExp('**/b').test('b')).toBe(true);
    expect(globToRegExp('**/b').test('x/b')).toBe(true);
    // trailing /** and bare ** keep the pre-1.26.0 semantics.
    expect(globToRegExp('a/**').test('a/x/y')).toBe(true);
    expect(globToRegExp('**').test('anything/at/all')).toBe(true);
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
// Stub frontmatter scalar backfill (T-20261028-010 — spec
// docs/designs/2026-10-28-stub-frontmatter-backfill-design.md)
// ═════════════════════════════════════════════════════════════════════════════
describe('backfillStubFrontmatter (T-20261028-010 stub FM backfill)', () => {
  const DATE = '2026-10-28';
  // The variant-stub counterpart shape (templates/<variant>/agents/pm.md):
  // scalar tier, quoted version, its own authoring last_updated.
  const counterpart = [
    '---',
    'extends: ../../common/agents/pm.md',
    'name: pm',
    'version: "2.1.0"',
    'last_updated: "2026-10-27"',
    'status: active',
    'tier: medium',
    'model: inherit',
    '---',
    '',
    'Stub-pointer body — project-owned, never touched.',
    '',
  ].join('\n');
  const BODY = '\nFixture stub body line that stays project-owned.\n';

  test('all three missing → tier/version from the counterpart, last_updated = delivery date, INFO contract row', () => {
    const stub = `---\nextends: ../../../agents/pm.md\nname: pm\nstatus: active\n---${BODY}`;
    const out = backfillStubFrontmatter(stub, counterpart, DATE);
    expect(out.changed).toBe(true);
    expect(out.filled).toEqual(['tier', 'version', 'last_updated']);
    expect(out.content).toContain('tier: medium');
    expect(out.content).toContain('version: "2.1.0"');
    // last_updated is the DELIVERY date, not the counterpart's authoring date.
    expect(out.content).toContain(`last_updated: ${DATE}`);
    expect(out.content).not.toContain('2026-10-27');
    // Body bytes unchanged; existing frontmatter keys not reordered.
    expect(out.content.endsWith(`---\nextends: ../../../agents/pm.md\nname: pm\nstatus: active\ntier: medium\nversion: "2.1.0"\nlast_updated: ${DATE}\n---${BODY}`)).toBe(true);
    expect(DECISION_SEVERITY_CONTRACT.STUB_FM_BACKFILL).toBe('INFO');
  });

  test('all fields present → byte-identical no-op (no write, no row)', () => {
    const stub = `---\nextends: ../../../agents/pm.md\nname: pm\nversion: "2.0.1"\nlast_updated: "2026-08-28"\nstatus: active\ntier: medium\n---${BODY}`;
    const out = backfillStubFrontmatter(stub, counterpart, DATE);
    expect(out).toEqual({ content: stub, changed: false, filled: [] });
  });

  test('non-stub content (no extends:) is never touched — helper-level ownership guard', () => {
    const resolved = `---\nname: pm\nstatus: active\nversion: "1.0.0"\ntier: medium\n---${BODY}`;
    const missingTier = `---\nname: pm\nstatus: active\n---${BODY}`;
    expect(backfillStubFrontmatter(resolved, counterpart, DATE)).toEqual({ content: resolved, changed: false, filled: [] });
    expect(backfillStubFrontmatter(missingTier, counterpart, DATE)).toEqual({ content: missingTier, changed: false, filled: [] });
  });

  test('body bytes unchanged in every case; partial absence fills only the missing keys', () => {
    const hasVersion = `---\nextends: ../../../agents/pm.md\nname: pm\nversion: "2.0.1"\nstatus: active\n---${BODY}`;
    const out = backfillStubFrontmatter(hasVersion, counterpart, DATE);
    expect(out.changed).toBe(true);
    expect(out.filled).toEqual(['tier', 'last_updated']);
    expect(out.content.endsWith(BODY)).toBe(true);
    expect(out.content).not.toContain('version: "2.1.0"'); // existing value untouched
    // A map-form or absent template tier side fills nothing (never invent structure).
    const noTierCounterpart = counterpart.replace('\ntier: medium', '');
    const tierMissing = `---\nextends: ../../../agents/pm.md\nname: pm\nstatus: active\n---${BODY}`;
    const out2 = backfillStubFrontmatter(tierMissing, noTierCounterpart, DATE);
    expect(out2.filled).toEqual(['version', 'last_updated']);
    expect(out2.content.endsWith(BODY)).toBe(true);
    // Empty-value tier key is treated as present (v1.24.0 contract: never invent structure).
    const emptyTier = `---\nextends: ../../../agents/pm.md\nname: pm\nversion: "2.0.1"\nlast_updated: "2026-08-28"\ntier:\nstatus: active\n---${BODY}`;
    expect(backfillStubFrontmatter(emptyTier, counterpart, DATE).content).toBe(emptyTier);
  });

  test('CRLF stubs stay CRLF; invalid delivery date leaves last_updated unfilled', () => {
    const stub = '---\r\nextends: ../../../agents/pm.md\r\nname: pm\r\nstatus: active\r\n---\r\n\r\nCRLF body.\r\n';
    const out = backfillStubFrontmatter(stub, counterpart.replace(/\n/g, '\r\n'), DATE);
    expect(out.changed).toBe(true);
    expect(out.filled).toEqual(['tier', 'version', 'last_updated']);
    expect(out.content).toContain('tier: medium\r\nversion: "2.1.0"\r\nlast_updated: 2026-10-28\r\n');
    expect(out.content.endsWith('---\r\n\r\nCRLF body.\r\n')).toBe(true);
    const badDate = backfillStubFrontmatter(stub, counterpart, '2026-10-28T00:00:00Z');
    expect(badDate.filled).toEqual(['tier', 'version']);
    expect(badDate.content).not.toContain('last_updated:');
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
      // D9: "canonical" for the extends-stub i18n-specialist is the COMPOSED
      // bytes (stub frontmatter over the L1 target), so the baseline and the
      // expected delivery both use composedDeliverable.
      const untouchedDrift = `${composedDeliverable.trimEnd()}\n<!-- drift marker: untouched since delivery -->\n`;
      writeFileSync(join(tmp, 'agents', 'i18n-specialist.md'), untouchedDrift);
      seedPriorDelivery(tmp, 'agents/i18n-specialist.md', untouchedDrift);
      commitAll(tmp, 'chore: untouched drift');
      const { status } = runUpgrade(tmp);
      expect(status).toBe(0);
      expect(readFileSync(join(tmp, 'agents', 'i18n-specialist.md'), 'utf8')).toBe(restamped(composedDeliverable));
      const manifest = readManifest(tmp);
      const restored = manifest.decisions.find((d) => d.path === 'agents/i18n-specialist.md' && d.verdict === 'DRIFT_RESTORED');
      expect(restored).toBeDefined();
      expect(restored!.severity).toBe('WARN');
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  }, 180000);
});

const OLD_PHASE_DEFS = '# phase definitions — old delivered revision\n\nstale body the template no longer ships\n';
const commonAgentTpl = readFileSync(join(workspaceRoot, 'templates', 'common', 'agents', 'i18n-specialist.md'), 'utf8');
const commonAgentVersion = commonAgentTpl.match(/^version:\s*"?(\d+\.\d+\.\d+)"?/m)!.slice(1).join('');
// D9 (T-20261028-013): for the extends-stub i18n-specialist, "today's
// deliverable" is the stub-composed bytes — the stub frontmatter (co-develop
// carries `phases: [5]`, version 1.1.0) merged over the L1 target — exactly
// what the scaffold wrote. The bare target bytes above are the pre-D9 shape.
const composedDeliverable = composeResolvedAgentContent(
  join(workspaceRoot, 'templates', VARIANT, 'agents', 'i18n-specialist.md'),
  join(workspaceRoot, 'templates', 'common', 'agents', 'i18n-specialist.md'),
  VARIANT,
).content;
// The post-delivery re-stamp (v1.74.0 top-level; v1.84.0 nested lifecycle
// block, A1) advances BOTH frontmatter `last_updated` stamps — the stub
// frontmatter carries a top-level one and the L1 target's lifecycle block
// carries the nested one. The engine stamps new Date().toISOString().slice(0, 10).
const deliveryDate = new Date().toISOString().slice(0, 10);
const restamped = (content: string): string =>
  content
    .replace(/^last_updated:.*$/m, `last_updated: ${deliveryDate}`)
    .replace(/^([ \t]+last_updated:).*$/m, `$1 ${deliveryDate}`);

// ═════════════════════════════════════════════════════════════════════════════
// Delivery tombstones (U-20261028-001 D1–D3, spec
// docs/designs/2026-10-28-delivery-tombstone-ownership-design.md)
// ═════════════════════════════════════════════════════════════════════════════

/** The L1 file whose co-design deletion is the U-001 resurrection vector —
 *  delivered by the TEMPLATE TREE SYNC SYNC-absent branch. */
const WORKFLOWS_REL = 'docs/governance/agents/workflows.md';
const workflowsTemplate = readFileSync(join(workspaceRoot, 'templates', 'common', WORKFLOWS_REL), 'utf8');
const OLD_WORKFLOWS = `${workflowsTemplate.trimEnd()}\n<!-- prior delivery fixture -->\n`;

/** Seed a recorded tombstone for `rel` on top of its prior delivery baseline. */
function seedPriorTombstone(tmp: string, rel: string, baselineContent: string, reason = 'fixture: project ruled the file dead'): void {
  seedPriorDelivery(tmp, rel, baselineContent);
  const manifestPath = join(tmp, '.claude', 'last-upgrade-delivery.json');
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  manifest.tombstones = manifest.tombstones ?? {};
  manifest.tombstones[rel] = {
    hash: manifest.baselines[rel].hash,
    templateVersion: '0.0.0',
    recordedAt: '2026-10-28',
    reason,
  };
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
}

describe('upgrade-project.ts delivery tombstones (U-20261028-001 D1–D3)', () => {
  function makeTombstoneProject(withTombstone = false): string {
    // The project deleted a previously delivered file: the prior manifest
    // carries its baseline, the working tree does not carry the file. Any
    // tombstone seed MUST land before commitAll — the engine's pre-upgrade
    // stash reverts uncommitted tracked changes, so an uncommitted seed would
    // not be seen by the run.
    const tmp = makeTempProject();
    seedPriorDelivery(tmp, WORKFLOWS_REL, OLD_WORKFLOWS);
    if (withTombstone) {
      const manifestPath = join(tmp, '.claude', 'last-upgrade-delivery.json');
      const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
      manifest.tombstones = manifest.tombstones ?? {};
      manifest.tombstones[WORKFLOWS_REL] = {
        hash: manifest.baselines[WORKFLOWS_REL].hash,
        templateVersion: '0.0.0',
        recordedAt: '2026-10-28',
        reason: 'fixture: project ruled the file dead',
      };
      writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
    }
    commitAll(tmp, 'chore: prior delivery recorded');
    return tmp;
  }

  test('dry-run reports the TOMBSTONED candidate (ERROR) and persists nothing', () => {
    const tmp = makeTombstoneProject();
    try {
      const seeded = readFileSync(join(tmp, '.claude', 'last-upgrade-delivery.json'), 'utf8');
      const { status, out } = runUpgrade(tmp, ['--dry-run']);
      expect(status).toBe(1);
      expect(out).toContain(`TOMBSTONE (SKIP): ${WORKFLOWS_REL}`);
      expect(out).toContain('severity ERROR');
      expect(out).toContain(`confirm with --tombstone ${WORKFLOWS_REL}`);
      // Dry-run persists nothing: the seeded manifest is byte-identical.
      expect(readFileSync(join(tmp, '.claude', 'last-upgrade-delivery.json'), 'utf8')).toBe(seeded);
      expect(existsSync(join(tmp, WORKFLOWS_REL))).toBe(false);
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  }, 180000);

  test('apply: TOMBSTONED (ERROR) skips the delivery and exits non-zero', () => {
    const tmp = makeTombstoneProject();
    try {
      const { status, out } = runUpgrade(tmp);
      expect(status).toBe(1);
      // The deleted copy stays deleted — no silent resurrection.
      expect(existsSync(join(tmp, WORKFLOWS_REL))).toBe(false);
      expect(out).toContain('DELIVERY CONFLICTS');
      expect(out).toContain('Tombstoned paths — how to proceed');
      const manifest = readManifest(tmp);
      const decision = manifest.decisions.find((d) => d.path === WORKFLOWS_REL && d.verdict === 'TOMBSTONED');
      expect(decision).toBeDefined();
      expect(decision!.severity).toBe('ERROR');
      expect(decision!.baseline?.hash).toBe(baselineKeyFor(WORKFLOWS_REL, OLD_WORKFLOWS));
      // D3.1: the ERROR blocks dev-sync step 3.9 auto-E5.
      expect(manifestHasUnresolvedErrors(manifest)).toBe(true);
      // No tombstone entry exists yet — recording is the operator's grant.
      expect(manifest.tombstones?.[WORKFLOWS_REL]).toBeUndefined();
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  }, 180000);

  test('--tombstone records the entry (reason, hash, recordedAt) and honors it immediately', () => {
    const tmp = makeTombstoneProject();
    try {
      const { status, out } = runUpgrade(tmp, [
        '--tombstone', WORKFLOWS_REL,
        '--tombstone-reason', 'co-design merged PR #59 / Ruling 3 — un-adapted L0 copy',
      ]);
      expect(status).toBe(0);
      expect(existsSync(join(tmp, WORKFLOWS_REL))).toBe(false);
      expect(out).toContain('TOMBSTONE (recorded)');
      const manifest = readManifest(tmp);
      const entry = manifest.tombstones?.[WORKFLOWS_REL];
      expect(entry).toBeDefined();
      expect(entry!.reason).toContain('Ruling 3');
      expect(entry!.hash).toBe(baselineKeyFor(WORKFLOWS_REL, OLD_WORKFLOWS));
      expect(entry!.recordedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(entry!.templateVersion.length).toBeGreaterThan(0);
      const decision = manifest.decisions.find((d) => d.path === WORKFLOWS_REL && d.verdict === 'TOMBSTONED_SKIP');
      expect(decision).toBeDefined();
      expect(decision!.severity).toBe('INFO');
      expect(manifestHasUnresolvedErrors(manifest)).toBe(false);
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  }, 180000);

  test('recorded tombstone → TOMBSTONED_SKIP (INFO), path stays absent, entry carried forward', () => {
    const tmp = makeTombstoneProject(true);
    try {
      const { status, out } = runUpgrade(tmp);
      expect(status).toBe(0);
      expect(existsSync(join(tmp, WORKFLOWS_REL))).toBe(false);
      expect(out).toContain('tombstoned deletion honored');
      const manifest = readManifest(tmp);
      const decision = manifest.decisions.find((d) => d.path === WORKFLOWS_REL && d.verdict === 'TOMBSTONED_SKIP');
      expect(decision).toBeDefined();
      expect(decision!.severity).toBe('INFO');
      expect(manifest.tombstones?.[WORKFLOWS_REL]).toBeDefined();
      expect(manifestHasUnresolvedErrors(manifest)).toBe(false);
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  }, 180000);

  test('--clear-tombstone drops the entry; the next run delivers the path as NEW', () => {
    const tmp = makeTombstoneProject(true);
    try {
      // Run 1: the grant drops the entry, but the still-recorded tombstone
      // governs THIS run — the path is skipped (INFO), nothing delivered.
      const first = runUpgrade(tmp, ['--clear-tombstone', 'docs/governance/**']);
      expect(first.status).toBe(0);
      expect(existsSync(join(tmp, WORKFLOWS_REL))).toBe(false);
      const manifest1 = readManifest(tmp);
      expect(manifest1.tombstones?.[WORKFLOWS_REL]).toBeUndefined();
      expect(Object.keys(manifest1.tombstones ?? {}).length).toBe(0);
      expect(manifest1.baselines[WORKFLOWS_REL]).toBeUndefined();
      // B1 (v1.84.0): the retraction is auditable — one TOMBSTONE_CLEARED
      // (INFO) row naming the grant glob and the dropped paths, recorded via
      // the shipped baseline-drop semantics (94a390945), which this run's
      // entry+baseline absences pin.
      const clearedRow = manifest1.decisions.find((d) => d.verdict === 'TOMBSTONE_CLEARED');
      expect(clearedRow).toBeDefined();
      expect(clearedRow!.severity).toBe('INFO');
      expect(clearedRow!.path).toBe('docs/governance/**');
      expect(clearedRow!.detail).toContain(WORKFLOWS_REL);
      expect(clearedRow!.detail).toContain('docs/governance/**');
      expect(manifestHasUnresolvedErrors(manifest1)).toBe(false);
      // Land run 1 before run 2 — the engine's pre-upgrade stash reverts an
      // uncommitted prior wave, so the second wave must start from a commit.
      // Run 1 delivered the template tree, which configured the project's git
      // hooks (core.hooksPath) — unset it so the test's landing commit is not
      // blocked by the /sync-gated pre-commit hook (hook wiring is not under
      // test here).
      spawnSync('git', ['-C', tmp, 'config', '--unset', 'core.hooksPath']);
      commitAll(tmp, 'chore: wave 1 landing (tombstone cleared, path still absent)');
      // Run 2: no tombstone, no baseline → the guard cannot fire; the path
      // delivers as a normal NEW and a fresh baseline is written.
      const second = runUpgrade(tmp);
      expect(second.status).toBe(0);
      expect(readFileSync(join(tmp, WORKFLOWS_REL), 'utf8')).toBe(workflowsTemplate);
      const manifest2 = readManifest(tmp);
      expect(manifest2.decisions.some((d) => d.path === WORKFLOWS_REL && d.verdict === 'NEW')).toBe(true);
      expect(manifest2.baselines[WORKFLOWS_REL].hash).toBe(baselineKeyFor(WORKFLOWS_REL, workflowsTemplate));
      expect(Object.keys(manifest2.tombstones ?? {}).length).toBe(0);
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  }, 240000);

  test('--clear-tombstone drop scope is glob-exact: non-matching tombstone + baseline entries survive', () => {
    // B1 (ii): a grant names a glob; entries outside it must survive BOTH the
    // tombstone carry-forward and the baseline reset. The survivor is a
    // template-PRESENT path no delivery pass ever claims (agents/README.md is
    // PRESERVE'd by the agents pass), so no natural clear event can touch it —
    // the entry's fate is decided purely by the grant's glob scope.
    const README_REL = 'agents/README.md';
    const tmp = makeTombstoneProject(true);
    try {
      seedPriorTombstone(tmp, README_REL, 'retired readme body\n', 'fixture: awaiting adjudication');
      commitAll(tmp, 'chore: readme tombstone fixture');
      const { status } = runUpgrade(tmp, ['--clear-tombstone', 'docs/governance/**']);
      expect(status).toBe(0);
      // Matching path: both entries dropped + the TOMBSTONE_CLEARED row.
      expect(readFileSync(join(tmp, '.claude', 'last-upgrade-delivery.json'), 'utf8')).toContain('TOMBSTONE_CLEARED');
      const manifest = readManifest(tmp);
      expect(manifest.tombstones?.[WORKFLOWS_REL]).toBeUndefined();
      expect(manifest.baselines[WORKFLOWS_REL]).toBeUndefined();
      const cleared = manifest.decisions.filter((d) => d.verdict === 'TOMBSTONE_CLEARED');
      expect(cleared.length).toBe(1);
      expect(cleared[0]!.path).toBe('docs/governance/**');
      expect(cleared[0]!.detail).toContain(WORKFLOWS_REL);
      // Non-matching path: tombstone AND baseline survive intact.
      expect(manifest.tombstones?.[README_REL]).toBeDefined();
      expect(manifest.tombstones![README_REL]!.reason).toContain('awaiting adjudication');
      expect(manifest.baselines[README_REL]).toBeDefined();
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  }, 240000);

  test('--disposition adopt-template cannot deliver a tombstoned path (D3b)', () => {
    const tmp = makeTombstoneProject(true);
    try {
      const { status } = runUpgrade(tmp, ['--disposition', 'adopt-template']);
      expect(status).toBe(0);
      expect(existsSync(join(tmp, WORKFLOWS_REL))).toBe(false);
      const manifest = readManifest(tmp);
      const decision = manifest.decisions.find((d) => d.path === WORKFLOWS_REL);
      expect(decision!.verdict).toBe('TOMBSTONED_SKIP');
      expect(manifest.tombstones?.[WORKFLOWS_REL]).toBeDefined();
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  }, 180000);

  test('carry-forward: tombstones = (prior ∪ newly recorded) − paths delivered this run − template-departed entries (B2 prune symmetry)', () => {
    // Three tombstone states in one run: (a) workflows.md carries a BASELINE
    // only — absent again → TOMBSTONED (ERROR), no entry written (recording
    // needs the grant); (b) phase-definitions carries a tombstone + its copy
    // at the delivered baseline — the run DELIVERS it (UNTOUCHED + template
    // changed → ADOPT) and the natural clear event drops the entry; (c) a
    // retired procedures entry no pass walks — TEMPLATE-DEPARTED, so the B2
    // prune symmetry (v1.84.0, mirroring the baselines carry-forward) removes
    // it: the guard is reachable only from template-walking passes, the entry
    // is provably inert, and (d) a template-PRESENT tombstone (agents/
    // README.md — PRESERVE'd by the agents pass) survives.
    // Seeds land BEFORE commitAll (the pre-upgrade stash reverts uncommitted
    // tracked changes).
    const GHOST_REL = 'procedures/ghost-entry';
    const KEEP_REL = 'agents/README.md';
    const tmp = makeTempProject();
    seedPriorDelivery(tmp, WORKFLOWS_REL, OLD_WORKFLOWS);
    seedPriorDelivery(tmp, PHASE_DEFS_REL, OLD_PHASE_DEFS);
    seedPriorDelivery(tmp, GHOST_REL, 'retired procedure entry\n');
    seedPriorDelivery(tmp, KEEP_REL, 'retired readme body\n');
    const manifestPath = join(tmp, '.claude', 'last-upgrade-delivery.json');
    const seeded = JSON.parse(readFileSync(manifestPath, 'utf8'));
    seeded.tombstones = {
      [PHASE_DEFS_REL]: { hash: seeded.baselines[PHASE_DEFS_REL].hash, templateVersion: '0.0.0', recordedAt: '2026-10-28', reason: 'fixture: superseded' },
      [GHOST_REL]: { hash: seeded.baselines[GHOST_REL].hash, templateVersion: '0.0.0', recordedAt: '2026-10-28', reason: 'fixture: retired entry' },
      [KEEP_REL]: { hash: seeded.baselines[KEEP_REL].hash, templateVersion: '0.0.0', recordedAt: '2026-10-28', reason: 'fixture: firing-capable (template present)' },
    };
    writeFileSync(manifestPath, JSON.stringify(seeded, null, 2) + '\n');
    mkdirSync(join(tmp, 'docs'), { recursive: true });
    writeFileSync(join(tmp, PHASE_DEFS_REL), OLD_PHASE_DEFS);
    commitAll(tmp, 'chore: phase-definitions at its delivered baseline');
    try {
      // workflows.md fires TOMBSTONED (ERROR) — deliveries stand (exit 1).
      const { status } = runUpgrade(tmp);
      expect(status).toBe(1);
      expect(readFileSync(join(tmp, PHASE_DEFS_REL), 'utf8')).toBe(phaseDefsTemplate);
      expect(existsSync(join(tmp, WORKFLOWS_REL))).toBe(false);
      const manifest = readManifest(tmp);
      // Template-present entry survives the carry-forward (no clear grant —
      // prune and clear are different mechanisms; the prune is silent).
      expect(manifest.tombstones?.[KEEP_REL]).toBeDefined();
      // Template-departed entry pruned (B2) — the v1.3.0 "carried forward
      // verbatim" expectation flipped by the prune symmetry.
      expect(manifest.tombstones?.[GHOST_REL]).toBeUndefined();
      expect(manifest.tombstones?.[PHASE_DEFS_REL]).toBeUndefined();
      expect(manifest.tombstones?.[WORKFLOWS_REL]).toBeUndefined();
      expect(manifest.decisions.some((d) => d.path === WORKFLOWS_REL && d.verdict === 'TOMBSTONED')).toBe(true);
      // No grants ran — no TOMBSTONE_CLEARED rows (the prune is not a grant).
      expect(manifest.decisions.some((d) => d.verdict === 'TOMBSTONE_CLEARED')).toBe(false);
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  }, 180000);

  test('--tombstone / --clear-tombstone are refused under --dry-run (apply-mode only)', () => {
    const tmp = makeTombstoneProject();
    try {
      const { status, out } = runUpgrade(tmp, ['--dry-run', '--tombstone', WORKFLOWS_REL]);
      expect(status).toBe(1);
      expect(out).toContain('apply-mode only');
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  }, 180000);
});

// ═════════════════════════════════════════════════════════════════════════════
// agents/*.md project-ownership escalation (U-20261028-001 D4)
// ═════════════════════════════════════════════════════════════════════════════
describe('upgrade-project.ts agents/ version-gt escalation + NO_BASELINE detail (D4)', () => {
  // Project body evolved at an OLDER frontmatter version: the version-gt arm
  // fires, and with the baseline equal to today's deliverable the OLD matrix
  // row was EVOLVED (WARN) + deliver — D4 reclassifies it to CONFLICT (ERROR)
  // regardless of templateChanged.
  const EVOLVED_LOWER = `---\nname: i18n-specialist\nversion: "0.0.1"\ndomain: _shared\ntier: medium\n---\n\n# i18n Specialist — project-evolved body\n\nCommitted project-side divergence the template never shipped.\n`;

  test('version-gt over an evolved body with templateChanged=false → CONFLICT (ERROR), body preserved', () => {
    const tmp = makeTempProject();
    try {
      mkdirSync(join(tmp, 'agents'), { recursive: true });
      writeFileSync(join(tmp, 'agents', 'i18n-specialist.md'), EVOLVED_LOWER);
      // Baseline == today's deliverable (the D9 COMPOSED bytes for the stub
      // i18n-specialist) — the template content is UNCHANGED since delivery;
      // only the project moved.
      seedPriorDelivery(tmp, 'agents/i18n-specialist.md', composedDeliverable);
      commitAll(tmp, 'chore: evolved agent at an older version');
      const { status, out } = runUpgrade(tmp);
      expect(status).toBe(1);
      expect(readFileSync(join(tmp, 'agents', 'i18n-specialist.md'), 'utf8')).toBe(EVOLVED_LOWER);
      expect(out).toContain('CONFLICT DISPOSITION (SKIP): agents/i18n-specialist.md');
      const manifest = readManifest(tmp);
      const conflict = manifest.decisions.find((d) => d.path === 'agents/i18n-specialist.md' && d.verdict === 'CONFLICT');
      expect(conflict).toBeDefined();
      expect(conflict!.severity).toBe('ERROR');
      expect(conflict!.detail).toContain('regardless of templateChanged');
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  }, 180000);

  test('--disposition adopt-template still grants the D4-conflicted agents/ delivery', () => {
    const tmp = makeTempProject();
    try {
      mkdirSync(join(tmp, 'agents'), { recursive: true });
      writeFileSync(join(tmp, 'agents', 'i18n-specialist.md'), EVOLVED_LOWER);
      seedPriorDelivery(tmp, 'agents/i18n-specialist.md', composedDeliverable);
      commitAll(tmp, 'chore: evolved agent at an older version');
      const { status, out } = runUpgrade(tmp, ['--disposition', 'adopt-template']);
      expect(status).toBe(0);
      expect(readFileSync(join(tmp, 'agents', 'i18n-specialist.md'), 'utf8')).toBe(restamped(composedDeliverable));
      expect(out).toContain('DISPOSITION (adopt-template): agents/i18n-specialist.md');
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  }, 180000);

  test('NO_BASELINE equal-version restore keeps WARN but names the migration window', () => {
    const tmp = makeTempProject();
    try {
      mkdirSync(join(tmp, 'agents'), { recursive: true });
      // Same frontmatter version as the template, evolved body, NO prior
      // manifest — the NO_BASELINE migration degrade of the overwrite policy.
      const evolvedSameVersion = EVOLVED_LOWER.replace('version: "0.0.1"', `version: "${commonAgentVersion}"`);
      writeFileSync(join(tmp, 'agents', 'i18n-specialist.md'), evolvedSameVersion);
      commitAll(tmp, 'chore: evolved agent, never delivered under the v2 manifest');
      const { status } = runUpgrade(tmp);
      expect(status).toBe(0);
      // The canonical restore proceeds (WARN degrade) — D9: the restored
      // canonical content is the COMPOSED bytes — and the decision detail
      // names the migration window.
      expect(readFileSync(join(tmp, 'agents', 'i18n-specialist.md'), 'utf8')).toBe(restamped(composedDeliverable));
      const manifest = readManifest(tmp);
      const restored = manifest.decisions.find((d) => d.path === 'agents/i18n-specialist.md' && d.verdict === 'DRIFT_RESTORED');
      expect(restored).toBeDefined();
      expect(restored!.severity).toBe('WARN');
      expect(restored!.detail).toContain('baseline absent — verify this restore against project intent');
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  }, 180000);
});

// ═════════════════════════════════════════════════════════════════════════════
// Baselines carry-forward (T-20261028-014 — U-20261028-001 D4 integration
// defect): the manifest writer rebuilt `baselines` from the delivered set
// alone, dropping the provenance of every non-delivered path; the next run
// classified those NO_BASELINE and the agents/ equal-version arm degraded the
// designed CONFLICT (ERROR) into the §8 WARN-deliver — proven end-to-end by
// the co-design 0.22.1 canary. Fix under test: baselines = (prior ∪ freshly
// delivered) − paths delivered this run, --clear-tombstone also resets
// matched baselines, template-departed entries pruned.
// ═════════════════════════════════════════════════════════════════════════════

describe('upgrade-project.ts baselines carry-forward (T-20261028-014)', () => {
  /** The co-design canary shape: template content + the project-canonical
   *  `phases: [4]` frontmatter addition at the template's equal version —
   *  lifecycleless-different from both the deliverable and any prior
   *  delivered baseline → PROJECT_EVOLVED → CONFLICT (ERROR) skip. */
  const canaryEvolved = commonAgentTpl.replace(
    /^(version:\s*"?[\d.]+"?)$/m,
    `$1\nphases: [4]`,
  );
  const CANARY_REL = 'agents/i18n-specialist.md';
  const DELIVERED_THEN = '---\nname: i18n-specialist\nversion: "1.0.0"\n---\nold delivered body the project later evolved past\n';

  test('conflict-skipped path retains its baseline — rerun re-derives CONFLICT (ERROR), not NO_BASELINE WARN-deliver', () => {
    const tmp = makeTempProject();
    try {
      mkdirSync(join(tmp, 'agents'), { recursive: true });
      writeFileSync(join(tmp, CANARY_REL), canaryEvolved);
      seedPriorDelivery(tmp, CANARY_REL, DELIVERED_THEN);
      commitAll(tmp, 'chore: committed project-canonical phases frontmatter');
      // Run 1 — the conflict-skip run (the 0.22.1 canary apply).
      const first = runUpgrade(tmp);
      expect(first.status).toBe(1);
      expect(readFileSync(join(tmp, CANARY_REL), 'utf8')).toContain('phases: [4]');
      expect(first.out).toContain('CONFLICT DISPOSITION (SKIP): agents/i18n-specialist.md');
      const manifest1 = readManifest(tmp);
      expect(manifest1.decisions.some((d) => d.path === CANARY_REL && d.verdict === 'CONFLICT' && d.severity === 'ERROR')).toBe(true);
      // THE FIX: the skipped path's baseline survives the manifest rewrite.
      expect(manifest1.baselines[CANARY_REL]).toBeDefined();
      expect(manifest1.baselines[CANARY_REL]!.hash).toBe(baselineKeyFor(CANARY_REL, DELIVERED_THEN));
      // Land run 1 — the pre-upgrade stash reverts an uncommitted prior wave,
      // so run 2 must start from a commit (same pattern as the tombstone
      // two-run test; delivered hooks unset so the landing commit is not
      // blocked by the /sync-gated pre-commit hook).
      spawnSync('git', ['-C', tmp, 'config', '--unset', 'core.hooksPath']);
      commitAll(tmp, 'chore: wave 1 landing (conflict skipped, copy preserved)');
      // Run 2 — classification must re-derive CONFLICT from the PERSISTED
      // baseline. Pre-fix this was NO_BASELINE → DRIFT_RESTORED (WARN) +
      // COPIED, clobbering the project frontmatter at WARN.
      const second = runUpgrade(tmp);
      expect(second.status).toBe(1);
      expect(readFileSync(join(tmp, CANARY_REL), 'utf8')).toContain('phases: [4]');
      expect(second.out).toContain('CONFLICT DISPOSITION (SKIP): agents/i18n-specialist.md');
      expect(second.out).not.toContain('DRIFT (restored to canonical) agents/i18n-specialist.md');
      const manifest2 = readManifest(tmp);
      const decision2 = manifest2.decisions.find((d) => d.path === CANARY_REL);
      expect(decision2).toBeDefined();
      expect(decision2!.verdict).toBe('CONFLICT');
      expect(decision2!.severity).toBe('ERROR');
      expect(manifest2.baselines[CANARY_REL]).toBeDefined();
      expect(manifestHasUnresolvedErrors(manifest2)).toBe(true);
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  }, 240000);

  test('tombstoned path retains its baseline across the manifest rewrite', () => {
    const tmp = makeTempProject();
    try {
      seedPriorTombstone(tmp, WORKFLOWS_REL, OLD_WORKFLOWS);
      commitAll(tmp, 'chore: prior delivery recorded');
      // The honored run skips the path (INFO) — nothing delivered for it, so
      // pre-fix the writer dropped its baseline while carrying the tombstone.
      const { status } = runUpgrade(tmp);
      expect(status).toBe(0);
      expect(existsSync(join(tmp, WORKFLOWS_REL))).toBe(false);
      const manifest = readManifest(tmp);
      expect(manifest.tombstones?.[WORKFLOWS_REL]).toBeDefined();
      expect(manifest.baselines[WORKFLOWS_REL]).toBeDefined();
      expect(manifest.baselines[WORKFLOWS_REL]!.hash).toBe(baselineKeyFor(WORKFLOWS_REL, OLD_WORKFLOWS));
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  }, 180000);

  test('delivered path replaces a stale prior baseline with the fresh disk bytes', () => {
    const tmp = makeTempProject();
    try {
      // Baseline-clean copy at an OLDER delivered version → the run delivers
      // over it (version-gated ADOPT) and must REPLACE the stale baseline with
      // the exact post-delivery disk bytes. D9: the version gate reads the
      // COMPOSED frontmatter — the stub version ladder (co-develop stub at
      // 1.1.0) — so the stale copy rides a version BELOW the stub's to trip the
      // version-gt arm, and the delivered bytes are the composed expectation.
      const staleCopy = composedDeliverable.replace(/^(version:\s*"?[\d.]+"?)$/m, 'version: "1.0.0"');
      mkdirSync(join(tmp, 'agents'), { recursive: true });
      writeFileSync(join(tmp, CANARY_REL), staleCopy);
      seedPriorDelivery(tmp, CANARY_REL, staleCopy);
      commitAll(tmp, 'chore: baseline-clean copy at an older delivered version');
      const { status } = runUpgrade(tmp);
      expect(status).toBe(0);
      expect(readFileSync(join(tmp, CANARY_REL), 'utf8')).toBe(restamped(composedDeliverable));
      const manifest = readManifest(tmp);
      expect(manifest.decisions.some((d) => d.path === CANARY_REL && d.verdict === 'ADOPT')).toBe(true);
      const entry = manifest.baselines[CANARY_REL];
      expect(entry).toBeDefined();
      expect(entry!.hash).not.toBe(baselineKeyFor(CANARY_REL, staleCopy));
      expect(entry!.hash).toBe(baselineKeyFor(CANARY_REL, readFileSync(join(tmp, CANARY_REL), 'utf8')));
      expect(entry!.templateVersion.length).toBeGreaterThan(0);
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  }, 180000);

  test('baseline for a template-departed path is pruned; a retained non-delivered template path survives', () => {
    const RETIRED_REL = 'docs/retired-never-shipped.md';
    const README_REL = 'agents/README.md'; // PRESERVE-class — never delivered, template-side
    const tmp = makeTempProject();
    try {
      seedPriorDelivery(tmp, RETIRED_REL, 'content of a file the template no longer ships\n');
      seedPriorDelivery(tmp, README_REL, 'prior readme delivery bytes\n');
      commitAll(tmp, 'chore: prior baselines recorded');
      const { status } = runUpgrade(tmp);
      expect(status).toBe(0);
      const manifest = readManifest(tmp);
      // Template-departed → pruned (never a classification candidate again).
      expect(manifest.baselines[RETIRED_REL]).toBeUndefined();
      // PRESERVE-class template path, not delivered this run → carried forward
      // verbatim (retention is the fix; the PRESERVE pass never re-baselines).
      expect(manifest.baselines[README_REL]).toBeDefined();
      expect(manifest.baselines[README_REL]!.hash).toBe(baselineKeyFor(README_REL, 'prior readme delivery bytes\n'));
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  }, 180000);
});

// ═════════════════════════════════════════════════════════════════════════════
// Stub frontmatter scalar backfill in the agents/ pass (T-20261028-010 — spec
// docs/designs/2026-10-28-stub-frontmatter-backfill-design.md): the STUB skip
// branch (MERGE_MANAGED agents/pm.md) backfills MISSING top-level scalar
// tier/version/last_updated from the template counterpart with one
// STUB_FM_BACKFILL (INFO) decision row; bodies stay project-owned.
// ═════════════════════════════════════════════════════════════════════════════
describe('upgrade-project.ts stub FM backfill (T-20261028-010)', () => {
  // The template counterpart the STUB skip branch sources from: the variant
  // stub at the same rel (templates/co-develop/agents/pm.md — scalar tier,
  // quoted version).
  const counterpartStub = readFileSync(join(workspaceRoot, 'templates', VARIANT, 'agents', 'pm.md'), 'utf8');
  const counterpartVersion = counterpartStub.match(/^version:[ \t]*(\S+)/m)![1];
  const extractFm = (content: string): string => content.match(/^---\r?\n[\s\S]*?\r?\n---/)?.[0] ?? '';

  test('stale stub without tier/version/last_updated gets all three backfilled + INFO manifest row', () => {
    const tmp = makeTempProject();
    try {
      const staleStub = [
        '---',
        'extends: ../../../agents/pm.md',
        'name: pm',
        `variant: ${VARIANT}`,
        'status: active',
        '---',
        '',
        '<!-- WORKSPACE-MANAGED: PM agent body. Content outside this block is preserved during project upgrades. -->',
        '## Role',
        '',
        'Fixture stub body line that stays project-owned.',
        '',
      ].join('\n');
      mkdirSync(join(tmp, 'agents'), { recursive: true });
      writeFileSync(join(tmp, 'agents', 'pm.md'), staleStub);
      commitAll(tmp, 'chore: stale stub fixture');
      const { status, out } = runUpgrade(tmp);
      expect(status).toBe(0);
      const after = readFileSync(join(tmp, 'agents', 'pm.md'), 'utf8');
      // Frontmatter filled from the template counterpart (tier) / delivery date.
      expect(after).toContain('tier: medium');
      expect(after).toContain(`version: ${counterpartVersion}`);
      expect(after.match(/^last_updated: \d{4}-\d{2}-\d{2}$/m)).toBeTruthy();
      // Body stays project-owned — the fixture body line survives the run.
      expect(after).toContain('Fixture stub body line that stays project-owned.');
      expect(out).toContain('STUB FM BACKFILL: agents/pm.md');
      const manifest = readManifest(tmp);
      const row = manifest.decisions.find((d) => d.path === 'agents/pm.md' && d.verdict === 'STUB_FM_BACKFILL');
      expect(row).toBeDefined();
      expect(row!.severity).toBe('INFO');
      expect(row!.detail).toContain('tier');
      expect(row!.detail).toContain('frontmatter only');
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  }, 180000);

  test('stub whose frontmatter already carries the fields: frontmatter byte-identical, no backfill row', () => {
    const tmp = makeTempProject();
    try {
      const fm = [
        '---',
        'extends: ../../../agents/pm.md',
        'name: pm',
        `variant: ${VARIANT}`,
        'version: "1.2.0"',
        'last_updated: "2026-10-27"',
        'status: active',
        'tier: medium',
        '---',
      ].join('\n');
      const full = `${fm}\n\nFixture stub body line that stays project-owned.\n`;
      mkdirSync(join(tmp, 'agents'), { recursive: true });
      writeFileSync(join(tmp, 'agents', 'pm.md'), full);
      commitAll(tmp, 'chore: complete stub fixture');
      const { status } = runUpgrade(tmp);
      expect(status).toBe(0);
      const after = readFileSync(join(tmp, 'agents', 'pm.md'), 'utf8');
      // The backfill is a no-op: the frontmatter gains no key (the MERGE pass
      // may union managed body blocks, and a MERGE-delivered file is then
      // legitimately re-stamped by the v1.74.0 post-delivery restamp — so the
      // comparison excludes the last_updated line; the helper-level test pins
      // the strict byte-identity).
      const stripLu = (s: string): string => s.split('\n').filter((l) => !/^last_updated:/.test(l)).join('\n');
      expect(stripLu(extractFm(after))).toBe(stripLu(fm));
      const manifest = readManifest(tmp);
      expect(manifest.decisions.some((d) => d.path === 'agents/pm.md' && d.verdict === 'STUB_FM_BACKFILL')).toBe(false);
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  }, 180000);
});

// ═════════════════════════════════════════════════════════════════════════════
// STUB_VERSION_DIVERGENCE (2026-10-29-delivery-bookkeeping-engine design D1 —
// DEC-20261029-01): the stub-frontmatter backfill contract blesses a pinned
// older stub `version` as deliberate project divergence (never overwritten),
// but the divergence was invisible — the decision log showed only the STUB
// skip. The agents/ STUB skip arm now records an INFO row naming both
// versions (INFO, not WARN: the pin is sanctioned; repeat-per-run accepted,
// same as STUB_VERSION_BUMP_ADVICE).
// ═════════════════════════════════════════════════════════════════════════════
describe('upgrade-project.ts STUB_VERSION_DIVERGENCE (D1)', () => {
  // The template counterpart the STUB skip branch sources from: the variant
  // stub at the same rel (templates/co-develop/agents/pm.md — MERGE_MANAGED,
  // so the agents/ pass always dead-ends in the skip branch).
  const counterpartStub = readFileSync(join(workspaceRoot, 'templates', VARIANT, 'agents', 'pm.md'), 'utf8');
  const counterpartVersion = counterpartStub.match(/^version:[ \t]*["']?(\d+\.\d+\.\d+)/m)?.[1] ?? '';
  const makeStub = (version: string): string => [
    '---',
    'extends: ../../../agents/pm.md',
    'name: pm',
    `variant: ${VARIANT}`,
    `version: "${version}"`,
    'last_updated: "2026-09-01"',
    'status: active',
    'tier: medium',
    '---',
    '',
    '<!-- WORKSPACE-MANAGED: PM agent body. Content outside this block is preserved during project upgrades. -->',
    '## Role',
    '',
    'Fixture stub body line that stays project-owned.',
    '',
  ].join('\n');

  test('stub pinned at an older version → STUB_VERSION_DIVERGENCE (INFO) row naming both versions', () => {
    const tmp = makeTempProject();
    try {
      mkdirSync(join(tmp, 'agents'), { recursive: true });
      writeFileSync(join(tmp, 'agents', 'pm.md'), makeStub('0.9.0'));
      commitAll(tmp, 'chore: pinned stub fixture');
      const { status } = runUpgrade(tmp);
      expect(status).toBe(0);
      expect(counterpartVersion.length).toBeGreaterThan(0);
      // The pin survives: backfill never overwrites the existing version.
      expect(readFileSync(join(tmp, 'agents', 'pm.md'), 'utf8')).toContain('version: "0.9.0"');
      const manifest = readManifest(tmp);
      const row = manifest.decisions.find((d) => d.path === 'agents/pm.md' && d.verdict === 'STUB_VERSION_DIVERGENCE');
      expect(row).toBeDefined();
      expect(row!.severity).toBe('INFO');
      expect(row!.detail).toContain('stub version 0.9.0 pinned vs counterpart');
      expect(row!.detail).toContain(counterpartVersion);
      expect(row!.detail).toContain('backfill never overwrites');
      // The row rides AFTER the primary skip rows — a consumer reading the
      // path's FIRST decision row still sees the verdict.
      const firstPmRow = manifest.decisions.find((d) => d.path === 'agents/pm.md');
      expect(firstPmRow!.verdict).not.toBe('STUB_VERSION_DIVERGENCE');
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  }, 180000);

  test('stub at the counterpart version → no divergence row', () => {
    const tmp = makeTempProject();
    try {
      mkdirSync(join(tmp, 'agents'), { recursive: true });
      writeFileSync(join(tmp, 'agents', 'pm.md'), makeStub(counterpartVersion));
      commitAll(tmp, 'chore: equal-version stub fixture');
      const { status } = runUpgrade(tmp);
      expect(status).toBe(0);
      const manifest = readManifest(tmp);
      expect(manifest.decisions.some((d) => d.path === 'agents/pm.md' && d.verdict === 'STUB_VERSION_DIVERGENCE')).toBe(false);
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  }, 180000);
});

// ═════════════════════════════════════════════════════════════════════════════
// --changelog-entry (2026-10-29-delivery-bookkeeping-engine design A3 —
// DEC-20261029-01): opt-in CHANGELOG entry scaffolding, default OFF at the
// engine (CHANGELOG.md is project-owned). The pure insert/section/idempotency
// cases live in tests/unit/upgrade-restamp.test.ts; these pin the engine
// wiring: the scaffolded entry rides the recorded delivery (files[]
// attribution), a repeated version is skipped, the default run never touches
// the file, and the flag is refused under --dry-run (apply-mode only).
// ═════════════════════════════════════════════════════════════════════════════
describe('upgrade-project.ts --changelog-entry (A3)', () => {
  const templateVersion = readFileSync(join(workspaceRoot, 'templates', 'VERSION'), 'utf8').trim();
  const deliveryDate = new Date().toISOString().slice(0, 10);
  const readChangelog = (tmp: string): string => readFileSync(join(tmp, 'CHANGELOG.md'), 'utf8');
  const verEsc = templateVersion.replace(/\./g, '\\.');
  const entryRe = new RegExp(`^- \\*\\*\\[${deliveryDate}\\]\\*\\*: chore\\(upgrade\\): template sync v${verEsc} \\(\\d+ file\\(s\\) delivered; engine-scaffolded — edit or merge before commit; see templates/CHANGELOG\\.md v${verEsc}\\)$`, 'm');

  test('apply with the flag scaffolds one entry into [Unreleased], rides files[] attribution, and is idempotent on re-run', () => {
    const tmp = makeTempProject();
    try {
      writeFileSync(join(tmp, 'CHANGELOG.md'), '# Changelog\n\n## [Unreleased]\n\n- curated project entry\n\n## [0.1.0] - 2026-10-01\n\n- released\n');
      commitAll(tmp, 'chore: changelog fixture');
      const first = runUpgrade(tmp, ['--changelog-entry']);
      expect(first.status).toBe(0);
      const after = readChangelog(tmp);
      // One entry at the top of [Unreleased]; the curated bullet stays below;
      // historical sections untouched.
      expect(after).toMatch(entryRe);
      const lines = after.split('\n');
      const unreleased = lines.findIndex((l) => l === '## [Unreleased]');
      expect(lines[unreleased + 1]).toMatch(/chore\(upgrade\): template sync v/);
      expect(lines[unreleased + 1]).toContain('engine-scaffolded');
      expect(lines[unreleased + 3]).toBe('- curated project entry');
      expect(after).toContain('## [0.1.0] - 2026-10-01');
      // The CHANGELOG change rides the recorded delivery (files[] attribution).
      const manifest1 = readManifest(tmp);
      expect(manifest1.files).toContain('CHANGELOG.md');
      // Idempotent: a second run at the same template version adds nothing.
      spawnSync('git', ['-C', tmp, 'config', '--unset', 'core.hooksPath']);
      commitAll(tmp, 'chore: wave 1 landing (changelog scaffolded)');
      const second = runUpgrade(tmp, ['--changelog-entry']);
      expect(second.status).toBe(0);
      const occurrences = readChangelog(tmp).split('\n').filter((l) => l.includes(`template sync v${templateVersion}`)).length;
      expect(occurrences).toBe(1);
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  }, 240000);

  test('default OFF: a run without the flag never touches CHANGELOG.md', () => {
    const tmp = makeTempProject();
    try {
      const changelog = '# Changelog\n\n## [Unreleased]\n\n- curated project entry\n';
      writeFileSync(join(tmp, 'CHANGELOG.md'), changelog);
      commitAll(tmp, 'chore: changelog fixture');
      const { status } = runUpgrade(tmp);
      expect(status).toBe(0);
      expect(readChangelog(tmp)).toBe(changelog);
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  }, 180000);

  test('--changelog-entry is refused under --dry-run (apply-mode only)', () => {
    const tmp = makeTempProject();
    try {
      writeFileSync(join(tmp, 'CHANGELOG.md'), '# Changelog\n');
      commitAll(tmp, 'chore: changelog fixture');
      const { status, out } = runUpgrade(tmp, ['--dry-run', '--changelog-entry']);
      expect(status).toBe(1);
      expect(out).toContain('apply-mode only');
      expect(readChangelog(tmp)).toBe('# Changelog\n');
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  }, 180000);
});
