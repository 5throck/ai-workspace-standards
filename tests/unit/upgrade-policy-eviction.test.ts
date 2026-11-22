/**
 * Unit + engine-replay pins for the variant core-script loss-detection design
 * (docs/designs/2026-11-23-variant-core-script-loss-detection-design.md,
 * U-20261122-011) — upgrade-policy.ts v1.49.0 helpers and upgrade-project.ts
 * v1.116.0 wiring:
 *
 *  - lostLocalPatchIds: id-bearing LOCAL-PATCH markers (`pending` included) are
 *    named, not just counted — deterministic first-occurrence order, subtraction
 *    against the deliverable.
 *  - evictedDelta: the exact project-authored lines a delivery discards vs the
 *    recorded baseline (blank/CR-trim normalization, dedupe, EVICTED_LINES_CAP
 *    + truncated count; no-op when project bytes equal the baseline — AC-5).
 *  - markerLossDetail: the lost-id appendix is additive; the legacy string is
 *    byte-identical when no ids exist.
 *  - Wiring (engine spawns against the real workspace templates, the
 *    upgrade-overwrite-protection pattern): MARKER_LOSS row names the id (AC-1);
 *    the adopt-grant override ADOPT row names the ids and carries the evicted
 *    listing, and the exit summary prints the EVICTED LINES block (AC-2); an
 *    unbaselined unmarked divergence delivers WITH the eviction listing (AC-4);
 *    a baselined unmarked core fork is restored with the capped listing (AC-3
 *    shape on the core-locked arm); byte-identical and vintage-proven copies
 *    produce zero eviction listings (AC-5 noise floor); --audit-core-deltas
 *    flags a committed unmarked variant block and prints `no project-authored
 *    delta` on a clean copy (AC-6).
 *
 * Engine runs spawn scripts/upgrade-project.ts against a temp project and the
 * real workspace templates; every spawn-bearing test carries a 60s per-test
 * budget (file joins test-runner FILE_TIME_BUDGETS, suite 300s / test 60s).
 *
 * @version 1.0.0 (2026-11-23, U-20261122-011 — design §8 test row)
 */
import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { describe, test, expect, afterAll } from 'bun:test';

import {
  EVICTED_LINES_CAP,
  baselineKeyFor,
  evictedDelta,
  lostLocalPatchIds,
  markerLoss,
  markerLossDetail,
} from '../../scripts/lib/upgrade-policy.ts';
import { gitCleanEnv } from '../../scripts/lib/git-env.ts';
import { assertCallerEnvSafeForGitFixtures, assertFixtureGitIdentity } from '../helpers/fixture-git.ts';

const workspaceRoot = resolve(import.meta.dir, '..', '..');
const upgradeScript = join(workspaceRoot, 'scripts', 'upgrade-project.ts');
const VARIANT = 'co-develop';

// ═════════════════════════════════════════════════════════════════════════════
// Pure helpers (upgrade-policy v1.49.0)
// ═════════════════════════════════════════════════════════════════════════════

describe('lostLocalPatchIds', () => {
  test('names lost ids incl. pending, in first-occurrence order, deduplicated', () => {
    const project = [
      '// LOCAL-PATCH(upstream-request: U-20261107-003): scoped staging',
      '// LOCAL-PATCH(upstream-request: pending): unfiled yet',
      '// LOCAL-PATCH(upstream-request: U-20261107-003): duplicate id',
      '// LOCAL-PATCH (design: X): non-id-bearing form',
    ].join('\n');
    expect(lostLocalPatchIds(project, '')).toEqual(['U-20261107-003', 'pending']);
  });

  test('ids kept by the deliverable are not lost', () => {
    const project = '// LOCAL-PATCH(upstream-request: U-1): a\n// LOCAL-PATCH(upstream-request: U-2): b';
    const after = 'x // LOCAL-PATCH(upstream-request: U-1): survives upstream';
    expect(lostLocalPatchIds(project, after)).toEqual(['U-2']);
  });

  test('nothing to lose → empty array (no false attribution)', () => {
    expect(lostLocalPatchIds('plain content', '')).toEqual([]);
    expect(lostLocalPatchIds('', '// LOCAL-PATCH(upstream-request: U-9)')).toEqual([]);
  });
});

