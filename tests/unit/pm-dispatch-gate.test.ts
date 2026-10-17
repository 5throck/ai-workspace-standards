#!/usr/bin/env bun
/**
 * tests/unit/pm-dispatch-gate.test.ts — unit tests for scripts/hooks/pm-dispatch-gate.ts
 * and the marker chain with scripts/hooks/pm-role-bootstrap.ts.
 *
 * Runs each hook as a subprocess over stdin (the real hook invocation path),
 * with PM_GATE_STATE_DIR pointed at a fresh temp dir and CLAUDE_PROJECT_DIR
 * pinned to this workspace root, so tests never touch the real session state.
 *
 * Scoped run (bare `bun test` at the workspace root would pick up Projects/*):
 *   bun tests/unit/pm-dispatch-gate.test.ts
 *
 * @version 1.0.0
 */

import { describe, it, expect, afterAll } from 'bun:test';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

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
    writeMarker(sessionId, Date.now() - 25 * 60 * 60 * 1000);
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
