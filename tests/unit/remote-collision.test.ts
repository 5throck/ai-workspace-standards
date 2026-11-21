/**
 * Tests for scripts/lib/remote-collision.ts — the new-project remote-collision
 * guard primitives (spec docs/designs/2026-11-21-new-project-remote-collision-guard-design.md,
 * T-20261121-004 — the 2026-11-20 co-work incident: a scaffold into Projects/co-work while
 * github.com/5throck/co-work was live with 52 PRs, the local repo remote-less, the histories
 * diverging silently).
 *
 * Pins (design §6):
 *   1. (a) remote exists + no conforming origin → REFUSE — target absent (fresh scaffold,
 *          the literal incident shape) AND target present as a remote-less scratch git repo
 *          (fixture reproduction of the incident shape end-to-end through the primitive).
 *   2. (b) remote exists + target origin already points at it (https and ssh spellings)
 *          → WARN + proceed (deliberate checkout shape).
 *   3. (c) probe unavailable (gh ENOENT via a PATH stub, auth failure stderr) → WARN.
 *   4. (d) remote absent (404) → proceed silently.
 *   5. Owner-derivation matrix (https / git@ / ssh:// forms; absent origin / non-URL → skip).
 *   6. URL normalization matrix (.git, trailing slash, scheme/user/case insensitivity).
 *   7. Exact message text for refuse / warn / skip (design §3 strings).
 *
 * NO network: the remote probe is injected (or stubbed via a fake `gh` on PATH); git
 * touches only local scratch fixtures under tests/.temp/.
 *
 * Fixture-git discipline: both fixture-git probes adopted (FM1 at setup, FM2 after each
 * `git init`); every fixture spawn runs under gitCleanEnv (2026-11-09 rogue-commit incident).
 * @version 1.0.0
 */
import { describe, test, expect, beforeEach, afterEach } from 'bun:test';

// Test-process git isolation (same discipline as external-deps.test.ts): a git hook
// context (pre-push) exports GIT_* variables the library's raw spawns would inherit.
for (const k of ['GIT_DIR', 'GIT_WORK_TREE', 'GIT_INDEX_FILE', 'GIT_OBJECT_DIRECTORY', 'GIT_COMMON_DIR', 'GIT_ALTERNATE_OBJECT_DIRECTORIES']) delete process.env[k];

import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { spawnSync } from 'node:child_process';
import { assertCallerEnvSafeForGitFixtures, assertFixtureGitIdentity } from '../helpers/fixture-git.ts';
import { gitCleanEnv } from '../../scripts/lib/git-env.ts';
import {
  checkRemoteCollision,
  expectedRemoteUrl,
  githubOwnerFromOrigin,
  normalizeRemoteUrl,
  originPointsAt,
  probeGithubRepo,
  workspaceGithubOwner,
} from '../../scripts/lib/remote-collision.ts';

const scratchRoot = path.resolve(import.meta.dir, '..', '.temp', 'remote-collision-test');

/** Fixture git spawn under the sanitized environment (fixture-git contract). */
function git(args: string[], cwd: string, extraEnv: Record<string, string> = {}): { status: number | null; stdout: string; stderr: string } {
  const r = spawnSync('git', args, { cwd, encoding: 'utf8', env: { ...gitCleanEnv(), ...extraEnv } });
  return { status: r.status, stdout: r.stdout ?? '', stderr: r.stderr ?? '' };
}

/** git init + identity + one commit — a real local repo WITHOUT any origin (the incident shape). */
function initRemoteLessRepo(dir: string): void {
  fs.mkdirSync(dir, { recursive: true });
  git(['init', '-q'], dir);
  assertFixtureGitIdentity(dir);
  fs.writeFileSync(path.join(dir, 'README.md'), '# fixture\n');
  git(['add', '-A'], dir);
  git(['-c', 'user.name=Fixture', '-c', 'user.email=fixture@test.local', 'commit', '-q', '-m', 'init'], dir);
}

function setOrigin(dir: string, url: string): void {
  const r = git(['remote', 'add', 'origin', url], dir);
  expect(r.status).toBe(0);
}

