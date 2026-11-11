/**
 * Engine replay fixtures for the upgrade overwrite-protection design PR-B
 * (docs/designs/2026-11-11-upgrade-overwrite-protection-design.md, DEC-20261111-01):
 *
 *  - E3 equal-version resolver (scripts / variant scripts): an unproven fork is CONFLICT
 *    (ERROR, kept); a file whose bytes equal a historical template blob (vintage) restores as
 *    DRIFT_RESTORED at INFO and baselines with provenance "vintage".
 *  - E3 vintage UNBASELINED_OVERWRITE -> ADOPT (INFO); a non-vintage, unmarked divergence stays
 *    UNBASELINED_OVERWRITE (WARN) and enters pendingBackport (kind UNBASELINED).
 *  - E3 PROJECT_AHEAD (WARN, never delivered) for scripts, variant scripts, agents, skills (the
 *    additive catch-up row first, then the PROJECT_AHEAD row), variant skills, inline-version docs.
 *  - E3 MERGE_DROP: ci.yml MERGE and DOCS_MERGE merges that drop unmarked project-authored lines
 *    override the MERGE row to WARN.
 *  - E4 manifest: pendingBackport[] (firstSeen carry-forward + the writer rule), templateDirty,
 *    engineVersion, baseline provenance + blob (git-hash-object parity), decision grant.
 *
 * Vintage fixtures use REAL template history (git blob history of delivered lib scripts); a
 * scenario whose historical blob cannot be found (shallow clone) is skipped, not failed.
 * Three engine runs share all scenarios (dry, apply, apply with a grant). Every engine-spawning
 * test carries a 60s per-test budget; the file joins test-runner FILE_TIME_BUDGETS.
 *
 * @version 1.0.0
 */
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { describe, test, expect, afterAll } from 'bun:test';

import { gitCleanEnv } from '../../scripts/lib/git-env.ts';
import { blobIdOf } from '../../scripts/lib/template-vintage.ts';
import { assertCallerEnvSafeForGitFixtures, assertFixtureGitIdentity } from '../helpers/fixture-git.ts';

const workspaceRoot = resolve(import.meta.dir, '..', '..');
const upgradeScript = join(workspaceRoot, 'scripts', 'upgrade-project.ts');
const VARIANT = 'co-deck';

const tmpDirs: string[] = [];
afterAll(() => {
  for (const d of tmpDirs) rmSync(d, { recursive: true, force: true });
});

const gitC = (cwd: string, ...args: string[]): string =>
  spawnSync('git', ['-C', cwd, ...args], { env: gitCleanEnv(), encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }).stdout ?? '';

function makeTempProject(): string {
  const tmp = mkdtempSync(join(tmpdir(), 'upgrade-vintage-pending-'));
  tmpDirs.push(tmp);
  assertCallerEnvSafeForGitFixtures(tmp);
  spawnSync('git', ['init', '-q'], { cwd: tmp, env: gitCleanEnv(), stdio: ['ignore', 'pipe', 'pipe'] });
  assertFixtureGitIdentity(tmp);
  gitC(tmp, 'config', 'user.email', 'test@example.com');
  gitC(tmp, 'config', 'user.name', 'Test');
  mkdirSync(join(tmp, '.claude'), { recursive: true });
  writeFileSync(join(tmp, '.claude', 'template-version.txt'), `variant=${VARIANT}\nversion=0.0.0\ncountry=none\n`);
  return tmp;
}

