#!/usr/bin/env bun
/**
 * tests/unit/pm-dispatch-gate.test.ts — unit tests for scripts/hooks/pm-dispatch-gate.ts
 * and the marker chain with scripts/hooks/pm-role-bootstrap.ts.
 *
 * Runs each hook as a subprocess over stdin (the real hook invocation path),
 * with PM_GATE_STATE_DIR pointed at a fresh temp dir and CLAUDE_PROJECT_DIR
 * pinned to this workspace root, so tests never touch the real session state.
 *
 * The AUTH-GATE arm cases (U-20261122-006) run against a per-case fixture tree
 * (agents/ frontmatter fixtures + .git dir / .git gitdir-pointer file / no .git)
 * with CLAUDE_PROJECT_DIR pointed at the fixture root and AUTH_GATE_STATE /
 * PM_GATE_STATE_DIR isolating state, per the design's test contract.
 *
 * Scoped run (bare `bun test` at the workspace root would pick up Projects/*):
 *   bun tests/unit/pm-dispatch-gate.test.ts
 *
 * @version 1.1.0
 * v1.1.0 (2026-11-22, U-20261122-006): AUTH-GATE arm cases — fresh-PASS allows,
 *          absent/expired/non-PASS/malformed/future-clock/window-ended deny,
 *          resolution arms (env override, .git dir, .git gitdir: file, tmpdir
 *          sha256 fallback), marker-passed sessions still auth-checked (D3),
 *          unreadable agent file fails open, arm stays spawn-free, and the L0
 *          agents/ tree sanity pin.
 */

import { describe, it, expect, afterAll } from 'bun:test';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';

const WORKSPACE_ROOT = join(import.meta.dir, '..', '..');
const GATE_SCRIPT = join(WORKSPACE_ROOT, 'scripts', 'hooks', 'pm-dispatch-gate.ts');
const BOOTSTRAP_SCRIPT = join(WORKSPACE_ROOT, 'scripts', 'hooks', 'pm-role-bootstrap.ts');

const STATE_DIR = mkdtempSync(join(tmpdir(), 'pm-dispatch-gate-test-'));

type StdinPayload = Record<string, unknown>;

interface RunResult {
  status: number | null;
  stdout: string;
  stderr: string;
}

function runScript(script: string, input: string): RunResult {
  const res = spawnSync('bun', [script], {
    cwd: WORKSPACE_ROOT,
    input,
    encoding: 'utf8', // escapes win shell parsing ambiguity on macOS/win runner matrix
    env: {
      ...process.env,
      PM_GATE_STATE_DIR: STATE_DIR,
      CLAUDE_PROJECT_DIR: WORKSPACE_ROOT,
    },
  });
  return {
    status: res.status,
    stdout: (res.stdout ?? '').trim(),
    stderr: (res.stderr ?? '').trim(),
  };
}

function runGate(payload: StdinPayload | string): RunResult {
  return runScript(GATE_SCRIPT, typeof payload === 'string' ? payload : JSON.stringify(payload));
}

function markerFileFor(sessionId: string): string {
  const safe = sessionId.replace(/[^A-Za-z0-9_-]/g, '_');
  return join(STATE_DIR, `${safe}.json`);
}

function writeMarker(sessionId: string, ts: number): void {
  writeFileSync(
    markerFileFor(sessionId),
    JSON.stringify({ ts, source: 'pm-role-bootstrap' }),
    'utf-8',
  );
}

let id = 0;
function freshSession(prefix: string): string {
  id += 1; // serial uniqueness without Date.now collisions across rapid cases
  return `${prefix}-${Date.now()}-${id}`;
}

afterAll(() => {
  rmSync(STATE_DIR, { recursive: true, force: true });
});