describe('evictedDelta', () => {
  test('no-op when project bytes equal the baseline (AC-5)', () => {
    const text = 'a\nb\nc';
    expect(evictedDelta(text, text, 'other')).toEqual({ lines: [], truncated: 0 });
  });

  test('baseline-side churn is not eviction — only lines absent from BOTH baseline and deliverable', () => {
    const baseline = 'template line 1\ntemplate line 2';
    const project = 'template line 1\nproject-only line';
    const after = 'new template line'; // template churn: baseline line 1/2 dropped template-side
    expect(evictedDelta(project, baseline, after)).toEqual({ lines: ['project-only line'], truncated: 0 });
  });

  test('no baseline → every non-deliverable project line is project-authored', () => {
    const project = 'keep-a\nauthored\nkeep-b';
    const after = 'keep-a\nkeep-b';
    expect(evictedDelta(project, '', after)).toEqual({ lines: ['authored'], truncated: 0 });
  });

  test('blank lines are ignored, CRLF normalized, trailing whitespace trimmed, duplicates collapse', () => {
    const project = 'authored one\r\n\r\n   \nauthored one\nauthored two   ';
    expect(evictedDelta(project, '', '')).toEqual({ lines: ['authored one', 'authored two'], truncated: 0 });
  });

  test('listing is capped at EVICTED_LINES_CAP with the remainder as truncated (AC-3)', () => {
    const project = Array.from({ length: EVICTED_LINES_CAP + 2 }, (_, i) => `authored ${i + 1}`).join('\n');
    const delta = evictedDelta(project, '', '');
    expect(delta.lines).toHaveLength(EVICTED_LINES_CAP);
    expect(delta.lines[0]).toBe('authored 1');
    expect(delta.truncated).toBe(2);
  });
});