function runUpgrade(tmp: string, extraArgs: string[] = []): { status: number; out: string } {
  const r = spawnSync('bun', [upgradeScript, tmp, '--variant', VARIANT, '--yes', ...extraArgs], {
    encoding: 'utf-8',
    timeout: 300000,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  return { status: r.status ?? -1, out: `${r.stdout ?? ''}\n${r.stderr ?? ''}` };
}

interface Decision {
  path: string;
  policy: string;
  pass: string;
  verdict: string;
  severity: string;
  detail: string;
  grant?: string;
}
interface PendingEntry {
  path: string;
  kind: string;
  projectHash: string;
  deliverableHash?: string;
  projectVersion?: string;
  templateVersion?: string;
  firstSeen: string;
  firstSeenTemplateVersion: string;
}
interface Manifest {
  files: string[];
  baselines: Record<string, { hash: string; templateVersion: string; provenance?: string; blob?: string }>;
  decisions: Decision[];
  pendingBackport: PendingEntry[];
  templateDirty: boolean;
  engineVersion: string;
}
const manifestPath = (tmp: string): string => join(tmp, '.claude', 'last-upgrade-delivery.json');
const readManifest = (tmp: string): Manifest => JSON.parse(readFileSync(manifestPath(tmp), 'utf8'));
const rowsFor = (m: Manifest, path: string): Decision[] => m.decisions.filter((d) => d.path === path && d.policy !== 'PRESERVE');
const verdictsFor = (m: Manifest, path: string): string[] => rowsFor(m, path).map((d) => d.verdict);
const pendingFor = (m: Manifest, path: string): PendingEntry | undefined => m.pendingBackport.find((e) => e.path === path);

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
const scriptVersion = (text: string): string => text.match(/@version\s+(\d+\.\d+\.\d+)/)?.[1] ?? '';
const bump = (text: string, v: string): string => text.replace(/@version\s+\d+\.\d+\.\d+/, `@version ${v}`);
const semverCmp = (a: string, b: string): number => {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) if ((pa[i] ?? 0) !== (pb[i] ?? 0)) return (pa[i] ?? 0) - (pb[i] ?? 0);
  return 0;
};

// ── Real-history vintage blobs ──────────────────────────────────────────────
const LIB_CANDIDATES = [
  'auth.ts', 'encoding-utils.ts', 'env-sample.ts', 'error-handling.ts', 'fleet.ts', 'generator-manifest.ts',
  'dependency-guard.ts', 'context-md-schema.ts', 'managed-block-parity.ts', 'package-merge.ts', 'platforms.ts',
];
function historicalBlobs(rel: string): string[] {
  const tplPath = `templates/common/${rel}`;
  const hashes = gitC(workspaceRoot, 'log', '--format=%H', '--since=2026-06-01', '--', tplPath).split('\n').filter(Boolean);
  return hashes.slice(1).map((h) => gitC(workspaceRoot, 'show', `${h}:${tplPath}`));
}
/** A historical revision of a delivered lib script with the SAME @version but different bytes (the unbumped-reformat class). */
function findEqualVersionVintage(exclude: string[] = []): { rel: string; vintage: string } | null {
  for (const f of LIB_CANDIDATES) {
    const rel = `scripts/lib/${f}`;
    if (exclude.includes(rel)) continue;
    const cur = templateBytes(rel);
    const v = scriptVersion(cur);
    if (!v) continue;
    const hit = historicalBlobs(rel).find((t) => scriptVersion(t) === v && t !== cur && !t.includes('LOCAL-PATCH'));
    if (hit) return { rel, vintage: hit };
  }
  return null;
}
/** A historical revision with an OLDER @version (the version-gated vintage arm). */
function findOlderVintage(exclude: string[]): { rel: string; vintage: string } | null {
  for (const f of LIB_CANDIDATES) {
    const rel = `scripts/lib/${f}`;
    if (exclude.includes(rel)) continue;
    const cur = templateBytes(rel);
    const v = scriptVersion(cur);
    if (!v) continue;
    const hit = historicalBlobs(rel).find((t) => scriptVersion(t) && semverCmp(scriptVersion(t), v) < 0 && !t.includes('LOCAL-PATCH'));
    if (hit) return { rel, vintage: hit };
  }
  return null;
}

const EQ_CONTROL = 'scripts/lib/hermetic-test-roots.ts'; // equal-version unproven fork
const AHEAD_SCRIPT = 'scripts/lib/git-env.ts'; // bumped non-core script
const AHEAD_VARIANT = 'scripts/co-deck/estimate-layout.ts'; // bumped variant script
const AHEAD_AGENT = 'agents/design.md'; // agents/ project-ahead
const AHEAD_SKILL = 'skills/explain-me/SKILL.md'; // common skill, project-ahead + missing sub-file
const AHEAD_SKILL_SUB = 'skills/explain-me/references/BUILD_GUIDE.md';
const AHEAD_VSKILL = 'skills/storyline/SKILL.md'; // variant skill, project-ahead
const AHEAD_DOC = 'docs/context.md'; // inline-version doc
const CI = '.github/workflows/ci.yml';
const AGENTS_DROP_LINE = 'PROJECT-ONLY-UNMARKED-LINE-IN-MANAGED-BLOCK';
const CI_DROP_LINE = '      - name: project-only-unmarked-step-for-merge-drop';

const eqVintage = findEqualVersionVintage([EQ_CONTROL, AHEAD_SCRIPT]);
const oldVintage = findOlderVintage([EQ_CONTROL, AHEAD_SCRIPT, eqVintage?.rel ?? '']);
const OLD_UNPROVEN = 'scripts/lib/managed-block-merge.ts';

function seed(): string {
  const tmp = makeTempProject();
  write(tmp, EQ_CONTROL, `${templateBytes(EQ_CONTROL).trimEnd()}\n// unmarked local fork\n`);
  if (eqVintage) write(tmp, eqVintage.rel, eqVintage.vintage);
  if (oldVintage) write(tmp, oldVintage.rel, oldVintage.vintage);
  // older version + a local line: not vintage, unmarked -> UNBASELINED_OVERWRITE (WARN)
  write(tmp, OLD_UNPROVEN, `${bump(templateBytes(OLD_UNPROVEN), '0.0.1').trimEnd()}\n// unmarked local divergence\n`);
  write(tmp, AHEAD_SCRIPT, `${bump(templateBytes(AHEAD_SCRIPT), '99.0.0').trimEnd()}\n// project-ahead script\n`);
  write(tmp, AHEAD_VARIANT, `${bump(templateBytes(AHEAD_VARIANT), '99.0.0').trimEnd()}\n// project-ahead variant script\n`);
  write(tmp, AHEAD_AGENT, `${templateBytes(AHEAD_AGENT).replace(/^version:.*$/m, 'version: "99.0.0"').trimEnd()}\nproject-ahead agent body\n`);
  write(tmp, AHEAD_SKILL, templateBytes(AHEAD_SKILL).replace(/^version:.*$/m, 'version: "99.0.0"'));
  write(tmp, AHEAD_VSKILL, templateBytes(AHEAD_VSKILL).replace(/^version:.*$/m, 'version: 99.0.0'));
  write(tmp, AHEAD_DOC, templateBytes(AHEAD_DOC).replace(/(\*context\.md version: )\d+\.\d+/, '$199.0'));
  // ci.yml: an UNMARKED project step inside a template-owned job (the MERGE_DROP shape)
  write(tmp, CI, templateBytes(CI).replace(/^(jobs:\n(?:.*\n)*?  audit:\n    .*\n(?:    .*\n)*?    steps:\n)/m, `$1${CI_DROP_LINE}\n        run: echo project-only\n`));
  // AGENTS.md (DOCS_MERGE): an UNMARKED project line inside a template-owned managed block
  write(tmp, 'AGENTS.md', templateBytes('AGENTS.md').replace(/(<!-- WORKSPACE-MANAGED: tier-model-mapping -->\n)/, `$1${AGENTS_DROP_LINE}\n`));
  gitC(tmp, 'add', '-A');
  gitC(tmp, 'commit', '-q', '-m', 'seed vintage / pending fixtures');
  return tmp;
}

describe('E3/E4 — vintage provenance, PROJECT_AHEAD, MERGE_DROP, manifest fields (DEC-20261111-01 PR-B)', () => {
  const dryProject = seed();
  const applyProject = seed();
  const dry = runUpgrade(dryProject, ['--dry-run']);
  const apply = runUpgrade(applyProject);
  const m = readManifest(applyProject);
  // The second apply (below) mutates applyProject at collection time — snapshot first-apply file state now.
  const after1 = new Map<string, string>();
  for (const rel of [EQ_CONTROL, AHEAD_SCRIPT, AHEAD_VARIANT, AHEAD_AGENT, AHEAD_SKILL, AHEAD_VSKILL, AHEAD_DOC, CI, OLD_UNPROVEN]) {
    after1.set(rel, read(applyProject, rel));
  }

  test('equal-version unproven fork: CONFLICT (ERROR), project bytes kept, pending CONFLICT', () => {
    const row = rowsFor(m, EQ_CONTROL).find((d) => d.verdict === 'CONFLICT');
    expect(row?.severity).toBe('ERROR');
    expect(verdictsFor(m, EQ_CONTROL)).not.toContain('DRIFT_RESTORED');
    expect(after1.get(EQ_CONTROL)).toContain('// unmarked local fork');
    expect(pendingFor(m, EQ_CONTROL)?.kind).toBe('CONFLICT');
    expect(apply.status).toBe(1);
  }, 60000);

  const eqTest = eqVintage ? test : test.skip;
  eqTest('equal-version vintage-proven fork: DRIFT_RESTORED at INFO, restored, vintage baseline with blob parity', () => {
    const rel = eqVintage!.rel;
    const row = rowsFor(m, rel).find((d) => d.verdict === 'DRIFT_RESTORED');
    expect(row?.severity).toBe('INFO');
    expect(read(applyProject, rel)).toBe(templateBytes(rel));
    expect(m.baselines[rel]?.provenance).toBe('vintage');
    expect(m.baselines[rel]?.blob).toBe(blobIdOf(templateBytes(rel)));
    expect(m.files).toContain(rel);
    expect(pendingFor(m, rel)).toBeUndefined();
    expect(dry.out).toContain(`DRIFT (restored, vintage-proven) ${rel}`);
  }, 60000);

  const oldTest = oldVintage ? test : test.skip;
  oldTest('vintage-proven unbaselined older-version copy: ADOPT (INFO), not UNBASELINED_OVERWRITE', () => {
    const rel = oldVintage!.rel;
    const rows = rowsFor(m, rel);
    expect(rows.map((d) => d.verdict)).toContain('ADOPT');
    expect(rows.map((d) => d.verdict)).not.toContain('UNBASELINED_OVERWRITE');
    const adopt = rows.find((d) => d.verdict === 'ADOPT');
    expect(adopt?.severity).toBe('INFO');
    expect(adopt?.detail).toContain('vintage-proven');
    expect(adopt?.grant).toBeUndefined();
    expect(read(applyProject, rel)).toBe(templateBytes(rel));
    expect(m.baselines[rel]?.provenance).toBe('vintage');
  }, 60000);

  test('non-vintage unmarked unbaselined divergence stays UNBASELINED_OVERWRITE (WARN) and enters pendingBackport UNBASELINED', () => {
    const row = rowsFor(m, OLD_UNPROVEN).find((d) => d.verdict === 'UNBASELINED_OVERWRITE');
    expect(row?.severity).toBe('WARN');
    const p = pendingFor(m, OLD_UNPROVEN);
    expect(p?.kind).toBe('UNBASELINED');
    expect(p?.projectHash).toMatch(/^[0-9a-f]{64}$/);
    expect(p?.deliverableHash).toMatch(/^[0-9a-f]{64}$/);
  }, 60000);

  test('PROJECT_AHEAD (WARN): scripts / variant scripts / agents / skills / variant skills / inline-version docs are kept and pending', () => {
    for (const rel of [AHEAD_SCRIPT, AHEAD_VARIANT, AHEAD_AGENT, AHEAD_SKILL, AHEAD_VSKILL, AHEAD_DOC]) {
      const row = rowsFor(m, rel).find((d) => d.verdict === 'PROJECT_AHEAD');
      expect(row?.severity, rel).toBe('WARN');
      expect(pendingFor(m, rel)?.kind, rel).toBe('PROJECT_AHEAD');
      expect(m.files, rel).not.toContain(rel);
    }
    expect(read(applyProject, AHEAD_SCRIPT)).toContain('// project-ahead script');
    expect(read(applyProject, AHEAD_VARIANT)).toContain('// project-ahead variant script');
    expect(read(applyProject, AHEAD_AGENT)).toContain('project-ahead agent body');
    expect(read(applyProject, AHEAD_SKILL)).toContain('99.0.0');
    expect(read(applyProject, AHEAD_VSKILL)).toContain('99.0.0');
    expect(read(applyProject, AHEAD_DOC)).toContain('context.md version: 99.0');
    expect(pendingFor(m, AHEAD_SCRIPT)?.projectVersion).toBe('99.0.0');
    expect(pendingFor(m, AHEAD_SCRIPT)?.templateVersion).toBe(scriptVersion(templateBytes(AHEAD_SCRIPT)));
  }, 60000);

  test('project-ahead skill: the additive catch-up row precedes the PROJECT_AHEAD row', () => {
    const catchUp = m.decisions.findIndex((d) => d.path === 'skills/explain-me/' && d.verdict === 'NEW');
    const ahead = m.decisions.findIndex((d) => d.path === AHEAD_SKILL && d.verdict === 'PROJECT_AHEAD');
    expect(catchUp).toBeGreaterThanOrEqual(0);
    expect(ahead).toBeGreaterThan(catchUp);
    expect(existsSync(join(applyProject, AHEAD_SKILL_SUB))).toBe(true);
  }, 60000);

  test('MERGE_DROP: ci.yml merge dropping an unmarked project step is a WARN MERGE row with detail', () => {
    const row = rowsFor(m, CI).find((d) => d.verdict === 'MERGE');
    expect(row?.severity).toBe('WARN');
    expect(row?.detail).toContain('MERGE_DROP');
    expect(read(applyProject, CI)).not.toContain(CI_DROP_LINE);
    expect(dry.out).toContain(`WOULD UPDATE: ${CI}`);
  }, 60000);

  test('MERGE_DROP: DOCS_MERGE (AGENTS.md) dropping an unmarked project line is a WARN MERGE row with detail', () => {
    const row = rowsFor(m, 'AGENTS.md').find((d) => d.pass === 'DOCS_MERGE' && d.verdict === 'MERGE');
    expect(row?.severity).toBe('WARN');
    expect(row?.detail).toContain('MERGE_DROP: 1 project-authored line(s)');
    expect(read(applyProject, 'AGENTS.md')).not.toContain(AGENTS_DROP_LINE);
  }, 60000);

  test('manifest E4 fields: pendingBackport sorted with firstSeen, templateDirty boolean, engineVersion = engine @version', () => {
    expect(Array.isArray(m.pendingBackport)).toBe(true);
    expect(m.pendingBackport.map((e) => e.path)).toEqual([...m.pendingBackport.map((e) => e.path)].sort((a, b) => a.localeCompare(b)));
    for (const e of m.pendingBackport) {
      expect(e.firstSeen).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(e.firstSeenTemplateVersion.length).toBeGreaterThan(0);
    }
    expect(typeof m.templateDirty).toBe('boolean');
    expect(m.engineVersion).toBe(scriptVersion(readFileSync(upgradeScript, 'utf8')));
    expect(apply.out).toContain('PENDING BACKPORT');
  }, 60000);

  test('delivered baselines carry the git blob id of the delivered bytes', () => {
    const rel = OLD_UNPROVEN;
    expect(m.baselines[rel]?.blob).toBe(blobIdOf(read(applyProject, rel)));
    expect(m.baselines[rel]?.provenance).toBeUndefined(); // delivered (default)
  }, 60000);

  test('dry-run parity: the same PROJECT_AHEAD / CONFLICT rows are printed and nothing is written', () => {
    expect(dry.out).toContain(`PROJECT_AHEAD: ${AHEAD_SCRIPT}`);
    expect(dry.out).toContain(`PROJECT_AHEAD: ${AHEAD_AGENT}`);
    expect(dry.out).toContain(`CONFLICT DISPOSITION (SKIP): ${EQ_CONTROL}`);
    expect(dry.out).toContain('PENDING BACKPORT');
    expect(existsSync(manifestPath(dryProject))).toBe(false);
    expect(read(dryProject, OLD_UNPROVEN)).toContain('// unmarked local divergence');
    expect(dry.status).toBe(apply.status);
  }, 60000);

  describe('second apply (carry-forward + grant)', () => {
    // Age the first-seen dates, then re-apply with an adopt grant for the equal-version fork.
    const aged = '2026-01-02';
    const first = readManifest(applyProject);
    first.pendingBackport = first.pendingBackport.map((e) => ({ ...e, firstSeen: aged, firstSeenTemplateVersion: '0.0.1' }));
    writeFileSync(manifestPath(applyProject), `${JSON.stringify(first, null, 2)}\n`);
    // The first apply delivered .githooks and set core.hooksPath; a fixture commit must bypass them
    // via an empty hooks path (not a hook-skip flag) so the engine sees a clean tree on the re-run.
    gitC(applyProject, 'add', '-A');
    gitC(applyProject, '-c', 'core.hooksPath=/dev/null', 'commit', '-q', '-m', 'age pending entries');
    const second = runUpgrade(applyProject, ['--disposition', `adopt-template=${EQ_CONTROL}`]);
    const m2 = readManifest(applyProject);

    test('still-pending paths keep firstSeen / firstSeenTemplateVersion', () => {
      const p = pendingFor(m2, AHEAD_SCRIPT);
      expect(p?.firstSeen).toBe(aged);
      expect(p?.firstSeenTemplateVersion).toBe('0.0.1');
      expect(pendingFor(m2, AHEAD_AGENT)?.firstSeen).toBe(aged);
    }, 60000);

    test('a path that leaves the gate set drops out; the grant row carries grant: adopt-template', () => {
      expect(pendingFor(m2, EQ_CONTROL)).toBeUndefined();
      const row = rowsFor(m2, EQ_CONTROL).find((d) => d.verdict === 'ADOPT');
      expect(row?.grant).toBe('adopt-template');
      expect(read(applyProject, EQ_CONTROL)).toBe(templateBytes(EQ_CONTROL));
      expect(second.out).toContain(EQ_CONTROL);
    }, 60000);
  });
});
