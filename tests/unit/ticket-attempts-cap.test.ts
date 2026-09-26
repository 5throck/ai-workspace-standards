/**
 * Unit tests for the ticket retry budget (T-20260926-021, design D2):
 * `failed -> waiting` beyond DEFAULT_ATTEMPTS_CAP is refused unless forced —
 * the "one retry, then escalate" rule is now mechanical, not prompt prose.
 *
 * @version 1.0.0
 */
import { describe, test, expect, afterEach } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createTicket, moveTicket, DEFAULT_ATTEMPTS_CAP } from '../../scripts/helpers/ticket-store.ts';

const dir = mkdtempSync(join(tmpdir(), 'ticket-cap-test-'));
afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe('moveTicket — retry cap', () => {
  test('cap constant is the documented 2', () => {
    expect(DEFAULT_ATTEMPTS_CAP).toBe(2);
  });

  test('a failed ticket can be re-queued up to the cap, then refused', () => {
    const t = createTicket(dir, { kind: 'manual', title: 'retry budget probe', priority: 'normal' });
    moveTicket(dir, t.id, 'waiting');
    moveTicket(dir, t.id, 'running');
    moveTicket(dir, t.id, 'failed', { error: 'boom 1' });

    // First retry: attempts 0 -> 1 — allowed.
    moveTicket(dir, t.id, 'waiting');
    moveTicket(dir, t.id, 'running');
    moveTicket(dir, t.id, 'failed', { error: 'boom 2' });

    // Second retry: attempts 1 -> 2 (== cap) — allowed.
    moveTicket(dir, t.id, 'waiting');
    moveTicket(dir, t.id, 'running');
    moveTicket(dir, t.id, 'failed', { error: 'boom 3' });

    // Third retry: attempts 2 -> 3 (> cap) — refused.
    expect(() => moveTicket(dir, t.id, 'waiting')).toThrow(/retry budget/);
    // Forced retry is the documented escape.
    const forced = moveTicket(dir, t.id, 'waiting', { force: true });
    expect(forced.attempts).toBe(3);
  });

  test('non-retry transitions never consume the budget', () => {
    const t = createTicket(dir, { kind: 'manual', title: 'no-budget transition', priority: 'normal' });
    moveTicket(dir, t.id, 'waiting');
    moveTicket(dir, t.id, 'running');
    moveTicket(dir, t.id, 'review');
    const done = moveTicket(dir, t.id, 'done', { result: 'completed first pass' });
    expect(done.attempts).toBe(0);
  });
});
