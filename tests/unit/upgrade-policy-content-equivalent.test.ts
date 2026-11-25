/**
 * Content-identity fast path (PM finding 1 — design
 * docs/designs/2026-11-25-upgrade-runner-machinery-batch-design.md §4.8).
 *
 * Unit: `classifyProjectState` returns CONTENT_EQUIVALENT when a PROJECT_EVOLVED
 * candidate and the deliverable differ only in the frontmatter keys `version`
 * and `last_updated`, the `lifecycle` block or the `@version` value; one changed
 * body line stays PROJECT_EVOLVED.
 *
 * Engine: `scripts/upgrade-project.ts` delivers such a candidate with verdict
 * CONTENT_EQUIVALENT at INFO (no adopt grant) and resets the baseline; a project
 * marker the template lacks stays a conflict. Same harness shape as
 * tests/unit/upgrade-overwrite-protection.test.ts (real templates, temp project).
 *
 * @version 1.0.0
 */
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { afterAll, describe, expect, test } from 'bun:test';

import {
  baselineKeyFor,
  classifyProjectState,
  contentEquivalentText,
  type DecisionBaseline,
} from '../../scripts/lib/upgrade-policy.ts';
import { gitCleanEnv } from '../../scripts/lib/git-env.ts';
import { assertCallerEnvSafeForGitFixtures, assertFixtureGitIdentity } from '../helpers/fixture-git.ts';

const workspaceRoot = resolve(import.meta.dir, '..', '..');
const upgradeScript = join(workspaceRoot, 'scripts', 'upgrade-project.ts');
const VARIANT = 'co-develop';
const AGENT = 'agents/architect.md';

const AGENT_NEW = `---\nname: kept\ntier: medium\nversion: 2.0.0\nlast_updated: 2026-11-25\n---\nbody line\n`;
const baselineOf = (content: string): DecisionBaseline => ({ hash: baselineKeyFor('agents/x.md', content), templateVersion: '1.0.0' });
const OLD_BODY = AGENT_NEW.replace('body line', 'older body line');
const baseline = baselineOf(OLD_BODY);

describe('classifyProjectState — content-identity fast path (design §4.8)', () => {
  test('a frontmatter-only difference gives CONTENT_EQUIVALENT', () => {
    const project = AGENT_NEW.replace('2.0.0', '1.0.0').replace('2026-11-25', '2026-01-01');
    const cls = classifyProjectState('agents/x.md', project, AGENT_NEW, baseline);
    expect(cls.state).toBe('CONTENT_EQUIVALENT');
    expect(cls.matchesDeliverable).toBe(false);
    expect(cls.templateChanged).toBe(true);
  });

  test('a lifecycle-block-only difference gives CONTENT_EQUIVALENT on a plain (non-agents) path', () => {
    // agents/ keys already strip the lifecycle block (baselineKeyFor), so the fast
    // path is exercised on a path whose key is the raw content.
    const project = AGENT_NEW.replace('---\nbody', 'lifecycle:\n  phase: production\n---\nbody');
    const b: DecisionBaseline = { hash: baselineKeyFor('docs/x.md', OLD_BODY), templateVersion: '1.0.0' };
    expect(classifyProjectState('docs/x.md', project, AGENT_NEW, b).state).toBe('CONTENT_EQUIVALENT');
  });

  test('an @version-only difference gives CONTENT_EQUIVALENT', () => {
    const project = '// @version 1.0.0\nexport const a = 1;\n';
    const deliverable = '// @version 1.1.0\nexport const a = 1;\n';
    expect(contentEquivalentText(project)).toBe(contentEquivalentText(deliverable));
    expect(classifyProjectState('scripts/x.ts', project, deliverable, baselineOf('old')).state).toBe(
      'CONTENT_EQUIVALENT',
    );
  });

  test('one changed body line gives PROJECT_EVOLVED', () => {
    const project = AGENT_NEW.replace('body line', 'project line');
    const cls = classifyProjectState('agents/x.md', project, AGENT_NEW, baseline);
    expect(cls.state).toBe('PROJECT_EVOLVED');
  });

  test('a changelog line in the body is content (stays PROJECT_EVOLVED)', () => {
    const project = AGENT_NEW.replace('body line', 'body line\n<!-- v1.0.0: changed -->');
    expect(classifyProjectState('agents/x.md', project, AGENT_NEW, baseline).state).toBe('PROJECT_EVOLVED');
  });

  test('exact matches keep their states (IN_SYNC / UNTOUCHED untouched)', () => {
    expect(classifyProjectState('agents/x.md', AGENT_NEW, AGENT_NEW, baseline).state).toBe('IN_SYNC');
    expect(classifyProjectState('agents/x.md', OLD_BODY, 'other', baseline).state).toBe('UNTOUCHED');
  });
});

// ── Engine ───────────────────────────────────────────────────────────────────

const tmpDirs: string[] = [];
afterAll(() => {
  for (const d of tmpDirs) rmSync(d, { recursive: true, force: true });
});

function git(cwd: string, ...args: string[]): void {
  spawnSync('git', ['-C', cwd, ...args], { env: gitCleanEnv(), stdio: ['ignore', 'pipe', 'pipe'] });
}