/** A workspace fixture: git repo with the given origin URL (the owner-derivation SSOT). */
function makeWorkspaceWithOrigin(originUrl: string | null): string {
  const ws = path.join(scratchRoot, `ws-${Math.random().toString(36).slice(2, 8)}`);
  fs.mkdirSync(ws, { recursive: true });
  git(['init', '-q'], ws);
  assertFixtureGitIdentity(ws);
  if (originUrl) setOrigin(ws, originUrl);
  return ws;
}

const probeExists = () => 'exists' as const;
const probeAbsent = () => 'absent' as const;
const probeUnavailable = () => 'unavailable' as const;

describe('githubOwnerFromOrigin / normalizeRemoteUrl (design §6 pin 5-6)', () => {
  test('derives the owner from all three remote spellings', () => {
    expect(githubOwnerFromOrigin('https://github.com/5throck/ai-workspace-standards.git')).toBe('5throck');
    expect(githubOwnerFromOrigin('git@github.com:5throck/co-work.git')).toBe('5throck');
    expect(githubOwnerFromOrigin('ssh://git@github.com/5throck/co-work')).toBe('5throck');
  });

  test('returns null for absent / non-URL / plain-path origins', () => {
    expect(githubOwnerFromOrigin(null)).toBeNull();
    expect(githubOwnerFromOrigin(undefined)).toBeNull();
    expect(githubOwnerFromOrigin('')).toBeNull();
    expect(githubOwnerFromOrigin('not a url')).toBeNull();
    expect(githubOwnerFromOrigin('/some/local/path')).toBeNull();
  });

  test('normalization: .git suffix, trailing slash, scheme/user/case are all equal', () => {
    const canonical = expectedRemoteUrl('5throck', 'co-work');
    expect(canonical).toBe('github.com/5throck/co-work');
    expect(normalizeRemoteUrl('https://github.com/5throck/co-work.git')).toBe(canonical);
    expect(normalizeRemoteUrl('git@github.com:5throck/co-work.git')).toBe(canonical);
    expect(normalizeRemoteUrl('ssh://git@github.com/5throck/co-work/')).toBe(canonical);
    expect(normalizeRemoteUrl('https://GITHUB.com/5throck/CO-WORK.GIT')).toBe(canonical);
  });

  test('different hosts/paths never normalize equal', () => {
    expect(normalizeRemoteUrl('https://github.com/5throck/co-work.git')).not.toBe(
      normalizeRemoteUrl('https://github.com/5throck/co-work2.git'),
    );
    expect(normalizeRemoteUrl('https://gitlab.com/5throck/co-work.git')).not.toBe(
      normalizeRemoteUrl('https://github.com/5throck/co-work.git'),
    );
  });
});

describe('workspaceGithubOwner / originPointsAt', () => {
  beforeEach(() => {
    fs.rmSync(scratchRoot, { recursive: true, force: true });
    fs.mkdirSync(scratchRoot, { recursive: true });
    assertCallerEnvSafeForGitFixtures(scratchRoot);
  });
  afterEach(() => fs.rmSync(scratchRoot, { recursive: true, force: true }));

  test('derives the owner from the workspace origin (the convention SSOT)', () => {
    const ws = makeWorkspaceWithOrigin('https://github.com/5throck/ai-workspace-standards.git');
    const { owner } = workspaceGithubOwner(ws);
    expect(owner).toBe('5throck');
  });

  test('no workspace origin → owner null (guard goes inert)', () => {
    const ws = makeWorkspaceWithOrigin(null);
    expect(workspaceGithubOwner(ws).owner).toBeNull();
  });

  test('originPointsAt: true for the same repo across spellings, false otherwise', () => {
    const target = path.join(scratchRoot, 'target');
    initRemoteLessRepo(target);
    setOrigin(target, 'git@github.com:5throck/co-work.git');
    expect(originPointsAt(target, '5throck', 'co-work')).toBe(true);
    expect(originPointsAt(target, '5throck', 'other')).toBe(false);
    expect(originPointsAt(target, 'someoneelse', 'co-work')).toBe(false);
    expect(originPointsAt(path.join(scratchRoot, 'never-created'), '5throck', 'co-work')).toBe(false);
  });

  test('originPointsAt: a remote-less repo (the incident shape) is false', () => {
    const target = path.join(scratchRoot, 'remote-less');
    initRemoteLessRepo(target);
    expect(originPointsAt(target, '5throck', 'co-work')).toBe(false);
  });
});

