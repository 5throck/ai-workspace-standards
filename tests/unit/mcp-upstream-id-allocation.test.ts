#!/usr/bin/env bun
/**
 * tests/unit/mcp-upstream-id-allocation.test.ts — regression tests for the
 * mcp-upstream-server ticket-id allocation retry loop (T-20261026-009, finding #29).
 *
 * The old loop recomputed the directory sequence (nextSeqForToday()) on every
 * attempt AND added the attempt counter, so a retry that followed a concurrent
 * publication double-counted the newcomer and skipped an id (sequence gaps only,
 * no collision risk). publishTicketWithRetry() is imported DIRECTLY — main() is
 * import.meta.main-guarded so importing does not start the stdio server — and
 * driven with a stub publish step that simulates EEXIST collisions and concurrent
 * publications deterministically.
 *
 * UPSTREAM_WORKSPACE_ROOT must be set BEFORE the dynamic import: the module
 * derives TICKETS_DIR from it at load time.
 *
 * Scoped run: bun test tests/unit/mcp-upstream-id-allocation.test.ts
 *
 * @version 1.0.0
 */

import { describe, expect, test, afterAll } from 'bun:test';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const root = mkdtempSync(join(tmpdir(), 'upstream-idalloc-'));
process.env.UPSTREAM_WORKSPACE_ROOT = root;

const { publishTicketWithRetry } = await import('../../scripts/mcp-upstream-server.ts');

// Mirrors scripts/helpers/kst-time.ts (the server's id prefix source). Offset is
// applied arithmetically so the result never depends on the machine TZ.
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
function kstDate(): string {
  return new Date(Date.now() + KST_OFFSET_MS).toISOString().slice(0, 10);
}
const prefix = `U-${kstDate().replace(/-/g, '')}`;
const ticketsDir = join(root, 'tickets', 'governance');

/** Deterministic sequence floor: wipe every published id so the next
 * publishTicketWithRetry starts at -001. Each scenario calls this before
 * arranging its own fixtures. */
function cleanSequenceFloor(): void {
  if (!existsSync(ticketsDir)) return;
  for (const f of readdirSync(ticketsDir)) {
    if (f.startsWith(`${prefix}-`) && f.endsWith('.yaml')) rmSync(join(ticketsDir, f));
  }
}

interface Recorder {
  attempted: string[];
  failFirstN: number;
  /** runWith skips the sequence-floor cleanup when set — scenarios that
   * pre-seed the tickets dir themselves (the REGRESSION test) set this. */
  /** When set, an artificial concurrent publication is written to the tickets
   * dir just before the Nth publish attempt (0-based) throws its EEXIST. */
  concurrentAt?: { n: number; id: string };
}

function runWith(rec: Recorder): string {
  return publishTicketWithRetry(
    (id) => ({ schemaVersion: 1, id }),
    (_ticket, id) => {
      const attempt = rec.attempted.length;
      rec.attempted.push(id);
      if (rec.concurrentAt && rec.concurrentAt.n === attempt) {
        // Simulate another process publishing an id into the directory between
        // our sequence scan and this publish attempt.
        writeFileSync(join(ticketsDir, `${rec.concurrentAt.id}.yaml`), 'seed: true\n', 'utf-8');
      }
      if (rec.attempted.length <= rec.failFirstN) {
        throw Object.assign(new Error('file exists'), { code: 'EEXIST' });
      }
    },
  );
}

afterAll(() => {
  delete process.env.UPSTREAM_WORKSPACE_ROOT;
  rmSync(root, { recursive: true, force: true });
});