describe('pm-dispatch-gate (subprocess, stdin hook path)', () => {
  it('stays silent for non-specialist tools (no decision emitted)', () => {
    const res = runGate({ tool_name: 'Bash', tool_input: { command: 'bun scripts/audit.ts' } });
    expect(res.status).toBe(0);
    expect(res.stdout).toBe('');
  });

  it('stays silent for unknown specialists (not on the roster)', () => {
    const sessionId = freshSession('unknown');
    const res = runGate({
      tool_name: 'Agent',
      tool_input: { subagent_type: 'definitely-not-a-rostered-agent' },
      session_id: sessionId,
    });
    expect(res.status).toBe(0);
    expect(res.stdout).toBe('');
  });

  it('answers ask for a rostered Claude dispatch with no fresh marker', () => {
    const sessionId = freshSession('gate');
    const res = runGate({
      tool_name: 'Agent',
      tool_input: { subagent_type: 'docs-writer' },
      session_id: sessionId,
    });
    expect(res.status).toBe(0);
    const decision = JSON.parse(res.stdout) as { decision: string; reason: string };
    expect(decision.decision).toBe('ask');
    expect(decision.reason).toContain('AGENTS.md');
  });

  it('answers deny for a rostered Gemini invoke_subagent dispatch with no fresh marker', () => {
    const sessionId = freshSession('gate');
    const res = runGate({
      tool_name: 'invoke_subagent',
      tool_input: { subagent_name: 'docs-writer' },
      session_id: sessionId,
    });
    expect(res.status).toBe(0);
    const decision = JSON.parse(res.stdout) as { decision: string; reason: string };
    expect(decision.decision).toBe('deny');
  });

  it('stays silent when the session marker is fresh', () => {
    const sessionId = freshSession('fresh');
    writeMarker(sessionId, Date.now());
    const res = runGate({
      tool_name: 'Agent',
      tool_input: { subagent_type: 'docs-writer' },
      session_id: sessionId,
    });
    expect(res.status).toBe(0);
    expect(res.stdout).toBe('');
  });

  it('blocks again when the marker is stale beyond 24h', () => {
    const sessionId = freshSession('stale');
    // T-20261026-009 #32: the marker TTL is now 7 days with a sliding refresh —
    // stale means older than 7 days, not 24h.
    writeMarker(sessionId, Date.now() - 8 * 24 * 60 * 60 * 1000);
    const res = runGate({
      tool_name: 'Agent',
      tool_input: { subagent_type: 'docs-writer' },
      session_id: sessionId,
    });
    const decision = JSON.parse(res.stdout) as { decision: string };
    expect(decision.decision).toBe('ask');
  });

  it('fails open on malformed stdin (exit 0, no output)', () => {
    const res = runGate('not-json-at-all');
    expect(res.status).toBe(0);
    expect(res.stdout).toBe('');
  });

  it('does not exempt sessions without a session id', () => {
    const res = runGate({
      tool_name: 'Agent',
      tool_input: { subagent_type: 'docs-writer' },
    });
    const decision = JSON.parse(res.stdout) as { decision: string };
    expect(decision.decision).toBe('ask');
  });
});