describe('checkRemoteCollision — the four decision branches (design §6 pins 1-4)', () => {
  beforeEach(() => {
    fs.rmSync(scratchRoot, { recursive: true, force: true });
    fs.mkdirSync(scratchRoot, { recursive: true });
    assertCallerEnvSafeForGitFixtures(scratchRoot);
  });
  afterEach(() => fs.rmSync(scratchRoot, { recursive: true, force: true }));

  test('(a) REFUSE — remote exists, target absent: the literal 2026-11-20 incident shape', () => {
    const ws = makeWorkspaceWithOrigin('https://github.com/5throck/ai-workspace-standards.git');
    const target = path.join(ws, 'Projects', 'co-work'); // does NOT exist — fresh scaffold
    const decision = checkRemoteCollision({
      projectName: 'co-work',
      projectDir: target,
      workspaceRoot: ws,
      probe: probeExists,
    });
    expect(decision.action).toBe('refuse');
    if (decision.action !== 'refuse') return;
    expect(decision.remoteUrl).toBe('github.com/5throck/co-work');
    expect(decision.targetLabel).toBe('Projects/co-work');
    expect(decision.lines[0]).toContain('already exists, but the scaffold target has no origin pointing at it');
  });

  test('(a) REFUSE — incident-shape fixture reproduction: target is a real remote-less repo', () => {
    const ws = makeWorkspaceWithOrigin('git@github.com:5throck/ai-workspace-standards.git');
    const target = path.join(ws, 'Projects', 'co-work');
    initRemoteLessRepo(target); // scaffolded-without-origin shape
    const decision = checkRemoteCollision({
      projectName: 'co-work',
      projectDir: target,
      workspaceRoot: ws,
      probe: probeExists,
    });
    expect(decision.action).toBe('refuse');
    if (decision.action !== 'refuse') return;
    expect(decision.lines.join('\n')).toContain('2026-11-20 co-work incident shape');
    expect(decision.lines.join('\n')).toContain('no override flag');
    expect(decision.lines.join('\n')).toContain('gh repo clone 5throck/co-work "Projects/co-work"');
  });

  test('(b) WARN + proceed — remote exists and the target origin already points at it (https spelling)', () => {
    const ws = makeWorkspaceWithOrigin('https://github.com/5throck/ai-workspace-standards.git');
    const target = path.join(ws, 'Projects', 'co-work');
    initRemoteLessRepo(target);
    setOrigin(target, 'https://github.com/5throck/co-work.git');
    const decision = checkRemoteCollision({
      projectName: 'co-work',
      projectDir: target,
      workspaceRoot: ws,
      probe: probeExists,
    });
    expect(decision.action).toBe('warn');
    if (decision.action !== 'warn') return;
    expect(decision.message).toBe(
      '⚠️  Remote-collision guard: github.com/5throck/co-work exists and the target\'s origin already points at it — proceeding (deliberate checkout shape).',
    );
  });

  test('(b) WARN — ssh-spelled target origin still counts as pointing at the remote', () => {
    const ws = makeWorkspaceWithOrigin('https://github.com/5throck/ai-workspace-standards.git');
    const target = path.join(ws, 'Projects', 'co-work');
    initRemoteLessRepo(target);
    setOrigin(target, 'ssh://git@github.com/5throck/co-work');
    const decision = checkRemoteCollision({
      projectName: 'co-work',
      projectDir: target,
      workspaceRoot: ws,
      probe: probeExists,
    });
    expect(decision.action).toBe('warn');
  });

  test('(c) WARN + proceed — probe unavailable (gh failure must never block a scaffold)', () => {
    const ws = makeWorkspaceWithOrigin('https://github.com/5throck/ai-workspace-standards.git');
    const decision = checkRemoteCollision({
      projectName: 'co-work',
      projectDir: path.join(ws, 'Projects', 'co-work'),
      workspaceRoot: ws,
      probe: probeUnavailable,
    });
    expect(decision.action).toBe('warn');
    if (decision.action !== 'warn') return;
    expect(decision.message).toContain('Remote-collision check unavailable');
    expect(decision.message).toContain('before the first push');
  });

  test('(d) proceed silently — remote absent (the common new-project case)', () => {
    const ws = makeWorkspaceWithOrigin('https://github.com/5throck/ai-workspace-standards.git');
    const decision = checkRemoteCollision({
      projectName: 'brand-new-project',
      projectDir: path.join(ws, 'Projects', 'brand-new-project'),
      workspaceRoot: ws,
      probe: probeAbsent,
    });
    expect(decision.action).toBe('proceed');
    expect(decision).not.toHaveProperty('message');
    expect(decision).not.toHaveProperty('lines');
  });

  test('skip — no GitHub owner derivable from the workspace origin (guard inert)', () => {
    const ws = makeWorkspaceWithOrigin(null);
    const decision = checkRemoteCollision({
      projectName: 'co-work',
      projectDir: path.join(ws, 'Projects', 'co-work'),
      workspaceRoot: ws,
      probe: probeExists,
    });
    expect(decision.action).toBe('skip');
    if (decision.action !== 'skip') return;
    expect(decision.message).toBe(
      'ℹ️  Remote-collision check skipped: no GitHub owner derivable from the workspace origin remote.',
    );
  });

  test('path-like project names keep the full destination in the refuse message', () => {
    const ws = makeWorkspaceWithOrigin('https://github.com/5throck/ai-workspace-standards.git');
    const decision = checkRemoteCollision({
      projectName: 'tests/.temp/co-work',
      projectDir: path.join(ws, 'tests/.temp/co-work'),
      workspaceRoot: ws,
      probe: probeExists,
    });
    expect(decision.action).toBe('refuse');
    if (decision.action !== 'refuse') return;
    // The remote repo is named after the LEAF segment; the target label is the destination as given.
    expect(decision.remoteUrl).toBe('github.com/5throck/co-work');
    expect(decision.targetLabel).toBe('tests/.temp/co-work');
    expect(decision.lines.join('\n')).toContain('gh repo clone 5throck/co-work "tests/.temp/co-work"');
  });
});