describe('markerLossDetail lost-id appendix', () => {
  const loss = markerLoss('a // LOCAL-PATCH\nb // LOCAL-PATCH\nplain', 'plain');
  test('without ids the legacy string is byte-identical', () => {
    expect(loss).toEqual({ lost: 2, before: 2, after: 0 });
    expect(markerLossDetail(loss)).not.toContain('lost LOCAL-PATCH ids');
    expect(markerLossDetail(loss)).toContain('2 → 0');
  });
  test('with ids the row names them (G1)', () => {
    const detail = markerLossDetail(loss, ['U-20261122-011', 'pending']);
    expect(detail).toContain('; lost LOCAL-PATCH ids: U-20261122-011, pending');
    expect(detail).toContain('MARKER_LOSS: write SKIPPED');
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// Engine wiring (upgrade-project v1.116.0)
// ═════════════════════════════════════════════════════════════════════════════

const tmpDirs: string[] = [];
afterAll(() => {
  for (const d of tmpDirs) rmSync(d, { recursive: true, force: true });
});

function git(tmp: string, ...args: string[]): void {
  spawnSync('git', ['-C', tmp, ...args], { env: gitCleanEnv(), stdio: ['ignore', 'pipe', 'pipe'] });
}

function makeTempProject(): string {
  const tmp = mkdtempSync(join(tmpdir(), 'upgrade-policy-eviction-'));
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
  baselines: Record<string, { hash: string; templateVersion: string; blob?: string }>;
  decisions: Decision[];
}
const readManifest = (tmp: string): Manifest =>
  JSON.parse(readFileSync(join(tmp, '.claude', 'last-upgrade-delivery.json'), 'utf8'));
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

/** Seed (or extend) a v2 prior-delivery manifest recording `rel`'s baseline
 *  (hash only, the overwrite-protection fixture shape — the engine resolves the
 *  baseline TEXT via the template's committed git history). */
function seedBaseline(tmp: string, rel: string, baselineContent: string): void {
  const manifestPath = join(tmp, '.claude', 'last-upgrade-delivery.json');
  const manifest = existsSync(manifestPath)
    ? JSON.parse(readFileSync(manifestPath, 'utf8'))
    : {
        schemaVersion: 2,
        timestamp: 'test',
        project: 'fixture',
        templateVersion: '0.0.0',
        templateSha: '',
        baseSha: '',
        files: [],
        baselines: {},
        decisions: [],
      };
  manifest.baselines[rel] = { hash: baselineKeyFor(rel, baselineContent), templateVersion: '0.0.0' };
  if (!manifest.files.includes(rel)) manifest.files.push(rel);
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
}

const bumped = (text: string): string => text.replace(/@version\s+\d+\.\d+\.\d+/, '@version 99.0.0');

// ── Shared scene A: marked core fork (AC-1/AC-2) + unbaselined unmarked doc (AC-4) ──
const AUDIT_REL = 'scripts/audit.ts';
const DOC_REL = 'docs/phase-definitions.md';
const MARKER_LINE = '// LOCAL-PATCH(upstream-request: U-20261122-011): co-newbiz boundary-gate wiring';
const FORK_LINES = [MARKER_LINE, '// co-fork line 2', '// co-fork line 3'];

function seedSceneA(): string {
  const tmp = makeTempProject();
  write(tmp, AUDIT_REL, `${bumped(templateBytes(AUDIT_REL)).trimEnd()}\n${FORK_LINES.join('\n')}\n`);
  write(tmp, DOC_REL, `${templateBytes(DOC_REL).trimEnd()}\nunmarked project edit\n`);
  commitAll(tmp, 'seed marked core fork + unbaselined doc');
  return tmp;
}

const a1Project = seedSceneA();
const a1Default = runUpgrade(a1Project);
const a1Manifest = readManifest(a1Project);
const a1GrantProject = seedSceneA();
const a1Grant = runUpgrade(a1GrantProject, ['--disposition', `adopt-template=${AUDIT_REL}`]);
const a1GrantManifest = readManifest(a1GrantProject);

describe('AC-1 — MARKER_LOSS row names the lost ticket id (G1)', () => {
  test('default run: ERROR MARKER_LOSS, write skipped, exit non-zero, id named in the row detail', () => {
    expect(a1Default.status).toBe(1);
    const loss = rowsFor(a1Manifest, AUDIT_REL).filter((d) => d.verdict === 'MARKER_LOSS');
    expect(loss).toHaveLength(1);
    expect(loss[0].severity).toBe('ERROR');
    expect(loss[0].detail).toContain('lost LOCAL-PATCH ids: U-20261122-011');
    expect(read(a1Project, AUDIT_REL)).toContain('U-20261122-011');
  }, 60000);

  test('the unbaselined unmarked doc delivered WITH its eviction listing (AC-4, no silent loss)', () => {
    const rows = rowsFor(a1Manifest, DOC_REL);
    expect(verdictsFor(a1Manifest, DOC_REL)).toContain('UNBASELINED_OVERWRITE');
    const row = rows.find((d) => d.verdict === 'UNBASELINED_OVERWRITE');
    expect(row?.severity).toBe('WARN');
    expect(row?.detail).toContain('EVICTED: 1 project-authored line(s) discarded');
    expect(row?.detail).toContain('unmarked project edit');
    expect(read(a1Project, DOC_REL)).toBe(templateBytes(DOC_REL));
  }, 60000);
});

describe('AC-2 — the adopt-grant override names the ids and lists the evicted lines', () => {
  test('ADOPT row: superseded + lost ids + capped evicted listing; template copy delivered', () => {
    expect(a1Grant.status).toBe(0);
    const adopt = rowsFor(a1GrantManifest, AUDIT_REL).filter((d) => d.verdict === 'ADOPT');
    expect(adopt.length).toBeGreaterThanOrEqual(1);
    const override = adopt.find((d) => d.detail.includes('marker count'));
    expect(override).toBeDefined();
    expect(override?.detail).toContain('superseded by the template copy; lost ids: U-20261122-011');
    expect(override?.detail).toContain(`EVICTED: ${FORK_LINES.length + 1} project-authored line(s) discarded`);
    expect(override?.detail).toContain(MARKER_LINE);
    expect(read(a1GrantProject, AUDIT_REL)).toBe(templateBytes(AUDIT_REL));
  }, 60000);

  test('the exit summary prints the EVICTED LINES block grouped by path', () => {
    expect(a1Grant.out).toContain('EVICTED LINES');
    expect(a1Grant.out).toContain(AUDIT_REL);
    expect(a1Grant.out).toContain('loss-transparency listing');
    // The doc's evicted line from the same run is listed too (grouped by path).
    expect(a1Grant.out).toContain('unmarked project edit');
  }, 60000);
});

// ── Scene B: baselined unmarked equal-version core fork (AC-3 shape) ─────────
// The core-locked arm restores the canonical copy over an unmarked fork (ADR-0085
// D3, DRIFT_RESTORED WARN) — the fork lines it discards are now named, capped.
const bProject = (() => {
  const tmp = makeTempProject();
  write(tmp, AUDIT_REL, `${templateBytes(AUDIT_REL).trimEnd()}\n${Array.from({ length: 12 }, (_, i) => `// unmarked fork line ${i + 1}`).join('\n')}\n`);
  seedBaseline(tmp, AUDIT_REL, templateBytes(AUDIT_REL));
  commitAll(tmp, 'seed baselined unmarked fork');
  return tmp;
})();
const bRun = runUpgrade(bProject);
const bManifest = readManifest(bProject);

describe('AC-3 — baselined unmarked core fork: capped eviction listing on the restore', () => {
  test('DRIFT_RESTORED (WARN) delivers and lists 12 evicted lines as 10 + 2 truncated', () => {
    expect(bRun.status).toBe(0);
    const rows = rowsFor(bManifest, AUDIT_REL);
    expect(verdictsFor(bManifest, AUDIT_REL)).toContain('DRIFT_RESTORED');
    const row = rows.find((d) => d.verdict === 'DRIFT_RESTORED');
    expect(row?.severity).toBe('WARN');
    expect(row?.detail).toContain('EVICTED: 12 project-authored line(s) discarded');
    expect(row?.detail).toContain('// unmarked fork line 10');
    expect(row?.detail).not.toContain('// unmarked fork line 11');
    expect(row?.detail).toContain('(+2 more line(s) truncated)');
    expect(read(bProject, AUDIT_REL)).toBe(templateBytes(AUDIT_REL));
    expect(bRun.out).toContain('EVICTED LINES');
  }, 60000);
});

// ── Scene C: AC-5 noise floor (byte-identical rerun + vintage-proven copy) ────
// The granted delivery must be committed before a second apply run (v1.109.0
// refuses to run over an uncommitted delivery; the delivered core.hooksPath
// pre-commit hook rejects direct commits in the scratch fixture — the
// overwrite-protection re-stale pattern).
git(a1GrantProject, 'config', '--unset', 'core.hooksPath');
commitAll(a1GrantProject, 'land granted delivery');
const cRerun = runUpgrade(a1GrantProject); // byte-identical tree after the granted delivery
const cRerunManifest = readManifest(a1GrantProject);

/** An older committed revision of the core script (vintage-proven bytes). */
function oldTemplateRevision(rel: string): string | null {
  const log = spawnSync('git', ['-C', workspaceRoot, 'log', '--format=%H', '--', `templates/common/${rel}`], {
    encoding: 'utf8',
    env: gitCleanEnv(),
  });
  const shas = (log.stdout || '').split('\n').filter(Boolean);
  for (const sha of shas.slice(1)) {
    const show = spawnSync('git', ['-C', workspaceRoot, 'show', `${sha}:templates/common/${rel}`], {
      encoding: 'utf8',
      env: gitCleanEnv(),
      maxBuffer: 16 * 1024 * 1024,
    });
    if (show.status === 0 && show.stdout && show.stdout !== templateBytes(rel)) return show.stdout;
  }
  return null;
}

const cVintageProject = (() => {
  const tmp = makeTempProject();
  const oldBytes = oldTemplateRevision(AUDIT_REL);
  if (oldBytes) write(tmp, AUDIT_REL, oldBytes);
  commitAll(tmp, 'seed vintage-proven core copy');
  return { tmp, seeded: existsSync(join(tmp, AUDIT_REL)) };
})();
const cVintage = cVintageProject.seeded ? runUpgrade(cVintageProject.tmp) : null;
const cVintageManifest = cVintage ? readManifest(cVintageProject.tmp) : null;

describe('AC-5 — noise floor: byte-identical and vintage-proven copies list nothing', () => {
  test('byte-identical rerun: exit 0, zero EVICTED rows, no EVICTED LINES block (UNTOUCHED short-circuit)', () => {
    expect(cRerun.status).toBe(0);
    expect(cRerun.out).not.toContain('EVICTED LINES');
    for (const d of cRerunManifest.decisions) expect(d.detail).not.toContain('EVICTED:');
    for (const rel of [AUDIT_REL, DOC_REL]) expect(read(a1GrantProject, rel)).toBe(templateBytes(rel));
  }, 60000);

  test('vintage-proven core copy: ADOPT (INFO) without any eviction listing (vintage short-circuit)', () => {
    if (!cVintage || !cVintageManifest) {
      console.warn('SKIP: no older committed revision of scripts/audit.ts available for the vintage scene');
      return;
    }
    expect(cVintage.status).toBe(0);
    const rows = rowsFor(cVintageManifest, AUDIT_REL);
    expect(verdictsFor(cVintageManifest, AUDIT_REL)).toContain('ADOPT');
    expect(verdictsFor(cVintageManifest, AUDIT_REL)).not.toContain('MARKER_LOSS');
    const adopt = rows.find((d) => d.verdict === 'ADOPT');
    expect(adopt?.detail).toContain('vintage-proven');
    expect(adopt?.detail).not.toContain('EVICTED:');
    expect(cVintage.out).not.toContain(`EVICTED LINES`);
    expect(read(cVintageProject.tmp, AUDIT_REL)).toBe(templateBytes(AUDIT_REL));
  }, 60000);
});

// ── Scene D: --audit-core-deltas legacy scan (AC-6) ───────────────────────────
const dProject = (() => {
  const tmp = makeTempProject();
  write(tmp, AUDIT_REL, `${templateBytes(AUDIT_REL).trimEnd()}\n// committed unmarked variant block\nexport const CO_GATE = true;\n`);
  write(tmp, 'scripts/dev-sync.ts', templateBytes('scripts/dev-sync.ts'));
  seedBaseline(tmp, AUDIT_REL, templateBytes(AUDIT_REL));
  seedBaseline(tmp, 'scripts/dev-sync.ts', templateBytes('scripts/dev-sync.ts'));
  commitAll(tmp, 'seed committed unmarked core delta');
  return tmp;
})();

describe('AC-6 — --audit-core-deltas flags committed unmarked variant blocks', () => {
  test('the scan runs WITHOUT a positional target (--project form) and is report-only (exit 0)', () => {
    const r = spawnSync('bun', [upgradeScript, '--audit-core-deltas', '--project', dProject], {
      encoding: 'utf-8',
      timeout: 60000,
      stdio: ['ignore', 'pipe', 'pipe'],
      cwd: workspaceRoot, // a fleet sweep runs from the workspace root — no root-target guard trip
    });
    const out = `${r.stdout ?? ''}\n${r.stderr ?? ''}`;
    expect(r.status).toBe(0);
    // The scan canonicalizes roots (macOS /var → /private/var) — compare resolved.
    expect(out).toContain(`project: ${realpathSync(dProject)}`);
    expect(out).toContain('PROJECT-AUTHORED DELTA: 2 line(s) vs the delivered baseline (unmarked)');
    expect(out).toContain('// committed unmarked variant block');
    expect(out).toContain('scripts/dev-sync.ts — no project-authored delta');
    expect(out).toContain('report-only — exit 0, nothing gates');
  }, 60000);

  test('a marker inside the delta names its ticket id', () => {
    const tmp = makeTempProject();
    write(
      tmp,
      AUDIT_REL,
      `${templateBytes(AUDIT_REL).trimEnd()}\n// LOCAL-PATCH(upstream-request: U-20261107-003): marked committed delta\n`,
    );
    write(tmp, 'scripts/dev-sync.ts', templateBytes('scripts/dev-sync.ts'));
    seedBaseline(tmp, AUDIT_REL, templateBytes(AUDIT_REL));
    seedBaseline(tmp, 'scripts/dev-sync.ts', templateBytes('scripts/dev-sync.ts'));
    commitAll(tmp, 'seed marked core delta');
    const r = spawnSync('bun', [upgradeScript, '--audit-core-deltas', '--project', tmp], {
      encoding: 'utf-8',
      timeout: 60000,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    const out = `${r.stdout ?? ''}\n${r.stderr ?? ''}`;
    expect(r.status).toBe(0);
    expect(out).toContain('[LOCAL-PATCH ids: U-20261107-003]');
    expect(out).toContain('scripts/dev-sync.ts — no project-authored delta');
  }, 60000);

  test('a clean copy prints `no project-authored delta`', () => {
    const tmp = makeTempProject();
    write(tmp, AUDIT_REL, templateBytes(AUDIT_REL));
    write(tmp, 'scripts/dev-sync.ts', templateBytes('scripts/dev-sync.ts'));
    seedBaseline(tmp, AUDIT_REL, templateBytes(AUDIT_REL));
    seedBaseline(tmp, 'scripts/dev-sync.ts', templateBytes('scripts/dev-sync.ts'));
    commitAll(tmp, 'seed clean copies');
    const r = spawnSync('bun', [upgradeScript, '--audit-core-deltas', '--project', tmp], {
      encoding: 'utf-8',
      timeout: 60000,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    const out = `${r.stdout ?? ''}\n${r.stderr ?? ''}`;
    expect(r.status).toBe(0);
    expect(out).toContain('scripts/audit.ts — no project-authored delta');
    expect(out).toContain('scripts/dev-sync.ts — no project-authored delta');
  }, 60000);
});