describe('pm-role-bootstrap marker chain (subprocess, integration)', () => {
  it('writes a fresh marker on SessionStart and the gate then allows dispatch', () => {
    const sessionId = freshSession('bootstrap');
    const res = runScript(
      BOOTSTRAP_SCRIPT,
      JSON.stringify({ hook_event_name: 'SessionStart', session_id: sessionId }),
    );
    expect(res.status).toBe(0);
    const output = JSON.parse(res.stdout) as {
      hookSpecificOutput: { hookEventName: string; additionalContext: string };
    };
    expect(output.hookSpecificOutput.hookEventName).toBe('SessionStart');
    expect(existsSync(markerFileFor(sessionId))).toBe(true);
    const marker = JSON.parse(readFileSync(markerFileFor(sessionId), 'utf8')) as {
      ts: number;
      source: string;
    };
    expect(marker.source).toBe('pm-role-bootstrap');

    const gated = runGate({
      tool_name: 'Agent',
      tool_input: { subagent_type: 'docs-writer' },
      session_id: sessionId,
    });
    expect(gated.status).toBe(0);
    expect(gated.stdout).toBe('');
  });

  it('does not write a marker for non-SessionStart events', () => {
    const sessionId = freshSession('wrongevent');
    const res = runScript(
      BOOTSTRAP_SCRIPT,
      JSON.stringify({ hook_event_name: 'PreCompact', session_id: sessionId }),
    );
    expect(res.status).toBe(0);
    expect(existsSync(markerFileFor(sessionId))).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// AUTH-GATE arm (U-20261122-006, design
// docs/designs/2026-11-22-auth-gate-hook-artifact-arm-design.md): a rostered
// agent whose frontmatter requires verify-authorization must present a fresh
// auth-gate-state.json PASS artifact; fail-closed on every invalid outcome.
// ---------------------------------------------------------------------------

const GATE_SCRIPT_V13 = join(WORKSPACE_ROOT, 'scripts', 'hooks', 'pm-dispatch-gate.ts');

const AUTH_AGENT_FM = `---
name: pentester
role: specialist
required_skills: [finding-reconciliation, sarif-exporter, verify-authorization]
---
body
`;

const PLAIN_AGENT_FM = `---
name: plain
role: specialist
required_skills: [docs]
---
body
`;

const fixtureRoots: string[] = [];
const fallbackArtifacts: string[] = [];

function makeFixture(gitMode: 'dir' | 'file' | 'none'): string {
  const root = mkdtempSync(join(tmpdir(), 'auth-gate-fixture-'));
  mkdirSync(join(root, 'agents'), { recursive: true });
  writeFileSync(join(root, 'agents', 'pentester.md'), AUTH_AGENT_FM, 'utf-8');
  writeFileSync(join(root, 'agents', 'plain.md'), PLAIN_AGENT_FM, 'utf-8');
  if (gitMode === 'dir') mkdirSync(join(root, '.git'));
  fixtureRoots.push(root);
  return root;
}

afterAll(() => {
  for (const root of fixtureRoots) rmSync(root, { recursive: true, force: true });
  for (const f of fallbackArtifacts) rmSync(f, { force: true });
});

interface GateArtifactFixture {
  schemaVersion?: number;
  verdict?: string;
  checked_at?: string | null;
  window?: Record<string, unknown> | null;
}

function artifactFixture(overrides: GateArtifactFixture = {}): Record<string, unknown> {
  return {
    schemaVersion: 1,
    project: 'co-security',
    mode: 'pre-engagement',
    verdict: 'PASS',
    checked_at: new Date().toISOString(),
    record_hash: 'deadbeef',
    sources: [],
    window: { start: '2026-01-01', end: '2099-12-31', tz: 'Asia/Seoul' },
    authorizing_party: 'user',
    registry_row: 'row',
    script_version: '1.0.0',
    ...overrides,
  };
}

function todayInTz(tz: string, now: Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(now);
}

function daysAgoIso(days: number): string {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

/** Run the hook with CLAUDE_PROJECT_DIR pinned to a fixture root. */
function runGateIn(
  projectDir: string,
  payload: StdinPayload,
  extraEnv: Record<string, string> = {},
): RunResult {
  const res = spawnSync('bun', [GATE_SCRIPT_V13], {
    cwd: WORKSPACE_ROOT,
    input: JSON.stringify(payload),
    encoding: 'utf8',
    env: {
      ...process.env,
      PM_GATE_STATE_DIR: STATE_DIR,
      CLAUDE_PROJECT_DIR: projectDir,
      ...extraEnv,
    },
  });
  return {
    status: res.status,
    stdout: (res.stdout ?? '').trim(),
    stderr: (res.stderr ?? '').trim(),
  };
}

function writeArtifact(at: string, body: Record<string, unknown> | string): void {
  mkdirSync(at.slice(0, at.lastIndexOf('/')), { recursive: true });
  writeFileSync(at, typeof body === 'string' ? body : JSON.stringify(body), 'utf-8');
}

function dispatchOf(specialist: string, sessionId?: string): StdinPayload {
  return {
    tool_name: 'Agent',
    tool_input: { subagent_type: specialist },
    ...(sessionId ? { session_id: sessionId } : {}),
  };
}

function expectAuthDeny(res: RunResult, whyFragment: string): { decision: string; reason: string } {
  expect(res.status).toBe(0);
  const decision = JSON.parse(res.stdout) as { decision: string; reason: string };
  expect(decision.decision).toBe('deny');
  expect(decision.reason).toContain('[AUTH-GATE]');
  expect(decision.reason).toContain('pentester');
  expect(decision.reason).toContain('Run bun scripts/verify-authorization-gate.ts');
  if (whyFragment) expect(decision.reason).toContain(whyFragment);
  return decision;
}

describe('AUTH-GATE arm: artifact validity (fixture tree, U-20261122-006)', () => {
  it('allows a dispatch when a fresh PASS artifact sits in <gitDir> (.git as directory)', () => {
    const root = makeFixture('dir');
    writeArtifact(join(root, '.git', 'auth-gate-state.json'), artifactFixture());
    const sessionId = freshSession('authfresh');
    writeMarker(sessionId, Date.now());
    const res = runGateIn(root, dispatchOf('pentester', sessionId));
    expect(res.status).toBe(0);
    expect(res.stdout).toBe('');
  });

  it('denies with an actionable reason when the artifact is absent', () => {
    const root = makeFixture('dir');
    const decision = expectAuthDeny(runGateIn(root, dispatchOf('pentester')), 'absent');
    expect(decision.reason).toContain('(absent)');
  });

  it('denies a stale artifact (checked_at 25h old) with expired wording', () => {
    const root = makeFixture('dir');
    writeArtifact(join(root, '.git', 'auth-gate-state.json'), artifactFixture({ checked_at: daysAgoIso(25 / 24) }));
    const decision = expectAuthDeny(runGateIn(root, dispatchOf('pentester')), 'expired');
    expect(decision.reason).toMatch(/expired \d+h/);
  });

  it('denies a future-dated checked_at (forged clock)', () => {
    const root = makeFixture('dir');
    writeArtifact(
      join(root, '.git', 'auth-gate-state.json'),
      artifactFixture({ checked_at: new Date(Date.now() + 60_000).toISOString() }),
    );
    expectAuthDeny(runGateIn(root, dispatchOf('pentester')), 'malformed');
  });

  it('denies a BLOCKED verdict artifact (defense-in-depth: BLOCKED deletes the artifact in practice)', () => {
    const root = makeFixture('dir');
    writeArtifact(join(root, '.git', 'auth-gate-state.json'), artifactFixture({ verdict: 'BLOCKED' }));
    expectAuthDeny(runGateIn(root, dispatchOf('pentester')), 'verdict BLOCKED');
  });

  it('denies malformed JSON, a wrong schemaVersion, and a missing checked_at', () => {
    const root = makeFixture('dir');
    const artifactPath = join(root, '.git', 'auth-gate-state.json');
    writeArtifact(artifactPath, '{not json at all');
    expectAuthDeny(runGateIn(root, dispatchOf('pentester')), 'malformed');
    writeArtifact(artifactPath, artifactFixture({ schemaVersion: 2 }));
    expectAuthDeny(runGateIn(root, dispatchOf('pentester')), 'malformed');
    writeArtifact(artifactPath, artifactFixture({ checked_at: null }));
    expectAuthDeny(runGateIn(root, dispatchOf('pentester')), 'malformed');
  });

  it('denies when window.end is in the past (tz-aware Asia/Seoul), allows a missing window field', () => {
    const root = makeFixture('dir');
    const artifactPath = join(root, '.git', 'auth-gate-state.json');
    // Yesterday in KST (whatever UTC midnight shifts say — computed, not hardcoded).
    const kstToday = todayInTz('Asia/Seoul', new Date());
    const y = Number(kstToday.slice(0, 4));
    const m = Number(kstToday.slice(5, 7));
    const d = Number(kstToday.slice(8, 10));
    const kstYesterday = new Date(Date.UTC(y, m - 1, d) - 12 * 60 * 60 * 1000);
    const kstYesterdayStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' }).format(kstYesterday);
    writeArtifact(
      artifactPath,
      artifactFixture({ window: { start: '2026-01-01', end: kstYesterdayStr, tz: 'Asia/Seoul' } }),
    );
    expectAuthDeny(runGateIn(root, dispatchOf('pentester')), `window ended ${kstYesterdayStr}`);

    writeArtifact(artifactPath, artifactFixture({ window: null }));
    const sessionId = freshSession('authwindow');
    writeMarker(sessionId, Date.now());
    const res = runGateIn(root, dispatchOf('pentester', sessionId));
    expect(res.status).toBe(0);
    expect(res.stdout).toBe('');
  });

  it('resolution arms: AUTH_GATE_STATE override wins over <gitDir>; a gitdir: pointer file resolves; no .git falls back to the tmpdir sha256 key', () => {
    // env override honored even when .git exists and holds a fresh artifact:
    // a stale artifact behind the override must deny (env-first resolution).
    const rootEnv = makeFixture('dir');
    writeArtifact(join(rootEnv, '.git', 'auth-gate-state.json'), artifactFixture());
    const stale = mkdtempSync(join(tmpdir(), 'auth-gate-stale-'));
    fixtureRoots.push(stale);
    const stalePath = join(stale, 'stale.json');
    writeArtifact(stalePath, artifactFixture({ checked_at: daysAgoIso(2) }));
    expectAuthDeny(runGateIn(rootEnv, dispatchOf('pentester'), { AUTH_GATE_STATE: stalePath }), 'expired');
    const fresh = mkdtempSync(join(tmpdir(), 'auth-gate-fresh-'));
    fixtureRoots.push(fresh);
    const freshPath = join(fresh, 'fresh.json');
    writeArtifact(freshPath, artifactFixture());
    const okSession = freshSession('authenv');
    writeMarker(okSession, Date.now());
    const okEnv = runGateIn(rootEnv, dispatchOf('pentester', okSession), { AUTH_GATE_STATE: freshPath });
    expect(okEnv.stdout).toBe('');

    // .git as a worktree-style pointer file: gitdir: <abs path>
    const rootPtr = makeFixture('none');
    const pointee = mkdtempSync(join(tmpdir(), 'auth-gate-gitdir-'));
    fixtureRoots.push(pointee);
    writeFileSync(join(rootPtr, '.git'), `gitdir: ${pointee}\n`, 'utf-8');
    writeArtifact(join(pointee, 'auth-gate-state.json'), artifactFixture());
    const ptrSession = freshSession('authptr');
    writeMarker(ptrSession, Date.now());
    expect(runGateIn(rootPtr, dispatchOf('pentester', ptrSession)).stdout).toBe('');

    // no .git anywhere: the tmpdir arm keyed by sha256(resolve(root)) — the
    // same formula as verify-authorization-gate.ts defaultArtifactPath().
    const rootBare = makeFixture('none');
    const key = createHash('sha256').update(rootBare).digest('hex');
    const fallbackPath = join(tmpdir(), 'ai-workspace-auth-gate', `${key}.json`);
    fallbackArtifacts.push(fallbackPath);
    writeArtifact(fallbackPath, artifactFixture());
    const bareSession = freshSession('authbare');
    writeMarker(bareSession, Date.now());
    expect(runGateIn(rootBare, dispatchOf('pentester', bareSession)).stdout).toBe('');
  });
});

describe('AUTH-GATE arm: coverage and postures (design D3/D4)', () => {
  it('denies a marker-passed PM session dispatching a verify-authorization agent with no artifact (D3)', () => {
    const root = makeFixture('dir');
    const sessionId = freshSession('authmarked');
    writeMarker(sessionId, Date.now());
    expectAuthDeny(runGateIn(root, dispatchOf('pentester', sessionId)));
    // The marker was still slid before the deny (marker semantics untouched).
    const slid = JSON.parse(readFileSync(markerFileFor(sessionId), 'utf8')) as { ts: number };
    expect(slid.ts).toBeGreaterThan(Date.now() - 60_000);
  });

  it('allows a marker-passed session when the artifact is fresh, and a non-matching agent via the marker alone', () => {
    const root = makeFixture('dir');
    writeArtifact(join(root, '.git', 'auth-gate-state.json'), artifactFixture());
    const sessionId = freshSession('authmarked-ok');
    writeMarker(sessionId, Date.now());
    expect(runGateIn(root, dispatchOf('pentester', sessionId)).stdout).toBe('');

    const plainSession = freshSession('plainmarked');
    writeMarker(plainSession, Date.now());
    const before = JSON.parse(readFileSync(markerFileFor(plainSession), 'utf8')) as { ts: number };
    expect(runGateIn(root, dispatchOf('plain', plainSession)).stdout).toBe('');
    const after = JSON.parse(readFileSync(markerFileFor(plainSession), 'utf8')) as { ts: number };
    expect(after.ts).toBeGreaterThanOrEqual(before.ts);
  });

  it('fails open on an unreadable agent file: no auth deny, marker-less session gets the PM-gate decision', () => {
    const root = makeFixture('dir');
    // existsSync true, readFileSync throws — pentester.md is a directory.
    rmSync(join(root, 'agents', 'pentester.md'));
    mkdirSync(join(root, 'agents', 'pentester.md'));
    const res = runGateIn(root, dispatchOf('pentester'));
    const decision = JSON.parse(res.stdout) as { decision: string; reason: string };
    expect(decision.decision).toBe('ask');
    expect(decision.reason).not.toContain('[AUTH-GATE]');
  });

  it('the arm stays spawn-free (no child_process anywhere in the hook)', () => {
    const src = readFileSync(GATE_SCRIPT_V13, 'utf-8');
    expect(src).not.toMatch(/spawnSync|execSync|child_process|Bun\.\$|\$\`/);
  });

  it('L0 sanity: no ROSTERED workspace-root agent matches the verify-authorization predicate (arm inert at L0)', () => {
    const agentsDir = join(WORKSPACE_ROOT, 'agents');
    for (const name of readdirSync(agentsDir)) {
      // pm.md is excluded from the dispatch roster by the hook itself (and its
      // prose quotes the predicate text when documenting the gate), so only
      // rostered agents can ever reach the arm.
      if (!name.endsWith('.md') || name === 'pm.md') continue;
      const fm = readFileSync(join(agentsDir, name), 'utf-8');
      expect(/required_skills:.*verify-authorization/.test(fm)).toBe(false);
    }
  });
});