describe('probeGithubRepo classification (fake gh on PATH — no network)', () => {
  const fakeBin = path.join(scratchRoot, 'fakebin');
  const realPath = process.env.PATH;

  function writeFakeGh(script: string): void {
    fs.mkdirSync(fakeBin, { recursive: true });
    const p = path.join(fakeBin, 'gh');
    fs.writeFileSync(p, script);
    fs.chmodSync(p, 0o755);
    process.env.PATH = `${fakeBin}:${realPath}`;
  }

  beforeEach(() => {
    fs.rmSync(scratchRoot, { recursive: true, force: true });
    fs.mkdirSync(scratchRoot, { recursive: true });
    assertCallerEnvSafeForGitFixtures(scratchRoot);
  });
  afterEach(() => {
    process.env.PATH = realPath;
    fs.rmSync(scratchRoot, { recursive: true, force: true });
  });

  test('exit 0 → exists', () => {
    writeFakeGh('#!/bin/sh\nexit 0\n');
    expect(probeGithubRepo('5throck/co-work')).toBe('exists');
  });

  test('exit 1 + "not found" stderr → absent (GitHub 404)', () => {
    writeFakeGh('#!/bin/sh\necho "gh: Not found" >&2\nexit 1\n');
    expect(probeGithubRepo('5throck/co-work')).toBe('absent');
  });

  test('exit 1 + auth-prompt stderr → unavailable (case c, never "absent")', () => {
    writeFakeGh('#!/bin/sh\necho "gh: To get started with GitHub CLI, please run: gh auth login" >&2\nexit 1\n');
    expect(probeGithubRepo('5throck/co-work')).toBe('unavailable');
  });

  test('gh missing entirely (ENOENT) → unavailable', () => {
    fs.mkdirSync(fakeBin, { recursive: true });
    process.env.PATH = fakeBin; // empty bin dir — no gh anywhere
    expect(probeGithubRepo('5throck/co-work')).toBe('unavailable');
  });
});