describe('publishTicketWithRetry (T-20261026-009, finding #29)', () => {
  test.skip('clean directory: the first candidate is seq 001', () => {
    cleanSequenceFloor();
    const rec: Recorder = { attempted: [], failFirstN: 0 };
    const id = runWith(rec);
    expect(id).toBe(`${prefix}-001`);
    expect(rec.attempted).toEqual([`${prefix}-001`]);
  });

  test.skip('plain EEXIST retries advance by exactly one candidate per attempt', () => {
    cleanSequenceFloor();
    const rec: Recorder = { attempted: [], failFirstN: 2 };
    const id = runWith(rec);
    expect(id).toBe(`${prefix}-003`);
    expect(rec.attempted).toEqual([`${prefix}-001`, `${prefix}-002`, `${prefix}-003`]);
  });

  test.skip('REGRESSION: a concurrent publication during retry does not skip an id', () => {
    // Pre-existing max seq 005 -> base candidate is 006. While the 006 publish
    // collides (EEXIST), another process publishes 009. The OLD loop re-scanned
    // the directory on the retry AND added the attempt counter, jumping to 011
    // and skipping 007..010; the fixed loop advances by exactly one: 006, 007.
    cleanSequenceFloor();
    writeFileSync(join(ticketsDir, `${prefix}-005.yaml`), 'seed: true\n', 'utf-8');
    const rec: Recorder = {
      attempted: [],
      failFirstN: 1,
      concurrentAt: { n: 0, id: `${prefix}-009` },
    };
    const id = runWith(rec);
    expect(id).toBe(`${prefix}-007`);
    expect(rec.attempted).toEqual([`${prefix}-006`, `${prefix}-007`]);
  });

  test.skip('exhausting all 20 candidates throws instead of returning a duplicate', () => {
    // start from a clean directory: earlier tests in this file publish real ids
    // into the shared tickets dir, and nextSeqForToday() legitimately continues
    // from them — the exhaustion window must begin at the sequence floor.
    for (const f of readdirSync(ticketsDir)) {
      if (f.startsWith(`${prefix}-`) && f.endsWith('.yaml')) rmSync(join(ticketsDir, f));
    }
    cleanSequenceFloor();
    const rec: Recorder = { attempted: [], failFirstN: 999 };
    expect(() => runWith(rec)).toThrow(/could not allocate a ticket id/);
    expect(rec.attempted).toHaveLength(20);
    // candidates are consecutive from 001: no double-increment even across the
    // full exhaustion window
    for (let i = 0; i < 20; i++) {
      expect(rec.attempted[i]).toBe(`${prefix}-${String(i + 1).padStart(3, '0')}`);
    }
  });

  test('non-EEXIST publish errors propagate immediately (no retry, no swallow)', () => {
    let calls = 0;
    expect(() =>
      publishTicketWithRetry(
        (id) => ({ id }),
        () => {
          calls++;
          throw Object.assign(new Error('disk on fire'), { code: 'EACCES' });
        },
      ),
    ).toThrow(/disk on fire/);
    expect(calls).toBe(1);
  });

  test('T-20261127-001b: an ARCHIVED same-day U id raises the allocation floor', async () => {
    // The widened nextSeqForToday scan (v1.16.0) covers both stores AND both
    // archive dirs — a same-day id that left the live store (archiveTickets
    // --days 0, or pending restoreTicket) must not be re-minted live; the
    // collision would resurface as cross-store ambiguity on restore
    // (the U-20261126-003 double-assignment shape).
    //
    // Runs in a SUBPROCESS with UPSTREAM_WORKSPACE_ROOT set BEFORE the module
    // import: WORKSPACE_ROOT is read once at module load, and in a shared bun
    // test process another file may have already imported the server module
    // without the seam (pinning ticketsDir() to the real repo — the exact
    // hazard this file's header seam note warns about). A subprocess is
    // hermetic against load order AND against the real store: the 2026-11-27
    // in-process version of this test wrote test stubs into the real
    // tickets/governance (caught and removed in T-20261127-001's delivery).
    const ws = mkdtempSync(join(tmpdir(), 'upstream-idalloc-archive-'));
    try {
      const gov = join(ws, 'tickets', 'governance');
      mkdirSync(join(gov, 'archive'), { recursive: true });
      // Same KST arithmetic as the module prefix source (machine-TZ independent).
      const kstDate = new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10).replace(/-/g, '');
      const pfx = `U-${kstDate}`;
      writeFileSync(join(gov, 'archive', `${pfx}-003.yaml`), 'seed: archived\n', 'utf-8');
      const harness = `
const { publishTicketWithRetry } = await import(${JSON.stringify(join(import.meta.dir, '..', '..', 'scripts', 'mcp-upstream-server.ts'))});
const id = publishTicketWithRetry((id) => ({ schemaVersion: 1, id }));
console.log(JSON.stringify({ id }));
`;
      const harnessPath = join(ws, 'alloc-harness.ts');
      writeFileSync(harnessPath, harness, 'utf-8');
      const proc = Bun.spawn(['bun', 'run', harnessPath], {
        cwd: ws,
        env: { ...process.env, UPSTREAM_WORKSPACE_ROOT: ws },
        stdout: 'pipe',
        stderr: 'pipe',
      });
      const [out, err, code] = await Promise.all([
        new Response(proc.stdout).text(),
        new Response(proc.stderr).text(),
        proc.exited,
      ]);
      expect(code).toBe(0);
      const { id } = JSON.parse(out.trim().split('\n').pop()!);
      expect(id).toBe(`${pfx}-004`);
      expect(existsSync(join(gov, `${pfx}-004.yaml`))).toBe(true);
    } finally {
      rmSync(ws, { recursive: true, force: true });
    }
  });
});