function templateBytes(rel: string): string {
  const variantCopy = join(workspaceRoot, 'templates', VARIANT, rel);
  return readFileSync(existsSync(variantCopy) ? variantCopy : join(workspaceRoot, 'templates', 'common', rel), 'utf8');
}

function runUpgrade(tmp: string): { status: number; out: string } {
  const r = spawnSync('bun', [upgradeScript, tmp, '--variant', VARIANT, '--yes'], {
    encoding: 'utf-8',
    timeout: 300000,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  return { status: r.status ?? -1, out: `${r.stdout ?? ''}\n${r.stderr ?? ''}` };
}

interface Row {
  path: string;
  policy: string;
  verdict: string;
  severity: string;
}
interface Manifest {
  files: string[];
  baselines: Record<string, DecisionBaseline>;
  decisions: Row[];
}
const readManifest = (tmp: string): Manifest =>
  JSON.parse(readFileSync(join(tmp, '.claude', 'last-upgrade-delivery.json'), 'utf8'));
const rowsFor = (m: Manifest, rel: string): Row[] => m.decisions.filter((d) => d.path === rel && d.policy !== 'PRESERVE');

function commit(tmp: string): void {
  // A delivery installs the template hooks (core.hooksPath) and they reject direct
  // fixture commits — the fixture drops the hook path before every commit it makes.
  spawnSync('git', ['-C', tmp, 'config', '--unset', 'core.hooksPath'], { env: gitCleanEnv(), stdio: 'ignore' });
  const add = spawnSync('git', ['-C', tmp, 'add', '-A'], { env: gitCleanEnv(), stdio: 'ignore' });
  const c = spawnSync('git', ['-C', tmp, 'commit', '-q', '-m', 'seed'], { env: gitCleanEnv(), stdio: 'ignore' });
  expect({ add: add.status, commit: c.status }).toEqual({ add: 0, commit: 0 });
}

/** A project that already holds one real delivery of the agent (the engine's own
 *  rendered bytes), so the only difference later is the one we introduce. */
function deliveredProject(): { tmp: string; delivered: string } {
  const tmp = mkdtempSync(join(tmpdir(), 'upgrade-content-equivalent-'));
  tmpDirs.push(tmp);
  assertCallerEnvSafeForGitFixtures(tmp);
  spawnSync('git', ['init', '-q'], { cwd: tmp, env: gitCleanEnv(), stdio: ['ignore', 'pipe', 'pipe'] });
  assertFixtureGitIdentity(tmp);
  git(tmp, 'config', 'user.email', 'test@example.com');
  git(tmp, 'config', 'user.name', 'Test');
  mkdirSync(join(tmp, '.claude'), { recursive: true });
  writeFileSync(join(tmp, '.claude', 'template-version.txt'), `variant=${VARIANT}\nversion=0.0.0\ncountry=none\n`);
  commit(tmp);
  const first = runUpgrade(tmp);
  expect(first.status).toBe(0);
  commit(tmp);
  return { tmp, delivered: readFileSync(join(tmp, AGENT), 'utf8') };
}

/** Lower only the `version:` line of the delivered copy and land it. */
function lowerVersion(tmp: string, delivered: string, extra = ''): string {
  const evolved = delivered.replace(/^version:.*$/m, 'version: 0.0.1') + extra;
  expect(evolved).not.toBe(delivered);
  writeFileSync(join(tmp, AGENT), evolved);
  commit(tmp);
  return evolved;
}

describe('engine — CONTENT_EQUIVALENT delivery (design §4.8)', () => {
  const { tmp, delivered } = deliveredProject();
  const evolved = lowerVersion(tmp, delivered);
  const run = runUpgrade(tmp);
  const m = readManifest(tmp);
  const after = readFileSync(join(tmp, AGENT), 'utf8');

  test('the fast path fires without an adopt grant: a CONTENT_EQUIVALENT row at INFO, no CONFLICT', () => {
    const rows = rowsFor(m, AGENT);
    expect(rows.map((r) => r.verdict)).toContain('CONTENT_EQUIVALENT');
    expect(rows.find((r) => r.verdict === 'CONTENT_EQUIVALENT')?.severity).toBe('INFO');
    expect(rows.map((r) => r.verdict)).not.toContain('CONFLICT');
    expect(run.status).toBe(0);
    }, 60000);

  test('the delivered copy is the template content again and the baseline resets to it', () => {
    expect(contentEquivalentText(after)).toBe(contentEquivalentText(delivered));
    expect(after).toContain(delivered.match(/^version:.*$/m)![0]);
    expect(m.baselines[AGENT]?.hash).toBe(baselineKeyFor(AGENT, after));
  });

  test('a project marker absent from the template blocks: the body differs, so the copy stays a conflict', () => {
    const marked = lowerVersion(tmp, readFileSync(join(tmp, AGENT), 'utf8'), '\n<!-- LOCAL-PATCH(upstream-request: pending) -->\n');
    const r = runUpgrade(tmp);
    expect(rowsFor(readManifest(tmp), AGENT).map((x) => x.verdict)).not.toContain('CONTENT_EQUIVALENT');
    expect(rowsFor(readManifest(tmp), AGENT).map((x) => x.verdict)).toContain('CONFLICT');
    expect(readFileSync(join(tmp, AGENT), 'utf8')).toBe(marked);
    expect(r.out).toContain('CONFLICT DISPOSITION (SKIP)');
  }, 60000);
});
